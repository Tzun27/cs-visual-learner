export type Range = readonly [number, number];

export type SortStep =
  | {
      kind: "compare";
      indices: readonly [number, number];
      array: readonly number[];
      range?: Range;
    }
  | {
      kind: "swap";
      indices: readonly [number, number];
      array: readonly number[];
      range?: Range;
    }
  | { kind: "write"; index: number; array: readonly number[]; range?: Range }
  | { kind: "range"; range: Range; array: readonly number[] }
  | { kind: "done"; array: readonly number[] };

export type SortAlgorithm = (input: readonly number[]) => Generator<SortStep, void, void>;
