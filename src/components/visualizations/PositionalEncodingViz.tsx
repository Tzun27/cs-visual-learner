"use client";

import { useMemo } from "react";
import {
  positionalEncodingSequence,
  type PositionalEncodingParams,
} from "@/lib/ml/positionalEncoding";
import { positionalEncodingPython } from "@/lib/ml/positionalEncoding.snippet";
import type { PositionalEncodingStep } from "@/lib/ml/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { PositionalEncodingView } from "./PositionalEncodingView";

// Same X as the main attention demo, so users can mentally connect
// "here is what gets added to X before Q/K/V projection."
const DEMO_PARAMS: PositionalEncodingParams = {
  embeddings: [
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  tokenLabels: ["t1", "t2", "t3"],
};

function annotationFor(step: PositionalEncodingStep | undefined): string {
  if (!step) return "Idle — press step forward or run to end.";
  switch (step.kind) {
    case "begin":
      return "X is the token embeddings. PE will be a same-shape matrix filled row-by-row with sin/cos of the position.";
    case "compute-pe-row":
      return `Row ${step.rowIndex}: PE[${step.rowIndex}, 0] = sin(${step.rowIndex}), PE[${step.rowIndex}, 1] = cos(${step.rowIndex})`;
    case "add":
      return "X′ = X + PE — each row now carries a unique 'position fingerprint' that attention can read.";
    case "done":
      return "Done. X′ is what feeds into the Q/K/V projection inside attention.";
  }
}

const phaseLabels: Record<string, string> = {
  begin: "begin",
  "compute-pe": "compute PE",
  add: "add to X",
  done: "done",
};

export type PositionalEncodingVizProps = {
  initialSpeedMs?: number;
};

export function PositionalEncodingViz({ initialSpeedMs = 700 }: PositionalEncodingVizProps) {
  const steps = useMemo<readonly PositionalEncodingStep[]>(
    () => [...positionalEncodingSequence(DEMO_PARAMS)],
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
  const revealedRows = snapshot.revealedRows ?? 0;

  return (
    <section
      aria-label="Positional encoding visualization"
      className="not-prose flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Sinusoidal positional encoding · 3 tokens · d_embed = 2
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <PositionalEncodingView snapshot={snapshot} className="w-full" />
        <CodePanel
          source={positionalEncodingPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Positional encoding pseudocode"
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
          <dt className="text-xs text-zinc-500">PE rows ready</dt>
          <dd className="font-mono text-lg">
            {revealedRows} / {DEMO_PARAMS.embeddings.length}
          </dd>
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
