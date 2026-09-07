import { apiData, apiRequest, toQuery } from "./client";
import type {
  Account,
  Allocation,
  AllocationPreview,
  AllocationRule,
  Bucket,
  Category,
  ChartDatum,
  DashboardData,
  IncomeSource,
  ListParams,
  Reallocation,
  RuleSnapshot,
  Transaction,
  User,
} from "./types";

export type ResourceName =
  "accounts" | "buckets" | "categories" | "income-sources" | "allocation-rules";
export type ResourceTypeMap = {
  accounts: Account;
  buckets: Bucket;
  categories: Category;
  "income-sources": IncomeSource;
  "allocation-rules": AllocationRule;
};

export async function listResource<K extends ResourceName>(
  resource: K,
  params: ListParams = {},
) {
  const envelope = await apiRequest<ResourceTypeMap[K][]>(
    `/${resource}${toQuery(params)}`,
  );
  return { items: envelope.data, pagination: envelope.pagination };
}
export function getResource<K extends ResourceName>(resource: K, id: string) {
  return apiData<ResourceTypeMap[K]>(`/${resource}/${id}`);
}
export function createResource<K extends ResourceName>(
  resource: K,
  input: unknown,
) {
  return apiData<ResourceTypeMap[K]>(`/${resource}`, {
    method: "POST",
    body: input,
  });
}
export function updateResource<K extends ResourceName>(
  resource: K,
  id: string,
  input: unknown,
) {
  return apiData<ResourceTypeMap[K]>(`/${resource}/${id}`, {
    method: "PATCH",
    body: input,
  });
}
export function archiveResource(resource: ResourceName, id: string) {
  return apiData<unknown>(`/${resource}/${id}`, { method: "DELETE" });
}

