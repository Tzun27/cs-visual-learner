"use client";

import { useMemo } from "react";
import { emptyHopscotchTable, hopscotchInsertSequence } from "@/lib/dataStructures/hopscotch";
import { hopscotchInsertPython } from "@/lib/dataStructures/hopscotchInsert.snippet";
import type { HopscotchInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { HopscotchView, type HopscotchHighlight } from "./HopscotchView";

const CAPACITY = 8;

// Curated input that hits every insert path the algorithm has:
//   0 → home 0, place at slot 0 (dist 0)
//   1 → home 1, place at slot 1 (dist 0)
//   8 → home 0, scan past 0 → place at slot 2 (dist 2)
//   9 → home 1, scan past 1 and 2 → place at slot 3 (dist 2)
//   16 → home 0, scan past 0,1,2,3 → empty at 4 (dist 4 == H) → SWAP CHAIN:
//        pull key 1 from slot 1 to slot 4 → place 16 at slot 1 (dist 1)
//   16 → duplicate (already at slot 1 with home 0)
const INSERT_SEQUENCE = [0, 1, 8, 9, 16, 16] as const;
const INITIAL = emptyHopscotchTable(CAPACITY);

export type HopscotchInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HopscotchInsertStep | undefined): HopscotchHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
      return [{ slotIndex: step.home, kind: "cursor" }];
    case "scan":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "duplicate":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
    case "swap":
      return [
        { slotIndex: step.fromIndex, kind: "cursor" },
        { slotIndex: step.toIndex, kind: "placed" },
      ];
    case "place":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
  }
}

function activeHomeFor(step: HopscotchInsertStep | undefined): number | null {
  if (!step) return null;
  switch (step.kind) {
    case "hash":
    case "scan":
    case "duplicate":
    case "swap":
    case "place":
      return step.home;
    default:
      return null;
  }
}

function annotationFor(step: HopscotchInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "hash":
      return `hash(${step.insertingKey}) % ${step.table.capacity} = ${step.home}`;
    case "scan":
      return `Scan: slot ${step.slotIndex} occupied, advance (distance ${step.distance + 1})`;
    case "duplicate":
      return `${step.insertingKey} already at slot ${step.slotIndex} — skip`;
    case "swap":
      return `Swap: key ${step.pulledKey} (home ${step.pulledHome}) ${step.fromIndex} → ${step.toIndex} — empty walks back`;
    case "place":
      return `Placed ${step.insertingKey} at slot ${step.slotIndex} (distance ${step.distance} from home)`;
    case "done":
      return "Done";
  }
}

export function HopscotchInsertViz({ initialSpeedMs = 450 }: HopscotchInsertVizProps) {
  const steps = useMemo<readonly HopscotchInsertStep[]>(
    () => [...hopscotchInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  return (
    <VizSection
      ariaLabel="Hopscotch insert"
      codePanelAriaLabel="Hopscotch insert pseudocode"
      caption={`Inserting ${INSERT_SEQUENCE.join(", ")} into ${CAPACITY} slots (neighborhood H = 4)`}
      steps={steps}
      source={hopscotchInsertPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Scans", value: countKind(visible, "scan") },
        { label: "Swaps", value: countKind(visible, "swap") },
        { label: "Placed", value: countKind(visible, "place") },
      ]}
      renderView={(currentStep) => (
        <HopscotchView
          table={currentStep?.table ?? INITIAL}
          highlights={highlightsFor(currentStep)}
          activeHome={activeHomeFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
