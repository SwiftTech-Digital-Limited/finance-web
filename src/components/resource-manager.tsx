"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Archive, Edit3, Plus, Search } from "lucide-react";
import {
  archiveResource,
  createResource,
  listResource,
  queryKeys,
  updateResource,
} from "@/lib/api";
import type { Account, Bucket, Category, IncomeSource } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors";
import { parseMoneyInput } from "@/lib/money";
import { AccountCard, BucketCard, refName } from "@/components/financial";
import {
  ArchivedBadge,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  SubmitButton,
} from "@/components/ui-kit";

type Kind = "accounts" | "buckets" | "categories" | "income-sources";
type Resource = Account | Bucket | Category | IncomeSource;
type FormValues = {
  name: string;
  description: string;
  type: string;
  openingBalance: string;
  currency: string;
  institutionName: string;
  icon: string;
  includeInNetWorth: boolean;
  displayOrder: string;
  defaultAccountId: string;
};

const schema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  description: z.string(),
  type: z.string(),
  openingBalance: z.string(),
  currency: z.string(),
  institutionName: z.string(),
  icon: z.string(),
  includeInNetWorth: z.boolean(),
  displayOrder: z.string(),
  defaultAccountId: z.string(),
});

const copy: Record<
  Kind,
  {
    title: string;
    eyebrow: string;
    description: string;
    empty: string;
    action: string;
    singular: string;
  }
> = {
  accounts: {
    title: "Accounts",
    eyebrow: "Where money lives",
    description:
      "Track each physical place your money is held. Transfers move money between these locations without becoming spending.",
    empty: "Add where your money currently lives.",
    action: "Add account",
    singular: "account",
  },
  buckets: {
    title: "Buckets",
    eyebrow: "What money is for",
    description:
      "Give available money a purpose without changing the account where it lives.",
    empty: "Create the purposes you want your money assigned to.",
    action: "Create bucket",
    singular: "bucket",
  },
  categories: {
    title: "Categories",
    eyebrow: "Settings",
    description:
      "Use categories to describe what expenses were for. Historical labels stay intact after archiving.",
    empty: "Create categories for the spending details you care about.",
    action: "Add category",
    singular: "category",
  },
  "income-sources": {
    title: "Income sources",
    eyebrow: "Planning",
    description:
      "Describe the ways money usually arrives so each source can follow the right allocation rule.",
    empty: "Add the ways money usually comes in.",
    action: "Add income source",
    singular: "income source",
  },
};

const defaults: FormValues = {
  name: "",
  description: "",
  type: "",
  openingBalance: "0",
  currency: "NGN",
  institutionName: "",
  icon: "",
  includeInNetWorth: true,
  displayOrder: "0",
  defaultAccountId: "",
};

