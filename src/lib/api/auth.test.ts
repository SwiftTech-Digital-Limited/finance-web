import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./auth";
import { getAccessToken, setAccessToken } from "./client";

describe("session restoration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it("uses one rotating refresh request for concurrent restoration calls", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = vi.fn(async () => {
      await gate;
      return new Response(JSON.stringify({
        success: true,
        data: {
          user: { _id: "user-1", name: "Ada", email: "ada@example.com" },
          accessToken: "new-access-token",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = authApi.refresh();
    const second = authApi.refresh();
    release?.();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(firstResult).toBe(secondResult);
    expect(getAccessToken()).toBe("new-access-token");
  });
});
