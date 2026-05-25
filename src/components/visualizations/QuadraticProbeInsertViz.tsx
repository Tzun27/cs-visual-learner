"use client";

import { useMemo } from "react";
import { emptyTable } from "@/lib/dataStructures/linearProbe";
import { quadraticProbeInsertSequence } from "@/lib/dataStructures/quadraticProbe";
import { quadraticProbeInsertPython } from "@/lib/dataStructures/quadraticProbeInsert.snippet";
import type { LinearProbeInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

// 11 (prime) keeps the probe sequence i*i mod cap well-defined for load
// factors under ~0.5 — the lesson's demo never crosses that.
const CAPACITY = 11;
// All five keys hash to bucket 5 (5, 16, 27, 38, 49 are 5 mod 11). The
// quadratic probe sequence from home 5 is 5, 6, 9, 3, 10 — a visible
// "spread" pattern that linear probing would have piled up 5, 6, 7, 8, 9.
//   5  → slot 5 (home, no probe)
//   16 → home 5 collision, probe i=1 → slot 6
//   27 → home 5, probes 5,6 → i=2 → slot 9
//   38 → home 5, probes 5,6,9 → i=3 → slot (5+9)%11=3
//   49 → home 5, probes 5,6,9,3 → i=4 → slot (5+16)%11=10
//   16 → duplicate (already at slot 6)
const INSERT_SEQUENCE = [5, 16, 27, 38, 49, 16] as const;
const INITIAL = emptyTable(CAPACITY);

export type QuadraticProbeInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: LinearProbeInsertStep | undefined): LinearProbeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "probe":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "duplicate":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
    case "place":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
  }
}

function annotationFor(step: LinearProbeInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "hash":
      return `hash(${step.insertingKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — try next i²`;
    }
    case "duplicate":
      return `${step.insertingKey} already present at slot ${step.slotIndex} — skip`;
    case "place":
      return `Placed ${step.insertingKey} at slot ${step.slotIndex}`;
    case "done":
      return "Done";
  }
}

export function QuadraticProbeInsertViz({ initialSpeedMs = 400 }: QuadraticProbeInsertVizProps) {
  const steps = useMemo<readonly LinearProbeInsertStep[]>(
    () => [...quadraticProbeInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  return (
    <VizSection
      ariaLabel="Quadratic-probe insert"
      codePanelAriaLabel="Quadratic-probe insert pseudocode"
      caption={`Inserting ${INSERT_SEQUENCE.join(", ")} into ${CAPACITY} slots`}
      steps={steps}
      source={quadraticProbeInsertPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Probes", value: countKind(visible, "probe") },
        { label: "Placed", value: countKind(visible, "place") },
        { label: "Duplicates", value: countKind(visible, "duplicate") },
      ]}
      renderView={(currentStep) => (
        <LinearProbeView
          table={currentStep?.table ?? INITIAL}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
