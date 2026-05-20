"use client";

import { useMemo } from "react";
import { crossAttentionSequence, type CrossAttentionParams } from "@/lib/ml/crossAttention";
import { crossAttentionPython } from "@/lib/ml/crossAttention.snippet";
import type { CrossAttentionStep } from "@/lib/ml/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { CrossAttentionView } from "./CrossAttentionView";

// A 2-token decoder sequence attending into a 3-token encoder sequence.
// W_Q is identity and W_K swaps dims (same matrices as the self-attention
// demo) so the only thing that changed is *where Q comes from* vs K/V.
const DEMO_PARAMS: CrossAttentionParams = {
  decoderEmbeddings: [
    [2, 1],
    [0, 2],
  ],
  decoderTokenLabels: ["d1", "d2"],
  encoderEmbeddings: [
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  encoderTokenLabels: ["e1", "e2", "e3"],
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

function annotationFor(step: CrossAttentionStep | undefined): string {
  if (!step) return "Idle — press step forward or run to end.";
  switch (step.kind) {
    case "begin":
      return "Two sequences: a 2-token decoder and a 3-token encoder. The decoder will attend into the encoder.";
    case "project-q":
      return "Queries come from the decoder — project X_dec through W_Q (2 query rows)";
    case "project-k":
      return "Keys come from the encoder — project X_enc through W_K (3 key rows)";
    case "project-v":
      return "Values come from the encoder — project X_enc through W_V (3 value rows)";
    case "compute-scores":
      return "Scores S = Q · Kᵀ — a 2×3 grid: every decoder query scored against every encoder key";
    case "scale-scores":
      return "Scale by 1/√d_k to keep the softmax well-conditioned";
    case "softmax":
      return "Row-wise softmax over the encoder dimension — each decoder row sums to 1";
    case "weighted-sum":
      return "Y = A · V — each decoder token's output blends the three encoder values";
    case "done":
      return "Done — the decoder pulled context from the encoder. Q and K/V came from different sequences.";
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

export type CrossAttentionVizProps = {
  initialSpeedMs?: number;
};

export function CrossAttentionViz({ initialSpeedMs = 700 }: CrossAttentionVizProps) {
  const steps = useMemo<readonly CrossAttentionStep[]>(
    () => [...crossAttentionSequence(DEMO_PARAMS)],
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

  return (
    <section
      aria-label="Cross-attention visualization"
      className="not-prose flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Encoder-decoder cross-attention · 2-token decoder · 3-token encoder · d_k = d_v = 2
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <CrossAttentionView snapshot={snapshot} className="w-full" />
        <CodePanel
          source={crossAttentionPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Cross-attention pseudocode"
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
