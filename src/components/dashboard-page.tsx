"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleDollarSign, Plus } from "lucide-react";
import { financeApi, queryKeys } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import {
  AccountCard,
  BucketCard,
  TransactionRow,
} from "@/components/financial";
import {
  ActionLink,
  EmptyState,
  ErrorState,
  LoadingBlock,
  MoneyAmount,
  PageHeader,
} from "@/components/ui-kit";
import { useAuth } from "@/components/providers";

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: financeApi.dashboard,
  });
  const dashboardData = query.data;
  const monthlySetting = useQuery({
    queryKey: ["finance", "monthly-setting", dashboardData?.currentMonth.year, dashboardData?.currentMonth.month],
    queryFn: () => financeApi.monthlySetting(dashboardData!.currentMonth.year, dashboardData!.currentMonth.month),
    enabled: Boolean(dashboardData?.currentMonth),
    retry: false,
  });
  if (query.isLoading || (query.data && monthlySetting.isLoading))
    return (
      <>
        <PageHeader eyebrow="Overview" title="Your money, with purpose" />
        <LoadingBlock rows={5} />
      </>
    );
  if (query.error)
    return (
      <ErrorState
        error={errorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data!;
  return (
    <>
      <PageHeader
        eyebrow={
          data.period ? `This month · ${data.period.timezone}` : "Overview"
        }
        title={`Good day, ${user?.name.split(" ")[0] || "there"}.`}
        description="See where your money lives, what it is for, and what needs your attention."
        action={
          <ActionLink href="/add?flow=income">
            Add income
            <Plus />
          </ActionLink>
        }
      />
      <section className="hero-balance" aria-labelledby="total-money">
        <div>
          <p id="total-money">Total financial position</p>
          <MoneyAmount value={data.totalFinancialPositionMinor} />
          <span>
            Only accounts marked “Include in financial position” contribute
            here. Excluded accounts keep their full balances.
          </span>
        </div>
        <div className="balance-support">
          <Metric
            label="Total physical money"
            value={
              data.totalPhysicalAccountBalanceMinor ??
              data.totalAccountBalanceMinor ??
              0
            }
          />
          <Metric
            label="Assigned to purposes"
            value={
              data.totalBucketBalanceMinor ??
              data.availableBucketBalanceMinor ??
              0
            }
          />
          <Metric
            label="Still unallocated"
            value={data.unallocatedAmountMinor}
            accent={data.unallocatedAmountMinor > 0}
          />
        </div>
      </section>
      <section className="month-strip" aria-label="Current month summary">
        <Metric
          label="Money in"
          value={data.currentMonth.incomeMinor}
          tone="positive"
        />
        <Metric
          label="Spent"
          value={data.currentMonth.expensesMinor}
          tone="negative"
        />
        <Metric
          label="Net cash flow"
          value={data.currentMonth.netCashFlowMinor}
        />
        <Metric
          label="Saved + invested"
          value={
            (data.currentMonth.savedAllocationMinor || 0) +
            (data.currentMonth.investmentAllocationMinor || 0)
          }
        />
      </section>
      <SpendingProgress progress={data.spendingTargetProgress} setting={monthlySetting.data} loading={monthlySetting.isLoading} />
      <div className="dashboard-columns">
        <section className="dashboard-section">
          <SectionHeading
            title="Purpose buckets"
            description="What your available money is for."
            href="/buckets"
          />
          {data.buckets.length ? (
            <div className="resource-grid">
              {data.buckets.slice(0, 4).map((bucket) => (
                <BucketCard bucket={bucket} key={bucket._id} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Give your money a purpose"
              description="Create the purposes you want your money assigned to."
              action={{ href: "/buckets", label: "Create a bucket" }}
            />
          )}
        </section>
        <section className="dashboard-section">
          <SectionHeading
            title="Accounts"
            description="Where your physical money currently lives."
            href="/accounts"
          />
          {data.accounts.length ? (
            <div className="resource-grid">
              {data.accounts.slice(0, 4).map((account) => (
                <AccountCard account={account} key={account._id} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No accounts yet"
              description="Add where your money currently lives."
              action={{ href: "/accounts", label: "Add an account" }}
            />
          )}
        </section>
      </div>
      <section className="dashboard-section recent-section">
        <SectionHeading
          title="Recent activity"
          description="Income, expenses, transfers, and purpose changes - each shown once."
          href="/transactions"
        />
        {data.recentFinancialEvents?.length ? (
          <div className="activity-list">
            {data.recentFinancialEvents.slice(0, 8).map((event, index) => (
              <TransactionRow
                event={event}
                key={event._id || `event-${index}`}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No financial activity yet"
            description="Your financial activity will appear here."
            action={{ href: "/add", label: "Add your first activity" }}
            icon={CircleDollarSign}
          />
        )}
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  accent = false,
  tone,
}: {
  label: string;
  value: number;
  accent?: boolean;
  tone?: "positive" | "negative";
}) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""} ${tone || ""}`}>
      <span>{label}</span>
      <MoneyAmount value={value} />
    </div>
  );
}
function SectionHeading({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <header className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Link href={href}>
        View all
        <ArrowRight />
      </Link>
    </header>
  );
}
function SpendingProgress({
  progress,
  setting,
  loading,
}: {
  progress: import("@/lib/api/types").DashboardData["spendingTargetProgress"];
  setting?: { idealSpendMinor: number; maximumSpendMinor: number };
  loading: boolean;
}) {
  if (loading) return <section className="spending-progress spending-progress-loading"><div className="spending-skeleton" /></section>;
  if (!progress || !setting) return (
    <section className="spending-progress spending-progress-empty">
      <div><p className="eyebrow">Monthly spending boundary</p><h2>Set monthly spending targets</h2><p>Choose an ideal and maximum spend so this dashboard can show your boundary.</p></div>
      <Link className="button-secondary" href="/monthly-spending">Set targets</Link>
    </section>
  );
  const spent = progress.spentThisMonthMinor ?? 0;
  const ideal = setting.idealSpendMinor;
  const maximum = setting.maximumSpendMinor;
  const percent = maximum > 0 ? Math.min((spent / maximum) * 100, 100) : 0;
  const status = progress.status;
  const message = status === "above_max" ? `${formatMoney(progress.amountAboveMaximumMinor ?? 0)} above your maximum` : status === "between_ideal_and_max" ? `${formatMoney(progress.amountAboveIdealMinor ?? 0)} above your ideal` : `${formatMoney(progress.remainingToIdealMinor ?? 0)} left before your ideal`;
  return (
    <section className={`spending-progress ${status === "above_max" ? "spending-alert" : ""}`}>
      <header><div><p className="eyebrow">Monthly spending boundary</p><h2>{message}</h2></div><span>{Math.round(percent)}% of maximum</span></header>
      <div className="progress-track"><span style={{ width: `${percent}%` }} /><i style={{ left: `${maximum > 0 ? Math.min((ideal / maximum) * 100, 100) : 0}%` }} /></div>
      <footer><span>Spent <b>{formatMoney(spent)}</b></span><span>Ideal <b>{formatMoney(ideal)}</b></span><span>Maximum <b>{formatMoney(maximum)}</b></span></footer>
    </section>
  );
}