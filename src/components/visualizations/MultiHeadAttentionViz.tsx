"use client";

import { useMemo } from "react";
import {
  multiHeadAttentionSequence,
  type MultiHeadAttentionParams,
} from "@/lib/ml/multiHeadAttention";
import { multiHeadAttentionPython } from "@/lib/ml/multiHeadAttention.snippet";
import type { MultiHeadAttentionStep } from "@/lib/ml/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { MultiHeadAttentionView } from "./MultiHeadAttentionView";

// 3 tokens × d_embed=4, 2 heads with d_k=d_v=2. Head 1 is identity-like so
// Q^(1)=K^(1)=V^(1)=X[:, :2], making the per-head trajectory easy to follow.
// Head 2 swaps the first two embedding dims for Q^(2) and uses an asymmetric
// W_V^(2) so Y^(2) carries a different numerical signature than Y^(1) — the
// concat strip is visibly heterogeneous. W_O = identity in the demo; the
// lesson copy explains that real W_O is learned.
const DEMO_PARAMS: MultiHeadAttentionParams = {
  embeddings: [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [1, 1, 0, 1],
  ],
  tokenLabels: ["t1", "t2", "t3"],
  wQ: [
    [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ],
    [
      [0, 1],
      [1, 0],
      [0, 0],
      [0, 0],
    ],
  ],
  wK: [
    [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ],
    [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ],
  ],
  wV: [
    [
      [1, 0],
      [0, 1],
      [0, 0],
      [0, 0],
    ],
    [
      [2, 0],
      [0, -1],
      [0, 0],
      [1, 0],
    ],
  ],
  wO: [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ],
};

function annotationFor(step: MultiHeadAttentionStep | undefined): string {
  if (!step) return "Idle — press step forward or run to end.";
  switch (step.kind) {
    case "begin":
      return `Two heads in parallel, each with its own W_Q, W_K, W_V. The W_O at the end mixes their outputs.`;
    case "project-q":
      return `Head ${step.headIndex + 1}: project X through W_Q^(${step.headIndex + 1}) → Q^(${step.headIndex + 1})`;
    case "project-k":
      return `Head ${step.headIndex + 1}: project X through W_K^(${step.headIndex + 1}) → K^(${step.headIndex + 1})`;
    case "project-v":
      return `Head ${step.headIndex + 1}: project X through W_V^(${step.headIndex + 1}) → V^(${step.headIndex + 1})`;
    case "compute-scores":
      return `Head ${step.headIndex + 1}: raw scores Q^(${step.headIndex + 1}) · K^(${step.headIndex + 1})ᵀ`;
    case "scale-scores":
      return `Head ${step.headIndex + 1}: scale by 1/√d_k`;
    case "softmax":
      return `Head ${step.headIndex + 1}: row-wise softmax → A^(${step.headIndex + 1})`;
    case "weighted-sum":
      return `Head ${step.headIndex + 1}: Y^(${step.headIndex + 1}) = A^(${step.headIndex + 1}) · V^(${step.headIndex + 1})`;
    case "concat-heads":
      return `Stack [Y^(1) | Y^(2)] along the feature dimension → concat (3 × ${2 * step.snapshot.heads.length})`;
    case "project-output":
      return `Apply W_O → final Y = concat · W_O. (Identity W_O here, so Y equals concat.)`;
    case "done":
      return `Done — one full multi-head attention pass over ${step.snapshot.heads.length} heads`;
  }
}

const phaseLabels: Record<string, string> = {
  begin: "begin",
  head: "head loop",
  concat: "concatenate",
  "project-output": "project · W_O",
  done: "done",
};

export type MultiHeadAttentionVizProps = {
  initialSpeedMs?: number;
};

export function MultiHeadAttentionViz({ initialSpeedMs = 700 }: MultiHeadAttentionVizProps) {
  const steps = useMemo<readonly MultiHeadAttentionStep[]>(
    () => [...multiHeadAttentionSequence(DEMO_PARAMS)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const snapshot = currentStep?.snapshot ?? steps[0].snapshot;
  const annotation = annotationFor(currentStep);
  const phase = phaseLabels[snapshot.phase] ?? snapshot.phase;
  const activeHeadLabel =
    snapshot.activeHead !== undefined ? `head ${snapshot.activeHead + 1}` : "—";

  return (
    <section
      aria-label="Multi-head attention visualization"
      className="not-prose flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Multi-head attention · 3 tokens · 2 heads · d_embed = 4 · d_k = d_v = 2
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <MultiHeadAttentionView snapshot={snapshot} className="w-full" />
        <CodePanel
          source={multiHeadAttentionPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Multi-head attention pseudocode"
        />
      </div>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation}
      </p>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Phase</dt>
          <dd className="font-mono text-lg">{phase}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Active head</dt>
          <dd className="font-mono text-lg">{activeHeadLabel}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Step</dt>
          <dd className="font-mono text-lg">{Math.max(0, playback.stepIndex)}</dd>
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
        onRunToCompletion={playback.runToCompletion}
      />
    </section>
  );
}
