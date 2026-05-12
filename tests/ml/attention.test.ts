import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  attentionSequence,
  matmul,
  rowSoftmax,
  transpose,
  type AttentionParams,
} from "@/lib/ml/attention";
import { attentionPython } from "@/lib/ml/attention.snippet";
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
