"use client";

import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import type {
  BackfillFinalizeResult,
  BackfillPreview,
  BackfillSession,
  BackfillTotals,
  BackfillActivity,
} from "@/lib/api/backfill-types";
import type { BackfillResources } from "./activity-editor";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { ErrorState, PageHeader } from "@/components/ui-kit";

export function ReconciliationSummary({
  preview,
  resources,
  onBack,
  onRefresh,
  refreshing,
  onContinue,
}: {
  preview: BackfillPreview;
  resources: BackfillResources;
  onBack(): void;
  onRefresh(): void;
  refreshing: boolean;
  onContinue(): void;
}) {
  return (
    <section className="backfill-panel">
      <header className="builder-heading">
        <div>
          <p className="eyebrow">Server-authoritative preview</p>
          <h2>
            {preview.readyToFinalize
              ? "The two dates reconcile."
              : "Reconciliation needs attention."}
          </h2>
        </div>
        <button
          className="button-secondary"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "Checking…" : "Refresh preview"}
        </button>
      </header>
      <div className="reconcile-dates">
        <TotalsCard
          title="Spreadsheet date"
          date={preview.snapshotDate}
          totals={preview.totalsAtSnapshot}
        />
        <TotalsCard
          title="Cutover date"
          date={preview.cutoverDate}
          totals={preview.totalsAtCutover}
        />
      </div>
      <h3>Accounts</h3>
      <div className="reconcile-list">
        {preview.accountResults.map((account) => (
          <div key={account.accountId}>
            <div>
              <b>
                {account.accountName ||
                  nameOf(resources.accounts, account.accountId)}
              </b>
              <small>
                Reconstructed snapshot + staged net activity = captured current
              </small>
            </div>
            <span>
              {formatMoney(account.snapshotBalanceMinor)}{" "}
              <i>
                {account.netChangeMinor >= 0 ? "+" : "−"}{" "}
                {formatMoney(Math.abs(account.netChangeMinor))}
              </i>{" "}
              = <b>{formatMoney(account.currentBalanceMinor)}</b>
            </span>
            <em
              className={account.matchesCapturedCurrent ? "match" : "mismatch"}
            >
              {account.matchesCapturedCurrent ? "Matches" : "Mismatch"}
            </em>
          </div>
        ))}
      </div>
      <h3>Buckets</h3>
      <div className="reconcile-list compact">
        {preview.bucketSnapshot.map((bucket) => {
          const result = preview.bucketResults.find(
            (item) => item.bucketId === bucket.bucketId,
          );
          return (
            <div key={bucket.bucketId}>
              <b>
                {bucketLabel(bucket.bucketId, resources.buckets, bucket.bucketName)}
              </b>
              <span>
                {formatMoney(bucket.amountMinor)} →{" "}
                {formatMoney(result?.balanceMinor || 0)}
              </span>
            </div>
          );
        })}
      </div>
      {preview.warnings.map((warning) => (
        <p className="neutral-callout" key={warning}>
          {warning}
        </p>
      ))}
      <BackfillTimeline preview={preview} resources={resources} />
      <WizardActions
        back={onBack}
        next={onContinue}
        disabled={!preview.readyToFinalize}
        label="Review finalization"
      />
    </section>
  );
}

export function BackfillTimeline({
  preview,
  resources,
}: {
  preview: BackfillPreview;
  resources: BackfillResources;
}) {
  return (
    <details className="backfill-timeline">
      <summary>Inspect running timeline ({preview.timeline.length})</summary>
      {preview.timeline.map((item) => (
        <article key={item.clientId}>
          <header>
            <b>{item.type}</b>
            <time>{new Date(item.transactionDate).toLocaleString()}</time>
          </header>
          <div>
            <span>Accounts</span>
            {Object.entries(item.accountBalances).map(([id, amount]) => (
              <small key={id}>
                {nameOf(resources.accounts, id)} <b>{formatMoney(amount)}</b>
              </small>
            ))}
          </div>
          <div>
            <span>Buckets</span>
            {Object.entries(item.bucketBalances).map(([id, amount]) => (
              <small key={id}>
                {nameOf(resources.buckets, id)} <b>{formatMoney(amount)}</b>
              </small>
            ))}
          </div>
        </article>
      ))}
    </details>
  );
}

