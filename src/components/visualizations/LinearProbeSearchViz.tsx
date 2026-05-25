"use client";

import { useMemo } from "react";
import {
  buildLinearProbeTable,
  linearProbeDeleteSequence,
  linearProbeSearchSequence,
} from "@/lib/dataStructures/linearProbe";
import { linearProbeSearchPython } from "@/lib/dataStructures/linearProbeSearch.snippet";
import type { LinearProbeSearchStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;

// Build the same shape the user saw at end of the insert section, then
// delete 13 to plant a tombstone at slot 6. That tombstone is the
// teaching pivot: search for 21 must probe PAST it to find 21 at slot 7.
function buildInitialTable(): LinearProbeSnapshot {
  const inserted = buildLinearProbeTable(CAPACITY, [5, 13, 21, 4]);
  const afterDelete = [...linearProbeDeleteSequence(inserted, [13])].at(-1);
  if (!afterDelete || afterDelete.kind !== "done") {
    throw new Error("expected 'done' last from delete-13 setup");
  }
  return afterDelete.table;
}

// Targets:
//   5  → direct hit at home slot, zero probes
//   21 → probe past 5 and tombstone-at-6 to find 21 at slot 7
//   13 → MISS (it was deleted) — probes past 5, tombstone, 21, then empty
//   12 → MISS via cluster: probes past 4, 5, tombstone, 21, then empty
//   4  → direct hit at slot 4 (different home, no probing)
const SEARCH_TARGETS = [5, 21, 13, 12, 4] as const;

export type LinearProbeSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: LinearProbeSearchStep | undefined): LinearProbeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
    case "probe":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: LinearProbeSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      return `Probe slot ${step.slotIndex} (${desc}) → advance`;
    }
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}`;
    case "miss":
      return `Slot ${step.slotIndex} is empty → ${step.targetKey} not in table`;
    case "done":
      return "Done";
  }
}

export function LinearProbeSearchViz({ initialSpeedMs = 400 }: LinearProbeSearchVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeSearchStep[]>(
    () => [...linearProbeSearchSequence(initial, SEARCH_TARGETS)],
    [initial],
  );

  return (
    <VizSection
      ariaLabel="Linear-probe search"
      codePanelAriaLabel="Linear-probe search pseudocode"
      caption={`Searching ${SEARCH_TARGETS.join(", ")} (slot 6 is a tombstone — 13 was deleted)`}
      steps={steps}
      source={linearProbeSearchPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Probes", value: countKind(visible, "probe") },
        { label: "Found", value: countKind(visible, "found") },
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
