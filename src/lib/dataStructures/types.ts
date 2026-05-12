// Node ids are assigned sequentially as 0, 1, 2... so `id` equals the node's
// position in `BstSnapshot.nodes`. This lets consumers do `nodes[id]` lookups
// without a separate map.
export type BstNode = {
  readonly id: number;
  readonly value: number;
  readonly leftId: number | null;
  readonly rightId: number | null;
};

export type BstSnapshot = {
  readonly nodes: readonly BstNode[];
  readonly rootId: number | null;
};

type StepBase = { readonly codeLines?: readonly number[] };

export type BstStep =
  | (StepBase & { kind: "begin"; tree: BstSnapshot; insertingValue: number })
  | (StepBase & {
      kind: "compare";
      tree: BstSnapshot;
      cursorId: number;
      insertingValue: number;
    })
  | (StepBase & {
      kind: "place";
      tree: BstSnapshot;
      newId: number;
      parentId: number | null;
    })
  | (StepBase & {
      kind: "duplicate";
      tree: BstSnapshot;
      cursorId: number;
      insertingValue: number;
    })
  | (StepBase & { kind: "done"; tree: BstSnapshot });

export type BstSequenceOp = (values: readonly number[]) => Generator<BstStep, void, void>;

export type BstSearchStep =
  | (StepBase & { kind: "begin"; tree: BstSnapshot; targetValue: number })
  | (StepBase & {
      kind: "compare";
      tree: BstSnapshot;
      cursorId: number;
      targetValue: number;
    })
  | (StepBase & {
      kind: "found";
      tree: BstSnapshot;
      cursorId: number;
      targetValue: number;
    })
  | (StepBase & {
      kind: "miss";
      tree: BstSnapshot;
      lastCursorId: number | null;
      targetValue: number;
    })
  | (StepBase & { kind: "done"; tree: BstSnapshot });

export type BstDeleteCase = "leaf" | "one-child" | "two-children";

// Delete preserves the dense-id contract by orphaning rather than reusing slots:
// removed nodes stay in `BstSnapshot.nodes` but no parent points to them and they
// are not reachable from `rootId`. TreeView's layout walker only visits reachable
// nodes, so orphans render as gone while `nodes[id]` lookups remain valid.
// Traversal modes shared by all four classic orderings. Inorder is the
// signature BST traversal (gives sorted output); pre- and postorder differ
// only in when the root is emitted relative to its subtrees. Level-order is
// BFS (queue-based, not stack-based) and is the only one that doesn't fit a
// recursive descent.
export type TraversalMode = "preorder" | "inorder" | "postorder" | "level-order";

export type BstTraversalStep =
  | (StepBase & {
      kind: "begin";
      tree: BstSnapshot;
      mode: TraversalMode;
      sequence: readonly number[];
    })
  | (StepBase & {
      kind: "visit";
      tree: BstSnapshot;
      cursorId: number;
      mode: TraversalMode;
      sequence: readonly number[];
    })
  | (StepBase & {
      kind: "done";
      tree: BstSnapshot;
      mode: TraversalMode;
      sequence: readonly number[];
    });

// Hash table (separate chaining hash set). Entries are dense-id like BST nodes
// — `entries[id]` always returns the original entry, even after deletes — so
// step snapshots can refer back to historical entries by id. Buckets are
// `readonly number[]` lists of entry ids; delete splices the id out of the
// bucket but leaves the entry in `entries[]` (orphaned, unreachable from any
// bucket). Capacity is fixed for a given snapshot (no rehashing).
export type HashTableEntry = {
  readonly id: number;
  readonly key: number;
};

export type HashTableSnapshot = {
  readonly capacity: number;
  readonly entries: readonly HashTableEntry[];
  readonly buckets: readonly (readonly number[])[];
};

export type HashTableStep =
  | (StepBase & { kind: "begin"; table: HashTableSnapshot; insertingKey: number })
  | (StepBase & {
      kind: "hash";
      table: HashTableSnapshot;
      insertingKey: number;
      bucketIndex: number;
    })
  | (StepBase & {
      kind: "probe";
      table: HashTableSnapshot;
      insertingKey: number;
      bucketIndex: number;
      cursorEntryId: number;
    })
  | (StepBase & {
      kind: "duplicate";
      table: HashTableSnapshot;
      insertingKey: number;
      bucketIndex: number;
      cursorEntryId: number;
    })
  | (StepBase & {
      kind: "place";
      table: HashTableSnapshot;
      newEntryId: number;
      bucketIndex: number;
    })
  | (StepBase & { kind: "done"; table: HashTableSnapshot });

export type HashTableSearchStep =
  | (StepBase & { kind: "begin"; table: HashTableSnapshot; targetKey: number })
  | (StepBase & {
      kind: "hash";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
    })
  | (StepBase & {
      kind: "probe";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
      cursorEntryId: number;
    })
  | (StepBase & {
      kind: "found";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
      cursorEntryId: number;
    })
  | (StepBase & {
      kind: "miss";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
    })
  | (StepBase & { kind: "done"; table: HashTableSnapshot });

