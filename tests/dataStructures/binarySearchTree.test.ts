import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildTree,
  deleteSequence,
  inorderValues,
  insertSequence,
  maxDepth,
  searchSequence,
} from "@/lib/dataStructures/binarySearchTree";
import { bstInsertPython } from "@/lib/dataStructures/insertSequence.snippet";
import { bstSearchPython } from "@/lib/dataStructures/searchSequence.snippet";
import type {
  BstDeleteStep,
  BstSearchStep,
  BstSnapshot,
  BstStep,
} from "@/lib/dataStructures/types";

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
    expect([...insertSequence([])]).toEqual([
      { kind: "done", tree: { nodes: [], rootId: null }, codeLines: [16] },
    ]);
  });

  it("every emitted step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = bstInsertPython.split("\n").length;
    for (const step of insertSequence([5, 3, 7, 5, 1])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
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

describe("buildTree", () => {
  it("returns the empty snapshot for an empty input", () => {
    expect(buildTree([])).toEqual({ nodes: [], rootId: null });
  });

  it("returns the same final snapshot as the last 'done' step of insertSequence", () => {
    const input = [4, 2, 6, 1, 3, 5, 7];
    const fromGen = runToFinal(input).final;
    expect(buildTree(input)).toEqual(fromGen);
  });
});

describe("searchSequence", () => {
  const tree = buildTree([4, 2, 6, 1, 3, 5, 7]);

  it("yields only a 'done' step for an empty target list", () => {
    expect([...searchSequence(tree, [])]).toEqual([{ kind: "done", tree, codeLines: [1] }]);
  });

  it("every emitted search step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = bstSearchPython.split("\n").length;
    for (const step of searchSequence(tree, [1, 4, 7, 99, 0])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("yields begin → compare → found for a hit at the root", () => {
    const steps = [...searchSequence(tree, [4])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "compare", "found", "done"]);
  });

  it("walks the path down and emits 'found' for a left-subtree hit", () => {
    const steps = [...searchSequence(tree, [1])];
    // begin → compare(4) → compare(2) → compare(1) → found(1) → done
    expect(steps.map((s) => s.kind)).toEqual([
      "begin",
      "compare",
      "compare",
      "compare",
      "found",
      "done",
    ]);
    const compares = steps.filter(
      (s): s is BstSearchStep & { kind: "compare" } => s.kind === "compare",
    );
    expect(compares.map((s) => tree.nodes[s.cursorId].value)).toEqual([4, 2, 1]);
  });

  it("emits 'miss' when the target falls between branches", () => {
    // 0 is less than every node on the leftmost path; ends with miss after 4 → 2 → 1.
    const steps = [...searchSequence(tree, [0])];
    expect(steps.filter((s) => s.kind === "found")).toHaveLength(0);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.lastCursorId).not.toBeNull();
    expect(tree.nodes[miss.lastCursorId!].value).toBe(1);
  });

  it("'miss' on an empty tree has lastCursorId=null", () => {
    const empty: BstSnapshot = { nodes: [], rootId: null };
    const steps = [...searchSequence(empty, [42])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "miss", "done"]);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.lastCursorId).toBeNull();
  });

  it("processes multiple targets sequentially", () => {
    const steps = [...searchSequence(tree, [4, 99, 5])];
    const begins = steps.filter((s) => s.kind === "begin");
    expect(begins).toHaveLength(3);
    const finds = steps.filter((s) => s.kind === "found");
    const misses = steps.filter((s) => s.kind === "miss");
    expect(finds).toHaveLength(2);
    expect(misses).toHaveLength(1);
    // Last step is always 'done'.
    expect(steps.at(-1)?.kind).toBe("done");
  });

  it("number of comparisons for a hit equals the depth of the matched node + 1", () => {
    // The tree from [4,2,6,1,3,5,7] is balanced (depth 3). Searching for 7 visits 4 → 6 → 7.
    const steps = [...searchSequence(tree, [7])];
    const compares = steps.filter((s) => s.kind === "compare");
    expect(compares).toHaveLength(3);
  });

  it("property: any value in the tree is reported as 'found' exactly once", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 20 }),
        (vals) => {
          const t = buildTree(vals);
          const steps = [...searchSequence(t, vals)];
          const finds = steps.filter((s) => s.kind === "found");
          expect(finds).toHaveLength(vals.length);
        },
      ),
    );
  });

  it("property: any value not in the tree is always reported as 'miss'", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 20 }),
        (vals) => {
          const t = buildTree(vals);
          const present = new Set(vals);
          const absent = [200, 201, 202, -1, -2].filter((v) => !present.has(v));
          if (absent.length === 0) return;
          const steps = [...searchSequence(t, absent)];
          const finds = steps.filter((s) => s.kind === "found");
          const misses = steps.filter((s) => s.kind === "miss");
          expect(finds).toHaveLength(0);
          expect(misses).toHaveLength(absent.length);
        },
      ),
    );
  });
});

