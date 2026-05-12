"use client";

import { useMemo } from "react";
import {
  buildQuadraticProbeTable,
  quadraticProbeDeleteSequence,
} from "@/lib/dataStructures/quadraticProbe";
import { quadraticProbeDeletePython } from "@/lib/dataStructures/quadraticProbeDelete.snippet";
import type { LinearProbeDeleteStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 11;

// Same starting state the insert section ends on: 5,16,27,38,49 at
// slots 5,6,9,3,10 respectively. Delete cases:
//   27 → probes past 5, past 16-at-6, then i=2 finds 27 at slot 9
//   5  → home hit at slot 5, zero probes (becomes tombstone)
//   99 → MISS: hash(99) % 11 = 0, slot 0 is empty → zero probes
function buildInitialTable(): LinearProbeSnapshot {
  return buildQuadraticProbeTable(CAPACITY, [5, 16, 27, 38, 49]);
}

const DELETE_TARGETS = [27, 5, 99] as const;

export type QuadraticProbeDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: LinearProbeDeleteStep | undefined): LinearProbeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
    case "probe":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
    case "tombstone":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: LinearProbeDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Deleting ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — try next i²`;
    }
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}`;
    case "tombstone":
      return `Replaced slot ${step.slotIndex} with a tombstone`;
    case "miss":
      return `Slot ${step.slotIndex} is empty → ${step.targetKey} not in table`;
    case "done":
      return "Done";
  }
}

function countRemoved(steps: readonly LinearProbeDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "tombstone") n++;
  return n;
}

function countMisses(steps: readonly LinearProbeDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "miss") n++;
  return n;
}

function countProbes(steps: readonly LinearProbeDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "probe") n++;
  return n;
}

export function QuadraticProbeDeleteViz({ initialSpeedMs = 400 }: QuadraticProbeDeleteVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeDeleteStep[]>(
    () => [...quadraticProbeDeleteSequence(initial, DELETE_TARGETS)],
    [initial],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const table = currentStep?.table ?? initial;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const removed = countRemoved(visibleSteps);
  const misses = countMisses(visibleSteps);
  const probes = countProbes(visibleSteps);

  return (
    <section
      aria-label="Quadratic-probe delete"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Deleting {DELETE_TARGETS.join(", ")} from a {CAPACITY}-slot table
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <LinearProbeView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={quadraticProbeDeletePython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Quadratic-probe delete pseudocode"
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
          <dt className="text-xs text-zinc-500">Removed</dt>
          <dd className="font-mono text-lg">{removed}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Misses</dt>
          <dd className="font-mono text-lg">{misses}</dd>
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
