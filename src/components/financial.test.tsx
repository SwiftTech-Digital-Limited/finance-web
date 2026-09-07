import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountCard, AllocationBreakdown, TransactionRow } from "./financial";

describe("financial presentation", () => {
  it("renders matched and fixed allocation preview from server arrays", () => {
    render(
      <AllocationBreakdown
        preview={{
          amountMinor: 15000000,
          matchedRule: { name: "Lesson rule" },
          matchReason: "income source",
          fixedAllocations: [
            { bucketId: "a", bucketName: "Transport", amountMinor: 4000000 },
          ],
          percentageAllocations: [],
          distributableAmountMinor: 11000000,
          totalAllocatedMinor: 4000000,
          unallocatedAmountMinor: 11000000,
        }}
      />,
    );
    expect(screen.getByText("Lesson rule")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
    expect(screen.getByText("fixed")).toBeInTheDocument();
  });
  it("explains a no-rule preview", () => {
    render(
      <AllocationBreakdown
        preview={{
          amountMinor: 10000,
          matchedRule: null,
          fixedAllocations: [],
          percentageAllocations: [],
          distributableAmountMinor: 10000,
          totalAllocatedMinor: 0,
          unallocatedAmountMinor: 10000,
        }}
      />,
    );
    expect(screen.getByText("No allocation rule matched")).toBeInTheDocument();
    expect(screen.getByText(/remain unallocated/i)).toBeInTheDocument();
  });
  it("renders one logical transfer without spending semantics", () => {
    render(
      <TransactionRow
        linked={false}
        event={{
          _id: "1",
          type: "transfer_out",
          displayType: "transfer",
          amountMinor: 1100000,
          account: {
            _id: "a",
            name: "GTBank",
            type: "bank",
            openingBalanceMinor: 0,
          },
          counterpartAccount: {
            _id: "b",
            name: "Savings",
            type: "savings",
            openingBalanceMinor: 0,
          },
        }}
      />,
    );
    expect(screen.getByText("GTBank to Savings")).toBeInTheDocument();
    expect(screen.getByText(/not spending/i)).toBeInTheDocument();
  });
  it("renders reallocation as a purpose change", () => {
    render(
      <TransactionRow
        linked={false}
        event={{ _id: "r", eventKind: "reallocation", amountMinor: 500000 }}
      />,
    );
    expect(screen.getByText("Bucket reallocation")).toBeInTheDocument();
    expect(screen.getByText(/Purpose changed/i)).toBeInTheDocument();
  });
  it("keeps an excluded account's physical balance visible", () => {
    const card = render(
      <AccountCard
        account={{
          _id: "a",
          name: "GTBank",
          type: "bank",
          openingBalanceMinor: 500000,
          currentBalanceMinor: 500000,
          includeInNetWorth: false,
        }}
      />,
    );
    const accountCard = within(card.container);
    expect(accountCard.getByText("Excluded from total")).toBeInTheDocument();
    expect(accountCard.getByText("Physical balance")).toBeInTheDocument();
    expect(accountCard.getByText(/5,000\.00/)).toBeInTheDocument();
  });
});
