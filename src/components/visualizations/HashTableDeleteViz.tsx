"use client";

import { useMemo } from "react";
import { buildHashTable, deleteSequence } from "@/lib/dataStructures/hashTable";
import { hashTableDeletePython } from "@/lib/dataStructures/hashTableDelete.snippet";
import type { HashTableDeleteStep } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { HashTableView, type HashCellHighlight } from "./HashTableView";

// Pre-built table: bucket 1 = [1, 9, 17, 25], bucket 2 = [2].
const BUILD_KEYS = [1, 9, 17, 25, 2] as const;
// 9  → middle of chain;  25 → tail of chain;  1 → head of chain;
// 99 → miss in an empty bucket (no probes).
const DELETE_TARGETS = [9, 25, 1, 99] as const;

export type HashTableDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HashTableDeleteStep | undefined): HashCellHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "hash":
    case "miss":
    case "unlink":
    case "done":
      return [];
    case "probe":
      return [{ entryId: step.cursorEntryId, kind: "cursor" }];
    case "found":
      return [{ entryId: step.cursorEntryId, kind: "duplicate" }];
  }
}

function activeBucketFor(step: HashTableDeleteStep | undefined): number | undefined {
  if (!step) return undefined;
  if ("bucketIndex" in step) return step.bucketIndex;
  return undefined;
}

function annotationFor(step: HashTableDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Removing ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % 8 = ${step.bucketIndex}`;
    case "probe": {
      const cursor = step.table.entries[step.cursorEntryId];
      return `Probing ${cursor.key} in bucket ${step.bucketIndex}`;
    }
    case "found":
      return `Found ${step.targetKey}`;
    case "unlink":
      return `Removed ${step.targetKey} from bucket ${step.bucketIndex}`;
    case "miss":
      return `${step.targetKey} not in bucket ${step.bucketIndex}`;
    case "done":
      return "Done";
  }
}

function countProbes(steps: readonly HashTableDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "probe") n++;
  return n;
}

function countUnlinks(steps: readonly HashTableDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "unlink") n++;
  return n;
}

function countMisses(steps: readonly HashTableDeleteStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "miss") n++;
  return n;
}

export function HashTableDeleteViz({ initialSpeedMs = 400 }: HashTableDeleteVizProps) {
  const initial = useMemo(() => buildHashTable(BUILD_KEYS), []);
  const steps = useMemo<readonly HashTableDeleteStep[]>(
    () => [...deleteSequence(initial, DELETE_TARGETS)],
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
  const unlinks = countUnlinks(visibleSteps);
  const misses = countMisses(visibleSteps);

  return (
    <section
      aria-label="Hash table delete"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Removing {DELETE_TARGETS.join(", ")}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <HashTableView
          table={table}
          highlights={highlights}
          activeBucketIndex={activeBucketIndex}
          className="w-full"
        />
        <CodePanel
          source={hashTableDeletePython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Hash table delete pseudocode"
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
          <dt className="text-xs text-zinc-500">Removed</dt>
          <dd className="font-mono text-lg">{unlinks}</dd>
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
