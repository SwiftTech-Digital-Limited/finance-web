"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { financeApi, queryKeys } from "@/lib/api";
import type { FinancialEvent } from "@/lib/api/types";
import { errorMessage } from "@/lib/errors";
import { parseMoneyInput } from "@/lib/money";
import { TransactionRow } from "@/components/financial";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
} from "@/components/ui-kit";

const commonTypes = [
  { value: "", label: "All activity" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "transfer", label: "Transfers" },
  { value: "reallocation", label: "Purpose changes" },
];

export function TransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [advanced, setAdvanced] = useState(false);
  const params = useMemo(
    () => ({
      type: searchParams.get("type") || undefined,
      search: searchParams.get("search") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      minAmountMinor: moneyParam(searchParams.get("minAmount")),
      maxAmountMinor: moneyParam(searchParams.get("maxAmount")),
      sortBy: searchParams.get("sortBy") || "transactionDate",
      sortOrder: searchParams.get("sortOrder") || "desc",
      page: Number(searchParams.get("page")) || 1,
      limit: 20,
    }),
    [searchParams],
  );
  const onlyReallocations = params.type === "reallocation";
  const transactionParams = {
    ...params,
    type: onlyReallocations ? undefined : params.type,
  };
  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.transactions(transactionParams),
        queryFn: () => financeApi.transactions(transactionParams),
        enabled: !onlyReallocations,
      },
      {
        queryKey: ["finance", "reallocations", params],
        queryFn: () =>
          financeApi.reallocations({
            page: params.page,
            limit: params.limit,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          }),
        enabled: !params.type || onlyReallocations,
      },
    ],
  });
  const update = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  };
  const events = useMemo<FinancialEvent[]>(() => {
    const transactions = results[0].data?.items || [];
    const reallocations: FinancialEvent[] = (results[1].data?.items || []).map(
      (item) => ({
        _id: item._id,
        eventKind: "reallocation",
        amountMinor: item.amountMinor,
        createdAt: item.date || item.createdAt,
        reallocation: item,
      }),
    );
    return [...transactions, ...reallocations].sort(
      (a, b) =>
        new Date(b.transactionDate || b.createdAt || 0).getTime() -
        new Date(a.transactionDate || a.createdAt || 0).getTime(),
    );
  }, [results]);
  const isLoading = results.some((result) => result.isLoading);
  const error = results.find((result) => result.error)?.error;
  const pages = Math.max(
    results[0].data?.pagination?.pages || 1,
    results[1].data?.pagination?.pages || 1,
  );
  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Activity"
        description="Income, spending, transfers, and bucket reallocations - with movement shown once and without changing its meaning."
      />
      <div className="transaction-filters">
        <label className="search-field">
          <Search />
          <span className="sr-only">Search activity</span>
          <input
            defaultValue={params.search}
            onBlur={(event) => update("search", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter")
                update("search", event.currentTarget.value);
            }}
            placeholder="Search descriptions"
          />
        </label>
        <button
          className="button-secondary"
          onClick={() => setAdvanced((value) => !value)}
          aria-expanded={advanced}
        >
          <SlidersHorizontal />
          Filters
        </button>
      </div>
      <div className="filter-chips" aria-label="Common filters">
        {commonTypes.map((item) => (
          <button
            className={(params.type || "") === item.value ? "active" : ""}
            onClick={() => update("type", item.value)}
            key={item.value}
          >
            {item.label}
          </button>
        ))}
      </div>
      {advanced && (
        <section className="advanced-filters">
          <label>
            <span>From date</span>
            <input
              type="date"
              value={params.dateFrom || ""}
              onChange={(event) => update("dateFrom", event.target.value)}
            />
          </label>
          <label>
            <span>To date</span>
            <input
              type="date"
              value={params.dateTo || ""}
              onChange={(event) => update("dateTo", event.target.value)}
            />
          </label>
          <label>
            <span>Minimum amount</span>
            <input
              inputMode="decimal"
              defaultValue={searchParams.get("minAmount") || ""}
              onBlur={(event) => update("minAmount", event.target.value)}
              placeholder="0.00"
            />
          </label>
          <label>
            <span>Maximum amount</span>
            <input
              inputMode="decimal"
              defaultValue={searchParams.get("maxAmount") || ""}
              onBlur={(event) => update("maxAmount", event.target.value)}
              placeholder="0.00"
            />
          </label>
          <label>
            <span>Order</span>
            <select
              value={params.sortOrder}
              onChange={(event) => update("sortOrder", event.target.value)}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
          <button onClick={() => router.replace(pathname)}>
            <Filter />
            Clear filters
          </button>
        </section>
      )}
      {isLoading ? (
        <LoadingBlock rows={7} />
      ) : error ? (
        <ErrorState error={errorMessage(error)} />
      ) : events.length ? (
        <div className="activity-list transaction-page-list">
          {events.map((event, index) => (
            <TransactionRow
              event={event}
              linked={event.eventKind !== "reallocation"}
              key={event._id || index}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No activity found"
          description="Your financial activity will appear here. Try changing the filters or add your first entry."
          action={{ href: "/add", label: "Add activity" }}
        />
      )}
      {pages > 1 && (
        <div className="pagination">
          <button
            disabled={params.page <= 1}
            onClick={() => update("page", String(params.page - 1))}
          >
            Previous
          </button>
          <span>
            Page {params.page} of {pages}
          </span>
          <button
            disabled={params.page >= pages}
            onClick={() => update("page", String(params.page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

function moneyParam(value: string | null) {
  if (!value) return undefined;
  const parsed = parseMoneyInput(value, true);
  return parsed.ok ? parsed.amountMinor : undefined;
}
