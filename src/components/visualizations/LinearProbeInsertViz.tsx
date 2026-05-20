"use client";

import { useMemo } from "react";
import { emptyTable, linearProbeInsertSequence } from "@/lib/dataStructures/linearProbe";
import { linearProbeInsertPython } from "@/lib/dataStructures/linearProbeInsert.snippet";
import type { LinearProbeInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { HashVizSection } from "./HashVizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;
// Curated to hit every behavior worth showing:
//   5 → slot 5 (home placement)
//   13 → slot 5 collision, probe once → slot 6 placement
//   21 → slot 5/6 collisions, probe twice → slot 7 placement
//   4 → slot 4 (different home, no collision)
//   23 → hashes to 7, collision, wraps to slot 0 (wrap-around placement)
//   5 → duplicate at home slot 5 (no probes, no placement)
const INSERT_SEQUENCE = [5, 13, 21, 4, 23, 5] as const;
const INITIAL = emptyTable(CAPACITY);

export type LinearProbeInsertVizProps = {
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
      return `Probe slot ${step.slotIndex} (${desc}) → advance`;
    }
    case "duplicate":
      return `${step.insertingKey} already present at slot ${step.slotIndex} — skip`;
    case "place":
      return `Placed ${step.insertingKey} at slot ${step.slotIndex}`;
    case "done":
      return "Done";
  }
}

export function LinearProbeInsertViz({ initialSpeedMs = 400 }: LinearProbeInsertVizProps) {
  const steps = useMemo<readonly LinearProbeInsertStep[]>(
    () => [...linearProbeInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  return (
    <HashVizSection
      ariaLabel="Linear-probe insert"
      codePanelAriaLabel="Linear-probe insert pseudocode"
      caption={`Inserting ${INSERT_SEQUENCE.join(", ")} into ${CAPACITY} slots`}
      steps={steps}
      source={linearProbeInsertPython}
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
