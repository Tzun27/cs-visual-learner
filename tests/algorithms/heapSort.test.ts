import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { heapSort } from "@/lib/algorithms/heapSort";
import { heapSortPython } from "@/lib/algorithms/heapSort.snippet";

function runToCompletion(input: readonly number[]) {
  const steps = [...heapSort(input)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") {
    throw new Error("generator did not yield a 'done' step last");
  }
  return { steps, finalArray: last.array };
}

describe("heapSort", () => {
  it("yields only a 'done' step for an empty array", () => {
    expect([...heapSort([])]).toEqual([{ kind: "done", array: [], codeLines: [10] }]);
  });

  it("yields only a 'done' step for a single-element array", () => {
    expect([...heapSort([42])]).toEqual([{ kind: "done", array: [42], codeLines: [10] }]);
  });

  it("property: every step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = heapSortPython.split("\n").length;
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 12 }), (input) => {
        for (const step of heapSort(input)) {
          expect(step.codeLines).toBeDefined();
          expect(step.codeLines!.length).toBeGreaterThan(0);
          for (const line of step.codeLines!) {
            expect(line).toBeGreaterThanOrEqual(1);
            expect(line).toBeLessThanOrEqual(lineCount);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("does not mutate its input", () => {
    const input = [3, 1, 4, 1, 5, 9, 2, 6];
    const snapshot = [...input];
    void [...heapSort(input)];
    expect(input).toEqual(snapshot);
  });

  it("opens with a 'range' step covering the whole array (the initial heap region)", () => {
    const steps = [...heapSort([3, 1, 2])];
    expect(steps[0]).toEqual({
      kind: "range",
      range: [0, 2],
      array: [3, 1, 2],
      codeLines: [4, 5],
    });
  });

  it("returns the exact step sequence for [3, 1, 2]", () => {
    const steps = [...heapSort([3, 1, 2])];
    expect(steps).toEqual([
      { kind: "range", range: [0, 2], array: [3, 1, 2], codeLines: [4, 5] },
      { kind: "compare", indices: [0, 1], array: [3, 1, 2], range: [0, 2], codeLines: [19, 20] },
      { kind: "compare", indices: [0, 2], array: [3, 1, 2], range: [0, 2], codeLines: [21, 22] },
      { kind: "swap", indices: [0, 2], array: [2, 1, 3], range: [0, 1], codeLines: [8] },
      { kind: "range", range: [0, 1], array: [2, 1, 3], codeLines: [9] },
      { kind: "compare", indices: [0, 1], array: [2, 1, 3], range: [0, 1], codeLines: [19, 20] },
      { kind: "swap", indices: [0, 1], array: [1, 2, 3], range: [0, 0], codeLines: [8] },
      { kind: "done", array: [1, 2, 3], codeLines: [10] },
    ]);
  });

  it("the heap-region range monotonically shrinks across the extraction phase", () => {
    const steps = [...heapSort([5, 3, 8, 2, 7, 1, 4, 6])];
    const ranges = steps.filter((s) => s.kind === "range").map((s) => s.range[1] - s.range[0] + 1);
    // The first range covers the whole array; subsequent ranges (one per extraction
    // that leaves a non-trivial heap) cover progressively smaller prefixes.
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]).toBeLessThan(ranges[i - 1]);
    }
  });

  it("every swap during extraction places a value at or before the current heap upper bound", () => {
    const steps = [...heapSort([5, 3, 8, 2, 7, 1, 4])];
    let heapUpperBound = 6;
    for (const step of steps) {
      if (step.kind === "range") heapUpperBound = step.range[1];
      if (step.kind === "swap" && step.range) {
        const [, hi] = step.indices;
        expect(hi).toBeLessThanOrEqual(heapUpperBound + 1);
      }
    }
  });

  it("property: final array is sorted ascending and is a permutation of the input", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -100, max: 100 }), { maxLength: 50 }), (input) => {
        const { finalArray } = runToCompletion(input);
        const expected = [...input].sort((a, b) => a - b);
        expect([...finalArray]).toEqual(expected);
      }),
      { numRuns: 1000 },
    );
  });

  it("property: every step's array is a permutation of the input", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 30 }), (input) => {
        const expectedSorted = [...input].sort((a, b) => a - b);
        for (const step of heapSort(input)) {
          expect(step.array).toHaveLength(input.length);
          expect([...step.array].sort((a, b) => a - b)).toEqual(expectedSorted);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("handles already-sorted input correctly", () => {
    const { finalArray } = runToCompletion([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...finalArray]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("handles reverse-sorted input correctly", () => {
    const { finalArray } = runToCompletion([8, 7, 6, 5, 4, 3, 2, 1]);
    expect([...finalArray]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("handles all-duplicate input correctly", () => {
    const { finalArray } = runToCompletion([4, 4, 4, 4, 4]);
    expect([...finalArray]).toEqual([4, 4, 4, 4, 4]);
  });

  it("handles a two-element input correctly", () => {
    expect(runToCompletion([2, 1]).finalArray).toEqual([1, 2]);
    expect(runToCompletion([1, 2]).finalArray).toEqual([1, 2]);
  });
});
