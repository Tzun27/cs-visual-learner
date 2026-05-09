import { bubbleSort } from "./bubbleSort";
import { bubbleSortPython } from "./bubbleSort.snippet";
import { heapSort } from "./heapSort";
import { insertionSort } from "./insertionSort";
import { insertionSortPython } from "./insertionSort.snippet";
import { mergeSort } from "./mergeSort";
import { mergeSortPython } from "./mergeSort.snippet";
import { quickSort } from "./quickSort";
import { quickSortPython } from "./quickSort.snippet";
import { radixSort } from "./radixSort";
import type { SortAlgorithm } from "./types";

export const sortAlgorithms = {
  bubble: bubbleSort,
  heap: heapSort,
  insertion: insertionSort,
  merge: mergeSort,
  quick: quickSort,
  radix: radixSort,
} as const satisfies Record<string, SortAlgorithm>;

export type SortAlgorithmKey = keyof typeof sortAlgorithms;

export const sortAlgorithmKeys = Object.keys(sortAlgorithms) as readonly SortAlgorithmKey[];

export const sortAlgorithmLabels: Record<SortAlgorithmKey, string> = {
  bubble: "Bubble Sort",
  heap: "Heap Sort",
  insertion: "Insertion Sort",
  merge: "Merge Sort",
  quick: "Quick Sort",
  radix: "Radix Sort",
};

export const sortAlgorithmSnippets: Partial<Record<SortAlgorithmKey, string>> = {
  bubble: bubbleSortPython,
  insertion: insertionSortPython,
  merge: mergeSortPython,
  quick: quickSortPython,
};
