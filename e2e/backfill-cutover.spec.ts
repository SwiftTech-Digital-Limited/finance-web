import { expect, test, type APIRequestContext } from "@playwright/test";

const enabled = Boolean(process.env.E2E_API_BASE_URL);
test.skip(!enabled, "Set E2E_API_BASE_URL to an isolated Finance API.");

async function data<T>(
  request: APIRequestContext,
  path: string,
  options: Parameters<APIRequestContext["post"]>[1] & {
    method?: "get" | "post";
  } = {},
) {
  const method = options.method || "post";
  const response = await request[method](path, options);
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as { data: T }).data;
}

test("preserves cutover balances, commits history, then allows ordinary activity", async ({
  request,
}) => {
  const suffix = crypto.randomUUID();
  const auth = await data<{
    accessToken: string;
  }>(request, "/auth/register", {
    data: {
      name: "Backfill Test",
      email: `backfill-${suffix}@example.com`,
      password: "Backfill!2026Strong",
    },
  });
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const gtbank = await data<{ _id: string }>(request, "/accounts", {
    headers,
    data: {
      name: "GTBank",
      type: "bank",
      openingBalanceMinor: 1200000,
      currency: "NGN",
      includeInNetWorth: true,
    },
  });
  const needs = await data<{ _id: string }>(request, "/buckets", {
    headers,
    data: { name: "Needs", type: "spending", displayOrder: 1 },
  });
  const keep = await data<{ _id: string }>(request, "/buckets", {
    headers,
    data: { name: "Keep", type: "reserve", displayOrder: 2 },
  });
  const category = await data<{ _id: string }>(request, "/categories", {
    headers,
    data: { name: `Groceries ${suffix}` },
  });
  const draft = await data<{
    backfill: { _id: string };
    preview: {
      readyToFinalize: boolean;
      accountBaselines: Array<{ snapshotBalanceMinor: number }>;
    };
  }>(request, "/backfills", {
    headers,
    data: {
      snapshotDate: "2026-08-31T23:59:59+01:00",
      cutoverDate: "2026-09-04T00:00:00+01:00",
      notes: "Playwright spreadsheet cutover",
      bucketBalances: [
        { bucketId: needs._id, amountMinor: 1000000 },
        { bucketId: keep._id, amountMinor: 500000 },
      ],
      activities: [
        {
          clientId: crypto.randomUUID(),
          type: "expense",
          accountId: gtbank._id,
          categoryId: category._id,
          amountMinor: 300000,
          bucketSplits: [{ bucketId: needs._id, amountMinor: 300000 }],
          transactionDate: "2026-09-02T18:00:00+01:00",
          description: "Groceries",
        },
      ],
    },
  });
  expect(draft.preview.readyToFinalize).toBe(true);
  expect(draft.preview.accountBaselines[0].snapshotBalanceMinor).toBe(1500000);

  await data(request, `/backfills/${draft.backfill._id}/finalize`, {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
  });

  const account = await data<{ currentBalanceMinor: number }>(
    request,
    `/accounts/${gtbank._id}`,
    { headers, method: "get" },
  );
  const needsAfter = await data<{ availableBalanceMinor: number }>(
    request,
    `/buckets/${needs._id}`,
    { headers, method: "get" },
  );
  const keepAfter = await data<{ availableBalanceMinor: number }>(
    request,
    `/buckets/${keep._id}`,
    { headers, method: "get" },
  );
  expect(account.currentBalanceMinor).toBe(1200000);
  expect(needsAfter.availableBalanceMinor).toBe(700000);
  expect(keepAfter.availableBalanceMinor).toBe(500000);

  await data(request, "/transactions/expenses", {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      amountMinor: 100000,
      accountId: gtbank._id,
      bucketId: needs._id,
      categoryId: category._id,
      description: "After cutover",
      transactionDate: "2026-09-04T12:00:00+01:00",
    },
  });
  const finalAccount = await data<{ currentBalanceMinor: number }>(
    request,
    `/accounts/${gtbank._id}`,
    { headers, method: "get" },
  );
  const finalNeeds = await data<{ availableBalanceMinor: number }>(
    request,
    `/buckets/${needs._id}`,
    { headers, method: "get" },
  );
  expect(finalAccount.currentBalanceMinor).toBe(1100000);
  expect(finalNeeds.availableBalanceMinor).toBe(600000);
});
