"use client";

import { useMemo } from "react";
import { insertSequence } from "@/lib/dataStructures/hashTable";
import { hashTableInsertPython } from "@/lib/dataStructures/hashTableInsert.snippet";
import type { HashTableKV, HashTableSnapshot, HashTableStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { HashTableView, type HashCellHighlight } from "./HashTableView";

// Curated to show collisions building up in bucket 5, a smaller chain in
// bucket 4, and an OVERWRITE on the second put with key 5 (map semantics —
// the duplicate key replaces the existing value rather than getting
// dropped). Pairs are (key, value); think of them as (player_id, score).
//   (5, 100)  → b5
//   (13, 250) → b5 (collide)
//   (21, 75)  → b5 (collide again)
//   (4, 200)  → b4
//   (12, 90)  → b4 (collide)
//   (5, 150)  → OVERWRITE the existing key=5 entry's value 100 → 150
//   (7, 175)  → b7
const INSERT_SEQUENCE: readonly HashTableKV[] = [
  [5, 100],
  [13, 250],
  [21, 75],
  [4, 200],
  [12, 90],
  [5, 150],
  [7, 175],
] as const;
const EMPTY: HashTableSnapshot = {
  capacity: 8,
  entries: [],
  buckets: Array.from({ length: 8 }, () => []),
};
const insertLabel = (kv: HashTableKV) => `(${kv[0]}, ${kv[1]})`;

export type HashTableInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HashTableStep | undefined): HashCellHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "hash":
    case "done":
      return [];
    case "probe":
      return [{ entryId: step.cursorEntryId, kind: "cursor" }];
    case "overwrite":
      // The entry's value was just replaced — paint it the "placed"
      // yellow so the user can read it as "the new value lives here."
      // (Same color we use for fresh placements; the annotation text
      // tells the user it was an overwrite rather than a brand-new
      // entry.)
      return [{ entryId: step.cursorEntryId, kind: "placed" }];
    case "place":
      return [{ entryId: step.newEntryId, kind: "placed" }];
  }
}

function activeBucketFor(step: HashTableStep | undefined): number | undefined {
  if (!step) return undefined;
  if ("bucketIndex" in step) return step.bucketIndex;
  return undefined;
}

function ghostBucketFor(step: HashTableStep | undefined): number | null {
  if (!step) return null;
  // After hashing but before deciding place vs duplicate, hint at where the
  // key will land if it isn't already present.
  if (step.kind === "hash") return step.bucketIndex;
  if (step.kind === "probe") return step.bucketIndex;
  return null;
}

function annotationFor(step: HashTableStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `put(${step.insertingKey}, ${step.insertingValue})`;
    case "hash":
      return `hash(${step.insertingKey}) % 8 = ${step.bucketIndex}`;
    case "probe": {
      const cursor = step.table.entries[step.cursorEntryId];
      return `Probing key ${cursor.key} (value ${cursor.value}) in bucket ${step.bucketIndex}`;
    }
    case "overwrite":
      return `Key ${step.insertingKey} already present — overwrite value ${step.oldValue} → ${step.insertingValue}`;
    case "place": {
      const entry = step.table.entries[step.newEntryId];
      return `Placed (${entry.key}, ${entry.value}) in bucket ${step.bucketIndex}`;
    }
    case "done":
      return "Done";
  }
}

function countProbes(steps: readonly HashTableStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "probe") n++;
  return n;
}

function countPlaced(steps: readonly HashTableStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "place") n++;
  return n;
}

function countOverwrites(steps: readonly HashTableStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "overwrite") n++;
  return n;
}

export function HashTableInsertViz({ initialSpeedMs = 400 }: HashTableInsertVizProps) {
  const steps = useMemo<readonly HashTableStep[]>(() => [...insertSequence(INSERT_SEQUENCE)], []);

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const table = currentStep?.table ?? EMPTY;
  const highlights = highlightsFor(currentStep);
  const activeBucketIndex = activeBucketFor(currentStep);
  const ghostBucketIndex = ghostBucketFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const probes = countProbes(visibleSteps);
  const placed = countPlaced(visibleSteps);
  const overwrites = countOverwrites(visibleSteps);

  return (
    <section
      aria-label="Hash table insert"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Putting {INSERT_SEQUENCE.map(insertLabel).join(", ")} into 8 buckets
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <HashTableView
          table={table}
          highlights={highlights}
          activeBucketIndex={activeBucketIndex}
          ghostBucketIndex={ghostBucketIndex}
          className="w-full"
        />
        <CodePanel
          source={hashTableInsertPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Hash table insert pseudocode"
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
          <dt className="text-xs text-zinc-500">Placed</dt>
          <dd className="font-mono text-lg">{placed}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Overwrites</dt>
          <dd className="font-mono text-lg">{overwrites}</dd>
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
