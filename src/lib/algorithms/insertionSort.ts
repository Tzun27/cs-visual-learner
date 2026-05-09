import { insertionSortLines } from "./insertionSort.snippet";
import type { SortStep } from "./types";

export function* insertionSort(input: readonly number[]): Generator<SortStep, void, void> {
  const arr = [...input];
  for (let i = 1; i < arr.length; i++) {
    let j = i;
    while (j > 0) {
      yield {
        kind: "compare",
        indices: [j - 1, j],
        array: [...arr],
        codeLines: insertionSortLines.compare,
      };
      if (arr[j - 1] > arr[j]) {
        [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]];
        yield {
          kind: "swap",
          indices: [j - 1, j],
          array: [...arr],
          codeLines: insertionSortLines.swap,
        };
        j--;
      } else {
        break;
      }
    }
  }
  yield { kind: "done", array: [...arr], codeLines: insertionSortLines.done };
}
