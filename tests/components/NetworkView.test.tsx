import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { NetworkView } from "@/components/visualizations/NetworkView";
import { backpropSequence, type BackpropParams } from "@/lib/ml/backprop";
import type { BackpropSnapshot } from "@/lib/ml/types";

const DEMO: BackpropParams = {
  inputs: [1.0, 0.5],
  target: 2.0,
  weights: {
    w11: 0.4,
    w12: 0.6,
    b1: 0.1,
    w21: -0.3,
    w22: 1.0,
    b2: 0.2,
    v1: 0.5,
    v2: 0.8,
    c: 0.1,
  },
  learningRate: 0.1,
};

function stepsOf(p: BackpropParams = DEMO) {
  return [...backpropSequence(p)];
}

describe("NetworkView", () => {
  it("renders an SVG with role=img and a phase-aware aria-label", () => {
    const steps = stepsOf();
    const begin = steps[0];
    const { getByRole } = render(<NetworkView snapshot={begin.snapshot} />);
    const svg = getByRole("img");
    expect(svg.getAttribute("aria-label")).toMatch(/forward pass/);
  });

  it("renders all five nodes and six trainable edges", () => {
    const { container } = render(<NetworkView snapshot={stepsOf()[0].snapshot} />);
    expect(container.querySelectorAll("circle").length).toBe(5);
    expect(container.querySelectorAll("line").length).toBe(6);
  });

  it("renders the loss readout once it's been computed (phase=loss or later)", () => {
    const steps = stepsOf();
    const lossStep = steps.find((s) => s.kind === "compute-loss");
    if (!lossStep) throw new Error("no compute-loss step");
    const { getByText } = render(<NetworkView snapshot={lossStep.snapshot} />);
    expect(getByText(/L = /)).toBeInTheDocument();
  });

  it("omits the loss readout during the forward-only phase", () => {
    const begin = stepsOf()[0];
    const { queryByText } = render(<NetworkView snapshot={begin.snapshot} />);
    expect(queryByText(/L = /)).not.toBeInTheDocument();
  });

  it("renders node-gradient labels only in backward/update/done phases", () => {
    const steps = stepsOf();
    const forwardStep = steps.find((s) => s.kind === "forward-output");
    const backwardStep = steps.find((s) => s.kind === "backward-output");
    if (!forwardStep || !backwardStep) throw new Error("missing step");
    const forward = render(<NetworkView snapshot={forwardStep.snapshot} />);
    expect(forward.queryByText(/∂L\/∂y/)).not.toBeInTheDocument();
    forward.unmount();
    const backward = render(<NetworkView snapshot={backwardStep.snapshot} />);
    expect(backward.getByText(/∂L\/∂y/)).toBeInTheDocument();
  });

  it("honors all highlight kinds without crashing", () => {
    const begin = stepsOf()[0];
    const { container } = render(
      <NetworkView
        snapshot={begin.snapshot}
        highlights={[
          { target: "node", id: "x1", kind: "active" },
          { target: "node", id: "h1", kind: "current" },
          { target: "node", id: "y", kind: "updated" },
          { target: "edge", id: "w11", kind: "active" },
          { target: "edge", id: "v1", kind: "current" },
          { target: "edge", id: "v2", kind: "updated" },
        ]}
      />,
    );
    // 5 nodes are always rendered (circles); same for 6 trainable edges (lines).
    expect(container.querySelectorAll("circle").length).toBe(5);
    expect(container.querySelectorAll("line").length).toBe(6);
  });

  it("displays the target value top-left", () => {
    const begin = stepsOf()[0];
    const { getByText } = render(<NetworkView snapshot={begin.snapshot} />);
    expect(getByText(/t = 2/)).toBeInTheDocument();
  });

  it("renders cleanly for the 'done' phase snapshot", () => {
    const steps = stepsOf();
    const done = steps.at(-1);
    if (!done) throw new Error("no done step");
    const { getByRole } = render(<NetworkView snapshot={done.snapshot} />);
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/done/);
  });

  it("renders for an arbitrary handcrafted snapshot (no generator dependency)", () => {
    const synthetic: BackpropSnapshot = {
      inputs: [0, 0],
      target: 0,
      weights: {
        w11: 0,
        w12: 0,
        b1: 0,
        w21: 0,
        w22: 0,
        b2: 0,
        v1: 0,
        v2: 0,
        c: 0,
      },
      activations: {},
      gradients: {},
      phase: "forward",
    };
    const { getByRole } = render(<NetworkView snapshot={synthetic} />);
    expect(getByRole("img")).toBeInTheDocument();
  });
});
