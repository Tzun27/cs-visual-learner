import { fibonacciHeapDecreaseKeyLines } from "./fibonacciHeapDecreaseKey.snippet";
import { fibonacciHeapExtractMinLines } from "./fibonacciHeapExtractMin.snippet";
import { fibonacciHeapInsertLines } from "./fibonacciHeapInsert.snippet";
import type {
  FibonacciHeapDecreaseKeyStep,
  FibonacciHeapExtractMinStep,
  FibonacciHeapInsertStep,
  FibonacciHeapNode,
  FibonacciHeapSnapshot,
} from "./types";

export const emptyFibonacciHeap: FibonacciHeapSnapshot = { nodes: [], roots: [], minId: null };

function cloneNode(n: FibonacciHeapNode): FibonacciHeapNode {
  return {
    id: n.id,
    value: n.value,
    parentId: n.parentId,
    firstChildId: n.firstChildId,
    nextSiblingId: n.nextSiblingId,
    degree: n.degree,
    mark: n.mark,
  };
}

function snapshot(
  nodes: readonly FibonacciHeapNode[],
  roots: readonly number[],
  minId: number | null,
): FibonacciHeapSnapshot {
  return { nodes: nodes.map(cloneNode), roots: [...roots], minId };
}

function pickMinId(nodes: readonly FibonacciHeapNode[], roots: readonly number[]): number | null {
  if (roots.length === 0) return null;
  let minId = roots[0];
  let minValue = nodes[minId].value;
  for (let i = 1; i < roots.length; i++) {
    const id = roots[i];
    if (nodes[id].value < minValue) {
      minId = id;
      minValue = nodes[id].value;
    }
  }
  return minId;
}

// Children of `parentId`, in firstChild → nextSibling walk order.
function childrenOf(nodes: readonly FibonacciHeapNode[], parentId: number): number[] {
  const out: number[] = [];
  let cur = nodes[parentId].firstChildId;
  while (cur !== null) {
    out.push(cur);
    cur = nodes[cur].nextSiblingId;
  }
  return out;
}

// Detach `childId` from `parentId`'s child list. Mutates `nodes` in place.
// Walks the sibling chain — O(degree) per cut. Acceptable for teaching-
// scale heaps; production implementations use circular doubly-linked
// lists for O(1) cuts.
function detachChild(nodes: FibonacciHeapNode[], parentId: number, childId: number): void {
  const parent = nodes[parentId];
  if (parent.firstChildId === childId) {
    const child = nodes[childId];
    nodes[parentId] = {
      ...parent,
      firstChildId: child.nextSiblingId,
      degree: parent.degree - 1,
    };
    nodes[childId] = { ...child, parentId: null, nextSiblingId: null };
    return;
  }
  let prev = parent.firstChildId;
  while (prev !== null && nodes[prev].nextSiblingId !== childId) {
    prev = nodes[prev].nextSiblingId;
  }
  /* v8 ignore next 3 */
  if (prev === null) {
    throw new Error(`detachChild: ${childId} is not a child of ${parentId}`);
  }
  const prevNode = nodes[prev];
  const child = nodes[childId];
  nodes[prev] = { ...prevNode, nextSiblingId: child.nextSiblingId };
  nodes[parentId] = { ...parent, degree: parent.degree - 1 };
  nodes[childId] = { ...child, parentId: null, nextSiblingId: null };
}

// Link `yId` as a child of `xId`. Caller has already established that
// nodes[xId].value <= nodes[yId].value. Mutates `nodes` in place.
// Adds y at the head of x's child list (any position is valid; head is
// O(1)). y leaves the root list — caller updates `roots`. y's mark
// resets: the textbook link() does so because the child became a non-
// root via consolidate, not via losing one of its own children.
function linkChild(nodes: FibonacciHeapNode[], xId: number, yId: number): void {
  const x = nodes[xId];
  const y = nodes[yId];
  nodes[yId] = {
    ...y,
    parentId: xId,
    nextSiblingId: x.firstChildId,
    mark: false,
  };
  nodes[xId] = {
    ...x,
    firstChildId: yId,
    degree: x.degree + 1,
  };
}

