"use client";

import { useMemo } from "react";
import { buildHopscotchTable, hopscotchSearchSequence } from "@/lib/dataStructures/hopscotch";
import { hopscotchSearchPython } from "@/lib/dataStructures/hopscotchSearch.snippet";
import type { HopscotchSearchStep, HopscotchSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import {
  HopscotchView,
  type HopscotchBitHighlight,
  type HopscotchHighlight,
} from "./HopscotchView";

const CAPACITY = 8;

// Same end state as the insert section: slots 0,1,2,3,4 → 0,16,8,9,1.
// hopInfo[0] = bits {0,1,2} (slots 0, 1, 2 hold keys with home 0);
// hopInfo[1] = bits {2,3} (slots 3, 4 hold keys with home 1).
function buildInitialTable(): HopscotchSnapshot {
  return buildHopscotchTable(CAPACITY, [0, 1, 8, 9, 16]);
}

// Targets exercise the four pedagogical cases for hopscotch lookup:
//   0  → home 0, mask bit 0 set, slot 0 = 0 → found in one check
//   16 → home 0, bit 0 (slot 0 = 0, ≠ 16), bit 1 (slot 1 = 16, = 16) → found
//   9  → home 1, bit 0 (clear), bit 1 (clear), bit 2 (slot 3 = 9, = 9) → found
//   99 → home 3, hopInfo[3] = 0; all four bit checks come back clear → miss
const SEARCH_TARGETS = [0, 16, 9, 99] as const;

export type HopscotchSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HopscotchSearchStep | undefined): HopscotchHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
      return [{ slotIndex: step.home, kind: "cursor" }];
    case "check-bit":
      // Highlight the slot the bit refers to (set or clear) so the reader
      // sees the bit ↔ slot mapping.
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      return [{ slotIndex: step.home, kind: "duplicate" }];
  }
}

function bitHighlightsFor(step: HopscotchSearchStep | undefined): HopscotchBitHighlight[] {
  if (!step) return [];
  if (step.kind === "check-bit") {
    return [{ homeIndex: step.home, bitIndex: step.bitIndex }];
  }
  return [];
}

function activeHomeFor(step: HopscotchSearchStep | undefined): number | null {
  if (!step) return null;
  switch (step.kind) {
    case "hash":
    case "check-bit":
    case "found":
    case "miss":
      return step.home;
    default:
      return null;
  }
}

function annotationFor(step: HopscotchSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % ${step.table.capacity} = ${step.home}; mask = 0b${step.hopMask.toString(2).padStart(step.table.neighborhood, "0")}`;
    case "check-bit": {
      const slot = step.table.slots[step.slotIndex];
      const slotDesc = slot.state === "occupied" ? `holds ${slot.key}` : "is empty";
      return step.isSet
        ? `Bit ${step.bitIndex} set → check slot ${step.slotIndex} (${slotDesc})`
        : `Bit ${step.bitIndex} clear → skip slot ${step.slotIndex}`;
    }
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}`;
    case "miss":
      return `Not found — no set bit produced a match`;
    case "done":
      return "Done";
  }
}

function countBitChecks(steps: readonly HopscotchSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "check-bit") n++;
  return n;
}

function countFound(steps: readonly HopscotchSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "found") n++;
  return n;
}

function countMisses(steps: readonly HopscotchSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "miss") n++;
  return n;
}

export function HopscotchSearchViz({ initialSpeedMs = 450 }: HopscotchSearchVizProps) {
  const initial = useMemo<HopscotchSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly HopscotchSearchStep[]>(
    () => [...hopscotchSearchSequence(initial, SEARCH_TARGETS)],
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
  const bitHighlights = bitHighlightsFor(currentStep);
  const activeHome = activeHomeFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const bitChecks = countBitChecks(visibleSteps);
  const found = countFound(visibleSteps);
  const misses = countMisses(visibleSteps);

  return (
    <section
      aria-label="Hopscotch search"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Searching {SEARCH_TARGETS.join(", ")} — lookups always look at at most{" "}
        {CAPACITY === 8 ? 4 : "H"} slots
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <HopscotchView
          table={table}
          highlights={highlights}
          bitHighlights={bitHighlights}
          activeHome={activeHome}
          className="w-full"
        />
        <CodePanel
          source={hopscotchSearchPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Hopscotch search pseudocode"
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
          <dt className="text-xs text-zinc-500">Bits checked</dt>
          <dd className="font-mono text-lg">{bitChecks}</dd>
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
