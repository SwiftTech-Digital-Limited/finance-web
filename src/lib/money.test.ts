import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyInput } from "./money";

describe("money", () => {
  it.each([
    ["1", 100],
    ["1.2", 120],
    ["1.20", 120],
    ["1,250.05", 125005],
    ["500000", 50000000],
    ["0.01", 1],
  ])("parses %s exactly", (input, expected) => {
    expect(parseMoneyInput(input)).toEqual({ ok: true, amountMinor: expected });
  });
  it.each(["", "1.234", "-1", "1,00", "1,234,56", "abc", "0"])(
    "rejects %s",
    (input) => {
      expect(parseMoneyInput(input).ok).toBe(false);
    },
  );
  it("allows zero when explicitly requested", () => {
    expect(parseMoneyInput("0", true)).toEqual({ ok: true, amountMinor: 0 });
  });
  it("rejects unsafe integers", () => {
    expect(parseMoneyInput("900719925474099.92").ok).toBe(false);
  });
  it("formats minor units as naira", () => {
    expect(formatMoney(250000)).toContain("2,500.00");
  });
});
