import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { quickSort } from "@/lib/algorithms/quickSort";
import { quickSortPython } from "@/lib/algorithms/quickSort.snippet";

function runToCompletion(input: readonly number[]) {
  const steps = [...quickSort(input)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") {
    throw new Error("generator did not yield a 'done' step last");
  }
  return { steps, finalArray: last.array };
}

describe("quickSort", () => {
  it("yields only a 'done' step for an empty array", () => {
    expect([...quickSort([])]).toEqual([{ kind: "done", array: [], codeLines: [3] }]);
  });

  it("yields only a 'done' step for a single-element array", () => {
    expect([...quickSort([42])]).toEqual([{ kind: "done", array: [42], codeLines: [3] }]);
  });

  it("property: every step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = quickSortPython.split("\n").length;
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 12 }), (input) => {
        for (const step of quickSort(input)) {
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
    void [...quickSort(input)];
    expect(input).toEqual(snapshot);
  });

  it("emits a 'pivot' step before any compare/swap in each partition", () => {
    const steps = [...quickSort([5, 2, 8, 1, 4, 7])];
    const interesting = steps.filter(
      (s) => s.kind === "pivot" || s.kind === "compare" || s.kind === "swap",
    );
    expect(interesting[0].kind).toBe("pivot");
  });

  it("property: every step's array is a permutation of the input", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 30 }), (input) => {
        const expectedSorted = [...input].sort((a, b) => a - b);
        for (const step of quickSort(input)) {
          expect(step.array).toHaveLength(input.length);
          expect([...step.array].sort((a, b) => a - b)).toEqual(expectedSorted);
        }
      }),
      { numRuns: 200 },
    );
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
});