export function ResourceManager({ kind }: { kind: Kind }) {
  const config = copy[kind];
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<Resource | null | "new">(null);
  const [archiving, setArchiving] = useState<Resource | null>(null);
  const params = useMemo(
    () => ({
      page,
      limit: 20,
      search: search || undefined,
      includeArchived: includeArchived || undefined,
    }),
    [page, search, includeArchived],
  );
  const query = useQuery({
    queryKey: queryKeys.resource(kind, params),
    queryFn: () => listResource(kind, params),
  });
  const accountsQuery = useQuery({
    queryKey: queryKeys.resource("accounts", {
      limit: 100,
      includeArchived: true,
    }),
    queryFn: () =>
      listResource("accounts", { limit: 100, includeArchived: true }),
    enabled: kind === "income-sources",
  });
  const mutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: unknown }) =>
      id ? updateResource(kind, id, payload) : createResource(kind, payload),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["finance", kind] });
      if (kind === "accounts") {
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      }
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveResource(kind, id),
    onSuccess: async () => {
      setArchiving(null);
      await queryClient.invalidateQueries({ queryKey: ["finance", kind] });
    },
  });

  const items = query.data?.items || [];
  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        action={
          <button className="button-primary" onClick={() => setEditing("new")}>
            <Plus />
            {config.action}
          </button>
        }
      />
      <div className="list-toolbar">
        <label className="search-field">
          <Search />
          <span className="sr-only">Search {config.title}</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={`Search ${config.title.toLowerCase()}`}
          />
        </label>
        <label className="archive-toggle">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Include archived
        </label>
      </div>
      {query.isLoading ? (
        <LoadingBlock rows={5} />
      ) : query.error ? (
        <ErrorState
          error={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : !items.length ? (
        <EmptyState
          title={`No ${config.title.toLowerCase()} yet`}
          description={config.empty}
          action={{ label: config.action, onClick: () => setEditing("new") }}
        />
      ) : kind === "accounts" ? (
        <div className="resource-list-grid">
          {(items as Account[]).map((item) => (
            <div className="resource-card-wrap" key={item._id}>
              <AccountCard account={item} />
              <CardActions
                edit={() => setEditing(item)}
                archive={() => setArchiving(item)}
              />
            </div>
          ))}
        </div>
      ) : kind === "buckets" ? (
        <div className="resource-list-grid">
          {(items as Bucket[]).map((item) => (
            <div className="resource-card-wrap" key={item._id}>
              <BucketCard bucket={item} />
              <CardActions
                edit={() => setEditing(item)}
                archive={() => setArchiving(item)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="settings-list">
          {items.map((item) => (
            <div className="settings-row" key={item._id}>
              <div className="settings-symbol">
                {item.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2>
                  {item.name} {item.isArchived && <ArchivedBadge />}
                </h2>
                <p>
                  {item.description ||
                    (kind === "income-sources"
                      ? `Default account: ${incomeSourceDefaultAccountName(item as IncomeSource, accountsQuery.data?.items || [])}`
                      : "No description")}
                </p>
              </div>
              <CardActions
                edit={() => setEditing(item)}
                archive={() => setArchiving(item)}
              />
            </div>
          ))}
        </div>
      )}
      {query.data?.pagination && query.data.pagination.pages > 1 && (
        <div className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {query.data.pagination.pages}
          </span>
          <button
            disabled={page >= query.data.pagination.pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
      <ResourceForm
        key={editing === "new" ? "new" : editing?._id || "closed"}
        kind={kind}
        resource={editing}
        accounts={accountsQuery.data?.items || []}
        busy={mutation.isPending}
        error={mutation.error}
        onClose={() => setEditing(null)}
        onSave={(id, payload) => mutation.mutate({ id, payload })}
      />
      <Modal
        open={Boolean(archiving)}
        title={`Archive this ${config.singular}?`}
        description="It remains in history and balances, but cannot be used for new financial activity."
        onClose={() => setArchiving(null)}
      >
        <div className="confirm-actions">
          <button
            className="button-secondary"
            onClick={() => setArchiving(null)}
          >
            Keep active
          </button>
          <button
            className="button-danger"
            disabled={archiveMutation.isPending}
            onClick={() => archiving && archiveMutation.mutate(archiving._id)}
          >
            Archive {config.singular}
          </button>
        </div>
        {archiveMutation.error && (
          <p className="form-error-box">
            {errorMessage(archiveMutation.error)}
          </p>
        )}
      </Modal>
    </>
  );
}

export function incomeSourceDefaultAccountName(
  source: IncomeSource,
  accounts: Account[],
) {
  const reference = source.defaultAccountId;
  if (!reference) return "None";
  if (typeof reference !== "string")
    return refName(reference, "Unavailable account");
  return (
    accounts.find((account) => account._id === reference)?.name ||
    "Unavailable account"
  );
}

function CardActions({
  edit,
  archive,
}: {
  edit: () => void;
  archive: () => void;
}) {
  return (
    <div className="card-actions">
      <button onClick={edit} aria-label="Edit">
        <Edit3 />
      </button>
      <button onClick={archive} aria-label="Archive">
        <Archive />
      </button>
    </div>
  );
}

function ResourceForm({
  kind,
  resource,
  accounts,
  busy,
  error,
  onClose,
  onSave,
}: {
  kind: Kind;
  resource: Resource | null | "new";
  accounts: Account[];
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (id: string | undefined, payload: unknown) => void;
}) {
  const editing = resource && resource !== "new" ? resource : null;
  const values: FormValues = editing
    ? {
        ...defaults,
        name: editing.name,
        description: editing.description || "",
        icon:
          "icon" in editing && typeof editing.icon === "string"
            ? editing.icon
            : "",
        type:
          "type" in editing && typeof editing.type === "string"
            ? editing.type
            : "",
        institutionName:
          "institutionName" in editing &&
          typeof editing.institutionName === "string"
            ? editing.institutionName
            : "",
        currency:
          "currency" in editing && typeof editing.currency === "string"
            ? editing.currency
            : "NGN",
        includeInNetWorth:
          "includeInNetWorth" in editing
            ? editing.includeInNetWorth !== false
            : true,
        displayOrder:
          "displayOrder" in editing ? String(editing.displayOrder || 0) : "0",
        defaultAccountId:
          "defaultAccountId" in editing
            ? typeof editing.defaultAccountId === "string"
              ? editing.defaultAccountId
              : editing.defaultAccountId?._id || ""
            : "",
      }
    : defaults;
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values });
  const submit = form.handleSubmit((data) => {
    let payload: Record<string, unknown> = {
      name: data.name.trim(),
      description: data.description.trim(),
      icon: data.icon.trim() || undefined,
    };
    if (kind === "accounts") {
      const money = parseMoneyInput(data.openingBalance, true);
      if (!money.ok) {
        form.setError("openingBalance", { message: money.message });
        return;
      }
      payload = {
        ...payload,
        type: data.type || "bank",
        openingBalanceMinor: money.amountMinor,
        currency: data.currency || "NGN",
        institutionName: data.institutionName.trim(),
        includeInNetWorth: data.includeInNetWorth,
      };
      if (editing) delete payload.openingBalanceMinor;
    }
    if (kind === "buckets")
      payload = {
        ...payload,
        type: data.type || "custom",
        displayOrder: Number(data.displayOrder) || 0,
      };
    if (kind === "income-sources")
      payload = {
        ...payload,
        defaultAccountId: optionalDefaultAccountId(data.defaultAccountId),
      };
    onSave(editing?._id, payload);
  });
  return (
    <Modal
      open={Boolean(resource)}
      title={editing ? `Edit ${editing.name}` : copy[kind].action}
      description={
        kind === "accounts"
          ? "An opening balance creates physical, initially unallocated money."
          : kind === "buckets"
            ? "Names are yours; the optional type supports accurate insights."
            : undefined
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field
          label="Name"
          error={
            form.formState.errors.name?.message ||
            validationFieldError(error, "name")
          }
        >
          <input autoFocus {...form.register("name")} />
        </Field>
        {kind === "accounts" && (
          <>
            <Field label="Account type">
              <select {...form.register("type")}>
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="wallet">Wallet</option>
                <option value="savings">Savings account</option>
                <option value="investment">Investment account</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Institution">
              <input {...form.register("institutionName")} />
            </Field>
            {!editing && (
              <Field
                label="Opening balance"
                hint="Naira"
                error={form.formState.errors.openingBalance?.message}
              >
                <input
                  inputMode="decimal"
                  {...form.register("openingBalance")}
                />
              </Field>
            )}
            <label className="check-field">
              <input type="checkbox" {...form.register("includeInNetWorth")} />
              <span>
                Include in financial position
                <small>
                  The account and its balance remain unchanged when excluded;
                  only the dashboard total changes.
                </small>
              </span>
            </label>
          </>
        )}
        {kind === "buckets" && (
          <>
            <Field label="Purpose type">
              <select {...form.register("type")}>
                <option value="spending">Spending</option>
                <option value="saving">Saving</option>
                <option value="investment">Investment</option>
                <option value="reserve">Reserve</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Display order">
              <input type="number" {...form.register("displayOrder")} />
            </Field>
          </>
        )}
        {kind === "income-sources" && (
          <Field
            label="Default receiving account"
            hint="Optional"
            error={validationFieldError(error, "defaultAccountId")}
          >
            <select {...form.register("defaultAccountId")}>
              <option value="">No default</option>
              {accounts.map((account) => (
                <option value={account._id} key={account._id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field
          label="Description"
          hint="Optional"
          error={validationFieldError(error, "description")}
        >
          <textarea rows={3} {...form.register("description")} />
        </Field>
        {Boolean(error) && (
          <p className="form-error-box" role="alert">
            {errorMessage(error)}
          </p>
        )}
        <SubmitButton busy={busy}>
          {editing ? "Save changes" : copy[kind].action}
        </SubmitButton>
      </form>
    </Modal>
  );
}

export function optionalDefaultAccountId(value: string) {
  return value || undefined;
}

export function validationFieldError(error: unknown, field: string) {
  if (!(error instanceof ApiError) || !Array.isArray(error.details))
    return undefined;
  const issue = error.details.find((detail) => {
    if (!detail || typeof detail !== "object" || !("path" in detail))
      return false;
    const path = (detail as { path?: unknown }).path;
    return Array.isArray(path)
      ? String(path.at(-1)) === field
      : String(path) === field;
  });
  return issue && typeof issue === "object" && "message" in issue
    ? String((issue as { message: unknown }).message)
    : undefined;
}
