import { bstInsertLines } from "./insertSequence.snippet";
import { bstSearchLines } from "./searchSequence.snippet";
import type {
  BstDeleteCase,
  BstDeleteStep,
  BstNode,
  BstSearchStep,
  BstSnapshot,
  BstStep,
} from "./types";

function snapshot(nodes: readonly BstNode[], rootId: number | null): BstSnapshot {
  return { nodes: nodes.map((n) => ({ ...n })), rootId };
}

export function* insertSequence(values: readonly number[]): Generator<BstStep> {
  const nodes: BstNode[] = [];
  let rootId: number | null = null;

  for (const value of values) {
    yield {
      kind: "begin",
      tree: snapshot(nodes, rootId),
      insertingValue: value,
      codeLines: bstInsertLines.begin,
    };

    let cursorId: number | null = rootId;
    let parentId: number | null = null;
    let goLeft = false;
    let placed = true;

    while (cursorId !== null) {
      const cursor = nodes[cursorId];
      const compareLines =
        value < cursor.value
          ? bstInsertLines.compareLeft
          : value > cursor.value
            ? bstInsertLines.compareRight
            : [...bstInsertLines.compareLeft, ...bstInsertLines.compareRight];
      yield {
        kind: "compare",
        tree: snapshot(nodes, rootId),
        cursorId,
        insertingValue: value,
        codeLines: compareLines,
      };
      if (value === cursor.value) {
        yield {
          kind: "duplicate",
          tree: snapshot(nodes, rootId),
          cursorId,
          insertingValue: value,
          codeLines: bstInsertLines.duplicate,
        };
        placed = false;
        break;
      }
      parentId = cursorId;
      goLeft = value < cursor.value;
      cursorId = goLeft ? cursor.leftId : cursor.rightId;
    }

    if (placed) {
      const newId = nodes.length;
      nodes.push({ id: newId, value, leftId: null, rightId: null });

      if (parentId === null) {
        rootId = newId;
      } else {
        const parent = nodes[parentId];
        nodes[parentId] = goLeft ? { ...parent, leftId: newId } : { ...parent, rightId: newId };
      }

      yield {
        kind: "place",
        tree: snapshot(nodes, rootId),
        newId,
        parentId,
        codeLines: bstInsertLines.place,
      };
    }
  }

  yield { kind: "done", tree: snapshot(nodes, rootId), codeLines: bstInsertLines.done };
}

export function inorderValues(tree: BstSnapshot): number[] {
  const out: number[] = [];
  const visit = (id: number | null): void => {
    if (id === null) return;
    const node = tree.nodes[id];
    visit(node.leftId);
    out.push(node.value);
    visit(node.rightId);
  };
  visit(tree.rootId);
  return out;
}

export function buildTree(values: readonly number[]): BstSnapshot {
  let final: BstSnapshot = { nodes: [], rootId: null };
  for (const step of insertSequence(values)) {
    if (step.kind === "done") final = step.tree;
  }
  return final;
}

export function* searchSequence(
  tree: BstSnapshot,
  targets: readonly number[],
): Generator<BstSearchStep> {
  for (const targetValue of targets) {
    yield { kind: "begin", tree, targetValue, codeLines: bstSearchLines.begin };
    let cursorId: number | null = tree.rootId;
    let lastCursorId: number | null = null;
    let found = false;
    while (cursorId !== null) {
      const cursor = tree.nodes[cursorId];
      const compareLines =
        targetValue === cursor.value
          ? bstSearchLines.compareEqual
          : targetValue < cursor.value
            ? bstSearchLines.compareLeft
            : bstSearchLines.compareRight;
      yield { kind: "compare", tree, cursorId, targetValue, codeLines: compareLines };
      lastCursorId = cursorId;
      if (targetValue === cursor.value) {
        yield {
          kind: "found",
          tree,
          cursorId,
          targetValue,
          codeLines: bstSearchLines.found,
        };
        found = true;
        break;
      }
      cursorId = targetValue < cursor.value ? cursor.leftId : cursor.rightId;
    }
    if (!found) {
      yield {
        kind: "miss",
        tree,
        lastCursorId,
        targetValue,
        codeLines: bstSearchLines.miss,
      };
    }
  }
  yield { kind: "done", tree, codeLines: bstSearchLines.done };
}

