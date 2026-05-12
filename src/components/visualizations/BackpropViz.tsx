"use client";

import { useMemo } from "react";
import { backpropSequence, type BackpropParams } from "@/lib/ml/backprop";
import { backpropPython } from "@/lib/ml/backprop.snippet";
import type { BackpropStep } from "@/lib/ml/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { NetworkView, type NetworkHighlight } from "./NetworkView";

const DEMO_PARAMS: BackpropParams = {
  inputs: [1.0, 0.5],
  target: 2.0,
  weights: {
    w11: 0.4,
    w12: 0.6,
    b1: 0.1,
    w21: -0.3,
    w22: 1.0,
    b2: 0.2,
    v1: 0.5,
    v2: 0.8,
    c: 0.1,
  },
  learningRate: 0.1,
};

function highlightsFor(step: BackpropStep | undefined): readonly NetworkHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
      return [
        { target: "node", id: "x1", kind: "active" },
        { target: "node", id: "x2", kind: "active" },
      ];
    case "forward-hidden": {
      const hidden = step.hiddenIndex === 0 ? "h1" : "h2";
      const incoming1 = step.hiddenIndex === 0 ? "w11" : "w21";
      const incoming2 = step.hiddenIndex === 0 ? "w12" : "w22";
      return [
        { target: "node", id: hidden, kind: "current" },
        { target: "edge", id: incoming1, kind: "current" },
        { target: "edge", id: incoming2, kind: "current" },
      ];
    }
    case "forward-output":
      return [
        { target: "node", id: "y", kind: "current" },
        { target: "edge", id: "v1", kind: "current" },
        { target: "edge", id: "v2", kind: "current" },
      ];
    case "compute-loss":
      return [{ target: "node", id: "y", kind: "current" }];
    case "backward-output":
      return [
        { target: "node", id: "y", kind: "current" },
        { target: "edge", id: "v1", kind: "active" },
        { target: "edge", id: "v2", kind: "active" },
      ];
    case "backward-hidden": {
      const hidden = step.hiddenIndex === 0 ? "h1" : "h2";
      const incoming1 = step.hiddenIndex === 0 ? "w11" : "w21";
      const incoming2 = step.hiddenIndex === 0 ? "w12" : "w22";
      return [
        { target: "node", id: hidden, kind: "current" },
        { target: "edge", id: incoming1, kind: "active" },
        { target: "edge", id: incoming2, kind: "active" },
      ];
    }
    case "apply-update":
      return [
        { target: "edge", id: "w11", kind: "updated" },
        { target: "edge", id: "w12", kind: "updated" },
        { target: "edge", id: "w21", kind: "updated" },
        { target: "edge", id: "w22", kind: "updated" },
        { target: "edge", id: "v1", kind: "updated" },
        { target: "edge", id: "v2", kind: "updated" },
      ];
    case "done":
      return [];
  }
}

function annotationFor(step: BackpropStep | undefined): string {
  if (!step) return "Idle — press step forward or run to end.";
  switch (step.kind) {
    case "begin":
      return `Inputs x = (${step.snapshot.inputs[0]}, ${step.snapshot.inputs[1]}), target t = ${step.snapshot.target}`;
    case "forward-hidden": {
      const which = step.hiddenIndex === 0 ? "h1" : "h2";
      const value =
        step.hiddenIndex === 0 ? step.snapshot.activations.h1 : step.snapshot.activations.h2;
      return `Forward: ${which} = ReLU(...) = ${value?.toFixed(3) ?? "—"}`;
    }
    case "forward-output":
      return `Forward: y = v1·h1 + v2·h2 + c = ${step.snapshot.activations.y?.toFixed(3) ?? "—"}`;
    case "compute-loss":
      return `Loss: L = ½(y − t)² = ${step.snapshot.loss?.toFixed(4) ?? "—"}`;
    case "backward-output":
      return `Backward: ∂L/∂y = y − t = ${step.snapshot.gradients.dLdy?.toFixed(3) ?? "—"}; ∂L/∂v₁, ∂L/∂v₂, ∂L/∂c via chain rule`;
    case "backward-hidden": {
      const grad =
        step.hiddenIndex === 0
          ? step.snapshot.gradients.dLdh1Pre
          : step.snapshot.gradients.dLdh2Pre;
      const which = step.hiddenIndex === 0 ? "h₁" : "h₂";
      return `Backward: ∂L/∂${which}_pre = ${grad?.toFixed(3) ?? "—"} (ReLU derivative routes through)`;
    }
    case "apply-update":
      return `Apply update: every weight w ← w − lr · ∂L/∂w (lr = ${DEMO_PARAMS.learningRate})`;
    case "done":
      return "Done — one full step of gradient descent on the toy MLP";
  }
}

export type BackpropVizProps = {
  initialSpeedMs?: number;
};

export function BackpropViz({ initialSpeedMs = 600 }: BackpropVizProps) {
  const steps = useMemo<readonly BackpropStep[]>(() => [...backpropSequence(DEMO_PARAMS)], []);

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const snapshot = currentStep?.snapshot ?? steps[0].snapshot;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const phase = currentStep?.snapshot.phase ?? "forward";

  return (
    <section
      aria-label="Backpropagation visualization"
      className="not-prose flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        2 → 2 → 1 ReLU network · one training example · one update step
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <NetworkView snapshot={snapshot} highlights={highlights} className="w-full" />
        <CodePanel
          source={backpropPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Backpropagation pseudocode"
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
          <dd className="font-mono text-lg capitalize">{phase}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Loss</dt>
          <dd className="font-mono text-lg">
            {snapshot.loss !== undefined ? snapshot.loss.toFixed(4) : "—"}
          </dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">y</dt>
          <dd className="font-mono text-lg">
            {snapshot.activations.y !== undefined ? snapshot.activations.y.toFixed(3) : "—"}
          </dd>
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