export const financeApi = {
  dashboard: () => apiData<DashboardData>("/dashboard"),
  onboarding: () =>
    apiData<{
      hasAccount: boolean;
      hasBucket: boolean;
      hasIncomeSource: boolean;
      hasAllocationRule: boolean;
      completed: boolean;
    }>("/users/me/onboarding"),
  setOnboarding: (completed: boolean) =>
    apiData<unknown>("/users/me/onboarding", {
      method: "PATCH",
      body: { completed },
    }),
  updateProfile: (input: {
    name?: string;
    timezone?: string;
    defaultCurrency?: string;
  }) => apiData<User>("/users/me", { method: "PATCH", body: input }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiData<unknown>("/users/me/password", { method: "PATCH", body: input }),
  previewIncome: (input: {
    amountMinor: number;
    accountId: string;
    incomeSourceId?: string;
    transactionDate?: string;
  }) =>
    apiData<AllocationPreview>("/transactions/income/preview", {
      method: "POST",
      body: input,
    }),
  previewRule: (input: {
    amountMinor: number;
    accountId?: string;
    incomeSourceId?: string;
    transactionDate?: string;
  }) =>
    apiData<AllocationPreview>("/allocation-rules/preview", {
      method: "POST",
      body: input,
    }),
  postIncome: (input: unknown, key: string) =>
    apiData<{
      transaction: Transaction;
      allocations: Allocation[];
      allocatedTotalMinor: number;
      unallocatedAmountMinor: number;
      receivingAccountBalanceMinor: number;
      affectedBucketBalances: {
        bucketId: string;
        resultingBalanceMinor: number;
      }[];
    }>("/transactions/income", {
      method: "POST",
      body: input,
      headers: { "Idempotency-Key": key },
    }),
  postExpense: (input: unknown, key: string, split = false) =>
    apiData<{
      expense: Transaction;
      transaction?: Transaction;
      resultingAccountBalanceMinor: number;
      bucketBalances: { bucketId: string; resultingBalanceMinor: number }[];
    }>(`/transactions/expenses${split ? "/split" : ""}`, {
      method: "POST",
      body: input,
      headers: { "Idempotency-Key": key },
    }),
  transfer: (input: unknown, key: string) =>
    apiData<{
      transferId: string;
      fromAccountBalanceMinor: number;
      toAccountBalanceMinor: number;
    }>("/transfers", {
      method: "POST",
      body: input,
      headers: { "Idempotency-Key": key },
    }),
  reallocate: (input: unknown, key: string) =>
    apiData<{
      reallocation: Reallocation;
      fromBucketBalanceMinor: number;
      toBucketBalanceMinor: number;
    }>("/reallocations", {
      method: "POST",
      body: input,
      headers: { "Idempotency-Key": key },
    }),
  assignIncome: (
    id: string,
    allocations: { bucketId: string; amountMinor: number }[],
    key: string,
  ) =>
    apiData<{
      incomeTransaction: Transaction;
      newAllocatedTotalMinor: number;
      unallocatedAmountMinor: number;
    }>(`/transactions/${id}/allocate`, {
      method: "POST",
      body: { allocations },
      headers: { "Idempotency-Key": key },
    }),
  assignOpening: (
    id: string,
    allocations: { bucketId: string; amountMinor: number }[],
    key: string,
  ) =>
    apiData<{
      newAllocatedTotalMinor: number;
      remainingOpeningBalanceUnallocatedMinor: number;
      affectedBucketBalances: {
        bucketId: string;
        resultingBalanceMinor: number;
      }[];
    }>(`/accounts/${id}/allocate-opening-balance`, {
      method: "POST",
      body: { allocations },
      headers: { "Idempotency-Key": key },
    }),
  voidTransaction: (id: string, reason: string, key: string) =>
    apiData<{
      transactionId: string;
      status: "void";
      voidedAt: string;
      reason: string;
    }>(`/transactions/${id}/void`, {
      method: "POST",
      body: { reason },
      headers: { "Idempotency-Key": key },
    }),
  transactions: async (params: Record<string, string | number | undefined>) => {
    const response = await apiRequest<Transaction[]>(
      `/transactions${toQuery(params)}`,
    );
    return { items: response.data, pagination: response.pagination };
  },
  transaction: (id: string) => apiData<Transaction>(`/transactions/${id}`),
  lineage: (id: string) =>
    apiData<{
      incomeTransaction?: Transaction;
      transaction?: Transaction;
      allocations: Allocation[];
      allocatedTotalMinor: number;
      unallocatedAmountMinor: number;
      allocationRuleSnapshot?: RuleSnapshot;
    }>(`/transactions/${id}/lineage`),
  reallocations: async (
    params: Record<string, string | number | undefined>,
  ) => {
    const response = await apiRequest<Reallocation[]>(
      `/reallocations${toQuery(params)}`,
    );
    return { items: response.data, pagination: response.pagination };
  },
  allocations: async (params: Record<string, string | number | undefined>) => {
    const response = await apiRequest<Allocation[]>(
      `/allocations${toQuery(params)}`,
    );
    return { items: response.data, pagination: response.pagination };
  },
  monthlySetting: (year: number, month: number) =>
    apiData<{
      year: number;
      month: number;
      idealSpendMinor: number;
      maximumSpendMinor: number;
      notes?: string;
      spendingProgress?: boolean;
    }>(`/monthly-settings/${year}/${month}`),
  saveMonthlySetting: (year: number, month: number, input: unknown) =>
    apiData<unknown>(`/monthly-settings/${year}/${month}`, {
      method: "PUT",
      body: input,
    }),
  analytics: (path: string, params: { dateFrom?: string; dateTo?: string }) =>
    apiData<ChartDatum[]>(`/analytics/${path}${toQuery(params)}`),
};

export const queryKeys = {
  all: ["finance"] as const,
  dashboard: ["finance", "dashboard"] as const,
  resource: (name: ResourceName, params?: object) =>
    ["finance", name, params] as const,
  detail: (name: string, id: string) => ["finance", name, id] as const,
  transactions: (params?: object) =>
    ["finance", "transactions", params] as const,
  analytics: (path: string, params?: object) =>
    ["finance", "analytics", path, params] as const,
  backfills: (params?: object) => ["finance", "backfills", params] as const,
  backfill: (id: string) => ["finance", "backfills", id] as const,
};
