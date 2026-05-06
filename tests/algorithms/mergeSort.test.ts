import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { mergeSort } from "@/lib/algorithms/mergeSort";

function runToCompletion(input: readonly number[]) {
  const steps = [...mergeSort(input)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") {
    throw new Error("generator did not yield a 'done' step last");
  }
  return { steps, finalArray: last.array };
}

describe("mergeSort", () => {
  it("yields only a 'done' step for an empty array", () => {
    expect([...mergeSort([])]).toEqual([{ kind: "done", array: [] }]);
  });

  it("yields only a 'done' step for a single-element array", () => {
    expect([...mergeSort([42])]).toEqual([{ kind: "done", array: [42] }]);
  });

  it("does not mutate its input", () => {
    const input = [3, 1, 4, 1, 5, 9, 2, 6];
    const snapshot = [...input];
    void [...mergeSort(input)];
    expect(input).toEqual(snapshot);
  });

  it("emits 'range' steps wrapping each merge call", () => {
    const steps = [...mergeSort([3, 1, 2, 4])];
    const ranges = steps.filter((s) => s.kind === "range").map((s) => s.range);
    // There are 3 merges for an array of length 4: merges [0,1], [2,3], [0,3].
    expect(ranges).toEqual([
      [0, 1],
      [2, 3],
      [0, 3],
    ]);
  });

  it("write step indices stay within their containing range", () => {
    const steps = [...mergeSort([5, 3, 8, 2, 7, 1])];
    let currentRange: readonly [number, number] | undefined;
    for (const step of steps) {
      if (step.kind === "range") currentRange = step.range;
      if (step.kind === "write" && step.range) {
        expect(step.index).toBeGreaterThanOrEqual(step.range[0]);
        expect(step.index).toBeLessThanOrEqual(step.range[1]);
        expect(step.range).toEqual(currentRange);
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

  it("property: every step's array has the same length as the input", () => {
    // We do NOT require the multiset to match at every step — the in-place merge
    // legitimately overwrites positions before the displaced value is re-placed.
    // The final 'done' array IS a permutation, asserted by the previous test.
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 30 }), (input) => {
        for (const step of mergeSort(input)) {
          expect(step.array).toHaveLength(input.length);
        }
      }),
      { numRuns: 200 },
    );
  });
});
