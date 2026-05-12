import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AttentionView } from "@/components/visualizations/AttentionView";
import { attentionSequence, type AttentionParams } from "@/lib/ml/attention";

const DEMO: AttentionParams = {
  embeddings: [
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  tokenLabels: ["t1", "t2", "t3"],
  wQ: [
    [1, 0],
    [0, 1],
  ],
  wK: [
    [0, 1],
    [1, 0],
  ],
  wV: [
    [1, 1],
    [1, -1],
  ],
};

function stepsOf() {
  return [...attentionSequence(DEMO)];
}

describe("AttentionView", () => {
  it("renders an SVG with role=img and phase-aware aria-label", () => {
    const begin = stepsOf()[0];
    const { getByRole } = render(<AttentionView snapshot={begin.snapshot} />);
    const svg = getByRole("img");
    expect(svg.getAttribute("aria-label")).toMatch(/Attention head, phase: begin/);
  });

  it("shows '(pending)' placeholders for matrices not yet computed", () => {
    const begin = stepsOf()[0];
    const { getAllByText } = render(<AttentionView snapshot={begin.snapshot} />);
    // Q, K, V, scaled-scores, attention, output — six pending placeholders at begin.
    expect(getAllByText("(pending)").length).toBeGreaterThanOrEqual(6);
  });

  it("renders the embeddings matrix from the first step", () => {
    const begin = stepsOf()[0];
    const { container } = render(<AttentionView snapshot={begin.snapshot} />);
    // 3 tokens × 2 dims = 6 cells in the X matrix.
    const cells = Array.from(container.querySelectorAll("rect"));
    expect(cells.length).toBeGreaterThanOrEqual(6);
  });

  it("after project-q, Q matrix is no longer a placeholder", () => {
    const steps = stepsOf();
    const projectQ = steps.find((s) => s.kind === "project-q");
    const { queryAllByText } = render(<AttentionView snapshot={projectQ!.snapshot} />);
    // X and Q both rendered → 5 pendings remain (K, V, scores, attention, output)
    expect(queryAllByText("(pending)").length).toBe(5);
  });

  it("renders the attention heatmap after softmax", () => {
    const steps = stepsOf();
    const softmax = steps.find((s) => s.kind === "softmax");
    const { container, queryAllByText } = render(<AttentionView snapshot={softmax!.snapshot} />);
    // attention matrix replaced its '(pending)' placeholder
    expect(queryAllByText("(pending)").length).toBeLessThan(6);
    // Heatmap cells use fill-opacity to encode intensity.
    const opacityCells = Array.from(container.querySelectorAll("rect[fill-opacity]"));
    expect(opacityCells.length).toBeGreaterThan(0);
  });

  it("highlightQueryIndex puts a strong stroke on the selected attention row", () => {
    const steps = stepsOf();
    const softmax = steps.find((s) => s.kind === "softmax");
    const { container } = render(
      <AttentionView snapshot={softmax!.snapshot} highlightQueryIndex={1} />,
    );
    // Highlight stroke uses --bar-swap-stroke and strokeWidth=2.
    const strongCells = Array.from(
      container.querySelectorAll("rect[stroke='var(--bar-swap-stroke)']"),
    );
    expect(strongCells.length).toBeGreaterThan(0);
  });

  it("renders for the 'done' phase without crashing", () => {
    const steps = stepsOf();
    const done = steps.at(-1);
    const { getByRole } = render(<AttentionView snapshot={done!.snapshot} />);
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/done/);
  });
});
