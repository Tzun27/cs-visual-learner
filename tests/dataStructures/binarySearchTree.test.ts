import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { insertSequence, inorderValues, maxDepth } from "@/lib/dataStructures/binarySearchTree";
import type { BstSnapshot, BstStep } from "@/lib/dataStructures/types";

function runToFinal(values: readonly number[]): {
  steps: BstStep[];
  final: BstSnapshot;
} {
  const steps = [...insertSequence(values)];
  const last = steps.at(-1);
  if (!last || last.kind !== "done") {
    throw new Error("generator did not yield a 'done' step last");
  }
  return { steps, final: last.tree };
}

function isBst(tree: BstSnapshot): boolean {
  const visit = (id: number | null, lo: number, hi: number): boolean => {
    if (id === null) return true;
    const node = tree.nodes[id];
    if (node.value < lo || node.value > hi) return false;
    return visit(node.leftId, lo, node.value - 1) && visit(node.rightId, node.value + 1, hi);
  };
  return visit(tree.rootId, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
}

describe("insertSequence", () => {
  it("yields only a 'done' step for an empty input", () => {
    expect([...insertSequence([])]).toEqual([{ kind: "done", tree: { nodes: [], rootId: null } }]);
  });

  it("places a single value as the root with no comparisons", () => {
    const steps = [...insertSequence([42])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "place", "done"]);
    const place = steps[1];
    if (place.kind !== "place") throw new Error("unexpected kind");
    expect(place.parentId).toBeNull();
    expect(place.tree.rootId).toBe(0);
    expect(place.tree.nodes).toEqual([{ id: 0, value: 42, leftId: null, rightId: null }]);
  });

  it("yields the exact step sequence for [5, 3]", () => {
    const steps = [...insertSequence([5, 3])];
    expect(steps.map((s) => s.kind)).toEqual([
      "begin", // begin insert 5
      "place", // place 5 as root
      "begin", // begin insert 3
      "compare", // compare against 5
      "place", // place 3 as left child of 5
      "done",
    ]);
    const last = steps.at(-1)!;
    if (last.kind !== "done") throw new Error("expected done");
    expect(last.tree.rootId).toBe(0);
    expect(last.tree.nodes[0].leftId).toBe(1);
    expect(last.tree.nodes[1].value).toBe(3);
  });

  it("ascending input degenerates into a right-only chain", () => {
    const { final } = runToFinal([1, 2, 3, 4, 5]);
    expect(maxDepth(final)).toBe(5);
    // every node's leftId is null (chain bends only right)
    for (const node of final.nodes) expect(node.leftId).toBeNull();
  });

  it("descending input degenerates into a left-only chain", () => {
    const { final } = runToFinal([5, 4, 3, 2, 1]);
    expect(maxDepth(final)).toBe(5);
    for (const node of final.nodes) expect(node.rightId).toBeNull();
  });

  it("median-first ordering builds a balanced tree", () => {
    const { final } = runToFinal([4, 2, 6, 1, 3, 5, 7]);
    expect(maxDepth(final)).toBe(3);
    expect(inorderValues(final)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("duplicate values are detected and skipped (no new node)", () => {
    const steps = [...insertSequence([5, 3, 5])];
    const placeSteps = steps.filter((s) => s.kind === "place");
    expect(placeSteps).toHaveLength(2);
    const dupSteps = steps.filter((s) => s.kind === "duplicate");
    expect(dupSteps).toHaveLength(1);
    const last = steps.at(-1)!;
    if (last.kind !== "done") throw new Error("expected done");
    expect(last.tree.nodes).toHaveLength(2);
  });

  it("does not mutate its input", () => {
    const input = [3, 1, 2];
    const snapshot = [...input];
    void [...insertSequence(input)];
    expect(input).toEqual(snapshot);
  });

  it("emits fresh tree snapshots, not aliased mutable refs", () => {
    const steps = [...insertSequence([2, 1, 3])];
    const trees = steps.map((s) => s.tree);
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        expect(trees[i].nodes).not.toBe(trees[j].nodes);
      }
    }
  });

  it("property: every snapshot satisfies the BST invariant", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -100, max: 100 }), { maxLength: 30 }),
        (vals) => {
          for (const step of insertSequence(vals)) {
            expect(isBst(step.tree)).toBe(true);
          }
        },
      ),
    );
  });

  it("property: inorder traversal of the final tree equals sorted unique input", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -100, max: 100 }), { maxLength: 30 }), (vals) => {
        const { final } = runToFinal(vals);
        const expected = [...new Set(vals)].sort((a, b) => a - b);
        expect(inorderValues(final)).toEqual(expected);
      }),
    );
  });
});

describe("inorderValues", () => {
  it("returns [] for an empty tree", () => {
    expect(inorderValues({ nodes: [], rootId: null })).toEqual([]);
  });
});

describe("maxDepth", () => {
  it("returns 0 for an empty tree", () => {
    expect(maxDepth({ nodes: [], rootId: null })).toBe(0);
  });

  it("returns 1 for a single-node tree", () => {
    const { final } = runToFinal([10]);
    expect(maxDepth(final)).toBe(1);
  });
});
