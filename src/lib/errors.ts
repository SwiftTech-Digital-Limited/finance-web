import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/money";

type ShortfallDetails = {
  availableMinor?: number;
  requiredMinor?: number;
  shortfallMinor?: number;
  accountId?: string;
  bucketId?: string;
};

export function errorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return "Something went wrong. Please try again.";
  const details = error.details as ShortfallDetails | undefined;
  if (
    (error.code === "INSUFFICIENT_ACCOUNT_BALANCE" ||
      error.code === "INSUFFICIENT_BUCKET_BALANCE") &&
    details
  ) {
    const place = error.code.includes("ACCOUNT") ? "account" : "bucket";
    return `This ${place} has ${formatMoney(details.availableMinor || 0)} available. ${formatMoney(details.requiredMinor || 0)} is required, leaving a ${formatMoney(details.shortfallMinor || 0)} shortfall.`;
  }
  const friendly: Record<string, string> = {
    VALIDATION_ERROR: "Check the highlighted details and try again.",
    RESOURCE_CONFLICT: "That conflicts with an existing setting.",
    ALLOCATION_RULE_CONFLICT:
      "Two equally ranked rules match. Adjust their priority or conditions.",
    INVALID_ALLOCATION_PERCENTAGE:
      "Percentage allocations must total exactly 100%.",
    FIXED_ALLOCATION_EXCEEDS_INCOME:
      "Fixed set-asides exceed this income amount.",
    ALLOCATION_EXCEEDS_INCOME:
      "These assignments exceed the income still available.",
    ALLOCATION_EXCEEDS_OPENING_BALANCE:
      "These assignments exceed the opening money still available.",
    INVALID_TRANSFER: "Choose two different accounts and a valid amount.",
    INVALID_REALLOCATION: "Choose two different buckets and a valid amount.",
    FINANCIAL_EVENT_ALREADY_VOID: "This transaction has already been voided.",
    FINANCIAL_EVENT_HAS_DEPENDENCIES:
      "This income cannot be voided because later activity depends on its bucket money.",
    BACKFILL_ACCOUNT_REQUIRED:
      "Create at least one account with today's real balance before continuing.",
    BACKFILL_INVALID_PERIOD:
      "Choose a spreadsheet date earlier than the cutover date; the cutover cannot be in the future.",
    BACKFILL_ACTIVITY_OUTSIDE_PERIOD:
      "A staged activity falls outside the selected migration period.",
    BACKFILL_EXISTING_ACTIVITY_CONFLICT:
      "Spreadsheet migration must be completed before ordinary financial activity is recorded.",
    BACKFILL_ALREADY_COMPLETED:
      "A completed spreadsheet migration already exists for this profile.",
    BACKFILL_STATE_CHANGED:
      "An account balance changed after this draft began. Review the values, then cancel and restart.",
    BACKFILL_BUCKETS_EXCEED_ACCOUNTS:
      "Spreadsheet bucket balances exceed reconstructed physical money.",
    BACKFILL_NEGATIVE_BALANCE:
      "The staged history would require a negative account balance at the spreadsheet date.",
    BACKFILL_RECONCILIATION_FAILED:
      "The calculated cutover balances do not match the captured current balances.",
    NOT_FOUND: "This item is unavailable or may have been archived.",
  };
  return friendly[error.code] || error.message;
}
