import { positionalEncodingLines } from "./positionalEncoding.snippet";
import type { Matrix, PositionalEncodingSnapshot, PositionalEncodingStep } from "./types";

export type PositionalEncodingParams = {
  readonly embeddings: Matrix;
  readonly tokenLabels: ReadonlyArray<string>;
};

/**
 * Sinusoidal positional encoding, Vaswani et al. 2017 § 3.5.
 *   PE(pos, 2i)   = sin(pos / 10000^(2i / d_model))
 *   PE(pos, 2i+1) = cos(pos / 10000^(2i / d_model))
 * Returns a fresh matrix; rows are positions, columns are embedding dims.
 * For odd d_model the final column uses the sin formula with i = d/2
 * (the cos partner is dropped); the lesson demo uses d_model = 2 so
 * that edge case is never exercised by the curated input.
 */
export function sinusoidalPE(numTokens: number, dModel: number): number[][] {
  const pe: number[][] = Array.from({ length: numTokens }, () => new Array(dModel).fill(0));
  for (let pos = 0; pos < numTokens; pos++) {
    for (let i = 0; i < Math.floor(dModel / 2); i++) {
      const denom = Math.pow(10000, (2 * i) / dModel);
      pe[pos][2 * i] = Math.sin(pos / denom);
      pe[pos][2 * i + 1] = Math.cos(pos / denom);
    }
    // Odd d_model: leftover trailing column gets sin only.
    /* v8 ignore next 3 */
    if (dModel % 2 === 1) {
      pe[pos][dModel - 1] = Math.sin(pos / Math.pow(10000, (dModel - 1) / dModel));
    }
  }
  return pe;
}

function cloneMatrix(m: Matrix): number[][] {
  return m.map((row) => [...row]);
}

/**
 * Step-through generator for "compute PE row by row, then add to X".
 * Steps: begin → compute-pe-row × n → add → done.
 *
 * Each compute-pe-row step exposes the full PE matrix-so-far (rows
 * beyond `revealedRows` are zero-filled placeholders so the viz can
 * render a stable grid; the snapshot's `revealedRows` tells the viz
 * which rows are "real").
 */
export function* positionalEncodingSequence(
  params: PositionalEncodingParams,
): Generator<PositionalEncodingStep, void, void> {
  const { embeddings, tokenLabels } = params;
  const n = embeddings.length;
  // Inputs are curated non-empty matrices (the viz never feeds an empty
  // sequence). Direct index access keeps branch coverage at 100%.
  const d = embeddings[0].length;

  // PE accumulator — we'll fill in row-by-row but always emit the full
  // matrix so the viz has a stable shape.
  const peAccum: number[][] = Array.from({ length: n }, () => new Array(d).fill(0));
  const finalPE = sinusoidalPE(n, d);

  const emit = (
    phase: PositionalEncodingSnapshot["phase"],
    extras: Partial<PositionalEncodingSnapshot> = {},
  ): PositionalEncodingSnapshot => ({
    embeddings: cloneMatrix(embeddings),
    tokenLabels: [...tokenLabels],
    pe: cloneMatrix(peAccum),
    phase,
    ...extras,
  });

  yield {
    kind: "begin",
    snapshot: emit("begin"),
    codeLines: positionalEncodingLines.begin,
  };

  for (let pos = 0; pos < n; pos++) {
    // Copy this row from the precomputed final matrix into the accumulator.
    for (let i = 0; i < d; i++) peAccum[pos][i] = finalPE[pos][i];
    yield {
      kind: "compute-pe-row",
      snapshot: emit("compute-pe", { revealedRows: pos + 1 }),
      rowIndex: pos,
      codeLines: positionalEncodingLines.computeRow,
    };
  }

  const combined: number[][] = embeddings.map((row, i) => row.map((v, j) => v + peAccum[i][j]));
  yield {
    kind: "add",
    snapshot: emit("add", { combined: cloneMatrix(combined), revealedRows: n }),
    codeLines: positionalEncodingLines.add,
  };

  yield {
    kind: "done",
    snapshot: emit("done", { combined: cloneMatrix(combined), revealedRows: n }),
    codeLines: positionalEncodingLines.done,
  };
}
