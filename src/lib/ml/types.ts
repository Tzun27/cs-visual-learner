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

/* ------------------------------------------------------------------ *
 * Backprop                                                            *
 * ------------------------------------------------------------------ */

export type BackpropWeights = {
  readonly w11: number;
  readonly w12: number;
  readonly b1: number;
  readonly w21: number;
  readonly w22: number;
  readonly b2: number;
  readonly v1: number;
  readonly v2: number;
  readonly c: number;
};

/** Forward-pass activations. `undefined` means "not yet computed at this step". */
export type BackpropActivations = {
  readonly h1Pre?: number;
  readonly h1?: number;
  readonly h2Pre?: number;
  readonly h2?: number;
  readonly y?: number;
};

/** Gradients of the loss w.r.t. every quantity. Same "undefined = not yet" convention. */
export type BackpropGradients = {
  readonly dLdy?: number;
  readonly dLdv1?: number;
  readonly dLdv2?: number;
  readonly dLdc?: number;
  readonly dLdh1Pre?: number;
  readonly dLdw11?: number;
  readonly dLdw12?: number;
  readonly dLdb1?: number;
  readonly dLdh2Pre?: number;
  readonly dLdw21?: number;
  readonly dLdw22?: number;
  readonly dLdb2?: number;
};

export type BackpropPhase = "forward" | "loss" | "backward" | "update" | "done";

export type BackpropSnapshot = {
  readonly inputs: readonly [number, number];
  readonly target: number;
  readonly weights: BackpropWeights;
  readonly activations: BackpropActivations;
  readonly loss?: number;
  readonly gradients: BackpropGradients;
  readonly phase: BackpropPhase;
};

export type BackpropStep =
  | (StepBase & { kind: "begin"; snapshot: BackpropSnapshot })
  | (StepBase & { kind: "forward-hidden"; hiddenIndex: 0 | 1; snapshot: BackpropSnapshot })
  | (StepBase & { kind: "forward-output"; snapshot: BackpropSnapshot })
  | (StepBase & { kind: "compute-loss"; snapshot: BackpropSnapshot })
  | (StepBase & { kind: "backward-output"; snapshot: BackpropSnapshot })
  | (StepBase & { kind: "backward-hidden"; hiddenIndex: 0 | 1; snapshot: BackpropSnapshot })
  | (StepBase & { kind: "apply-update"; snapshot: BackpropSnapshot })
  | (StepBase & { kind: "done"; snapshot: BackpropSnapshot });

/* ------------------------------------------------------------------ *
 * Attention                                                           *
 * ------------------------------------------------------------------ */

/** Generic 2D matrix as a readonly array-of-readonly-rows. */
export type Matrix = ReadonlyArray<ReadonlyArray<number>>;

export type AttentionPhase =
  | "begin"
  | "project-q"
  | "project-k"
  | "project-v"
  | "scores"
  | "scaled"
  | "softmax"
  | "output"
  | "done";

export type AttentionSnapshot = {
  /** Token embeddings (tokens × d_embed). Always present. */
  readonly embeddings: Matrix;
  /** Token labels for display. */
  readonly tokenLabels: ReadonlyArray<string>;
  /** Projection matrices, always present (they're the model parameters). */
  readonly wQ: Matrix;
  readonly wK: Matrix;
  readonly wV: Matrix;
  /** Filled in as the forward pass progresses. */
  readonly q?: Matrix;
  readonly k?: Matrix;
  readonly v?: Matrix;
  readonly scores?: Matrix;
  readonly scaled?: Matrix;
  readonly attention?: Matrix;
  readonly output?: Matrix;
  readonly phase: AttentionPhase;
};

export type AttentionStep =
  | (StepBase & { kind: "begin"; snapshot: AttentionSnapshot })
  | (StepBase & { kind: "project-q"; snapshot: AttentionSnapshot })
  | (StepBase & { kind: "project-k"; snapshot: AttentionSnapshot })
  | (StepBase & { kind: "project-v"; snapshot: AttentionSnapshot })
  | (StepBase & { kind: "compute-scores"; snapshot: AttentionSnapshot })
  | (StepBase & { kind: "scale-scores"; snapshot: AttentionSnapshot })
  | (StepBase & { kind: "softmax"; snapshot: AttentionSnapshot })
  | (StepBase & { kind: "weighted-sum"; snapshot: AttentionSnapshot })
  | (StepBase & { kind: "done"; snapshot: AttentionSnapshot });

/* ------------------------------------------------------------------ *
 * Multi-head attention                                                *
 * ------------------------------------------------------------------ */

/** Filled-in-as-we-go per-head state, mirroring AttentionSnapshot's Q/K/V/etc. fields. */
export type MultiHeadHeadState = {
  readonly wQ: Matrix;
  readonly wK: Matrix;
  readonly wV: Matrix;
  readonly q?: Matrix;
  readonly k?: Matrix;
  readonly v?: Matrix;
  readonly scores?: Matrix;
  readonly scaled?: Matrix;
  readonly attention?: Matrix;
  readonly output?: Matrix;
};

export type MultiHeadPhase = "begin" | "head" | "concat" | "project-output" | "done";

export type MultiHeadAttentionSnapshot = {
  readonly embeddings: Matrix;
  readonly tokenLabels: ReadonlyArray<string>;
  readonly heads: ReadonlyArray<MultiHeadHeadState>;
  readonly wO: Matrix;
  /** Concatenated per-head outputs [Y^(1) | Y^(2) | ...], filled in once all heads finish. */
  readonly concat?: Matrix;
  /** Final output Y = concat · W_O. */
  readonly output?: Matrix;
  readonly phase: MultiHeadPhase;
  /** Which head the current step belongs to (undefined for non-head phases). */
  readonly activeHead?: number;
};

export type MultiHeadAttentionStep =
  | (StepBase & { kind: "begin"; snapshot: MultiHeadAttentionSnapshot })
  | (StepBase & {
      kind: "project-q";
      headIndex: number;
      snapshot: MultiHeadAttentionSnapshot;
    })
  | (StepBase & {
      kind: "project-k";
      headIndex: number;
      snapshot: MultiHeadAttentionSnapshot;
    })
  | (StepBase & {
      kind: "project-v";
      headIndex: number;
      snapshot: MultiHeadAttentionSnapshot;
    })
  | (StepBase & {
      kind: "compute-scores";
      headIndex: number;
      snapshot: MultiHeadAttentionSnapshot;
    })
  | (StepBase & {
      kind: "scale-scores";
      headIndex: number;
      snapshot: MultiHeadAttentionSnapshot;
    })
  | (StepBase & {
      kind: "softmax";
      headIndex: number;
      snapshot: MultiHeadAttentionSnapshot;
    })
  | (StepBase & {
      kind: "weighted-sum";
      headIndex: number;
      snapshot: MultiHeadAttentionSnapshot;
    })
  | (StepBase & { kind: "concat-heads"; snapshot: MultiHeadAttentionSnapshot })
  | (StepBase & { kind: "project-output"; snapshot: MultiHeadAttentionSnapshot })
  | (StepBase & { kind: "done"; snapshot: MultiHeadAttentionSnapshot });
