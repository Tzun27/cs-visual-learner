"use client";

import { useMemo } from "react";
import { buildHeap, heapExtractMinSequence, heapToTree } from "@/lib/dataStructures/heap";
import { heapExtractMinPython } from "@/lib/dataStructures/heapExtractMin.snippet";
import type { HeapExtractStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

// Same source values as HeapInsertViz's "mixed" sequence so the user can
// recognize the starting shape from the section above.
const INITIAL_VALUES = [4, 9, 1, 7, 2, 8, 3] as const;
const EXTRACT_COUNT = 4;

export type HeapExtractMinVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HeapExtractStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
    case "empty":
      return [];
    case "take-root":
      // The current root is about to leave — flag it with the duplicate color
      // (pivot-red) so it reads as "this is being extracted."
      return [{ nodeId: 0, kind: "duplicate" }];
    case "move-last":
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

function annotationFor(step: HeapExtractStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return "Extracting minimum";
    case "empty":
      return "Heap is empty — nothing to extract";
    case "take-root":
      return `Take minimum ${step.extractedValue} from root`;
    case "move-last":
      return `Move last element to root (now ${step.heap.heap[0]})`;
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
      return "Done";
  }
}

export function HeapExtractMinViz({ initialSpeedMs = 400 }: HeapExtractMinVizProps) {
  const initial = useMemo(() => buildHeap(INITIAL_VALUES), []);
  const steps = useMemo<readonly HeapExtractStep[]>(
    () => [...heapExtractMinSequence(initial.heap, EXTRACT_COUNT)],
    [initial],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? initial;
  const tree = heapToTree(heap);
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const extracted = countKind(visibleSteps, "take-root");
  const compares = countKind(visibleSteps, "compare-children");
  const swaps = countKind(visibleSteps, "swap-down");

  const extractedValues = visibleSteps
    .filter((s): s is HeapExtractStep & { kind: "take-root" } => s.kind === "take-root")
    .map((s) => s.extractedValue);

  return (
    <section
      aria-label="Min-heap extract-min visualization"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <TreeView tree={tree} highlights={highlights} className="w-full" />
        <CodePanel
          source={heapExtractMinPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Min-heap extract-min pseudocode"
        />
      </div>

      <div
        role="group"
        aria-label="Extracted minimums"
        className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="text-[11px] tracking-wider text-zinc-500 uppercase">
          Extracted (in order)
        </div>
        {extractedValues.length === 0 ? (
          <p
            aria-live="polite"
            className="mt-2 flex min-h-[1.75rem] items-center font-mono text-sm text-zinc-500"
          >
            (none yet)
          </p>
        ) : (
          <ol
            aria-live="polite"
            className="mt-2 flex min-h-[1.75rem] flex-wrap gap-2 font-mono text-sm"
          >
            {extractedValues.map((v, i) => (
              <li
                key={`${i}-${v}`}
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-2 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {v}
              </li>
            ))}
          </ol>
        )}
      </div>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation ?? "Idle — press play or step forward."}
      </p>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Extracted</dt>
          <dd className="font-mono text-lg">{extracted}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Comparisons</dt>
          <dd className="font-mono text-lg">{compares}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Sift-down swaps</dt>
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
