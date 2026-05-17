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

// Hash table (separate chaining hash map). Entries are dense-id like BST
// nodes — `entries[id]` always returns the original entry, even after
// deletes — so step snapshots can refer back to historical entries by id.
// Each entry carries both `key` and `value`: this is a hash _map_, not a
// hash set, so duplicate-key puts overwrite the value rather than drop the
// input. Buckets are `readonly number[]` lists of entry ids; delete splices
// the id out of the bucket but leaves the entry in `entries[]` (orphaned,
// unreachable from any bucket). Capacity is fixed for a given snapshot
// (no rehashing).
export type HashTableEntry = {
  readonly id: number;
  readonly key: number;
  readonly value: number;
};

// `(key, value)` input tuple consumed by the put / insertSequence
// generator and by buildHashTable. Tuples (not objects) so the source
// arrays read like Python `dict.items()` literals.
export type HashTableKV = readonly [number, number];

export type HashTableSnapshot = {
  readonly capacity: number;
  readonly entries: readonly HashTableEntry[];
  readonly buckets: readonly (readonly number[])[];
};

export type HashTableStep =
  | (StepBase & {
      kind: "begin";
      table: HashTableSnapshot;
      insertingKey: number;
      insertingValue: number;
    })
  | (StepBase & {
      kind: "hash";
      table: HashTableSnapshot;
      insertingKey: number;
      insertingValue: number;
      bucketIndex: number;
    })
  | (StepBase & {
      kind: "probe";
      table: HashTableSnapshot;
      insertingKey: number;
      insertingValue: number;
      bucketIndex: number;
      cursorEntryId: number;
    })
  | (StepBase & {
      // The key already lives in this bucket — the put OVERWRITES that
      // entry's value (map semantics). The snapshot at this step has
      // already been mutated; `oldValue` is the value that was just
      // replaced and is carried for annotation purposes only.
      kind: "overwrite";
      table: HashTableSnapshot;
      insertingKey: number;
      insertingValue: number;
      oldValue: number;
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
      // Map-semantics: a found step surfaces the entry's value so the
      // viz / annotation can render "X → 250" rather than just "X".
      foundValue: number;
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

// `decrease_key` lowers an existing entry's value and sifts it up until
// the min-heap invariant holds. Structurally similar to insert's siftUp
// path, but the cursor starts at an arbitrary index (chosen by the
// caller / a priority-queue handle) rather than at the new last slot —
// so there's no `append` step and the begin step records the index, the
// new value, and the old value that's being overwritten.
export type HeapDecreaseKeyStep =
  | (StepBase & {
      kind: "begin";
      heap: HeapSnapshot;
      index: number;
      newValue: number;
      oldValue: number;
    })
  | (StepBase & {
      kind: "set";
      heap: HeapSnapshot;
      cursorIndex: number;
      newValue: number;
    })
  | (StepBase & {
      kind: "compare-parent";
      heap: HeapSnapshot;
      cursorIndex: number;
      parentIndex: number;
    })
  | (StepBase & {
      kind: "swap-up";
      heap: HeapSnapshot;
      // Mirrors insert's convention: `cursorIndex` is where the value
      // now lives (= old parent slot), `fromIndex` is the slot just
      // vacated (= old cursor slot).
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

// Open-addressing hash table (linear probing) as a hash set. Each slot is
// in one of three states: empty (never held a value), tombstone (held a
// value that was deleted), or occupied with a key. Tombstones are the
// load-bearing difference from separate chaining: deleting a key cannot
// reset the slot to "empty," because a subsequent search could probe past
// it and incorrectly report a miss for a later key in the same cluster.
export type LinearProbeSlot =
  | { readonly state: "empty" }
  | { readonly state: "tombstone" }
  | { readonly state: "occupied"; readonly key: number };

export type LinearProbeSnapshot = {
  readonly capacity: number;
  readonly slots: readonly LinearProbeSlot[];
};

export type LinearProbeInsertStep =
  | (StepBase & { kind: "begin"; table: LinearProbeSnapshot; insertingKey: number })
  | (StepBase & {
      kind: "hash";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "probe";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
      probeCount: number;
    })
  | (StepBase & {
      kind: "duplicate";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "place";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
    })
  | (StepBase & { kind: "done"; table: LinearProbeSnapshot });

export type LinearProbeSearchStep =
  | (StepBase & { kind: "begin"; table: LinearProbeSnapshot; targetKey: number })
  | (StepBase & {
      kind: "hash";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "probe";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
      probeCount: number;
    })
  | (StepBase & {
      kind: "found";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "miss";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & { kind: "done"; table: LinearProbeSnapshot });

// Robin Hood probing reuses LinearProbeSnapshot's slot layout, but the
// insert algorithm carries a per-key "probe count" (= current distance
// from home slot) and swaps with any cursor whose probe count is strictly
// smaller — "rob from the rich, give to the poor." That keeps the
// distribution of probe distances tight, at the cost of more work per
// insert. The lesson uses this only for insert; for the data layer to
// stay symmetric with the rest of the file we model just the steps the
// insert generator needs.
export type RobinHoodInsertStep =
  | (StepBase & { kind: "begin"; table: LinearProbeSnapshot; insertingKey: number })
  | (StepBase & {
      kind: "hash";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "compare-displacement";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
      insertingProbe: number;
      existingProbe: number;
    })
  | (StepBase & {
      kind: "swap";
      table: LinearProbeSnapshot;
      // After the swap, the *inserting* key sat at slotIndex; the
      // displaced cursor key now becomes the active "key to insert" and
      // continues from this slot. evictedKey is the key that just got
      // kicked out (now active).
      slotIndex: number;
      placedKey: number;
      evictedKey: number;
      probe: number;
    })
  | (StepBase & {
      kind: "probe";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
      probe: number;
    })
  | (StepBase & {
      kind: "duplicate";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "place";
      table: LinearProbeSnapshot;
      insertingKey: number;
      slotIndex: number;
      probe: number;
    })
  | (StepBase & { kind: "done"; table: LinearProbeSnapshot });

// Robin Hood backshift deletion. Once the target is found, walk forward
// pulling each subsequent key one slot toward its home, stopping when the
// next slot is empty or holds a key already at displacement 0. This
// restores the Robin Hood displacement invariants without leaving any
// tombstones — at the cost of more bookkeeping per delete than the
// linear-probing tombstone scheme.
export type RobinHoodDeleteStep =
  | (StepBase & { kind: "begin"; table: LinearProbeSnapshot; targetKey: number })
  | (StepBase & {
      kind: "hash";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "probe";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
      probeCount: number;
    })
  | (StepBase & {
      kind: "found";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "pull";
      table: LinearProbeSnapshot;
      // `pulledKey` moved from `fromIndex` to `toIndex` (always
      // `toIndex = fromIndex - 1` modulo capacity).
      fromIndex: number;
      toIndex: number;
      pulledKey: number;
    })
  | (StepBase & {
      kind: "clear";
      table: LinearProbeSnapshot;
      // Slot that was just emptied. `blockerIndex` is the next-forward slot
      // that couldn't be pulled; the viz can highlight both so the user sees
      // why the chain stopped here.
      clearedIndex: number;
      blockerIndex: number;
      blockerReason: "empty" | "at-home";
    })
  | (StepBase & {
      kind: "miss";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & { kind: "done"; table: LinearProbeSnapshot });

export type LinearProbeDeleteStep =
  | (StepBase & { kind: "begin"; table: LinearProbeSnapshot; targetKey: number })
  | (StepBase & {
      kind: "hash";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "probe";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
      probeCount: number;
    })
  | (StepBase & {
      kind: "found";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "tombstone";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "miss";
      table: LinearProbeSnapshot;
      targetKey: number;
      slotIndex: number;
    })
  | (StepBase & { kind: "done"; table: LinearProbeSnapshot });

// Pairing heap. A min-heap implemented as a multi-way tree where each
// node's children form a singly linked list — represented here in
// "left-child, right-sibling" form: a node's `firstChildId` points to
// the head of its child list, and each child's `nextSiblingId` walks
// the rest of that list. The heap's roots are tracked separately
// because some intermediate states (delete-min's two-pass merge) have
// more than one root briefly. In steady state the snapshot has exactly
// one root or zero (empty).
export type PairingHeapNode = {
  readonly id: number;
  readonly value: number;
  readonly firstChildId: number | null;
  readonly nextSiblingId: number | null;
};

export type PairingHeapSnapshot = {
  readonly nodes: readonly PairingHeapNode[];
  readonly roots: readonly number[];
};

// Merge takes two heaps and produces one. The "link" step makes the
// node with the larger root value a child of the node with the smaller
// root value (min-heap order). When either heap is empty the result is
// the other; that's why both root ids are nullable in the begin step.
export type PairingHeapMergeStep =
  | (StepBase & {
      kind: "begin";
      heap: PairingHeapSnapshot;
      aRootId: number | null;
      bRootId: number | null;
    })
  | (StepBase & {
      kind: "compare-roots";
      heap: PairingHeapSnapshot;
      aRootId: number;
      bRootId: number;
    })
  | (StepBase & {
      kind: "link";
      heap: PairingHeapSnapshot;
      parentId: number;
      childId: number;
    })
  | (StepBase & { kind: "done"; heap: PairingHeapSnapshot });

// Delete-min removes the current root and merges its children using
// the classic two-pass algorithm: first pass merges children left to
// right in pairs; second pass folds the resulting list right-to-left.
// The viz emits a step for each phase boundary plus each individual
// child-pair link.
export type PairingHeapDeleteMinStep =
  | (StepBase & { kind: "begin"; heap: PairingHeapSnapshot })
  | (StepBase & {
      kind: "remove-root";
      heap: PairingHeapSnapshot;
      removedId: number;
      removedValue: number;
    })
  | (StepBase & {
      kind: "pair-start";
      heap: PairingHeapSnapshot;
      removedId: number;
      // The two roots currently being paired in the first pass.
      aRootId: number;
      bRootId: number;
    })
  | (StepBase & {
      kind: "pair-link";
      heap: PairingHeapSnapshot;
      removedId: number;
      parentId: number;
      childId: number;
    })
  | (StepBase & {
      kind: "fold-start";
      heap: PairingHeapSnapshot;
      removedId: number;
      aRootId: number;
      bRootId: number;
    })
  | (StepBase & {
      kind: "fold-link";
      heap: PairingHeapSnapshot;
      removedId: number;
      parentId: number;
      childId: number;
    })
  | (StepBase & { kind: "done"; heap: PairingHeapSnapshot });

// Hopscotch hashing: open addressing with a bounded probe distance H
// (the "neighborhood"). Each slot owns a hopInfo bitmask of H bits; bit j
// of slot i set means slot (i+j) mod capacity holds a key whose home is i.
// Lookups become bounded: scan at most H slots indicated by hopInfo[home].
// Inserts may run a swap chain: when the nearest empty slot is too far
// from home, walk backwards looking for a slot whose resident can be
// "moved up" to free a closer position. Slots carry their home explicitly
// so a swap can update both hopInfo masks correctly.
export type HopscotchSlot =
  | { readonly state: "empty" }
  | { readonly state: "occupied"; readonly key: number; readonly home: number };

export type HopscotchSnapshot = {
  readonly capacity: number;
  readonly neighborhood: number;
  readonly slots: readonly HopscotchSlot[];
  // One bitmask per slot. `hopInfo[i] & (1 << j)` is set when slot
  // `(i + j) mod capacity` holds a key whose home is `i`.
  readonly hopInfo: readonly number[];
};

export type HopscotchInsertStep =
  | (StepBase & { kind: "begin"; table: HopscotchSnapshot; insertingKey: number })
  | (StepBase & {
      kind: "hash";
      table: HopscotchSnapshot;
      insertingKey: number;
      home: number;
    })
  | (StepBase & {
      kind: "scan";
      table: HopscotchSnapshot;
      insertingKey: number;
      home: number;
      // Slot being inspected during the linear scan for the nearest
      // empty slot. `distance` = (slotIndex - home) mod capacity.
      slotIndex: number;
      distance: number;
    })
  | (StepBase & {
      kind: "duplicate";
      table: HopscotchSnapshot;
      insertingKey: number;
      home: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "swap";
      table: HopscotchSnapshot;
      insertingKey: number;
      home: number;
      // The key at `fromIndex` moved to `toIndex` (the previously-empty
      // slot). After this step, the new empty slot lives at `fromIndex`.
      fromIndex: number;
      toIndex: number;
      pulledKey: number;
      pulledHome: number;
    })
  | (StepBase & {
      kind: "place";
      table: HopscotchSnapshot;
      insertingKey: number;
      home: number;
      slotIndex: number;
      distance: number;
    })
  | (StepBase & { kind: "done"; table: HopscotchSnapshot });

export type HopscotchSearchStep =
  | (StepBase & { kind: "begin"; table: HopscotchSnapshot; targetKey: number })
  | (StepBase & {
      kind: "hash";
      table: HopscotchSnapshot;
      targetKey: number;
      home: number;
      hopMask: number;
    })
  | (StepBase & {
      kind: "check-bit";
      table: HopscotchSnapshot;
      targetKey: number;
      home: number;
      // bitIndex j in [0, H). slotIndex = (home + j) mod capacity.
      bitIndex: number;
      slotIndex: number;
      isSet: boolean;
    })
  | (StepBase & {
      kind: "found";
      table: HopscotchSnapshot;
      targetKey: number;
      home: number;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "miss";
      table: HopscotchSnapshot;
      targetKey: number;
      home: number;
    })
  | (StepBase & { kind: "done"; table: HopscotchSnapshot });

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

// Cuckoo hashing: two equal-sized tables T_A and T_B with independent
// hash functions h1 and h2. Every key lives in exactly one of
// T_A[h1(k)] or T_B[h2(k)] — lookups and deletes touch at most two
// slots (always constant work). Inserts may run an eviction cascade:
// placing X at T_A[h1(X)] displaces the resident, who tries T_B[h2(.)];
// if that slot is occupied, the cascade continues, alternating tables,
// until either an empty slot is found or a max-iteration cap is hit
// (signalling a near-100%-load-factor cycle requiring a rehash, which
// the lesson's curated input never triggers). Unlike open-addressing
// with tombstones, deletion just clears the slot — searches still
// touch the same two well-defined positions for every key.
export type CuckooSlot =
  | { readonly state: "empty" }
  | { readonly state: "occupied"; readonly key: number };

export type CuckooSide = "A" | "B";

export type CuckooSnapshot = {
  readonly capacity: number;
  readonly slotsA: readonly CuckooSlot[];
  readonly slotsB: readonly CuckooSlot[];
};

export type CuckooInsertStep =
  | (StepBase & { kind: "begin"; table: CuckooSnapshot; insertingKey: number })
  | (StepBase & {
      kind: "hash";
      table: CuckooSnapshot;
      insertingKey: number;
      home1: number;
      home2: number;
    })
  | (StepBase & {
      kind: "dedup-check";
      table: CuckooSnapshot;
      insertingKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "duplicate";
      table: CuckooSnapshot;
      insertingKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "check";
      table: CuckooSnapshot;
      activeKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "place";
      table: CuckooSnapshot;
      placedKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "evict";
      // Snapshot AFTER the swap: placedKey now sits in T_side[slotIndex],
      // evictedKey is in the air, headed for nextSide[nextSlotIndex].
      // Carrying the next destination lets the viz dual-highlight both
      // the just-filled slot (placed) and the next slot to inspect
      // (cursor) before the following "check" step lands.
      table: CuckooSnapshot;
      placedKey: number;
      evictedKey: number;
      side: CuckooSide;
      slotIndex: number;
      nextSide: CuckooSide;
      nextSlotIndex: number;
    })
  | (StepBase & {
      kind: "cycle";
      table: CuckooSnapshot;
      insertingKey: number;
    })
  | (StepBase & { kind: "done"; table: CuckooSnapshot });

export type CuckooSearchStep =
  | (StepBase & { kind: "begin"; table: CuckooSnapshot; targetKey: number })
  | (StepBase & {
      kind: "hash";
      table: CuckooSnapshot;
      targetKey: number;
      home1: number;
      home2: number;
    })
  | (StepBase & {
      kind: "check";
      table: CuckooSnapshot;
      targetKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "found";
      table: CuckooSnapshot;
      targetKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "miss";
      table: CuckooSnapshot;
      targetKey: number;
    })
  | (StepBase & { kind: "done"; table: CuckooSnapshot });

export type CuckooDeleteStep =
  | (StepBase & { kind: "begin"; table: CuckooSnapshot; targetKey: number })
  | (StepBase & {
      kind: "hash";
      table: CuckooSnapshot;
      targetKey: number;
      home1: number;
      home2: number;
    })
  | (StepBase & {
      kind: "check";
      table: CuckooSnapshot;
      targetKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "found";
      table: CuckooSnapshot;
      targetKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "remove";
      // Post-removal snapshot: the matched slot is now empty.
      table: CuckooSnapshot;
      targetKey: number;
      side: CuckooSide;
      slotIndex: number;
    })
  | (StepBase & {
      kind: "miss";
      table: CuckooSnapshot;
      targetKey: number;
    })
  | (StepBase & { kind: "done"; table: CuckooSnapshot });
