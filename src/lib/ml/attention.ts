import { attentionLines } from "./attention.snippet";
import { causalAttentionLines } from "./causalAttention.snippet";
import type { AttentionSnapshot, AttentionStep, Matrix } from "./types";

export type AttentionMask = "none" | "causal";

export type AttentionParams = {
  readonly embeddings: Matrix;
  readonly tokenLabels: ReadonlyArray<string>;
  readonly wQ: Matrix;
  readonly wK: Matrix;
  readonly wV: Matrix;
  // Default "none" preserves the original behavior — no mask step is
  // emitted and the existing AttentionViz keeps working unchanged.
  // "causal" inserts a mask-scores step between scale-scores and softmax
  // and uses the causal snippet's code-line map.
  readonly mask?: AttentionMask;
};

/**
 * Returns a fresh matrix with -Infinity in every cell where the column
 * index strictly exceeds the row index (the upper triangle, excluding
 * the diagonal). After softmax, those entries become 0 — implementing
 * the "position i can only attend to positions ≤ i" rule.
 */
export function applyCausalMask(scaled: Matrix): number[][] {
  return scaled.map((row, i) => row.map((v, j) => (j > i ? -Infinity : v)));
}

/** Standard matrix multiply, returning a fresh mutable result. Assumes non-empty inputs. */
export function matmul(a: Matrix, b: Matrix): number[][] {
  const m = a.length;
  const n = b[0].length;
  const k = b.length;
  const out: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += a[i][p] * b[p][j];
      out[i][j] = s;
    }
  }
  return out;
}

/** Transpose of a matrix. Assumes non-empty input. */
export function transpose(a: Matrix): number[][] {
  const m = a.length;
  const n = a[0].length;
  const out: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) out[j][i] = a[i][j];
  }
  return out;
}

/**
 * Row-wise softmax with the standard max-subtraction trick for numerical stability.
 * Each row in the output sums to exactly 1 ± floating-point error.
 */
export function rowSoftmax(a: Matrix): number[][] {
  return a.map((row) => {
    const max = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - max));
    const sum = exps.reduce((s, x) => s + x, 0);
    return exps.map((x) => x / sum);
  });
}

function scaleMatrix(a: Matrix, factor: number): number[][] {
  return a.map((row) => row.map((v) => v * factor));
}

/**
 * Single-head scaled dot-product attention as a step-through generator.
 * Emits nine steps walking through every stage of `softmax(QK^T / √d_k) V`.
 * Every snapshot carries a fresh copy of every matrix that exists so far —
 * step-back replay can't mutate any earlier state.
 */
export function* attentionSequence(params: AttentionParams): Generator<AttentionStep, void, void> {
  const { embeddings, tokenLabels, wQ, wK, wV, mask = "none" } = params;
  const dk = wK[0].length;
  const scaleFactor = 1 / Math.sqrt(dk);
  // Causal mode swaps in the masked snippet so highlighted lines line up
  // with the displayed source for either variant.
  const lines = mask === "causal" ? causalAttentionLines : attentionLines;

  // Accumulator object — fields appear as the forward pass proceeds. Holding state
  // in a const object (rather than seven let bindings) sidesteps a prefer-const lint
  // false-positive without losing the "fill in as we go" semantics.
  const state: {
    q?: Matrix;
    k?: Matrix;
    v?: Matrix;
    scores?: Matrix;
    scaled?: Matrix;
    masked?: Matrix;
    attention?: Matrix;
    output?: Matrix;
  } = {};

  const emit = (phase: AttentionSnapshot["phase"]): AttentionSnapshot => ({
    embeddings: cloneMatrix(embeddings),
    tokenLabels: [...tokenLabels],
    wQ: cloneMatrix(wQ),
    wK: cloneMatrix(wK),
    wV: cloneMatrix(wV),
    q: state.q ? cloneMatrix(state.q) : undefined,
    k: state.k ? cloneMatrix(state.k) : undefined,
    v: state.v ? cloneMatrix(state.v) : undefined,
    scores: state.scores ? cloneMatrix(state.scores) : undefined,
    scaled: state.scaled ? cloneMatrix(state.scaled) : undefined,
    masked: state.masked ? cloneMatrix(state.masked) : undefined,
    attention: state.attention ? cloneMatrix(state.attention) : undefined,
    output: state.output ? cloneMatrix(state.output) : undefined,
    phase,
  });

  yield { kind: "begin", snapshot: emit("begin"), codeLines: lines.begin };

  state.q = matmul(embeddings, wQ);
  yield { kind: "project-q", snapshot: emit("project-q"), codeLines: lines.projectQ };

  state.k = matmul(embeddings, wK);
  yield { kind: "project-k", snapshot: emit("project-k"), codeLines: lines.projectK };

  state.v = matmul(embeddings, wV);
  yield { kind: "project-v", snapshot: emit("project-v"), codeLines: lines.projectV };

  state.scores = matmul(state.q, transpose(state.k));
  yield {
    kind: "compute-scores",
    snapshot: emit("scores"),
    codeLines: lines.scores,
  };

  state.scaled = scaleMatrix(state.scores, scaleFactor);
  yield { kind: "scale-scores", snapshot: emit("scaled"), codeLines: lines.scale };

  // The softmax input depends on whether masking ran. In non-causal mode
  // softmax consumes `state.scaled` directly; in causal mode it consumes
  // the post-mask matrix (with -Infinity in the upper triangle).
  let softmaxInput: Matrix = state.scaled;
  if (mask === "causal") {
    state.masked = applyCausalMask(state.scaled);
    softmaxInput = state.masked;
    yield {
      kind: "mask-scores",
      snapshot: emit("masked"),
      codeLines: causalAttentionLines.mask,
    };
  }

  state.attention = rowSoftmax(softmaxInput);
  yield { kind: "softmax", snapshot: emit("softmax"), codeLines: lines.softmax };

  state.output = matmul(state.attention, state.v);
  yield {
    kind: "weighted-sum",
    snapshot: emit("output"),
    codeLines: lines.weightedSum,
  };

  yield { kind: "done", snapshot: emit("done"), codeLines: lines.done };
}

function cloneMatrix(m: Matrix): number[][] {
  return m.map((row) => [...row]);
}