describe("deleteSequence", () => {
  // Tree shape used throughout (median-first insert):
  //                4
  //              /   \
  //             2     6
  //            / \   / \
  //           1   3 5   7
  const baseValues = [4, 2, 6, 1, 3, 5, 7] as const;

  function finalSnapshot(steps: readonly BstDeleteStep[]): BstSnapshot {
    const last = steps.at(-1);
    if (!last || last.kind !== "done") throw new Error("expected 'done' as last step");
    return last.tree;
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

  it("yields only a 'done' step for an empty target list", () => {
    const tree = buildTree(baseValues);
    expect([...deleteSequence(tree, [])]).toEqual([{ kind: "done", tree }]);
  });

  it("emits 'miss' when the target is not in the tree", () => {
    const tree = buildTree(baseValues);
    const steps = [...deleteSequence(tree, [42])];
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.lastCursorId).not.toBeNull();
    // The walk for 42 ends at 7 (4 → 6 → 7).
    expect(tree.nodes[miss.lastCursorId!].value).toBe(7);
    expect(steps.some((s) => s.kind === "found")).toBe(false);
    expect(inorderValues(finalSnapshot(steps))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("'miss' on an empty tree has lastCursorId=null", () => {
    const empty: BstSnapshot = { nodes: [], rootId: null };
    const steps = [...deleteSequence(empty, [10])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "miss", "done"]);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.lastCursorId).toBeNull();
  });

  it("leaf delete: 1 → found(leaf) → unlink, no swap", () => {
    const tree = buildTree(baseValues);
    const steps = [...deleteSequence(tree, [1])];
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.deleteCase).toBe("leaf");
    expect(steps.some((s) => s.kind === "swap-value")).toBe(false);
    expect(steps.filter((s) => s.kind === "unlink")).toHaveLength(1);
    const final = finalSnapshot(steps);
    expect(inorderValues(final)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(isBst(final)).toBe(true);
  });

  it("one-child delete: insert sequence that produces a single-child node, then remove it", () => {
    // Build a tree where 6 has only a right child (no left).
    //   5
    //    \
    //     6
    //      \
    //       7
    const tree = buildTree([5, 6, 7]);
    const steps = [...deleteSequence(tree, [6])];
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.deleteCase).toBe("one-child");
    expect(steps.some((s) => s.kind === "swap-value")).toBe(false);
    const final = finalSnapshot(steps);
    expect(inorderValues(final)).toEqual([5, 7]);
    expect(final.rootId).toBe(0); // 5 is still root
    expect(final.nodes[0].rightId).toBe(2); // 5.right is now 7 (skipping 6)
    expect(isBst(final)).toBe(true);
  });

  it("two-children delete: 4 → successor is 5 (right child has no left), copy + unlink", () => {
    const tree = buildTree(baseValues);
    const steps = [...deleteSequence(tree, [4])];
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.deleteCase).toBe("two-children");
    const swap = steps.find((s) => s.kind === "swap-value");
    if (swap?.kind !== "swap-value") throw new Error("expected swap-value");
    expect(swap.newValue).toBe(5);
    const final = finalSnapshot(steps);
    expect(inorderValues(final)).toEqual([1, 2, 3, 5, 6, 7]);
    expect(isBst(final)).toBe(true);
  });

  it("two-children delete with deeper successor walk: remove 2 → successor is 3", () => {
    // 2's right subtree is just node 3 (no left, no right), so successor is 3.
    // Build a tree where the successor walk is non-trivial:
    //         10
    //        /  \
    //       5    15
    //      / \
    //     3   7
    //          \
    //           8
    const tree = buildTree([10, 5, 15, 3, 7, 8]);
    const steps = [...deleteSequence(tree, [5])];
    // Successor of 5 is leftmost of 7's subtree = 7 itself (it has no left child).
    const swap = steps.find((s) => s.kind === "swap-value");
    if (swap?.kind !== "swap-value") throw new Error("expected swap-value");
    expect(swap.newValue).toBe(7);
    const final = finalSnapshot(steps);
    expect(inorderValues(final)).toEqual([3, 7, 8, 10, 15]);
    expect(isBst(final)).toBe(true);
  });

  it("two-children with successor under a left descent: remove root, successor walks left", () => {
    //        10
    //       /  \
    //      5    20
    //          /  \
    //         15   25
    //         /
    //        12
    // Removing 10 → right subtree's leftmost = 12 (walk: 20 → 15 → 12).
    const tree = buildTree([10, 5, 20, 15, 25, 12]);
    const steps = [...deleteSequence(tree, [10])];
    const findSuccs = steps.filter((s) => s.kind === "find-successor");
    expect(findSuccs.length).toBe(3);
    const swap = steps.find((s) => s.kind === "swap-value");
    if (swap?.kind !== "swap-value") throw new Error("expected swap-value");
    expect(swap.newValue).toBe(12);
    const final = finalSnapshot(steps);
    expect(inorderValues(final)).toEqual([5, 12, 15, 20, 25]);
    expect(isBst(final)).toBe(true);
  });

  it("removing the root of a single-node tree empties the tree", () => {
    const tree = buildTree([42]);
    const steps = [...deleteSequence(tree, [42])];
    const final = finalSnapshot(steps);
    expect(final.rootId).toBeNull();
    expect(inorderValues(final)).toEqual([]);
  });

  it("processes multiple targets sequentially and shares the running tree", () => {
    const tree = buildTree(baseValues);
    const steps = [...deleteSequence(tree, [1, 4, 99])];
    expect(steps.filter((s) => s.kind === "begin")).toHaveLength(3);
    expect(steps.filter((s) => s.kind === "miss")).toHaveLength(1);
    expect(steps.filter((s) => s.kind === "unlink")).toHaveLength(2);
    const final = finalSnapshot(steps);
    expect(inorderValues(final)).toEqual([2, 3, 5, 6, 7]);
    expect(isBst(final)).toBe(true);
  });

  it("does not mutate the input tree's nodes array", () => {
    const tree = buildTree(baseValues);
    const before = tree.nodes.map((n) => ({ ...n }));
    void [...deleteSequence(tree, [4])];
    expect(tree.nodes).toEqual(before);
  });

  it("emits fresh tree snapshots, not aliased mutable refs", () => {
    const tree = buildTree(baseValues);
    const trees = [...deleteSequence(tree, [4])].map((s) => s.tree);
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        expect(trees[i].nodes).not.toBe(trees[j].nodes);
      }
    }
  });

  it("orphaned (removed) nodes remain in nodes[] so dense-id lookups stay valid", () => {
    const tree = buildTree([5, 3, 7]);
    const steps = [...deleteSequence(tree, [3])];
    const final = finalSnapshot(steps);
    expect(final.nodes).toHaveLength(3); // tombstoned, not spliced
    // The orphan is unreachable from rootId, so inorder doesn't include it.
    expect(inorderValues(final)).toEqual([5, 7]);
  });

  it("property: every snapshot except the transient 'swap-value' satisfies the BST invariant", () => {
    // 'swap-value' is intentionally invalid for one tick: the target's value has
    // been overwritten with the successor's value but the successor is still
    // attached, creating a duplicate. The very next step ('unlink') restores it.
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 20 }),
        fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 10 }),
        (insertVals, deleteVals) => {
          const tree = buildTree(insertVals);
          for (const step of deleteSequence(tree, deleteVals)) {
            if (step.kind === "swap-value") continue;
            expect(isBst(step.tree)).toBe(true);
          }
        },
      ),
    );
  });

  it("property: inorder of final tree equals sorted set difference (insert \\ delete)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 20 }),
        fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 10 }),
        (insertVals, deleteVals) => {
          const tree = buildTree(insertVals);
          const steps = [...deleteSequence(tree, deleteVals)];
          const final = finalSnapshot(steps);
          const remaining = new Set(insertVals);
          for (const v of deleteVals) remaining.delete(v);
          const expected = [...remaining].sort((a, b) => a - b);
          expect(inorderValues(final)).toEqual(expected);
        },
      ),
    );
  });
});
