import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  concatHorizontal,
  multiHeadAttentionSequence,
  type MultiHeadAttentionParams,
} from "@/lib/ml/multiHeadAttention";
import { multiHeadAttentionPython } from "@/lib/ml/multiHeadAttention.snippet";
import type { Matrix, MultiHeadAttentionStep } from "@/lib/ml/types";

// The lesson's curated demo. 3 tokens × d_embed=4, 2 heads with d_k=d_v=2.
// Both heads share a clean structure where Y rows are hand-verifiable.
const DEMO_PARAMS: MultiHeadAttentionParams = {
  embeddings: [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [1, 1, 0, 1],
  ],
  tokenLabels: ["t1", "t2", "t3"],
  wQ: [
    // Head 1: identity-like — Q^(1) = X[:, :2]
    [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ],
    // Head 2: swap — Q^(2) flips the first two embedding dims
    [
      [0, 1],
      [1, 0],
      [0, 0],
      [0, 0],
    ],
  ],
  wK: [
    // Head 1: identity-like — same as W_Q^(1)
    [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ],
    // Head 2: identity-like — same shape as head 1's K so the score matrix
    // for head 2 differs only via head 2's Q (not its K).
    [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ],
  ],
  wV: [
    // Head 1: identity-like — V^(1) = X[:, :2]
    [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ],
    // Head 2: asymmetric — uses the third embedding dimension and inverts
    // the second, so Y^(2) carries different numerical signatures than Y^(1).
    [
      [2, 0],
      [0, -1],
      [0, 0],
      [1, 0],
    ],
  ],
  wO: [
    // Identity 4×4 — final Y equals concat for the demo. Real W_O is learned.
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ],
};

function close(a: number, b: number, eps = 1e-3): boolean {
  return Math.abs(a - b) < eps;
}

function expectMatrixClose(actual: Matrix, expected: ReadonlyArray<ReadonlyArray<number>>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i].length).toBe(expected[i].length);
    for (let j = 0; j < expected[i].length; j++) {
      if (!close(actual[i][j], expected[i][j])) {
        throw new Error(
          `matrix mismatch at [${i}][${j}]: expected ${expected[i][j]}, got ${actual[i][j]}`,
        );
      }
    }
  }
}

describe("concatHorizontal", () => {
  it("returns [] for zero matrices", () => {
    expect(concatHorizontal([])).toEqual([]);
  });

  it("stitches per-head output matrices into a single wide matrix", () => {
    const out = concatHorizontal([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ]);
    expect(out).toEqual([
      [1, 2, 5, 6],
      [3, 4, 7, 8],
    ]);
  });

  it("does not alias the source rows", () => {
    const a = [[1, 2]];
    const out = concatHorizontal([a, a]);
    out[0][0] = 99;
    expect(a[0][0]).toBe(1);
  });
});

