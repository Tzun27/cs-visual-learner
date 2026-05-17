"use client";

import { useMemo } from "react";
import {
  cuckooFilterAlt,
  cuckooFilterFingerprint,
  cuckooFilterHome,
  cuckooFilterInsertSequence,
  emptyCuckooFilter,
} from "@/lib/dataStructures/cuckooFilter";
import { cuckooFilterInsertPython } from "@/lib/dataStructures/cuckooFilterInsert.snippet";
import type { CuckooFilterInsertStep, CuckooFilterSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { CuckooFilterView, type CuckooFilterHighlight } from "./CuckooFilterView";

const CAPACITY = 8;
// Curated cascade: [5, 0, 7] place directly via the home-check path;
// 13 triggers a two-step eviction cascade — its primary and alternate
// slots are both occupied, the eviction at home displaces fp=6 which
// finds its alternate also occupied, displaces fp=1 which lands at the
// empty T[4]. Final: T = [1, _, _, _, 1, 7, _, 6].
const INSERT_SEQUENCE = [5, 0, 7, 13] as const;
const INITIAL = emptyCuckooFilter(CAPACITY);

export type CuckooFilterInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooFilterInsertStep | undefined): CuckooFilterHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "fingerprint":
    case "done":
    case "cycle":
      return [];
    case "hash":
      return [
        { slotIndex: step.home, kind: "cursor" },
        { slotIndex: step.alt, kind: "cursor" },
      ];
    case "check":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "place":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "evict":
      // Dual highlight per cuckoo-hashing decision 44: placed = where
      // the active fp now lives; cursor = next slot the displaced fp
      // will inspect.
      return [
        { slotIndex: step.slotIndex, kind: "placed" },
        { slotIndex: step.nextSlotIndex, kind: "cursor" },
      ];
  }
}

function annotationFor(step: CuckooFilterInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "fingerprint":
      return `Fingerprint of ${step.insertingKey} = ${step.fingerprint}`;
    case "hash":
      return `h₁ = ${step.home}, alt = h₁ ⊕ hashFp(${step.fingerprint}) = ${step.alt}`;
    case "check": {
      const phaseDesc =
        step.phase === "home" ? "home" : step.phase === "alt" ? "alternate" : "cascade alternate";
      const slot = step.table.slots[step.slotIndex];
      const desc =
        slot.state === "occupied"
          ? slot.fingerprint === step.activeFingerprint
            ? `holds fp=${slot.fingerprint} (same fingerprint — collision)`
            : `holds fp=${slot.fingerprint}`
          : "empty";
      return `Check ${phaseDesc} slot T[${step.slotIndex}]: ${desc}`;
    }
    case "place":
      return `Placed fp=${step.placedFingerprint} at T[${step.slotIndex}]`;
    case "evict":
      return `Evict T[${step.slotIndex}]: store fp=${step.placedFingerprint}, fp=${step.evictedFingerprint} now heading to T[${step.nextSlotIndex}]`;
    case "cycle":
      return `Cycle while inserting ${step.insertingKey} — rehash required`;
    case "done":
      return "Done";
  }
}

function countKind(
  steps: readonly CuckooFilterInsertStep[],
  kind: CuckooFilterInsertStep["kind"],
): number {
  let n = 0;
  for (const s of steps) if (s.kind === kind) n++;
  return n;
}

export function CuckooFilterInsertViz({ initialSpeedMs = 400 }: CuckooFilterInsertVizProps) {
  const steps = useMemo<readonly CuckooFilterInsertStep[]>(
    () => [...cuckooFilterInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const table: CuckooFilterSnapshot = currentStep?.table ?? INITIAL;
  const highlights = highlightsFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const placed = countKind(visibleSteps, "place");
  const evictions = countKind(visibleSteps, "evict");

  const legend = INSERT_SEQUENCE.map((k) => {
    const fp = cuckooFilterFingerprint(k);
    const home = cuckooFilterHome(k, CAPACITY);
    const alt = cuckooFilterAlt(home, fp, CAPACITY);
    return `${k}: fp=${fp}, h₁=${home}, alt=${alt}`;
  }).join(" · ");

  return (
    <section
      aria-label="Cuckoo filter insert"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">{legend}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <CuckooFilterView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={cuckooFilterInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Cuckoo filter insert pseudocode"
        />
      </div>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation ?? "Idle — press play or step forward."}
      </p>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Placed</dt>
          <dd className="font-mono text-lg">{placed}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Evictions</dt>
          <dd className="font-mono text-lg">{evictions}</dd>
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
