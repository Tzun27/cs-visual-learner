"use client";

import { useMemo } from "react";
import {
  buildLinearProbeTable,
  linearProbeDeleteSequence,
  linearProbeSearchSequence,
} from "@/lib/dataStructures/linearProbe";
import { linearProbeSearchPython } from "@/lib/dataStructures/linearProbeSearch.snippet";
import type { LinearProbeSearchStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;

// Build the same shape the user saw at end of the insert section, then
// delete 13 to plant a tombstone at slot 6. That tombstone is the
// teaching pivot: search for 21 must probe PAST it to find 21 at slot 7.
function buildInitialTable(): LinearProbeSnapshot {
  const inserted = buildLinearProbeTable(CAPACITY, [5, 13, 21, 4]);
  const afterDelete = [...linearProbeDeleteSequence(inserted, [13])].at(-1);
  if (!afterDelete || afterDelete.kind !== "done") {
    throw new Error("expected 'done' last from delete-13 setup");
  }
  return afterDelete.table;
}

// Targets:
//   5  → direct hit at home slot, zero probes
//   21 → probe past 5 and tombstone-at-6 to find 21 at slot 7
//   13 → MISS (it was deleted) — probes past 5, tombstone, 21, then empty
//   12 → MISS via cluster: probes past 4, 5, tombstone, 21, then empty
//   4  → direct hit at slot 4 (different home, no probing)
const SEARCH_TARGETS = [5, 21, 13, 12, 4] as const;

export type LinearProbeSearchVizProps = {
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
      return `Probe slot ${step.slotIndex} (${desc}) → advance`;
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

export function LinearProbeSearchViz({ initialSpeedMs = 400 }: LinearProbeSearchVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeSearchStep[]>(
    () => [...linearProbeSearchSequence(initial, SEARCH_TARGETS)],
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
      aria-label="Linear-probe search"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Searching {SEARCH_TARGETS.join(", ")} (slot 6 is a tombstone — 13 was deleted)
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <LinearProbeView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={linearProbeSearchPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Linear-probe search pseudocode"
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
