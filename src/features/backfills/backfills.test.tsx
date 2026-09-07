import { describe, expect, it } from "vitest";
import { buildBackfillActivity } from "./activity-editor";
import { allocationRows, bucketRows, sortActivities } from "./utils";
import type { Bucket } from "@/lib/api/types";

const form = {
  amount: "3,000.00",
  date: "2026-09-02T18:00",
  description: "Groceries",
  accountId: "gtbank",
  sourceId: "",
  categoryId: "food",
  fromId: "",
  toId: "",
};

describe("backfill draft inputs", () => {
  it("keeps a stable client id and builds exact expense splits", () => {
    const result = buildBackfillActivity(
      "stable-id",
      "expense",
      form,
      [{ bucketId: "needs", amount: "3,000" }],
      "Africa/Lagos",
    );
    expect(result).toMatchObject({
      clientId: "stable-id",
      type: "expense",
      amountMinor: 300000,
      transactionDate: "2026-09-02T18:00:00+01:00",
      bucketSplits: [{ bucketId: "needs", amountMinor: 300000 }],
    });
  });

  it("supports partial income allocation and all discriminated activity types", () => {
    expect(
      buildBackfillActivity(
        "income-id",
        "income",
        { ...form, amount: "50,000", sourceId: "freelance" },
        [{ bucketId: "keep", amount: "20,000" }],
      ),
    ).toMatchObject({
      type: "income",
      allocations: [{ bucketId: "keep", amountMinor: 2000000 }],
    });
    expect(
      buildBackfillActivity(
        "transfer-id",
        "transfer",
        { ...form, fromId: "gtbank", toId: "savings" },
        [],
      ),
    ).toMatchObject({
      type: "transfer",
      fromAccountId: "gtbank",
      toAccountId: "savings",
    });
    expect(
      buildBackfillActivity(
        "move-id",
        "reallocation",
        { ...form, fromId: "keep", toId: "needs" },
        [],
      ),
    ).toMatchObject({
      type: "reallocation",
      fromBucketId: "keep",
      toBucketId: "needs",
    });
  });

  it("enforces expense and income allocation totals", () => {
    expect(() =>
      buildBackfillActivity("expense-id", "expense", form, [
        { bucketId: "needs", amount: "2,999" },
      ]),
    ).toThrow("must equal");
    expect(() =>
      buildBackfillActivity("income-id", "income", { ...form, amount: "100" }, [
        { bucketId: "needs", amount: "101" },
      ]),
    ).toThrow("cannot exceed");
    expect(() =>
      allocationRows([
        { bucketId: "needs", amount: "1" },
        { bucketId: "needs", amount: "2" },
      ]),
    ).toThrow("only once");
  });

  it("converts every bucket snapshot value to integer minor units", () => {
    const buckets = [
      { _id: "needs", name: "Needs" },
      { _id: "keep", name: "Keep" },
    ] as Bucket[];
    expect(bucketRows({ needs: "10,000.25", keep: "" }, buckets)).toEqual([
      { bucketId: "needs", amountMinor: 1000025 },
      { bucketId: "keep", amountMinor: 0 },
    ]);
  });

  it("renders source rows in strict chronological order", () => {
    const rows = [
      { clientId: "later", transactionDate: "2026-09-03T00:00:00+01:00" },
      { clientId: "earlier", transactionDate: "2026-09-01T00:00:00+01:00" },
    ];
    expect(sortActivities(rows).map((row) => row.clientId)).toEqual([
      "earlier",
      "later",
    ]);
    expect(rows[0].clientId).toBe("later");
  });
});
