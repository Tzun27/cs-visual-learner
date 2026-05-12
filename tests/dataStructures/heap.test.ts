import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildHeap,
  heapExtractMinSequence,
  heapInsertSequence,
  isMinHeap,
} from "@/lib/dataStructures/heap";
import { heapExtractMinPython } from "@/lib/dataStructures/heapExtractMin.snippet";
import { heapInsertPython } from "@/lib/dataStructures/heapInsert.snippet";
import type { HeapExtractStep, HeapSnapshot } from "@/lib/dataStructures/types";

function runInserts(initial: readonly number[], values: readonly number[]) {
  const steps = [...heapInsertSequence(initial, values)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") throw new Error("expected 'done' last");
  return { steps, final: last.heap };
}

function runExtracts(initial: readonly number[], count: number) {
  const steps = [...heapExtractMinSequence(initial, count)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") throw new Error("expected 'done' last");
  return { steps, final: last.heap };
}

function snapshotLiveValues(s: HeapSnapshot): number[] {
  return s.heap.slice(0, s.size).slice();
}

describe("heapInsertSequence", () => {
  it("yields only a 'done' step for an empty input on an empty heap", () => {
    const steps = [...heapInsertSequence([], [])];
    expect(steps).toEqual([{ kind: "done", heap: { heap: [], size: 0 }, codeLines: [11] }]);
  });

  it("places a single value at index 0 with no compare", () => {
    const { steps, final } = runInserts([], [42]);
    expect(steps.map((s) => s.kind)).toEqual(["begin", "append", "settle", "done"]);
    expect(final).toEqual({ heap: [42], size: 1 });
  });

  it("bubbles a smaller value to the root via swap-up", () => {
    const { steps, final } = runInserts([5], [3]);
    // begin → append → compare-parent → swap-up → settle → done
    expect(steps.map((s) => s.kind)).toEqual([
      "begin",
      "append",
      "compare-parent",
      "swap-up",
      "settle",
      "done",
    ]);
    expect(final.heap).toEqual([3, 5]);
  });

  it("settles immediately when the inserted value is >= parent", () => {
    const { steps, final } = runInserts([3], [7]);
    expect(steps.map((s) => s.kind)).toEqual([
      "begin",
      "append",
      "compare-parent",
      "settle",
      "done",
    ]);
    expect(final.heap).toEqual([3, 7]);
  });

  it("bubbles across multiple levels via two swap-ups (insert new minimum)", () => {
    // start with the heap [1, 3, 5, 4, 8, 7]. Insert 0 → bubbles 6→2→0.
    const initial = [1, 3, 5, 4, 8, 7];
    expect(isMinHeap({ heap: initial, size: initial.length })).toBe(true);
    const { steps, final } = runInserts(initial, [0]);
    const swaps = steps.filter((s) => s.kind === "swap-up");
    expect(swaps).toHaveLength(2);
    expect(final.heap).toEqual([0, 3, 1, 4, 8, 7, 5]);
    expect(isMinHeap(final)).toBe(true);
  });

  it("every emitted insert step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = heapInsertPython.split("\n").length;
    for (const step of heapInsertSequence([], [4, 9, 1, 7, 2, 8, 3])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("each insert yields exactly one 'settle' step", () => {
    const inserts = [4, 9, 1, 7, 2, 8, 3];
    const steps = [...heapInsertSequence([], inserts)];
    const settles = steps.filter((s) => s.kind === "settle");
    expect(settles).toHaveLength(inserts.length);
  });

  it("does not mutate its input arrays", () => {
    const initial = [1, 3, 5];
    const values = [2, 4];
    const initialBefore = [...initial];
    const valuesBefore = [...values];
    void [...heapInsertSequence(initial, values)];
    expect(initial).toEqual(initialBefore);
    expect(values).toEqual(valuesBefore);
  });

  it("emits fresh heap arrays per step, not aliased mutable refs", () => {
    const steps = [...heapInsertSequence([], [4, 1, 7, 2])];
    const heaps = steps.map((s) => s.heap.heap);
    for (let i = 0; i < heaps.length; i++) {
      for (let j = i + 1; j < heaps.length; j++) {
        expect(heaps[i]).not.toBe(heaps[j]);
      }
    }
  });

  it("property: every non-pre-swap snapshot satisfies the min-heap invariant", () => {
    // The transient is on the compare-parent step itself — the new value sits
    // at the end and may violate the invariant against its parent. The very
    // next step is either swap-up (restoring it one level) or settle (no
    // violation existed). swap-up restores invariant locally, but if the
    // bubbling chain is longer, the value still violates against its NEW
    // grandparent. So intermediate snapshots can be invalid; only 'settle'
    // and 'done' are guaranteed valid.
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 20 }), (vals) => {
        for (const step of heapInsertSequence([], vals)) {
          if (step.kind === "settle" || step.kind === "done") {
            expect(isMinHeap(step.heap)).toBe(true);
          }
        }
      }),
    );
  });

  it("property: building a heap then extracting all values yields sorted order", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 25 }), (vals) => {
        const built = buildHeap(vals);
        expect(isMinHeap(built)).toBe(true);
        const extractSteps = [...heapExtractMinSequence(built.heap, vals.length)];
        const extracted: number[] = [];
        for (const s of extractSteps) {
          if (s.kind === "take-root") extracted.push(s.extractedValue);
        }
        const sorted = [...vals].sort((a, b) => a - b);
        expect(extracted).toEqual(sorted);
      }),
    );
  });
});

