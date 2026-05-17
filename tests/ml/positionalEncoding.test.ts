import { describe, it, expect } from "vitest";
import {
  positionalEncodingSequence,
  sinusoidalPE,
  type PositionalEncodingParams,
} from "@/lib/ml/positionalEncoding";
import { positionalEncodingPython } from "@/lib/ml/positionalEncoding.snippet";
import type { Matrix, PositionalEncodingStep } from "@/lib/ml/types";

const DEMO_PARAMS: PositionalEncodingParams = {
  embeddings: [
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  tokenLabels: ["t1", "t2", "t3"],
};

function run(p: PositionalEncodingParams = DEMO_PARAMS): readonly PositionalEncodingStep[] {
  return [...positionalEncodingSequence(p)];
}

describe("sinusoidalPE", () => {
  it("PE(0) for d_model=2 is [sin(0), cos(0)] = [0, 1]", () => {
    const pe = sinusoidalPE(1, 2);
    expect(pe).toEqual([[Math.sin(0), Math.cos(0)]]);
    expect(pe[0][0]).toBe(0);
    expect(pe[0][1]).toBe(1);
  });

  it("PE(1) for d_model=2 is [sin(1), cos(1)]", () => {
    const pe = sinusoidalPE(2, 2);
    expect(pe[1][0]).toBeCloseTo(Math.sin(1), 12);
    expect(pe[1][1]).toBeCloseTo(Math.cos(1), 12);
  });

  it("for d_model=2 the wavelength is 2π (since denom=1)", () => {
    // PE(pos, 0) = sin(pos), so it repeats every 2π positions.
    const pe = sinusoidalPE(5, 2);
    expect(pe[0][0]).toBeCloseTo(0, 12);
    expect(pe[1][0]).toBeCloseTo(Math.sin(1), 12);
    expect(pe[2][0]).toBeCloseTo(Math.sin(2), 12);
  });

  it("for d_model=4 the second pair uses denominator 100 (= 10000^(1/2))", () => {
    const pe = sinusoidalPE(1, 4);
    // PE[0] should still be [sin(0), cos(0), sin(0), cos(0)] = [0,1,0,1].
    expect(pe[0]).toEqual([0, 1, 0, 1]);
    const pe1 = sinusoidalPE(2, 4);
    // PE[1, 2] = sin(1/100), PE[1, 3] = cos(1/100)
    expect(pe1[1][2]).toBeCloseTo(Math.sin(0.01), 12);
    expect(pe1[1][3]).toBeCloseTo(Math.cos(0.01), 12);
  });

  it("returns a matrix of shape (numTokens, dModel)", () => {
    const pe = sinusoidalPE(5, 4);
    expect(pe.length).toBe(5);
    for (const row of pe) expect(row.length).toBe(4);
  });

  it("each row's elements stay in [-1, 1] (sin and cos bounds)", () => {
    const pe = sinusoidalPE(20, 8);
    for (const row of pe) {
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("positionalEncodingSequence", () => {
  it("emits begin → compute-pe-row (n times) → add → done", () => {
    const steps = run();
    expect(steps.map((s) => s.kind)).toEqual([
      "begin",
      "compute-pe-row",
      "compute-pe-row",
      "compute-pe-row",
      "add",
      "done",
    ]);
  });

  it("on begin, no PE rows are revealed yet", () => {
    const steps = run();
    const beg = steps[0];
    if (beg.kind !== "begin") throw new Error("expected begin");
    expect(beg.snapshot.revealedRows).toBeUndefined();
  });

  it("after compute-pe-row i, revealedRows === i + 1", () => {
    const steps = run();
    const computeSteps = steps.filter((s) => s.kind === "compute-pe-row");
    expect(computeSteps).toHaveLength(3);
    for (let i = 0; i < computeSteps.length; i++) {
      const s = computeSteps[i];
      if (s.kind !== "compute-pe-row") throw new Error("type");
      expect(s.rowIndex).toBe(i);
      expect(s.snapshot.revealedRows).toBe(i + 1);
    }
  });

  it("after compute-pe-row i, PE rows 0..i match sinusoidalPE and rows i+1..n-1 are all zero", () => {
    const steps = run();
    const expected = sinusoidalPE(3, 2);
    const compute = steps.filter((s) => s.kind === "compute-pe-row");
    for (let i = 0; i < compute.length; i++) {
      const s = compute[i];
      if (s.kind !== "compute-pe-row") throw new Error("type");
      const pe = s.snapshot.pe as Matrix;
      for (let r = 0; r <= i; r++) {
        for (let c = 0; c < pe[r].length; c++) {
          expect(pe[r][c]).toBeCloseTo(expected[r][c], 12);
        }
      }
      for (let r = i + 1; r < pe.length; r++) {
        for (const v of pe[r]) expect(v).toBe(0);
      }
    }
  });

  it("add step computes X + PE element-wise (hand-verified row 0)", () => {
    const steps = run();
    const add = steps.find((s) => s.kind === "add");
    if (add?.kind !== "add") throw new Error("expected add");
    // Row 0: X=[1,0], PE=[0,1]. Combined = [1, 1].
    expect(add.snapshot.combined?.[0]).toEqual([1, 1]);
  });

  it("add step's combined matrix has the same shape as embeddings", () => {
    const steps = run();
    const add = steps.find((s) => s.kind === "add");
    if (add?.kind !== "add") throw new Error("expected add");
    const c = add.snapshot.combined as Matrix;
    expect(c.length).toBe(DEMO_PARAMS.embeddings.length);
    for (let i = 0; i < c.length; i++) {
      expect(c[i].length).toBe(DEMO_PARAMS.embeddings[i].length);
    }
  });

  it("done step retains the combined matrix", () => {
    const last = run().at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.snapshot.combined).toBeDefined();
  });

  it("combined matrix rows are now distinct (PE breaks permutation symmetry)", () => {
    // Without PE, two tokens with equal X rows would be indistinguishable
    // to attention. Adding PE gives every row a unique position fingerprint
    // so even if X rows match, X' rows do not.
    const sameEmbeddings: PositionalEncodingParams = {
      embeddings: [
        [0.5, 0.5],
        [0.5, 0.5],
        [0.5, 0.5],
      ],
      tokenLabels: ["a", "b", "c"],
    };
    const last = run(sameEmbeddings).at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    const c = last.snapshot.combined as Matrix;
    expect(c[0]).not.toEqual(c[1]);
    expect(c[1]).not.toEqual(c[2]);
    expect(c[0]).not.toEqual(c[2]);
  });

  it("does not mutate the input embeddings", () => {
    const input: number[][] = [
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const before = JSON.parse(JSON.stringify(input));
    void [...positionalEncodingSequence({ embeddings: input, tokenLabels: ["a", "b", "c"] })];
    expect(input).toEqual(before);
  });

  it("emits fresh snapshot PE arrays per step (no aliasing)", () => {
    const steps = run();
    for (let i = 0; i < steps.length; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        expect(steps[i].snapshot.pe).not.toBe(steps[j].snapshot.pe);
      }
    }
  });

  it("every emitted step's codeLines fall within the snippet's line count", () => {
    const lineCount = positionalEncodingPython.split("\n").length;
    for (const step of run()) {
      const lines = step.codeLines ?? [];
      for (const ln of lines) {
        expect(ln).toBeGreaterThanOrEqual(1);
        expect(ln).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("handles a single-token sequence (n = 1)", () => {
    const steps = [...positionalEncodingSequence({ embeddings: [[1, 0]], tokenLabels: ["only"] })];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "compute-pe-row", "add", "done"]);
  });
});
