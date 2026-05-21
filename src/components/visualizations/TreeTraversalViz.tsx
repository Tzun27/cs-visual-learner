"use client";

import { useMemo, useState } from "react";
import { buildTree } from "@/lib/dataStructures/binarySearchTree";
import {
  TRAVERSAL_MODE_LABELS,
  TRAVERSAL_MODES,
  traversalSequence,
} from "@/lib/dataStructures/traversal";
import { inorderPython } from "@/lib/dataStructures/inorderTraversal.snippet";
import { levelOrderPython } from "@/lib/dataStructures/levelOrderTraversal.snippet";
import { postorderPython } from "@/lib/dataStructures/postorderTraversal.snippet";
import { preorderPython } from "@/lib/dataStructures/preorderTraversal.snippet";
import type { BstTraversalStep, TraversalMode } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { countKind } from "@/lib/stepCount";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

// Same balanced shape as the BST lesson's demo so the four orders are easy
// to compare against the same picture.
const DEMO_SEQUENCE = [4, 2, 6, 1, 3, 5, 7] as const;

const SOURCE_FOR: Record<TraversalMode, string> = {
  preorder: preorderPython,
  inorder: inorderPython,
  postorder: postorderPython,
  "level-order": levelOrderPython,
};

const ARIA_FOR: Record<TraversalMode, string> = {
  preorder: "Preorder traversal pseudocode",
  inorder: "Inorder traversal pseudocode",
  postorder: "Postorder traversal pseudocode",
  "level-order": "Level-order traversal pseudocode",
};

export type TreeTraversalVizProps = {
  initialMode?: TraversalMode;
  initialSpeedMs?: number;
};

function highlightsFor(step: BstTraversalStep | undefined): TreeHighlight[] {
  if (!step) return [];
  if (step.kind === "visit") return [{ nodeId: step.cursorId, kind: "placed" }];
  return [];
}

function annotationFor(step: BstTraversalStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Beginning ${TRAVERSAL_MODE_LABELS[step.mode].toLowerCase()} traversal`;
    case "visit": {
      const value = step.tree.nodes[step.cursorId].value;
      return `Visit ${value}`;
    }
    case "done":
      return "Done";
  }
}

export function TreeTraversalViz({
  initialMode = "preorder",
  initialSpeedMs = 400,
}: TreeTraversalVizProps) {
  const [mode, setMode] = useState<TraversalMode>(initialMode);
  const tree = useMemo(() => buildTree(DEMO_SEQUENCE), []);
  const steps = useMemo<readonly BstTraversalStep[]>(
    () => [...traversalSequence(tree, mode)],
    [tree, mode],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);
  const sequence = currentStep?.sequence ?? [];

  const visited = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const visits = countKind(visited, "visit");
  const total = tree.nodes.length;

  const handleModeChange = (next: TraversalMode) => {
    if (next === mode) return;
    setMode(next);
    playback.reset();
  };

  return (
    <section
      aria-label="Tree traversal visualization"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div role="group" aria-label="Traversal mode" className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] tracking-wider text-zinc-500 uppercase">Traversal</span>
        {TRAVERSAL_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            aria-pressed={mode === m}
            className={`rounded border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none ${
              mode === m
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            }`}
          >
            {TRAVERSAL_MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <TreeView tree={tree} highlights={highlights} className="w-full" />
        <CodePanel
          source={SOURCE_FOR[mode]}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel={ARIA_FOR[mode]}
        />
      </div>

      <div
        role="group"
        aria-label="Visited sequence"
        className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="text-[11px] tracking-wider text-zinc-500 uppercase">Output sequence</div>
        {sequence.length === 0 ? (
          <p
            aria-live="polite"
            className="mt-2 flex min-h-[1.75rem] items-center font-mono text-sm text-zinc-500"
          >
            (empty)
          </p>
        ) : (
          <ol
            aria-live="polite"
            className="mt-2 flex min-h-[1.75rem] flex-wrap gap-2 font-mono text-sm"
          >
            {sequence.map((v, i) => (
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

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Visits</dt>
          <dd className="font-mono text-lg">{visits}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Remaining</dt>
          <dd className="font-mono text-lg">{Math.max(0, total - visits)}</dd>
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
