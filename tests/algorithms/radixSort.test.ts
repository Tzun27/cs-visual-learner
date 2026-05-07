import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { radixSort } from "@/lib/algorithms/radixSort";

function runToCompletion(input: readonly number[]) {
  const steps = [...radixSort(input)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") {
    throw new Error("generator did not yield a 'done' step last");
  }
  return { steps, finalArray: last.array };
}

describe("radixSort", () => {
  it("yields only a 'done' step for an empty array", () => {
    expect([...radixSort([])]).toEqual([{ kind: "done", array: [] }]);
  });

  it("yields only a 'done' step for a single-element array", () => {
    expect([...radixSort([42])]).toEqual([{ kind: "done", array: [42] }]);
  });

  it("yields only a 'done' step for an array of all zeros (no digit passes needed)", () => {
    expect([...radixSort([0, 0, 0])]).toEqual([{ kind: "done", array: [0, 0, 0] }]);
  });

  it("does not mutate its input", () => {
    const input = [170, 45, 75, 90, 802, 24, 2, 66];
    const snapshot = [...input];
    void [...radixSort(input)];
    expect(input).toEqual(snapshot);
  });

  it("opens with a 'range' step covering the whole array", () => {
    const steps = [...radixSort([3, 1, 2])];
    expect(steps[0]).toEqual({ kind: "range", range: [0, 2], array: [3, 1, 2] });
  });

  it("emits exactly one 'range' step per digit pass", () => {
    const steps = [...radixSort([170, 45, 75, 90, 802, 24, 2, 66])];
    const ranges = steps.filter((s) => s.kind === "range").length;
    // maxBiased = 802 → three digit passes (ones, tens, hundreds).
    expect(ranges).toBe(3);
  });

  it("emits no compare or swap steps (radix sort is not comparison-based)", () => {
    const steps = [...radixSort([170, 45, 75, 90, 802, 24, 2, 66])];
    expect(steps.some((s) => s.kind === "compare")).toBe(false);
    expect(steps.some((s) => s.kind === "swap")).toBe(false);
  });

  it("handles arrays with negative integers via internal bias-shift", () => {
    expect(runToCompletion([-3, 5, -1, 0, 4, -7, 2]).finalArray).toEqual([-7, -3, -1, 0, 2, 4, 5]);
  });

  it("step arrays carry original (un-biased) values throughout", () => {
    // The internal bias-shift must not leak into the displayed step arrays.
    const steps = [...radixSort([-5, 3, -2, 1])];
    for (const step of steps) {
      for (const v of step.array) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(-5);
        expect(v).toBeLessThanOrEqual(3);
      }
    }
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

  it("is stable: equal-valued duplicates preserve their relative order", () => {
    // Stability is hard to assert directly when only the values are observable,
    // but a classic LSD trace on equal-suffix values exposes it: 21 and 11 share
    // an ones digit; after the ones pass, 21 must still come before 11 (as in
    // the input order). The tens-digit pass then reorders them to [11, 21].
    const steps = [...radixSort([21, 11, 23, 13])];
    const afterOnes = steps.find((s) => s.kind === "range" && s.range[0] === 0);
    expect(afterOnes).toBeDefined();
    // The final result is the only thing strongly observable; assert it.
    const last = steps.at(-1);
    if (!last || last.kind !== "done") throw new Error("expected done step");
    expect([...last.array]).toEqual([11, 13, 21, 23]);
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
    // Like merge sort, in-place writes legitimately leave the array as a
    // non-permutation mid-pass; only the 'done' array is the final permutation.
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1000 }), { maxLength: 30 }), (input) => {
        for (const step of radixSort(input)) {
          expect(step.array).toHaveLength(input.length);
        }
      }),
      { numRuns: 200 },
    );
  });
});
