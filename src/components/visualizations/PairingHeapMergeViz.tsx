"use client";

import { useMemo } from "react";
import { buildPairingHeap, pairingHeapMergeSequence } from "@/lib/dataStructures/pairingHeap";
import { pairingHeapMergePython } from "@/lib/dataStructures/pairingHeapMerge.snippet";
import type { PairingHeapMergeStep, PairingHeapSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { PairingHeapView, type PairingHeapHighlight } from "./PairingHeapView";

// Concatenate two heap snapshots into one forest. Renumbers `b`'s ids by
// `a.nodes.length` so they don't collide.
function combineHeaps(
  a: PairingHeapSnapshot,
  b: PairingHeapSnapshot,
): { combined: PairingHeapSnapshot; aRootId: number | null; bRootId: number | null } {
  const offset = a.nodes.length;
  const bNodes = b.nodes.map((n) => ({
    id: n.id + offset,
    value: n.value,
    firstChildId: n.firstChildId === null ? null : n.firstChildId + offset,
    nextSiblingId: n.nextSiblingId === null ? null : n.nextSiblingId + offset,
  }));
  return {
    combined: {
      nodes: [...a.nodes, ...bNodes],
      roots: [...a.roots, ...b.roots.map((id) => id + offset)],
    },
    aRootId: a.roots[0] ?? null,
    bRootId: b.roots.length > 0 ? b.roots[0] + offset : null,
  };
}

// Two small pre-built heaps to merge. A: [3, 5, 7] → 3 is root, with
// 7 and 5 as children (newer becomes first-child during build).
// B: [2, 8] → 2 is root, 8 is its child. Merging A and B compares
// roots (2 < 3); A's tree becomes the first child of B. Final root: 2.
const HEAP_A = buildPairingHeap([3, 5, 7]);
const HEAP_B = buildPairingHeap([2, 8]);
const { combined: INITIAL, aRootId: A_ROOT, bRootId: B_ROOT } = combineHeaps(HEAP_A, HEAP_B);

export type PairingHeapMergeVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: PairingHeapMergeStep | undefined): PairingHeapHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "compare-roots":
      return [
        { nodeId: step.aRootId, kind: "cursor" },
        { nodeId: step.bRootId, kind: "cursor" },
      ];
    case "link":
      return [
        { nodeId: step.parentId, kind: "placed" },
        { nodeId: step.childId, kind: "placed" },
      ];
  }
}

function annotationFor(step: PairingHeapMergeStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return "Two heaps to merge";
    case "compare-roots": {
      const aValue = step.heap.nodes[step.aRootId].value;
      const bValue = step.heap.nodes[step.bRootId].value;
      const winner = aValue <= bValue ? "a" : "b";
      return `Compare roots: a = ${aValue}, b = ${bValue} → ${winner} becomes parent`;
    }
    case "link": {
      const parent = step.heap.nodes[step.parentId].value;
      const child = step.heap.nodes[step.childId].value;
      return `Link ${child} as first child of ${parent}`;
    }
    case "done":
      return "Done — one heap remains";
  }
}

export function PairingHeapMergeViz({ initialSpeedMs = 500 }: PairingHeapMergeVizProps) {
  const steps = useMemo<readonly PairingHeapMergeStep[]>(
    () => [...pairingHeapMergeSequence(INITIAL, A_ROOT, B_ROOT)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, { initialSpeed: initialSpeedMs, reducedMotion });

  const currentStep = playback.currentStep;
  const heap = currentStep?.heap ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  return (
    <section
      aria-label="Pairing-heap merge"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Merge heap (3, 5, 7) with heap (2, 8)
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <PairingHeapView heap={heap} highlights={highlights} className="w-full" />
        <CodePanel
          source={pairingHeapMergePython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Pairing-heap merge pseudocode"
        />
      </div>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation ?? "Idle — press play or step forward."}
      </p>

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
