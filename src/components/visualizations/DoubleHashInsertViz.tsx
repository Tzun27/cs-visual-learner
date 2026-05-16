"use client";

import { useMemo } from "react";
import { doubleHashInsertSequence, doubleHashStepFor } from "@/lib/dataStructures/doubleHash";
import { doubleHashInsertPython } from "@/lib/dataStructures/doubleHashInsert.snippet";
import { emptyTable } from "@/lib/dataStructures/linearProbe";
import type { LinearProbeInsertStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

// 11 (prime) means h2(k) ∈ [1, 10] is always coprime with c, so probe
// sequences visit every slot — no risk of unreachable empties.
const CAPACITY = 11;
// All five keys hash to bucket 5 (h1 = 5), but each has a different h2:
//   h2(5)  = 6  → probes 5, 0,  6, 1, 7, ...
//   h2(16) = 7  → probes 5, 1,  8, 4, 0, ...
//   h2(27) = 8  → probes 5, 2, 10, 7, 4, ...
//   h2(38) = 9  → probes 5, 3,  1, 10, 8, ...
//   h2(49) = 10 → probes 5, 4,  3, 2, 1, ...
// Each placement collides at slot 5 once, then jumps by its own h2 to an
// empty slot — exactly 1 probe per placement (4 total for keys 2-5). The
// duplicate 27 follows 27's own probe path and finds itself at slot 2.
const INSERT_SEQUENCE = [5, 16, 27, 38, 49, 27] as const;
const INITIAL = emptyTable(CAPACITY);

export type DoubleHashInsertVizProps = {
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
    case "begin": {
      const home = step.insertingKey % step.table.capacity;
      const stepSize = doubleHashStepFor(step.insertingKey, step.table.capacity);
      return `Inserting ${step.insertingKey} (h1=${home}, h2=${stepSize})`;
    }
    case "hash":
      return `h1(${step.insertingKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      const stepSize = doubleHashStepFor(step.insertingKey, step.table.capacity);
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — jump by h2=${stepSize}`;
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

export function DoubleHashInsertViz({ initialSpeedMs = 400 }: DoubleHashInsertVizProps) {
  const steps = useMemo<readonly LinearProbeInsertStep[]>(
    () => [...doubleHashInsertSequence(INITIAL, INSERT_SEQUENCE)],
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
      aria-label="Double-hash insert"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Inserting {INSERT_SEQUENCE.join(", ")} into {CAPACITY} slots — every key has h1=5, distinct
        h2
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <LinearProbeView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={doubleHashInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Double-hash insert pseudocode"
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
