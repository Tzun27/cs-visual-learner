import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { crossAttentionSequence, type CrossAttentionParams } from "@/lib/ml/crossAttention";
import { crossAttentionPython } from "@/lib/ml/crossAttention.snippet";
import type { CrossAttentionStep, Matrix } from "@/lib/ml/types";

// Curated demo: a 2-token decoder sequence attending into a 3-token
// encoder sequence. d_embed = 2, d_k = d_v = 2.
const DEMO_PARAMS: CrossAttentionParams = {
  decoderEmbeddings: [
    [2, 1],
    [0, 2],
  ],
  decoderTokenLabels: ["d1", "d2"],
  encoderEmbeddings: [
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  encoderTokenLabels: ["e1", "e2", "e3"],
  wQ: [
    [1, 0],
    [0, 1],
  ],
  wK: [
    [0, 1],
    [1, 0],
  ],
  wV: [
    [1, 1],
    [1, -1],
  ],
};

function run(p: CrossAttentionParams = DEMO_PARAMS): readonly CrossAttentionStep[] {
  return [...crossAttentionSequence(p)];
}

describe("crossAttentionSequence — shape + ordering", () => {
  it("emits nine steps in the canonical order", () => {
    expect(run().map((s) => s.kind)).toEqual([
      "begin",
      "project-q",
      "project-k",
      "project-v",
      "compute-scores",
      "scale-scores",
      "softmax",
      "weighted-sum",
      "done",
    ]);
  });
});

describe("crossAttentionSequence — hand-computed Q, K, V (the source split)", () => {
  it("Q is the decoder sequence projected through wQ (identity → unchanged)", () => {
    const q = run().find((s) => s.kind === "project-q")?.snapshot.q;
    expect(q).toEqual([
      [2, 1],
      [0, 2],
    ]);
  });

  it("K is the encoder sequence projected through wK (swap)", () => {
    const k = run().find((s) => s.kind === "project-k")?.snapshot.k;
    expect(k).toEqual([
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it("V is the encoder sequence projected through wV", () => {
    const v = run().find((s) => s.kind === "project-v")?.snapshot.v;
    expect(v).toEqual([
      [1, 1],
      [1, -1],
      [2, 0],
    ]);
  });

  it("Q has one row per decoder token; K and V have one row per encoder token", () => {
    const done = run().at(-1)?.snapshot;
    expect(done?.q?.length).toBe(2);
    expect(done?.k?.length).toBe(3);
    expect(done?.v?.length).toBe(3);
  });
});

describe("crossAttentionSequence — rectangular scores + attention", () => {
  it("raw scores S = Q · Kᵀ is the hand-computed 2×3 integer grid", () => {
    const scores = run().find((s) => s.kind === "compute-scores")?.snapshot.scores;
    expect(scores).toEqual([
      [1, 2, 3],
      [2, 0, 2],
    ]);
  });

  it("attention matrix is 2×3 — decoder rows by encoder columns, not square", () => {
    const a = run().at(-1)?.snapshot.attention as Matrix;
    expect(a.length).toBe(2);
    for (const row of a) expect(row.length).toBe(3);
  });

  it("every attention row sums to 1 within fp tolerance", () => {
    const a = run().at(-1)?.snapshot.attention as Matrix;
    for (const row of a) {
      expect(row.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
    }
  });

  it("every attention weight is non-negative", () => {
    const a = run().at(-1)?.snapshot.attention as Matrix;
    for (const row of a) for (const w of row) expect(w).toBeGreaterThanOrEqual(0);
  });
});

describe("crossAttentionSequence — output", () => {
  it("output has one row per decoder token (2) and d_v columns (2)", () => {
    const y = run().at(-1)?.snapshot.output as Matrix;
    expect(y.length).toBe(2);
    for (const row of y) expect(row.length).toBe(2);
  });

  it("each output coordinate lies within the convex hull of V rows along that axis", () => {
    const last = run().at(-1)?.snapshot;
    const v = last?.v as Matrix;
    const output = last?.output as Matrix;
    for (let d = 0; d < v[0].length; d++) {
      const col = v.map((r) => r[d]);
      const min = Math.min(...col);
      const max = Math.max(...col);
      for (const yRow of output) {
        expect(yRow[d]).toBeGreaterThanOrEqual(min - 1e-10);
        expect(yRow[d]).toBeLessThanOrEqual(max + 1e-10);
      }
    }
  });

  it("matches the hand-computed Y to two decimals", () => {
    const y = run().at(-1)?.snapshot.output as Matrix;
    expect(y[0][0]).toBeCloseTo(1.58, 2);
    expect(y[0][1]).toBeCloseTo(-0.14, 2);
    expect(y[1][0]).toBeCloseTo(1.45, 2);
    expect(y[1][1]).toBeCloseTo(0.34, 2);
  });
});

describe("crossAttentionSequence — determinism + immutability", () => {
  it("running twice with identical params produces identical output", () => {
    expect(run().at(-1)?.snapshot.output).toEqual(run().at(-1)?.snapshot.output);
  });

  it("mutating one step's matrix does not leak into later steps", () => {
    const steps = run();
    (steps[0].snapshot.decoderEmbeddings as number[][])[0][0] = 999;
    expect(steps.at(-1)?.snapshot.decoderEmbeddings[0][0]).not.toBe(999);
  });

  it("begin step carries no q/k/v yet; done step carries the full forward pass", () => {
    const steps = run();
    const begin = steps[0].snapshot;
    expect(begin.q).toBeUndefined();
    expect(begin.k).toBeUndefined();
    expect(begin.v).toBeUndefined();
    const done = steps.at(-1)?.snapshot;
    expect(done?.q).toBeDefined();
    expect(done?.attention).toBeDefined();
    expect(done?.output).toBeDefined();
  });
});

describe("crossAttentionSequence — codeLines annotation", () => {
  const lineCount = crossAttentionPython.split("\n").length;

  it("every step's codeLines is within source bounds", () => {
    for (const s of run()) {
      for (const ln of s.codeLines ?? []) {
        expect(ln).toBeGreaterThanOrEqual(1);
        expect(ln).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("project-q / project-k / project-v point at three different lines", () => {
    const steps = run();
    const q = steps.find((s) => s.kind === "project-q")?.codeLines;
    const k = steps.find((s) => s.kind === "project-k")?.codeLines;
    const v = steps.find((s) => s.kind === "project-v")?.codeLines;
    expect(q).not.toEqual(k);
    expect(k).not.toEqual(v);
    expect(q).not.toEqual(v);
  });
});

describe("crossAttentionSequence — property-based", () => {
  const finite = () => fc.double({ min: -2, max: 2, noNaN: true });
  const row = () => fc.tuple(finite(), finite());

  it("attention is decoder_n × encoder_n, rows sum to 1, outputs stay in the convex hull of V", () => {
    fc.assert(
      fc.property(
        // Decoder and encoder sequences vary independently in length — the
        // attention matrix should track both, never assume square.
        fc.array(row(), { minLength: 1, maxLength: 3 }),
        fc.array(row(), { minLength: 1, maxLength: 3 }),
        fc.tuple(row(), row()),
        fc.tuple(row(), row()),
        fc.tuple(row(), row()),
        (dec, enc, wQ, wK, wV) => {
          const last = [
            ...crossAttentionSequence({
              decoderEmbeddings: dec.map((r) => [...r]),
              decoderTokenLabels: dec.map((_, i) => `d${i}`),
              encoderEmbeddings: enc.map((r) => [...r]),
              encoderTokenLabels: enc.map((_, i) => `e${i}`),
              wQ: wQ.map((r) => [...r]),
              wK: wK.map((r) => [...r]),
              wV: wV.map((r) => [...r]),
            }),
          ].at(-1);
          const a = last?.snapshot.attention as Matrix;
          const v = last?.snapshot.v as Matrix;
          const output = last?.snapshot.output as Matrix;

          expect(a.length).toBe(dec.length);
          for (const r of a) {
            expect(r.length).toBe(enc.length);
            expect(r.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 8);
          }
          expect(output.length).toBe(dec.length);
          for (let d = 0; d < v[0].length; d++) {
            const col = v.map((r) => r[d]);
            const min = Math.min(...col);
            const max = Math.max(...col);
            for (const yRow of output) {
              expect(yRow[d]).toBeGreaterThanOrEqual(min - 1e-8);
              expect(yRow[d]).toBeLessThanOrEqual(max + 1e-8);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
