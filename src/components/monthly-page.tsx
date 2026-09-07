"use client";

/* eslint-disable react/no-unescaped-entities */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { financeApi, queryKeys } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors";
import { parseMoneyInput } from "@/lib/money";
import { Field, LoadingBlock, PageHeader } from "@/components/ui-kit";

export function MonthlyPage() {
  const [period, setPeriod] = useState(new Date());
  const year = period.getFullYear();
  const month = period.getMonth() + 1;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["finance", "monthly-settings", year, month],
    queryFn: () => financeApi.monthlySetting(year, month),
    retry: false,
  });
  const [draft, setDraft] = useState({ ideal: "", maximum: "", notes: "" });
  const identity = `${year}-${month}-${query.data?.idealSpendMinor || ""}`;
  const [lastIdentity, setLastIdentity] = useState("");
  if (query.data && identity !== lastIdentity) {
    setLastIdentity(identity);
    setDraft({
      ideal: String(query.data.idealSpendMinor / 100),
      maximum: String(query.data.maximumSpendMinor / 100),
      notes: query.data.notes || "",
    });
  }
  const missing = query.error instanceof ApiError && query.error.status === 404;
  const mutation = useMutation({
    mutationFn: async () => {
      const ideal = parseMoneyInput(draft.ideal, true);
      const maximum = parseMoneyInput(draft.maximum, true);
      if (!ideal.ok || !maximum.ok)
        throw new Error(
          !ideal.ok
            ? ideal.message
            : !maximum.ok
              ? maximum.message
              : "Enter valid limits.",
        );
      if (ideal.amountMinor > maximum.amountMinor)
        throw new Error("Your ideal cannot exceed your maximum.");
      return financeApi.saveMonthlySetting(year, month, {
        idealSpendMinor: ideal.amountMinor,
        maximumSpendMinor: maximum.amountMinor,
        notes: draft.notes || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["finance", "monthly-settings", year, month],
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Monthly spending"
        description="Your ideal is a preference; your maximum is the boundary you would rather not cross. Neither changes bucket balances."
      />
      <div className="period-nav">
        <button
          onClick={() => setPeriod((value) => subMonths(value, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft />
        </button>
        <h2>{format(period, "MMMM yyyy")}</h2>
        <button
          onClick={() => setPeriod((value) => addMonths(value, 1))}
          aria-label="Next month"
        >
          <ChevronRight />
        </button>
      </div>
      {query.isLoading ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="monthly-layout">
          <section className="monthly-explainer">
            <span>
              <Target />
            </span>
            <p className="eyebrow">A calm boundary</p>
            <h2>Plan without turning life into a ledger.</h2>
            <p>
              Set a comfortable ideal and a firm maximum. The dashboard will
              tell you what remains before each marker using the server's
              timezone-aware period.
            </p>
            {query.data?.spendingProgress && (
              <div className="plan-status">
                Spending progress is available for this period.
              </div>
            )}
          </section>
          <form
            className="money-form"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Field label="Ideal spending" hint="NGN">
              <input
                inputMode="decimal"
                value={draft.ideal}
                onChange={(event) =>
                  setDraft({ ...draft, ideal: event.target.value })
                }
                placeholder="100,000"
              />
            </Field>
            <p className="field-explanation">
              The amount you would feel good staying below.
            </p>
            <Field label="Maximum spending" hint="NGN">
              <input
                inputMode="decimal"
                value={draft.maximum}
                onChange={(event) =>
                  setDraft({ ...draft, maximum: event.target.value })
                }
                placeholder="150,000"
              />
            </Field>
            <p className="field-explanation">
              The boundary you would rather not cross.
            </p>
            <Field label="Notes" hint="Optional">
              <textarea
                rows={3}
                value={draft.notes}
                onChange={(event) =>
                  setDraft({ ...draft, notes: event.target.value })
                }
                placeholder="What matters this month?"
              />
            </Field>
            {missing && (
              <p className="neutral-callout">
                No boundary is set for this month yet.
              </p>
            )}
            {mutation.error && (
              <p className="form-error-box">{errorMessage(mutation.error)}</p>
            )}
            {mutation.isSuccess && (
              <p className="success-callout">
                Monthly spending boundary saved.
              </p>
            )}
            <button
              className="button-primary submit-button"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Save monthly boundary"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
