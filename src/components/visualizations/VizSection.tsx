"use client";

import { type ReactNode } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";

/**
 * A single live counter rendered in the `<dl>` strip below the viz.
 */
export type VizSectionCounter = {
  readonly label: string;
  readonly value: number;
};

/**
 * Generic shell for visualization wrappers across every data-structure
 * family (hash tables, heaps, BST, …).
 *
 * Every wrapper shared an identical skeleton: a `useMemo` step sequence,
 * the `useReducedMotion` + `useStepThrough` hook wiring, a `<section>`
 * with an optional caption, a responsive grid pairing the SVG view with
 * a `CodePanel`, an aria-live annotation paragraph, an optional `<dl>` of
 * counters, and a `<Controls>` block. This component owns all of that.
 * The only per-op variation lives in:
 *
 *  - `steps`: the pre-computed step sequence (the wrapper builds it via
 *    `useMemo` from its curated input + generator).
 *  - `renderView`: a render-prop closure that builds the family-specific
 *    SVG view. The view prop shapes are incompatible across families
 *    (ghost buckets, displacements, hop bits, tree forests, heap trees,
 *    …) so the wrapper closes over its own `highlightsFor` /
 *    `activeBucketFor` / etc., derives the snapshot from the current
 *    step, and returns the element.
 *  - `annotationFor`: maps the current step to the aria-live status.
 *  - `counters` (optional): maps the visible-steps slice to the `<dl>`
 *    entries. Omitted entirely for ops like pairing-heap merge where
 *    there's nothing meaningful to count.
 *  - `caption` (optional): the uppercase legend line above the viz.
 *    Omitted for ops like heapify that don't need one.
 *
 * The `T` type parameter is the wrapper's step union; it must carry an
 * optional `codeLines` field (every step union in the codebase does, via
 * the shared `StepBase` intersection).
 */
export type VizSectionProps<T extends { readonly codeLines?: readonly number[] }> = {
  /** Exact `<section aria-label>` — must match the e2e exact-string locators. */
  readonly ariaLabel: string;
  /** Exact `<CodePanel ariaLabel>` — shares a prefix with `ariaLabel`. */
  readonly codePanelAriaLabel: string;
  /** The uppercase caption line above the viz. Omit to hide it entirely. */
  readonly caption?: ReactNode;
  /** Pre-computed step sequence (built by the wrapper via `useMemo`). */
  readonly steps: readonly T[];
  /** Python snippet rendered in the `CodePanel`. */
  readonly source: string;
  /**
   * Builds the family-specific SVG view for the current playback frame.
   * The wrapper closure owns the snapshot type — it derives the snapshot
   * from `currentStep?.<field> ?? INITIAL` itself, keeping this shell
   * view-agnostic.
   */
  readonly renderView: (currentStep: T | undefined) => ReactNode;
  /** Maps the current step to the aria-live annotation string. */
  readonly annotationFor: (step: T | undefined) => string | null;
  /**
   * Maps the visible-steps slice to the live `<dl>` counters. Omit to
   * suppress the counter row entirely (e.g. pairing-heap merge has nothing
   * meaningful to count).
   */
  readonly counters?: (visibleSteps: readonly T[]) => readonly VizSectionCounter[];
  /** Step-delay seed for `useStepThrough`. */
  readonly initialSpeedMs: number;
};

// Tailwind needs the full class name as a literal to emit it. Wrappers
// only ever render 2, 3, or 4 counters.
const COUNTER_GRID: Record<number, string> = {
  2: "grid grid-cols-2 gap-3 text-sm",
  3: "grid grid-cols-3 gap-3 text-sm",
  4: "grid grid-cols-4 gap-3 text-sm",
};

export function VizSection<T extends { readonly codeLines?: readonly number[] }>({
  ariaLabel,
  codePanelAriaLabel,
  caption,
  steps,
  source,
  renderView,
  annotationFor,
  counters,
  initialSpeedMs,
}: VizSectionProps<T>) {
  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, {
    initialSpeed: initialSpeedMs,
    reducedMotion,
  });

  const currentStep = playback.currentStep;
  const annotation = annotationFor(currentStep);

  const visibleSteps = playback.stepIndex >= 0 ? steps.slice(0, playback.stepIndex + 1) : [];
  const counterEntries = counters ? counters(visibleSteps) : [];

  return (
    <section
      aria-label={ariaLabel}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      {caption !== undefined && (
        <p className="text-[11px] tracking-wider text-zinc-500 uppercase">{caption}</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        {renderView(currentStep)}
        <CodePanel
          source={source}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel={codePanelAriaLabel}
        />
      </div>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation ?? "Idle — press play or step forward."}
      </p>

      {counterEntries.length > 0 && (
        <dl className={COUNTER_GRID[counterEntries.length] ?? COUNTER_GRID[3]}>
          {counterEntries.map((counter) => (
            <div
              key={counter.label}
              className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <dt className="text-xs text-zinc-500">{counter.label}</dt>
              <dd className="font-mono text-lg">{counter.value}</dd>
            </div>
          ))}
        </dl>
      )}

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
        onRunToCompletion={playback.runToCompletion}
        onSpeedChange={playback.setSpeed}
      />
    </section>
  );
}
