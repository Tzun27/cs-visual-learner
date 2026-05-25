"use client";

import { useMemo } from "react";
import { heapifySequence, heapToTree } from "@/lib/dataStructures/heap";
import { heapifyPython } from "@/lib/dataStructures/heapify.snippet";
import type { HeapifyStep, HeapSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { TreeView, type TreeHighlight } from "./TreeView";
import { VizSection } from "./VizSection";

// 9-value input — n=9 means three internal nodes get sift-down passes
// (indices 3, 2, 1, 0 — that's four, since (9 // 2) - 1 = 3). The values
// are deliberately ordered so that the sift-downs at higher levels
// cascade rather than terminate immediately.
const INPUT_VALUES = [9, 4, 7, 1, 8, 3, 5, 2, 6] as const;

const INITIAL_HEAP: HeapSnapshot = {
  heap: [...INPUT_VALUES],
  size: INPUT_VALUES.length,
};

export type HeapifyVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HeapifyStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "start-sift":
      return [{ nodeId: step.cursorIndex, kind: "placed" }];
    case "compare-children": {
      const out: TreeHighlight[] = [{ nodeId: step.cursorIndex, kind: "cursor" }];
      out.push({ nodeId: step.leftIndex, kind: "cursor" });
      if (step.rightIndex !== null) out.push({ nodeId: step.rightIndex, kind: "cursor" });
      return out;
    }
    case "swap-down":
      return [
        { nodeId: step.cursorIndex, kind: "placed" },
        { nodeId: step.fromIndex, kind: "placed" },
      ];
    case "settle":
      return [{ nodeId: step.cursorIndex, kind: "placed" }];
  }
}

function annotationFor(step: HeapifyStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return "Beginning heapify (sift-down from the last internal node)";
    case "start-sift":
      return `Start sift-down at index ${step.cursorIndex} (value ${step.heap.heap[step.cursorIndex]})`;
    case "compare-children": {
      const cursorV = step.heap.heap[step.cursorIndex];
      const leftV = step.heap.heap[step.leftIndex];
      const rightV = step.rightIndex !== null ? step.heap.heap[step.rightIndex] : null;
      if (step.smallerIndex === step.cursorIndex) {
        return `${cursorV} ≤ children → settle`;
      }
      const smallerV = step.heap.heap[step.smallerIndex];
      const which = step.smallerIndex === step.leftIndex ? "left" : "right";
      return `Smallest of ${cursorV}/${leftV}${rightV !== null ? "/" + rightV : ""} is ${smallerV} (${which})`;
    }
    case "swap-down": {
      const moved = step.heap.heap[step.cursorIndex];
      return `Swap ${moved} down to index ${step.cursorIndex}`;
    }
    case "settle":
      return `Settled at index ${step.cursorIndex}`;
    case "done":
      return "Done — array is now a valid min-heap";
  }
}

export function HeapifyViz({ initialSpeedMs = 350 }: HeapifyVizProps) {
  const steps = useMemo<readonly HeapifyStep[]>(() => [...heapifySequence(INPUT_VALUES)], []);

  return (
    <VizSection
      ariaLabel="Min-heap heapify visualization"
      codePanelAriaLabel="Min-heap heapify pseudocode"
      steps={steps}
      source={heapifyPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Sift-down passes", value: countKind(visible, "start-sift") },
        { label: "Comparisons", value: countKind(visible, "compare-children") },
        { label: "Swaps", value: countKind(visible, "swap-down") },
      ]}
      renderView={(currentStep) => (
        <TreeView
          tree={heapToTree(currentStep?.heap ?? INITIAL_HEAP)}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
