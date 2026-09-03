export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function createIntentKeyStore() {
  let key: string | null = null;
  return {
    get: () => (key ??= createIdempotencyKey()),
    reset: () => { key = null; },
  };
}
