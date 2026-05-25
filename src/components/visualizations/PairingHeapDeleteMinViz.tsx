"use client";

import { useMemo } from "react";
import { pairingHeapDeleteMinSequence } from "@/lib/dataStructures/pairingHeap";
import { pairingHeapDeleteMinPython } from "@/lib/dataStructures/pairingHeapDeleteMin.snippet";
import type { PairingHeapDeleteMinStep, PairingHeapSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { PairingHeapView, type PairingHeapHighlight } from "./PairingHeapView";
import { VizSection } from "./VizSection";

// Build a heap from a sequence that yields a root with four children
// after the build settles — exercises both pair-link (two passes) and
// fold-link (one fold). Sequence picked so the orphaned children after
// remove-root are [5, 6, 7, 8] (left to right), pair-merges into
// [5, 6] → root 5, and [7, 8] → root 7, then folds 5+7 → root 5.
const INITIAL: PairingHeapSnapshot = (() => {
  // Manual snapshot for a clean demo. Root 1 with children 5, 7, 6, 8.
  // Tree:
  //        1
  //     / | | \
  //    5  7 6  8
  return {
    nodes: [
      { id: 0, value: 1, firstChildId: 1, nextSiblingId: null },
      { id: 1, value: 5, firstChildId: null, nextSiblingId: 2 },
      { id: 2, value: 7, firstChildId: null, nextSiblingId: 3 },
      { id: 3, value: 6, firstChildId: null, nextSiblingId: 4 },
      { id: 4, value: 8, firstChildId: null, nextSiblingId: null },
    ],
    roots: [0],
  };
})();

export type PairingHeapDeleteMinVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: PairingHeapDeleteMinStep | undefined): PairingHeapHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "remove-root":
      return [{ nodeId: step.removedId, kind: "removed" }];
    case "pair-start":
    case "fold-start":
      return [
        { nodeId: step.aRootId, kind: "cursor" },
        { nodeId: step.bRootId, kind: "cursor" },
        { nodeId: step.removedId, kind: "removed" },
      ];
    case "pair-link":
    case "fold-link":
      return [
        { nodeId: step.parentId, kind: "placed" },
        { nodeId: step.childId, kind: "placed" },
        { nodeId: step.removedId, kind: "removed" },
      ];
  }
}

function annotationFor(step: PairingHeapDeleteMinStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return "Delete the minimum";
    case "remove-root":
      return `Remove root (${step.removedValue}); ${step.heap.roots.length} children become new roots`;
    case "pair-start": {
      const a = step.heap.nodes[step.aRootId].value;
      const b = step.heap.nodes[step.bRootId].value;
      return `Pass 1: pair (${a}, ${b})`;
    }
    case "pair-link": {
      const parent = step.heap.nodes[step.parentId].value;
      const child = step.heap.nodes[step.childId].value;
      return `Linked ${child} under ${parent}`;
    }
    case "fold-start": {
      const a = step.heap.nodes[step.aRootId].value;
      const b = step.heap.nodes[step.bRootId].value;
      return `Pass 2: fold (${a}, ${b})`;
    }
    case "fold-link": {
      const parent = step.heap.nodes[step.parentId].value;
      const child = step.heap.nodes[step.childId].value;
      return `Linked ${child} under ${parent}`;
    }
    case "done":
      return "Done";
  }
}

export function PairingHeapDeleteMinViz({ initialSpeedMs = 500 }: PairingHeapDeleteMinVizProps) {
  const steps = useMemo<readonly PairingHeapDeleteMinStep[]>(
    () => [...pairingHeapDeleteMinSequence(INITIAL)],
    [],
  );

  return (
    <VizSection
      ariaLabel="Pairing-heap delete-min"
      codePanelAriaLabel="Pairing-heap delete-min pseudocode"
      caption="Delete-min on a heap with four children of root"
      steps={steps}
      source={pairingHeapDeleteMinPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Pair-links (pass 1)", value: countKind(visible, "pair-link") },
        { label: "Fold-links (pass 2)", value: countKind(visible, "fold-link") },
      ]}
      renderView={(currentStep) => (
        <PairingHeapView
          heap={currentStep?.heap ?? INITIAL}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
