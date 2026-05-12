"use client";

import { useMemo } from "react";
import { buildHashTable, searchSequence } from "@/lib/dataStructures/hashTable";
import { hashTableSearchPython } from "@/lib/dataStructures/hashTableSearch.snippet";
import type { HashTableKV, HashTableSearchStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { HashTableView, type HashCellHighlight } from "./HashTableView";

// Pre-built table:
//   bucket 1 = [(1, 10), (9, 90), (17, 170)]
//   bucket 2 = [(2, 20), (50, 500)]
// Values are 10× the key for easy mental verification — the user can sanity
// check "I asked for key 17 and got value 170" without external context.
const BUILD_PAIRS: readonly HashTableKV[] = [
  [1, 10],
  [9, 90],
  [17, 170],
  [2, 20],
  [50, 500],
] as const;
// 1  → head-of-chain hit; 17 → end-of-chain hit (3 probes);
// 50 → end-of-chain hit in a smaller bucket;
// 25 → miss after probing a non-empty bucket;
// 3  → miss against an empty bucket (0 probes).
const SEARCH_TARGETS = [1, 17, 50, 25, 3] as const;

export type HashTableSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HashTableSearchStep | undefined): HashCellHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "hash":
    case "miss":
    case "done":
      return [];
    case "probe":
      return [{ entryId: step.cursorEntryId, kind: "cursor" }];
    case "found":
      return [{ entryId: step.cursorEntryId, kind: "placed" }];
  }
}

function activeBucketFor(step: HashTableSearchStep | undefined): number | undefined {
  if (!step) return undefined;
  if ("bucketIndex" in step) return step.bucketIndex;
  return undefined;
}

function annotationFor(step: HashTableSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `get(${step.targetKey})`;
    case "hash":
      return `hash(${step.targetKey}) % 8 = ${step.bucketIndex}`;
    case "probe": {
      const cursor = step.table.entries[step.cursorEntryId];
      return `Probing key ${cursor.key} (value ${cursor.value}) in bucket ${step.bucketIndex}`;
    }
    case "found":
      return `Found key ${step.targetKey} → value ${step.foundValue}`;
    case "miss":
      return `${step.targetKey} not in bucket ${step.bucketIndex} → None`;
    case "done":
      return "Done";
  }
}

function countProbes(steps: readonly HashTableSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "probe") n++;
  return n;
}

function countFound(steps: readonly HashTableSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "found") n++;
  return n;
}

function countMisses(steps: readonly HashTableSearchStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "miss") n++;
  return n;
}

export function HashTableSearchViz({ initialSpeedMs = 400 }: HashTableSearchVizProps) {
  const initial = useMemo(() => buildHashTable(BUILD_PAIRS), []);
  const steps = useMemo<readonly HashTableSearchStep[]>(
    () => [...searchSequence(initial, SEARCH_TARGETS)],
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
  const activeBucketIndex = activeBucketFor(currentStep);
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const probes = countProbes(visibleSteps);
  const found = countFound(visibleSteps);
  const misses = countMisses(visibleSteps);

  return (
    <section
      aria-label="Hash table search"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        get({SEARCH_TARGETS.join("), get(")})
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <HashTableView
          table={table}
          highlights={highlights}
          activeBucketIndex={activeBucketIndex}
          className="w-full"
        />
        <CodePanel
          source={hashTableSearchPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Hash table search pseudocode"
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
