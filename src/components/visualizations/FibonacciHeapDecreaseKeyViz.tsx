"use client";

import { useMemo } from "react";
import { fibonacciHeapDecreaseKeySequence } from "@/lib/dataStructures/fibonacciHeap";
import { fibonacciHeapDecreaseKeyPython } from "@/lib/dataStructures/fibonacciHeapDecreaseKey.snippet";
import type {
  FibonacciHeapDecreaseKeyStep,
  FibonacciHeapNode,
  FibonacciHeapSnapshot,
} from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { FibonacciHeapView, type FibonacciHeapHighlight } from "./FibonacciHeapView";
import { VizSection } from "./VizSection";

// Hand-built cascade demo. Tree shape (* = marked):
//        1
//       / \
//      2*  8
//      |
//      3*
//      |
//      4
// The 2* and 3* marks would have come from earlier decrease-key
// operations that cut their siblings; we plant them directly so the
// cascading-cut moment is the lesson's entire focus.
const INITIAL: FibonacciHeapSnapshot = (() => {
  const nodes: FibonacciHeapNode[] = [
    {
      id: 0,
      value: 1,
      parentId: null,
      firstChildId: 1,
      nextSiblingId: null,
      degree: 2,
      mark: false,
    },
    { id: 1, value: 2, parentId: 0, firstChildId: 2, nextSiblingId: 4, degree: 1, mark: true },
    { id: 2, value: 3, parentId: 1, firstChildId: 3, nextSiblingId: null, degree: 1, mark: true },
    {
      id: 3,
      value: 4,
      parentId: 2,
      firstChildId: null,
      nextSiblingId: null,
      degree: 0,
      mark: false,
    },
    {
      id: 4,
      value: 8,
      parentId: 0,
      firstChildId: null,
      nextSiblingId: null,
      degree: 0,
      mark: false,
    },
  ];
  return { nodes, roots: [0], minId: 0 };
})();

// Decrease node 3 (value 4) to 0. Triggers a 3-step cascading cut:
//   1) cut(node 3, parent 2) — parent 2 was MARKED → cascade
//   2) cut(node 2, parent 1) — parent 1 was MARKED → cascade
//   3) cut(node 1, parent 0) — parent 0 is a root → stop
// Then update-min sets the new min to node 3 (value 0).
const TARGET_NODE_ID = 3;
const NEW_VALUE = 0;

export type FibonacciHeapDecreaseKeyVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: FibonacciHeapDecreaseKeyStep | undefined): FibonacciHeapHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "set-value":
      return [{ nodeId: step.nodeId, kind: "cursor" }];
    case "check-parent":
      return [
        { nodeId: step.nodeId, kind: "cursor" },
        { nodeId: step.parentId, kind: "duplicate" },
      ];
    case "no-violation":
      return [{ nodeId: step.nodeId, kind: "placed" }];
    case "cut":
      return [
        { nodeId: step.nodeId, kind: "placed" },
        { nodeId: step.parentId, kind: "duplicate" },
      ];
    case "cascade-mark":
      return [{ nodeId: step.parentId, kind: "duplicate" }];
    case "update-min":
      return [{ nodeId: step.newMinId, kind: "placed" }];
  }
}

function annotationFor(step: FibonacciHeapDecreaseKeyStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Decrease key: node value ${step.oldValue} → ${step.newValue}`;
    case "set-value":
      return `Updated value to ${step.newValue}`;
    case "check-parent": {
      const child = step.heap.nodes[step.nodeId].value;
      const parent = step.heap.nodes[step.parentId].value;
      return `Compare child ${child} with parent ${parent} — ${child < parent ? "violation" : "no violation"}`;
    }
    case "no-violation":
      return "No min-heap violation — done";
    case "cut": {
      const cutNodeValue = step.heap.nodes[step.nodeId].value;
      const parentValue = step.heap.nodes[step.parentId].value;
      const cascade = step.parentWasMarked
        ? " — parent was MARKED, cascade up"
        : " — parent was unmarked";
      return `Cut ${cutNodeValue} from ${parentValue}${cascade}`;
    }
    case "cascade-mark": {
      const parentValue = step.heap.nodes[step.parentId].value;
      return `Mark ${parentValue} (was unmarked — cascade stops here)`;
    }
    case "update-min": {
      const newMinValue = step.heap.nodes[step.newMinId].value;
      return `New minimum: ${newMinValue}`;
    }
    case "done":
      return "Done";
  }
}

export function FibonacciHeapDecreaseKeyViz({
  initialSpeedMs = 600,
}: FibonacciHeapDecreaseKeyVizProps) {
  const steps = useMemo<readonly FibonacciHeapDecreaseKeyStep[]>(
    () => [...fibonacciHeapDecreaseKeySequence(INITIAL, TARGET_NODE_ID, NEW_VALUE)],
    [],
  );

  return (
    <VizSection
      ariaLabel="Fibonacci heap decrease-key"
      codePanelAriaLabel="Fibonacci heap decrease-key pseudocode"
      caption="Decrease deep node 4 → 0 — two marked ancestors trigger a 3-cut cascade"
      steps={steps}
      source={fibonacciHeapDecreaseKeyPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => {
        const lastVisible = visible.at(-1);
        const rootCount = lastVisible?.heap.roots.length ?? INITIAL.roots.length;
        return [
          { label: "Roots", value: rootCount },
          { label: "Cuts", value: countKind(visible, "cut") },
          { label: "Cascade-marks", value: countKind(visible, "cascade-mark") },
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
