"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  CircleDollarSign,
  Copy,
  Edit3,
  FolderInput,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import type { Account, Bucket, Category, IncomeSource } from "@/lib/api/types";
import type { BackfillActivity } from "@/lib/api/backfill-types";
import { createIdempotencyKey } from "@/lib/idempotency";
import { parseMoneyInput } from "@/lib/money";
import { serializeZonedDateTime } from "@/lib/backfill-dates";
import { allocationRows, sortActivities } from "./utils";
import { EmptyState, Field, Modal, MoneyAmount } from "@/components/ui-kit";

export type BackfillResources = {
  accounts: Account[];
  buckets: Bucket[];
  categories: Category[];
  sources: IncomeSource[];
};

export function BackfillActivityEditor({
  activities,
  resources,
  timezone,
  saving,
  onSave,
  onContinue,
}: {
  activities: BackfillActivity[];
  resources: BackfillResources;
  timezone: string;
  saving: boolean;
  onSave(value: BackfillActivity[]): void;
  onContinue(): void;
}) {
  const [editor, setEditor] = useState<
    BackfillActivity | BackfillActivity["type"] | null
  >(null);
  const [filter, setFilter] = useState<"all" | BackfillActivity["type"]>("all");
  const sorted = sortActivities(activities).filter(
    (item) => filter === "all" || item.type === filter,
  );
  const add = (type: BackfillActivity["type"]) => setEditor(type);
  return (
    <section className="backfill-panel">
      <header className="builder-heading">
        <div>
          <p className="eyebrow">Historical gap</p>
          <h2>Stage activity between both dates.</h2>
        </div>
        <span>{saving ? "Saving…" : "Saved to server draft"}</span>
      </header>
      <div className="activity-actions">
        <button onClick={() => add("income")}>
          <CircleDollarSign />
          Add income
        </button>
        <button onClick={() => add("expense")}>
          <ReceiptText />
          Add expense
        </button>
        <button onClick={() => add("transfer")}>
          <ArrowLeftRight />
          Transfer
        </button>
        <button onClick={() => add("reallocation")}>
          <FolderInput />
          Reallocate
        </button>
      </div>
      <label className="compact-filter">
        Show{" "}
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
        >
          <option value="all">All activity</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
          <option value="transfer">Transfers</option>
          <option value="reallocation">Reallocations</option>
        </select>
      </label>
      {!sorted.length ? (
        <EmptyState
          title="No staged activity"
          description="If nothing happened between the dates, continue directly to reconciliation."
        />
      ) : (
        <div className="staged-list">
          {sorted.map((activity) => (
            <article key={activity.clientId}>
              <ActivityIcon type={activity.type} />
              <div>
                <b>{activity.description || title(activity.type)}</b>
                <small>
                  {activityContext(activity, resources)} ·{" "}
                  {new Date(activity.transactionDate).toLocaleString()}
                </small>
              </div>
              <MoneyAmount value={activity.amountMinor} />
              <div className="row-actions">
                <button
                  aria-label="Edit staged activity"
                  onClick={() => setEditor(activity)}
                >
                  <Edit3 />
                </button>
                <button
                  aria-label="Copy staged activity"
                  onClick={() =>
                    onSave([
                      ...activities,
                      {
                        ...activity,
                        clientId: createIdempotencyKey(),
                        description: activity.description
                          ? `${activity.description} (copy)`
                          : undefined,
                      },
                    ])
                  }
                >
                  <Copy />
                </button>
                <button
                  aria-label="Delete staged activity"
                  onClick={() =>
                    onSave(
                      activities.filter(
                        (item) => item.clientId !== activity.clientId,
                      ),
                    )
                  }
                >
                  <Trash2 />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="wizard-actions">
        <span>
          {activities.length} staged event{activities.length === 1 ? "" : "s"}
        </span>
        <button
          className="button-primary"
          disabled={saving}
          onClick={onContinue}
        >
          Reconcile with server
        </button>
      </div>
      <ActivityDialog
        key={typeof editor === "string" ? editor : editor?.clientId || "closed"}
        open={Boolean(editor)}
        value={editor && typeof editor !== "string" ? editor : undefined}
        type={typeof editor === "string" ? editor : editor?.type || "expense"}
        resources={resources}
        timezone={timezone}
        busy={saving}
        onClose={() => setEditor(null)}
        onSave={(activity) => {
          onSave(
            editor && typeof editor !== "string"
              ? activities.map((item) =>
                  item.clientId === editor.clientId ? activity : item,
                )
              : [...activities, activity],
          );
          setEditor(null);
        }}
      />
    </section>
  );
}

function ActivityDialog({
  open,
  value,
  type,
  resources,
  timezone,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  value?: BackfillActivity;
  type: BackfillActivity["type"];
  resources: BackfillResources;
  timezone: string;
  busy: boolean;
  onClose(): void;
  onSave(value: BackfillActivity): void;
}) {
  const initial = formFrom(value);
  const [form, setForm] = useState(initial);
  const [rows, setRows] = useState(() => rowsFrom(value));
  const [error, setError] = useState("");
  useUnsavedWarning(open);
  const submit = () => {
    try {
      setError("");
      onSave(
        buildBackfillActivity(
          value?.clientId || createIdempotencyKey(),
          type,
          form,
          rows,
          timezone,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Check the activity details.",
      );
    }
  };
  return (
    <Modal
      open={open}
      title={`${value ? "Edit" : "Add"} ${title(type)}`}
      description="This remains staged until finalization."
      onClose={onClose}
      wide
    >
      <div className="money-form">
        <div className="form-grid">
          <Field label="Amount" hint="NGN">
            <input
              inputMode="decimal"
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: event.target.value })
              }
            />
          </Field>
          <Field label="Actual date and time">
            <input
              type="datetime-local"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </Field>
        </div>
        {(type === "income" || type === "expense") && (
          <Field label="Account">
            <select
              value={form.accountId}
              onChange={(event) =>
                setForm({ ...form, accountId: event.target.value })
              }
            >
              <option value="">Choose account</option>
              {resources.accounts.map(option)}
            </select>
          </Field>
        )}
        {type === "income" && (
          <Field label="Income source" hint="Optional">
            <select
              value={form.sourceId}
              onChange={(event) =>
                setForm({ ...form, sourceId: event.target.value })
              }
            >
              <option value="">No source</option>
              {resources.sources.map(option)}
            </select>
          </Field>
        )}
        {type === "expense" && (
          <Field label="Category">
            <select
              value={form.categoryId}
              onChange={(event) =>
                setForm({ ...form, categoryId: event.target.value })
              }
            >
              <option value="">Choose category</option>
              {resources.categories.map(option)}
            </select>
          </Field>
        )}
        {type === "transfer" && (
          <Pair
            label="account"
            items={resources.accounts}
            form={form}
            setForm={setForm}
          />
        )}
        {type === "reallocation" && (
          <Pair
            label="bucket"
            items={resources.buckets}
            form={form}
            setForm={setForm}
          />
        )}
        {(type === "income" || type === "expense") && (
          <div>
            <div className="builder-heading">
              <div>
                <b>
                  {type === "income"
                    ? "Manual historical allocations"
                    : "Bucket splits"}
                </b>
                <small>
                  {type === "income"
                    ? "May total less than income."
                    : "Must total exactly the expense."}
                </small>
              </div>
              <button
                onClick={() => setRows([...rows, { bucketId: "", amount: "" }])}
              >
                <Plus />
                Add row
              </button>
            </div>
            {rows.map((row, index) => (
              <div className="assignment-row" key={index}>
                <select
                  value={row.bucketId}
                  onChange={(event) =>
                    setRows(
                      rows.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, bucketId: event.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="">Choose bucket</option>
                  {resources.buckets.map(option)}
                </select>
                <input
                  inputMode="decimal"
                  placeholder="Amount"
                  value={row.amount}
                  onChange={(event) =>
                    setRows(
                      rows.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, amount: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  aria-label="Remove row"
                  onClick={() =>
                    setRows(rows.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        )}
        <Field label="Description" hint="Optional">
          <textarea
            rows={2}
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        {error && (
          <p className="form-error-box" role="alert">
            {error}
          </p>
        )}
        <button
          className="button-primary submit-button"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "Saving…" : "Save staged activity"}
        </button>
      </div>
    </Modal>
  );
}

type Form = {
  amount: string;
  date: string;
  description: string;
  accountId: string;
  sourceId: string;
  categoryId: string;
  fromId: string;
  toId: string;
};
function formFrom(value?: BackfillActivity): Form {
  return {
    amount: value ? String(value.amountMinor / 100) : "",
    date: value
      ? toLocalInput(value.transactionDate)
      : toLocalInput(new Date().toISOString()),
    description: value?.description || "",
    accountId: value && "accountId" in value ? value.accountId : "",
    sourceId: value?.type === "income" ? value.incomeSourceId || "" : "",
    categoryId: value?.type === "expense" ? value.categoryId : "",
    fromId:
      value && "fromAccountId" in value
        ? value.fromAccountId
        : value && "fromBucketId" in value
          ? value.fromBucketId
          : "",
    toId:
      value && "toAccountId" in value
        ? value.toAccountId
        : value && "toBucketId" in value
          ? value.toBucketId
          : "",
  };
}
function rowsFrom(value?: BackfillActivity) {
  const rows =
    value?.type === "income"
      ? value.allocations
      : value?.type === "expense"
        ? value.bucketSplits
        : undefined;
  return (rows?.length ? rows : [{ bucketId: "", amountMinor: 0 }]).map(
    (row) => ({
      bucketId: row.bucketId,
      amount: row.amountMinor ? String(row.amountMinor / 100) : "",
    }),
  );
}
export function buildBackfillActivity(
  clientId: string,
  type: BackfillActivity["type"],
  form: Form,
  rows: Array<{ bucketId: string; amount: string }>,
  timezone = "Africa/Lagos",
): BackfillActivity {
  const money = parseMoneyInput(form.amount);
  if (!money.ok) throw new Error(money.message);
  const transactionDate = serializeZonedDateTime(form.date, timezone);
  const base = {
    clientId,
    amountMinor: money.amountMinor,
    transactionDate,
    ...(form.description.trim()
      ? { description: form.description.trim() }
      : {}),
  };
  if (type === "income") {
    if (!form.accountId) throw new Error("Choose an account.");
    const allocations = allocationRows(rows);
    if (
      allocations.reduce((sum, row) => sum + row.amountMinor, 0) >
      money.amountMinor
    )
      throw new Error("Income allocations cannot exceed income.");
    return {
      ...base,
      type,
      accountId: form.accountId,
      ...(form.sourceId ? { incomeSourceId: form.sourceId } : {}),
      ...(allocations.length ? { allocations } : {}),
    };
  }
  if (type === "expense") {
    if (!form.accountId || !form.categoryId)
      throw new Error("Choose an account and category.");
    const bucketSplits = allocationRows(rows);
    if (
      bucketSplits.reduce((sum, row) => sum + row.amountMinor, 0) !==
      money.amountMinor
    )
      throw new Error("Expense bucket splits must equal the expense.");
    return {
      ...base,
      type,
      accountId: form.accountId,
      categoryId: form.categoryId,
      bucketSplits,
    };
  }
  if (!form.fromId || !form.toId || form.fromId === form.toId)
    throw new Error(
      `Choose two different ${type === "transfer" ? "accounts" : "buckets"}.`,
    );
  return type === "transfer"
    ? { ...base, type, fromAccountId: form.fromId, toAccountId: form.toId }
    : { ...base, type, fromBucketId: form.fromId, toBucketId: form.toId };
}
function Pair({
  label,
  items,
  form,
  setForm,
}: {
  label: string;
  items: Array<{ _id: string; name: string }>;
  form: Form;
  setForm(value: Form): void;
}) {
  return (
    <div className="form-grid">
      <Field label={`From ${label}`}>
        <select
          value={form.fromId}
          onChange={(event) => setForm({ ...form, fromId: event.target.value })}
        >
          <option value="">Choose {label}</option>
          {items.map(option)}
        </select>
      </Field>
      <Field label={`To ${label}`}>
        <select
          value={form.toId}
          onChange={(event) => setForm({ ...form, toId: event.target.value })}
        >
          <option value="">Choose {label}</option>
          {items.map(option)}
        </select>
      </Field>
    </div>
  );
}
function option(item: { _id: string; name: string }) {
  return (
    <option value={item._id} key={item._id}>
      {item.name}
    </option>
  );
}
function title(type: string) {
  return type === "reallocation" ? "reallocation" : type;
}
function nameOf(items: Array<{ _id: string; name: string }>, id: string) {
  return items.find((item) => item._id === id)?.name || "Unavailable";
}
function activityContext(
  activity: BackfillActivity,
  resources: BackfillResources,
) {
  if (activity.type === "transfer")
    return `${nameOf(resources.accounts, activity.fromAccountId)} → ${nameOf(resources.accounts, activity.toAccountId)}`;
  if (activity.type === "reallocation")
    return `${nameOf(resources.buckets, activity.fromBucketId)} → ${nameOf(resources.buckets, activity.toBucketId)}`;
  return nameOf(resources.accounts, activity.accountId);
}
function ActivityIcon({ type }: { type: BackfillActivity["type"] }) {
  const Icon =
    type === "income"
      ? CircleDollarSign
      : type === "expense"
        ? ReceiptText
        : type === "transfer"
          ? ArrowLeftRight
          : FolderInput;
  return (
    <span className={`activity-icon ${type}`}>
      <Icon />
    </span>
  );
}
function toLocalInput(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function useUnsavedWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
