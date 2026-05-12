import { backpropLines } from "./backprop.snippet";
import type {
  BackpropActivations,
  BackpropGradients,
  BackpropSnapshot,
  BackpropStep,
  BackpropWeights,
} from "./types";

export type BackpropParams = {
  readonly inputs: readonly [number, number];
  readonly target: number;
  readonly weights: BackpropWeights;
  readonly learningRate: number;
};

const relu = (x: number): number => (x > 0 ? x : 0);
const reluDeriv = (x: number): number => (x > 0 ? 1 : 0);

/**
 * Forward + backward + one weight update on a fixed 2 → 2 → 1 ReLU MLP with MSE loss.
 *
 * Emits ten steps. Every snapshot is a fresh object literal — step-back replay through
 * the history cannot mutate any earlier state.
 */
export function* backpropSequence(params: BackpropParams): Generator<BackpropStep, void, void> {
  const { inputs, target, weights: w0, learningRate } = params;
  const [x1, x2] = inputs;

  // ---- begin -------------------------------------------------------
  yield {
    kind: "begin",
    snapshot: snapshotOf(inputs, target, w0, {}, undefined, {}, "forward"),
    codeLines: backpropLines.begin,
  };

  // ---- forward: hidden 1 -------------------------------------------
  const h1Pre = w0.w11 * x1 + w0.w12 * x2 + w0.b1;
  const h1 = relu(h1Pre);
  yield {
    kind: "forward-hidden",
    hiddenIndex: 0,
    snapshot: snapshotOf(inputs, target, w0, { h1Pre, h1 }, undefined, {}, "forward"),
    codeLines: backpropLines.forwardHidden1,
  };

  // ---- forward: hidden 2 -------------------------------------------
  const h2Pre = w0.w21 * x1 + w0.w22 * x2 + w0.b2;
  const h2 = relu(h2Pre);
  yield {
    kind: "forward-hidden",
    hiddenIndex: 1,
    snapshot: snapshotOf(inputs, target, w0, { h1Pre, h1, h2Pre, h2 }, undefined, {}, "forward"),
    codeLines: backpropLines.forwardHidden2,
  };

  // ---- forward: output ---------------------------------------------
  const y = w0.v1 * h1 + w0.v2 * h2 + w0.c;
  yield {
    kind: "forward-output",
    snapshot: snapshotOf(inputs, target, w0, { h1Pre, h1, h2Pre, h2, y }, undefined, {}, "forward"),
    codeLines: backpropLines.forwardOutput,
  };

  // ---- loss --------------------------------------------------------
  const diff = y - target;
  const loss = 0.5 * diff * diff;
  yield {
    kind: "compute-loss",
    snapshot: snapshotOf(inputs, target, w0, { h1Pre, h1, h2Pre, h2, y }, loss, {}, "loss"),
    codeLines: backpropLines.computeLoss,
  };

  // ---- backward: output --------------------------------------------
  const dLdy = diff;
  const dLdv1 = dLdy * h1;
  const dLdv2 = dLdy * h2;
  const dLdc = dLdy;
  const gAfterOutput: BackpropGradients = { dLdy, dLdv1, dLdv2, dLdc };
  yield {
    kind: "backward-output",
    snapshot: snapshotOf(
      inputs,
      target,
      w0,
      { h1Pre, h1, h2Pre, h2, y },
      loss,
      gAfterOutput,
      "backward",
    ),
    codeLines: backpropLines.backwardOutput,
  };

  // ---- backward: hidden 1 ------------------------------------------
  const dLdh1Pre = dLdy * w0.v1 * reluDeriv(h1Pre);
  const dLdw11 = dLdh1Pre * x1;
  const dLdw12 = dLdh1Pre * x2;
  const dLdb1 = dLdh1Pre;
  const gAfterH1: BackpropGradients = {
    ...gAfterOutput,
    dLdh1Pre,
    dLdw11,
    dLdw12,
    dLdb1,
  };
  yield {
    kind: "backward-hidden",
    hiddenIndex: 0,
    snapshot: snapshotOf(
      inputs,
      target,
      w0,
      { h1Pre, h1, h2Pre, h2, y },
      loss,
      gAfterH1,
      "backward",
    ),
    codeLines: backpropLines.backwardHidden1,
  };

  // ---- backward: hidden 2 ------------------------------------------
  const dLdh2Pre = dLdy * w0.v2 * reluDeriv(h2Pre);
  const dLdw21 = dLdh2Pre * x1;
  const dLdw22 = dLdh2Pre * x2;
  const dLdb2 = dLdh2Pre;
  const gAfterH2: BackpropGradients = {
    ...gAfterH1,
    dLdh2Pre,
    dLdw21,
    dLdw22,
    dLdb2,
  };
  yield {
    kind: "backward-hidden",
    hiddenIndex: 1,
    snapshot: snapshotOf(
      inputs,
      target,
      w0,
      { h1Pre, h1, h2Pre, h2, y },
      loss,
      gAfterH2,
      "backward",
    ),
    codeLines: backpropLines.backwardHidden2,
  };

  // ---- apply update ------------------------------------------------
  const w1: BackpropWeights = {
    w11: w0.w11 - learningRate * dLdw11,
    w12: w0.w12 - learningRate * dLdw12,
    b1: w0.b1 - learningRate * dLdb1,
    w21: w0.w21 - learningRate * dLdw21,
    w22: w0.w22 - learningRate * dLdw22,
    b2: w0.b2 - learningRate * dLdb2,
    v1: w0.v1 - learningRate * dLdv1,
    v2: w0.v2 - learningRate * dLdv2,
    c: w0.c - learningRate * dLdc,
  };
  yield {
    kind: "apply-update",
    snapshot: snapshotOf(inputs, target, w1, { h1Pre, h1, h2Pre, h2, y }, loss, gAfterH2, "update"),
    codeLines: backpropLines.applyUpdate,
  };

  // ---- done --------------------------------------------------------
  yield {
    kind: "done",
    snapshot: snapshotOf(inputs, target, w1, { h1Pre, h1, h2Pre, h2, y }, loss, gAfterH2, "done"),
    codeLines: backpropLines.done,
  };
}

/**
 * Convenience: run forward only and return the loss for a given (inputs, target, weights).
 * Used by tests for numerical-gradient checks.
 */
export function forwardLoss(
  inputs: readonly [number, number],
  target: number,
  w: BackpropWeights,
): number {
  const h1 = relu(w.w11 * inputs[0] + w.w12 * inputs[1] + w.b1);
  const h2 = relu(w.w21 * inputs[0] + w.w22 * inputs[1] + w.b2);
  const y = w.v1 * h1 + w.v2 * h2 + w.c;
  const diff = y - target;
  return 0.5 * diff * diff;
}

function snapshotOf(
  inputs: readonly [number, number],
  target: number,
  weights: BackpropWeights,
  activations: BackpropActivations,
  loss: number | undefined,
  gradients: BackpropGradients,
  phase: BackpropSnapshot["phase"],
): BackpropSnapshot {
  return {
    inputs: [inputs[0], inputs[1]],
    target,
    weights: { ...weights },
    activations: { ...activations },
    loss,
    gradients: { ...gradients },
    phase,
  };
}
