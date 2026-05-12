import { describe, it, expect } from "vitest";
import {
  buildPairingHeap,
  emptyPairingHeap,
  pairingHeapDeleteMinSequence,
  pairingHeapDepths,
  pairingHeapMergeSequence,
} from "@/lib/dataStructures/pairingHeap";
import { pairingHeapDeleteMinPython } from "@/lib/dataStructures/pairingHeapDeleteMin.snippet";
import { pairingHeapMergePython } from "@/lib/dataStructures/pairingHeapMerge.snippet";
import type { PairingHeapSnapshot } from "@/lib/dataStructures/types";

function getValuesByRoot(heap: PairingHeapSnapshot): number[] {
  return heap.roots.map((id) => heap.nodes[id].value);
}

function getChildren(heap: PairingHeapSnapshot, parentId: number): number[] {
  const out: number[] = [];
  let cur = heap.nodes[parentId].firstChildId;
  while (cur !== null) {
    out.push(cur);
    cur = heap.nodes[cur].nextSiblingId;
  }
  return out;
}

describe("emptyPairingHeap", () => {
  it("is an empty snapshot (no nodes, no roots)", () => {
    expect(emptyPairingHeap.nodes).toEqual([]);
    expect(emptyPairingHeap.roots).toEqual([]);
  });
});

describe("buildPairingHeap", () => {
  it("returns the empty snapshot for an empty input", () => {
    const heap = buildPairingHeap([]);
    expect(heap.roots).toEqual([]);
    expect(heap.nodes).toEqual([]);
  });

  it("constructs a single-node heap with the value at the root", () => {
    const heap = buildPairingHeap([42]);
    expect(heap.roots).toHaveLength(1);
    expect(heap.nodes[heap.roots[0]].value).toBe(42);
  });

  it("merges incrementally — the minimum surfaces to the root", () => {
    const heap = buildPairingHeap([5, 3, 8, 1, 9, 7]);
    expect(heap.roots).toHaveLength(1);
    expect(heap.nodes[heap.roots[0]].value).toBe(1);
  });

  it("preserves the min-heap invariant: every child's value ≥ its parent's", () => {
    const heap = buildPairingHeap([5, 3, 8, 1, 9, 7, 2, 4, 6]);
    for (const node of heap.nodes) {
      for (const childId of getChildren(heap, node.id)) {
        expect(heap.nodes[childId].value).toBeGreaterThanOrEqual(node.value);
      }
    }
  });
});

describe("pairingHeapMergeSequence", () => {
  it("yields begin then done when both heaps are empty", () => {
    const steps = [...pairingHeapMergeSequence(emptyPairingHeap, null, null)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "done"]);
  });

  it("yields begin then done when one heap is empty (a empty)", () => {
    // Snapshot has one heap (root b at value 5); merge with null on the a side.
    const initial = buildPairingHeap([5]);
    const bRoot = initial.roots[0];
    const steps = [...pairingHeapMergeSequence(initial, null, bRoot)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "done"]);
    const done = steps[1];
    if (done.kind !== "done") throw new Error("expected done");
    expect(done.heap.roots).toEqual([bRoot]);
  });

  it("yields begin then done when one heap is empty (b empty)", () => {
    const initial = buildPairingHeap([5]);
    const aRoot = initial.roots[0];
    const steps = [...pairingHeapMergeSequence(initial, aRoot, null)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "done"]);
  });

  it("links the larger-valued root as a child of the smaller (a wins)", () => {
    // Construct two singletons in one snapshot manually, then merge.
    const initial: PairingHeapSnapshot = {
      nodes: [
        { id: 0, value: 3, firstChildId: null, nextSiblingId: null },
        { id: 1, value: 5, firstChildId: null, nextSiblingId: null },
      ],
      roots: [0, 1],
    };
    const steps = [...pairingHeapMergeSequence(initial, 0, 1)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "compare-roots", "link", "done"]);
    const link = steps[2];
    if (link.kind !== "link") throw new Error("expected link");
    expect(link.parentId).toBe(0); // value 3 is smaller
    expect(link.childId).toBe(1);
    const done = steps[3];
    if (done.kind !== "done") throw new Error("expected done");
    // Root 0's firstChild is now 1; only one root remains.
    expect(done.heap.roots).toEqual([0]);
    expect(done.heap.nodes[0].firstChildId).toBe(1);
  });

  it("links the larger-valued root as a child of the smaller (b wins)", () => {
    const initial: PairingHeapSnapshot = {
      nodes: [
        { id: 0, value: 7, firstChildId: null, nextSiblingId: null },
        { id: 1, value: 2, firstChildId: null, nextSiblingId: null },
      ],
      roots: [0, 1],
    };
    const steps = [...pairingHeapMergeSequence(initial, 0, 1)];
    const link = steps.find((s) => s.kind === "link");
    if (link?.kind !== "link") throw new Error("expected link");
    expect(link.parentId).toBe(1);
    expect(link.childId).toBe(0);
  });

  it("preserves the existing first-child chain when linking", () => {
    // a (id 0, value 1) has existing child b (id 2, value 4). Merge with
    // standalone c (id 1, value 3). c links as a's new first-child, with
    // c.nextSibling = b (the previous first-child).
    const initial: PairingHeapSnapshot = {
      nodes: [
        { id: 0, value: 1, firstChildId: 2, nextSiblingId: null },
        { id: 1, value: 3, firstChildId: null, nextSiblingId: null },
        { id: 2, value: 4, firstChildId: null, nextSiblingId: null },
      ],
      roots: [0, 1],
    };
    const steps = [...pairingHeapMergeSequence(initial, 0, 1)];
    const done = steps.at(-1);
    if (done?.kind !== "done") throw new Error("expected done");
    expect(done.heap.nodes[0].firstChildId).toBe(1);
    expect(done.heap.nodes[1].nextSiblingId).toBe(2);
  });

  it("every emitted step carries codeLines inside the displayed Python source", () => {
    const lineCount = pairingHeapMergePython.split("\n").length;
    const initial: PairingHeapSnapshot = {
      nodes: [
        { id: 0, value: 3, firstChildId: null, nextSiblingId: null },
        { id: 1, value: 5, firstChildId: null, nextSiblingId: null },
      ],
      roots: [0, 1],
    };
    for (const step of pairingHeapMergeSequence(initial, 0, 1)) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });
});

