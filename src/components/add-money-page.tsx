"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  CircleDollarSign,
  FolderInput,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { financeApi, listResource, queryKeys } from "@/lib/api";
import type {
  Account,
  AllocationPreview,
  Bucket,
  Category,
  IncomeSource,
} from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors";
import { createIdempotencyKey } from "@/lib/idempotency";
import { parseMoneyInput } from "@/lib/money";
import { AllocationBreakdown } from "@/components/financial";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  MoneyAmount,
  PageHeader,
  SubmitButton,
} from "@/components/ui-kit";
import { cn } from "@/lib/utils";

type Flow = "income" | "expense" | "transfer" | "reallocate";
type FlowValues = {
  amount: string;
  accountId: string;
  incomeSourceId: string;
  bucketId: string;
  categoryId: string;
  fromAccountId: string;
  toAccountId: string;
  fromBucketId: string;
  toBucketId: string;
  description: string;
  date: string;
  split: boolean;
  splits: { bucketId: string; amount: string }[];
};
const flowSchema = z.object({
  amount: z.string().min(1, "Enter an amount."),
  accountId: z.string(),
  incomeSourceId: z.string(),
  bucketId: z.string(),
  categoryId: z.string(),
  fromAccountId: z.string(),
  toAccountId: z.string(),
  fromBucketId: z.string(),
  toBucketId: z.string(),
  description: z.string().max(500),
  date: z.string(),
  split: z.boolean(),
  splits: z.array(z.object({ bucketId: z.string(), amount: z.string() })),
});
const today = () => new Date().toISOString().slice(0, 10);
const defaults: FlowValues = {
  amount: "",
  accountId: "",
  incomeSourceId: "",
  bucketId: "",
  categoryId: "",
  fromAccountId: "",
  toAccountId: "",
  fromBucketId: "",
  toBucketId: "",
  description: "",
  date: today(),
  split: false,
  splits: [
    { bucketId: "", amount: "" },
    { bucketId: "", amount: "" },
  ],
};

const flowCopy: Record<
  Flow,
  { title: string; description: string; icon: typeof Plus }
> = {
  income: {
    title: "Add income",
    description:
      "Record money arriving, then review the server's allocation before confirming.",
    icon: CircleDollarSign,
  },
  expense: {
    title: "Add expense",
    description:
      "Spend from one physical account and one or more purpose buckets.",
    icon: ReceiptText,
  },
  transfer: {
    title: "Move money",
    description:
      "Transfers move money between accounts. They do not count as spending.",
    icon: ArrowLeftRight,
  },
  reallocate: {
    title: "Change its purpose",
    description: "Change what money is for without moving where it is.",
    icon: FolderInput,
  },
};

