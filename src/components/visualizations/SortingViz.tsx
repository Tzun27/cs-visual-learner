"use client";

import { useMemo, useState } from "react";
import { sortAlgorithms, type SortAlgorithmKey } from "@/lib/algorithms";
import type { SortStep } from "@/lib/algorithms/types";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { ArrayBars } from "./ArrayBars";
import { Controls } from "./Controls";
import { activeRangeFor, countCompares, countSwapsAndWrites, highlightsFor } from "./stepView";

export type SortingVizProps = {
  algorithm: SortAlgorithmKey;
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  initialSpeedMs?: number;
};

function deterministicSeed(algorithm: string, size: number): number {
  let h = 2166136261 >>> 0;
  const key = `${algorithm}:${size}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

function makeRandomArray(size: number, seed: number): number[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  return Array.from({ length: size }, (_, i) => Math.floor(rand() * 90) + i + 1)
    .map((value) => ({ value, key: rand() }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.value);
}

export function SortingViz({
  algorithm,
  initialSize = 16,
  minSize = 4,
  maxSize = 60,
  initialSpeedMs = 200,
}: SortingVizProps) {
  const [size, setSize] = useState(initialSize);
  // Deterministic initial seed so SSR and client hydration agree on the array.
  // We re-seed (with Math.random) only in response to user actions like resizing,
  // which happen post-hydration and are therefore safe.
  const [seed, setSeed] = useState(() => deterministicSeed(algorithm, initialSize));

  const algorithmFn = sortAlgorithms[algorithm];
  const input = useMemo(() => makeRandomArray(size, seed), [size, seed]);
  const steps = useMemo<readonly SortStep[]>(() => [...algorithmFn(input)], [algorithmFn, input]);

  const reducedMotion = useReducedMotion();

  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const displayArray = playback.currentStep?.array ?? input;
  const max = useMemo(() => Math.max(...input, 1), [input]);
  const highlights = highlightsFor(playback.currentStep);
  const activeRange = activeRangeFor(playback.currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const compares = countCompares(visibleSteps);
  const swaps = countSwapsAndWrites(visibleSteps);

  const handleSizeChange = (next: number) => {
    setSize(next);
    setSeed(Math.floor(Math.random() * 0xffffffff));
    playback.reset();
  };

  return (
    <section
      aria-label="Sorting visualization"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <ArrayBars
        array={displayArray}
        highlights={highlights}
        activeRange={activeRange}
        max={max}
        className="h-48 w-full"
      />

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Comparisons</dt>
          <dd className="font-mono text-lg">{compares}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Swaps</dt>
          <dd className="font-mono text-lg">{swaps}</dd>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <dt className="text-xs text-zinc-500">Status</dt>
          <dd className="font-mono text-lg capitalize">{playback.status}</dd>
        </div>
      </dl>

      <Controls
        status={playback.status}
        speed={playback.speed}
        arraySize={size}
        reducedMotion={reducedMotion}
        canStepBack={playback.stepIndex > -1}
        canStepForward={playback.stepIndex < steps.length - 1}
        onPlay={playback.play}
        onPause={playback.pause}
        onStepBack={playback.stepBackward}
        onStepForward={playback.stepForward}
        onReset={playback.reset}
        onSpeedChange={playback.setSpeed}
        onArraySizeChange={handleSizeChange}
        minArraySize={minSize}
        maxArraySize={maxSize}
      />
    </section>
  );
}