describe("pairingHeapDeleteMinSequence", () => {
  it("yields begin then done on an empty heap", () => {
    const steps = [...pairingHeapDeleteMinSequence(emptyPairingHeap)];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "done"]);
  });

  it("removes the only node from a single-node heap, leaving empty", () => {
    const heap = buildPairingHeap([42]);
    const steps = [...pairingHeapDeleteMinSequence(heap)];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.heap.roots).toEqual([]);
    // The removed node is still in `nodes` (dense-id orphan).
    expect(last.heap.nodes).toHaveLength(1);
  });

  it("after delete-min, the remaining heap satisfies the min-heap invariant", () => {
    const heap = buildPairingHeap([5, 3, 8, 1, 9, 7, 2, 4, 6]);
    const steps = [...pairingHeapDeleteMinSequence(heap)];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.heap.roots).toHaveLength(1);
    // The new root is the next-smallest live value (2).
    expect(last.heap.nodes[last.heap.roots[0]].value).toBe(2);
    // Invariant check.
    const reachable = pairingHeapDepths(last.heap);
    for (const [id] of reachable) {
      const parentValue = last.heap.nodes[id].value;
      let child = last.heap.nodes[id].firstChildId;
      while (child !== null) {
        expect(last.heap.nodes[child].value).toBeGreaterThanOrEqual(parentValue);
        child = last.heap.nodes[child].nextSiblingId;
      }
    }
  });

  it("repeated delete-min extracts values in ascending order", () => {
    const input = [5, 3, 8, 1, 9, 7, 2, 4, 6];
    const extracted: number[] = [];
    let heap = buildPairingHeap(input);
    while (heap.roots.length > 0) {
      const steps = [...pairingHeapDeleteMinSequence(heap)];
      const removeStep = steps.find((s) => s.kind === "remove-root");
      if (removeStep?.kind !== "remove-root") throw new Error("expected remove-root");
      extracted.push(removeStep.removedValue);
      const done = steps.at(-1);
      if (done?.kind !== "done") throw new Error("expected done");
      heap = done.heap;
    }
    expect(extracted).toEqual([...input].sort((a, b) => a - b));
  });

  it("emits one pair-link per pair in pass 1 (3-child case)", () => {
    // Manually construct a heap with root having 3 children (left-to-right
    // child values 4, 6, 5). Pass 1 pairs (4,6) → link, leaves 5 alone.
    // Pass 2: result = 5, fold with merged(4,6) → one fold-link.
    const initial: PairingHeapSnapshot = {
      nodes: [
        { id: 0, value: 1, firstChildId: 1, nextSiblingId: null },
        { id: 1, value: 4, firstChildId: null, nextSiblingId: 2 },
        { id: 2, value: 6, firstChildId: null, nextSiblingId: 3 },
        { id: 3, value: 5, firstChildId: null, nextSiblingId: null },
      ],
      roots: [0],
    };
    const steps = [...pairingHeapDeleteMinSequence(initial)];
    const pairLinks = steps.filter((s) => s.kind === "pair-link");
    const foldLinks = steps.filter((s) => s.kind === "fold-link");
    expect(pairLinks).toHaveLength(1);
    expect(foldLinks).toHaveLength(1);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.heap.roots).toHaveLength(1);
    expect(last.heap.nodes[last.heap.roots[0]].value).toBe(4);
  });

  it("handles 4-child case with two pair-links and one fold-link", () => {
    // Root 0 has children with values 5, 7, 6, 8. Pass 1 pairs (5,7) and
    // (6,8) → two pair-links. Pass 2 folds the two pair results → one
    // fold-link. Final root: 5.
    const initial: PairingHeapSnapshot = {
      nodes: [
        { id: 0, value: 1, firstChildId: 1, nextSiblingId: null },
        { id: 1, value: 5, firstChildId: null, nextSiblingId: 2 },
        { id: 2, value: 7, firstChildId: null, nextSiblingId: 3 },
        { id: 3, value: 6, firstChildId: null, nextSiblingId: 4 },
        { id: 4, value: 8, firstChildId: null, nextSiblingId: null },
      ],
      roots: [0],
    };
    const steps = [...pairingHeapDeleteMinSequence(initial)];
    expect(steps.filter((s) => s.kind === "pair-link")).toHaveLength(2);
    expect(steps.filter((s) => s.kind === "fold-link")).toHaveLength(1);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.heap.nodes[last.heap.roots[0]].value).toBe(5);
  });

  it("does not mutate the input snapshot", () => {
    const heap = buildPairingHeap([5, 3, 8, 1, 9]);
    const before = JSON.parse(JSON.stringify(heap));
    void [...pairingHeapDeleteMinSequence(heap)];
    expect(JSON.parse(JSON.stringify(heap))).toEqual(before);
  });

  it("every emitted step carries codeLines inside the displayed Python source", () => {
    const lineCount = pairingHeapDeleteMinPython.split("\n").length;
    const heap = buildPairingHeap([5, 3, 8, 1, 9, 7, 2]);
    for (const step of pairingHeapDeleteMinSequence(heap)) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });
});

