import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddMoneyPage } from "./add-money-page";
import { financeApi } from "@/lib/api";

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(
      (listener) => {
        window.addEventListener("popstate", listener);
        return () => window.removeEventListener("popstate", listener);
      },
      () => window.location.search,
    )),
  };
});
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  listResource: vi.fn(async (resource: string) => ({ items: {
    accounts: [{ _id: "bank", name: "Bank" }, { _id: "cash", name: "Cash" }],
    buckets: [{ _id: "needs", name: "Needs" }, { _id: "savings", name: "Savings" }],
    categories: [{ _id: "food", name: "Food" }],
    "income-sources": [],
  }[resource] || [] })),
  financeApi: {
    postExpense: vi.fn(async () => ({ expense: { _id: "expense" }, resultingAccountBalanceMinor: 10000 })),
    transfer: vi.fn(async () => ({})),
    reallocate: vi.fn(async () => ({})),
    previewIncome: vi.fn(async () => { throw new Error("Preview reached"); }),
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/add?flow=income&source=dashboard");
  const pushState = window.history.pushState.bind(window.history);
  // Next.js notifies useSearchParams when the native history API is used.
  vi.spyOn(window.history, "pushState").mockImplementation((...args) => {
    pushState(...args);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
});
afterEach(cleanup);
async function openForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AddMoneyPage /></QueryClientProvider>);
  await screen.findByRole("tab", { name: "Add income" });
  return userEvent.setup();
}
describe("activity tabs with React Compiler", () => {
  it.each([
    { tab: "Add expense", submit: "Add expense", api: "postExpense", fields: { "Pay from account": "bank", Category: "food", "Purpose bucket": "needs" }, payload: { accountId: "bank", categoryId: "food", bucketId: "needs" } },
    { tab: "Move money", submit: "Move money", api: "transfer", fields: { "From account": "bank", "To account": "cash" }, payload: { fromAccountId: "bank", toAccountId: "cash" } },
    { tab: "Change its purpose", submit: "Change purpose", api: "reallocate", fields: { "From bucket": "needs", "To bucket": "savings" }, payload: { fromBucketId: "needs", toBucketId: "savings" } },
  ] as const)("submits filled values after switching to $tab", async ({ tab, submit, api, fields, payload }) => {
    const user = await openForm();
    await user.click(screen.getByRole("tab", { name: tab }));
    await user.type(screen.getByPlaceholderText("0.00"), "123.45");
    for (const [label, value] of Object.entries(fields)) {
      await user.selectOptions(screen.getByLabelText(label), value);
    }
    await user.click(screen.getByRole("button", { name: submit }));
    await waitFor(() => expect(financeApi[api]).toHaveBeenCalled());
    expect(vi.mocked(financeApi[api]).mock.calls[0][0]).toMatchObject({ amountMinor: 12345, ...payload });
    expect(screen.queryByText("Enter an amount.")).not.toBeInTheDocument();
  });
  it("syncs the URL and preserves inputs when clicking the active tab", async () => {
    const user = await openForm();
    await user.click(screen.getByRole("tab", { name: "Move money" }));
    expect(new URLSearchParams(window.location.search).get("flow")).toBe("transfer");
    expect(new URLSearchParams(window.location.search).get("source")).toBe("dashboard");
    await user.type(screen.getByPlaceholderText("0.00"), "25");
    await user.click(screen.getByRole("tab", { name: "Move money" }));
    expect(screen.getByPlaceholderText("0.00")).toHaveValue("25");
    await user.click(screen.getByRole("tab", { name: "Add income" }));
    await user.type(screen.getByPlaceholderText("0.00"), "50");
    await user.selectOptions(screen.getByLabelText("Receiving account"), "bank");
    await user.click(screen.getByRole("button", { name: "Preview allocation" }));
    await waitFor(() => expect(financeApi.previewIncome).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 5000, accountId: "bank" })));
  });
});
