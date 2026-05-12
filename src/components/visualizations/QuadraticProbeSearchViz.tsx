"use client";

import { useMemo } from "react";
import { linearProbeDeleteSequence } from "@/lib/dataStructures/linearProbe";
import {
  buildQuadraticProbeTable,
  quadraticProbeSearchSequence,
} from "@/lib/dataStructures/quadraticProbe";
import { quadraticProbeSearchPython } from "@/lib/dataStructures/quadraticProbeSearch.snippet";
import type { LinearProbeSearchStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 11;

// Same starting shape the insert section ends on (5,16,27,38,49 at slots
// 5,6,9,3,10), then delete 16 so slot 6 holds a tombstone. The tombstone
// is the load-bearing case for search: probing past it still finds 27 at
// slot 9 (the next i*i jump after slot 6).
function buildInitialTable(): LinearProbeSnapshot {
  const inserted = buildQuadraticProbeTable(CAPACITY, [5, 16, 27, 38, 49]);
  // linearProbeDeleteSequence uses the same slot model and a plain
  // `cursor++ % cap` walk to find 16 at its known location (slot 6) —
  // the tombstone-planting step is identical for the two probe schemes.
  const after = [...linearProbeDeleteSequence(inserted, [16])].at(-1);
  if (!after || after.kind !== "done") {
    throw new Error("expected 'done' from tombstone setup");
  }
  return after.table;
}

// Targets:
//   5  → home hit at slot 5, zero probes
//   27 → probe past 5, probe past tombstone-at-6 → find at slot 9 (i=2)
//   16 → MISS (deleted) — probes 5, tombstone-6, 27-at-9, 38-at-3, 49-at-10,
//        then i=5 jumps to slot (5+25)%11=8 which is empty → miss at 8
//   99 → MISS at home slot 0 (empty), zero probes
const SEARCH_TARGETS = [5, 27, 16, 99] as const;

export type QuadraticProbeSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: LinearProbeSearchStep | undefined): LinearProbeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
    case "probe":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: LinearProbeSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — try next i²`;
    }
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}`;
    case "miss":
      return `Slot ${step.slotIndex} is empty → ${step.targetKey} not in table`;
    case "done":
      return "Done";
  }
}

function countProbes(steps: readonly LinearProbeSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "probe") n++;
  return n;
}

function countFound(steps: readonly LinearProbeSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "found") n++;
  return n;
}

function countMisses(steps: readonly LinearProbeSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "miss") n++;
  return n;
}

export function QuadraticProbeSearchViz({ initialSpeedMs = 400 }: QuadraticProbeSearchVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeSearchStep[]>(
    () => [...quadraticProbeSearchSequence(initial, SEARCH_TARGETS)],
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
  const probes = countProbes(visibleSteps);
  const found = countFound(visibleSteps);
  const misses = countMisses(visibleSteps);

  return (
    <section
      aria-label="Quadratic-probe search"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Searching {SEARCH_TARGETS.join(", ")} (slot 6 is a tombstone — 16 was deleted)
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <LinearProbeView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={quadraticProbeSearchPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Quadratic-probe search pseudocode"
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
          <dt className="text-xs text-zinc-500">Found</dt>
          <dd className="font-mono text-lg">{found}</dd>
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
