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
