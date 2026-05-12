"use client";

import { useMemo } from "react";
import { robinHoodInsertSequence } from "@/lib/dataStructures/robinHood";
import { robinHoodInsertPython } from "@/lib/dataStructures/robinHoodInsert.snippet";
import type { LinearProbeSnapshot, RobinHoodInsertStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;

// Inserts chosen to force one "rob from the rich" swap and show
// displacement equalization. Trace:
//   5  → home slot 5, place (disp 0)
//   14 → home slot 6, place (disp 0)
//   13 → hashes to 5, probe=0 vs 5(disp 0): no swap, advance.
//        probe=1 at slot 6 vs 14(disp 0): 1>0 → SWAP. 13 takes slot 6.
//        Now inserting 14 with probe=1 (continuing). Advance to slot 7,
//        probe=1. Empty → place 14 there.
//   22 → hashes to 6, probe=0 vs 13(disp 1): 0>1 false, no swap, advance.
//        probe=1 at slot 7 vs 14(disp 1): 1>1 false, advance.
//        probe=2 at slot 0 empty → place 22.
const INSERT_SEQUENCE = [5, 14, 13, 22] as const;
const INITIAL: LinearProbeSnapshot = {
  capacity: CAPACITY,
  slots: Array.from({ length: CAPACITY }, () => ({ state: "empty" as const })),
};

export type RobinHoodInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: RobinHoodInsertStep | undefined): LinearProbeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
    case "probe":
    case "compare-displacement":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "swap":
    case "place":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "duplicate":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: RobinHoodInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "hash":
      return `hash(${step.insertingKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "compare-displacement":
      return `Compare displacements at slot ${step.slotIndex}: inserting=+${step.insertingProbe}, existing=+${step.existingProbe}`;
    case "swap":
      return `Swap: ${step.placedKey} takes slot ${step.slotIndex}, ${step.evictedKey} continues with probe ${step.probe}`;
    case "probe":
      return `Probe slot ${step.slotIndex} (now inserting ${step.insertingKey} at probe ${step.probe})`;
    case "duplicate":
      return `${step.insertingKey} already present at slot ${step.slotIndex} — skip`;
    case "place":
      return `Placed ${step.insertingKey} at slot ${step.slotIndex} (displacement +${step.probe})`;
    case "done":
      return "Done";
  }
}

function countSwaps(steps: readonly RobinHoodInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "swap") n++;
  return n;
}

function countPlaced(steps: readonly RobinHoodInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "place") n++;
  return n;
}

function countProbes(steps: readonly RobinHoodInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "probe") n++;
  return n;
}

export function RobinHoodInsertViz({ initialSpeedMs = 450 }: RobinHoodInsertVizProps) {
  const steps = useMemo<readonly RobinHoodInsertStep[]>(
    () => [...robinHoodInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const table = currentStep?.table ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const swaps = countSwaps(visibleSteps);
  const placed = countPlaced(visibleSteps);
  const probes = countProbes(visibleSteps);

  return (
    <section
      aria-label="Robin Hood insert"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Inserting {INSERT_SEQUENCE.join(", ")} with Robin Hood probing — each cell shows its
        displacement
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <LinearProbeView
          table={table}
          highlights={highlights}
          showDisplacements
          className="w-full"
        />
        <CodePanel
          source={robinHoodInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Robin Hood insert pseudocode"
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
          <dt className="text-xs text-zinc-500">Probes</dt>
          <dd className="font-mono text-lg">{probes}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Swaps</dt>
          <dd className="font-mono text-lg">{swaps}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Placed</dt>
          <dd className="font-mono text-lg">{placed}</dd>
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
