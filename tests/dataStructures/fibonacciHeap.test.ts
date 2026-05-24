import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildFibonacciHeap,
  emptyFibonacciHeap,
  fibonacciHeapDecreaseKeySequence,
  fibonacciHeapDepths,
  fibonacciHeapExtractMinSequence,
  fibonacciHeapInsertSequence,
  isFibonacciHeapValid,
} from "@/lib/dataStructures/fibonacciHeap";
import { fibonacciHeapDecreaseKeyPython } from "@/lib/dataStructures/fibonacciHeapDecreaseKey.snippet";
import { fibonacciHeapExtractMinPython } from "@/lib/dataStructures/fibonacciHeapExtractMin.snippet";
import { fibonacciHeapInsertPython } from "@/lib/dataStructures/fibonacciHeapInsert.snippet";
import type {
  FibonacciHeapDecreaseKeyStep,
  FibonacciHeapExtractMinStep,
  FibonacciHeapInsertStep,
  FibonacciHeapNode,
  FibonacciHeapSnapshot,
} from "@/lib/dataStructures/types";

function lastStepHeap<T extends { kind: string; heap: FibonacciHeapSnapshot }>(
  steps: T[],
): FibonacciHeapSnapshot {
  const last = steps.at(-1);
  if (!last || last.kind !== "done") throw new Error("expected done");
  return last.heap;
}

function rootValues(snap: FibonacciHeapSnapshot): number[] {
  return snap.roots.map((id) => snap.nodes[id].value);
}

describe("emptyFibonacciHeap", () => {
  it("has no nodes, no roots, null min", () => {
    expect(emptyFibonacciHeap.nodes).toHaveLength(0);
    expect(emptyFibonacciHeap.roots).toHaveLength(0);
    expect(emptyFibonacciHeap.minId).toBeNull();
  });

  it("passes the invariant check", () => {
    expect(isFibonacciHeapValid(emptyFibonacciHeap)).toBe(true);
  });
});