export function* fibonacciHeapInsertSequence(
  initial: FibonacciHeapSnapshot,
  values: readonly number[],
): Generator<FibonacciHeapInsertStep> {
  const nodes: FibonacciHeapNode[] = initial.nodes.map(cloneNode);
  let roots = [...initial.roots];
  let minId = initial.minId;

  for (const value of values) {
    yield {
      kind: "begin",
      heap: snapshot(nodes, roots, minId),
      insertingValue: value,
      codeLines: fibonacciHeapInsertLines.begin,
    };

    const newId = nodes.length;
    nodes.push({
      id: newId,
      value,
      parentId: null,
      firstChildId: null,
      nextSiblingId: null,
      degree: 0,
      mark: false,
    });
    // Prepend: newest insert sits at the head of the root list so the
    // viz reads left-to-right as newest-to-oldest, matching insert order.
    roots = [newId, ...roots];
    const updatedMin = minId === null || value < nodes[minId].value;
    if (updatedMin) minId = newId;

    yield {
      kind: "add-root",
      heap: snapshot(nodes, roots, minId),
      newNodeId: newId,
      updatedMin,
      codeLines: fibonacciHeapInsertLines.addRoot,
    };
  }

  yield {
    kind: "done",
    heap: snapshot(nodes, roots, minId),
    codeLines: fibonacciHeapInsertLines.done,
  };
}

export function* fibonacciHeapExtractMinSequence(
  initial: FibonacciHeapSnapshot,
): Generator<FibonacciHeapExtractMinStep> {
  const nodes: FibonacciHeapNode[] = initial.nodes.map(cloneNode);
  let roots = [...initial.roots];
  let minId = initial.minId;

  yield {
    kind: "begin",
    heap: snapshot(nodes, roots, minId),
    codeLines: fibonacciHeapExtractMinLines.begin,
  };

  if (minId === null) {
    yield {
      kind: "empty",
      heap: snapshot(nodes, roots, minId),
      codeLines: fibonacciHeapExtractMinLines.empty,
    };
    yield {
      kind: "done",
      heap: snapshot(nodes, roots, minId),
      codeLines: fibonacciHeapExtractMinLines.done,
    };
    return;
  }

  // Promote min's children to the root list, clear their parent + sibling
  // pointers, then remove the min from the root list.
  const removedId = minId;
  const removedValue = nodes[removedId].value;
  const promotedChildren = childrenOf(nodes, removedId);
  for (const childId of promotedChildren) {
    nodes[childId] = {
      ...nodes[childId],
      parentId: null,
      nextSiblingId: null,
      mark: false, // promoting to root resets mark
    };
  }
  nodes[removedId] = {
    ...nodes[removedId],
    firstChildId: null,
    degree: 0,
  };
  // New root list: original roots minus the removed min, plus the
  // promoted children appended at the end (consolidation order doesn't
  // depend on this, but a deterministic order makes the viz reproducible).
  roots = roots.filter((r) => r !== removedId).concat(promotedChildren);

  yield {
    kind: "remove-min",
    heap: snapshot(nodes, roots, null),
    removedId,
    removedValue,
    promotedChildren,
    codeLines: fibonacciHeapExtractMinLines.removeMin,
  };

  // Consolidate.
  yield {
    kind: "consolidate-start",
    heap: snapshot(nodes, roots, null),
    codeLines: fibonacciHeapExtractMinLines.consolidateStart,
  };

  // buckets[degree] = rootId. Walk the root snapshot left-to-right;
  // any time we hit a degree that's already in the buckets, link the
  // two and bump the degree, looping until the bucket is free.
  const buckets = new Map<number, number>();
  const initialRoots = [...roots];
  for (const startId of initialRoots) {
    let x = startId;
    let d = nodes[x].degree;
    yield {
      kind: "consolidate-inspect",
      heap: snapshot(nodes, roots, null),
      rootId: x,
      degree: d,
      codeLines: fibonacciHeapExtractMinLines.consolidateInspect,
    };
    while (buckets.has(d)) {
      let y = buckets.get(d)!;
      // x is the smaller-value root; swap if not.
      if (nodes[x].value > nodes[y].value) {
        const tmp = x;
        x = y;
        y = tmp;
      }
      yield {
        kind: "consolidate-pair",
        heap: snapshot(nodes, roots, null),
        aRootId: x,
        bRootId: y,
        degree: d,
        codeLines: fibonacciHeapExtractMinLines.consolidatePair,
      };
      // Link y under x. y leaves the root list.
      linkChild(nodes, x, y);
      roots = roots.filter((r) => r !== y);
      buckets.delete(d);
      const newDegree = nodes[x].degree;
      yield {
        kind: "consolidate-link",
        heap: snapshot(nodes, roots, null),
        parentId: x,
        childId: y,
        newDegree,
        codeLines: fibonacciHeapExtractMinLines.consolidateLink,
      };
      d = newDegree;
    }
    buckets.set(d, x);
  }

  // Update min after consolidate.
  minId = pickMinId(nodes, roots);
  yield {
    kind: "update-min",
    heap: snapshot(nodes, roots, minId),
    newMinId: minId,
    codeLines: fibonacciHeapExtractMinLines.updateMin,
  };

  yield {
    kind: "done",
    heap: snapshot(nodes, roots, minId),
    codeLines: fibonacciHeapExtractMinLines.done,
  };
}

