import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BSTDeleteViz } from "@/components/visualizations/BSTDeleteViz";

describe("BSTDeleteViz", () => {
  it("renders the toolbar, target list, and counters", () => {
    render(<BSTDeleteViz />);
    expect(screen.getByRole("toolbar", { name: /Playback/ })).toBeInTheDocument();
    expect(screen.getByText(/Deleting/)).toBeInTheDocument();
    expect(screen.getByText(/Comparisons/)).toBeInTheDocument();
    expect(screen.getByText(/Successor walks/)).toBeInTheDocument();
    expect(screen.getByText(/Removed/)).toBeInTheDocument();
  });

  it("starts with all counters at zero and an idle prompt", () => {
    render(<BSTDeleteViz />);
    const dl = screen.getByText(/Removed/).closest("dl");
    expect(dl).not.toBeNull();
    expect(dl!.textContent).toMatch(/Comparisons\s*0/);
    expect(dl!.textContent).toMatch(/Successor walks\s*0/);
    expect(dl!.textContent).toMatch(/Removed\s*0/);
    expect(screen.getByText(/Idle — press play or step forward\./)).toBeInTheDocument();
  });

  it("step forward eventually advances the Comparisons counter", async () => {
    render(<BSTDeleteViz />);
    const stepForward = screen.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 5; i++) {
      await userEvent.click(stepForward);
      const dl = screen.getByText(/Removed/).closest("dl");
      if (dl && /Comparisons\s*[1-9]/.test(dl.textContent ?? "")) return;
    }
    throw new Error("Comparisons counter never advanced");
  });

  it("renders the pre-built tree on first paint", () => {
    const { container } = render(<BSTDeleteViz />);
    // 12 nodes in the curated build sequence.
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(12);
  });

  it("the section is wrapped in a region with a distinct accessible name", () => {
    render(<BSTDeleteViz />);
    expect(screen.getByRole("region", { name: /Binary search tree delete/ })).toBeInTheDocument();
  });
});
