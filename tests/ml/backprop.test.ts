import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { backpropSequence, forwardLoss, type BackpropParams } from "@/lib/ml/backprop";
import { backpropPython } from "@/lib/ml/backprop.snippet";
import type { BackpropStep, BackpropWeights } from "@/lib/ml/types";

const DEMO_PARAMS: BackpropParams = {
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

function run(params: BackpropParams): readonly BackpropStep[] {
  return [...backpropSequence(params)];
}

function lastStep(params: BackpropParams) {
  return run(params).at(-1);
}

describe("backpropSequence — step shape and ordering", () => {
  it("emits ten steps in the canonical order", () => {
    const steps = run(DEMO_PARAMS);
    expect(steps.map((s) => s.kind)).toEqual([
      "begin",
      "forward-hidden",
      "forward-hidden",
      "forward-output",
      "compute-loss",
      "backward-output",
      "backward-hidden",
      "backward-hidden",
      "apply-update",
      "done",
    ]);
  });

  it("forward-hidden steps come in index order (0 then 1) and so do backward-hidden", () => {
    const steps = run(DEMO_PARAMS);
    const fwd = steps.filter((s) => s.kind === "forward-hidden");
    const bwd = steps.filter((s) => s.kind === "backward-hidden");
    expect(fwd.map((s) => (s.kind === "forward-hidden" ? s.hiddenIndex : -1))).toEqual([0, 1]);
    expect(bwd.map((s) => (s.kind === "backward-hidden" ? s.hiddenIndex : -1))).toEqual([0, 1]);
  });
});

describe("backpropSequence — forward pass (hand-computed)", () => {
  // x=(1, 0.5), t=2 with the demo weights:
  //   h1 = max(0, 0.4 + 0.3 + 0.1) = 0.8
  //   h2 = max(0, -0.3 + 0.5 + 0.2) = 0.4
  //   y  = 0.5*0.8 + 0.8*0.4 + 0.1 = 0.82
  //   L  = 0.5*(0.82 - 2)^2         = 0.6962
  it("matches the hand-computed h1, h2, y, loss to 1e-9", () => {
    const last = lastStep(DEMO_PARAMS);
    if (!last) throw new Error("no steps");
    const a = last.snapshot.activations;
    expect(a.h1).toBeCloseTo(0.8, 9);
    expect(a.h2).toBeCloseTo(0.4, 9);
    expect(a.y).toBeCloseTo(0.82, 9);
    expect(last.snapshot.loss).toBeCloseTo(0.6962, 9);
  });

  it("forwardLoss helper agrees with forward-pass output of the generator", () => {
    const last = lastStep(DEMO_PARAMS);
    const helperLoss = forwardLoss(DEMO_PARAMS.inputs, DEMO_PARAMS.target, DEMO_PARAMS.weights);
    expect(helperLoss).toBeCloseTo(last?.snapshot.loss ?? NaN, 9);
  });
});

describe("backpropSequence — gradients (numerical check)", () => {
  function numericalGradient(
    params: BackpropParams,
    key: keyof BackpropWeights,
    eps = 1e-5,
  ): number {
    const wPlus: BackpropWeights = { ...params.weights, [key]: params.weights[key] + eps };
    const wMinus: BackpropWeights = { ...params.weights, [key]: params.weights[key] - eps };
    return (
      (forwardLoss(params.inputs, params.target, wPlus) -
        forwardLoss(params.inputs, params.target, wMinus)) /
      (2 * eps)
    );
  }

  it("matches forward-difference numerical gradients within 1e-4", () => {
    const steps = run(DEMO_PARAMS);
    const backwardH2 = steps.find((s) => s.kind === "backward-hidden" && s.hiddenIndex === 1);
    if (!backwardH2) throw new Error("no backward-hidden(1)");
    const g = backwardH2.snapshot.gradients;
    const keys: Array<keyof BackpropWeights> = [
      "w11",
      "w12",
      "b1",
      "w21",
      "w22",
      "b2",
      "v1",
      "v2",
      "c",
    ];
    const analyticByKey: Record<keyof BackpropWeights, number> = {
      w11: g.dLdw11!,
      w12: g.dLdw12!,
      b1: g.dLdb1!,
      w21: g.dLdw21!,
      w22: g.dLdw22!,
      b2: g.dLdb2!,
      v1: g.dLdv1!,
      v2: g.dLdv2!,
      c: g.dLdc!,
    };
    for (const key of keys) {
      const numeric = numericalGradient(DEMO_PARAMS, key);
      expect(analyticByKey[key]).toBeCloseTo(numeric, 4);
    }
  });
});

describe("backpropSequence — one step strictly decreases loss", () => {
  it("after the update, recomputed loss is lower than the original", () => {
    const last = lastStep(DEMO_PARAMS);
    if (!last) throw new Error("no steps");
    const oldLoss = last.snapshot.loss ?? NaN;
    const newLoss = forwardLoss(DEMO_PARAMS.inputs, DEMO_PARAMS.target, last.snapshot.weights);
    expect(newLoss).toBeLessThan(oldLoss);
  });
});

describe("backpropSequence — dead-ReLU branch", () => {
  // Pick weights that drive h1_pre < 0 — the ReLU is inactive, so dL/dh1_pre = 0
  // and the chain breaks at hidden 1. Hidden 2 still flows normally.
  const DEAD_RELU_PARAMS: BackpropParams = {
    inputs: [1.0, 1.0],
    target: 1.0,
    weights: {
      w11: -1.0,
      w12: -1.0,
      b1: 0.0,
      w21: 0.5,
      w22: 0.5,
      b2: 0.1,
      v1: 0.5,
      v2: 0.5,
      c: 0.0,
    },
    learningRate: 0.1,
  };

  it("zeroes out hidden-1 weight gradients when h1 is dead", () => {
    const last = lastStep(DEAD_RELU_PARAMS);
    if (!last) throw new Error("no steps");
    const g = last.snapshot.gradients;
    // h1 itself is exactly +0 (relu literal). Gradients can be -0 because they
    // come from `dLdy * v1 * 0` where dLdy is negative — IEEE 754 preserves the
    // sign of zero through multiplication. toBeCloseTo absorbs that signed-zero
    // ambiguity; we just care that the value is mathematically zero.
    expect(last.snapshot.activations.h1).toBe(0);
    expect(g.dLdh1Pre).toBeCloseTo(0, 12);
    expect(g.dLdw11).toBeCloseTo(0, 12);
    expect(g.dLdw12).toBeCloseTo(0, 12);
    expect(g.dLdb1).toBeCloseTo(0, 12);
  });

  it("still produces non-zero gradients on hidden-2 + output weights when h2 is alive", () => {
    const last = lastStep(DEAD_RELU_PARAMS);
    const g = last?.snapshot.gradients ?? {};
    expect(g.dLdh2Pre).not.toBe(0);
    expect(g.dLdv2).not.toBe(0);
    expect(g.dLdc).not.toBe(0);
  });
});

describe("backpropSequence — codeLines annotation", () => {
  const lineCount = backpropPython.split("\n").length;

  it("every step's codeLines references a real line in the snippet", () => {
    for (const s of run(DEMO_PARAMS)) {
      for (const ln of s.codeLines ?? []) {
        expect(ln).toBeGreaterThanOrEqual(1);
        expect(ln).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("forward-hidden(0) and forward-hidden(1) point at different lines (branch-level)", () => {
    const steps = run(DEMO_PARAMS);
    const f0 = steps.find((s) => s.kind === "forward-hidden" && s.hiddenIndex === 0)?.codeLines;
    const f1 = steps.find((s) => s.kind === "forward-hidden" && s.hiddenIndex === 1)?.codeLines;
    expect(f0).not.toEqual(f1);
  });

  it("backward-hidden(0) and backward-hidden(1) point at different lines (branch-level)", () => {
    const steps = run(DEMO_PARAMS);
    const b0 = steps.find((s) => s.kind === "backward-hidden" && s.hiddenIndex === 0)?.codeLines;
    const b1 = steps.find((s) => s.kind === "backward-hidden" && s.hiddenIndex === 1)?.codeLines;
    expect(b0).not.toEqual(b1);
  });
});

describe("backpropSequence — snapshot immutability", () => {
  it("mutating an earlier step's weights does not leak into later steps", () => {
    const steps = run(DEMO_PARAMS);
    const first = steps[0];
    // weights are readonly, but the JS object is mutable — simulate accidental mutation.
    (first.snapshot.weights as { w11: number }).w11 = 999;
    const last = steps.at(-1);
    expect(last?.snapshot.weights.w11).not.toBe(999);
  });
});

describe("backpropSequence — property-based", () => {
  const finite = () => fc.double({ min: -2, max: 2, noNaN: true });

  it("loss decreases (or stays equal under dead-ReLU) for any sane random init", () => {
    fc.assert(
      fc.property(
        finite(),
        finite(),
        finite(),
        finite(),
        finite(),
        fc.double({ min: 0.001, max: 0.1, noNaN: true }),
        (w11, w22, v1, v2, target, lr) => {
          const params: BackpropParams = {
            inputs: [1.0, 0.5],
            target,
            weights: { w11, w12: w11, b1: 0.1, w21: -w22, w22, b2: 0.0, v1, v2, c: 0.0 },
            learningRate: lr,
          };
          const last = lastStep(params);
          if (!last) return;
          const oldLoss = last.snapshot.loss ?? NaN;
          const newLoss = forwardLoss(params.inputs, params.target, last.snapshot.weights);
          // GD on a smooth surface decreases loss with small lr; ≤ allows the dead-ReLU
          // case where the update is a no-op.
          expect(newLoss).toBeLessThanOrEqual(oldLoss + 1e-9);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("analytical gradients agree with numerical gradients on random inputs", () => {
    fc.assert(
      fc.property(
        finite(),
        finite(),
        finite(),
        finite(),
        finite(),
        finite(),
        (w11, w22, v1, v2, x1, target) => {
          const params: BackpropParams = {
            inputs: [x1, 0.5],
            target,
            weights: { w11, w12: 0.6, b1: 0.1, w21: -0.3, w22, b2: 0.2, v1, v2, c: 0.1 },
            learningRate: 0.05,
          };
          const last = lastStep(params);
          const g = last?.snapshot.gradients ?? {};
          // Pick a representative key to check — v1 always flows (output linear).
          const eps = 1e-5;
          const wPlus = { ...params.weights, v1: params.weights.v1 + eps };
          const wMinus = { ...params.weights, v1: params.weights.v1 - eps };
          const numeric =
            (forwardLoss(params.inputs, target, wPlus) -
              forwardLoss(params.inputs, target, wMinus)) /
            (2 * eps);
          expect(g.dLdv1!).toBeCloseTo(numeric, 4);
        },
      ),
      { numRuns: 100 },
    );
  });
});
