const GROUPED_MONEY = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;
const PLAIN_MONEY = /^\d+(?:\.\d{1,2})?$/;

export type MoneyParseResult =
  | { ok: true; amountMinor: number }
  | { ok: false; message: string };

export function parseMoneyInput(value: string, allowZero = false): MoneyParseResult {
  const input = value.trim();
  if (!input) return { ok: false, message: "Enter an amount." };
  if (!(input.includes(",") ? GROUPED_MONEY : PLAIN_MONEY).test(input)) {
    return { ok: false, message: "Use a valid amount with no more than 2 decimal places." };
  }
  const normalized = input.replaceAll(",", "");
  const [whole, fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, message: "This amount is too large." };
  }
  if (minor === 0n && !allowZero) {
    return { ok: false, message: "Amount must be greater than zero." };
  }
  return { ok: true, amountMinor: Number(minor) };
}

export function formatMoney(
  amountMinor: number,
  currency = "NGN",
  options: { compact?: boolean; sign?: boolean } = {},
) {
  const amount = amountMinor / 100;
  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: options.compact ? "compact" : "standard",
    minimumFractionDigits: options.compact ? 0 : 2,
    maximumFractionDigits: options.compact ? 1 : 2,
  }).format(Math.abs(amount));
  if (options.sign && amountMinor !== 0) return `${amountMinor > 0 ? "+" : "−"}${formatted}`;
  return amountMinor < 0 ? `−${formatted}` : formatted;
}

export function moneyInputToMinor(value: string, allowZero = false) {
  const result = parseMoneyInput(value, allowZero);
  if (!result.ok) throw new Error(result.message);
  return result.amountMinor;
}
