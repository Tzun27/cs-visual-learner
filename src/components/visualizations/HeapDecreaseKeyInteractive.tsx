"use client";

import { useMemo, useState } from "react";
import { buildHeap, heapDecreaseKeySequence, heapToTree } from "@/lib/dataStructures/heap";
import { heapDecreaseKeyPython } from "@/lib/dataStructures/heapDecreaseKey.snippet";
import type { HeapDecreaseKeyStep, HeapSnapshot } from "@/lib/dataStructures/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useStepThrough } from "@/lib/hooks/useStepThrough";
import { CodePanel } from "./CodePanel";
import { Controls } from "./Controls";
import { TreeView, type TreeHighlight } from "./TreeView";

// Same demo heap as the trace viz above, so the lesson moves seamlessly
// from "watch a trace" to "play with the data structure."
const INITIAL_VALUES = [4, 9, 7, 13, 11, 8, 12] as const;

/**
 * Parse a strict whole number from the input draft. Returns null for anything
 * that isn't an integer — `<input type="number">` accepts decimals and
 * scientific notation, and `parseInt` would silently truncate them.
 */
function parseWholeNumber(draft: string): number | null {
  const trimmed = draft.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export type HeapDecreaseKeyInteractiveProps = {
  initialSpeedMs?: number;
};

function highlightsFor(
  step: HeapDecreaseKeyStep | undefined,
  selectedIndex: number | null,
): TreeHighlight[] {
  if (!step) {
    return selectedIndex !== null ? [{ nodeId: selectedIndex, kind: "cursor" as const }] : [];
  }
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "set":
      return [{ nodeId: step.cursorIndex, kind: "placed" }];
    case "compare-parent":
      return [
        { nodeId: step.cursorIndex, kind: "cursor" },
        { nodeId: step.parentIndex, kind: "cursor" },
      ];
    case "swap-up":
      return [
        { nodeId: step.cursorIndex, kind: "placed" },
        { nodeId: step.fromIndex, kind: "placed" },
      ];
    case "settle":
      return [{ nodeId: step.cursorIndex, kind: "placed" }];
  }
}