export function* fibonacciHeapDecreaseKeySequence(
  initial: FibonacciHeapSnapshot,
  nodeId: number,
  newValue: number,
): Generator<FibonacciHeapDecreaseKeyStep> {
  const nodes: FibonacciHeapNode[] = initial.nodes.map(cloneNode);
  let roots = [...initial.roots];
  let minId = initial.minId;

  const oldValue = nodes[nodeId].value;
  if (newValue > oldValue) {
    throw new Error(
      `decrease_key: new value ${newValue} greater than current ${oldValue} for node ${nodeId}`,
    );
  }

  yield {
    kind: "begin",
    heap: snapshot(nodes, roots, minId),
    nodeId,
    newValue,
    oldValue,
    codeLines: fibonacciHeapDecreaseKeyLines.begin,
  };

  nodes[nodeId] = { ...nodes[nodeId], value: newValue };

  yield {
    kind: "set-value",
    heap: snapshot(nodes, roots, minId),
    nodeId,
    newValue,
    codeLines: fibonacciHeapDecreaseKeyLines.setValue,
  };

  const parentId = nodes[nodeId].parentId;
  if (parentId !== null) {
    yield {
      kind: "check-parent",
      heap: snapshot(nodes, roots, minId),
      nodeId,
      parentId,
      codeLines: fibonacciHeapDecreaseKeyLines.checkParent,
    };

    if (nodes[nodeId].value < nodes[parentId].value) {
      // Cut + cascading cut loop. We walk up the tree as long as the
      // node being cut had a marked parent.
      let cursor = nodeId;
      let parent = parentId;
      while (true) {
        const parentWasMarked = nodes[parent].mark;
        detachChild(nodes, parent, cursor);
        // Reset cursor's mark — it's now a root, marks meaningless on roots.
        nodes[cursor] = { ...nodes[cursor], mark: false };
        roots = [...roots, cursor];
        yield {
          kind: "cut",
          heap: snapshot(nodes, roots, minId),
          nodeId: cursor,
          parentId: parent,
          parentWasMarked,
          codeLines: fibonacciHeapDecreaseKeyLines.cut,
        };

        const grandparent = nodes[parent].parentId;
        if (grandparent === null) {
          // Parent is itself a root — cascade stops without marking.
          break;
        }
        if (!parentWasMarked) {
          // Mark the parent and stop.
          nodes[parent] = { ...nodes[parent], mark: true };
          yield {
            kind: "cascade-mark",
            heap: snapshot(nodes, roots, minId),
            parentId: parent,
            codeLines: fibonacciHeapDecreaseKeyLines.cascadeMark,
          };
          break;
        }
        // Cascade up: cut the parent too.
        cursor = parent;
        parent = grandparent;
      }
    } else {
      yield {
        kind: "no-violation",
        heap: snapshot(nodes, roots, minId),
        nodeId,
        codeLines: fibonacciHeapDecreaseKeyLines.noViolation,
      };
    }
  }

  // Update min if needed.
  const newMinId = pickMinId(nodes, roots);
  if (newMinId !== minId) {
    minId = newMinId;
    /* v8 ignore next 3 */
    if (minId === null) {
      throw new Error("decrease_key: heap became empty unexpectedly");
    }
    yield {
      kind: "update-min",
      heap: snapshot(nodes, roots, minId),
      newMinId: minId,
      codeLines: fibonacciHeapDecreaseKeyLines.updateMin,
    };
  }

  yield {
    kind: "done",
    heap: snapshot(nodes, roots, minId),
    codeLines: fibonacciHeapDecreaseKeyLines.done,
  };
}

