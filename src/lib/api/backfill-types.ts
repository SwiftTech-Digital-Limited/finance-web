export type BackfillStatus = "draft" | "finalized" | "cancelled";
export type BackfillAllocation = { bucketId: string; amountMinor: number };
type BackfillActivityBase = {
  clientId: string;
  amountMinor: number;
  transactionDate: string;
  description?: string;
};
export type BackfillActivity =
  | (BackfillActivityBase & {
      type: "income";
      accountId: string;
      incomeSourceId?: string;
      allocations?: BackfillAllocation[];
    })
  | (BackfillActivityBase & {
      type: "expense";
      accountId: string;
      categoryId: string;
      bucketSplits: BackfillAllocation[];
    })
  | (BackfillActivityBase & {
      type: "transfer";
      fromAccountId: string;
      toAccountId: string;
    })
  | (BackfillActivityBase & {
      type: "reallocation";
      fromBucketId: string;
      toBucketId: string;
    });
export type BackfillDraftInput = {
  snapshotDate: string;
  cutoverDate: string;
  notes?: string;
  bucketBalances: BackfillAllocation[];
  activities: BackfillActivity[];
};
export type BackfillTotals = {
  physicalAccountBalanceMinor: number;
  bucketBalanceMinor: number;
  unallocatedAmountMinor: number;
};
export type BackfillAccountBaseline = {
  accountId: string;
  accountName?: string;
  currentBalanceMinor: number;
  originalOpeningBalanceMinor: number;
  netChangeMinor: number;
  snapshotBalanceMinor: number;
};
export type BackfillPreview = {
  readyToFinalize: boolean;
  snapshotDate: string;
  cutoverDate: string;
  activityCount: number;
  accountBaselines: BackfillAccountBaseline[];
  bucketSnapshot: Array<{
    bucketId: string;
    bucketName?: string;
    amountMinor: number;
  }>;
  totalsAtSnapshot: BackfillTotals;
  timeline: Array<{
    clientId: string;
    type: BackfillActivity["type"];
    transactionDate: string;
    accountBalances: Record<string, number>;
    bucketBalances: Record<string, number>;
  }>;
  accountResults: Array<
    BackfillAccountBaseline & {
      calculatedCutoverBalanceMinor: number;
      matchesCapturedCurrent: boolean;
    }
  >;
  bucketResults: Array<{
    bucketId: string;
    bucketName?: string;
    balanceMinor: number;
  }>;
  totalsAtCutover: BackfillTotals;
  warnings: string[];
};
export type BackfillFinalizeResult = {
  backfillId: string;
  status: "finalized";
  snapshotDate: string;
  cutoverDate: string;
  transactionIds: string[];
  allocationIds: string[];
  reallocationIds: string[];
  accounts: Array<{ accountId: string; resultingBalanceMinor: number }>;
  buckets: Array<{ bucketId: string; resultingBalanceMinor: number }>;
  totalsAtSnapshot: BackfillTotals;
  totalsAtCutover: BackfillTotals;
};
export type BackfillSession = BackfillDraftInput & {
  _id: string;
  status: BackfillStatus;
  accountSnapshots: Array<{
    accountId: string;
    currentBalanceMinor: number;
    originalOpeningBalanceMinor: number;
    calculatedOpeningBalanceMinor: number;
  }>;
  preview?: BackfillPreview;
  result?: BackfillFinalizeResult;
  createdAt?: string;
  updatedAt?: string;
  finalizedAt?: string;
  cancelledAt?: string;
};
