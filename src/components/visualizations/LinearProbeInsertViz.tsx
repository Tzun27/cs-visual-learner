"use client";

import { useMemo } from "react";
import { emptyTable, linearProbeInsertSequence } from "@/lib/dataStructures/linearProbe";
import { linearProbeInsertPython } from "@/lib/dataStructures/linearProbeInsert.snippet";
import type { LinearProbeInsertStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;
// Curated to hit every behavior worth showing:
//   5 → slot 5 (home placement)
//   13 → slot 5 collision, probe once → slot 6 placement
//   21 → slot 5/6 collisions, probe twice → slot 7 placement
//   4 → slot 4 (different home, no collision)
//   23 → hashes to 7, collision, wraps to slot 0 (wrap-around placement)
//   5 → duplicate at home slot 5 (no probes, no placement)
const INSERT_SEQUENCE = [5, 13, 21, 4, 23, 5] as const;
const INITIAL = emptyTable(CAPACITY);

export type LinearProbeInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: LinearProbeInsertStep | undefined): LinearProbeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "probe":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "duplicate":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
    case "place":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
  }
}

function annotationFor(step: LinearProbeInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "hash":
      return `hash(${step.insertingKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      return `Probe slot ${step.slotIndex} (${desc}) → advance`;
    }
    case "duplicate":
      return `${step.insertingKey} already present at slot ${step.slotIndex} — skip`;
    case "place":
      return `Placed ${step.insertingKey} at slot ${step.slotIndex}`;
    case "done":
      return "Done";
  }
}

function countProbes(steps: readonly LinearProbeInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "probe") n++;
  return n;
}

function countPlaced(steps: readonly LinearProbeInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "place") n++;
  return n;
}

function countDuplicates(steps: readonly LinearProbeInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "duplicate") n++;
  return n;
}

export function LinearProbeInsertViz({ initialSpeedMs = 400 }: LinearProbeInsertVizProps) {
  const steps = useMemo<readonly LinearProbeInsertStep[]>(
    () => [...linearProbeInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const table: LinearProbeSnapshot = currentStep?.table ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const probes = countProbes(visibleSteps);
  const placed = countPlaced(visibleSteps);
  const dups = countDuplicates(visibleSteps);

  return (
    <section
      aria-label="Linear-probe insert"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Inserting {INSERT_SEQUENCE.join(", ")} into {CAPACITY} slots
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <LinearProbeView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={linearProbeInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Linear-probe insert pseudocode"
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
          <dt className="text-xs text-zinc-500">Placed</dt>
          <dd className="font-mono text-lg">{placed}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Duplicates</dt>
          <dd className="font-mono text-lg">{dups}</dd>
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
