import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { financeApi } from "@/lib/api";
import type { Transaction } from "@/lib/api/types";
import { AccountActivity } from "./resource-detail";

const transaction = (id: string): Transaction => ({
  _id: id,
  type: "income",
  amountMinor: 100000,
  description: `Transaction ${id}`,
  status: "posted",
});

function renderActivity(accountId = "a") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <AccountActivity key={accountId} accountId={accountId} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    switchAccount(id: string) {
      view.rerender(
        <QueryClientProvider client={client}>
          <AccountActivity key={id} accountId={id} />
        </QueryClientProvider>,
      );
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("account activity", () => {
  it("shows a full first page, requests the next page, and resets when the account changes", async () => {
    const pendingB = Promise.withResolvers<Awaited<ReturnType<typeof financeApi.transactions>>>();
    const request = vi.spyOn(financeApi, "transactions").mockImplementation(async (params) => {
      if (params.accountId === "b") return pendingB.promise;
      const page = Number(params.page);
      return {
        items: page === 1
          ? Array.from({ length: 20 }, (_, index) => transaction(String(index + 1)))
          : [transaction("21")],
        pagination: { page, limit: 20, total: 21, pages: 2 },
      };
    });
    const view = renderActivity();
    expect(screen.queryByText("No account activity yet.")).not.toBeInTheDocument();
    await screen.findByText("Transaction 20");
    expect(screen.getAllByRole("link")).toHaveLength(20);
    expect(request).toHaveBeenCalledWith({
      accountId: "a", page: 1, limit: 20,
      sortBy: "transactionDate", sortOrder: "desc",
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Transaction 21");
    expect(screen.queryByText("Transaction 1")).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ accountId: "a", page: 2 }));

    view.switchAccount("b");
    expect(screen.queryByText("Transaction 21")).not.toBeInTheDocument();
    expect(screen.queryByText("No account activity yet.")).not.toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ accountId: "b", page: 1 })));
    pendingB.resolve({ items: [transaction("b1")], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    await screen.findByText("Transaction b1");
  });

  it("shows empty results and offers retry after a failed request", async () => {
    const request = vi.spyOn(financeApi, "transactions")
      .mockRejectedValueOnce(new Error("Activity unavailable"))
      .mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
    renderActivity();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("No account activity yet.");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("filters account transactions and resets pagination when filters change", async () => {
    const request = vi.spyOn(financeApi, "transactions").mockImplementation(async (params) => ({
      items: [transaction(`${params.page}-${params.search || "all"}`)],
      pagination: { page: Number(params.page), limit: 20, total: 40, pages: 2 },
    }));
    renderActivity();
    await screen.findByText("Transaction 1-all");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Transaction 2-all");

    fireEvent.change(screen.getByPlaceholderText("Search descriptions"), { target: { value: "groceries" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "expense" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-09-30" } });
    fireEvent.change(screen.getByLabelText("Minimum amount"), { target: { value: "1,000.00" } });
    fireEvent.change(screen.getByLabelText("Maximum amount"), { target: { value: "2,000.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await screen.findByText("Transaction 1-groceries");
    expect(request).toHaveBeenLastCalledWith({
      accountId: "a", page: 1, limit: 20,
      sortBy: "transactionDate", sortOrder: "desc",
      search: "groceries", type: "expense",
      dateFrom: "2026-09-01", dateTo: "2026-09-30",
      minAmountMinor: 100000, maxAmountMinor: 200000,
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await screen.findByText("Transaction 1-all");
    expect(request).toHaveBeenLastCalledWith({
      accountId: "a", page: 1, limit: 20,
      sortBy: "transactionDate", sortOrder: "desc",
    });
  });
});
