import type { BstNode, BstSnapshot, BstStep } from "./types";

function snapshot(nodes: readonly BstNode[], rootId: number | null): BstSnapshot {
  return { nodes: nodes.map((n) => ({ ...n })), rootId };
}

export function* insertSequence(values: readonly number[]): Generator<BstStep> {
  const nodes: BstNode[] = [];
  let rootId: number | null = null;

  for (const value of values) {
    yield { kind: "begin", tree: snapshot(nodes, rootId), insertingValue: value };

    let cursorId: number | null = rootId;
    let parentId: number | null = null;
    let goLeft = false;
    let placed = true;

    while (cursorId !== null) {
      yield {
        kind: "compare",
        tree: snapshot(nodes, rootId),
        cursorId,
        insertingValue: value,
      };
      const cursor = nodes[cursorId];
      if (value === cursor.value) {
        yield {
          kind: "duplicate",
          tree: snapshot(nodes, rootId),
          cursorId,
          insertingValue: value,
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
      };
    }
  }

  yield { kind: "done", tree: snapshot(nodes, rootId) };
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

export function maxDepth(tree: BstSnapshot): number {
  const visit = (id: number | null): number => {
    if (id === null) return 0;
    const node = tree.nodes[id];
    return 1 + Math.max(visit(node.leftId), visit(node.rightId));
  };
  return visit(tree.rootId);
}
