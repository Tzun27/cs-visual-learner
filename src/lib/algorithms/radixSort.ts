import { radixSortLines } from "./radixSort.snippet";
import type { SortStep } from "./types";

export function* radixSort(input: readonly number[]): Generator<SortStep, void, void> {
  const arr = [...input];
  const n = arr.length;
  if (n > 1) {
    let minVal = arr[0];
    let maxVal = arr[0];
    for (const v of arr) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    // Radix is naturally defined on non-negative integers. We bias-shift internally
    // so the algorithm handles negatives, but step arrays carry the original values
    // unchanged so the visualization matches what the user sees.
    const offset = minVal < 0 ? -minVal : 0;
    const maxBiased = maxVal + offset;

    let exp = 1;
    while (Math.floor(maxBiased / exp) > 0) {
      yield {
        kind: "range",
        range: [0, n - 1],
        array: [...arr],
        codeLines: radixSortLines.range,
      };

      const buckets: number[][] = Array.from({ length: 10 }, () => []);
      for (const v of arr) {
        const digit = Math.floor((v + offset) / exp) % 10;
        buckets[digit].push(v);
      }

      let pos = 0;
      for (const bucket of buckets) {
        for (const v of bucket) {
          if (arr[pos] !== v) {
            arr[pos] = v;
            yield {
              kind: "write",
              index: pos,
              array: [...arr],
              codeLines: radixSortLines.write,
            };
          }
          pos++;
        }
      }

      exp *= 10;
    }
  }
  yield { kind: "done", array: [...arr], codeLines: radixSortLines.done };
}
