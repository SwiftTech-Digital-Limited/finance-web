import type { Bucket } from "@/lib/api/types";
import type { BackfillAllocation } from "@/lib/api/backfill-types";
import { parseMoneyInput } from "@/lib/money";

export function bucketRows(
  values: Record<string, string>,
  buckets: Bucket[],
): BackfillAllocation[] {
  return buckets.map((bucket) => {
    const parsed = parseMoneyInput(values[bucket._id] || "0", true);
    if (!parsed.ok) throw new Error(`${bucket.name}: ${parsed.message}`);
    return { bucketId: bucket._id, amountMinor: parsed.amountMinor };
  });
}

export function allocationRows(
  rows: Array<{ bucketId: string; amount: string }>,
) {
  const parsed = rows
    .filter((row) => row.bucketId || row.amount)
    .map((row) => {
      const amount = parseMoneyInput(row.amount);
      if (!row.bucketId || !amount.ok)
        throw new Error("Complete every bucket amount.");
      return { bucketId: row.bucketId, amountMinor: amount.amountMinor };
    });
  if (new Set(parsed.map((row) => row.bucketId)).size !== parsed.length)
    throw new Error("Choose each bucket only once.");
  return parsed;
}

export function sortActivities<
  T extends { transactionDate: string; clientId: string },
>(activities: T[]) {
  return [...activities].sort(
    (a, b) =>
      a.transactionDate.localeCompare(b.transactionDate) ||
      a.clientId.localeCompare(b.clientId),
  );
}
