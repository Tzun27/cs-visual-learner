export type Range = readonly [number, number];

type StepBase = { readonly codeLines?: readonly number[] };

export type SortStep =
  | (StepBase & {
      kind: "compare";
      indices: readonly [number, number];
      array: readonly number[];
      range?: Range;
    })
  | (StepBase & {
      kind: "swap";
      indices: readonly [number, number];
      array: readonly number[];
      range?: Range;
    })
  | (StepBase & { kind: "write"; index: number; array: readonly number[]; range?: Range })
  | (StepBase & { kind: "range"; range: Range; array: readonly number[] })
  | (StepBase & { kind: "pivot"; index: number; array: readonly number[]; range?: Range })
  | (StepBase & { kind: "done"; array: readonly number[] });

export type SortAlgorithm = (input: readonly number[]) => Generator<SortStep, void, void>;
