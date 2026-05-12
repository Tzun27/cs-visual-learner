import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  bowlGradient,
  bowlLoss,
  gradientDescentSequence,
  type GradientDescentParams,
} from "@/lib/ml/gradientDescent";
import { gradientDescentPython } from "@/lib/ml/gradientDescent.snippet";
import type { GradientDescentStep } from "@/lib/ml/types";

function run(params: GradientDescentParams): readonly GradientDescentStep[] {
  return [...gradientDescentSequence(params)];
}

function defaultsFrom(
  start: readonly [number, number],
  overrides: Partial<GradientDescentParams> = {},
): GradientDescentParams {
  return {
    start,
    learningRate: 0.1,
    maxSteps: 50,
    tolerance: 1e-6,
    ...overrides,
  };
}

describe("bowlLoss / bowlGradient", () => {
  it("loss at the origin is zero", () => {
    expect(bowlLoss(0, 0)).toBe(0);
  });

  it("loss is convex away from origin in both axes", () => {
    expect(bowlLoss(1, 0)).toBe(1);
    expect(bowlLoss(0, 1)).toBe(3);
    expect(bowlLoss(2, 1)).toBe(7);
  });

  it("gradient matches the analytic form (2*w1, 6*w2)", () => {
    expect(bowlGradient(0, 0)).toEqual([0, 0]);
    expect(bowlGradient(1, 1)).toEqual([2, 6]);
    expect(bowlGradient(-2, 3)).toEqual([-4, 18]);
  });
});

describe("gradientDescentSequence — terminal states", () => {
  it("starting at the origin converges immediately on the first iteration", () => {
    const steps = run(defaultsFrom([0, 0]));
    const kinds = steps.map((s) => s.kind);
    expect(kinds).toEqual(["begin", "compute-gradient", "converged"]);
    const last = steps.at(-1);
    if (last?.kind !== "converged") throw new Error("expected converged");
    expect(last.gradientNorm).toBe(0);
  });

  it("converges away from origin within maxSteps for a well-chosen lr", () => {
    const steps = run(defaultsFrom([4, -3], { learningRate: 0.15, tolerance: 1e-4 }));
    const last = steps.at(-1);
    expect(last?.kind).toBe("converged");
    if (last?.kind !== "converged") return;
    expect(last.gradientNorm).toBeLessThan(1e-4);
  });

  it("emits 'done' (not 'converged') when maxSteps is reached without convergence", () => {
    const steps = run(defaultsFrom([5, 5], { learningRate: 0.01, maxSteps: 3, tolerance: 1e-6 }));
    const last = steps.at(-1);
    expect(last?.kind).toBe("done");
  });

  it("maxSteps = 0 yields begin + done immediately, no compute-gradient", () => {
    const steps = run(defaultsFrom([1, 1], { maxSteps: 0 }));
    expect(steps.map((s) => s.kind)).toEqual(["begin", "done"]);
  });
});

describe("gradientDescentSequence — trajectory invariants", () => {
  it("trajectory length equals (# apply-update steps) + 1", () => {
    const steps = run(defaultsFrom([3, 2], { learningRate: 0.1, maxSteps: 20, tolerance: 1e-5 }));
    const updates = steps.filter((s) => s.kind === "apply-update").length;
    const last = steps.at(-1);
    if (!last) throw new Error("no steps");
    expect(last.snapshot.trajectory.length).toBe(updates + 1);
  });

  it("loss strictly decreases on every apply-update with a well-chosen lr", () => {
    const steps = run(defaultsFrom([2, 1], { learningRate: 0.1, maxSteps: 30, tolerance: 1e-6 }));
    let prevLoss = bowlLoss(2, 1);
    for (const s of steps) {
      if (s.kind === "apply-update") {
        const [w1, w2] = s.snapshot.params;
        const next = bowlLoss(w1, w2);
        expect(next).toBeLessThan(prevLoss);
        prevLoss = next;
      }
    }
  });

  it("with lr = 0 the params never move (still emits one compute-gradient + done sequence)", () => {
    const steps = run(defaultsFrom([2, 1], { learningRate: 0, maxSteps: 5, tolerance: 1e-6 }));
    for (const s of steps) {
      expect(s.snapshot.params).toEqual([2, 1]);
    }
    const last = steps.at(-1);
    // norm(2,1)·grad = norm(4,6) > 1e-6 → never converges → maxSteps → done
    expect(last?.kind).toBe("done");
  });
});

describe("gradientDescentSequence — snapshot immutability", () => {
  it("mutating a yielded snapshot's trajectory does not affect later steps", () => {
    const steps = run(defaultsFrom([2, 1], { learningRate: 0.1, maxSteps: 5, tolerance: 1e-6 }));
    const first = steps[0];
    // trajectory is a readonly tuple array, but the array literal itself can be
    // attempted (TS would block, but JS at runtime cannot). Reassign into a mutable
    // local for the test:
    const mutableTrajectory = first.snapshot.trajectory as Array<readonly [number, number]>;
    mutableTrajectory.push([999, 999]);
    // Later step's trajectory must not contain the injected entry.
    const later = steps.at(-1);
    expect(later?.snapshot.trajectory).not.toContainEqual([999, 999]);
  });
});

describe("gradientDescentSequence — codeLines annotation", () => {
  const sourceLineCount = gradientDescentPython.split("\n").length;

  it("every step's codeLines references a real line in the snippet", () => {
    const steps = run(defaultsFrom([2, 1]));
    for (const s of steps) {
      for (const ln of s.codeLines ?? []) {
        expect(ln).toBeGreaterThanOrEqual(1);
        expect(ln).toBeLessThanOrEqual(sourceLineCount);
      }
    }
  });

  it("converged and done emit different code lines (different branches)", () => {
    const converged = run(defaultsFrom([0, 0])).at(-1);
    const maxedOut = run(defaultsFrom([5, 5], { maxSteps: 1, learningRate: 0.001 })).at(-1);
    expect(converged?.kind).toBe("converged");
    expect(maxedOut?.kind).toBe("done");
    expect(converged?.codeLines).not.toEqual(maxedOut?.codeLines);
  });
});

describe("gradientDescentSequence — property-based", () => {
  it("always terminates and either converges or hits maxSteps", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: -5, max: 5, noNaN: true }),
          fc.double({ min: -5, max: 5, noNaN: true }),
        ),
        fc.double({ min: 0.001, max: 0.3, noNaN: true }),
        fc.integer({ min: 1, max: 200 }),
        (start, lr, maxSteps) => {
          const steps = run({ start, learningRate: lr, maxSteps, tolerance: 1e-5 });
          const last = steps.at(-1);
          expect(last?.kind === "converged" || last?.kind === "done").toBe(true);

          // Trajectory length = update count + 1, regardless of terminal kind.
          const updates = steps.filter((s) => s.kind === "apply-update").length;
          expect(last?.snapshot.trajectory.length).toBe(updates + 1);
        },
      ),
      { numRuns: 200 },
    );
  });
});
