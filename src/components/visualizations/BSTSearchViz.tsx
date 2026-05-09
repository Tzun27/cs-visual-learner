"use client";

import { useMemo } from "react";
import { buildTree, searchSequence } from "@/lib/dataStructures/binarySearchTree";
import { bstSearchPython } from "@/lib/dataStructures/searchSequence.snippet";
import type { BstSearchStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

const BUILD_SEQUENCE = [50, 25, 75, 12, 38, 63, 88, 6, 19, 31, 56, 81] as const;
// Curated mix: 12 (left subtree hit), 56 (right subtree hit), 50 (root hit),
// 33 (lands between 31 and 38 — miss), 99 (off the right end — miss).
const SEARCH_TARGETS = [12, 56, 50, 33, 99] as const;

export type BSTSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: BstSearchStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "miss":
    case "done":
      return [];
    case "compare":
      return [{ nodeId: step.cursorId, kind: "cursor" }];
    case "found":
      return [{ nodeId: step.cursorId, kind: "placed" }];
  }
}

function annotationFor(step: BstSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetValue}`;
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
      return `Found ${step.targetValue}`;
    case "miss":
      return `${step.targetValue} not in tree`;
    case "done":
      return "Done";
  }
}

function countCompares(steps: readonly BstSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "compare") n++;
  return n;
}

function countFound(steps: readonly BstSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "found") n++;
  return n;
}

function countMisses(steps: readonly BstSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "miss") n++;
  return n;
}

export function BSTSearchViz({ initialSpeedMs = 350 }: BSTSearchVizProps) {
  const tree = useMemo(() => buildTree(BUILD_SEQUENCE), []);
  const steps = useMemo<readonly BstSearchStep[]>(
    () => [...searchSequence(tree, SEARCH_TARGETS)],
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
  const found = countFound(visibleSteps);
  const misses = countMisses(visibleSteps);

  return (
    <section
      aria-label="Binary search tree search"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Searching for {SEARCH_TARGETS.join(", ")}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <TreeView tree={displayTree} highlights={highlights} className="w-full" />
        <CodePanel
          source={bstSearchPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="BST search pseudocode"
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
          <dt className="text-xs text-zinc-500">Found</dt>
          <dd className="font-mono text-lg">{found}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Misses</dt>
          <dd className="font-mono text-lg">{misses}</dd>
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
