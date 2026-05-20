import { cloneMatrix, matmul, rowSoftmax, scaleMatrix, transpose } from "./attention";
import { crossAttentionLines } from "./crossAttention.snippet";
import type { CrossAttentionSnapshot, CrossAttentionStep, Matrix } from "./types";

export type CrossAttentionParams = {
  /** Decoder (target) embeddings — the source of queries. */
  readonly decoderEmbeddings: Matrix;
  readonly decoderTokenLabels: ReadonlyArray<string>;
  /** Encoder (source) embeddings — the source of keys and values. */
  readonly encoderEmbeddings: Matrix;
  readonly encoderTokenLabels: ReadonlyArray<string>;
  readonly wQ: Matrix;
  readonly wK: Matrix;
  readonly wV: Matrix;
};

/**
 * Encoder-decoder cross-attention as a step-through generator.
 *
 * The arithmetic is identical to scaled dot-product self-attention — the
 * only difference is the *source split*: the query projection reads the
 * decoder sequence while the key and value projections read the encoder
 * sequence. As a result the score and attention matrices are rectangular
 * (decoder_n × encoder_n) and the output has one row per decoder token.
 *
 * Emits the same nine steps as `attentionSequence` in non-causal mode, so
 * the viz layer can render it with the familiar Q/K/V → scores → softmax →
 * weighted-sum walk.
 */
export function* crossAttentionSequence(
  params: CrossAttentionParams,
): Generator<CrossAttentionStep, void, void> {
  const {
    decoderEmbeddings,
    decoderTokenLabels,
    encoderEmbeddings,
    encoderTokenLabels,
    wQ,
    wK,
    wV,
  } = params;
  const dk = wK[0].length;
  const scaleFactor = 1 / Math.sqrt(dk);

  // Accumulator object — fields appear as the forward pass proceeds, same
  // "fill in as we go" pattern as attentionSequence.
  const state: {
    q?: Matrix;
    k?: Matrix;
    v?: Matrix;
    scores?: Matrix;
    scaled?: Matrix;
    attention?: Matrix;
    output?: Matrix;
  } = {};

  const emit = (phase: CrossAttentionSnapshot["phase"]): CrossAttentionSnapshot => ({
    decoderEmbeddings: cloneMatrix(decoderEmbeddings),
    decoderTokenLabels: [...decoderTokenLabels],
    encoderEmbeddings: cloneMatrix(encoderEmbeddings),
    encoderTokenLabels: [...encoderTokenLabels],
    wQ: cloneMatrix(wQ),
    wK: cloneMatrix(wK),
    wV: cloneMatrix(wV),
    q: state.q ? cloneMatrix(state.q) : undefined,
    k: state.k ? cloneMatrix(state.k) : undefined,
    v: state.v ? cloneMatrix(state.v) : undefined,
    scores: state.scores ? cloneMatrix(state.scores) : undefined,
    scaled: state.scaled ? cloneMatrix(state.scaled) : undefined,
    attention: state.attention ? cloneMatrix(state.attention) : undefined,
    output: state.output ? cloneMatrix(state.output) : undefined,
    phase,
  });

  yield { kind: "begin", snapshot: emit("begin"), codeLines: crossAttentionLines.begin };

  // Queries: the decoder sequence projected through W_Q.
  state.q = matmul(decoderEmbeddings, wQ);
  yield { kind: "project-q", snapshot: emit("project-q"), codeLines: crossAttentionLines.projectQ };

  // Keys and values: the encoder sequence projected through W_K / W_V.
  state.k = matmul(encoderEmbeddings, wK);
  yield { kind: "project-k", snapshot: emit("project-k"), codeLines: crossAttentionLines.projectK };

  state.v = matmul(encoderEmbeddings, wV);
  yield { kind: "project-v", snapshot: emit("project-v"), codeLines: crossAttentionLines.projectV };

  // Rectangular: one row per decoder query, one column per encoder key.
  state.scores = matmul(state.q, transpose(state.k));
  yield { kind: "compute-scores", snapshot: emit("scores"), codeLines: crossAttentionLines.scores };

  state.scaled = scaleMatrix(state.scores, scaleFactor);
  yield { kind: "scale-scores", snapshot: emit("scaled"), codeLines: crossAttentionLines.scale };

  state.attention = rowSoftmax(state.scaled);
  yield { kind: "softmax", snapshot: emit("softmax"), codeLines: crossAttentionLines.softmax };

  state.output = matmul(state.attention, state.v);
  yield {
    kind: "weighted-sum",
    snapshot: emit("output"),
    codeLines: crossAttentionLines.weightedSum,
  };

  yield { kind: "done", snapshot: emit("done"), codeLines: crossAttentionLines.done };
}
