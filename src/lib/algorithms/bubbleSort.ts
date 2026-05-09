import { bubbleSortLines } from "./bubbleSort.snippet";
import type { SortStep } from "./types";

export function* bubbleSort(input: readonly number[]): Generator<SortStep, void, void> {
  const arr = [...input];
  for (let i = 0; i < arr.length - 1; i++) {
    for (let j = 0; j < arr.length - 1 - i; j++) {
      yield {
        kind: "compare",
        indices: [j, j + 1],
        array: [...arr],
        codeLines: bubbleSortLines.compare,
      };
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        yield {
          kind: "swap",
          indices: [j, j + 1],
          array: [...arr],
          codeLines: bubbleSortLines.swap,
        };
      }
    }
  }
  yield { kind: "done", array: [...arr], codeLines: bubbleSortLines.done };
}
