import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./ui-kit";

describe("EmptyState", () => {
  it("runs an in-page action callback", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        title="No income sources yet"
        description="Add the ways money usually comes in."
        action={{ label: "Add income source", onClick }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /add income source/i }),
    );
    expect(onClick).toHaveBeenCalledOnce();
  });
});