function annotationFor(step: HeapDecreaseKeyStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Decrease key at index ${step.index} from ${step.oldValue} to ${step.newValue}`;
    case "set":
      return `Set heap[${step.cursorIndex}] = ${step.newValue}`;
    case "compare-parent": {
      const child = step.heap.heap[step.cursorIndex];
      const parent = step.heap.heap[step.parentIndex];
      const direction = child < parent ? "swap up" : "stop";
      return `Compare ${child} vs parent ${parent} → ${direction}`;
    }
    case "swap-up": {
      const moved = step.heap.heap[step.cursorIndex];
      return `Swap ${moved} up to index ${step.cursorIndex}`;
    }
    case "settle": {
      const moved = step.heap.heap[step.cursorIndex];
      return `Settled ${moved} at index ${step.cursorIndex}`;
    }
    case "done":
      return "Done — pick another node to keep going, or Reset.";
  }
}

export function HeapDecreaseKeyInteractive({
  initialSpeedMs = 450,
}: HeapDecreaseKeyInteractiveProps) {
  const initialHeap = useMemo<HeapSnapshot>(() => buildHeap(INITIAL_VALUES), []);
  const [workingHeap, setWorkingHeap] = useState<HeapSnapshot>(initialHeap);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [newValueDraft, setNewValueDraft] = useState<string>("");
  const [activeOp, setActiveOp] = useState<{ index: number; newValue: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo<readonly HeapDecreaseKeyStep[]>(
    () => (activeOp ? [...heapDecreaseKeySequence(workingHeap.heap, [activeOp])] : []),
    [workingHeap, activeOp],
  );

  const reducedMotion = useReducedMotion();
  const playback = useStepThrough(steps, { initialSpeed: initialSpeedMs, reducedMotion });

  // The visible heap is the playback's current step's heap (if a sequence
  // is mid-play or just finished) or the committed working heap.
  // Commit-on-action: the post-op heap state is promoted to workingHeap
  // lazily when the user clicks a new node or Run again. This avoids a
  // setState-inside-useEffect cascade and keeps the visible state in sync
  // with what the user is interacting with.
  const currentStep = playback.currentStep;
  const displayHeap: HeapSnapshot = currentStep?.heap ?? workingHeap;
  const tree = heapToTree(displayHeap);
  const highlights = highlightsFor(currentStep, activeOp ? null : selectedIndex);
  const annotation = annotationFor(currentStep);

  function commitDoneIfNeeded(): HeapSnapshot {
    if (activeOp && currentStep?.kind === "done") {
      setWorkingHeap(currentStep.heap);
      setActiveOp(null);
      return currentStep.heap;
    }
    return workingHeap;
  }

  const handleSelectIndex = (i: number) => {
    if (activeOp && currentStep?.kind !== "done") return;
    const effective = commitDoneIfNeeded();
    setSelectedIndex(i);
    setNewValueDraft(String(effective.heap[i] - 1));
    setError(null);
  };

  const handleRun = () => {
    if (activeOp && currentStep?.kind !== "done") return;
    const effective = commitDoneIfNeeded();
    if (selectedIndex === null) {
      setError("Pick a node first.");
      return;
    }
    const parsed = parseWholeNumber(newValueDraft);
    if (parsed === null) {
      setError("Enter a whole number for the new value.");
      return;
    }
    if (parsed > effective.heap[selectedIndex]) {
      setError(`decrease_key requires the new value ≤ current (${effective.heap[selectedIndex]}).`);
      return;
    }
    setError(null);
    setActiveOp({ index: selectedIndex, newValue: parsed });
  };

  const handleResetHeap = () => {
    playback.reset();
    setWorkingHeap(initialHeap);
    setActiveOp(null);
    setSelectedIndex(null);
    setNewValueDraft("");
    setError(null);
  };

  // Animation in progress = playing or stepping a non-terminal step. Once
  // we hit `done`, the fieldset re-enables so the user can pick the next op.
  const animating = activeOp !== null && currentStep?.kind !== "done";
  // The Run button reflects true runnability: a valid whole number that is an
  // actual decrease. `handleRun` re-checks defensively against the committed heap.
  const draftValue = parseWholeNumber(newValueDraft);
  const canRun =
    !animating &&
    selectedIndex !== null &&
    draftValue !== null &&
    draftValue <= displayHeap.heap[selectedIndex];

  return (
    <section
      aria-label="Interactive decrease_key"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
        Pick a node, drop its value, watch siftUp restore the invariant
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <TreeView tree={tree} highlights={highlights} className="w-full" />
        <CodePanel
          source={heapDecreaseKeyPython}
          highlightedLines={currentStep?.codeLines}
          language="python"
          ariaLabel="Min-heap decrease-key pseudocode"
        />
      </div>

      <fieldset disabled={animating} className="flex flex-col gap-3 disabled:opacity-60">
        <legend className="text-xs text-zinc-500">Pick an index (current value shown)</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Heap node index buttons">
          {displayHeap.heap.map((value, i) => {
            const isSelected = selectedIndex === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectIndex(i)}
                aria-pressed={isSelected}
                className={`min-w-[56px] rounded-md border px-3 py-2 font-mono text-sm transition-colors ${
                  isSelected
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                }`}
              >
                <span className="text-xs text-zinc-500">{i}</span>
                <span className="ml-2 text-base">{value}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-zinc-500">New value (≤ current)</span>
            <input
              type="number"
              value={newValueDraft}
              onChange={(e) => {
                setNewValueDraft(e.target.value);
                setError(null);
              }}
              max={selectedIndex !== null ? displayHeap.heap[selectedIndex] : undefined}
              className="w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder={selectedIndex !== null ? "e.g. 2" : "pick a node"}
              aria-label="New value for the selected node"
            />
          </label>
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Run decrease_key
          </button>
          <button
            type="button"
            onClick={handleResetHeap}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Reset heap
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </fieldset>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] font-mono text-sm text-zinc-600 dark:text-zinc-400"
      >
        {annotation ??
          (animating
            ? `Running decrease_key(${activeOp!.index}, ${activeOp!.newValue})…`
            : selectedIndex !== null
              ? `Picked index ${selectedIndex} (value ${displayHeap.heap[selectedIndex]}). Set a new value and Run.`
              : "Idle — pick a node to start.")}
      </p>

      <Controls
        status={playback.status}
        speed={playback.speed}
        reducedMotion={reducedMotion}
        canStepBack={playback.stepIndex > -1}
        canStepForward={playback.stepIndex < steps.length - 1 && steps.length > 0}
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