describe("multiHeadAttentionSequence", () => {
  it("throws when head counts disagree across W_Q/W_K/W_V", () => {
    expect(() => [
      ...multiHeadAttentionSequence({
        ...DEMO_PARAMS,
        wK: [DEMO_PARAMS.wK[0]],
      }),
    ]).toThrow(/matching lengths/);
  });

  it("throws when given zero heads", () => {
    expect(() => [
      ...multiHeadAttentionSequence({
        ...DEMO_PARAMS,
        wQ: [],
        wK: [],
        wV: [],
      }),
    ]).toThrow(/at least one head/);
  });

  it("emits the full per-head + concat + project-output sequence", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const kinds = steps.map((s) => s.kind);
    // begin + (7 per-head steps × 2 heads = 14) + concat-heads + project-output + done = 18
    expect(kinds.length).toBe(18);
    expect(kinds[0]).toBe("begin");
    expect(kinds[kinds.length - 1]).toBe("done");
    expect(kinds.filter((k) => k === "project-q")).toHaveLength(2);
    expect(kinds.filter((k) => k === "project-k")).toHaveLength(2);
    expect(kinds.filter((k) => k === "project-v")).toHaveLength(2);
    expect(kinds.filter((k) => k === "compute-scores")).toHaveLength(2);
    expect(kinds.filter((k) => k === "scale-scores")).toHaveLength(2);
    expect(kinds.filter((k) => k === "softmax")).toHaveLength(2);
    expect(kinds.filter((k) => k === "weighted-sum")).toHaveLength(2);
    expect(kinds.filter((k) => k === "concat-heads")).toHaveLength(1);
    expect(kinds.filter((k) => k === "project-output")).toHaveLength(1);
  });

  it("per-head steps walk head 0 to completion before starting head 1", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const headIndices: number[] = [];
    for (const s of steps) {
      if ("headIndex" in s) headIndices.push(s.headIndex);
    }
    // Head 0 fires 7 times consecutively, then head 1 fires 7 times consecutively.
    expect(headIndices).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]);
  });

  it("activeHead is set during head phases and clear during begin/concat/project-output/done", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    for (const s of steps) {
      if (
        s.kind === "begin" ||
        s.kind === "done" ||
        s.kind === "concat-heads" ||
        s.kind === "project-output"
      ) {
        expect(s.snapshot.activeHead).toBeUndefined();
      } else {
        expect(s.snapshot.activeHead).toBe(s.headIndex);
      }
    }
  });

  it("head 1's Q1, K1, V1 all equal X[:, :2] under the identity-like demo matrices", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    const expectedQ1 = [
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    expectMatrixClose(done.snapshot.heads[0].q!, expectedQ1);
    expectMatrixClose(done.snapshot.heads[0].k!, expectedQ1);
    expectMatrixClose(done.snapshot.heads[0].v!, expectedQ1);
  });

  it("head 1's output Y^(1) matches hand-computed [[0.802, 0.599], [0.599, 0.802], [0.752, 0.752]]", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    expectMatrixClose(done.snapshot.heads[0].output!, [
      [0.8023, 0.5989],
      [0.5989, 0.8023],
      [0.7518, 0.7518],
    ]);
  });

  it("head 2 has Q^(2) = swap of head 1's Q rows pairwise — Q[0] = [0, 1] etc.", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    expectMatrixClose(done.snapshot.heads[1].q!, [
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it("head 2's output Y^(2) matches hand-computed [[1.599, -0.802], [2.006, -0.599], [2.007, -0.752]]", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    expectMatrixClose(done.snapshot.heads[1].output!, [
      [1.5989, -0.8023],
      [2.0057, -0.5989],
      [2.007, -0.7518],
    ]);
  });

  it("concat-heads produces the per-head outputs glued side by side (3 × 4)", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    expectMatrixClose(done.snapshot.concat!, [
      [0.8023, 0.5989, 1.5989, -0.8023],
      [0.5989, 0.8023, 2.0057, -0.5989],
      [0.7518, 0.7518, 2.007, -0.7518],
    ]);
  });

  it("with identity W_O, the final output equals the concat", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    expectMatrixClose(done.snapshot.output!, done.snapshot.concat!);
  });

  it("every emitted step carries codeLines inside the displayed Python source", () => {
    const lineCount = multiHeadAttentionPython.split("\n").length;
    for (const step of multiHeadAttentionSequence(DEMO_PARAMS)) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("per-head state appears as the head's loop progresses (no field appears before its step)", () => {
    const steps: MultiHeadAttentionStep[] = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    // For head 0: before the project-q step, head 0's q is undefined; after it, defined.
    const beforeQ = steps.find((s) => s.kind === "begin");
    if (beforeQ?.kind !== "begin") throw new Error("expected begin");
    expect(beforeQ.snapshot.heads[0].q).toBeUndefined();
    expect(beforeQ.snapshot.heads[1].q).toBeUndefined();

    const afterHead0ProjectQ = steps.find((s) => s.kind === "project-q" && s.headIndex === 0);
    if (afterHead0ProjectQ?.kind !== "project-q") throw new Error("expected project-q");
    expect(afterHead0ProjectQ.snapshot.heads[0].q).toBeDefined();
    // Head 1 hasn't started yet — its q must still be undefined.
    expect(afterHead0ProjectQ.snapshot.heads[1].q).toBeUndefined();
  });

  it("concat field is undefined until concat-heads fires", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const beforeConcat = steps.findIndex((s) => s.kind === "concat-heads");
    for (let i = 0; i < beforeConcat; i++) {
      expect(steps[i].snapshot.concat).toBeUndefined();
    }
    expect(steps[beforeConcat].snapshot.concat).toBeDefined();
  });

  it("output field is undefined until project-output fires", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const projectOutputIdx = steps.findIndex((s) => s.kind === "project-output");
    for (let i = 0; i < projectOutputIdx; i++) {
      expect(steps[i].snapshot.output).toBeUndefined();
    }
    expect(steps[projectOutputIdx].snapshot.output).toBeDefined();
  });

  it("does not alias prior snapshots — mutating a head's output array doesn't affect future snapshots", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const weighted = steps.find((s) => s.kind === "weighted-sum" && s.headIndex === 0);
    if (weighted?.kind !== "weighted-sum") throw new Error("expected weighted-sum");
    // Cast to mutable for the mutation test.
    const out = weighted.snapshot.heads[0].output! as number[][];
    out[0][0] = 999;
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    expect(done.snapshot.heads[0].output![0][0]).not.toBe(999);
  });

  it("attention rows always sum to ~1 in every head's softmax output", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    for (const head of done.snapshot.heads) {
      const A = head.attention!;
      for (const row of A) {
        const sum = row.reduce((s, x) => s + x, 0);
        expect(close(sum, 1, 1e-6)).toBe(true);
      }
    }
  });

  it("scaled scores equal raw scores times 1/√d_k", () => {
    const steps = [...multiHeadAttentionSequence(DEMO_PARAMS)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    const dk = 2;
    const factor = 1 / Math.sqrt(dk);
    for (const head of done.snapshot.heads) {
      const raw = head.scores!;
      const scaled = head.scaled!;
      for (let i = 0; i < raw.length; i++) {
        for (let j = 0; j < raw[i].length; j++) {
          expect(close(scaled[i][j], raw[i][j] * factor, 1e-9)).toBe(true);
        }
      }
    }
  });

  it("property: output rows always have the right shape (rows = tokens, cols = d_embed)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), (extraTokens) => {
        const baseEmbed = DEMO_PARAMS.embeddings as ReadonlyArray<ReadonlyArray<number>>;
        const newEmbed = [...baseEmbed];
        for (let i = 0; i < extraTokens; i++) newEmbed.push([0, 0, 1, 1]);
        const newLabels = DEMO_PARAMS.tokenLabels.concat(
          Array.from({ length: extraTokens }, (_, i) => `tx${i}`),
        );
        const steps = [
          ...multiHeadAttentionSequence({
            ...DEMO_PARAMS,
            embeddings: newEmbed,
            tokenLabels: newLabels,
          }),
        ];
        const done = steps.at(-1);
        if (done?.kind !== "done") throw new Error("expected done");
        expect(done.snapshot.output!.length).toBe(newEmbed.length);
        expect(done.snapshot.output![0].length).toBe(4); // d_embed = 4
      }),
    );
  });
});
