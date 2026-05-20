"use client";

import { useMemo, useState } from "react";
import { insertSequence, maxDepth } from "@/lib/dataStructures/binarySearchTree";
import { bstInsertPython } from "@/lib/dataStructures/insertSequence.snippet";
import type { BstSnapshot, BstStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

type SourceKind = "balanced" | "sorted";

const SEQUENCES: Record<SourceKind, readonly number[]> = {
  // Median-first ordering produces a near-balanced tree of depth log₂(n).
  balanced: [50, 25, 75, 12, 38, 63, 88, 6, 19, 31, 56, 81],
  // Ascending insertion degenerates into a right-only chain.
  sorted: [6, 12, 19, 25, 31, 38, 50, 56, 63, 75, 81, 88],
};

const SOURCE_LABELS: Record<SourceKind, string> = {
  balanced: "Balanced order",
  sorted: "Sorted order",
};

const EMPTY_TREE: BstSnapshot = { nodes: [], rootId: null };

export type BSTVizProps = {
  initialSource?: SourceKind;
  initialSpeedMs?: number;
};

function highlightsFor(step: BstStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "compare":
      return [{ nodeId: step.cursorId, kind: "cursor" }];
    case "place":
      return [{ nodeId: step.newId, kind: "placed" }];
    case "duplicate":
      return [{ nodeId: step.cursorId, kind: "duplicate" }];
  }
}

function annotationFor(step: BstStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingValue}`;
    case "compare": {
      const node = step.tree.nodes[step.cursorId];
      const direction =
        step.insertingValue < node.value
          ? "go left"
          : step.insertingValue > node.value
            ? "go right"
            : "match";
      return `Compare ${step.insertingValue} vs ${node.value} → ${direction}`;
    }
    case "place": {
      const node = step.tree.nodes[step.newId];
      return `Placed ${node.value}`;
    }
    case "duplicate":
      return `${step.insertingValue} already in tree`;
    case "done":
      return "Done";
  }
}

export function BSTViz({ initialSource = "balanced", initialSpeedMs = 350 }: BSTVizProps) {
  const [source, setSource] = useState<SourceKind>(initialSource);
  const sequence = SEQUENCES[source];

  const steps = useMemo<readonly BstStep[]>(() => [...insertSequence(sequence)], [sequence]);

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const tree = currentStep?.tree ?? EMPTY_TREE;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const compares = countKind(visibleSteps, "compare");
  const placed = countKind(visibleSteps, "place");
  const depth = maxDepth(tree);

  const handleSourceChange = (next: SourceKind) => {
    if (next === source) return;
    setSource(next);
    playback.reset();
  };

  return (
    <section
      aria-label="Binary search tree visualization"
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
          source={bstInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="BST insert pseudocode"
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
          <dt className="text-xs text-zinc-500">Placed</dt>
          <dd className="font-mono text-lg">{placed}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Max depth</dt>
          <dd className="font-mono text-lg">{depth}</dd>
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
