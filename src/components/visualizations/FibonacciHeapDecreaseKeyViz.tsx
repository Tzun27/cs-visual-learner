"use client";

import { useMemo } from "react";
import { fibonacciHeapDecreaseKeySequence } from "@/lib/dataStructures/fibonacciHeap";
import { fibonacciHeapDecreaseKeyPython } from "@/lib/dataStructures/fibonacciHeapDecreaseKey.snippet";
import type {
  FibonacciHeapDecreaseKeyStep,
  FibonacciHeapNode,
  FibonacciHeapSnapshot,
} from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { FibonacciHeapView, type FibonacciHeapHighlight } from "./FibonacciHeapView";

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

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, { initialSpeed: initialSpeedMs, reducedMotion });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const cuts = countKind(visibleSteps, "cut");
  const cascades = countKind(visibleSteps, "cascade-mark");

  return (
    <section
      aria-label="Fibonacci heap decrease-key"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Decrease deep node 4 → 0 — two marked ancestors trigger a 3-cut cascade
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <FibonacciHeapView heap={heap} highlights={highlights} className="w-full" />
        <CodePanel
          source={fibonacciHeapDecreaseKeyPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Fibonacci heap decrease-key pseudocode"
        />
      </div>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation ?? "Idle — press play or step forward."}
      </p>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Roots</dt>
          <dd className="font-mono text-lg">{heap.roots.length}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Cuts</dt>
          <dd className="font-mono text-lg">{cuts}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Cascade-marks</dt>
          <dd className="font-mono text-lg">{cascades}</dd>
        </div>
      </dl>

      <Controls
        status={playback.status}
        speed={playback.speed}
        reducedMotion={reducedMotion}
        canStepBack={playback.stepIndex > -1}
        canStepForward={playback.stepIndex < steps.length - 1}
        onPlay={playback.play}
        onPause={playback.pause}
        onStepBack={playback.stepBackward}
        onStepForward={playback.stepForward}
        onReset={playback.reset}
        onRunToCompletion={playback.runToCompletion}
        onSpeedChange={playback.setSpeed}
      />
    </section>
  );
}
