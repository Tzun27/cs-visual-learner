import { inorderLines } from "./inorderTraversal.snippet";
import { levelOrderLines } from "./levelOrderTraversal.snippet";
import { postorderLines } from "./postorderTraversal.snippet";
import { preorderLines } from "./preorderTraversal.snippet";
import type { BstSnapshot, BstTraversalStep, TraversalMode } from "./types";

const linesFor = (mode: TraversalMode) => {
  switch (mode) {
    case "preorder":
      return preorderLines;
    case "inorder":
      return inorderLines;
    case "postorder":
      return postorderLines;
    case "level-order":
      return levelOrderLines;
  }
};

export function* traversalSequence(
  tree: BstSnapshot,
  mode: TraversalMode,
): Generator<BstTraversalStep> {
  const lines = linesFor(mode);
  const sequence: number[] = [];

  yield {
    kind: "begin",
    tree,
    mode,
    sequence: [...sequence],
    codeLines: lines.begin,
  };

  function* visitNode(id: number): Generator<BstTraversalStep> {
    sequence.push(tree.nodes[id].value);
    yield {
      kind: "visit",
      tree,
      cursorId: id,
      mode,
      sequence: [...sequence],
      codeLines: lines.visit,
    };
  }

  function* dfs(id: number | null): Generator<BstTraversalStep> {
    if (id === null) return;
    const node = tree.nodes[id];
    if (mode === "preorder") {
      yield* visitNode(id);
      yield* dfs(node.leftId);
      yield* dfs(node.rightId);
    } else if (mode === "inorder") {
      yield* dfs(node.leftId);
      yield* visitNode(id);
      yield* dfs(node.rightId);
    } else if (mode === "postorder") {
      yield* dfs(node.leftId);
      yield* dfs(node.rightId);
      yield* visitNode(id);
    }
  }

  if (mode === "level-order") {
    if (tree.rootId !== null) {
      const queue: number[] = [tree.rootId];
      while (queue.length > 0) {
        const cursorId = queue.shift() as number;
        yield* visitNode(cursorId);
        const node = tree.nodes[cursorId];
        if (node.leftId !== null) queue.push(node.leftId);
        if (node.rightId !== null) queue.push(node.rightId);
      }
    }
  } else {
    yield* dfs(tree.rootId);
  }

  yield {
    kind: "done",
    tree,
    mode,
    sequence: [...sequence],
    codeLines: lines.done,
  };
}

export const TRAVERSAL_MODES: readonly TraversalMode[] = [
  "preorder",
  "inorder",
  "postorder",
  "level-order",
] as const;

export const TRAVERSAL_MODE_LABELS: Record<TraversalMode, string> = {
  preorder: "Preorder",
  inorder: "Inorder",
  postorder: "Postorder",
  "level-order": "Level-order",
};
