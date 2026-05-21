"use client";

import { useMemo, useState } from "react";
import {
  sortAlgorithmKeys,
  sortAlgorithmLabels,
  sortAlgorithms,
  type SortAlgorithmKey,
} from "@/lib/algorithms";
import type { SortStep } from "@/lib/algorithms/types";
import { useParallelStepThrough } from "@/lib/hooks/useParallelStepThrough";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { fnv1a, makeSeededArray } from "@/lib/seededArray";
import { ArrayBars } from "./ArrayBars";
import { Controls } from "./Controls";
import { activeRangeFor, countCompares, countSwapsAndWrites, highlightsFor } from "./stepView";

export type RaceVizProps = {
  initial?: readonly SortAlgorithmKey[];
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  initialSpeedMs?: number;
};

const DEFAULT_INITIAL: readonly SortAlgorithmKey[] = ["bubble", "merge", "quick"];

export function RaceViz({
  initial = DEFAULT_INITIAL,
  initialSize = 16,
  minSize = 4,
  maxSize = 60,
  initialSpeedMs = 200,
}: RaceVizProps) {
  const [algorithms, setAlgorithms] = useState<readonly SortAlgorithmKey[]>(initial);
  const [size, setSize] = useState(initialSize);
  // Deterministic seed so SSR and first client paint agree on the input array.
  // User-driven size or algorithm changes happen post-hydration and may reseed.
  const [seed, setSeed] = useState(() => fnv1a(`race:${initialSize}:${initial.join(",")}`));

  const input = useMemo(() => makeSeededArray(size, seed), [size, seed]);
  const stepsList = useMemo<readonly (readonly SortStep[])[]>(
    () => algorithms.map((key) => [...sortAlgorithms[key](input)]),
    [algorithms, input],
  );
  const totals = useMemo(() => stepsList.map((s) => s.length), [stepsList]);
  const max = useMemo(() => Math.max(...input, 1), [input]);

  const reducedMotion = useReducedMotion();
  const playback = useParallelStepThrough(totals, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const handleSizeChange = (next: number) => {
    setSize(next);
    setSeed(Math.floor(Math.random() * 0xffffffff));
    playback.reset();
  };

  const handleAlgorithmChange = (slot: number, key: SortAlgorithmKey) => {
    setAlgorithms((prev) => prev.map((p, i) => (i === slot ? key : p)));
    playback.reset();
  };

  const canStepBack = playback.indexes.some((i) => i > -1);
  const canStepForward = playback.indexes.some((i, slot) => {
    const total = totals[slot] ?? 0;
    return total > 0 && i < total - 1;
  });

  return (
    <section
      aria-label="Sorting algorithm race"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <ul role="list" className="grid gap-4 md:grid-cols-3">
        {algorithms.map((key, slot) => {
          const steps = stepsList[slot] ?? [];
          const total = totals[slot] ?? 0;
          const idx = playback.indexes[slot] ?? -1;
          const step = idx >= 0 ? steps[idx] : undefined;
          const visible = idx >= 0 ? steps.slice(0, idx + 1) : [];
          const compares = countCompares(visible);
          const swaps = countSwapsAndWrites(visible);
          const displayArray = step?.array ?? input;
          const finished = total > 0 && idx >= total - 1;
          const slotLabel = `${sortAlgorithmLabels[key]} race slot`;

          return (
            <li
              key={`${slot}-${key}`}
              aria-label={slotLabel}
              className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Slot {slot + 1}
                </span>
                <select
                  aria-label={`Algorithm for slot ${slot + 1}`}
                  value={key}
                  onChange={(e) => handleAlgorithmChange(slot, e.target.value as SortAlgorithmKey)}
                  className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {sortAlgorithmKeys.map((k) => (
                    <option key={k} value={k}>
                      {sortAlgorithmLabels[k]}
                    </option>
                  ))}
                </select>
              </div>

              <ArrayBars
                array={displayArray}
                highlights={highlightsFor(step)}
                activeRange={activeRangeFor(step)}
                max={max}
                className="h-32 w-full"
              />

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded border border-zinc-200 p-1.5 dark:border-zinc-800">
                  <dt className="text-[10px] tracking-wide text-zinc-500 uppercase">Step</dt>
                  <dd className="font-mono">
                    {Math.max(idx + 1, 0)}/{total}
                  </dd>
                </div>
                <div className="rounded border border-zinc-200 p-1.5 dark:border-zinc-800">
                  <dt className="text-[10px] tracking-wide text-zinc-500 uppercase">Compares</dt>
                  <dd className="font-mono">{compares}</dd>
                </div>
                <div className="rounded border border-zinc-200 p-1.5 dark:border-zinc-800">
                  <dt className="text-[10px] tracking-wide text-zinc-500 uppercase">Swaps</dt>
                  <dd className="font-mono">{swaps}</dd>
                </div>
              </dl>

              {finished ? (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Sorted in {total} steps
                </p>
              ) : (
                <p className="text-xs text-zinc-500">
                  {total > 0 ? `${total - (idx + 1)} steps remaining` : "no work to do"}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Controls
        status={playback.status}
        speed={playback.speed}
        arraySize={size}
        reducedMotion={reducedMotion}
        canStepBack={canStepBack}
        canStepForward={canStepForward}
        onPlay={playback.play}
        onPause={playback.pause}
        onStepBack={playback.stepBackward}
        onStepForward={playback.stepForward}
        onReset={playback.reset}
        onRunToCompletion={playback.runToCompletion}
        onSpeedChange={playback.setSpeed}
        onArraySizeChange={handleSizeChange}
        minArraySize={minSize}
        maxArraySize={maxSize}
      />
    </section>
  );
}
