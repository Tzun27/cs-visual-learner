"use client";

import { useMemo } from "react";
import { buildRobinHoodTable, robinHoodDeleteSequence } from "@/lib/dataStructures/robinHood";
import { robinHoodDeletePython } from "@/lib/dataStructures/robinHoodDelete.snippet";
import type { LinearProbeSnapshot, RobinHoodDeleteStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 8;

// Start from the Robin Hood insert demo's end state: 5@5, 13@6, 14@7, 22@0.
// Displacements: 5(+0), 13(+1), 14(+1), 22(+2).
function buildInitialTable(): LinearProbeSnapshot {
  return buildRobinHoodTable(CAPACITY, [5, 14, 13, 22]);
}

// Targets exercise the three branches the algorithm cares about:
//   13 → probe past 5 to find 13 at slot 6, then backshift pulls 14 and
//        22 toward home; the chain ends at empty slot 1 (clear slot 0).
//   5  → found directly at slot 5; the next slot (6) holds 14 which is
//        already at home (+0), so backshift does NOTHING and we just
//        clear slot 5. Demonstrates the at-home stop.
//   99 → home slot 3 is empty, so the search half reports a miss
//        immediately. No table changes.
const DELETE_TARGETS = [13, 5, 99] as const;

export type RobinHoodDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: RobinHoodDeleteStep | undefined): LinearProbeHighlight[] {
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
    case "pull":
      // Both the slot the key arrived at and the slot it left should
      // glow; `placed` is the "active" yellow, `cursor` is the "from".
      return [
        { slotIndex: step.toIndex, kind: "placed" },
        { slotIndex: step.fromIndex, kind: "cursor" },
      ];
    case "clear":
      // The newly-empty slot is colored placed; the blocker is dimmer
      // (cursor) so the user can see what stopped the chain.
      return [
        { slotIndex: step.clearedIndex, kind: "placed" },
        { slotIndex: step.blockerIndex, kind: "cursor" },
      ];
    case "miss":
      return [{ slotIndex: step.slotIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: RobinHoodDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Deleting ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe":
      return `Slot occupied by another key — advance to slot ${step.slotIndex}`;
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}; start backshift`;
    case "pull":
      return `Pull ${step.pulledKey} from slot ${step.fromIndex} → slot ${step.toIndex}`;
    case "clear": {
      const why =
        step.blockerReason === "empty"
          ? `slot ${step.blockerIndex} is empty`
          : `key at slot ${step.blockerIndex} is already at home`;
      return `Clear slot ${step.clearedIndex} — ${why}, backshift stops`;
    }
    case "miss":
      return `Slot ${step.slotIndex} is empty → ${step.targetKey} not in table`;
    case "done":
      return "Done";
  }
}

export function RobinHoodDeleteViz({ initialSpeedMs = 450 }: RobinHoodDeleteVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly RobinHoodDeleteStep[]>(
    () => [...robinHoodDeleteSequence(initial, DELETE_TARGETS)],
    [initial],
  );

  return (
    <VizSection
      ariaLabel="Robin Hood delete"
      codePanelAriaLabel="Robin Hood delete pseudocode"
      caption={`Deleting ${DELETE_TARGETS.join(", ")} via backshift — no tombstones produced`}
      steps={steps}
      source={robinHoodDeletePython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Probes", value: countKind(visible, "probe") },
        { label: "Pulls", value: countKind(visible, "pull") },
        { label: "Removed", value: countKind(visible, "clear") },
      ]}
      renderView={(currentStep) => (
        <LinearProbeView
          table={currentStep?.table ?? initial}
          highlights={highlightsFor(currentStep)}
          showDisplacements
          className="w-full"
        />
      )}
    />
  );
}
