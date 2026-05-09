import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortingViz } from "@/components/visualizations/SortingViz";

describe("SortingViz", () => {
  it("renders the controls toolbar and counters", () => {
    render(<SortingViz algorithm="bubble" initialSize={8} />);
    expect(screen.getByRole("toolbar", { name: /Playback/ })).toBeInTheDocument();
    expect(screen.getByText(/Comparisons/)).toBeInTheDocument();
    expect(screen.getByText(/Swaps/)).toBeInTheDocument();
  });

  it("starts with all counters at zero and status 'idle'", () => {
    render(<SortingViz algorithm="bubble" initialSize={6} />);
    const dl = screen.getByText(/Status/).closest("dl");
    expect(dl).not.toBeNull();
    expect(dl!.textContent).toMatch(/Comparisons\s*0/);
    expect(dl!.textContent).toMatch(/Swaps\s*0/);
    expect(dl!.textContent).toMatch(/idle/i);
  });

  it("step forward advances comparison counter", async () => {
    render(<SortingViz algorithm="bubble" initialSize={6} />);
    await userEvent.click(screen.getByRole("button", { name: /Step forward/ }));
    const dl = screen.getByText(/Status/).closest("dl");
    expect(dl!.textContent).toMatch(/Comparisons\s*1/);
  });

  it("renders merge sort algorithm via the registry", () => {
    render(<SortingViz algorithm="merge" initialSize={8} />);
    expect(screen.getByRole("toolbar", { name: /Playback/ })).toBeInTheDocument();
  });

  it("renders the Python code panel for merge sort", () => {
    render(<SortingViz algorithm="merge" initialSize={8} />);
    expect(screen.getByRole("region", { name: /Merge Sort pseudocode/ })).toBeInTheDocument();
  });

  it("highlights the merge entry lines after stepping into the first merge", async () => {
    const { container } = render(<SortingViz algorithm="merge" initialSize={4} />);
    // Two recursive sort() calls produce no yields for length-1 ranges, so the
    // very first emitted step is the 'range' marker for the inner-most merge.
    await userEvent.click(screen.getByRole("button", { name: /Step forward/ }));
    const highlighted = container.querySelectorAll("[data-highlighted='true']");
    const lines = Array.from(highlighted).map((el) => el.getAttribute("data-line"));
    expect(lines).toEqual(["17", "18", "19"]);
  });
});
