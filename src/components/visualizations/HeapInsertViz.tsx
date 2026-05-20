"use client";

import { useMemo, useState } from "react";
import { heapInsertSequence, heapToTree } from "@/lib/dataStructures/heap";
import { heapInsertPython } from "@/lib/dataStructures/heapInsert.snippet";
import type { HeapInsertStep, HeapSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

type SourceKind = "mixed" | "descending";

// Two contrasting sequences. "mixed" exercises a variety of bubble lengths;
// "descending" makes every insert become the new minimum, so every value
// bubbles all the way to the root — and yet the tree shape stays balanced,
// unlike the analogous BST case.
const SEQUENCES: Record<SourceKind, readonly number[]> = {
  mixed: [4, 9, 1, 7, 2, 8, 3],
  descending: [7, 6, 5, 4, 3, 2, 1],
};

const SOURCE_LABELS: Record<SourceKind, string> = {
  mixed: "Mixed order",
  descending: "New minimum each time",
};

const EMPTY_HEAP: HeapSnapshot = { heap: [], size: 0 };

export type HeapInsertVizProps = {
  initialSource?: SourceKind;
  initialSpeedMs?: number;
};

function highlightsFor(step: HeapInsertStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "append":
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

function annotationFor(step: HeapInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingValue}`;
    case "append":
      return `Appended ${step.insertingValue} at index ${step.cursorIndex}`;
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
    case "settle":
      return `Settled ${step.insertingValue} at index ${step.cursorIndex}`;
    case "done":
      return "Done";
  }
}

export function HeapInsertViz({
  initialSource = "mixed",
  initialSpeedMs = 350,
}: HeapInsertVizProps) {
  const [source, setSource] = useState<SourceKind>(initialSource);
  const sequence = SEQUENCES[source];

  const steps = useMemo<readonly HeapInsertStep[]>(
    () => [...heapInsertSequence([], sequence)],
    [sequence],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? EMPTY_HEAP;
  const tree = heapToTree(heap);
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const compares = countKind(visibleSteps, "compare-parent");
  const swaps = countKind(visibleSteps, "swap-up");
  const size = heap.size;

  const handleSourceChange = (next: SourceKind) => {
    if (next === source) return;
    setSource(next);
    playback.reset();
  };

  return (
    <section
      aria-label="Min-heap insert visualization"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div role="group" aria-label="Insert order" className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] tracking-wider text-zinc-500 uppercase">Insert order</span>
        {(Object.keys(SEQUENCES) as SourceKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => handleSourceChange(kind)}
            aria-pressed={source === kind}
            className={`rounded border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none ${
              source === kind
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            }`}
          >
            {SOURCE_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <TreeView tree={tree} highlights={highlights} className="w-full" />
        <CodePanel
          source={heapInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Min-heap insert pseudocode"
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
          <dt className="text-xs text-zinc-500">Heap size</dt>
          <dd className="font-mono text-lg">{size}</dd>
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
