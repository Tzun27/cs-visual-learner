"use client";

import { useMemo } from "react";
import { attentionSequence, type AttentionParams } from "@/lib/ml/attention";
import { causalAttentionPython } from "@/lib/ml/causalAttention.snippet";
import type { AttentionStep } from "@/lib/ml/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { AttentionView } from "./AttentionView";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";

// Same inputs as the non-causal demo so users can mentally diff the two
// outputs side-by-side: Y[0] under plain attention mixes V from all
// three tokens; Y[0] under causal masking equals V[0] exactly (because
// the only non-zero attention weight in row 0 is on token 0 itself).
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
  mask: "causal",
};

function annotationFor(step: AttentionStep | undefined): string {
  if (!step) return "Idle — press step forward or run to end.";
  switch (step.kind) {
    case "begin":
      return "Same 3-token setup as the plain attention demo, plus a causal mask.";
    case "project-q":
      return "Project each token's embedding through W_Q → Q";
    case "project-k":
      return "Project each token's embedding through W_K → K";
    case "project-v":
      return "Project each token's embedding through W_V → V";
    case "compute-scores":
      return "Scores S = Q · Kᵀ — full 3×3 grid, no masking applied yet";
    case "scale-scores":
      return "Scale by 1/√d_k. Upper triangle is shown with a red strikethrough — those entries will be masked next";
    case "mask-scores":
      return "Set S[i][j] = −∞ for j > i. After softmax, those positions become 0 — token i can only attend to tokens 0..i";
    case "softmax":
      return "Row-wise softmax. The attention matrix is now lower-triangular: row 0 = [1, 0, 0], row 1 = [α, 1−α, 0], row 2 = [a, b, c]";
    case "weighted-sum":
      return "Y = A · V. Y[0] equals V[0] exactly because only its own weight is non-zero";
    case "done":
      return "Done — causal attention preserves the 'predict-next-token' invariant during parallel training";
  }
}

const phaseLabels: Record<string, string> = {
  begin: "begin",
  "project-q": "project Q",
  "project-k": "project K",
  "project-v": "project V",
  scores: "raw scores",
  scaled: "scaled scores",
  masked: "masked scores",
  softmax: "softmax",
  output: "output",
  done: "done",
};

export type CausalAttentionVizProps = {
  initialSpeedMs?: number;
};

export function CausalAttentionViz({ initialSpeedMs = 700 }: CausalAttentionVizProps) {
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

  // Once we've passed scale-scores, the causal-mask overlay is the
  // pedagogical point — light it up so users see what's about to die.
  const showCausalMask =
    snapshot.phase === "scaled" ||
    snapshot.phase === "masked" ||
    snapshot.phase === "softmax" ||
    snapshot.phase === "output" ||
    snapshot.phase === "done";

  return (
    <section
      aria-label="Causal attention visualization"
      className="not-prose flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Single causal attention head · 3 tokens · d_k = d_v = 2 · upper triangle masked to −∞
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <AttentionView snapshot={snapshot} showCausalMask={showCausalMask} className="w-full" />
        <CodePanel
          source={causalAttentionPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Causal attention pseudocode"
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
