"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleDot, Landmark, Plus, Search, Trash2 } from "lucide-react";
import { financeApi, getResource, listResource, queryKeys } from "@/lib/api";
import type { Account, Bucket } from "@/lib/api/types";
import { errorMessage } from "@/lib/errors";
import { createIdempotencyKey } from "@/lib/idempotency";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { TransactionRow } from "@/components/financial";
import {
  ArchivedBadge,
  ErrorState,
  LoadingBlock,
  Modal,
  MoneyAmount,
  PageHeader,
} from "@/components/ui-kit";

export function ResourceDetail({
  kind,
  id,
}: {
  kind: "accounts" | "buckets";
  id: string;
}) {
  const query = useQuery({
    queryKey: queryKeys.detail(kind, id),
    queryFn: () => getResource(kind, id),
  });
  if (query.isLoading)
    return (
      <>
        <PageHeader title={kind === "accounts" ? "Account" : "Bucket"} />
        <LoadingBlock rows={5} />
      </>
    );
  if (query.error || !query.data)
    return <ErrorState error={errorMessage(query.error)} />;
  return kind === "accounts" ? (
    <AccountDetail account={query.data as Account} />
  ) : (
    <BucketDetail bucket={query.data as Bucket} />
  );
}

function AccountDetail({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([{ bucketId: "", amount: "" }]);
  const key = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const buckets = useQuery({
    queryKey: queryKeys.resource("buckets", { limit: 100 }),
    queryFn: () => listResource("buckets", { limit: 100 }),
    enabled: open,
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const allocations = rows.map((row) => {
        const parsed = parseMoneyInput(row.amount);
        if (!row.bucketId || !parsed.ok)
          throw new Error("Complete every assignment.");
        return { bucketId: row.bucketId, amountMinor: parsed.amountMinor };
      });
      if (
        new Set(allocations.map((item) => item.bucketId)).size !==
        allocations.length
      )
        throw new Error("Choose each bucket only once.");
      return financeApi.assignOpening(
        account._id,
        allocations,
        key.current ?? (key.current = createIdempotencyKey()),
      );
    },
    onSuccess: async () => {
      setOpen(false);
      key.current = null;
      await queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
  return (
    <>
      <Link className="back-link" href="/accounts">
        <ArrowLeft />
        Back to accounts
      </Link>
      <PageHeader
        eyebrow={account.type}
        title={account.name}
        description={account.institutionName || "Physical money location"}
        action={
          account.openingBalanceMinor > 0 && !account.isArchived ? (
            <button className="button-primary" onClick={() => setOpen(true)}>
              Assign opening money
            </button>
          ) : undefined
        }
      />
      <section className="resource-hero account-hero">
        <span className="resource-hero-icon">
          <Landmark />
        </span>
        <div>
          <p>Current physical balance</p>
          <MoneyAmount
            value={account.currentBalanceMinor ?? account.openingBalanceMinor}
            currency={account.currency}
          />
          {account.isArchived && <ArchivedBadge />}
        </div>
        <dl>
          <div>
            <dt>Opening balance</dt>
            <dd>
              {formatMoney(account.openingBalanceMinor, account.currency)}
            </dd>
          </div>
          <div>
            <dt>Total inflows</dt>
            <dd>
              {formatMoney(account.totalInflowsMinor || 0, account.currency)}
            </dd>
          </div>
          <div>
            <dt>Total outflows</dt>
            <dd>
              {formatMoney(account.totalOutflowsMinor || 0, account.currency)}
            </dd>
          </div>
        </dl>
      </section>
      <section className="dashboard-section">
        <header className="section-heading">
          <div>
            <h2>Account activity</h2>
            <p>
              Income, expenses, and logical transfers affecting this physical
              location.
            </p>
          </div>
        </header>
        <AccountActivity key={account._id} accountId={account._id} />
      </section>
      <Modal
        open={open}
        title="Assign opening money"
        description="This assigns purpose to existing physical money. It does not create income or change the account balance."
        onClose={() => setOpen(false)}
      >
        {rows.map((row, index) => (
          <div className="assignment-row" key={index}>
            <select
              value={row.bucketId}
              onChange={(event) =>
                setRows((items) =>
                  items.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, bucketId: event.target.value }
                      : item,
                  ),
                )
              }
            >
              <option value="">Choose bucket</option>
              {buckets.data?.items.map((bucket) => (
                <option value={bucket._id} key={bucket._id}>
                  {bucket.name}
                </option>
              ))}
            </select>
            <input
              value={row.amount}
              inputMode="decimal"
              placeholder="Amount"
              onChange={(event) =>
                setRows((items) =>
                  items.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, amount: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <button
              disabled={rows.length === 1}
              onClick={() =>
                setRows((items) =>
                  items.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <Trash2 />
            </button>
          </div>
        ))}
        <button
          className="add-split"
          onClick={() =>
            setRows((items) => [...items, { bucketId: "", amount: "" }])
          }
        >
          <Plus />
          Add bucket
        </button>
        {mutation.error && (
          <p className="form-error-box">{errorMessage(mutation.error)}</p>
        )}
        <button
          className="button-primary submit-button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Assigning..." : "Assign opening money"}
        </button>
      </Modal>
    </>
  );
}

type ActivityFilterInputs = {
  search: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
};

const emptyActivityFilters: ActivityFilterInputs = {
  search: "",
  type: "",
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
};

export function AccountActivity({ accountId }: { accountId: string }) {
  const [page, setPage] = useState(1);
  const [inputs, setInputs] = useState<ActivityFilterInputs>(emptyActivityFilters);
  const [filters, setFilters] = useState<Record<string, string | number>>({});
  const [filterError, setFilterError] = useState("");
  const params = {
    accountId,
    page,
    limit: 20,
    sortBy: "transactionDate",
    sortOrder: "desc",
    ...filters,
  };
  const query = useQuery({
    queryKey: queryKeys.transactions(params),
    queryFn: () => financeApi.transactions(params),
  });
  const pagination = query.data?.pagination;
  const updateInput = (name: keyof ActivityFilterInputs, value: string) =>
    setInputs((current) => ({ ...current, [name]: value }));
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minimum = inputs.minAmount.trim()
      ? parseMoneyInput(inputs.minAmount, true)
      : null;
    const maximum = inputs.maxAmount.trim()
      ? parseMoneyInput(inputs.maxAmount, true)
      : null;
    if (minimum?.ok === false || maximum?.ok === false) {
      setFilterError("Enter valid amounts with no more than 2 decimal places.");
      return;
    }
    if (inputs.dateFrom && inputs.dateTo && inputs.dateFrom > inputs.dateTo) {
      setFilterError("From date must be before To date.");
      return;
    }
    if (minimum?.ok && maximum?.ok && minimum.amountMinor > maximum.amountMinor) {
      setFilterError("Minimum amount must be less than maximum amount.");
      return;
    }
    setFilterError("");
    setPage(1);
    setFilters({
      ...(inputs.search.trim() && { search: inputs.search.trim() }),
      ...(inputs.type && { type: inputs.type }),
      ...(inputs.dateFrom && { dateFrom: inputs.dateFrom }),
      ...(inputs.dateTo && { dateTo: inputs.dateTo }),
      ...(minimum?.ok && { minAmountMinor: minimum.amountMinor }),
      ...(maximum?.ok && { maxAmountMinor: maximum.amountMinor }),
    });
  };

  return (
    <>
      <form className="account-activity-filters" onSubmit={applyFilters}>
        <label className="account-activity-search">
          <span>Description</span>
          <span className="search-field">
            <Search aria-hidden="true" />
            <input
              value={inputs.search}
              onChange={(event) => updateInput("search", event.target.value)}
              placeholder="Search descriptions"
            />
          </span>
        </label>
        <label>
          <span>Type</span>
          <select value={inputs.type} onChange={(event) => updateInput("type", event.target.value)}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
            <option value="transfer">Transfers</option>
          </select>
        </label>
        <label>
          <span>From date</span>
          <input type="date" value={inputs.dateFrom} onChange={(event) => updateInput("dateFrom", event.target.value)} />
        </label>
        <label>
          <span>To date</span>
          <input type="date" value={inputs.dateTo} onChange={(event) => updateInput("dateTo", event.target.value)} />
        </label>
        <label>
          <span>Minimum amount</span>
          <input inputMode="decimal" value={inputs.minAmount} onChange={(event) => updateInput("minAmount", event.target.value)} placeholder="0.00" />
        </label>
        <label>
          <span>Maximum amount</span>
          <input inputMode="decimal" value={inputs.maxAmount} onChange={(event) => updateInput("maxAmount", event.target.value)} placeholder="0.00" />
        </label>
        <div className="account-activity-filter-actions">
          <button className="button-primary" type="submit">Apply filters</button>
          <button
            className="button-secondary"
            type="button"
            onClick={() => {
              setInputs(emptyActivityFilters);
              setFilters({});
              setPage(1);
              setFilterError("");
            }}
          >
            Clear
          </button>
        </div>
        {filterError && <p className="form-error-box" role="alert">{filterError}</p>}
      </form>
      {query.isPending ? (
        <LoadingBlock rows={5} />
      ) : query.isError ? (
        <div className="detail-card">
          <ErrorState error={errorMessage(query.error)} />
          <button className="button-secondary" onClick={() => query.refetch()}>
            Retry
          </button>
        </div>
      ) : query.data.items.length ? (
        <div className="activity-list">
          {query.data.items.map((transaction) => (
            <TransactionRow
              event={transaction}
              viewedAccountId={accountId}
              key={transaction._id}
            />
          ))}
        </div>
      ) : (
        <div className="detail-card">
          <p className="muted-copy">
            {Object.keys(filters).length
              ? "No account activity matches these filters."
              : "No account activity yet."}
          </p>
        </div>
      )}
      {!query.isError && pagination && pagination.pages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <button
            disabled={page >= pagination.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

function BucketDetail({ bucket }: { bucket: Bucket }) {
  const available =
    bucket.availableBalanceMinor ?? bucket.currentBalanceMinor ?? 0;
  return (
    <>
      <Link className="back-link" href="/buckets">
        <ArrowLeft />
        Back to buckets
      </Link>
      <PageHeader
        eyebrow={bucket.type || "Purpose"}
        title={bucket.name}
        description={bucket.description || "Money assigned to this purpose."}
      />
      <section className="resource-hero bucket-hero">
        <span className="resource-hero-icon">
          <CircleDot />
        </span>
        <div>
          <p>Available for this purpose</p>
          <MoneyAmount value={available} />
          {bucket.isArchived && <ArchivedBadge />}
        </div>
        <dl>
          <div>
            <dt>Allocated</dt>
            <dd>{formatMoney(bucket.allocatedMinor || 0)}</dd>
          </div>
          <div>
            <dt>Spent</dt>
            <dd>{formatMoney(bucket.spentMinor || 0)}</dd>
          </div>
          <div>
            <dt>Reallocated net</dt>
            <dd>
              {formatMoney(
                (bucket.reallocatedInMinor || 0) -
                  (bucket.reallocatedOutMinor || 0),
                "NGN",
                { sign: true },
              )}
            </dd>
          </div>
        </dl>
      </section>
      <section className="dashboard-section">
        <header className="section-heading">
          <div>
            <h2>Purpose activity</h2>
            <p>
              Assignments, spending, and reallocations affecting this bucket.
            </p>
          </div>
        </header>
        {bucket.activity?.length ? (
          <div className="activity-list">
            {bucket.activity.map((event, index) => (
              <TransactionRow event={event} key={event._id || index} />
            ))}
          </div>
        ) : (
          <div className="detail-card">
            <p className="muted-copy">No bucket activity yet.</p>
          </div>
        )}
      </section>
    </>
  );
}
