import { describe, expect, it } from "vitest";
import type { Account, IncomeSource } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import {
  incomeSourceDefaultAccountName,
  optionalDefaultAccountId,
  validationFieldError,
} from "./resource-manager";

const account = { _id: "account-1", name: "GTBank" } as Account;

describe("incomeSourceDefaultAccountName", () => {
  it("resolves an unpopulated account ID from the accounts response", () => {
    const source = { _id: "source-1", name: "Lessons", defaultAccountId: "account-1" } as IncomeSource;
    expect(incomeSourceDefaultAccountName(source, [account])).toBe("GTBank");
  });

  it("uses a populated default account directly", () => {
    const source = { _id: "source-1", name: "Lessons", defaultAccountId: account } as IncomeSource;
    expect(incomeSourceDefaultAccountName(source, [])).toBe("GTBank");
  });

  it("only shows None when no default account was configured", () => {
    const source = { _id: "source-1", name: "Lessons" } as IncomeSource;
    expect(incomeSourceDefaultAccountName(source, [account])).toBe("None");
  });
});

describe("income source form validation", () => {
  it("omits an optional default account instead of sending null", () => {
    expect(optionalDefaultAccountId("")).toBeUndefined();
    expect(optionalDefaultAccountId("account-1")).toBe("account-1");
  });

  it("maps backend validation issues to their field", () => {
    const error = new ApiError("VALIDATION_ERROR", "Invalid request", 400, [
      { path: ["defaultAccountId"], message: "Choose a valid account." },
    ]);
    expect(validationFieldError(error, "defaultAccountId")).toBe("Choose a valid account.");
    expect(validationFieldError(error, "name")).toBeUndefined();
  });
});
