import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiData } = vi.hoisted(() => ({ apiData: vi.fn() }));
vi.mock("./client", () => ({
  apiData,
  apiRequest: vi.fn(),
  toQuery: vi.fn(() => ""),
}));

import { backfillApi } from "./backfills";

describe("backfill API", () => {
  beforeEach(() => apiData.mockReset());

  it("sends the retained finalization idempotency key", async () => {
    apiData.mockResolvedValue({ backfill: { _id: "draft" } });
    await backfillApi.finalize("draft", "same-intent-key");
    expect(apiData).toHaveBeenCalledWith("/backfills/draft/finalize", {
      method: "POST",
      headers: { "Idempotency-Key": "same-intent-key" },
    });
  });
});
