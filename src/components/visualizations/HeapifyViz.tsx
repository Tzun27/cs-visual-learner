"use client";

import { useMemo } from "react";
import { heapifySequence, heapToTree } from "@/lib/dataStructures/heap";
import { heapifyPython } from "@/lib/dataStructures/heapify.snippet";
import type { HeapifyStep, HeapSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

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

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? INITIAL_HEAP;
  const tree = heapToTree(heap);
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const passes = countKind(visibleSteps, "start-sift");
  const compares = countKind(visibleSteps, "compare-children");
  const swaps = countKind(visibleSteps, "swap-down");

  return (
    <section
      aria-label="Min-heap heapify visualization"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <TreeView tree={tree} highlights={highlights} className="w-full" />
        <CodePanel
          source={heapifyPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Min-heap heapify pseudocode"
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
          <dt className="text-xs text-zinc-500">Sift-down passes</dt>
          <dd className="font-mono text-lg">{passes}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Comparisons</dt>
          <dd className="font-mono text-lg">{compares}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Swaps</dt>
          <dd className="font-mono text-lg">{swaps}</dd>
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
