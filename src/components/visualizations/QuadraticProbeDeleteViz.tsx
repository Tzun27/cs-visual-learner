"use client";

import { useMemo } from "react";
import {
  buildQuadraticProbeTable,
  quadraticProbeDeleteSequence,
} from "@/lib/dataStructures/quadraticProbe";
import { quadraticProbeDeletePython } from "@/lib/dataStructures/quadraticProbeDelete.snippet";
import type { LinearProbeDeleteStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { HashVizSection } from "./HashVizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 11;

// Same starting state the insert section ends on: 5,16,27,38,49 at
// slots 5,6,9,3,10 respectively. Delete cases:
//   27 → probes past 5, past 16-at-6, then i=2 finds 27 at slot 9
//   5  → home hit at slot 5, zero probes (becomes tombstone)
//   99 → MISS: hash(99) % 11 = 0, slot 0 is empty → zero probes
function buildInitialTable(): LinearProbeSnapshot {
  return buildQuadraticProbeTable(CAPACITY, [5, 16, 27, 38, 49]);
}

const DELETE_TARGETS = [27, 5, 99] as const;

export type QuadraticProbeDeleteVizProps = {
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
    case "begin":
      return `Deleting ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — try next i²`;
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

export function QuadraticProbeDeleteViz({ initialSpeedMs = 400 }: QuadraticProbeDeleteVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeDeleteStep[]>(
    () => [...quadraticProbeDeleteSequence(initial, DELETE_TARGETS)],
    [initial],
  );

  return (
    <HashVizSection
      ariaLabel="Quadratic-probe delete"
      codePanelAriaLabel="Quadratic-probe delete pseudocode"
      caption={`Deleting ${DELETE_TARGETS.join(", ")} from a ${CAPACITY}-slot table`}
      steps={steps}
      source={quadraticProbeDeletePython}
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
