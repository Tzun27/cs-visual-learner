"use client";

import { useMemo } from "react";
import { buildHeap, heapDecreaseKeySequence, heapToTree } from "@/lib/dataStructures/heap";
import { heapDecreaseKeyPython } from "@/lib/dataStructures/heapDecreaseKey.snippet";
import type { HeapDecreaseKeyStep, HeapSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

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

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? initialHeap;
  const tree = heapToTree(heap);
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const compares = countKind(visibleSteps, "compare-parent");
  const swaps = countKind(visibleSteps, "swap-up");
  const ops = countKind(visibleSteps, "begin");

  return (
    <section
      aria-label="Min-heap decrease-key visualization"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        decrease_key(6, 2) then decrease_key(4, 10) on the demo heap
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <TreeView tree={tree} highlights={highlights} className="w-full" />
        <CodePanel
          source={heapDecreaseKeyPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Min-heap decrease-key pseudocode"
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
          <dt className="text-xs text-zinc-500">Comparisons</dt>
          <dd className="font-mono text-lg">{compares}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Swaps</dt>
          <dd className="font-mono text-lg">{swaps}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Operations</dt>
          <dd className="font-mono text-lg">{ops}</dd>
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
        onSpeedChange={playback.setSpeed}
      />
    </section>
  );
}
