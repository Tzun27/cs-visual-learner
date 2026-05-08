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

export type BstStep =
  | { kind: "begin"; tree: BstSnapshot; insertingValue: number }
  | { kind: "compare"; tree: BstSnapshot; cursorId: number; insertingValue: number }
  | { kind: "place"; tree: BstSnapshot; newId: number; parentId: number | null }
  | { kind: "duplicate"; tree: BstSnapshot; cursorId: number; insertingValue: number }
  | { kind: "done"; tree: BstSnapshot };

export type BstSequenceOp = (values: readonly number[]) => Generator<BstStep, void, void>;

export type BstSearchStep =
  | { kind: "begin"; tree: BstSnapshot; targetValue: number }
  | { kind: "compare"; tree: BstSnapshot; cursorId: number; targetValue: number }
  | { kind: "found"; tree: BstSnapshot; cursorId: number; targetValue: number }
  | { kind: "miss"; tree: BstSnapshot; lastCursorId: number | null; targetValue: number }
  | { kind: "done"; tree: BstSnapshot };
