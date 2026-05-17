import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  applyCausalMask,
  attentionSequence,
  matmul,
  rowSoftmax,
  transpose,
  type AttentionParams,
} from "@/lib/ml/attention";
import { attentionPython } from "@/lib/ml/attention.snippet";
import { causalAttentionPython } from "@/lib/ml/causalAttention.snippet";
import type { AttentionStep, Matrix } from "@/lib/ml/types";

// Curated demo: 3 tokens, d_embed = 2, d_k = d_v = 2.
const DEMO_PARAMS: AttentionParams = {
  embeddings: [
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  tokenLabels: ["t1", "t2", "t3"],
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

function run(p: AttentionParams = DEMO_PARAMS): readonly AttentionStep[] {
  return [...attentionSequence(p)];
}

describe("matmul / transpose / rowSoftmax helpers", () => {
  it("matmul agrees with a hand-multiplied 2×2 case", () => {
    expect(
      matmul(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ),
    ).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it("transpose flips rows and columns", () => {
    expect(
      transpose([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it("rowSoftmax rows sum to 1 within fp tolerance", () => {
    const out = rowSoftmax([
      [1, 2, 3],
      [-5, 0, 5],
      [0, 0, 0],
    ]);
    for (const row of out) {
      const sum = row.reduce((s, x) => s + x, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("rowSoftmax handles large inputs without overflow (max-subtraction)", () => {
    const out = rowSoftmax([[1000, 1001, 1002]]);
    const sum = out[0].reduce((s, x) => s + x, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(out[0].every((x) => Number.isFinite(x))).toBe(true);
  });
});

describe("attentionSequence — shape + ordering", () => {
  it("emits nine steps in the canonical order", () => {
    const steps = run();
    expect(steps.map((s) => s.kind)).toEqual([
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

describe("attentionSequence — hand-computed Q, K, V on the demo", () => {
  it("project-q produces X @ wQ correctly", () => {
    const steps = run();
    const projectQ = steps.find((s) => s.kind === "project-q");
    expect(projectQ?.snapshot.q).toEqual([
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
  });

  it("project-k produces X @ wK correctly (swap)", () => {
    const steps = run();
    const projectK = steps.find((s) => s.kind === "project-k");
    expect(projectK?.snapshot.k).toEqual([
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it("project-v produces X @ wV correctly", () => {
    const steps = run();
    const projectV = steps.find((s) => s.kind === "project-v");
    expect(projectV?.snapshot.v).toEqual([
      [1, 1],
      [1, -1],
      [2, 0],
    ]);
  });
});

describe("attentionSequence — softmax invariants", () => {
  it("every attention row sums to 1 (within 1e-10)", () => {
    const last = run().at(-1);
    const attention = last?.snapshot.attention;
    if (!attention) throw new Error("no attention matrix on done step");
    for (const row of attention) {
      const sum = row.reduce((s, x) => s + x, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("every attention weight is non-negative", () => {
    const last = run().at(-1);
    const attention = last?.snapshot.attention ?? [];
    for (const row of attention) for (const w of row) expect(w).toBeGreaterThanOrEqual(0);
  });

  it("attention matrix is 3×3 for the 3-token demo", () => {
    const last = run().at(-1);
    const attention = last?.snapshot.attention ?? [];
    expect(attention.length).toBe(3);
    for (const row of attention) expect(row.length).toBe(3);
  });
});

describe("attentionSequence — outputs are convex combinations of V rows", () => {
  it("each output coordinate lies within the convex hull of V rows along that axis", () => {
    const last = run().at(-1);
    const v = last?.snapshot.v ?? [];
    const output = last?.snapshot.output ?? [];
    const dim = v[0].length;
    for (let d = 0; d < dim; d++) {
      const vColumn = v.map((row) => row[d]);
      const minV = Math.min(...vColumn);
      const maxV = Math.max(...vColumn);
      for (const yRow of output) {
        expect(yRow[d]).toBeGreaterThanOrEqual(minV - 1e-10);
        expect(yRow[d]).toBeLessThanOrEqual(maxV + 1e-10);
      }
    }
  });
});

describe("attentionSequence — determinism", () => {
  it("running twice with identical params produces identical output", () => {
    const a = run().at(-1)?.snapshot.output;
    const b = run().at(-1)?.snapshot.output;
    expect(a).toEqual(b);
  });
});

describe("attentionSequence — snapshot immutability", () => {
  it("mutating one step's matrix does not leak into later steps", () => {
    const steps = run();
    const first = steps[0];
    (first.snapshot.embeddings as number[][])[0][0] = 999;
    const last = steps.at(-1);
    expect(last?.snapshot.embeddings[0][0]).not.toBe(999);
  });
});

describe("attentionSequence — codeLines annotation", () => {
  const lineCount = attentionPython.split("\n").length;
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

describe("attentionSequence — property-based", () => {
  const finite = () => fc.double({ min: -2, max: 2, noNaN: true });
  const row = () => fc.tuple(finite(), finite());

  it("attention rows always sum to 1 and outputs stay in convex hull of V rows", () => {
    fc.assert(
      fc.property(
        fc.tuple(row(), row(), row()),
        fc.tuple(row(), row()),
        fc.tuple(row(), row()),
        fc.tuple(row(), row()),
        (X, wQ, wK, wV) => {
          const params: AttentionParams = {
            embeddings: X.map((r) => [...r]),
            tokenLabels: ["t1", "t2", "t3"],
            wQ: wQ.map((r) => [...r]),
            wK: wK.map((r) => [...r]),
            wV: wV.map((r) => [...r]),
          };
          const last = [...attentionSequence(params)].at(-1);
          const attention: Matrix = last?.snapshot.attention ?? [];
          const v: Matrix = last?.snapshot.v ?? [];
          const output: Matrix = last?.snapshot.output ?? [];

          for (const r of attention) {
            const sum = r.reduce((s, x) => s + x, 0);
            expect(sum).toBeCloseTo(1, 8);
          }
          for (let d = 0; d < v[0].length; d++) {
            const vColumn = v.map((r) => r[d]);
            const minV = Math.min(...vColumn);
            const maxV = Math.max(...vColumn);
            for (const yRow of output) {
              expect(yRow[d]).toBeGreaterThanOrEqual(minV - 1e-8);
              expect(yRow[d]).toBeLessThanOrEqual(maxV + 1e-8);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("attentionSequence — causal mask", () => {
  function runCausal(p: AttentionParams = DEMO_PARAMS): readonly AttentionStep[] {
    return [...attentionSequence({ ...p, mask: "causal" })];
  }

  it("emits exactly one mask-scores step between scale-scores and softmax", () => {
    const kinds = runCausal().map((s) => s.kind);
    expect(kinds).toEqual([
      "begin",
      "project-q",
      "project-k",
      "project-v",
      "compute-scores",
      "scale-scores",
      "mask-scores",
      "softmax",
      "weighted-sum",
      "done",
    ]);
  });

  it("non-causal (default) still emits the original nine-step sequence", () => {
    const kinds = [...attentionSequence(DEMO_PARAMS)].map((s) => s.kind);
    expect(kinds).not.toContain("mask-scores");
    expect(kinds).toHaveLength(9);
  });

  it("masked snapshot's upper triangle is -Infinity, diagonal and lower keep their values", () => {
    const masked = runCausal().find((s) => s.kind === "mask-scores");
    if (masked?.kind !== "mask-scores") throw new Error("expected mask-scores");
    const m = masked.snapshot.masked as Matrix;
    expect(m).toBeDefined();
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m[i].length; j++) {
        if (j > i) {
          expect(m[i][j]).toBe(-Infinity);
        } else {
          // Below + on the diagonal: equal to the pre-mask scaled value.
          const scaled = masked.snapshot.scaled as Matrix;
          expect(m[i][j]).toBe(scaled[i][j]);
        }
      }
    }
  });

  it("attention matrix is lower triangular: row i has zeros in columns j > i", () => {
    const last = runCausal().at(-1);
    const a = last?.snapshot.attention as Matrix;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < a[i].length; j++) {
        if (j > i) expect(a[i][j]).toBe(0);
      }
    }
  });

  it("row 0 attention is [1, 0, 0] — token 0 can only attend to itself", () => {
    const last = runCausal().at(-1);
    const a = last?.snapshot.attention as Matrix;
    expect(a[0][0]).toBeCloseTo(1, 10);
    expect(a[0][1]).toBe(0);
    expect(a[0][2]).toBe(0);
  });

  it("every causal-attention row still sums to 1 within fp tolerance", () => {
    const last = runCausal().at(-1);
    const a = last?.snapshot.attention as Matrix;
    for (const row of a) {
      const sum = row.reduce((s, x) => s + x, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("causal Y[0] equals V[0] exactly — token 0's output is its own value, no mixing", () => {
    const last = runCausal().at(-1);
    const y = last?.snapshot.output as Matrix;
    const v = last?.snapshot.v as Matrix;
    expect(y[0]).toEqual(v[0]);
  });

  it("scaled snapshot on the mask-scores step still holds the un-masked values (audit trail)", () => {
    const masked = runCausal().find((s) => s.kind === "mask-scores");
    if (masked?.kind !== "mask-scores") throw new Error("expected mask-scores");
    // The pre-mask scaled scores are preserved so the viz can render
    // "before/after" comparisons.
    const scaled = masked.snapshot.scaled as Matrix;
    for (const row of scaled) {
      for (const v of row) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("non-causal output differs from causal output on the same params", () => {
    const causalY = [...attentionSequence({ ...DEMO_PARAMS, mask: "causal" })].at(-1)?.snapshot
      .output as Matrix;
    const plainY = [...attentionSequence(DEMO_PARAMS)].at(-1)?.snapshot.output as Matrix;
    // Y[0] differs (causal can only see V[0]; plain mixes all three).
    expect(causalY[0]).not.toEqual(plainY[0]);
  });

  it("every causal-attention step's codeLines fall within the causal snippet's source", () => {
    const lineCount = causalAttentionPython.split("\n").length;
    for (const s of runCausal()) {
      for (const ln of s.codeLines ?? []) {
        expect(ln).toBeGreaterThanOrEqual(1);
        expect(ln).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("non-causal mode never sets masked on any snapshot", () => {
    for (const s of [...attentionSequence(DEMO_PARAMS)]) {
      expect(s.snapshot.masked).toBeUndefined();
    }
  });

  it("property: causal attention rows always sum to 1 and are zero in the upper triangle", () => {
    const finite = () => fc.double({ min: -2, max: 2, noNaN: true });
    const row = () => fc.tuple(finite(), finite());
    fc.assert(
      fc.property(
        fc.tuple(row(), row(), row()),
        fc.tuple(row(), row()),
        fc.tuple(row(), row()),
        fc.tuple(row(), row()),
        (X, wQ, wK, wV) => {
          const last = [
            ...attentionSequence({
              embeddings: X.map((r) => [...r]),
              tokenLabels: ["t1", "t2", "t3"],
              wQ: wQ.map((r) => [...r]),
              wK: wK.map((r) => [...r]),
              wV: wV.map((r) => [...r]),
              mask: "causal",
            }),
          ].at(-1);
          const a = last?.snapshot.attention as Matrix;
          for (let i = 0; i < a.length; i++) {
            const sum = a[i].reduce((s, x) => s + x, 0);
            expect(sum).toBeCloseTo(1, 8);
            for (let j = i + 1; j < a[i].length; j++) {
              expect(a[i][j]).toBe(0);
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("applyCausalMask", () => {
  it("sets every j>i entry to -Infinity and leaves j<=i unchanged", () => {
    const out = applyCausalMask([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(out).toEqual([
      [1, -Infinity, -Infinity],
      [4, 5, -Infinity],
      [7, 8, 9],
    ]);
  });

  it("returns a fresh array — input is not mutated", () => {
    const input = [
      [1, 2],
      [3, 4],
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    applyCausalMask(input);
    expect(input).toEqual(snapshot);
  });
});
