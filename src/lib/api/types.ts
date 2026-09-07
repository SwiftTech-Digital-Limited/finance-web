export interface ApiEnvelope<T> {
  success: true;
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
export interface User {
  _id: string;
  name: string;
  email: string;
  timezone: string;
  defaultCurrency: string;
}
export interface AuthResult {
  user: User;
  accessToken: string;
}

export type AccountType =
  "bank" | "cash" | "wallet" | "savings" | "investment" | "other";
export type BucketType =
  "spending" | "saving" | "investment" | "reserve" | "custom";
export interface Account {
  _id: string;
  name: string;
  type: AccountType;
  currency?: string;
  institutionName?: string;
  description?: string;
  icon?: string;
  openingBalanceMinor: number;
  currentBalanceMinor?: number;
  totalInflowsMinor?: number;
  totalOutflowsMinor?: number;
  includeInNetWorth?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  recentTransactions?: Transaction[];
}
export interface Bucket {
  _id: string;
  name: string;
  type?: BucketType;
  description?: string;
  icon?: string;
  displayOrder?: number;
  availableBalanceMinor?: number;
  currentBalanceMinor?: number;
  allocatedMinor?: number;
  spentMinor?: number;
  reallocatedInMinor?: number;
  reallocatedOutMinor?: number;
  isArchived?: boolean;
  archivedAt?: string;
  activity?: FinancialEvent[];
}
export interface Category {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  isArchived?: boolean;
}
export interface IncomeSource {
  _id: string;
  name: string;
  description?: string;
  defaultAccountId?: string | Account;
  isArchived?: boolean;
}
export interface NamedRef {
  _id?: string;
  name?: string;
  label?: string;
  isArchived?: boolean;
}

export interface RuleAllocation {
  bucketId: string | Bucket;
  amountMinor?: number;
  percentageBps?: number;
  order?: number;
  bucketName?: string;
}
export interface AllocationRule {
  _id: string;
  name: string;
  description?: string;
  priority?: number;
  incomeSourceId?: string | IncomeSource;
  minimumAmountMinor?: number | null;
  maximumAmountMinor?: number | null;
  fixedAllocations: RuleAllocation[];
  percentageAllocations: RuleAllocation[];
  isDefault?: boolean;
  isActive?: boolean;
  isArchived?: boolean;
}
export interface RuleSnapshot {
  name?: string;
  fixedAllocations?: RuleAllocation[];
  percentageAllocations?: RuleAllocation[];
}
export interface AllocationPreview {
  amountMinor: number;
  incomeSource?: NamedRef | null;
  matchedRule?: (NamedRef & { priority?: number }) | null;
  matchReason?: string;
  fixedAllocations: RuleAllocation[];
  fixedTotalMinor: number;
  distributableAmountMinor: number;
  percentageAllocations: RuleAllocation[];
  percentageTotalMinor: number;
  finalAllocations: (RuleAllocation & { allocationType?: string })[];
  totalAllocatedMinor: number;
  unallocatedAmountMinor: number;
  warnings: string[];
}

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "transfer_in"
  | "transfer_out"
  | "adjustment";
export interface Transaction {
  _id: string;
  type: TransactionType;
  displayType?: string;
  amountMinor: number;
  status?: "posted" | "void";
  description?: string;
  transactionDate?: string;
  createdAt?: string;
  accountId?: string | Account;
  bucketId?: string | Bucket;
  categoryId?: string | Category;
  incomeSourceId?: string | IncomeSource;
  account?: Account;
  category?: Category;
  incomeSource?: IncomeSource;
  bucket?: Bucket;
  bucketSplits?: { bucketId: string | Bucket; amountMinor: number }[];
  counterpartAccount?: Account;
  transferId?: string;
  groupId?: string;
  allocationRuleSnapshot?: RuleSnapshot;
  voidedAt?: string;
  voidReason?: string;
  metadata?: {
    backfilled?: boolean;
    backfillSessionId?: string;
    clientId?: string;
    [key: string]: unknown;
  };
}
export interface Allocation {
  _id?: string;
  bucketId: string | Bucket;
  amountMinor: number;
  allocationType: "fixed" | "percentage" | "manual";
  sourceType?: "income" | "opening_balance" | "backfill_snapshot";
  percentageBps?: number;
}
export interface Reallocation {
  _id: string;
  fromBucketId: string | Bucket;
  toBucketId: string | Bucket;
  amountMinor: number;
  description?: string;
  date?: string;
  createdAt?: string;
}
export interface FinancialEvent extends Partial<Transaction> {
  eventKind?: "transaction" | "reallocation";
  reallocation?: Reallocation;
  fromBucket?: Bucket;
  toBucket?: Bucket;
}
export interface SpendingProgress {
  idealSpendMinor?: number;
  maximumSpendMinor?: number;
  spentMinor?: number;
  spentThisMonthMinor?: number;
  amountAboveIdealMinor?: number;
  amountAboveMaximumMinor?: number;
  status?: "below_ideal" | "between_ideal_and_max" | "above_max";
  remainingToIdealMinor?: number;
  remainingToMaximumMinor?: number;
}
export interface DashboardData {
  period?: { start: string; endExclusive: string; timezone: string };
  totalFinancialPositionMinor: number;
  totalAccountBalanceMinor?: number;
  totalPhysicalAccountBalanceMinor: number;
  availableBucketBalanceMinor?: number;
  totalBucketBalanceMinor: number;
  unallocatedAmountMinor: number;
  accounts: Account[];
  buckets: Bucket[];
  currentMonth: {
    year: number;
    month: number;
    incomeMinor: number;
    expensesMinor: number;
    netCashFlowMinor: number;
    savedAllocationMinor?: number;
    investmentAllocationMinor?: number;
  };
  spendingTargetProgress?: SpendingProgress | null;
  recentFinancialEvents: FinancialEvent[];
  recentTransactions?: Transaction[];
  recentIncome?: Transaction[];
  recentAllocations?: Allocation[];
  recentReallocations?: Reallocation[];
}
export interface ChartDatum {
  id?: string;
  label?: string;
  month?: string;
  amountMinor?: number;
  incomeMinor?: number;
  expensesMinor?: number;
  netCashFlowMinor?: number;
  count?: number;
}
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  includeArchived?: boolean;
  [key: string]: string | number | boolean | undefined;
}
