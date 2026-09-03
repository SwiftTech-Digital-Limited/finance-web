import { describe, expect, it } from "vitest";
import { createIdempotencyKey, createIntentKeyStore } from "./idempotency";

describe("idempotency intent keys", () => {
  it("generates a fresh key for each intent", () => {
    expect(createIdempotencyKey()).not.toBe(createIdempotencyKey());
  });
  it("reuses one key for retries and resets for a new intent", () => {
    const store = createIntentKeyStore();
    const first = store.get();
    expect(store.get()).toBe(first);
    store.reset();
    expect(store.get()).not.toBe(first);
  });
});
