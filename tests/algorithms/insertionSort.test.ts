import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { insertionSort } from "@/lib/algorithms/insertionSort";
import { insertionSortPython } from "@/lib/algorithms/insertionSort.snippet";

function runToCompletion(input: readonly number[]) {
  const steps = [...insertionSort(input)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") {
    throw new Error("generator did not yield a 'done' step last");
  }
  return { steps, finalArray: last.array };
}

describe("insertionSort", () => {
  it("returns the exact step sequence for [3, 1, 2]", () => {
    const steps = [...insertionSort([3, 1, 2])];
    expect(steps).toEqual([
      { kind: "compare", indices: [0, 1], array: [3, 1, 2], codeLines: [4] },
      { kind: "swap", indices: [0, 1], array: [1, 3, 2], codeLines: [5, 6] },
      { kind: "compare", indices: [1, 2], array: [1, 3, 2], codeLines: [4] },
      { kind: "swap", indices: [1, 2], array: [1, 2, 3], codeLines: [5, 6] },
      { kind: "compare", indices: [0, 1], array: [1, 2, 3], codeLines: [4] },
      { kind: "done", array: [1, 2, 3], codeLines: [7] },
    ]);
  });

  it("yields only a 'done' step for an empty array", () => {
    expect([...insertionSort([])]).toEqual([{ kind: "done", array: [], codeLines: [7] }]);
  });

  it("yields only a 'done' step for a single-element array", () => {
    expect([...insertionSort([42])]).toEqual([{ kind: "done", array: [42], codeLines: [7] }]);
  });

  it("property: every step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = insertionSortPython.split("\n").length;
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 12 }), (input) => {
        for (const step of insertionSort(input)) {
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
    void [...insertionSort(input)];
    expect(input).toEqual(snapshot);
  });

  it("each emitted array is a fresh copy (not aliased)", () => {
    const steps = [...insertionSort([2, 1])];
    const arrays = steps.map((s) => s.array);
    for (let i = 0; i < arrays.length; i++) {
      for (let j = i + 1; j < arrays.length; j++) {
        expect(arrays[i]).not.toBe(arrays[j]);
      }
    }
  });

  it("breaks out of the inner loop early on already-sorted input (one compare per outer step, no swaps)", () => {
    const steps = [...insertionSort([1, 2, 3, 4, 5])];
    const compares = steps.filter((s) => s.kind === "compare");
    const swaps = steps.filter((s) => s.kind === "swap");
    // For a sorted array of length n, each outer iteration emits exactly one compare
    // and zero swaps before breaking.
    expect(compares).toHaveLength(4);
    expect(swaps).toHaveLength(0);
  });

  it("reverse-sorted input requires the maximum number of swaps", () => {
    const steps = [...insertionSort([5, 4, 3, 2, 1])];
    const swaps = steps.filter((s) => s.kind === "swap");
    // Sum 1..n-1 = n(n-1)/2 = 10 for n=5.
    expect(swaps).toHaveLength(10);
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
        for (const step of insertionSort(input)) {
          expect(step.array).toHaveLength(input.length);
          expect([...step.array].sort((a, b) => a - b)).toEqual(expectedSorted);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("property: 'compare' precedes any 'swap' at the same indices and only swaps when arr[j-1] > arr[j]", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 20 }), (input) => {
        const steps = [...insertionSort(input)];
        for (let i = 0; i < steps.length - 1; i++) {
          const step = steps[i];
          if (step.kind === "compare") {
            const [a, b] = step.indices;
            expect(b).toBe(a + 1);
            const next = steps[i + 1];
            if (next?.kind === "swap") {
              expect(next.indices).toEqual([a, b]);
              expect(step.array[a]).toBeGreaterThan(step.array[b]);
            }
          }
        }
      }),
      { numRuns: 500 },
    );
  });
});
