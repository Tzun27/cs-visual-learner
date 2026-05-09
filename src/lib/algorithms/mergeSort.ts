import type { SortStep } from "./types";
import { mergeSortLines } from "./mergeSort.snippet";

export function* mergeSort(input: readonly number[]): Generator<SortStep, void, void> {
  const arr = [...input];
  if (arr.length > 1) {
    yield* sort(arr, 0, arr.length - 1);
  }
  yield { kind: "done", array: [...arr], codeLines: mergeSortLines.done };
}

function* sort(arr: number[], lo: number, hi: number): Generator<SortStep, void, void> {
  if (lo >= hi) return;
  const mid = (lo + hi) >> 1;
  yield* sort(arr, lo, mid);
  yield* sort(arr, mid + 1, hi);
  yield* merge(arr, lo, mid, hi);
}

function* merge(
  arr: number[],
  lo: number,
  mid: number,
  hi: number,
): Generator<SortStep, void, void> {
  const range = [lo, hi] as const;
  yield { kind: "range", range, array: [...arr], codeLines: mergeSortLines.mergeEntry };

  const aux = arr.slice(lo, hi + 1);
  let i = 0;
  let j = mid + 1 - lo;
  let k = lo;

  while (i <= mid - lo && j <= hi - lo) {
    yield {
      kind: "compare",
      indices: [lo + i, lo + j],
      array: [...arr],
      range,
      codeLines: mergeSortLines.compare,
    };
    const tookI = aux[i] <= aux[j];
    if (tookI) {
      arr[k] = aux[i];
      i++;
    } else {
      arr[k] = aux[j];
      j++;
    }
    yield {
      kind: "write",
      index: k,
      array: [...arr],
      range,
      codeLines: tookI ? mergeSortLines.writeI : mergeSortLines.writeJ,
    };
    k++;
  }

  while (i <= mid - lo) {
    arr[k] = aux[i];
    yield {
      kind: "write",
      index: k,
      array: [...arr],
      range,
      codeLines: mergeSortLines.drainI,
    };
    i++;
    k++;
  }

  while (j <= hi - lo) {
    arr[k] = aux[j];
    yield {
      kind: "write",
      index: k,
      array: [...arr],
      range,
      codeLines: mergeSortLines.drainJ,
    };
    j++;
    k++;
  }
}
