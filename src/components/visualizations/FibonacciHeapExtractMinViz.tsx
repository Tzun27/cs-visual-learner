"use client";

import { useMemo } from "react";
import {
  buildFibonacciHeap,
  fibonacciHeapExtractMinSequence,
} from "@/lib/dataStructures/fibonacciHeap";
import { fibonacciHeapExtractMinPython } from "@/lib/dataStructures/fibonacciHeapExtractMin.snippet";
import type {
  FibonacciHeapExtractMinStep,
  FibonacciHeapSnapshot,
} from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { FibonacciHeapView, type FibonacciHeapHighlight } from "./FibonacciHeapView";

// Initial heap = result of inserting [4, 9, 1, 7, 2]. The extract
// removes the value 1, leaving four degree-0 roots [9, 4, 7, 2] (in
// some order; insert prepended each so the order is [2, 7, 9, 4]).
// Consolidate pairs (2, 7) → 2 with child 7 (degree 1), (4, 9) → 4
// with child 9 (degree 1), then pairs the two degree-1 trees → 2 with
// children {4 (with child 9), 7} (degree 2). Final: single tree of
// degree 2 rooted at value 2.
const INITIAL: FibonacciHeapSnapshot = buildFibonacciHeap([4, 9, 1, 7, 2]);

export type FibonacciHeapExtractMinVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: FibonacciHeapExtractMinStep | undefined): FibonacciHeapHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "consolidate-start":
    case "update-min":
    case "empty":
    case "done":
      return [];
    case "remove-min":
      return [{ nodeId: step.removedId, kind: "removed" }];
    case "consolidate-inspect":
      return [{ nodeId: step.rootId, kind: "cursor" }];
    case "consolidate-pair":
      return [
        { nodeId: step.aRootId, kind: "cursor" },
        { nodeId: step.bRootId, kind: "cursor" },
      ];
    case "consolidate-link":
      return [
        { nodeId: step.parentId, kind: "placed" },
        { nodeId: step.childId, kind: "placed" },
      ];
  }
}

function annotationFor(step: FibonacciHeapExtractMinStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return "Extract the minimum";
    case "empty":
      return "Heap is empty — nothing to extract";
    case "remove-min": {
      const childCount = step.promotedChildren.length;
      const promoted =
        childCount === 0
          ? "no children to promote"
          : `${childCount} ${childCount === 1 ? "child" : "children"} promoted to root list`;
      return `Removed root (${step.removedValue}); ${promoted}`;
    }
    case "consolidate-start":
      return `Consolidate: pair any two roots that share a degree`;
    case "consolidate-inspect": {
      const value = step.heap.nodes[step.rootId].value;
      return `Inspect root ${value} (degree ${step.degree})`;
    }
    case "consolidate-pair": {
      const a = step.heap.nodes[step.aRootId].value;
      const b = step.heap.nodes[step.bRootId].value;
      return `Pair roots ${a} and ${b} (both degree ${step.degree}) — smaller becomes parent`;
    }
    case "consolidate-link": {
      const parent = step.heap.nodes[step.parentId].value;
      const child = step.heap.nodes[step.childId].value;
      return `Linked ${child} under ${parent} → degree ${step.newDegree}`;
    }
    case "update-min": {
      if (step.newMinId === null) return "Heap is empty — no minimum";
      const value = step.heap.nodes[step.newMinId].value;
      return `New minimum: root ${value}`;
    }
    case "done":
      return "Done";
  }
}

export function FibonacciHeapExtractMinViz({
  initialSpeedMs = 600,
}: FibonacciHeapExtractMinVizProps) {
  const steps = useMemo<readonly FibonacciHeapExtractMinStep[]>(
    () => [...fibonacciHeapExtractMinSequence(INITIAL)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, { initialSpeed: initialSpeedMs, reducedMotion });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const pairs = countKind(visibleSteps, "consolidate-pair");
  const links = countKind(visibleSteps, "consolidate-link");

  return (
    <section
      aria-label="Fibonacci heap extract-min"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Extract min on the 5-singleton heap — consolidate pairs 3 times into one degree-2 tree
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <FibonacciHeapView heap={heap} highlights={highlights} className="w-full" />
        <CodePanel
          source={fibonacciHeapExtractMinPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Fibonacci heap extract-min pseudocode"
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
          <dt className="text-xs text-zinc-500">Pairs found</dt>
          <dd className="font-mono text-lg">{pairs}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Links</dt>
          <dd className="font-mono text-lg">{links}</dd>
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
