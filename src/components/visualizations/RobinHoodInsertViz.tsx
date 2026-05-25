"use client";

import { useMemo } from "react";
import { robinHoodInsertSequence } from "@/lib/dataStructures/robinHood";
import { robinHoodInsertPython } from "@/lib/dataStructures/robinHoodInsert.snippet";
import type { LinearProbeSnapshot, RobinHoodInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;

// Inserts chosen to force one "rob from the rich" swap and show
// displacement equalization. Trace:
//   5  → home slot 5, place (disp 0)
//   14 → home slot 6, place (disp 0)
//   13 → hashes to 5, probe=0 vs 5(disp 0): no swap, advance.
//        probe=1 at slot 6 vs 14(disp 0): 1>0 → SWAP. 13 takes slot 6.
//        Now inserting 14 with probe=1 (continuing). Advance to slot 7,
//        probe=1. Empty → place 14 there.
//   22 → hashes to 6, probe=0 vs 13(disp 1): 0>1 false, no swap, advance.
//        probe=1 at slot 7 vs 14(disp 1): 1>1 false, advance.
//        probe=2 at slot 0 empty → place 22.
const INSERT_SEQUENCE = [5, 14, 13, 22] as const;
const INITIAL: LinearProbeSnapshot = {
  capacity: CAPACITY,
  slots: Array.from({ length: CAPACITY }, () => ({ state: "empty" as const })),
};

export type RobinHoodInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: RobinHoodInsertStep | undefined): LinearProbeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
    case "probe":
    case "compare-displacement":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "swap":
    case "place":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "duplicate":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: RobinHoodInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "hash":
      return `hash(${step.insertingKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "compare-displacement":
      return `Compare displacements at slot ${step.slotIndex}: inserting=+${step.insertingProbe}, existing=+${step.existingProbe}`;
    case "swap":
      return `Swap: ${step.placedKey} takes slot ${step.slotIndex}, ${step.evictedKey} continues with probe ${step.probe}`;
    case "probe":
      return `Probe slot ${step.slotIndex} (now inserting ${step.insertingKey} at probe ${step.probe})`;
    case "duplicate":
      return `${step.insertingKey} already present at slot ${step.slotIndex} — skip`;
    case "place":
      return `Placed ${step.insertingKey} at slot ${step.slotIndex} (displacement +${step.probe})`;
    case "done":
      return "Done";
  }
}

export function RobinHoodInsertViz({ initialSpeedMs = 450 }: RobinHoodInsertVizProps) {
  const steps = useMemo<readonly RobinHoodInsertStep[]>(
    () => [...robinHoodInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  return (
    <VizSection
      ariaLabel="Robin Hood insert"
      codePanelAriaLabel="Robin Hood insert pseudocode"
      caption={`Inserting ${INSERT_SEQUENCE.join(
        ", ",
      )} with Robin Hood probing — each cell shows its displacement`}
      steps={steps}
      source={robinHoodInsertPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Probes", value: countKind(visible, "probe") },
        { label: "Swaps", value: countKind(visible, "swap") },
        { label: "Placed", value: countKind(visible, "place") },
      ]}
      renderView={(currentStep) => (
        <LinearProbeView
          table={currentStep?.table ?? INITIAL}
          highlights={highlightsFor(currentStep)}
          showDisplacements
          className="w-full"
        />
      )}
    />
  );
}
