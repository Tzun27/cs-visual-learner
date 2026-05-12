import { gradientDescentLines } from "./gradientDescent.snippet";
import type { GradientDescentSnapshot, GradientDescentStep } from "./types";

export type GradientDescentParams = {
  readonly start: readonly [number, number];
  readonly learningRate: number;
  readonly maxSteps: number;
  readonly tolerance: number;
};

/**
 * Asymmetric quadratic bowl `f(w1, w2) = w1² + 3·w2²`.
 *
 * Chosen because:
 * - It's convex with a unique minimum at the origin — convergence is well-defined.
 * - The 3× weighting on w2 makes the contours elliptical, so the gradient-descent
 *   trajectory bends visibly toward the minor axis instead of running straight down.
 */
export function bowlLoss(w1: number, w2: number): number {
  return w1 * w1 + 3 * w2 * w2;
}

export function bowlGradient(w1: number, w2: number): readonly [number, number] {
  return [2 * w1, 6 * w2];
}

/**
 * Vanilla gradient descent on the bowl loss. Emits a step per logical action:
 * `begin` once at start, then per-iteration `compute-gradient` + (`apply-update`
 * or terminal `converged`), and finally `done` if max-steps is reached without
 * convergence.
 *
 * Every snapshot is a fresh object literal (no shared mutable references), so
 * step-back replay through history can't mutate earlier state.
 */
export function* gradientDescentSequence(
  params: GradientDescentParams,
): Generator<GradientDescentStep, void, void> {
  const { start, learningRate, maxSteps, tolerance } = params;
  let w1 = start[0];
  let w2 = start[1];
  const trajectory: Array<readonly [number, number]> = [[w1, w2]];

  yield {
    kind: "begin",
    snapshot: snapshotOf(w1, w2, trajectory),
    codeLines: gradientDescentLines.begin,
  };

  for (let i = 0; i < maxSteps; i++) {
    const [gw1, gw2] = bowlGradient(w1, w2);
    const gradientNorm = Math.hypot(gw1, gw2);

    yield {
      kind: "compute-gradient",
      gradient: [gw1, gw2],
      gradientNorm,
      snapshot: snapshotOf(w1, w2, trajectory),
      codeLines: gradientDescentLines.computeGradient,
    };

    if (gradientNorm < tolerance) {
      yield {
        kind: "converged",
        gradient: [gw1, gw2],
        gradientNorm,
        snapshot: snapshotOf(w1, w2, trajectory),
        codeLines: gradientDescentLines.converged,
      };
      return;
    }

    w1 -= learningRate * gw1;
    w2 -= learningRate * gw2;
    trajectory.push([w1, w2]);

    yield {
      kind: "apply-update",
      snapshot: snapshotOf(w1, w2, trajectory),
      codeLines: gradientDescentLines.applyUpdate,
    };
  }

  yield {
    kind: "done",
    snapshot: snapshotOf(w1, w2, trajectory),
    codeLines: gradientDescentLines.maxSteps,
  };
}

function snapshotOf(
  w1: number,
  w2: number,
  trajectory: ReadonlyArray<readonly [number, number]>,
): GradientDescentSnapshot {
  return { params: [w1, w2], trajectory: trajectory.slice() };
}
