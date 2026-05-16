import { matmul, rowSoftmax, transpose } from "./attention";
import { multiHeadAttentionLines } from "./multiHeadAttention.snippet";
import type { Matrix, MultiHeadAttentionSnapshot, MultiHeadAttentionStep } from "./types";

export type MultiHeadAttentionParams = {
  readonly embeddings: Matrix;
  readonly tokenLabels: ReadonlyArray<string>;
  /** Per-head projection matrices. All three arrays must have the same length (the head count). */
  readonly wQ: ReadonlyArray<Matrix>;
  readonly wK: ReadonlyArray<Matrix>;
  readonly wV: ReadonlyArray<Matrix>;
  /** Output projection W_O, shape (h * d_v) × d_embed. */
  readonly wO: Matrix;
};

function cloneMatrix(m: Matrix): number[][] {
  return m.map((row) => [...row]);
}

function scaleMatrix(a: Matrix, factor: number): number[][] {
  return a.map((row) => row.map((v) => v * factor));
}

/**
 * Horizontal concatenation of two or more (n × d) matrices into an (n × Σd) matrix.
 * Used to stitch per-head outputs into the input for the final W_O projection.
 */
export function concatHorizontal(matrices: ReadonlyArray<Matrix>): number[][] {
  if (matrices.length === 0) return [];
  const rows = matrices[0].length;
  const out: number[][] = Array.from({ length: rows }, () => []);
  for (const m of matrices) {
    for (let i = 0; i < rows; i++) out[i].push(...m[i]);
  }
  return out;
}

/**
 * Multi-head scaled dot-product attention as a step-through generator.
 * For each head, walks through the same seven-stage forward pass as the single-head
 * lesson (project Q/K/V → scores → scale → softmax → weighted-sum). After all heads
 * finish, emits a `concat-heads` step that stitches the per-head outputs and a
 * `project-output` step that applies W_O for the final result.
 *
 * Every snapshot carries a fresh copy of every matrix that exists so far, so step-back
 * replay can't mutate any earlier state.
 */
export function* multiHeadAttentionSequence(
  params: MultiHeadAttentionParams,
): Generator<MultiHeadAttentionStep, void, void> {
  const { embeddings, tokenLabels, wQ, wK, wV, wO } = params;
  const numHeads = wQ.length;
  if (wK.length !== numHeads || wV.length !== numHeads) {
    throw new Error("multi-head attention: per-head W_Q/W_K/W_V arrays must have matching lengths");
  }
  if (numHeads === 0) {
    throw new Error("multi-head attention: at least one head is required");
  }
  const dk = wK[0][0].length;
  const scaleFactor = 1 / Math.sqrt(dk);

  // Working state with mutable fields — the public MultiHeadHeadState wraps each
  // field in `readonly`, which is the right contract for snapshot consumers but
  // too strict inside the generator's loop. We clone into readonly form on emit.
  type MutableHeadState = {
    wQ: Matrix;
    wK: Matrix;
    wV: Matrix;
    q?: Matrix;
    k?: Matrix;
    v?: Matrix;
    scores?: Matrix;
    scaled?: Matrix;
    attention?: Matrix;
    output?: Matrix;
  };
  const heads: MutableHeadState[] = wQ.map((wQh, h) => ({
    wQ: cloneMatrix(wQh),
    wK: cloneMatrix(wK[h]),
    wV: cloneMatrix(wV[h]),
  }));

  const state: {
    concat?: Matrix;
    output?: Matrix;
  } = {};

  const emit = (
    phase: MultiHeadAttentionSnapshot["phase"],
    activeHead?: number,
  ): MultiHeadAttentionSnapshot => ({
    embeddings: cloneMatrix(embeddings),
    tokenLabels: [...tokenLabels],
    heads: heads.map((h) => ({
      wQ: cloneMatrix(h.wQ),
      wK: cloneMatrix(h.wK),
      wV: cloneMatrix(h.wV),
      q: h.q ? cloneMatrix(h.q) : undefined,
      k: h.k ? cloneMatrix(h.k) : undefined,
      v: h.v ? cloneMatrix(h.v) : undefined,
      scores: h.scores ? cloneMatrix(h.scores) : undefined,
      scaled: h.scaled ? cloneMatrix(h.scaled) : undefined,
      attention: h.attention ? cloneMatrix(h.attention) : undefined,
      output: h.output ? cloneMatrix(h.output) : undefined,
    })),
    wO: cloneMatrix(wO),
    concat: state.concat ? cloneMatrix(state.concat) : undefined,
    output: state.output ? cloneMatrix(state.output) : undefined,
    phase,
    activeHead,
  });

  yield { kind: "begin", snapshot: emit("begin"), codeLines: multiHeadAttentionLines.begin };

  for (let h = 0; h < numHeads; h++) {
    const head = heads[h];

    head.q = matmul(embeddings, head.wQ);
    yield {
      kind: "project-q",
      headIndex: h,
      snapshot: emit("head", h),
      codeLines: multiHeadAttentionLines.projectQ,
    };

    head.k = matmul(embeddings, head.wK);
    yield {
      kind: "project-k",
      headIndex: h,
      snapshot: emit("head", h),
      codeLines: multiHeadAttentionLines.projectK,
    };

    head.v = matmul(embeddings, head.wV);
    yield {
      kind: "project-v",
      headIndex: h,
      snapshot: emit("head", h),
      codeLines: multiHeadAttentionLines.projectV,
    };

    head.scores = matmul(head.q, transpose(head.k));
    yield {
      kind: "compute-scores",
      headIndex: h,
      snapshot: emit("head", h),
      codeLines: multiHeadAttentionLines.scores,
    };

    head.scaled = scaleMatrix(head.scores, scaleFactor);
    yield {
      kind: "scale-scores",
      headIndex: h,
      snapshot: emit("head", h),
      codeLines: multiHeadAttentionLines.scale,
    };

    head.attention = rowSoftmax(head.scaled);
    yield {
      kind: "softmax",
      headIndex: h,
      snapshot: emit("head", h),
      codeLines: multiHeadAttentionLines.softmax,
    };

    head.output = matmul(head.attention, head.v);
    yield {
      kind: "weighted-sum",
      headIndex: h,
      snapshot: emit("head", h),
      codeLines: multiHeadAttentionLines.weightedSum,
    };
  }

  state.concat = concatHorizontal(heads.map((h) => h.output!));
  yield {
    kind: "concat-heads",
    snapshot: emit("concat"),
    codeLines: multiHeadAttentionLines.concat,
  };

  state.output = matmul(state.concat, wO);
  yield {
    kind: "project-output",
    snapshot: emit("project-output"),
    codeLines: multiHeadAttentionLines.projectOutput,
  };

  yield { kind: "done", snapshot: emit("done"), codeLines: multiHeadAttentionLines.done };
}
