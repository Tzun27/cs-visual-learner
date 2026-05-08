"use client";

import { useMemo } from "react";
import { buildTree, deleteSequence } from "@/lib/dataStructures/binarySearchTree";
import type { BstDeleteStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

const BUILD_SEQUENCE = [50, 25, 75, 12, 38, 63, 88, 6, 19, 31, 56, 81] as const;
// Curated to demonstrate all three textbook cases in order:
//   6  → leaf delete
//   38 → one-child delete (38 has only a left child, 31)
//   50 → two-children delete (successor walk: 75 → 63 → 56)
const DELETE_TARGETS = [6, 38, 50] as const;

export type BSTDeleteVizProps = {
  initialSpeedMs?: number;
};

const CASE_LABEL = {
  leaf: "leaf",
  "one-child": "one child",
  "two-children": "two children",
} as const;

function highlightsFor(step: BstDeleteStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "miss":
    case "unlink":
    case "done":
      return [];
    case "compare":
      return [{ nodeId: step.cursorId, kind: "cursor" }];
    case "found":
      return [{ nodeId: step.cursorId, kind: "duplicate" }];
    case "find-successor":
      return [
        { nodeId: step.targetCursorId, kind: "duplicate" },
        { nodeId: step.cursorId, kind: "cursor" },
      ];
    case "swap-value":
      return [
        { nodeId: step.targetCursorId, kind: "placed" },
        { nodeId: step.successorId, kind: "duplicate" },
      ];
  }
}

function annotationFor(step: BstDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Deleting ${step.targetValue}`;
    case "compare": {
      const node = step.tree.nodes[step.cursorId];
      const direction =
        step.targetValue < node.value
          ? "go left"
          : step.targetValue > node.value
            ? "go right"
            : "match";
      return `Compare ${step.targetValue} vs ${node.value} → ${direction}`;
    }
    case "found":
      return `Found ${step.targetValue} — ${CASE_LABEL[step.deleteCase]} case`;
    case "find-successor": {
      const node = step.tree.nodes[step.cursorId];
      return `Walking to inorder successor — at ${node.value}`;
    }
    case "swap-value":
      return `Copy successor ${step.newValue} into target slot`;
    case "unlink":
      return `Removed ${step.removedValue} (${CASE_LABEL[step.deleteCase]})`;
    case "miss":
      return `${step.targetValue} not in tree`;
    case "done":
      return "Done";
  }
}

function countCompares(steps: readonly BstDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "compare") n++;
  return n;
}

function countSuccessorWalks(steps: readonly BstDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "find-successor") n++;
  return n;
}

function countRemoved(steps: readonly BstDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "unlink") n++;
  return n;
}

export function BSTDeleteViz({ initialSpeedMs = 450 }: BSTDeleteVizProps) {
  const tree = useMemo(() => buildTree(BUILD_SEQUENCE), []);
  const steps = useMemo<readonly BstDeleteStep[]>(
    () => [...deleteSequence(tree, DELETE_TARGETS)],
    [tree],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const displayTree = currentStep?.tree ?? tree;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const compares = countCompares(visibleSteps);
  const successorWalks = countSuccessorWalks(visibleSteps);
  const removed = countRemoved(visibleSteps);

  return (
    <section
      aria-label="Binary search tree delete"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Deleting {DELETE_TARGETS.join(", ")} from a balanced tree
      </p>

      <TreeView tree={displayTree} highlights={highlights} className="w-full" />

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
          <dt className="text-xs text-zinc-500">Successor walks</dt>
          <dd className="font-mono text-lg">{successorWalks}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Removed</dt>
          <dd className="font-mono text-lg">{removed}</dd>
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
