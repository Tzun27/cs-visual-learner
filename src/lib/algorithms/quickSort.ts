import type { SortStep } from "./types";

export function* quickSort(input: readonly number[]): Generator<SortStep, void, void> {
  const arr = [...input];
  if (arr.length > 1) {
    yield* sort(arr, 0, arr.length - 1);
  }
  yield { kind: "done", array: [...arr] };
}

function* sort(arr: number[], lo: number, hi: number): Generator<SortStep, void, void> {
  if (lo >= hi) return;
  const range = [lo, hi] as const;
  yield { kind: "range", range, array: [...arr] };

  const pivotIndex = yield* partition(arr, lo, hi);
  yield* sort(arr, lo, pivotIndex - 1);
  yield* sort(arr, pivotIndex + 1, hi);
}

function* partition(arr: number[], lo: number, hi: number): Generator<SortStep, number, void> {
  const range = [lo, hi] as const;
  const pivotValue = arr[hi];
  yield { kind: "pivot", index: hi, array: [...arr], range };

  let i = lo;
  for (let j = lo; j < hi; j++) {
    yield { kind: "compare", indices: [j, hi], array: [...arr], range };
    if (arr[j] <= pivotValue) {
      if (i !== j) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        yield { kind: "swap", indices: [i, j], array: [...arr], range };
      }
      i++;
    }
  }

  if (i !== hi) {
    [arr[i], arr[hi]] = [arr[hi], arr[i]];
    yield { kind: "swap", indices: [i, hi], array: [...arr], range };
  }
  return i;
}
