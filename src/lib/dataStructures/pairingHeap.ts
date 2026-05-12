import { pairingHeapDeleteMinLines } from "./pairingHeapDeleteMin.snippet";
import { pairingHeapMergeLines } from "./pairingHeapMerge.snippet";
import type {
  PairingHeapDeleteMinStep,
  PairingHeapMergeStep,
  PairingHeapNode,
  PairingHeapSnapshot,
} from "./types";

export const emptyPairingHeap: PairingHeapSnapshot = { nodes: [], roots: [] };

function cloneNode(n: PairingHeapNode): PairingHeapNode {
  return { id: n.id, value: n.value, firstChildId: n.firstChildId, nextSiblingId: n.nextSiblingId };
}

function snapshot(
  nodes: readonly PairingHeapNode[],
  roots: readonly number[],
): PairingHeapSnapshot {
  return { nodes: nodes.map(cloneNode), roots: [...roots] };
}

// Build a pairing heap by repeatedly merging singletons. Returns the
// terminal snapshot (single root if `values` is non-empty).
export function buildPairingHeap(values: readonly number[]): PairingHeapSnapshot {
  const nodes: PairingHeapNode[] = [];
  let currentRoot: number | null = null;
  for (const value of values) {
    const id = nodes.length;
    nodes.push({ id, value, firstChildId: null, nextSiblingId: null });
    currentRoot = mergeInPlace(nodes, currentRoot, id);
  }
  return snapshot(nodes, currentRoot === null ? [] : [currentRoot]);
}

// Mutates `nodes` to link two heaps; returns the new root id. Internal
// helper shared by buildPairingHeap and the delete-min two-pass loops.
// Callers guarantee `bId` is non-null (buildPairingHeap always passes a
// freshly-created singleton; delete-min only invokes this inside loops
// where both pair members are known live). `aId` may be null (the
// running accumulator in the first build call) so the early return on
// null-a stays meaningful.
function mergeInPlace(nodes: PairingHeapNode[], aId: number | null, bId: number): number {
  if (aId === null) return bId;
  const a = nodes[aId];
  const b = nodes[bId];
  if (a.value <= b.value) {
    nodes[bId] = { ...b, nextSiblingId: a.firstChildId };
    nodes[aId] = { ...a, firstChildId: bId };
    return aId;
  }
  nodes[aId] = { ...a, nextSiblingId: b.firstChildId };
  nodes[bId] = { ...b, firstChildId: aId };
  return bId;
}

export function* pairingHeapMergeSequence(
  initial: PairingHeapSnapshot,
  aRootId: number | null,
  bRootId: number | null,
): Generator<PairingHeapMergeStep> {
  const nodes = initial.nodes.map(cloneNode);
  // Roots tracked locally; trimmed once the link happens.
  const presentRoots = new Set(initial.roots);

  yield {
    kind: "begin",
    heap: snapshot(nodes, [...presentRoots]),
    aRootId,
    bRootId,
    codeLines: pairingHeapMergeLines.begin,
  };

  if (aRootId === null && bRootId === null) {
    yield {
      kind: "done",
      heap: snapshot(nodes, [...presentRoots]),
      codeLines: pairingHeapMergeLines.done,
    };
    return;
  }
  if (aRootId === null) {
    yield {
      kind: "done",
      heap: snapshot(nodes, [...presentRoots]),
      codeLines: pairingHeapMergeLines.emptyA,
    };
    return;
  }
  if (bRootId === null) {
    yield {
      kind: "done",
      heap: snapshot(nodes, [...presentRoots]),
      codeLines: pairingHeapMergeLines.emptyB,
    };
    return;
  }

  yield {
    kind: "compare-roots",
    heap: snapshot(nodes, [...presentRoots]),
    aRootId,
    bRootId,
    codeLines: pairingHeapMergeLines.compareRoots,
  };

  const a = nodes[aRootId];
  const b = nodes[bRootId];
  let newRoot: number;
  let linkChild: number;
  if (a.value <= b.value) {
    nodes[bRootId] = { ...b, nextSiblingId: a.firstChildId };
    nodes[aRootId] = { ...a, firstChildId: bRootId };
    newRoot = aRootId;
    linkChild = bRootId;
    presentRoots.delete(bRootId);
    yield {
      kind: "link",
      heap: snapshot(nodes, [...presentRoots]),
      parentId: newRoot,
      childId: linkChild,
      codeLines: pairingHeapMergeLines.linkAFirst,
    };
  } else {
    nodes[aRootId] = { ...a, nextSiblingId: b.firstChildId };
    nodes[bRootId] = { ...b, firstChildId: aRootId };
    newRoot = bRootId;
    linkChild = aRootId;
    presentRoots.delete(aRootId);
    yield {
      kind: "link",
      heap: snapshot(nodes, [...presentRoots]),
      parentId: newRoot,
      childId: linkChild,
      codeLines: pairingHeapMergeLines.linkBFirst,
    };
  }

  yield {
    kind: "done",
    heap: snapshot(nodes, [...presentRoots]),
    codeLines: pairingHeapMergeLines.done,
  };
}

