import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { optionalRuleMatchingFields, ruleValidationError } from "./rules-page";

describe("rule request validation", () => {
  it("omits unused nullable-looking fields for a less-than default rule", () => {
    expect(optionalRuleMatchingFields(true, "source-1", null, 40_000_000)).toEqual({
      maximumAmountMinor: 40_000_000,
    });
  });

  it("includes configured source and threshold fields", () => {
    expect(optionalRuleMatchingFields(false, "source-1", 10_000, 20_000)).toEqual({
      incomeSourceId: "source-1",
      minimumAmountMinor: 10_000,
      maximumAmountMinor: 20_000,
    });
  });

  it("extracts a backend issue for the matching field", () => {
    const error = new ApiError("VALIDATION_ERROR", "Invalid request", 400, [
      { path: ["percentageAllocations", 0, "percentageBps"], message: "Invalid percentage." },
    ]);
    expect(ruleValidationError(error, "percentageBps")).toBe("Invalid percentage.");
    expect(ruleValidationError(error, "name")).toBeUndefined();
  });
});
