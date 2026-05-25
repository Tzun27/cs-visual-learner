"use client";

import { useMemo } from "react";
import { buildHeap, heapDecreaseKeySequence, heapToTree } from "@/lib/dataStructures/heap";
import { heapDecreaseKeyPython } from "@/lib/dataStructures/heapDecreaseKey.snippet";
import type { HeapDecreaseKeyStep, HeapSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { TreeView, type TreeHighlight } from "./TreeView";
import { VizSection } from "./VizSection";

// Curated demo heap built from values inserted in order — produces a
// valid min-heap with exactly the layout:
//         4
//       /   \
//      9     7
//     / \   / \
//    13 11 8  12
// Indices 0..6. We then run two decrease-key operations against this
// heap to exercise two branches of the algorithm:
//   1. decrease(index=6, new=2): 12 → 2 bubbles up two levels to the
//      root via two swap-ups. The user sees a clear two-step climb.
//   2. decrease(index=4, new=10): 11 → 10 stays put — its parent (9)
//      is already smaller, so the algorithm settles after a single
//      compare with no swap. Shows the "nothing to do" branch.
const DEMO_VALUES = [4, 9, 7, 13, 11, 8, 12] as const;
const DECREASE_OPS = [
  { index: 6, newValue: 2 },
  { index: 4, newValue: 10 },
] as const;

export type HeapDecreaseKeyVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HeapDecreaseKeyStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "set":
      return [{ nodeId: step.cursorIndex, kind: "placed" }];
    case "compare-parent":
      return [
        { nodeId: step.cursorIndex, kind: "cursor" },
        { nodeId: step.parentIndex, kind: "cursor" },
      ];
    case "swap-up":
      return [
        { nodeId: step.cursorIndex, kind: "placed" },
        { nodeId: step.fromIndex, kind: "placed" },
      ];
    case "settle":
      return [{ nodeId: step.cursorIndex, kind: "placed" }];
  }
}

function annotationFor(step: HeapDecreaseKeyStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Decrease key at index ${step.index} from ${step.oldValue} to ${step.newValue}`;
    case "set":
      return `Set heap[${step.cursorIndex}] = ${step.newValue}`;
    case "compare-parent": {
      const child = step.heap.heap[step.cursorIndex];
      const parent = step.heap.heap[step.parentIndex];
      const direction = child < parent ? "swap up" : "stop";
      return `Compare ${child} vs parent ${parent} → ${direction}`;
    }
    case "swap-up": {
      const moved = step.heap.heap[step.cursorIndex];
      return `Swap ${moved} up to index ${step.cursorIndex}`;
    }
    case "settle": {
      const moved = step.heap.heap[step.cursorIndex];
      return `Settled ${moved} at index ${step.cursorIndex}`;
    }
    case "done":
      return "Done";
  }
}

export function HeapDecreaseKeyViz({ initialSpeedMs = 450 }: HeapDecreaseKeyVizProps) {
  const initialHeap = useMemo<HeapSnapshot>(() => buildHeap(DEMO_VALUES), []);
  const steps = useMemo<readonly HeapDecreaseKeyStep[]>(
    () => [...heapDecreaseKeySequence(initialHeap.heap, DECREASE_OPS)],
    [initialHeap],
  );

  return (
    <VizSection
      ariaLabel="Min-heap decrease-key visualization"
      codePanelAriaLabel="Min-heap decrease-key pseudocode"
      caption="decrease_key(6, 2) then decrease_key(4, 10) on the demo heap"
      steps={steps}
      source={heapDecreaseKeyPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Comparisons", value: countKind(visible, "compare-parent") },
        { label: "Swaps", value: countKind(visible, "swap-up") },
        { label: "Operations", value: countKind(visible, "begin") },
      ]}
      renderView={(currentStep) => (
        <TreeView
          tree={heapToTree(currentStep?.heap ?? initialHeap)}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
