import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildTree, inorderValues } from "@/lib/dataStructures/binarySearchTree";
import { TRAVERSAL_MODES, traversalSequence } from "@/lib/dataStructures/traversal";
import { inorderPython } from "@/lib/dataStructures/inorderTraversal.snippet";
import { levelOrderPython } from "@/lib/dataStructures/levelOrderTraversal.snippet";
import { postorderPython } from "@/lib/dataStructures/postorderTraversal.snippet";
import { preorderPython } from "@/lib/dataStructures/preorderTraversal.snippet";
import type { BstSnapshot, BstTraversalStep, TraversalMode } from "@/lib/dataStructures/types";

// Reference tree used throughout — same shape as the BST lesson's balanced demo.
//                4
//              /   \
//             2     6
//            / \   / \
//           1   3 5   7
const REF_TREE = buildTree([4, 2, 6, 1, 3, 5, 7]);
const EMPTY_TREE: BstSnapshot = { nodes: [], rootId: null };

function finalSequence(steps: readonly BstTraversalStep[]): readonly number[] {
  const last = steps.at(-1);
  if (!last || last.kind !== "done") throw new Error("expected 'done' as last step");
  return last.sequence;
}

const sourceFor: Record<TraversalMode, string> = {
  preorder: preorderPython,
  inorder: inorderPython,
  postorder: postorderPython,
  "level-order": levelOrderPython,
};

describe("traversalSequence", () => {
  it("yields only a 'done' step for an empty tree (every mode)", () => {
    for (const mode of TRAVERSAL_MODES) {
      const steps = [...traversalSequence(EMPTY_TREE, mode)];
      expect(steps.map((s) => s.kind)).toEqual(["begin", "done"]);
      expect(finalSequence(steps)).toEqual([]);
    }
  });

  it("every emitted step carries codeLines pointing inside the displayed Python source", () => {
    for (const mode of TRAVERSAL_MODES) {
      const lineCount = sourceFor[mode].split("\n").length;
      for (const step of traversalSequence(REF_TREE, mode)) {
        expect(step.codeLines).toBeDefined();
        for (const line of step.codeLines!) {
          expect(line).toBeGreaterThanOrEqual(1);
          expect(line).toBeLessThanOrEqual(lineCount);
        }
      }
    }
  });

  it("preorder visits root → left subtree → right subtree", () => {
    const steps = [...traversalSequence(REF_TREE, "preorder")];
    expect(finalSequence(steps)).toEqual([4, 2, 1, 3, 6, 5, 7]);
  });

  it("inorder visits left → root → right (and produces sorted output on a BST)", () => {
    const steps = [...traversalSequence(REF_TREE, "inorder")];
    expect(finalSequence(steps)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("postorder visits left → right → root (root emitted last)", () => {
    const steps = [...traversalSequence(REF_TREE, "postorder")];
    expect(finalSequence(steps)).toEqual([1, 3, 2, 5, 7, 6, 4]);
  });

  it("level-order visits the tree by depth, left-to-right within a level", () => {
    const steps = [...traversalSequence(REF_TREE, "level-order")];
    expect(finalSequence(steps)).toEqual([4, 2, 6, 1, 3, 5, 7]);
  });

  it("each visit step appends exactly one value to the sequence", () => {
    for (const mode of TRAVERSAL_MODES) {
      const steps = [...traversalSequence(REF_TREE, mode)];
      let lastLen = 0;
      for (const s of steps) {
        if (s.kind === "visit") {
          expect(s.sequence.length).toBe(lastLen + 1);
          lastLen = s.sequence.length;
        }
      }
    }
  });

  it("the cursorId of a visit step points at a node whose value matches the freshly-appended sequence entry", () => {
    for (const mode of TRAVERSAL_MODES) {
      const steps = [...traversalSequence(REF_TREE, mode)];
      for (const s of steps) {
        if (s.kind === "visit") {
          expect(s.tree.nodes[s.cursorId].value).toBe(s.sequence.at(-1));
        }
      }
    }
  });

  it("does not mutate the input tree's nodes", () => {
    for (const mode of TRAVERSAL_MODES) {
      const before = REF_TREE.nodes.map((n) => ({ ...n }));
      void [...traversalSequence(REF_TREE, mode)];
      expect(REF_TREE.nodes).toEqual(before);
    }
  });

  it("property: inorder traversal of any BST equals sorted unique input", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { maxLength: 25 }), (vals) => {
        const tree = buildTree(vals);
        const steps = [...traversalSequence(tree, "inorder")];
        const expected = [...vals].sort((a, b) => a - b);
        expect(finalSequence(steps)).toEqual(expected);
        // Also confirm parity with the existing inorderValues helper.
        expect(finalSequence(steps)).toEqual(inorderValues(tree));
      }),
    );
  });

  it("property: every traversal mode visits every node exactly once and emits a permutation of the inorder values", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 25 }),
        (vals) => {
          const tree = buildTree(vals);
          const reference = new Set(inorderValues(tree));
          for (const mode of TRAVERSAL_MODES) {
            const seq = finalSequence([...traversalSequence(tree, mode)]);
            expect(seq).toHaveLength(reference.size);
            expect(new Set(seq)).toEqual(reference);
          }
        },
      ),
    );
  });

  it("property: preorder's first visited value is always the root", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 25 }),
        (vals) => {
          const tree = buildTree(vals);
          if (tree.rootId === null) return;
          const steps = [...traversalSequence(tree, "preorder")];
          const firstVisit = steps.find((s) => s.kind === "visit");
          expect(firstVisit).toBeDefined();
          if (firstVisit?.kind !== "visit") throw new Error("expected visit");
          expect(firstVisit.cursorId).toBe(tree.rootId);
        },
      ),
    );
  });

  it("property: postorder's last visited value is always the root", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 25 }),
        (vals) => {
          const tree = buildTree(vals);
          if (tree.rootId === null) return;
          const steps = [...traversalSequence(tree, "postorder")];
          const visits = steps.filter((s) => s.kind === "visit");
          const lastVisit = visits.at(-1);
          if (lastVisit?.kind !== "visit") throw new Error("expected visit");
          expect(lastVisit.cursorId).toBe(tree.rootId);
        },
      ),
    );
  });

  it("property: level-order's first visit is the root and visits respect breadth-first ordering", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 25 }),
        (vals) => {
          const tree = buildTree(vals);
          if (tree.rootId === null) return;
          const steps = [...traversalSequence(tree, "level-order")];
          const visits = steps.filter((s) => s.kind === "visit");
          expect(visits[0]?.kind === "visit" && visits[0].cursorId).toBe(tree.rootId);

          // Compute depth of each node from the root via BFS, then check visits are non-decreasing in depth.
          const depthOf = new Map<number, number>();
          const q: { id: number; d: number }[] = [{ id: tree.rootId, d: 0 }];
          while (q.length > 0) {
            const { id, d } = q.shift()!;
            depthOf.set(id, d);
            const node = tree.nodes[id];
            if (node.leftId !== null) q.push({ id: node.leftId, d: d + 1 });
            if (node.rightId !== null) q.push({ id: node.rightId, d: d + 1 });
          }
          let prevDepth = -1;
          for (const v of visits) {
            if (v.kind !== "visit") continue;
            const d = depthOf.get(v.cursorId);
            expect(d).toBeDefined();
            expect(d!).toBeGreaterThanOrEqual(prevDepth);
            prevDepth = d!;
          }
        },
      ),
    );
  });
});
