import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { bubbleSort } from "@/lib/algorithms/bubbleSort";
import { bubbleSortPython } from "@/lib/algorithms/bubbleSort.snippet";

function runToCompletion(input: readonly number[]) {
  const steps = [...bubbleSort(input)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") {
    throw new Error("generator did not yield a 'done' step last");
  }
  return { steps, finalArray: last.array };
}

describe("bubbleSort", () => {
  it("returns the exact step sequence for [3, 1, 2]", () => {
    const steps = [...bubbleSort([3, 1, 2])];
    expect(steps).toEqual([
      { kind: "compare", indices: [0, 1], array: [3, 1, 2], codeLines: [5] },
      { kind: "swap", indices: [0, 1], array: [1, 3, 2], codeLines: [6] },
      { kind: "compare", indices: [1, 2], array: [1, 3, 2], codeLines: [5] },
      { kind: "swap", indices: [1, 2], array: [1, 2, 3], codeLines: [6] },
      { kind: "compare", indices: [0, 1], array: [1, 2, 3], codeLines: [5] },
      { kind: "done", array: [1, 2, 3], codeLines: [7] },
    ]);
  });

  it("yields only a 'done' step for an empty array", () => {
    expect([...bubbleSort([])]).toEqual([{ kind: "done", array: [], codeLines: [7] }]);
  });

  it("yields only a 'done' step for a single-element array", () => {
    expect([...bubbleSort([42])]).toEqual([{ kind: "done", array: [42], codeLines: [7] }]);
  });

  it("property: every step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = bubbleSortPython.split("\n").length;
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 12 }), (input) => {
        for (const step of bubbleSort(input)) {
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
    const input = [3, 1, 2];
    const snapshot = [...input];
    void [...bubbleSort(input)];
    expect(input).toEqual(snapshot);
  });

  it("each emitted array is a fresh copy (not aliased)", () => {
    const steps = [...bubbleSort([2, 1])];
    const arrays = steps.map((s) => s.array);
    for (let i = 0; i < arrays.length; i++) {
      for (let j = i + 1; j < arrays.length; j++) {
        expect(arrays[i]).not.toBe(arrays[j]);
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

  it("property: 'compare' is always emitted at indices [j, j+1] and 'swap' only when arr[j] > arr[j+1]", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 20 }), (input) => {
        const steps = [...bubbleSort(input)];
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
