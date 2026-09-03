import { describe, expect, it } from "vitest";
import { formatPercentage, isCompletePercentageSplit, parsePercentageInput } from "./percentage";

describe("percentage basis points", () => {
  it.each([["55", 5500], ["12.5", 1250], ["0.01", 1], ["100", 10000]])("parses %s", (input, bps) => {
    expect(parsePercentageInput(input)).toBe(bps);
  });
  it.each(["", "-1", "10.123", "100.01", "word"])("rejects %s", (input) => {
    expect(parsePercentageInput(input)).toBeNull();
  });
  it("requires an exact 10000 bps split", () => {
    expect(isCompletePercentageSplit([{ percentageBps: 5500 }, { percentageBps: 4500 }])).toBe(true);
    expect(isCompletePercentageSplit([{ percentageBps: 9999 }])).toBe(false);
  });
  it("formats decimal percentages", () => {
    expect(formatPercentage(1250)).toBe("12.5%");
  });
});
