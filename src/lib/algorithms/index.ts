import { bubbleSort } from "./bubbleSort";
import { heapSort } from "./heapSort";
import { insertionSort } from "./insertionSort";
import { mergeSort } from "./mergeSort";
import { quickSort } from "./quickSort";
import type { SortAlgorithm } from "./types";

export const sortAlgorithms = {
  bubble: bubbleSort,
  heap: heapSort,
  insertion: insertionSort,
  merge: mergeSort,
  quick: quickSort,
} as const satisfies Record<string, SortAlgorithm>;

export type SortAlgorithmKey = keyof typeof sortAlgorithms;

export const sortAlgorithmKeys = Object.keys(sortAlgorithms) as readonly SortAlgorithmKey[];