describe("pairingHeapDepths", () => {
  it("returns empty map for an empty heap", () => {
    expect(pairingHeapDepths(emptyPairingHeap).size).toBe(0);
  });

  it("returns depth 0 for a singleton root", () => {
    const heap = buildPairingHeap([7]);
    const depths = pairingHeapDepths(heap);
    expect(depths.get(heap.roots[0])).toBe(0);
  });

  it("walks siblings at the same depth and children one deeper", () => {
    // Root 0 with two children 1, 2; child 1 with grandchild 3.
    const heap: PairingHeapSnapshot = {
      nodes: [
        { id: 0, value: 0, firstChildId: 1, nextSiblingId: null },
        { id: 1, value: 1, firstChildId: 3, nextSiblingId: 2 },
        { id: 2, value: 2, firstChildId: null, nextSiblingId: null },
        { id: 3, value: 3, firstChildId: null, nextSiblingId: null },
      ],
      roots: [0],
    };
    const depths = pairingHeapDepths(heap);
    expect(depths.get(0)).toBe(0);
    expect(depths.get(1)).toBe(1);
    expect(depths.get(2)).toBe(1);
    expect(depths.get(3)).toBe(2);
  });

  it("walks multi-root forests", () => {
    const heap: PairingHeapSnapshot = {
      nodes: [
        { id: 0, value: 0, firstChildId: null, nextSiblingId: null },
        { id: 1, value: 1, firstChildId: null, nextSiblingId: null },
      ],
      roots: [0, 1],
    };
    const depths = pairingHeapDepths(heap);
    expect(depths.get(0)).toBe(0);
    expect(depths.get(1)).toBe(0);
  });
});

describe("merge handles trivial-empty branch combinations cleanly", () => {
  // A trivial regression guard: merge(empty, empty) yields just begin + done
  // with the codeLines path through the empty-A guard.
  it("empty-empty merge yields a clean two-step sequence", () => {
    const steps = [...pairingHeapMergeSequence(emptyPairingHeap, null, null)];
    expect(steps).toHaveLength(2);
  });
});
