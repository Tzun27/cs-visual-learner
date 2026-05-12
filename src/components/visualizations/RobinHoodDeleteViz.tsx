"use client";

import { useMemo } from "react";
import { buildRobinHoodTable, robinHoodDeleteSequence } from "@/lib/dataStructures/robinHood";
import { robinHoodDeletePython } from "@/lib/dataStructures/robinHoodDelete.snippet";
import type { LinearProbeSnapshot, RobinHoodDeleteStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;

// Start from the Robin Hood insert demo's end state: 5@5, 13@6, 14@7, 22@0.
// Displacements: 5(+0), 13(+1), 14(+1), 22(+2).
function buildInitialTable(): LinearProbeSnapshot {
  return buildRobinHoodTable(CAPACITY, [5, 14, 13, 22]);
}

// Targets exercise the three branches the algorithm cares about:
//   13 → probe past 5 to find 13 at slot 6, then backshift pulls 14 and
//        22 toward home; the chain ends at empty slot 1 (clear slot 0).
//   5  → found directly at slot 5; the next slot (6) holds 14 which is
//        already at home (+0), so backshift does NOTHING and we just
//        clear slot 5. Demonstrates the at-home stop.
//   99 → home slot 3 is empty, so the search half reports a miss
//        immediately. No table changes.
const DELETE_TARGETS = [13, 5, 99] as const;

export type RobinHoodDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: RobinHoodDeleteStep | undefined): LinearProbeHighlight[] {
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
    case "pull":
      // Both the slot the key arrived at and the slot it left should
      // glow; `placed` is the "active" yellow, `cursor` is the "from".
      return [
        { slotIndex: step.toIndex, kind: "placed" },
        { slotIndex: step.fromIndex, kind: "cursor" },
      ];
    case "clear":
      // The newly-empty slot is colored placed; the blocker is dimmer
      // (cursor) so the user can see what stopped the chain.
      return [
        { slotIndex: step.clearedIndex, kind: "placed" },
        { slotIndex: step.blockerIndex, kind: "cursor" },
      ];
    case "miss":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: RobinHoodDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Deleting ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe":
      return `Slot occupied by another key — advance to slot ${step.slotIndex}`;
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}; start backshift`;
    case "pull":
      return `Pull ${step.pulledKey} from slot ${step.fromIndex} → slot ${step.toIndex}`;
    case "clear": {
      const why =
        step.blockerReason === "empty"
          ? `slot ${step.blockerIndex} is empty`
          : `key at slot ${step.blockerIndex} is already at home`;
      return `Clear slot ${step.clearedIndex} — ${why}, backshift stops`;
    }
    case "miss":
      return `Slot ${step.slotIndex} is empty → ${step.targetKey} not in table`;
    case "done":
      return "Done";
  }
}

function countProbes(steps: readonly RobinHoodDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "probe") n++;
  return n;
}

function countPulls(steps: readonly RobinHoodDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "pull") n++;
  return n;
}

function countRemoved(steps: readonly RobinHoodDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "clear") n++;
  return n;
}

export function RobinHoodDeleteViz({ initialSpeedMs = 450 }: RobinHoodDeleteVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly RobinHoodDeleteStep[]>(
    () => [...robinHoodDeleteSequence(initial, DELETE_TARGETS)],
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
  const pulls = countPulls(visibleSteps);
  const removed = countRemoved(visibleSteps);

  return (
    <section
      aria-label="Robin Hood delete"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Deleting {DELETE_TARGETS.join(", ")} via backshift — no tombstones produced
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <LinearProbeView
          table={table}
          highlights={highlights}
          showDisplacements
          className="w-full"
        />
        <CodePanel
          source={robinHoodDeletePython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Robin Hood delete pseudocode"
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
          <dt className="text-xs text-zinc-500">Pulls</dt>
          <dd className="font-mono text-lg">{pulls}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Removed</dt>
          <dd className="font-mono text-lg">{removed}</dd>
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
