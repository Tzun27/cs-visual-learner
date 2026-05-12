export type StepBase = { readonly codeLines?: readonly number[] };

/* ------------------------------------------------------------------ *
 * Gradient descent                                                   *
 * ------------------------------------------------------------------ */

export type GradientDescentSnapshot = {
  /** Current parameter vector (w1, w2). */
  readonly params: readonly [number, number];
  /** Full path so far, including the starting point. */
  readonly trajectory: ReadonlyArray<readonly [number, number]>;
};

export type GradientDescentStep =
  | (StepBase & {
      kind: "begin";
      snapshot: GradientDescentSnapshot;
    })
  | (StepBase & {
      kind: "compute-gradient";
      gradient: readonly [number, number];
      gradientNorm: number;
      snapshot: GradientDescentSnapshot;
    })
  | (StepBase & {
      kind: "apply-update";
      snapshot: GradientDescentSnapshot;
    })
  | (StepBase & {
      kind: "converged";
      gradient: readonly [number, number];
      gradientNorm: number;
      snapshot: GradientDescentSnapshot;
    })
  | (StepBase & {
      kind: "done";
      snapshot: GradientDescentSnapshot;
    });
