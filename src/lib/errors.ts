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
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
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
    ALLOCATION_RULE_CONFLICT: "Two equally ranked rules match. Adjust their priority or conditions.",
    INVALID_ALLOCATION_PERCENTAGE: "Percentage allocations must total exactly 100%.",
    FIXED_ALLOCATION_EXCEEDS_INCOME: "Fixed set-asides exceed this income amount.",
    ALLOCATION_EXCEEDS_INCOME: "These assignments exceed the income still available.",
    ALLOCATION_EXCEEDS_OPENING_BALANCE: "These assignments exceed the opening money still available.",
    INVALID_TRANSFER: "Choose two different accounts and a valid amount.",
    INVALID_REALLOCATION: "Choose two different buckets and a valid amount.",
    FINANCIAL_EVENT_ALREADY_VOID: "This transaction has already been voided.",
    FINANCIAL_EVENT_HAS_DEPENDENCIES: "This income cannot be voided because later activity depends on its bucket money.",
    NOT_FOUND: "This item is unavailable or may have been archived.",
  };
  return friendly[error.code] || error.message;
}
