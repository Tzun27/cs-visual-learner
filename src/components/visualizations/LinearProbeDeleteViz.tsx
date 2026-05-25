"use client";

import { useMemo } from "react";
import { buildLinearProbeTable, linearProbeDeleteSequence } from "@/lib/dataStructures/linearProbe";
import { linearProbeDeletePython } from "@/lib/dataStructures/linearProbeDelete.snippet";
import type { LinearProbeDeleteStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;

// Same starting shape as the insert section's end-state: 5 at slot 5,
// 13 at slot 6, 21 at slot 7, 4 at slot 4.
function buildInitialTable(): LinearProbeSnapshot {
  return buildLinearProbeTable(CAPACITY, [5, 13, 21, 4]);
}

// Targets cover the three textbook delete cases:
//   13 → at slot 6 (probed through 5 at home), turn slot 6 into a tombstone
//   4  → at slot 4 (direct hit, no probes), turn slot 4 into a tombstone
//   99 → MISS: hash to slot 3 (99 % 8 = 3), which is empty
const DELETE_TARGETS = [13, 4, 99] as const;

export type LinearProbeDeleteVizProps = {
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
      return `Probe slot ${step.slotIndex} (${desc}) → advance`;
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

export function LinearProbeDeleteViz({ initialSpeedMs = 400 }: LinearProbeDeleteVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeDeleteStep[]>(
    () => [...linearProbeDeleteSequence(initial, DELETE_TARGETS)],
    [initial],
  );

  return (
    <VizSection
      ariaLabel="Linear-probe delete"
      codePanelAriaLabel="Linear-probe delete pseudocode"
      caption={`Deleting ${DELETE_TARGETS.join(", ")} from a ${CAPACITY}-slot table`}
      steps={steps}
      source={linearProbeDeletePython}
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
