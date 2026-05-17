"use client";

import { useMemo } from "react";
import {
  cuckooHash1,
  cuckooHash2,
  cuckooInsertSequence,
  emptyCuckooTable,
} from "@/lib/dataStructures/cuckoo";
import { cuckooInsertPython } from "@/lib/dataStructures/cuckooInsert.snippet";
import type { CuckooInsertStep, CuckooSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { CuckooView, type CuckooHighlight } from "./CuckooView";

const CAPACITY = 7;
// Curated cascade: [5, 0] place directly; 12 triggers a 1-step swap; 14
// triggers a 3-step cascade (the lesson's hero — 14 displaces 0, which
// displaces 5, which displaces 12, which lands cleanly). Final insert
// (5 again) exercises the T_A dedup-check short-circuit.
const INSERT_SEQUENCE = [5, 0, 12, 14, 5] as const;
const INITIAL = emptyCuckooTable(CAPACITY);

export type CuckooInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooInsertStep | undefined): CuckooHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
    case "cycle":
      return [];
    case "hash":
      return [
        { side: "A", slotIndex: step.home1, kind: "cursor" },
        { side: "B", slotIndex: step.home2, kind: "cursor" },
      ];
    case "dedup-check":
    case "check":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "cursor" }];
    case "duplicate":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "duplicate" }];
    case "place":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "placed" }];
    case "evict":
      // Dual highlight (per decision 39 convention): `placed` = active key
      // now lives here; `cursor` = next slot the evicted key will inspect.
      return [
        { side: step.side, slotIndex: step.slotIndex, kind: "placed" },
        { side: step.nextSide, slotIndex: step.nextSlotIndex, kind: "cursor" },
      ];
  }
}

function annotationFor(step: CuckooInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "hash":
      return `h₁(${step.insertingKey}) = ${step.home1}, h₂(${step.insertingKey}) = ${step.home2}`;
    case "dedup-check":
      return `Dedup: T_${step.side}[${step.slotIndex}] holds the existing key for ${step.insertingKey}?`;
    case "duplicate":
      return `${step.insertingKey} already present at T_${step.side}[${step.slotIndex}] — skip`;
    case "check":
      return `Try T_${step.side}[${step.slotIndex}] for ${step.activeKey}`;
    case "place":
      return `Placed ${step.placedKey} at T_${step.side}[${step.slotIndex}]`;
    case "evict":
      return `Swap: ${step.placedKey} into T_${step.side}[${step.slotIndex}], ${step.evictedKey} bumped → T_${step.nextSide}[${step.nextSlotIndex}]`;
    case "cycle":
      return `Cycle while inserting ${step.insertingKey} — rehash required`;
    case "done":
      return "Done";
  }
}

function countKind(steps: readonly CuckooInsertStep[], kind: CuckooInsertStep["kind"]): number {
  let n = 0;
  for (const s of steps) if (s.kind === kind) n++;
  return n;
}

export function CuckooInsertViz({ initialSpeedMs = 400 }: CuckooInsertVizProps) {
  const steps = useMemo<readonly CuckooInsertStep[]>(
    () => [...cuckooInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const table: CuckooSnapshot = currentStep?.table ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const placed = countKind(visibleSteps, "place");
  const evictions = countKind(visibleSteps, "evict");
  const duplicates = countKind(visibleSteps, "duplicate");

  // Quick legend of the (h1, h2) pairs so users can verify what they see.
  const legend = INSERT_SEQUENCE.map(
    (k) => `${k} (h₁=${cuckooHash1(k, CAPACITY)}, h₂=${cuckooHash2(k, CAPACITY)})`,
  ).join(", ");

  return (
    <section
      aria-label="Cuckoo insert"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">{legend}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <CuckooView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={cuckooInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Cuckoo insert pseudocode"
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
          <dt className="text-xs text-zinc-500">Placed</dt>
          <dd className="font-mono text-lg">{placed}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Evictions</dt>
          <dd className="font-mono text-lg">{evictions}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Duplicates</dt>
          <dd className="font-mono text-lg">{duplicates}</dd>
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
