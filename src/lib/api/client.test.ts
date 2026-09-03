import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, setAccessToken, toQuery } from "./client";

afterEach(() => { setAccessToken(null); vi.unstubAllGlobals(); });

describe("API client", () => {
  it("unwraps success envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(apiRequest<{ ok: boolean }>("/health", { auth: false })).resolves.toMatchObject({ data: { ok: true } });
  });
  it("preserves structured error details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "INSUFFICIENT_ACCOUNT_BALANCE", message: "Short", details: { availableMinor: 1, requiredMinor: 2, shortfallMinor: 1 } } }), { status: 409, headers: { "Content-Type": "application/json", "x-request-id": "req-1" } })));
    const error = await apiRequest("/x", { auth: false }).catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "INSUFFICIENT_ACCOUNT_BALANCE", status: 409, requestId: "req-1", details: { shortfallMinor: 1 } });
  });
  it("performs one single-flight refresh for concurrent 401s and retries once", async () => {
    setAccessToken("expired");
    let refreshCalls = 0; let protectedCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) { refreshCalls += 1; return new Response(JSON.stringify({ success: true, data: { accessToken: "fresh" } }), { status: 200, headers: { "Content-Type": "application/json" } }); }
      protectedCalls += 1;
      if (protectedCalls <= 2) return new Response(JSON.stringify({ success: false, error: { code: "TOKEN_EXPIRED", message: "Expired" } }), { status: 401, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    await Promise.all([apiRequest("/accounts"), apiRequest("/buckets")]);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(4);
  });
  it("does not retry login failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "No" } }), { status: 401, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest("/auth/login", { method: "POST" })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("omits absent filters and serializes exact minor-unit names", () => {
    expect(toQuery({ search: "", page: 1, minAmountMinor: 250000, maxAmountMinor: undefined })).toBe("?page=1&minAmountMinor=250000");
  });
});
