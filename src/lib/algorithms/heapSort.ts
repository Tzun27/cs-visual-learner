import { heapSortLines } from "./heapSort.snippet";
import type { SortStep } from "./types";

export function* heapSort(input: readonly number[]): Generator<SortStep, void, void> {
  const arr = [...input];
  const n = arr.length;
  if (n > 1) {
    yield {
      kind: "range",
      range: [0, n - 1],
      array: [...arr],
      codeLines: heapSortLines.buildRange,
    };
    for (let i = (n >> 1) - 1; i >= 0; i--) {
      yield* siftDown(arr, i, n - 1);
    }
    for (let end = n - 1; end > 0; end--) {
      [arr[0], arr[end]] = [arr[end], arr[0]];
      yield {
        kind: "swap",
        indices: [0, end],
        array: [...arr],
        range: [0, end - 1],
        codeLines: heapSortLines.extractSwap,
      };
      if (end - 1 > 0) {
        yield {
          kind: "range",
          range: [0, end - 1],
          array: [...arr],
          codeLines: heapSortLines.extractRange,
        };
        yield* siftDown(arr, 0, end - 1);
      }
    }
  }
  yield { kind: "done", array: [...arr], codeLines: heapSortLines.done };
}

function* siftDown(arr: number[], start: number, end: number): Generator<SortStep, void, void> {
  const range = [0, end] as const;
  let root = start;
  while (root * 2 + 1 <= end) {
    const left = root * 2 + 1;
    const right = root * 2 + 2;
    let larger = root;
    yield {
      kind: "compare",
      indices: [larger, left],
      array: [...arr],
      range,
      codeLines: heapSortLines.compareLeft,
    };
    if (arr[left] > arr[larger]) larger = left;
    if (right <= end) {
      yield {
        kind: "compare",
        indices: [larger, right],
        array: [...arr],
        range,
        codeLines: heapSortLines.compareRight,
      };
      if (arr[right] > arr[larger]) larger = right;
    }
    if (larger === root) break;
    [arr[root], arr[larger]] = [arr[larger], arr[root]];
    yield {
      kind: "swap",
      indices: [root, larger],
      array: [...arr],
      range,
      codeLines: heapSortLines.siftSwap,
    };
    root = larger;
  }
}
