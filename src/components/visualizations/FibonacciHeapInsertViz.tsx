"use client";

import { useMemo } from "react";
import {
  emptyFibonacciHeap,
  fibonacciHeapInsertSequence,
} from "@/lib/dataStructures/fibonacciHeap";
import { fibonacciHeapInsertPython } from "@/lib/dataStructures/fibonacciHeapInsert.snippet";
import type { FibonacciHeapInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { FibonacciHeapView, type FibonacciHeapHighlight } from "./FibonacciHeapView";
import { VizSection } from "./VizSection";

// Curated values. [4, 9, 1, 7, 2] gives a five-tree root list where
// each tree is a singleton — perfect setup for the consolidate demo
// in the next viz section, since extract-min on the value 1 will see
// four degree-0 roots and consolidate them pairwise.
const INSERT_SEQUENCE = [4, 9, 1, 7, 2] as const;
const INITIAL = emptyFibonacciHeap;

export type FibonacciHeapInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: FibonacciHeapInsertStep | undefined): FibonacciHeapHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "add-root":
      return [{ nodeId: step.newNodeId, kind: "placed" }];
  }
}

function annotationFor(step: FibonacciHeapInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Insert ${step.insertingValue}`;
    case "add-root": {
      const minUpdate = step.updatedMin ? " (new minimum)" : "";
      return `Prepended to root list${minUpdate}`;
    }
    case "done":
      return `Done — ${step.heap.roots.length} singleton trees, no consolidation runs on insert`;
  }
}

export function FibonacciHeapInsertViz({ initialSpeedMs = 400 }: FibonacciHeapInsertVizProps) {
  const steps = useMemo<readonly FibonacciHeapInsertStep[]>(
    () => [...fibonacciHeapInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  return (
    <VizSection
      ariaLabel="Fibonacci heap insert"
      codePanelAriaLabel="Fibonacci heap insert pseudocode"
      caption={`Insert sequence: ${INSERT_SEQUENCE.join(", ")} — each insert is O(1), just a prepend`}
      steps={steps}
      source={fibonacciHeapInsertPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => {
        // Roots count == add-root count for the insert viz (every
        // visible add-root advances the root list by one).
        const added = countKind(visible, "add-root");
        return [
          { label: "Inserts", value: added },
          { label: "Roots", value: added },
        ];
      }}
      renderView={(currentStep) => (
        <FibonacciHeapView
          heap={currentStep?.heap ?? INITIAL}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