describe("heapExtractMinSequence", () => {
  it("yields only a 'done' step when count is 0", () => {
    expect([...heapExtractMinSequence([1, 2, 3], 0)]).toEqual([
      { kind: "done", heap: { heap: [1, 2, 3], size: 3 }, codeLines: [21] },
    ]);
  });

  it("emits 'empty' when extracting from an empty heap", () => {
    const steps = [...heapExtractMinSequence([], 1)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "empty", "done"]);
  });

  it("single-element extract is just begin → take-root → done", () => {
    const steps = [...heapExtractMinSequence([7], 1)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "take-root", "done"]);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.heap.heap).toEqual([]);
  });

  it("two-element extract: take root, move last, settle (last is now root, no children)", () => {
    const steps = [...heapExtractMinSequence([1, 5], 1)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "take-root", "move-last", "settle", "done"]);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.heap.heap).toEqual([5]);
  });

  it("sifts down through swap-down: extract root from [1, 3, 2, 7, 9, 5]", () => {
    // After take-root + move-last: heap[0] = 5, heap = [5, 3, 2, 7, 9].
    // Compare with children 3,2 → smallest=2 (right) → swap-down → cursor=2.
    // heap = [2, 3, 5, 7, 9]. At cursor=2, no children → settle.
    const steps = [...heapExtractMinSequence([1, 3, 2, 7, 9, 5], 1)];
    const kinds = steps.map((s) => s.kind);
    expect(kinds).toContain("swap-down");
    const swaps = steps.filter((s) => s.kind === "swap-down");
    expect(swaps).toHaveLength(1);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.heap.heap).toEqual([2, 3, 5, 7, 9]);
    expect(isMinHeap(last.heap)).toBe(true);
  });

  it("extracts multiple values in ascending order", () => {
    const initial = buildHeap([5, 3, 8, 1, 9, 2, 7]);
    const steps = [...heapExtractMinSequence(initial.heap, 4)];
    const extracted = steps
      .filter((s): s is HeapExtractStep & { kind: "take-root" } => s.kind === "take-root")
      .map((s) => s.extractedValue);
    expect(extracted).toEqual([1, 2, 3, 5]);
  });

  it("every emitted extract step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = heapExtractMinPython.split("\n").length;
    const initial = buildHeap([5, 3, 8, 1, 9, 2, 7]);
    for (const step of heapExtractMinSequence(initial.heap, 5)) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate its input array", () => {
    const initial = [1, 3, 5, 7];
    const before = [...initial];
    void [...heapExtractMinSequence(initial, 3)];
    expect(initial).toEqual(before);
  });

  it("emits fresh heap arrays per step, not aliased mutable refs", () => {
    const steps = [...heapExtractMinSequence([1, 3, 2, 7, 9, 5], 2)];
    const heaps = steps.map((s) => s.heap.heap);
    for (let i = 0; i < heaps.length; i++) {
      for (let j = i + 1; j < heaps.length; j++) {
        expect(heaps[i]).not.toBe(heaps[j]);
      }
    }
  });

  it("the right-child-smaller branch is exercised: extract from [1, 5, 2, 7]", () => {
    // After move-last: heap = [7, 5, 2]. Smallest of 7/5/2 = 2 (right). swap-down.
    const steps = [...heapExtractMinSequence([1, 5, 2, 7], 1)];
    const compares = steps.filter(
      (s): s is HeapExtractStep & { kind: "compare-children" } => s.kind === "compare-children",
    );
    expect(compares.length).toBeGreaterThan(0);
    // The smallest in the first compare should be the right (index 2).
    expect(compares[0].smallerIndex).toBe(2);
    expect(compares[0].rightIndex).toBe(2);
  });

  it("property: after k extracts on a heap of size n (k<=n), result has size n-k and is still a min-heap", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 25 }),
        fc.integer({ min: 1, max: 25 }),
        (vals, k) => {
          const built = buildHeap(vals);
          const extractCount = Math.min(k, vals.length);
          const { final } = runExtracts(built.heap, extractCount);
          expect(final.size).toBe(vals.length - extractCount);
          expect(isMinHeap(final)).toBe(true);
          const sortedTail = [...vals].sort((a, b) => a - b).slice(extractCount);
          expect(snapshotLiveValues(final).sort((a, b) => a - b)).toEqual(sortedTail);
        },
      ),
    );
  });
});

describe("isMinHeap", () => {
  it("returns true for the empty heap", () => {
    expect(isMinHeap({ heap: [], size: 0 })).toBe(true);
  });

  it("returns true for any single-element heap", () => {
    expect(isMinHeap({ heap: [42], size: 1 })).toBe(true);
  });

  it("returns false when a child is smaller than its parent", () => {
    expect(isMinHeap({ heap: [5, 3, 7], size: 3 })).toBe(false);
  });

  it("ignores values past size", () => {
    expect(isMinHeap({ heap: [1, 3, 2, 99], size: 3 })).toBe(true);
  });
});

describe("buildHeap", () => {
  it("returns the empty snapshot for an empty input", () => {
    expect(buildHeap([])).toEqual({ heap: [], size: 0 });
  });

  it("produces a valid min-heap for arbitrary inputs", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 20 }), (vals) => {
        const heap = buildHeap(vals);
        expect(isMinHeap(heap)).toBe(true);
        expect(heap.size).toBe(vals.length);
      }),
    );
  });
});
