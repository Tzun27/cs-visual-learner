"use client";

import { useMemo } from "react";
import { attentionSequence, type AttentionParams } from "@/lib/ml/attention";
import { attentionPython } from "@/lib/ml/attention.snippet";
import type { AttentionStep } from "@/lib/ml/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { AttentionView } from "./AttentionView";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";

const DEMO_PARAMS: AttentionParams = {
  embeddings: [
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  tokenLabels: ["t1", "t2", "t3"],
  wQ: [
    [1, 0],
    [0, 1],
  ],
  wK: [
    [0, 1],
    [1, 0],
  ],
  wV: [
    [1, 1],
    [1, -1],
  ],
};

function annotationFor(step: AttentionStep | undefined): string {
  if (!step) return "Idle — press step forward or run to end.";
  switch (step.kind) {
    case "begin":
      return `Three tokens (${DEMO_PARAMS.tokenLabels.join(", ")}) with their embeddings X. Projection matrices W_Q, W_K, W_V are fixed.`;
    case "project-q":
      return "Project each token's embedding through W_Q → Q";
    case "project-k":
      return "Project each token's embedding through W_K → K";
    case "project-v":
      return "Project each token's embedding through W_V → V";
    case "compute-scores":
      return "Scores S = Q · Kᵀ — each row is one query token's affinity with every key";
    case "scale-scores":
      return "Scale by 1/√d_k to keep the softmax sharp but not saturated";
    case "softmax":
      return "Row-wise softmax → each row sums to 1; this is the attention matrix";
    case "weighted-sum":
      return "Y = A · V — each output is a convex combination of V rows weighted by attention";
    case "done":
      return "Done — one full pass through a single attention head";
  }
}

const phaseLabels: Record<string, string> = {
  begin: "begin",
  "project-q": "project Q",
  "project-k": "project K",
  "project-v": "project V",
  scores: "raw scores",
  scaled: "scaled scores",
  softmax: "softmax",
  output: "output",
  done: "done",
};

export type AttentionVizProps = {
  initialSpeedMs?: number;
};

export function AttentionViz({ initialSpeedMs = 700 }: AttentionVizProps) {
  const steps = useMemo<readonly AttentionStep[]>(() => [...attentionSequence(DEMO_PARAMS)], []);

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const snapshot = currentStep?.snapshot ?? steps[0].snapshot;
  const annotation = annotationFor(currentStep);
  const phase = phaseLabels[snapshot.phase] ?? snapshot.phase;

  return (
    <section
      aria-label="Attention head visualization"
      className="not-prose flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Single attention head · 3 tokens · d_k = d_v = 2
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <AttentionView snapshot={snapshot} className="w-full" />
        <CodePanel
          source={attentionPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Attention pseudocode"
        />
      </div>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation}
      </p>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Phase</dt>
          <dd className="font-mono text-lg">{phase}</dd>
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
