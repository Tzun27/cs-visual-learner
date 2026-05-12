"use client";

import { useMemo } from "react";
import { pairingHeapDeleteMinSequence } from "@/lib/dataStructures/pairingHeap";
import { pairingHeapDeleteMinPython } from "@/lib/dataStructures/pairingHeapDeleteMin.snippet";
import type { PairingHeapDeleteMinStep, PairingHeapSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { PairingHeapView, type PairingHeapHighlight } from "./PairingHeapView";

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

function countPairLinks(steps: readonly PairingHeapDeleteMinStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "pair-link") n++;
  return n;
}

function countFoldLinks(steps: readonly PairingHeapDeleteMinStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "fold-link") n++;
  return n;
}

export function PairingHeapDeleteMinViz({ initialSpeedMs = 500 }: PairingHeapDeleteMinVizProps) {
  const steps = useMemo<readonly PairingHeapDeleteMinStep[]>(
    () => [...pairingHeapDeleteMinSequence(INITIAL)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, { initialSpeed: initialSpeedMs, reducedMotion });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const pairs = countPairLinks(visibleSteps);
  const folds = countFoldLinks(visibleSteps);

  return (
    <section
      aria-label="Pairing-heap delete-min"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Delete-min on a heap with four children of root
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <PairingHeapView heap={heap} highlights={highlights} className="w-full" />
        <CodePanel
          source={pairingHeapDeleteMinPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Pairing-heap delete-min pseudocode"
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
          <dt className="text-xs text-zinc-500">Pair-links (pass 1)</dt>
          <dd className="font-mono text-lg">{pairs}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Fold-links (pass 2)</dt>
          <dd className="font-mono text-lg">{folds}</dd>
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