export function* deleteSequence(
  initialTree: BstSnapshot,
  targets: readonly number[],
): Generator<BstDeleteStep> {
  const nodes: BstNode[] = initialTree.nodes.map((n) => ({ ...n }));
  let rootId = initialTree.rootId;

  for (const targetValue of targets) {
    yield { kind: "begin", tree: snapshot(nodes, rootId), targetValue };

    let cursorId: number | null = rootId;
    let parentId: number | null = null;
    let goLeft = false;
    let lastCursorId: number | null = null;

    while (cursorId !== null) {
      yield { kind: "compare", tree: snapshot(nodes, rootId), cursorId, targetValue };
      const cursor = nodes[cursorId];
      lastCursorId = cursorId;
      if (cursor.value === targetValue) break;
      parentId = cursorId;
      goLeft = targetValue < cursor.value;
      cursorId = goLeft ? cursor.leftId : cursor.rightId;
    }

    if (cursorId === null) {
      yield { kind: "miss", tree: snapshot(nodes, rootId), lastCursorId, targetValue };
      continue;
    }

    const target = nodes[cursorId];
    const hasLeft = target.leftId !== null;
    const hasRight = target.rightId !== null;
    const deleteCase: BstDeleteCase =
      !hasLeft && !hasRight ? "leaf" : hasLeft && hasRight ? "two-children" : "one-child";

    yield {
      kind: "found",
      tree: snapshot(nodes, rootId),
      cursorId,
      targetValue,
      deleteCase,
    };

    if (deleteCase !== "two-children") {
      const replacementId = target.leftId ?? target.rightId;
      if (parentId === null) {
        rootId = replacementId;
      } else {
        const parent = nodes[parentId];
        nodes[parentId] = goLeft
          ? { ...parent, leftId: replacementId }
          : { ...parent, rightId: replacementId };
      }
      yield {
        kind: "unlink",
        tree: snapshot(nodes, rootId),
        removedNodeId: cursorId,
        removedValue: target.value,
        deleteCase,
      };
      continue;
    }

    // two-children: walk to inorder successor (leftmost of right subtree).
    const targetCursorId = cursorId;
    let succId = target.rightId as number;
    let succParentId = targetCursorId;
    let succGoLeft = false;
    yield {
      kind: "find-successor",
      tree: snapshot(nodes, rootId),
      cursorId: succId,
      targetCursorId,
      targetValue,
    };
    while (nodes[succId].leftId !== null) {
      succParentId = succId;
      succGoLeft = true;
      succId = nodes[succId].leftId as number;
      yield {
        kind: "find-successor",
        tree: snapshot(nodes, rootId),
        cursorId: succId,
        targetCursorId,
        targetValue,
      };
    }

    const successorValue = nodes[succId].value;
    nodes[targetCursorId] = { ...nodes[targetCursorId], value: successorValue };
    // Transiently invalid: duplicate value lives at both the target slot and
    // the still-attached successor. The very next 'unlink' step restores the
    // BST invariant.
    yield {
      kind: "swap-value",
      tree: snapshot(nodes, rootId),
      targetCursorId,
      successorId: succId,
      newValue: successorValue,
    };

    // The successor has no left child by construction. Splice in its right child.
    const succRight = nodes[succId].rightId;
    if (succParentId === targetCursorId) {
      nodes[targetCursorId] = { ...nodes[targetCursorId], rightId: succRight };
    } else {
      const succParent = nodes[succParentId];
      nodes[succParentId] = succGoLeft
        ? { ...succParent, leftId: succRight }
        : { ...succParent, rightId: succRight };
    }
    yield {
      kind: "unlink",
      tree: snapshot(nodes, rootId),
      removedNodeId: succId,
      removedValue: successorValue,
      deleteCase: "two-children",
    };
  }

  yield { kind: "done", tree: snapshot(nodes, rootId) };
}

export function maxDepth(tree: BstSnapshot): number {
  const visit = (id: number | null): number => {
    if (id === null) return 0;
    const node = tree.nodes[id];
    return 1 + Math.max(visit(node.leftId), visit(node.rightId));
  };
  return visit(tree.rootId);
}
