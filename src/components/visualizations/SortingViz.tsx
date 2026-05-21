"use client";

import { useMemo, useState } from "react";
import {
  sortAlgorithms,
  sortAlgorithmLabels,
  sortAlgorithmSnippets,
  type SortAlgorithmKey,
} from "@/lib/algorithms";
import type { SortStep } from "@/lib/algorithms/types";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { fnv1a, makeSeededArray } from "@/lib/seededArray";
import { ArrayBars } from "./ArrayBars";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { activeRangeFor, countCompares, countSwapsAndWrites, highlightsFor } from "./stepView";

export type SortingVizProps = {
  algorithm: SortAlgorithmKey;
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  initialSpeedMs?: number;
};

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
  const [seed, setSeed] = useState(() => fnv1a(`${algorithm}:${initialSize}`));

  const algorithmFn = sortAlgorithms[algorithm];
  const input = useMemo(() => makeSeededArray(size, seed), [size, seed]);
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
  const codeSnippet = sortAlgorithmSnippets[algorithm];
  const codeLines = playback.currentStep?.codeLines ?? [];

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
      <div
        className={
          codeSnippet
            ? "grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch"
            : "flex flex-col gap-4"
        }
      >
        <ArrayBars
          array={displayArray}
          highlights={highlights}
          activeRange={activeRange}
          max={max}
          className="h-48 w-full"
        />
        {codeSnippet && (
          <CodePanel
            source={codeSnippet}
            highlightedLines={codeLines}
            language="python"
            ariaLabel={`${sortAlgorithmLabels[algorithm]} pseudocode`}
          />
        )}
      </div>

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
        onRunToCompletion={playback.runToCompletion}
        onSpeedChange={playback.setSpeed}
        onArraySizeChange={handleSizeChange}
        minArraySize={minSize}
        maxArraySize={maxSize}
      />
    </section>
  );
}
