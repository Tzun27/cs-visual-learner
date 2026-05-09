import { quickSortLines } from "./quickSort.snippet";
import type { SortStep } from "./types";

export function* quickSort(input: readonly number[]): Generator<SortStep, void, void> {
  const arr = [...input];
  if (arr.length > 1) {
    yield* sort(arr, 0, arr.length - 1);
  }
  yield { kind: "done", array: [...arr], codeLines: quickSortLines.done };
}

function* sort(arr: number[], lo: number, hi: number): Generator<SortStep, void, void> {
  if (lo >= hi) return;
  const range = [lo, hi] as const;
  yield { kind: "range", range, array: [...arr], codeLines: quickSortLines.range };

  const pivotIndex = yield* partition(arr, lo, hi);
  yield* sort(arr, lo, pivotIndex - 1);
  yield* sort(arr, pivotIndex + 1, hi);
}

function* partition(arr: number[], lo: number, hi: number): Generator<SortStep, number, void> {
  const range = [lo, hi] as const;
  const pivotValue = arr[hi];
  yield { kind: "pivot", index: hi, array: [...arr], range, codeLines: quickSortLines.pivot };

  let i = lo;
  for (let j = lo; j < hi; j++) {
    yield {
      kind: "compare",
      indices: [j, hi],
      array: [...arr],
      range,
      codeLines: quickSortLines.compare,
    };
    if (arr[j] <= pivotValue) {
      if (i !== j) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        yield {
          kind: "swap",
          indices: [i, j],
          array: [...arr],
          range,
          codeLines: quickSortLines.swapLoop,
        };
      }
      i++;
    }
  }

  if (i !== hi) {
    [arr[i], arr[hi]] = [arr[hi], arr[i]];
    yield {
      kind: "swap",
      indices: [i, hi],
      array: [...arr],
      range,
      codeLines: quickSortLines.swapPivot,
    };
  }
  return i;
}
