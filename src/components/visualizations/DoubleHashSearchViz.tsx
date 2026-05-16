"use client";

import { useMemo } from "react";
import {
  buildDoubleHashTable,
  doubleHashDeleteSequence,
  doubleHashSearchSequence,
  doubleHashStepFor,
} from "@/lib/dataStructures/doubleHash";
import { doubleHashSearchPython } from "@/lib/dataStructures/doubleHashSearch.snippet";
import type { LinearProbeSearchStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 11;

// Same starting state as the insert section ends on (5,16,27,38,49 at
// slots 5,1,2,3,4), then delete 16 so slot 1 holds a tombstone. The
// tombstone is the load-bearing case for search: probing past it still
// finds keys further along the same h2 path. Note: we must use
// doubleHashDeleteSequence here (not linearProbeDeleteSequence) because 16
// doesn't live next to slot 5 — it lives at slot 1 via 16's own h2=7 jump.
function buildInitialTable(): LinearProbeSnapshot {
  const inserted = buildDoubleHashTable(CAPACITY, [5, 16, 27, 38, 49]);
  const after = [...doubleHashDeleteSequence(inserted, [16])].at(-1);
  if (!after || after.kind !== "done") {
    throw new Error("expected 'done' from tombstone setup");
  }
  return after.table;
}

// Targets:
//   5  → home hit at slot 5, zero probes
//   27 → probe past slot 5, jump by h2(27)=8 → find at slot 2 (1 probe)
//   16 → MISS (deleted) — probe past slot 5, jump by h2(16)=7 to slot 1
//        (tombstone, probe), then i=2 jumps to slot 8 (empty) → miss
//   99 → MISS at home slot 0 (empty), zero probes
const SEARCH_TARGETS = [5, 27, 16, 99] as const;

export type DoubleHashSearchVizProps = {
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
    case "begin": {
      const home = step.targetKey % step.table.capacity;
      const stepSize = doubleHashStepFor(step.targetKey, step.table.capacity);
      return `Searching for ${step.targetKey} (h1=${home}, h2=${stepSize})`;
    }
    case "hash":
      return `h1(${step.targetKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      const stepSize = doubleHashStepFor(step.targetKey, step.table.capacity);
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — jump by h2=${stepSize}`;
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

export function DoubleHashSearchViz({ initialSpeedMs = 400 }: DoubleHashSearchVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeSearchStep[]>(
    () => [...doubleHashSearchSequence(initial, SEARCH_TARGETS)],
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
      aria-label="Double-hash search"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Searching {SEARCH_TARGETS.join(", ")} (slot 1 is a tombstone — 16 was deleted)
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <LinearProbeView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={doubleHashSearchPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Double-hash search pseudocode"
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