export function AddMoneyPage() {
  const params = useSearchParams();
  const requested = params.get("flow");
  const [flow, setFlow] = useState<Flow>(
    requested === "expense" ||
      requested === "transfer" ||
      requested === "reallocate"
      ? requested
      : "income",
  );
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const [success, setSuccess] = useState<{
    title: string;
    message: string;
    amount: number;
    links: { href: string; label: string }[];
  } | null>(null);
  const queryClient = useQueryClient();
  const intentKey = useRef<string | null>(null);
  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.resource("accounts", { limit: 100 }),
        queryFn: () => listResource("accounts", { limit: 100 }),
      },
      {
        queryKey: queryKeys.resource("buckets", { limit: 100 }),
        queryFn: () => listResource("buckets", { limit: 100 }),
      },
      {
        queryKey: queryKeys.resource("categories", { limit: 100 }),
        queryFn: () => listResource("categories", { limit: 100 }),
      },
      {
        queryKey: queryKeys.resource("income-sources", { limit: 100 }),
        queryFn: () => listResource("income-sources", { limit: 100 }),
      },
    ],
  });
  const [accounts, buckets, categories, sources] = results.map(
    (result) => result.data?.items || [],
  ) as [Account[], Bucket[], Category[], IncomeSource[]];
  const form = useForm<FlowValues>({
    resolver: zodResolver(flowSchema),
    defaultValues: defaults,
  });
  const splits = useFieldArray({ control: form.control, name: "splits" });
  const isSplit = useWatch({ control: form.control, name: "split" });
  const mutation = useMutation({
    mutationFn: async (values: FlowValues) => {
      const parsed = parseMoneyInput(values.amount);
      if (!parsed.ok) {
        form.setError("amount", { message: parsed.message });
        throw new Error(parsed.message);
      }
      const amountMinor = parsed.amountMinor;
      const key =
        intentKey.current ?? (intentKey.current = createIdempotencyKey());
      if (flow === "income") {
        if (!values.accountId) {
          form.setError("accountId", {
            message: "Choose the receiving account.",
          });
          throw new Error("form");
        }
        const input = {
          amountMinor,
          accountId: values.accountId,
          incomeSourceId: values.incomeSourceId || undefined,
          description: values.description || undefined,
          transactionDate: values.date || undefined,
        };
        if (!preview)
          return {
            kind: "preview" as const,
            data: await financeApi.previewIncome(input),
            amountMinor,
          };
        const result = await financeApi.postIncome(input, key);
        return {
          kind: "success" as const,
          amountMinor,
          title: "Income added and assigned",
          message: `${result.allocations.length} allocation${result.allocations.length === 1 ? "" : "s"} confirmed by the server.`,
          links: [
            {
              href: `/transactions/${result.transaction._id}`,
              label: "View income",
            },
            { href: "/buckets", label: "View buckets" },
          ],
        };
      }
      if (flow === "expense") {
        if (!values.accountId || !values.categoryId)
          throw new Error("Choose an account and category.");
        let input: Record<string, unknown> = {
          amountMinor,
          accountId: values.accountId,
          categoryId: values.categoryId,
          description: values.description || undefined,
          transactionDate: values.date || undefined,
        };
        if (values.split) {
          const bucketSplits = values.splits.map((item, index) => {
            const money = parseMoneyInput(item.amount);
            if (!item.bucketId || !money.ok)
              throw new Error(`Complete split ${index + 1}.`);
            return { bucketId: item.bucketId, amountMinor: money.amountMinor };
          });
          const total = bucketSplits.reduce(
            (sum, item) => sum + item.amountMinor,
            0,
          );
          if (total !== amountMinor)
            throw new Error(
              "Bucket splits must equal the full expense amount.",
            );
          if (
            new Set(bucketSplits.map((item) => item.bucketId)).size !==
            bucketSplits.length
          )
            throw new Error("Choose each bucket only once.");
          input = { ...input, bucketSplits };
        } else {
          if (!values.bucketId) throw new Error("Choose a bucket.");
          input = { ...input, bucketId: values.bucketId };
        }
        const result = await financeApi.postExpense(input, key, values.split);
        return {
          kind: "success" as const,
          amountMinor,
          title: "Expense recorded",
          message: `New account balance: ${result.resultingAccountBalanceMinor / 100} NGN.`,
          links: [
            {
              href: `/transactions/${result.expense._id}`,
              label: "View expense",
            },
            { href: "/transactions", label: "View activity" },
          ],
        };
      }
      if (flow === "transfer") {
        if (
          !values.fromAccountId ||
          !values.toAccountId ||
          values.fromAccountId === values.toAccountId
        )
          throw new Error("Choose two different accounts.");
        await financeApi.transfer(
          {
            fromAccountId: values.fromAccountId,
            toAccountId: values.toAccountId,
            amountMinor,
            description: values.description || undefined,
            transactionDate: values.date || undefined,
          },
          key,
        );
        return {
          kind: "success" as const,
          amountMinor,
          title: "Money moved",
          message:
            "Both account balances are confirmed. Your spending and buckets are unchanged.",
          links: [
            { href: "/accounts", label: "View accounts" },
            { href: "/transactions", label: "View activity" },
          ],
        };
      }
      if (
        !values.fromBucketId ||
        !values.toBucketId ||
        values.fromBucketId === values.toBucketId
      )
        throw new Error("Choose two different buckets.");
      await financeApi.reallocate(
        {
          fromBucketId: values.fromBucketId,
          toBucketId: values.toBucketId,
          amountMinor,
          description: values.description || undefined,
          date: values.date || undefined,
        },
        key,
      );
      return {
        kind: "success" as const,
        amountMinor,
        title: "Purpose changed",
        message: "Both bucket balances are confirmed. No physical money moved.",
        links: [
          { href: "/buckets", label: "View buckets" },
          { href: "/transactions", label: "View activity" },
        ],
      };
    },
    onSuccess: async (result) => {
      if (result.kind === "preview") {
        setPreview(result.data);
        intentKey.current = null;
        return;
      }
      setSuccess({
        title: result.title,
        message: result.message,
        amount: result.amountMinor,
        links: result.links,
      });
      intentKey.current = null;
      await queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });

  const setFlowSafely = (next: Flow) => {
    setFlow(next);
    setPreview(null);
    setSuccess(null);
    intentKey.current = null;
    form.reset({ ...defaults, date: today() });
  };
  const submit = form.handleSubmit((values) => {
    mutation.reset();
    mutation.mutate(values);
  });
  const shortage =
    mutation.error instanceof ApiError ? mutation.error.code : "";
  if (results.some((result) => result.isLoading))
    return (
      <>
        <PageHeader eyebrow="New activity" title="Add money activity" />
        <LoadingBlock rows={4} />
      </>
    );
  if (results.some((result) => result.error))
    return (
      <ErrorState
        error={errorMessage(results.find((result) => result.error)?.error)}
      />
    );
  if (!accounts.length && flow !== "reallocate")
    return (
      <EmptyState
        title="Add an account first"
        description="An account tells us where your physical money lives."
        action={{ href: "/accounts", label: "Add account" }}
      />
    );
  if (success)
    return (
      <SuccessPanel
        success={success}
        reset={() => {
          setSuccess(null);
          setPreview(null);
          form.reset({ ...defaults, date: today() });
        }}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="New activity"
        title={flowCopy[flow].title}
        description={flowCopy[flow].description}
      />
      <div className="flow-tabs" role="tablist" aria-label="Activity type">
        {(Object.keys(flowCopy) as Flow[]).map((key) => {
          const Icon = flowCopy[key].icon;
          return (
            <button
              role="tab"
              aria-selected={flow === key}
              className={flow === key ? "active" : ""}
              onClick={() => setFlowSafely(key)}
              key={key}
            >
              <Icon />
              <span>{flowCopy[key].title}</span>
            </button>
          );
        })}
      </div>
      <div className={cn("flow-layout", preview && "with-preview")}>
        <form className="money-form" onSubmit={submit} noValidate>
          {preview && (
            <button
              type="button"
              className="back-link"
              onClick={() => setPreview(null)}
            >
              <ArrowLeft />
              Edit income details
            </button>
          )}
          <Field
            label="Amount"
            hint="NGN"
            error={form.formState.errors.amount?.message}
          >
            <div className="money-input">
              <span>N</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("amount")}
                disabled={Boolean(preview)}
              />
            </div>
          </Field>
          {flow === "income" && (
            <>
              <Field
                label="Receiving account"
                error={form.formState.errors.accountId?.message}
              >
                <Select
                  options={accounts}
                  register={form.register("accountId")}
                  empty="Choose account"
                  disabled={Boolean(preview)}
                />
              </Field>
              <Field label="Income source" hint="Optional">
                <Select
                  options={sources}
                  register={form.register("incomeSourceId")}
                  empty="No source"
                  disabled={Boolean(preview)}
                />
              </Field>
            </>
          )}
          {flow === "expense" && (
            <>
              <Field label="Pay from account">
                <Select
                  options={accounts}
                  register={form.register("accountId")}
                  empty="Choose account"
                />
              </Field>
              <Field label="Category">
                <Select
                  options={categories}
                  register={form.register("categoryId")}
                  empty="Choose category"
                />
              </Field>
              <label className="split-toggle">
                <input type="checkbox" {...form.register("split")} />
                <span>
                  <b>Split across buckets</b>
                  <small>
                    Choose exactly how much each purpose contributes.
                  </small>
                </span>
              </label>
              {isSplit ? (
                <div className="split-list">
                  {splits.fields.map((item, index) => (
                    <div className="split-row" key={item.id}>
                      <Select
                        options={buckets}
                        register={form.register(`splits.${index}.bucketId`)}
                        empty="Choose bucket"
                      />
                      <input
                        inputMode="decimal"
                        placeholder="Amount"
                        {...form.register(`splits.${index}.amount`)}
                      />
                      <button
                        type="button"
                        disabled={splits.fields.length <= 2}
                        onClick={() => splits.remove(index)}
                        aria-label={`Remove split ${index + 1}`}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-split"
                    onClick={() => splits.append({ bucketId: "", amount: "" })}
                  >
                    <Plus />
                    Add another bucket
                  </button>
                </div>
              ) : (
                <Field label="Purpose bucket">
                  <Select
                    options={buckets}
                    register={form.register("bucketId")}
                    empty="Choose bucket"
                  />
                </Field>
              )}
            </>
          )}
          {flow === "transfer" && (
            <>
              <Field label="From account">
                <Select
                  options={accounts}
                  register={form.register("fromAccountId")}
                  empty="Choose source"
                />
              </Field>
              <Field label="To account">
                <Select
                  options={accounts}
                  register={form.register("toAccountId")}
                  empty="Choose destination"
                />
              </Field>
              <p className="flow-note">
                <ArrowLeftRight />
                Total money and all purpose buckets remain unchanged.
              </p>
            </>
          )}
          {flow === "reallocate" && (
            <>
              <Field label="From bucket">
                <Select
                  options={buckets}
                  register={form.register("fromBucketId")}
                  empty="Choose source purpose"
                />
              </Field>
              <Field label="To bucket">
                <Select
                  options={buckets}
                  register={form.register("toBucketId")}
                  empty="Choose new purpose"
                />
              </Field>
              <p className="flow-note">
                <FolderInput />
                Account balances and total unallocated money remain unchanged.
              </p>
            </>
          )}
          <div className="form-grid">
            <Field label="Date">
              <input
                type="date"
                {...form.register("date")}
                disabled={Boolean(preview)}
              />
            </Field>
            <Field label="Description" hint="Optional">
              <input
                placeholder="Add a helpful note"
                {...form.register("description")}
                disabled={Boolean(preview)}
              />
            </Field>
          </div>
          {mutation.error &&
            !String(mutation.error.message).includes("form") && (
              <div className="form-error-box" role="alert">
                <p>{errorMessage(mutation.error)}</p>
                {shortage === "INSUFFICIENT_BUCKET_BALANCE" && !isSplit && (
                  <button
                    type="button"
                    onClick={() => form.setValue("split", true)}
                  >
                    Build a split expense
                  </button>
                )}
              </div>
            )}
          <SubmitButton busy={mutation.isPending}>
            {flow === "income"
              ? preview
                ? "Confirm income"
                : "Preview allocation"
              : flow === "expense"
                ? "Add expense"
                : flow === "transfer"
                  ? "Move money"
                  : "Change purpose"}
          </SubmitButton>
        </form>
        {preview && <AllocationBreakdown preview={preview} />}
      </div>
    </>
  );
}

function Select({
  options,
  register,
  empty,
  disabled,
}: {
  options: { _id: string; name: string }[];
  register: ReturnType<ReturnType<typeof useForm<FlowValues>>["register"]>;
  empty: string;
  disabled?: boolean;
}) {
  return (
    <select {...register} disabled={disabled}>
      <option value="">{empty}</option>
      {options.map((item) => (
        <option key={item._id} value={item._id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
function SuccessPanel({
  success,
  reset,
}: {
  success: {
    title: string;
    message: string;
    amount: number;
    links: { href: string; label: string }[];
  };
  reset: () => void;
}) {
  return (
    <section className="success-panel">
      <span>
        <Check />
      </span>
      <p className="eyebrow">Server confirmed</p>
      <h1>{success.title}</h1>
      <MoneyAmount value={success.amount} />
      <p>{success.message}</p>
      <div>
        {success.links.map((link) => (
          <Link className="button-secondary" href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
        <button className="button-primary" onClick={reset}>
          Add another
        </button>
      </div>
    </section>
  );
}
