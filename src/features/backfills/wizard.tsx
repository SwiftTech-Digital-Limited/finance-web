"use client";
/* eslint-disable react-hooks/set-state-in-effect -- server draft hydration intentionally replaces local editable state */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/components/providers";
import {
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
} from "@/components/ui-kit";
import { listResource, queryKeys } from "@/lib/api";
import { backfillApi } from "@/lib/api/backfills";
import type {
  BackfillActivity,
  BackfillDraftInput,
  BackfillFinalizeResult,
  BackfillPreview,
  BackfillSession,
} from "@/lib/api/backfill-types";
import type { Account, Bucket, Category, IncomeSource } from "@/lib/api/types";
import { snapshotBoundary, serializeZonedDateTime } from "@/lib/backfill-dates";
import { createIdempotencyKey } from "@/lib/idempotency";
import { parseMoneyInput, formatMoney } from "@/lib/money";
import {
  BackfillActivityEditor,
  type BackfillResources,
} from "./activity-editor";
import {
  BackfillAudit,
  BackfillError,
  BackfillFinalizeStep,
  ReconciliationSummary,
  WizardActions,
} from "./reconciliation";
import { bucketRows } from "./utils";

const steps = [
  "Readiness",
  "Dates",
  "Bucket snapshot",
  "Activity",
  "Reconcile",
  "Finalize",
];
const localNow = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export function BackfillWizard() {
  const { user } = useAuth();
  const timezone = user?.timezone || "Africa/Lagos";
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState(params.get("id") || "");
  const [step, setStep] = useState(0);
  const [snapshotDate, setSnapshotDate] = useState("");
  const [cutoverDate, setCutoverDate] = useState(localNow());
  const [notes, setNotes] = useState("");
  const [bucketInputs, setBucketInputs] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [finalResult, setFinalResult] = useState<BackfillFinalizeResult | null>(
    null,
  );
  const finalizeKey = useRef<string | null>(null);
  const resourceQueries = useQueries({
    queries: (
      ["accounts", "buckets", "categories", "income-sources"] as const
    ).map((name) => ({
      queryKey: queryKeys.resource(name, { limit: 100, includeArchived: true }),
      queryFn: () => listResource(name, { limit: 100, includeArchived: true }),
    })),
  });
  const resources: BackfillResources = {
    accounts: (resourceQueries[0].data?.items || []) as Account[],
    buckets: (resourceQueries[1].data?.items || []) as Bucket[],
    categories: (resourceQueries[2].data?.items || []) as Category[],
    sources: (resourceQueries[3].data?.items || []) as IncomeSource[],
  };
  const drafts = useQuery({
    queryKey: queryKeys.backfills({ status: "draft" }),
    queryFn: () => backfillApi.list({ status: "draft", limit: 20 }),
    enabled: !sessionId,
  });
  const completed = useQuery({
    queryKey: queryKeys.backfills({ status: "finalized" }),
    queryFn: () => backfillApi.list({ status: "finalized", limit: 1 }),
    enabled: !sessionId,
  });
  const detail = useQuery({
    queryKey: queryKeys.backfill(sessionId),
    queryFn: () => backfillApi.detail(sessionId),
    enabled: Boolean(sessionId),
  });
  const session = detail.data;
  useEffect(() => {
    // The server draft is the durable source of truth when a session is opened or saved.
    if (!session) return;
    setSnapshotDate(session.snapshotDate.slice(0, 10));
    setCutoverDate(toLocal(session.cutoverDate));
    setNotes(session.notes || "");
    setBucketInputs(
      Object.fromEntries(
        session.bucketBalances.map((row) => [
          row.bucketId,
          String(row.amountMinor / 100),
        ]),
      ),
    );
    if (session.status === "finalized") setStep(6);
  }, [session]);
  const openSession = (id: string, nextStep = 3) => {
    setSessionId(id);
    setStep(nextStep);
    router.replace(`/settings/data-setup?id=${id}`);
  };
  const create = useMutation({
    mutationFn: () =>
      backfillApi.create(
        draftInput(
          snapshotDate,
          cutoverDate,
          timezone,
          notes,
          bucketInputs,
          resources.buckets,
          [],
        ),
      ),
    onSuccess: async ({ backfill, preview }) => {
      queryClient.setQueryData(queryKeys.backfill(backfill._id), {
        ...backfill,
        preview,
      });
      openSession(backfill._id);
      await queryClient.invalidateQueries({
        queryKey: ["finance", "backfills"],
      });
    },
  });
  const save = useMutation({
    mutationFn: (input: Partial<BackfillDraftInput>) =>
      backfillApi.update(sessionId, input),
    onSuccess: ({ backfill, preview }) =>
      queryClient.setQueryData(queryKeys.backfill(sessionId), {
        ...backfill,
        preview,
      }),
  });
  const preview = useMutation({
    mutationFn: () => backfillApi.preview(sessionId),
    onSuccess: (value) =>
      queryClient.setQueryData(
        queryKeys.backfill(sessionId),
        (old: BackfillSession | undefined) =>
          old ? { ...old, preview: value } : old,
      ),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => backfillApi.cancel(id),
    onSuccess: async () => {
      setSessionId("");
      setStep(0);
      router.replace("/settings/data-setup");
      await queryClient.invalidateQueries({
        queryKey: ["finance", "backfills"],
      });
    },
  });
  const finalize = useMutation({
    mutationFn: () =>
      backfillApi.finalize(
        sessionId,
        finalizeKey.current ?? (finalizeKey.current = createIdempotencyKey()),
      ),
    onSuccess: async (result) => {
      setFinalResult(result);
      setConfirming(false);
      setStep(6);
      await queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
  const error =
    create.error ||
    save.error ||
    preview.error ||
    cancel.error ||
    finalize.error;
  if (
    resourceQueries.some((query) => query.isLoading) ||
    (sessionId && detail.isLoading)
  )
    return (
      <>
        <PageHeader title="Continue from spreadsheet" />
        <LoadingBlock rows={7} />
      </>
    );
  if (step === 6 && (session || finalResult))
    return (
      <BackfillAudit
        session={session}
        result={finalResult}
        resources={resources}
      />
    );
  const activities = session?.activities || [];
  return (
    <>
      <PageHeader
        eyebrow="Settings · Data setup"
        title="Continue from spreadsheet"
        description="Bring forward an earlier bucket snapshot and the real activity between that date and today's account balances."
      />
      <nav className="backfill-steps" aria-label="Migration steps">
        {steps.map((label, index) => (
          <button
            key={label}
            disabled={!sessionId && index > 2}
            className={step === index ? "active" : index < step ? "done" : ""}
            onClick={() => setStep(index)}
          >
            <span>{index < step ? <Check /> : index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <BackfillError
          error={error}
          activities={activities}
          resources={resources}
        />
      )}
      {step === 0 && (
        <Readiness
          resources={resources}
          draft={drafts.data?.items[0]}
          completed={completed.data?.items[0]}
          busy={cancel.isPending}
          onResume={openSession}
          onCancel={(id) => cancel.mutate(id)}
          onContinue={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <DateStep
          timezone={timezone}
          snapshot={snapshotDate}
          cutover={cutoverDate}
          notes={notes}
          setSnapshot={setSnapshotDate}
          setCutover={setCutoverDate}
          setNotes={setNotes}
          busy={save.isPending}
          back={() => setStep(0)}
          next={() => {
            const dates = dateInput(snapshotDate, cutoverDate, timezone, notes);
            if (sessionId) save.mutate(dates, { onSuccess: () => setStep(2) });
            else setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <BucketStep
          buckets={resources.buckets}
          values={bucketInputs}
          setValues={setBucketInputs}
          preview={session?.preview}
          busy={create.isPending || save.isPending}
          back={() => setStep(1)}
          next={() => {
            const rows = bucketRows(bucketInputs, resources.buckets);
            if (sessionId)
              save.mutate(
                { bucketBalances: rows },
                { onSuccess: () => setStep(3) },
              );
            else create.mutate();
          }}
        />
      )}
      {step === 3 && session && (
        <BackfillActivityEditor
          activities={activities}
          resources={resources}
          timezone={timezone}
          saving={save.isPending}
          onSave={(next) => save.mutate({ activities: next })}
          onContinue={() =>
            preview.mutate(undefined, { onSuccess: () => setStep(4) })
          }
        />
      )}
      {step === 4 && session?.preview && (
        <ReconciliationSummary
          preview={session.preview}
          resources={resources}
          onBack={() => setStep(3)}
          onRefresh={() => preview.mutate()}
          refreshing={preview.isPending}
          onContinue={() => setStep(5)}
        />
      )}
      {step === 5 && session?.preview && (
        <BackfillFinalizeStep
          preview={session.preview}
          onBack={() => setStep(4)}
          onConfirm={() => setConfirming(true)}
        />
      )}
      <Modal
        open={confirming}
        title="Finalize spreadsheet migration?"
        description="This changes opening baselines, creates spreadsheet starting allocations, and commits all staged events atomically while preserving captured current balances."
        onClose={() => setConfirming(false)}
      >
        <p className="warning-callout">
          This one-time initialization cannot be edited after finalization.
        </p>
        <div className="confirm-actions">
          <button
            className="button-secondary"
            onClick={() => setConfirming(false)}
          >
            Review again
          </button>
          <button
            className="button-primary"
            disabled={finalize.isPending || !session?.preview?.readyToFinalize}
            onClick={() => finalize.mutate()}
          >
            {finalize.isPending ? "Finalizing…" : "Confirm and finalize"}
          </button>
        </div>
      </Modal>
    </>
  );
}

function Readiness({
  resources,
  draft,
  completed,
  busy,
  onResume,
  onCancel,
  onContinue,
}: {
  resources: BackfillResources;
  draft?: BackfillSession;
  completed?: BackfillSession;
  busy: boolean;
  onResume(id: string, step?: number): void;
  onCancel(id: string): void;
  onContinue(): void;
}) {
  if (completed)
    return (
      <section className="backfill-panel">
        <FileSpreadsheet />
        <h2>Spreadsheet migration completed</h2>
        <p>Only one finalized migration is supported for this profile.</p>
        <button
          className="button-primary"
          onClick={() => onResume(completed._id, 6)}
        >
          View audit
        </button>
      </section>
    );
  return (
    <section className="backfill-panel">
      <p className="eyebrow">Before you begin</p>
      <h2>Keep today correct while rebuilding the earlier starting point.</h2>
      <div className="readiness-grid">
        <div>
          <b>Accounts are current</b>
          <p>Enter today&apos;s real account balances first.</p>
        </div>
        <div>
          <b>No ordinary activity yet</b>
          <p>
            This must happen before transactions, allocations, or reallocations.
          </p>
        </div>
        <div>
          <b>The server reconstructs history</b>
          <p>
            We keep today’s balances unchanged and calculate what they must have
            been at the spreadsheet date.
          </p>
        </div>
      </div>
      {!resources.accounts.length ? (
        <EmptyState
          title="Add an account first"
          description="At least one account with today's real balance is required."
          action={{ href: "/accounts", label: "Create account" }}
        />
      ) : draft ? (
        <div className="draft-callout">
          <div>
            <b>Draft found</b>
            <p>
              Resume the durable server draft or cancel it without financial
              writes.
            </p>
          </div>
          <button
            className="button-primary"
            onClick={() => onResume(draft._id)}
          >
            Resume
          </button>
          <button
            className="button-secondary"
            disabled={busy}
            onClick={() => onCancel(draft._id)}
          >
            Cancel draft
          </button>
        </div>
      ) : (
        <div className="wizard-actions">
          <span>
            {resources.accounts.length} accounts · {resources.buckets.length}{" "}
            buckets ready
          </span>
          <button className="button-primary" onClick={onContinue}>
            Choose dates
          </button>
        </div>
      )}
    </section>
  );
}
function DateStep({
  timezone,
  snapshot,
  cutover,
  notes,
  setSnapshot,
  setCutover,
  setNotes,
  back,
  next,
  busy,
}: {
  timezone: string;
  snapshot: string;
  cutover: string;
  notes: string;
  setSnapshot(value: string): void;
  setCutover(value: string): void;
  setNotes(value: string): void;
  back(): void;
  next(): void;
  busy: boolean;
}) {
  return (
    <section className="backfill-panel">
      <p className="eyebrow">Dates · {timezone}</p>
      <h2>Define both ends of the gap.</h2>
      <div className="form-grid">
        <Field label="My spreadsheet is complete through…">
          <input
            type="date"
            required
            value={snapshot}
            onChange={(event) => setSnapshot(event.target.value)}
          />
        </Field>
        <Field label="These account balances are correct as of…">
          <input
            type="datetime-local"
            required
            max={localNow()}
            value={cutover}
            onChange={(event) => setCutover(event.target.value)}
          />
        </Field>
      </div>
      <p className="neutral-callout">
        Events must be strictly after the snapshot and on or before cutover.
      </p>
      <Field label="Migration notes" hint="Optional">
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      <WizardActions
        back={back}
        next={next}
        busy={busy}
        disabled={!snapshot || !cutover}
        label="Enter bucket balances"
      />
    </section>
  );
}
function BucketStep({
  buckets,
  values,
  setValues,
  preview,
  busy,
  back,
  next,
}: {
  buckets: Bucket[];
  values: Record<string, string>;
  setValues(value: Record<string, string>): void;
  preview?: BackfillPreview;
  busy: boolean;
  back(): void;
  next(): void;
}) {
  const total = buckets.reduce((sum, bucket) => {
    const parsed = parseMoneyInput(values[bucket._id] || "0", true);
    return sum + (parsed.ok ? parsed.amountMinor : 0);
  }, 0);
  return (
    <section className="backfill-panel">
      <p className="eyebrow">Spreadsheet date</p>
      <h2>Enter every bucket&apos;s closing balance.</h2>
      <p>
        Blank values mean zero. Buckets describe purpose across accounts and are
        never tied to one account.
      </p>
      <div className="snapshot-list">
        {buckets.map((bucket) => (
          <Field key={bucket._id} label={bucket.name} hint="NGN">
            <input
              inputMode="decimal"
              placeholder="0"
              value={values[bucket._id] || ""}
              onChange={(event) =>
                setValues({ ...values, [bucket._id]: event.target.value })
              }
            />
          </Field>
        ))}
      </div>
      <div className="totals-strip">
        <div>
          <span>Bucket total</span>
          <b>{formatMoney(total)}</b>
        </div>
        <div>
          <span>Reconstructed physical</span>
          <b>
            {preview
              ? formatMoney(
                  preview.totalsAtSnapshot.physicalAccountBalanceMinor,
                )
              : "After server preview"}
          </b>
        </div>
        <div>
          <span>Unallocated</span>
          <b>
            {preview
              ? formatMoney(preview.totalsAtSnapshot.unallocatedAmountMinor)
              : "After server preview"}
          </b>
        </div>
      </div>
      <WizardActions
        back={back}
        next={next}
        busy={busy}
        label="Save and add activity"
      />
    </section>
  );
}
export function dateInput(
  snapshot: string,
  cutover: string,
  timezone: string,
  notes: string,
) {
  if (!snapshot || !cutover) throw new Error("Choose both dates.");
  return {
    snapshotDate: snapshotBoundary(snapshot, timezone),
    cutoverDate: serializeZonedDateTime(cutover, timezone),
    ...(notes.trim() ? { notes: notes.trim() } : {}),
  };
}
function draftInput(
  snapshot: string,
  cutover: string,
  timezone: string,
  notes: string,
  values: Record<string, string>,
  buckets: Bucket[],
  activities: BackfillActivity[],
): BackfillDraftInput {
  return {
    ...dateInput(snapshot, cutover, timezone, notes),
    bucketBalances: bucketRows(values, buckets),
    activities,
  };
}
function toLocal(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