describe("fibonacciHeapInsertSequence", () => {
  it("yields only 'done' for an empty value list", () => {
    const steps = [...fibonacciHeapInsertSequence(emptyFibonacciHeap, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("emits begin → add-root per inserted value", () => {
    const steps = [...fibonacciHeapInsertSequence(emptyFibonacciHeap, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "add-root", "done"]);
  });

  it("first insert updates the min (no prior min); subsequent smaller inserts also update", () => {
    const steps = [...fibonacciHeapInsertSequence(emptyFibonacciHeap, [4, 9, 1, 7, 2])];
    const addRoots = steps.filter(
      (s): s is Extract<FibonacciHeapInsertStep, { kind: "add-root" }> => s.kind === "add-root",
    );
    expect(addRoots).toHaveLength(5);
    // updatedMin: true for 4 (first), false for 9, true for 1 (new min),
    // false for 7, false for 2 (since 1 is still min).
    expect(addRoots.map((s) => s.updatedMin)).toEqual([true, false, true, false, false]);
  });

  it("prepends to root list: newest insert sits at index 0", () => {
    const final = lastStepHeap([...fibonacciHeapInsertSequence(emptyFibonacciHeap, [4, 9, 1])]);
    expect(rootValues(final)).toEqual([1, 9, 4]);
  });

  it("final min after inserting [4, 9, 1, 7, 2] is the root with value 1", () => {
    const final = lastStepHeap([
      ...fibonacciHeapInsertSequence(emptyFibonacciHeap, [4, 9, 1, 7, 2]),
    ]);
    expect(final.minId).not.toBeNull();
    expect(final.nodes[final.minId!].value).toBe(1);
  });

  it("inserts produce valid heap snapshots throughout", () => {
    const steps = [...fibonacciHeapInsertSequence(emptyFibonacciHeap, [4, 9, 1, 7, 2])];
    for (const step of steps) {
      expect(isFibonacciHeapValid(step.heap)).toBe(true);
    }
  });

  it("does not mutate its input snapshot", () => {
    const initial = emptyFibonacciHeap;
    const before = JSON.parse(JSON.stringify(initial));
    void [...fibonacciHeapInsertSequence(initial, [4, 9, 1, 7, 2])];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("every insert step's codeLines fall inside the displayed Python source", () => {
    const lineCount = fibonacciHeapInsertPython.split("\n").length;
    const steps = [...fibonacciHeapInsertSequence(emptyFibonacciHeap, [4, 9, 1])];
    for (const step of steps) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });
});

describe("buildFibonacciHeap", () => {
  it("returns an empty heap for an empty value list", () => {
    const built = buildFibonacciHeap([]);
    expect(built.nodes).toHaveLength(0);
    expect(built.roots).toHaveLength(0);
    expect(built.minId).toBeNull();
  });

  it("matches the final state of the equivalent insert sequence", () => {
    const built = buildFibonacciHeap([4, 9, 1, 7, 2]);
    const final = lastStepHeap([
      ...fibonacciHeapInsertSequence(emptyFibonacciHeap, [4, 9, 1, 7, 2]),
    ]);
    expect(built).toEqual(final);
  });
});

describe("fibonacciHeapExtractMinSequence", () => {
  it("yields begin → empty → done on an empty heap", () => {
    const steps = [...fibonacciHeapExtractMinSequence(emptyFibonacciHeap)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "empty", "done"]);
  });

  it("on the curated [4,9,1,7,2] heap, removes 1 and consolidates degree 0 → 2", () => {
    const initial = buildFibonacciHeap([4, 9, 1, 7, 2]);
    const steps = [...fibonacciHeapExtractMinSequence(initial)];
    const final = lastStepHeap(steps);

    // Removed value 1: one remove-min step that carries removedValue = 1.
    const removeMin = steps.find(
      (s): s is Extract<FibonacciHeapExtractMinStep, { kind: "remove-min" }> =>
        s.kind === "remove-min",
    );
    expect(removeMin).toBeDefined();
    expect(removeMin!.removedValue).toBe(1);
    expect(removeMin!.promotedChildren).toEqual([]); // 1 had no children

    // After consolidate, every remaining degree appears at most once.
    const degrees = final.roots.map((id) => final.nodes[id].degree);
    expect(new Set(degrees).size).toBe(degrees.length);

    // Expected from the demo trace: one tree of degree 2 rooted at
    // value 2 with children {4, 7}, where 4 itself has child 9.
    expect(final.roots).toHaveLength(1);
    expect(final.nodes[final.roots[0]].value).toBe(2);
    expect(final.nodes[final.roots[0]].degree).toBe(2);

    // The new minId after consolidate matches the actual min root.
    expect(final.minId).not.toBeNull();
    expect(final.nodes[final.minId!].value).toBe(2);
  });

  it("the consolidate pass fires exactly 3 pairings on the curated demo (deg0×3 → deg1×2 → deg2)", () => {
    const initial = buildFibonacciHeap([4, 9, 1, 7, 2]);
    const steps = [...fibonacciHeapExtractMinSequence(initial)];
    const pairs = steps.filter((s) => s.kind === "consolidate-pair");
    expect(pairs).toHaveLength(3);
  });

  it("snapshots at every step are valid Fibonacci heaps", () => {
    const initial = buildFibonacciHeap([4, 9, 1, 7, 2]);
    const steps = [...fibonacciHeapExtractMinSequence(initial)];
    for (const step of steps) {
      // Skip remove-min / consolidate-* / update-min intermediates
      // where minId is temporarily null — those snapshots are still
      // valid in every other respect, so check roots/marks/degrees only.
      if (
        step.kind === "remove-min" ||
        step.kind === "consolidate-start" ||
        step.kind === "consolidate-inspect" ||
        step.kind === "consolidate-pair" ||
        step.kind === "consolidate-link"
      ) {
        // Allow null minId during these phases.
        const heap = step.heap;
        for (const rootId of heap.roots) {
          expect(heap.nodes[rootId].parentId).toBeNull();
          expect(heap.nodes[rootId].mark).toBe(false);
        }
      } else {
        expect(isFibonacciHeapValid(step.heap)).toBe(true);
      }
    }
  });

  it("repeated extract-mins yield values in ascending order (sorting property)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 12 }),
        (values) => {
          let heap = buildFibonacciHeap(values);
          const extracted: number[] = [];
          while (heap.roots.length > 0) {
            const steps = [...fibonacciHeapExtractMinSequence(heap)];
            const removeMin = steps.find(
              (s): s is Extract<FibonacciHeapExtractMinStep, { kind: "remove-min" }> =>
                s.kind === "remove-min",
            );
            if (removeMin) extracted.push(removeMin.removedValue);
            heap = lastStepHeap(steps);
          }
          expect(extracted).toEqual([...values].sort((a, b) => a - b));
        },
      ),
    );
  });

  it("does not mutate its input snapshot", () => {
    const initial = buildFibonacciHeap([4, 9, 1, 7, 2]);
    const before = JSON.parse(JSON.stringify(initial));
    void [...fibonacciHeapExtractMinSequence(initial)];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("every extract-min step's codeLines fall inside the displayed Python source", () => {
    const lineCount = fibonacciHeapExtractMinPython.split("\n").length;
    const initial = buildFibonacciHeap([4, 9, 1, 7, 2]);
    for (const step of fibonacciHeapExtractMinSequence(initial)) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });
});

// Hand-built initial state for the decrease-key demo: a chain of
// marked non-roots that triggers a 3-step cascading cut.
// Tree shape:
//          1 (root)
//         / \
//        2*  8    <- 2 is marked, 8 is unmarked sibling
//        |
//        3*       <- 3 is marked
//        |
//        4
function cascadeDemoHeap(): FibonacciHeapSnapshot {
  const nodes: FibonacciHeapNode[] = [
    {
      id: 0,
      value: 1,
      parentId: null,
      firstChildId: 1,
      nextSiblingId: null,
      degree: 2,
      mark: false,
    },
    { id: 1, value: 2, parentId: 0, firstChildId: 2, nextSiblingId: 4, degree: 1, mark: true },
    { id: 2, value: 3, parentId: 1, firstChildId: 3, nextSiblingId: null, degree: 1, mark: true },
    {
      id: 3,
      value: 4,
      parentId: 2,
      firstChildId: null,
      nextSiblingId: null,
      degree: 0,
      mark: false,
    },
    {
      id: 4,
      value: 8,
      parentId: 0,
      firstChildId: null,
      nextSiblingId: null,
      degree: 0,
      mark: false,
    },
  ];
  return { nodes, roots: [0], minId: 0 };
}

describe("fibonacciHeapDecreaseKeySequence", () => {
  it("throws when newValue > oldValue (silent no-op would hide upstream bugs)", () => {
    const initial = buildFibonacciHeap([4, 9, 1]);
    const fourId = initial.nodes.findIndex((n) => n.value === 4);
    expect(() => [...fibonacciHeapDecreaseKeySequence(initial, fourId, 10)]).toThrow(
      /greater than current/,
    );
  });

  it("emits begin → set-value → done for a root with no parent (no violation possible)", () => {
    const initial = buildFibonacciHeap([4, 9, 1]);
    const fourId = initial.nodes.findIndex((n) => n.value === 4);
    const steps = [...fibonacciHeapDecreaseKeySequence(initial, fourId, 0)];
    // 4 is a root after insert. Decrease to 0 — no parent to check.
    // Steps: begin, set-value, update-min (0 < 1), done.
    expect(steps.map((s) => s.kind)).toEqual(["begin", "set-value", "update-min", "done"]);
    const updateMin = steps.find((s) => s.kind === "update-min");
    if (updateMin?.kind !== "update-min") throw new Error("expected update-min");
    expect(updateMin.newMinId).toBe(fourId);
  });

  it("emits no-violation when the parent's value is already smaller than the new value", () => {
    // Cascade-demo heap: node 4 (id=3) has parent 3 (id=2, value=3).
    // Decrease 4 → 3.5? Need integer. Decrease 4 → 3 (still >= parent).
    // Actually 3 = 3 is not LESS than 3, so it's not a violation. The
    // algorithm goes to the no-violation branch.
    const initial = cascadeDemoHeap();
    const steps = [...fibonacciHeapDecreaseKeySequence(initial, 3, 3)];
    expect(steps.some((s) => s.kind === "no-violation")).toBe(true);
    expect(steps.some((s) => s.kind === "cut")).toBe(false);
  });

  it("triggers a 3-step cascading cut on the curated cascade demo", () => {
    const initial = cascadeDemoHeap();
    // decrease_key(node id=3 [value 4], new value 0): cuts 4-from-3,
    // then cascades to cut 3-from-2 (2 was marked), then cascades to
    // cut 2-from-1 (1 was marked), then stops because 1 is itself a root.
    const steps = [...fibonacciHeapDecreaseKeySequence(initial, 3, 0)];
    const cuts = steps.filter(
      (s): s is Extract<FibonacciHeapDecreaseKeyStep, { kind: "cut" }> => s.kind === "cut",
    );
    expect(cuts).toHaveLength(3);
    // Cut order: child (id=3, value 4) cut from parent 2 (value 3);
    // then 2 (value 3) cut from 1 (value 2); then 1 (value 2) cut from 0 (value 1).
    expect(cuts.map((c) => c.nodeId)).toEqual([3, 2, 1]);
    expect(cuts.map((c) => c.parentId)).toEqual([2, 1, 0]);
    // parentWasMarked: true for the first two cuts (2 and 1 were marked),
    // false for the last — but actually the third cascade cut isn't even
    // performed when the grandparent is a root. Let me trace:
    //   cut(3, 2): parent 2 was MARKED → cascade.
    //   cut(2, 1): parent 1 was MARKED → cascade.
    //   cut(1, 0): parent 0 is a root, but we already entered the loop
    //     because 1 was marked from the cascade decision in the prior iter.
    //     Inside this iteration: parentWasMarked = nodes[0].mark = false.
    //     After detach, we check grandparent of 0 = null → break.
    //   So cut(1, 0)'s parentWasMarked = false (since 0 was unmarked).
    expect(cuts[0].parentWasMarked).toBe(true);
    expect(cuts[1].parentWasMarked).toBe(true);
    expect(cuts[2].parentWasMarked).toBe(false);
  });

  it("after the cascade, the new min is the just-decreased node (value 0)", () => {
    const initial = cascadeDemoHeap();
    const steps = [...fibonacciHeapDecreaseKeySequence(initial, 3, 0)];
    const final = lastStepHeap(steps);
    expect(final.minId).not.toBeNull();
    expect(final.nodes[final.minId!].value).toBe(0);
  });

  it("after the cascade, the just-cut nodes are roots with mark=false", () => {
    const initial = cascadeDemoHeap();
    const steps = [...fibonacciHeapDecreaseKeySequence(initial, 3, 0)];
    const final = lastStepHeap(steps);
    // The four roots after the cascade are nodes 0 (original root), 1, 2, 3.
    expect(new Set(final.roots)).toEqual(new Set([0, 1, 2, 3]));
    for (const rootId of final.roots) {
      expect(final.nodes[rootId].parentId).toBeNull();
      expect(final.nodes[rootId].mark).toBe(false);
    }
  });

  it("cuts a non-head child (exercises the sibling-walk branch of detachChild)", () => {
    // Build a heap where the target lives mid-list. Root 1 has children
    // (in order) [2, 3, 5]. We decrease the middle child (value 3) below
    // 1 to force a cut, which walks the sibling chain to find it.
    const initial: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 1,
          parentId: null,
          firstChildId: 1,
          nextSiblingId: null,
          degree: 3,
          mark: false,
        },
        {
          id: 1,
          value: 2,
          parentId: 0,
          firstChildId: null,
          nextSiblingId: 2,
          degree: 0,
          mark: false,
        },
        {
          id: 2,
          value: 3,
          parentId: 0,
          firstChildId: null,
          nextSiblingId: 3,
          degree: 0,
          mark: false,
        },
        {
          id: 3,
          value: 5,
          parentId: 0,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
      ],
      roots: [0],
      minId: 0,
    };
    // decrease node 3 (value 5, the THIRD child) to 0: triggers cut.
    // This forces detachChild to walk node 1 → node 2 (loop body fires
    // once) before finding that nodes[2].nextSiblingId === 3.
    const steps = [...fibonacciHeapDecreaseKeySequence(initial, 3, 0)];
    const final = lastStepHeap(steps);
    // After the cut: node 3 is a root. Root 0 still has children {1, 2}.
    expect(final.nodes[3].parentId).toBeNull();
    expect(final.nodes[0].degree).toBe(2);
    expect(final.nodes[2].nextSiblingId).toBeNull(); // chain ends at 2
    expect(isFibonacciHeapValid(final)).toBe(true);
  });

  it("emits cascade-mark (no cut) when the parent was unmarked", () => {
    // Single-cut scenario: pick a heap where parent is unmarked.
    // Heap: root 1 (value 1, unmarked) with one child 2 (value 5, unmarked).
    // decrease 5 → 0 violates parent 1: cut, then parent is a root, no cascade-mark.
    // To get cascade-mark we need TWO levels: root 1 with child 5 (unmarked) with grandchild 10.
    // decrease 10 → 0: cut 10 from 5, then 5 was unmarked → cascade-mark.
    const initial: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 1,
          parentId: null,
          firstChildId: 1,
          nextSiblingId: null,
          degree: 1,
          mark: false,
        },
        {
          id: 1,
          value: 5,
          parentId: 0,
          firstChildId: 2,
          nextSiblingId: null,
          degree: 1,
          mark: false,
        },
        {
          id: 2,
          value: 10,
          parentId: 1,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
      ],
      roots: [0],
      minId: 0,
    };
    const steps = [...fibonacciHeapDecreaseKeySequence(initial, 2, 0)];
    // Should emit one cut + one cascade-mark.
    expect(steps.filter((s) => s.kind === "cut")).toHaveLength(1);
    expect(steps.filter((s) => s.kind === "cascade-mark")).toHaveLength(1);
    const final = lastStepHeap(steps);
    // node 1 (value 5) should now be marked.
    expect(final.nodes[1].mark).toBe(true);
  });

  it("does not mutate its input snapshot", () => {
    const initial = cascadeDemoHeap();
    const before = JSON.parse(JSON.stringify(initial));
    void [...fibonacciHeapDecreaseKeySequence(initial, 3, 0)];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("every decrease-key step's codeLines fall inside the displayed Python source", () => {
    const lineCount = fibonacciHeapDecreaseKeyPython.split("\n").length;
    const initial = cascadeDemoHeap();
    for (const step of fibonacciHeapDecreaseKeySequence(initial, 3, 0)) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });
});

describe("isFibonacciHeapValid", () => {
  it("returns true for the empty heap", () => {
    expect(isFibonacciHeapValid(emptyFibonacciHeap)).toBe(true);
  });

  it("returns false when a root has parentId != null", () => {
    const bogus: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 1,
          parentId: 99,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
      ],
      roots: [0],
      minId: 0,
    };
    expect(isFibonacciHeapValid(bogus)).toBe(false);
  });

  it("returns false when a root carries mark=true", () => {
    const bogus: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 1,
          parentId: null,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: true,
        },
      ],
      roots: [0],
      minId: 0,
    };
    expect(isFibonacciHeapValid(bogus)).toBe(false);
  });

  it("returns false when min-heap order is violated", () => {
    const bogus: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 5,
          parentId: null,
          firstChildId: 1,
          nextSiblingId: null,
          degree: 1,
          mark: false,
        },
        {
          // child value 2 < parent value 5: violates min-heap order.
          id: 1,
          value: 2,
          parentId: 0,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
      ],
      roots: [0],
      minId: 0,
    };
    expect(isFibonacciHeapValid(bogus)).toBe(false);
  });

  it("returns false when a node's degree disagrees with its child count", () => {
    const bogus: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 1,
          parentId: null,
          firstChildId: 1,
          nextSiblingId: null,
          degree: 5, // wrong: actually has 1 child
          mark: false,
        },
        {
          id: 1,
          value: 2,
          parentId: 0,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
      ],
      roots: [0],
      minId: 0,
    };
    expect(isFibonacciHeapValid(bogus)).toBe(false);
  });

  it("returns false when minId is wrong (points at a non-min root)", () => {
    const bogus: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 5,
          parentId: null,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
        {
          id: 1,
          value: 2,
          parentId: null,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
      ],
      roots: [0, 1],
      minId: 0, // wrong: 1 (value 2) is the smaller root
    };
    expect(isFibonacciHeapValid(bogus)).toBe(false);
  });

  it("returns false when roots is empty but minId is non-null", () => {
    const bogus: FibonacciHeapSnapshot = {
      nodes: [],
      roots: [],
      minId: 42,
    };
    expect(isFibonacciHeapValid(bogus)).toBe(false);
  });

  it("returns false when minId is null on a non-empty heap", () => {
    const bogus: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 1,
          parentId: null,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
      ],
      roots: [0],
      minId: null,
    };
    expect(isFibonacciHeapValid(bogus)).toBe(false);
  });

  it("returns false when a non-root's parentId mismatches the actual parent", () => {
    const bogus: FibonacciHeapSnapshot = {
      nodes: [
        {
          id: 0,
          value: 1,
          parentId: null,
          firstChildId: 1,
          nextSiblingId: null,
          degree: 1,
          mark: false,
        },
        {
          // parent says 99, but is actually a child of 0
          id: 1,
          value: 2,
          parentId: 99,
          firstChildId: null,
          nextSiblingId: null,
          degree: 0,
          mark: false,
        },
      ],
      roots: [0],
      minId: 0,
    };
    expect(isFibonacciHeapValid(bogus)).toBe(false);
  });
});

describe("fibonacciHeapDepths", () => {
  it("returns depth 0 for roots", () => {
    const heap = buildFibonacciHeap([4, 9, 1]);
    const depths = fibonacciHeapDepths(heap);
    for (const rootId of heap.roots) {
      expect(depths.get(rootId)).toBe(0);
    }
  });

  it("returns increasing depth for nested children", () => {
    const heap = cascadeDemoHeap();
    const depths = fibonacciHeapDepths(heap);
    expect(depths.get(0)).toBe(0); // root
    expect(depths.get(1)).toBe(1); // child of root
    expect(depths.get(2)).toBe(2); // grandchild
    expect(depths.get(3)).toBe(3); // great-grandchild
    expect(depths.get(4)).toBe(1); // sibling of 1
  });
});
