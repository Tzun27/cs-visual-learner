"use client";

import { useMemo } from "react";
import {
  buildCuckooTable,
  cuckooHash1,
  cuckooHash2,
  cuckooSearchSequence,
} from "@/lib/dataStructures/cuckoo";
import { cuckooSearchPython } from "@/lib/dataStructures/cuckooSearch.snippet";
import type { CuckooSearchStep, CuckooSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { CuckooView, type CuckooHighlight } from "./CuckooView";

const CAPACITY = 7;
const INSERT_SEQUENCE = [5, 0, 12, 14] as const;

// Targets cover all four search outcomes:
//   5  → T_A[5] hit in one check
//   12 → T_A[5] miss (holds 5), T_B[1] hit in two checks (worst case)
//   0  → T_A[0] miss (holds 14), T_B[0] hit in two checks
//   99 → T_A[1] empty, T_B[0] miss (holds 0), miss after two checks
const SEARCH_TARGETS = [5, 12, 0, 99] as const;

export type CuckooSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooSearchStep | undefined): CuckooHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
      return [
        { side: "A", slotIndex: step.home1, kind: "cursor" },
        { side: "B", slotIndex: step.home2, kind: "cursor" },
      ];
    case "check":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      // No specific slot to fault — both candidates were checked. Leave
      // highlights empty so the annotation carries the message.
      return [];
  }
}

function annotationFor(step: CuckooSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetKey}`;
    case "hash":
      return `h₁(${step.targetKey}) = ${step.home1}, h₂(${step.targetKey}) = ${step.home2}`;
    case "check": {
      const slot =
        step.side === "A" ? step.table.slotsA[step.slotIndex] : step.table.slotsB[step.slotIndex];
      const desc =
        slot.state === "occupied"
          ? slot.key === step.targetKey
            ? `holds ${slot.key} — match`
            : `holds ${slot.key}`
          : "empty";
      return `Check T_${step.side}[${step.slotIndex}]: ${desc}`;
    }
    case "found":
      return `Found ${step.targetKey} at T_${step.side}[${step.slotIndex}]`;
    case "miss":
      return `${step.targetKey} not in either candidate slot — miss`;
    case "done":
      return "Done";
  }
}

function countKind(steps: readonly CuckooSearchStep[], kind: CuckooSearchStep["kind"]): number {
  let n = 0;
  for (const s of steps) if (s.kind === kind) n++;
  return n;
}

export function CuckooSearchViz({ initialSpeedMs = 400 }: CuckooSearchVizProps) {
  const initial = useMemo<CuckooSnapshot>(() => buildCuckooTable(CAPACITY, INSERT_SEQUENCE), []);
  const steps = useMemo<readonly CuckooSearchStep[]>(
    () => [...cuckooSearchSequence(initial, SEARCH_TARGETS)],
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
  const lookups = countKind(visibleSteps, "check");
  const found = countKind(visibleSteps, "found");
  const misses = countKind(visibleSteps, "miss");

  const legend = SEARCH_TARGETS.map(
    (k) => `${k} (h₁=${cuckooHash1(k, CAPACITY)}, h₂=${cuckooHash2(k, CAPACITY)})`,
  ).join(", ");

  return (
    <section
      aria-label="Cuckoo search"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">{legend}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <CuckooView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={cuckooSearchPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Cuckoo search pseudocode"
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
          <dt className="text-xs text-zinc-500">Lookups</dt>
          <dd className="font-mono text-lg">{lookups}</dd>
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
