import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TreeView } from "@/components/visualizations/TreeView";
import type { BstSnapshot } from "@/lib/dataStructures/types";

const SAMPLE: BstSnapshot = {
  rootId: 0,
  nodes: [
    { id: 0, value: 5, leftId: 1, rightId: 2 },
    { id: 1, value: 3, leftId: null, rightId: null },
    { id: 2, value: 7, leftId: null, rightId: null },
  ],
};

describe("TreeView", () => {
  it("renders empty tree without crashing and labels it as empty", () => {
    const { getByRole } = render(<TreeView tree={{ nodes: [], rootId: null }} />);
    const svg = getByRole("img");
    expect(svg.getAttribute("aria-label")).toMatch(/Empty tree/);
  });

  it("renders one circle per node and prints each value as text", () => {
    const { container } = render(<TreeView tree={SAMPLE} />);
    expect(container.querySelectorAll("circle")).toHaveLength(SAMPLE.nodes.length);
    const text = container.textContent ?? "";
    for (const n of SAMPLE.nodes) expect(text).toContain(String(n.value));
  });

  it("describes node count in aria-label when no highlights are present", () => {
    const { getByRole } = render(<TreeView tree={SAMPLE} />);
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/3 nodes/);
  });

  it("includes highlight context (kind + value) in aria-label", () => {
    const { getByRole } = render(
      <TreeView tree={SAMPLE} highlights={[{ nodeId: 1, kind: "cursor" }]} />,
    );
    const label = getByRole("img").getAttribute("aria-label") ?? "";
    expect(label).toMatch(/node 3 being compared/);
  });

  it("draws an edge for every parent→child link", () => {
    const { container } = render(<TreeView tree={SAMPLE} />);
    // root has 2 children → 2 edges.
    expect(container.querySelectorAll("line")).toHaveLength(2);
  });
});
