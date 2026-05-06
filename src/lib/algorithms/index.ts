import { bubbleSort } from "./bubbleSort";
import { mergeSort } from "./mergeSort";
import type { SortAlgorithm } from "./types";

export const sortAlgorithms = {
  bubble: bubbleSort,
  merge: mergeSort,
} as const satisfies Record<string, SortAlgorithm>;

export type SortAlgorithmKey = keyof typeof sortAlgorithms;

export const sortAlgorithmKeys = Object.keys(sortAlgorithms) as readonly SortAlgorithmKey[];
