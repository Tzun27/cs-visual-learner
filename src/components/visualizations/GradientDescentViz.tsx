"use client";

import { useMemo, useState } from "react";
import {
  bowlLoss,
  gradientDescentSequence,
  type GradientDescentParams,
} from "@/lib/ml/gradientDescent";
import { BOWL_BOUNDS, BOWL_CONTOURS } from "@/lib/ml/gradientDescent.contours";
import { gradientDescentPython } from "@/lib/ml/gradientDescent.snippet";
import type { GradientDescentStep } from "@/lib/ml/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { ContourView } from "./ContourView";
import { Controls } from "./Controls";

const LR_OPTIONS = [
  { value: 0.05, label: "0.05 (cautious)" },
  { value: 0.1, label: "0.1 (balanced)" },
  { value: 0.15, label: "0.15 (brisk)" },
  { value: 0.32, label: "0.32 (oscillates)" },
] as const;

const DEFAULT_PARAMS: GradientDescentParams = {
  start: [4, -2],
  learningRate: 0.1,
  maxSteps: 30,
  tolerance: 1e-3,
};

function gradientFor(step: GradientDescentStep | undefined): readonly [number, number] | undefined {
  if (!step) return undefined;
  if (step.kind === "compute-gradient" || step.kind === "converged") return step.gradient;
  return undefined;
}

function annotationFor(step: GradientDescentStep | undefined): string {
  if (!step) return "Idle — press step forward or run to end.";
  switch (step.kind) {
    case "begin": {
      const [w1, w2] = step.snapshot.params;
      return `Start at (${w1.toFixed(2)}, ${w2.toFixed(2)})`;
    }
    case "compute-gradient": {
      const [gw1, gw2] = step.gradient;
      return `∇L = (${gw1.toFixed(2)}, ${gw2.toFixed(2)}); ‖∇L‖ = ${step.gradientNorm.toFixed(3)}`;
    }
    case "apply-update": {
      const [w1, w2] = step.snapshot.params;
      return `Apply update → (${w1.toFixed(2)}, ${w2.toFixed(2)})`;
    }
    case "converged":
      return `Converged: ‖∇L‖ = ${step.gradientNorm.toExponential(2)} below tolerance`;
    case "done":
      return "Stopped at max steps without converging";
  }
}

export type GradientDescentVizProps = {
  initialSpeedMs?: number;
};

export function GradientDescentViz({ initialSpeedMs = 400 }: GradientDescentVizProps) {
  const [learningRate, setLearningRate] = useState<number>(DEFAULT_PARAMS.learningRate);

  const steps = useMemo<readonly GradientDescentStep[]>(
    () => [...gradientDescentSequence({ ...DEFAULT_PARAMS, learningRate })],
    [learningRate],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const snapshot = currentStep?.snapshot ?? {
    params: DEFAULT_PARAMS.start,
    trajectory: [DEFAULT_PARAMS.start],
  };
  const gradient = gradientFor(currentStep);
  const annotation = annotationFor(currentStep);
  const [w1, w2] = snapshot.params;
  const currentLoss = bowlLoss(w1, w2);
  const gradientNorm = gradient ? Math.hypot(gradient[0], gradient[1]) : 0;
  const stepNumber = Math.max(0, snapshot.trajectory.length - 1);

  const handleLrChange = (next: number) => {
    if (next === learningRate) return;
    setLearningRate(next);
    playback.reset();
  };

  return (
    <section
      aria-label="Gradient descent visualization"
      className="not-prose flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div role="group" aria-label="Learning rate" className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] tracking-wider text-zinc-500 uppercase">Learning rate</span>
        {LR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleLrChange(opt.value)}
            aria-pressed={learningRate === opt.value}
            className={`rounded border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none ${
              learningRate === opt.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <ContourView
          snapshot={snapshot}
          contours={BOWL_CONTOURS}
          bounds={BOWL_BOUNDS}
          gradient={gradient}
          caption={`loss ${currentLoss.toFixed(2)}`}
          className="w-full"
        />
        <CodePanel
          source={gradientDescentPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Gradient descent pseudocode"
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
          <dt className="text-xs text-zinc-500">Step</dt>
          <dd className="font-mono text-lg">{stepNumber}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Loss</dt>
          <dd className="font-mono text-lg">{currentLoss.toFixed(3)}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">‖∇L‖</dt>
          <dd className="font-mono text-lg">{gradientNorm.toFixed(3)}</dd>
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
