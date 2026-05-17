"use client";

import { useMemo } from "react";
import {
  buildCuckooFilter,
  cuckooFilterAlt,
  cuckooFilterDeleteSequence,
  cuckooFilterFingerprint,
  cuckooFilterHome,
} from "@/lib/dataStructures/cuckooFilter";
import { cuckooFilterDeletePython } from "@/lib/dataStructures/cuckooFilterDelete.snippet";
import type { CuckooFilterDeleteStep, CuckooFilterSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { CuckooFilterView, type CuckooFilterHighlight } from "./CuckooFilterView";

const CAPACITY = 8;
const INSERT_SEQUENCE = [5, 0, 7, 13] as const;
// Two-target delete demo:
//   13 → fp=7, h₁=5, alt=0. T[5]=fp=7 matches → clear. One check, one removed.
//   99 → fp=2, h₁=3, alt=5. T[3] empty, T[5] now empty too → miss.
const DELETE_TARGETS = [13, 99] as const;

export type CuckooFilterDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooFilterDeleteStep | undefined): CuckooFilterHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "fingerprint":
    case "miss":
    case "done":
      return [];
    case "hash":
      return [
        { slotIndex: step.home, kind: "cursor" },
        { slotIndex: step.alt, kind: "cursor" },
      ];
    case "check":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
    case "remove":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
  }
}

function annotationFor(step: CuckooFilterDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Deleting ${step.targetKey}`;
    case "fingerprint":
      return `Fingerprint of ${step.targetKey} = ${step.fingerprint}`;
    case "hash":
      return `h₁ = ${step.home}, alt = ${step.alt}`;
    case "check": {
      const phaseDesc = step.phase === "home" ? "home" : "alternate";
      const slot = step.table.slots[step.slotIndex];
      const desc =
        slot.state === "occupied"
          ? slot.fingerprint === step.fingerprint
            ? `holds fp=${slot.fingerprint} — match`
            : `holds fp=${slot.fingerprint}`
          : "empty";
      return `Check ${phaseDesc} T[${step.slotIndex}]: ${desc}`;
    }
    case "found":
      return `Matching fp=${step.fingerprint} at T[${step.slotIndex}]`;
    case "remove":
      return `Cleared T[${step.slotIndex}] — no tombstone needed`;
    case "miss":
      return `${step.targetKey} not in filter — nothing to remove`;
    case "done":
      return "Done";
  }
}

function countKind(
  steps: readonly CuckooFilterDeleteStep[],
  kind: CuckooFilterDeleteStep["kind"],
): number {
  let n = 0;
  for (const s of steps) if (s.kind === kind) n++;
  return n;
}

export function CuckooFilterDeleteViz({ initialSpeedMs = 400 }: CuckooFilterDeleteVizProps) {
  const initial = useMemo<CuckooFilterSnapshot>(
    () => buildCuckooFilter(CAPACITY, INSERT_SEQUENCE),
    [],
  );
  const steps = useMemo<readonly CuckooFilterDeleteStep[]>(
    () => [...cuckooFilterDeleteSequence(initial, DELETE_TARGETS)],
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
  const removed = countKind(visibleSteps, "remove");
  const misses = countKind(visibleSteps, "miss");

  const legend = DELETE_TARGETS.map((k) => {
    const fp = cuckooFilterFingerprint(k);
    const home = cuckooFilterHome(k, CAPACITY);
    const alt = cuckooFilterAlt(home, fp, CAPACITY);
    return `${k}: fp=${fp}, h₁=${home}, alt=${alt}`;
  }).join(" · ");

  return (
    <section
      aria-label="Cuckoo filter delete"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">{legend}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <CuckooFilterView table={table} highlights={highlights} className="w-full" />
        <CodePanel
          source={cuckooFilterDeletePython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Cuckoo filter delete pseudocode"
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
