import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BSTSearchViz } from "@/components/visualizations/BSTSearchViz";

describe("BSTSearchViz", () => {
  it("renders the toolbar, target list, and counters", () => {
    render(<BSTSearchViz />);
    expect(screen.getByRole("toolbar", { name: /Playback/ })).toBeInTheDocument();
    expect(screen.getByText(/Searching for/)).toBeInTheDocument();
    expect(screen.getByText(/Comparisons/)).toBeInTheDocument();
    expect(screen.getByText(/Found/)).toBeInTheDocument();
    expect(screen.getByText(/Misses/)).toBeInTheDocument();
  });

  it("starts with all counters at zero and an idle prompt", () => {
    render(<BSTSearchViz />);
    const dl = screen.getByText(/Misses/).closest("dl");
    expect(dl).not.toBeNull();
    expect(dl!.textContent).toMatch(/Comparisons\s*0/);
    expect(dl!.textContent).toMatch(/Found\s*0/);
    expect(dl!.textContent).toMatch(/Misses\s*0/);
    expect(screen.getByText(/Idle — press play or step forward\./)).toBeInTheDocument();
  });

  it("step forward eventually advances the Comparisons counter", async () => {
    render(<BSTSearchViz />);
    const stepForward = screen.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 5; i++) {
      await userEvent.click(stepForward);
      const dl = screen.getByText(/Misses/).closest("dl");
      if (dl && /Comparisons\s*[1-9]/.test(dl.textContent ?? "")) return;
    }
    throw new Error("Comparisons counter never advanced");
  });

  it("renders the pre-built tree on first paint", () => {
    const { container } = render(<BSTSearchViz />);
    // 12 nodes in the curated build sequence.
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(12);
  });
});
