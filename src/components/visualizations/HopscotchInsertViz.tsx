"use client";

import { useMemo } from "react";
import { emptyHopscotchTable, hopscotchInsertSequence } from "@/lib/dataStructures/hopscotch";
import { hopscotchInsertPython } from "@/lib/dataStructures/hopscotchInsert.snippet";
import type { HopscotchInsertStep, HopscotchSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { HopscotchView, type HopscotchHighlight } from "./HopscotchView";

const CAPACITY = 8;

// Curated input that hits every insert path the algorithm has:
//   0 → home 0, place at slot 0 (dist 0)
//   1 → home 1, place at slot 1 (dist 0)
//   8 → home 0, scan past 0 → place at slot 2 (dist 2)
//   9 → home 1, scan past 1 and 2 → place at slot 3 (dist 2)
//   16 → home 0, scan past 0,1,2,3 → empty at 4 (dist 4 == H) → SWAP CHAIN:
//        pull key 1 from slot 1 to slot 4 → place 16 at slot 1 (dist 1)
//   16 → duplicate (already at slot 1 with home 0)
const INSERT_SEQUENCE = [0, 1, 8, 9, 16, 16] as const;
const INITIAL = emptyHopscotchTable(CAPACITY);

export type HopscotchInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HopscotchInsertStep | undefined): HopscotchHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
      return [{ slotIndex: step.home, kind: "cursor" }];
    case "scan":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "duplicate":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
    case "swap":
      return [
        { slotIndex: step.fromIndex, kind: "cursor" },
        { slotIndex: step.toIndex, kind: "placed" },
      ];
    case "place":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
  }
}

function activeHomeFor(step: HopscotchInsertStep | undefined): number | null {
  if (!step) return null;
  switch (step.kind) {
    case "hash":
    case "scan":
    case "duplicate":
    case "swap":
    case "place":
      return step.home;
    default:
      return null;
  }
}

function annotationFor(step: HopscotchInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "hash":
      return `hash(${step.insertingKey}) % ${step.table.capacity} = ${step.home}`;
    case "scan":
      return `Scan: slot ${step.slotIndex} occupied, advance (distance ${step.distance + 1})`;
    case "duplicate":
      return `${step.insertingKey} already at slot ${step.slotIndex} — skip`;
    case "swap":
      return `Swap: key ${step.pulledKey} (home ${step.pulledHome}) ${step.fromIndex} → ${step.toIndex} — empty walks back`;
    case "place":
      return `Placed ${step.insertingKey} at slot ${step.slotIndex} (distance ${step.distance} from home)`;
    case "done":
      return "Done";
  }
}

function countScans(steps: readonly HopscotchInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "scan") n++;
  return n;
}

function countSwaps(steps: readonly HopscotchInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "swap") n++;
  return n;
}

function countPlaced(steps: readonly HopscotchInsertStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "place") n++;
  return n;
}

export function HopscotchInsertViz({ initialSpeedMs = 450 }: HopscotchInsertVizProps) {
  const steps = useMemo<readonly HopscotchInsertStep[]>(
    () => [...hopscotchInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const table: HopscotchSnapshot = currentStep?.table ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const activeHome = activeHomeFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const scans = countScans(visibleSteps);
  const swaps = countSwaps(visibleSteps);
  const placed = countPlaced(visibleSteps);

  return (
    <section
      aria-label="Hopscotch insert"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Inserting {INSERT_SEQUENCE.join(", ")} into {CAPACITY} slots (neighborhood H = 4)
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <HopscotchView
          table={table}
          highlights={highlights}
          activeHome={activeHome}
          className="w-full"
        />
        <CodePanel
          source={hopscotchInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Hopscotch insert pseudocode"
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
          <dt className="text-xs text-zinc-500">Scans</dt>
          <dd className="font-mono text-lg">{scans}</dd>
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
