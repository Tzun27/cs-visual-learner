import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ArrayBars, type Highlight } from "@/components/visualizations/ArrayBars";

describe("ArrayBars", () => {
  it("renders one rect per value", () => {
    const { container } = render(<ArrayBars array={[3, 1, 4, 1, 5]} />);
    expect(container.querySelectorAll("rect")).toHaveLength(5);
  });

  it("renders no bars but a valid SVG for an empty array", () => {
    const { container } = render(<ArrayBars array={[]} />);
    expect(container.querySelectorAll("rect")).toHaveLength(0);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("describes highlighted positions in aria-label", () => {
    const highlights: Highlight[] = [
      { index: 0, kind: "compare" },
      { index: 2, kind: "swap" },
    ];
    const { getByRole } = render(<ArrayBars array={[5, 4, 3]} highlights={highlights} />);
    const label = getByRole("img").getAttribute("aria-label") ?? "";
    expect(label).toMatch(/3 values/);
    expect(label).toMatch(/position 0 being compared/);
    expect(label).toMatch(/position 2 being swapped/);
  });

  it("uses the announced 'awaiting action' label when no highlights are passed", () => {
    const { getByRole } = render(<ArrayBars array={[1, 2]} />);
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/awaiting action/);
  });

  it("scales heights against the provided max prop", () => {
    const { container } = render(<ArrayBars array={[5, 10]} max={10} />);
    const rects = container.querySelectorAll("rect");
    const h0 = Number(rects[0].getAttribute("height"));
    const h1 = Number(rects[1].getAttribute("height"));
    expect(h1).toBeGreaterThan(h0);
    // 5 and 10 — second should be roughly twice the first.
    expect(h1 / h0).toBeCloseTo(2, 0);
  });

  it("draws a swap indicator line for swap highlights", () => {
    const { container } = render(
      <ArrayBars array={[1, 2]} highlights={[{ index: 0, kind: "swap" }]} />,
    );
    expect(container.querySelectorAll("line").length).toBeGreaterThan(0);
  });

  it("draws a pivot indicator dot for pivot highlights", () => {
    const { container } = render(
      <ArrayBars array={[1, 2, 3]} highlights={[{ index: 1, kind: "pivot" }]} />,
    );
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(0);
  });
});
