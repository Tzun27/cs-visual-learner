"use client";

import { useMemo } from "react";
import {
  buildDoubleHashTable,
  doubleHashDeleteSequence,
  doubleHashStepFor,
} from "@/lib/dataStructures/doubleHash";
import { doubleHashDeletePython } from "@/lib/dataStructures/doubleHashDelete.snippet";
import type { LinearProbeDeleteStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 11;

// Same starting state the insert section ends on: 5,16,27,38,49 at
// slots 5,1,2,3,4 respectively. Delete cases:
//   27 → probe past slot 5, jump by h2(27)=8 → find at slot 2 (1 probe)
//   5  → home hit at slot 5, zero probes (becomes tombstone)
//   99 → MISS: hash(99) % 11 = 0, slot 0 is empty → zero probes
function buildInitialTable(): LinearProbeSnapshot {
  return buildDoubleHashTable(CAPACITY, [5, 16, 27, 38, 49]);
}

const DELETE_TARGETS = [27, 5, 99] as const;

export type DoubleHashDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: LinearProbeDeleteStep | undefined): LinearProbeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
    case "probe":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
    case "tombstone":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: LinearProbeDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin": {
      const home = step.targetKey % step.table.capacity;
      const stepSize = doubleHashStepFor(step.targetKey, step.table.capacity);
      return `Deleting ${step.targetKey} (h1=${home}, h2=${stepSize})`;
    }
    case "hash":
      return `h1(${step.targetKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      const stepSize = doubleHashStepFor(step.targetKey, step.table.capacity);
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — jump by h2=${stepSize}`;
    }
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}`;
    case "tombstone":
      return `Replaced slot ${step.slotIndex} with a tombstone`;
    case "miss":
      return `Slot ${step.slotIndex} is empty → ${step.targetKey} not in table`;
    case "done":
      return "Done";
  }
}

export function DoubleHashDeleteViz({ initialSpeedMs = 400 }: DoubleHashDeleteVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeDeleteStep[]>(
    () => [...doubleHashDeleteSequence(initial, DELETE_TARGETS)],
    [initial],
  );

  return (
    <VizSection
      ariaLabel="Double-hash delete"
      codePanelAriaLabel="Double-hash delete pseudocode"
      caption={`Deleting ${DELETE_TARGETS.join(", ")} from a ${CAPACITY}-slot table`}
      steps={steps}
      source={doubleHashDeletePython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Probes", value: countKind(visible, "probe") },
        { label: "Removed", value: countKind(visible, "tombstone") },
        { label: "Misses", value: countKind(visible, "miss") },
      ]}
      renderView={(currentStep) => (
        <LinearProbeView
          table={currentStep?.table ?? initial}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
