"use client";

import { useMemo } from "react";
import {
  emptyFibonacciHeap,
  fibonacciHeapInsertSequence,
} from "@/lib/dataStructures/fibonacciHeap";
import { fibonacciHeapInsertPython } from "@/lib/dataStructures/fibonacciHeapInsert.snippet";
import type { FibonacciHeapInsertStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { FibonacciHeapView, type FibonacciHeapHighlight } from "./FibonacciHeapView";

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
      // `placed` (yellow) for the new root; `cursor` (orange) for the
      // existing min if this insert just dethroned it — but the min
      // pointer's dashed ring already shows where the min lives, so
      // we only colour the newly-added root.
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

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, { initialSpeed: initialSpeedMs, reducedMotion });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const added = countKind(visibleSteps, "add-root");

  return (
    <section
      aria-label="Fibonacci heap insert"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Insert sequence: {INSERT_SEQUENCE.join(", ")} — each insert is O(1), just a prepend
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <FibonacciHeapView heap={heap} highlights={highlights} className="w-full" />
        <CodePanel
          source={fibonacciHeapInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Fibonacci heap insert pseudocode"
        />
      </div>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation ?? "Idle — press play or step forward."}
      </p>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Inserts</dt>
          <dd className="font-mono text-lg">{added}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Roots</dt>
          <dd className="font-mono text-lg">{heap.roots.length}</dd>
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
