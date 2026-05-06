export type SortStep =
  | { kind: "compare"; indices: readonly [number, number]; array: readonly number[] }
  | { kind: "swap"; indices: readonly [number, number]; array: readonly number[] }
  | { kind: "done"; array: readonly number[] };

export type SortAlgorithm = (input: readonly number[]) => Generator<SortStep, void, void>;