// Build a Fibonacci heap by successive inserts. Returns the terminal
// snapshot.
export function buildFibonacciHeap(values: readonly number[]): FibonacciHeapSnapshot {
  let final: FibonacciHeapSnapshot = emptyFibonacciHeap;
  for (const step of fibonacciHeapInsertSequence(final, values)) {
    if (step.kind === "done") final = step.heap;
  }
  return final;
}

// Returns the (depth, parentId) of every reachable node, for layout
// and test introspection.
export function fibonacciHeapDepths(snap: FibonacciHeapSnapshot): Map<number, number> {
  const depths = new Map<number, number>();
  function visit(id: number, depth: number): void {
    depths.set(id, depth);
    let child = snap.nodes[id].firstChildId;
    while (child !== null) {
      visit(child, depth + 1);
      child = snap.nodes[child].nextSiblingId;
    }
  }
  for (const rootId of snap.roots) visit(rootId, 0);
  return depths;
}

// Sanity check the Fibonacci heap invariants on a snapshot:
//   1. Each root has parentId = null.
//   2. Each non-root's value >= parent's value (min-heap order).
//   3. Each node's `degree` == number of children.
//   4. `minId` is the root with the smallest value (or null iff roots empty).
//   5. Roots have mark=false (only non-roots carry meaningful marks).
// Returns true if all hold. Used by property tests.
export function isFibonacciHeapValid(snap: FibonacciHeapSnapshot): boolean {
  const { nodes, roots, minId } = snap;
  // (1) + (5)
  for (const rootId of roots) {
    if (nodes[rootId].parentId !== null) return false;
    if (nodes[rootId].mark) return false;
  }
  // (4)
  if (roots.length === 0) {
    if (minId !== null) return false;
  } else {
    const expectedMin = pickMinId(nodes, roots);
    if (expectedMin !== minId) return false;
  }
  // (2) + (3): traverse every tree
  for (const rootId of roots) {
    if (!validateSubtree(nodes, rootId)) return false;
  }
  return true;
}

function validateSubtree(nodes: readonly FibonacciHeapNode[], rootId: number): boolean {
  const stack: number[] = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = nodes[id];
    const children = childrenOf(nodes, id);
    if (children.length !== node.degree) return false;
    for (const childId of children) {
      const child = nodes[childId];
      if (child.parentId !== id) return false;
      if (child.value < node.value) return false;
      stack.push(childId);
    }
  }
  return true;
}