export function* pairingHeapDeleteMinSequence(
  initial: PairingHeapSnapshot,
): Generator<PairingHeapDeleteMinStep> {
  const nodes = initial.nodes.map(cloneNode);
  let roots = [...initial.roots];

  yield {
    kind: "begin",
    heap: snapshot(nodes, roots),
    codeLines: pairingHeapDeleteMinLines.begin,
  };

  if (roots.length === 0) {
    yield {
      kind: "done",
      heap: snapshot(nodes, roots),
      codeLines: pairingHeapDeleteMinLines.emptyHeap,
    };
    return;
  }

  const rootId = roots[0];
  const removedValue = nodes[rootId].value;

  // Collect children left-to-right by walking firstChild → nextSibling.
  const children: number[] = [];
  let cur = nodes[rootId].firstChildId;
  while (cur !== null) {
    children.push(cur);
    cur = nodes[cur].nextSiblingId;
  }
  // Detach: clear root's firstChild, clear each child's nextSibling so
  // each becomes a true root (no siblings, no parent).
  nodes[rootId] = { ...nodes[rootId], firstChildId: null };
  for (const c of children) {
    nodes[c] = { ...nodes[c], nextSiblingId: null };
  }
  // After remove-root the surviving roots are the original root's children.
  roots = [...children];

  yield {
    kind: "remove-root",
    heap: snapshot(nodes, roots),
    removedId: rootId,
    removedValue,
    codeLines: pairingHeapDeleteMinLines.removeRoot,
  };

  // Pass 1: pair-merge left to right.
  const pairs: number[] = [];
  for (let i = 0; i + 1 < children.length; i += 2) {
    const aId = children[i];
    const bId = children[i + 1];
    yield {
      kind: "pair-start",
      heap: snapshot(nodes, roots),
      removedId: rootId,
      aRootId: aId,
      bRootId: bId,
      codeLines: pairingHeapDeleteMinLines.pairStart,
    };
    const newRootId = mergeInPlace(nodes, aId, bId)!;
    const childId = newRootId === aId ? bId : aId;
    // Update roots: remove both pair members, add the merged root.
    roots = roots.filter((r) => r !== aId && r !== bId);
    roots.push(newRootId);
    pairs.push(newRootId);
    yield {
      kind: "pair-link",
      heap: snapshot(nodes, roots),
      removedId: rootId,
      parentId: newRootId,
      childId,
      codeLines: pairingHeapDeleteMinLines.pairLink,
    };
  }
  // Odd-out: last child becomes its own pair.
  if (children.length % 2 === 1) {
    pairs.push(children[children.length - 1]);
  }

  // Pass 2: fold right-to-left. The loop only enters when pairs.length
  // >= 2 (otherwise j starts < 0), so result is always a valid id inside.
  let result: number = pairs.length > 0 ? pairs[pairs.length - 1] : -1;
  for (let j = pairs.length - 2; j >= 0; j--) {
    const aId = pairs[j];
    yield {
      kind: "fold-start",
      heap: snapshot(nodes, roots),
      removedId: rootId,
      aRootId: aId,
      bRootId: result,
      codeLines: pairingHeapDeleteMinLines.fold,
    };
    const newRootId = mergeInPlace(nodes, aId, result);
    const childId = newRootId === aId ? result : aId;
    roots = roots.filter((r) => r !== aId && r !== result);
    roots.push(newRootId);
    result = newRootId;
    yield {
      kind: "fold-link",
      heap: snapshot(nodes, roots),
      removedId: rootId,
      parentId: newRootId,
      childId,
      codeLines: pairingHeapDeleteMinLines.foldLink,
    };
  }

  yield {
    kind: "done",
    heap: snapshot(nodes, roots),
    codeLines: pairingHeapDeleteMinLines.done,
  };
}

// Walks the LCRS structure and returns each node's depth in the tree
// and its parent id. Useful for layout and test introspection. Returns
// null for nodes that aren't reachable from any root.
export function pairingHeapDepths(snap: PairingHeapSnapshot): Map<number, number> {
  const depths = new Map<number, number>();
  for (const rootId of snap.roots) {
    visit(rootId, 0);
  }
  function visit(id: number, depth: number): void {
    depths.set(id, depth);
    const node = snap.nodes[id];
    let child = node.firstChildId;
    while (child !== null) {
      visit(child, depth + 1);
      child = snap.nodes[child].nextSiblingId;
    }
  }
  return depths;
}