export function BackfillFinalizeStep({
  preview,
  onBack,
  onConfirm,
}: {
  preview: BackfillPreview;
  onBack(): void;
  onConfirm(): void;
}) {
  return (
    <section className="backfill-panel">
      <FileSpreadsheet />
      <p className="eyebrow">One atomic commit</p>
      <h2>Ready to establish your spreadsheet starting history.</h2>
      <ul className="impact-list">
        <li>
          Account opening baselines become the reconstructed spreadsheet-date
          values.
        </li>
        <li>
          Bucket amounts become “Spreadsheet starting balance” allocations.
        </li>
        <li>
          {preview.activityCount} staged event
          {preview.activityCount === 1 ? "" : "s"} will be committed
          chronologically.
        </li>
        <li>Captured cutover account balances remain unchanged.</li>
      </ul>
      <WizardActions
        back={onBack}
        next={onConfirm}
        disabled={!preview.readyToFinalize}
        label="Finalize migration"
      />
    </section>
  );
}

export function BackfillAudit({
  session,
  result,
  resources,
}: {
  session?: BackfillSession;
  result?: BackfillFinalizeResult | null;
  resources: BackfillResources;
}) {
  const final = result || session?.result;
  const preview = session?.preview;
  if (!final)
    return (
      <ErrorState error="The completed migration result is unavailable." />
    );
  return (
    <>
      <PageHeader
        eyebrow="Completed migration"
        title="Spreadsheet import audit"
        description="Read-only evidence of the opening-baseline correction and created records."
        action={
          <div className="detail-actions">
            <Link className="button-primary" href="/dashboard">
              Dashboard
            </Link>
            <Link className="button-secondary" href="/transactions">
              Activity
            </Link>
          </div>
        }
      />
      <section className="backfill-panel">
        <div className="reconcile-dates">
          <TotalsCard
            title="Spreadsheet date"
            date={final.snapshotDate}
            totals={final.totalsAtSnapshot}
          />
          <TotalsCard
            title="Cutover date"
            date={final.cutoverDate}
            totals={final.totalsAtCutover}
          />
        </div>
        <h2>Account opening corrections</h2>
        <div className="reconcile-list">
          {session?.accountSnapshots.map((account) => (
            <div key={account.accountId}>
              <b>{nameOf(resources.accounts, account.accountId)}</b>
              <span>
                {formatMoney(account.originalOpeningBalanceMinor)} →{" "}
                <b>{formatMoney(account.calculatedOpeningBalanceMinor)}</b>
              </span>
            </div>
          ))}
        </div>
        <h2>Spreadsheet starting balances</h2>
        <p>
          These were committed as “Spreadsheet starting balance” allocations.
        </p>
        <div className="reconcile-list compact">
          {session?.bucketBalances.map((bucket) => (
            <div key={bucket.bucketId}>
              <b>{nameOf(resources.buckets, bucket.bucketId)}</b>
              <span>{formatMoney(bucket.amountMinor)}</span>
            </div>
          ))}
        </div>
        <dl className="audit-counts">
          <div>
            <dt>Transactions created</dt>
            <dd>{final.transactionIds.length}</dd>
          </div>
          <div>
            <dt>Allocations created</dt>
            <dd>{final.allocationIds.length}</dd>
          </div>
          <div>
            <dt>Reallocations created</dt>
            <dd>{final.reallocationIds.length}</dd>
          </div>
        </dl>
        {session?.notes && (
          <div className="neutral-callout">
            <b>Notes</b>
            <p>{session.notes}</p>
          </div>
        )}
        {preview && (
          <BackfillTimeline preview={preview} resources={resources} />
        )}
      </section>
    </>
  );
}

