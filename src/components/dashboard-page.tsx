"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleDollarSign, Plus } from "lucide-react";
import { financeApi, queryKeys } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { AccountCard, BucketCard, TransactionRow } from "@/components/financial";
import { ActionLink, EmptyState, ErrorState, LoadingBlock, MoneyAmount, PageHeader } from "@/components/ui-kit";
import { useAuth } from "@/components/providers";

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: financeApi.dashboard });
  if (query.isLoading) return <><PageHeader eyebrow="Overview" title="Your money, with purpose" /><LoadingBlock rows={5} /></>;
  if (query.error) return <ErrorState error={errorMessage(query.error)} retry={() => void query.refetch()} />;
  const data = query.data!;
  return (
    <>
      <PageHeader
        eyebrow={data.period ? `This month · ${data.period.timezone}` : "Overview"}
        title={`Good day, ${user?.name.split(" ")[0] || "there"}.`}
        description="See where your money lives, what it is for, and what needs your attention."
        action={<ActionLink href="/add?flow=income">Add income<Plus /></ActionLink>}
      />
      <section className="hero-balance" aria-labelledby="total-money">
        <div><p id="total-money">Total financial position</p><MoneyAmount value={data.totalFinancialPositionMinor} /><span>Only accounts marked “Include in financial position” contribute here. Excluded accounts keep their full balances.</span></div>
        <div className="balance-support"><Metric label="Total physical money" value={data.totalPhysicalAccountBalanceMinor ?? data.totalAccountBalanceMinor ?? 0} /><Metric label="Assigned to purposes" value={data.totalBucketBalanceMinor ?? data.availableBucketBalanceMinor ?? 0} /><Metric label="Still unallocated" value={data.unallocatedAmountMinor} accent={data.unallocatedAmountMinor > 0} /></div>
      </section>
      <section className="month-strip" aria-label="Current month summary">
        <Metric label="Money in" value={data.currentMonth.incomeMinor} tone="positive" />
        <Metric label="Spent" value={data.currentMonth.expensesMinor} tone="negative" />
        <Metric label="Net cash flow" value={data.currentMonth.netCashFlowMinor} />
        <Metric label="Saved + invested" value={(data.currentMonth.savedAllocationMinor || 0) + (data.currentMonth.investmentAllocationMinor || 0)} />
      </section>
      {data.spendingTargetProgress && <SpendingProgress progress={data.spendingTargetProgress} />}
      <div className="dashboard-columns">
        <section className="dashboard-section">
          <SectionHeading title="Purpose buckets" description="What your available money is for." href="/buckets" />
          {data.buckets.length ? <div className="resource-grid">{data.buckets.slice(0, 4).map((bucket) => <BucketCard bucket={bucket} key={bucket._id} />)}</div> : <EmptyState title="Give your money a purpose" description="Create the purposes you want your money assigned to." action={{ href: "/buckets", label: "Create a bucket" }} />}
        </section>
        <section className="dashboard-section">
          <SectionHeading title="Accounts" description="Where your physical money currently lives." href="/accounts" />
          {data.accounts.length ? <div className="resource-grid">{data.accounts.slice(0, 4).map((account) => <AccountCard account={account} key={account._id} />)}</div> : <EmptyState title="No accounts yet" description="Add where your money currently lives." action={{ href: "/accounts", label: "Add an account" }} />}
        </section>
      </div>
      <section className="dashboard-section recent-section">
        <SectionHeading title="Recent activity" description="Income, expenses, transfers, and purpose changes - each shown once." href="/transactions" />
        {data.recentFinancialEvents?.length ? <div className="activity-list">{data.recentFinancialEvents.slice(0, 8).map((event, index) => <TransactionRow event={event} key={event._id || `event-${index}`} />)}</div> : <EmptyState title="No financial activity yet" description="Your financial activity will appear here." action={{ href: "/add", label: "Add your first activity" }} icon={CircleDollarSign} />}
      </section>
    </>
  );
}

function Metric({ label, value, accent = false, tone }: { label: string; value: number; accent?: boolean; tone?: "positive" | "negative" }) {
  return <div className={`metric ${accent ? "metric-accent" : ""} ${tone || ""}`}><span>{label}</span><MoneyAmount value={value} /></div>;
}
function SectionHeading({ title, description, href }: { title: string; description: string; href: string }) {
  return <header className="section-heading"><div><h2>{title}</h2><p>{description}</p></div><Link href={href}>View all<ArrowRight /></Link></header>;
}
function SpendingProgress({ progress }: { progress: NonNullable<import("@/lib/api/types").DashboardData["spendingTargetProgress"]> }) {
  const ideal = progress.idealSpendMinor || 0; const maximum = progress.maximumSpendMinor || Math.max(ideal, 1); const spent = progress.spentMinor || 0;
  const percent = Math.min(100, Math.round((spent / maximum) * 100));
  const message = spent <= ideal ? `${formatMoney(Math.max(0, ideal - spent))} left before your ideal` : spent <= maximum ? `${formatMoney(maximum - spent)} left before your maximum` : `${formatMoney(spent - maximum)} above your preferred maximum`;
  return <section className="spending-progress"><header><div><p className="eyebrow">Monthly spending boundary</p><h2>{message}</h2></div><span>{percent}% of maximum</span></header><div className="progress-track"><span style={{ width: `${percent}%` }} /><i style={{ left: `${Math.min(100, (ideal / maximum) * 100)}%` }} /></div><footer><span>Spent <b>{formatMoney(spent)}</b></span><span>Ideal <b>{formatMoney(ideal)}</b></span><span>Maximum <b>{formatMoney(maximum)}</b></span></footer></section>;
}