export type HashTableDeleteStep =
  | (StepBase & { kind: "begin"; table: HashTableSnapshot; targetKey: number })
  | (StepBase & {
      kind: "hash";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
    })
  | (StepBase & {
      kind: "probe";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
      cursorEntryId: number;
    })
  | (StepBase & {
      kind: "found";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
      cursorEntryId: number;
    })
  | (StepBase & {
      kind: "unlink";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
      removedEntryId: number;
    })
  | (StepBase & {
      kind: "miss";
      table: HashTableSnapshot;
      targetKey: number;
      bucketIndex: number;
    })
  | (StepBase & { kind: "done"; table: HashTableSnapshot });

// Min-heap (binary heap) stored as a packed array. `heap[0]` is the root /
// minimum, children of index i live at 2i+1 and 2i+2, parent at (i-1)>>1.
// `size` is the count of live elements — for the extract path we keep prior
// values in `heap` so the "removed value" can still be referenced by step
// snapshots, but `size` shrinks. The viz reads `heap.slice(0, size)` to render.
export type HeapSnapshot = {
  readonly heap: readonly number[];
  readonly size: number;
};

export type HeapInsertStep =
  | (StepBase & { kind: "begin"; heap: HeapSnapshot; insertingValue: number })
  | (StepBase & {
      kind: "append";
      heap: HeapSnapshot;
      cursorIndex: number;
      insertingValue: number;
    })
  | (StepBase & {
      kind: "compare-parent";
      heap: HeapSnapshot;
      cursorIndex: number;
      parentIndex: number;
      insertingValue: number;
    })
  | (StepBase & {
      kind: "swap-up";
      heap: HeapSnapshot;
      // `cursorIndex` is the new home of the inserted value (= old parent
      // slot). `fromIndex` is the slot it just vacated (= old cursor).
      cursorIndex: number;
      fromIndex: number;
      insertingValue: number;
    })
  | (StepBase & {
      kind: "settle";
      heap: HeapSnapshot;
      cursorIndex: number;
      insertingValue: number;
    })
  | (StepBase & { kind: "done"; heap: HeapSnapshot });

// Heapify is a one-shot operation that turns an arbitrary array into a
// valid min-heap by sift-down from `(n // 2) - 1` down to 0 — internal nodes
// processed in reverse order. Each sift-down is its own mini-traversal so we
// emit `start-sift` to mark a new pass over a sub-root, plus compare /
// swap / settle to show what happens within that pass.
export type HeapifyStep =
  | (StepBase & { kind: "begin"; heap: HeapSnapshot })
  | (StepBase & {
      kind: "start-sift";
      heap: HeapSnapshot;
      cursorIndex: number;
    })
  | (StepBase & {
      kind: "compare-children";
      heap: HeapSnapshot;
      cursorIndex: number;
      leftIndex: number;
      rightIndex: number | null;
      smallerIndex: number;
    })
  | (StepBase & {
      kind: "swap-down";
      heap: HeapSnapshot;
      cursorIndex: number;
      fromIndex: number;
    })
  | (StepBase & {
      kind: "settle";
      heap: HeapSnapshot;
      cursorIndex: number;
    })
  | (StepBase & { kind: "done"; heap: HeapSnapshot });

export type HeapExtractStep =
  | (StepBase & { kind: "begin"; heap: HeapSnapshot })
  | (StepBase & {
      kind: "take-root";
      heap: HeapSnapshot;
      extractedValue: number;
    })
  | (StepBase & {
      kind: "move-last";
      heap: HeapSnapshot;
      cursorIndex: number;
      extractedValue: number;
    })
  | (StepBase & {
      kind: "compare-children";
      heap: HeapSnapshot;
      cursorIndex: number;
      leftIndex: number;
      rightIndex: number | null;
      smallerIndex: number;
      extractedValue: number;
    })
  | (StepBase & {
      kind: "swap-down";
      heap: HeapSnapshot;
      // `cursorIndex` is the new home of the descending value (= the child
      // slot we just swapped into). `fromIndex` is the slot it left.
      cursorIndex: number;
      fromIndex: number;
      extractedValue: number;
    })
  | (StepBase & {
      kind: "settle";
      heap: HeapSnapshot;
      cursorIndex: number;
      extractedValue: number;
    })
  | (StepBase & { kind: "empty"; heap: HeapSnapshot })
  | (StepBase & { kind: "done"; heap: HeapSnapshot });

export type BstDeleteStep =
  | (StepBase & { kind: "begin"; tree: BstSnapshot; targetValue: number })
  | (StepBase & {
      kind: "compare";
      tree: BstSnapshot;
      cursorId: number;
      targetValue: number;
    })
  | (StepBase & {
      kind: "miss";
      tree: BstSnapshot;
      lastCursorId: number | null;
      targetValue: number;
    })
  | (StepBase & {
      kind: "found";
      tree: BstSnapshot;
      cursorId: number;
      targetValue: number;
      deleteCase: BstDeleteCase;
    })
  | (StepBase & {
      kind: "find-successor";
      tree: BstSnapshot;
      cursorId: number;
      targetCursorId: number;
      targetValue: number;
    })
  | (StepBase & {
      kind: "swap-value";
      tree: BstSnapshot;
      targetCursorId: number;
      successorId: number;
      newValue: number;
    })
  | (StepBase & {
      kind: "unlink";
      tree: BstSnapshot;
      removedNodeId: number;
      removedValue: number;
      deleteCase: BstDeleteCase;
    })
  | (StepBase & { kind: "done"; tree: BstSnapshot });
