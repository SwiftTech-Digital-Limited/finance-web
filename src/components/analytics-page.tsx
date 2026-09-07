"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { BarChart3 } from "lucide-react";
import { financeApi, queryKeys } from "@/lib/api";
import type { ChartDatum } from "@/lib/api/types";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
} from "@/components/ui-kit";

const CategoryChart = dynamic(
  () => import("./analytics-charts").then((module) => module.CategoryChart),
  { ssr: false, loading: () => <div className="chart-loading" /> },
);
const MonthlyChart = dynamic(
  () => import("./analytics-charts").then((module) => module.MonthlyChart),
  { ssr: false, loading: () => <div className="chart-loading" /> },
);
const PurposeChart = dynamic(
  () => import("./analytics-charts").then((module) => module.PurposeChart),
  { ssr: false, loading: () => <div className="chart-loading" /> },
);

export function AnalyticsPage() {
  const [dateFrom, setDateFrom] = useState(
    format(subMonths(new Date(), 5), "yyyy-MM-01"),
  );
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const params = { dateFrom, dateTo };
  const paths = [
    "monthly-summary",
    "spending-by-category",
    "spending-by-bucket",
    "income-by-source",
    "allocation-by-bucket",
  ] as const;
  const results = useQueries({
    queries: paths.map((path) => ({
      queryKey: queryKeys.analytics(path, params),
      queryFn: () => financeApi.analytics(path, params),
    })),
  });
  const loading = results.some((result) => result.isLoading);
  const loadError = results.find((result) => result.error)?.error;
  const [monthly, categories, buckets, sources, allocations] = results.map(
    (result) => result.data || [],
  ) as ChartDatum[][];
  const hasData = results.some((result) => result.data?.length);
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Patterns from posted activity. Transfers never count as income or spending, and charts always have an accessible table."
      />
      <div className="analytics-controls">
        <label>
          <span>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
      </div>
      {loading ? (
        <LoadingBlock rows={5} />
      ) : loadError ? (
        <ErrorState error={errorMessage(loadError)} />
      ) : !hasData ? (
        <EmptyState
          title="Your patterns will appear here"
          description="Add some activity and your patterns will start appearing here."
          action={{ href: "/add", label: "Add activity" }}
          icon={BarChart3}
        />
      ) : (
        <div className="analytics-grid">
          <InsightCard
            title="Cash flow over time"
            summary={monthlySummary(monthly)}
            wide
          >
            <MonthlyChart data={monthly} />
            <DataTable data={monthly} />
          </InsightCard>
          <InsightCard
            title="Spending by category"
            summary={topSummary(categories, "spending")}
          >
            <CategoryChart data={categories} />
            <DataTable data={categories} />
          </InsightCard>
          <InsightCard
            title="Allocation by purpose"
            summary={topSummary(allocations, "assigned money")}
          >
            <PurposeChart data={allocations} />
            <DataTable data={allocations} />
          </InsightCard>
          <InsightCard
            title="Income sources"
            summary={topSummary(sources, "income")}
          >
            <DataBars data={sources} />
            <DataTable data={sources} />
          </InsightCard>
          <InsightCard
            title="Spending by bucket"
            summary={topSummary(buckets, "spending")}
          >
            <DataBars data={buckets} />
            <DataTable data={buckets} />
          </InsightCard>
        </div>
      )}
    </>
  );
}
function InsightCard({
  title,
  summary,
  children,
  wide = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? "insight-card insight-wide" : "insight-card"}>
      <header>
        <h2>{title}</h2>
        <p>{summary}</p>
      </header>
      {children}
    </section>
  );
}
function topSummary(data: ChartDatum[], subject: string) {
  if (!data.length) return `No ${subject} in this period.`;
  const top = [...data].sort(
    (a, b) => (b.amountMinor || 0) - (a.amountMinor || 0),
  )[0];
  return `${top.label || "Top item"} leads ${subject} at ${formatMoney(top.amountMinor || 0)}.`;
}
function monthlySummary(data: ChartDatum[]) {
  const income = data.reduce((sum, item) => sum + (item.incomeMinor || 0), 0);
  const expenses = data.reduce(
    (sum, item) => sum + (item.expensesMinor || 0),
    0,
  );
  return `${formatMoney(income)} income and ${formatMoney(expenses)} spending across the selected period.`;
}
function DataTable({ data }: { data: ChartDatum[] }) {
  return (
    <details className="data-table">
      <summary>View accessible data</summary>
      <div role="table">
        <div role="row">
          <b role="columnheader">Label</b>
          <b role="columnheader">Amount</b>
          <b role="columnheader">Count</b>
        </div>
        {data.map((item, index) => (
          <div role="row" key={item.id || item.month || index}>
            <span role="cell">
              {item.label || item.month || `Period ${index + 1}`}
            </span>
            <span role="cell">
              {formatMoney(
                item.amountMinor ??
                  item.netCashFlowMinor ??
                  item.incomeMinor ??
                  0,
              )}
            </span>
            <span role="cell">{item.count ?? "-"}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
function DataBars({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((item) => item.amountMinor || 0), 1);
  return (
    <div className="data-bars">
      {data.slice(0, 6).map((item, index) => (
        <div key={item.id || index}>
          <span>{item.label}</span>
          <i>
            <b style={{ width: `${((item.amountMinor || 0) / max) * 100}%` }} />
          </i>
          <strong>{formatMoney(item.amountMinor || 0)}</strong>
        </div>
      ))}
    </div>
  );
}