export function BackfillError({
  error,
  activities,
  resources,
}: {
  error: unknown;
  activities: BackfillActivity[];
  resources: BackfillResources;
}) {
  const api = error instanceof ApiError ? error : null;
  const details = api?.details as Record<string, unknown> | undefined;
  const clientId =
    typeof details?.clientId === "string" ? details.clientId : "";
  const activity = activities.find((item) => item.clientId === clientId);
  return (
    <div className="backfill-error" role="alert">
      <b>{errorMessage(error)}</b>
      {activity && (
        <p>
          At “{activity.description || activity.type}” on{" "}
          {new Date(activity.transactionDate).toLocaleString()} (
          {context(activity, resources)}).
        </p>
      )}
      {api?.code === "BACKFILL_EXISTING_ACTIVITY_CONFLICT" && details && (
        <p>
          Existing records: {String(details.transactions || 0)} transactions,{" "}
          {String(details.allocations || 0)} allocations,{" "}
          {String(details.reallocations || 0)} reallocations.
        </p>
      )}
      {api?.code === "BACKFILL_BUCKETS_EXCEED_ACCOUNTS" && details && (
        <p>
          Physical {formatMoney(Number(details.physicalAtSnapshotMinor || 0))};
          buckets {formatMoney(Number(details.bucketAtSnapshotMinor || 0))};
          shortfall {formatMoney(Number(details.shortfallMinor || 0))}.
        </p>
      )}
      {api?.code === "BACKFILL_STATE_CHANGED" &&
        Array.isArray(details?.accounts) &&
        (details.accounts as Array<Record<string, unknown>>).map((row) => (
          <p key={String(row.accountId)}>
            {nameOf(resources.accounts, String(row.accountId))}: captured{" "}
            {formatMoney(Number(row.capturedMinor))}, now{" "}
            {formatMoney(Number(row.currentMinor))}. Cancel and restart after
            reviewing this change.
          </p>
        ))}
    </div>
  );
}

export function TotalsCard({
  title,
  date,
  totals,
}: {
  title: string;
  date: string;
  totals: BackfillTotals;
}) {
  return (
    <article>
      <p className="eyebrow">{title}</p>
      <h3>{new Date(date).toLocaleString()}</h3>
      <Total label="Physical" value={totals.physicalAccountBalanceMinor} />
      <Total label="Assigned" value={totals.bucketBalanceMinor} />
      <Total label="Unallocated" value={totals.unallocatedAmountMinor} />
    </article>
  );
}
export function WizardActions({
  back,
  next,
  busy,
  disabled,
  label,
}: {
  back(): void;
  next(): void;
  busy?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="wizard-actions">
      <button className="button-secondary" onClick={back}>
        Back
      </button>
      <button
        className="button-primary"
        disabled={busy || disabled}
        onClick={next}
      >
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}
function Total({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <b>{formatMoney(value)}</b>
    </div>
  );
}
function bucketLabel(id: string, buckets: Array<{ _id: string; name: string }>, fallback?: string) {
  return buckets.find((bucket) => bucket._id === id)?.name || fallback || "Unavailable";
}
function nameOf(items: Array<{ _id: string; name: string }>, id: string) {
  return items.find((item) => item._id === id)?.name || "Unavailable";
}
function context(activity: BackfillActivity, resources: BackfillResources) {
  if (activity.type === "transfer")
    return `${nameOf(resources.accounts, activity.fromAccountId)} → ${nameOf(resources.accounts, activity.toAccountId)}`;
  if (activity.type === "reallocation")
    return `${nameOf(resources.buckets, activity.fromBucketId)} → ${nameOf(resources.buckets, activity.toBucketId)}`;
  return nameOf(resources.accounts, activity.accountId);
}
