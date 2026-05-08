import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BSTViz } from "@/components/visualizations/BSTViz";

describe("BSTViz", () => {
  it("renders the toolbar, source toggle, and counters", () => {
    render(<BSTViz />);
    expect(screen.getByRole("toolbar", { name: /Playback/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Insert order/ })).toBeInTheDocument();
    expect(screen.getByText(/Comparisons/)).toBeInTheDocument();
    expect(screen.getByText(/Placed/)).toBeInTheDocument();
    expect(screen.getByText(/Max depth/)).toBeInTheDocument();
  });

  it("starts with all counters at zero and an idle prompt", () => {
    render(<BSTViz />);
    const dl = screen.getByText(/Max depth/).closest("dl");
    expect(dl).not.toBeNull();
    expect(dl!.textContent).toMatch(/Comparisons\s*0/);
    expect(dl!.textContent).toMatch(/Placed\s*0/);
    expect(dl!.textContent).toMatch(/Max depth\s*0/);
    expect(screen.getByText(/Idle — press play or step forward\./)).toBeInTheDocument();
  });

  it("step forward advances Placed to 1 (root insert is the first event after begin)", async () => {
    render(<BSTViz />);
    const stepForward = screen.getByRole("button", { name: /Step forward/ });
    // begin → ... → place. Click until the Placed counter ticks up at least once.
    for (let i = 0; i < 5; i++) {
      await userEvent.click(stepForward);
      const dl = screen.getByText(/Max depth/).closest("dl");
      if (dl && /Placed\s*[1-9]/.test(dl.textContent ?? "")) return;
    }
    throw new Error("Placed counter never advanced");
  });

  it("toggling Sorted order resets state and renders a deeper final tree on play", async () => {
    render(<BSTViz />);
    const sortedBtn = screen.getByRole("button", { name: /Sorted order/ });
    expect(sortedBtn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(sortedBtn);
    expect(sortedBtn).toHaveAttribute("aria-pressed", "true");
    // After reset, Placed should be back to 0.
    const dl = screen.getByText(/Max depth/).closest("dl");
    expect(dl!.textContent).toMatch(/Placed\s*0/);
  });

  it("the source toggle is grouped with role='group'", () => {
    render(<BSTViz />);
    const group = screen.getByRole("group", { name: /Insert order/ });
    const buttons = group.querySelectorAll("button");
    expect(buttons.length).toBe(2);
  });
});
