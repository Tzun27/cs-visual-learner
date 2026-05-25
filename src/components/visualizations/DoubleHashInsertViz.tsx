"use client";

import { useMemo } from "react";
import { doubleHashInsertSequence, doubleHashStepFor } from "@/lib/dataStructures/doubleHash";
import { doubleHashInsertPython } from "@/lib/dataStructures/doubleHashInsert.snippet";
import { emptyTable } from "@/lib/dataStructures/linearProbe";
import type { LinearProbeInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

// 11 (prime) means h2(k) ∈ [1, 10] is always coprime with c, so probe
// sequences visit every slot — no risk of unreachable empties.
const CAPACITY = 11;
// All five keys hash to bucket 5 (h1 = 5), but each has a different h2:
//   h2(5)  = 6  → probes 5, 0,  6, 1, 7, ...
//   h2(16) = 7  → probes 5, 1,  8, 4, 0, ...
//   h2(27) = 8  → probes 5, 2, 10, 7, 4, ...
//   h2(38) = 9  → probes 5, 3,  1, 10, 8, ...
//   h2(49) = 10 → probes 5, 4,  3, 2, 1, ...
// Each placement collides at slot 5 once, then jumps by its own h2 to an
// empty slot — exactly 1 probe per placement (4 total for keys 2-5). The
// duplicate 27 follows 27's own probe path and finds itself at slot 2.
const INSERT_SEQUENCE = [5, 16, 27, 38, 49, 27] as const;
const INITIAL = emptyTable(CAPACITY);

export type DoubleHashInsertVizProps = {
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
    case "begin": {
      const home = step.insertingKey % step.table.capacity;
      const stepSize = doubleHashStepFor(step.insertingKey, step.table.capacity);
      return `Inserting ${step.insertingKey} (h1=${home}, h2=${stepSize})`;
    }
    case "hash":
      return `h1(${step.insertingKey}) % ${step.table.capacity} = ${step.slotIndex}`;
    case "probe": {
      const slot = step.table.slots[step.slotIndex];
      const desc = slot.state === "occupied" ? `occupied (${slot.key})` : "tombstone";
      const stepSize = doubleHashStepFor(step.insertingKey, step.table.capacity);
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — jump by h2=${stepSize}`;
    }
    case "duplicate":
      return `${step.insertingKey} already present at slot ${step.slotIndex} — skip`;
    case "place":
      return `Placed ${step.insertingKey} at slot ${step.slotIndex}`;
    case "done":
      return "Done";
  }
}

export function DoubleHashInsertViz({ initialSpeedMs = 400 }: DoubleHashInsertVizProps) {
  const steps = useMemo<readonly LinearProbeInsertStep[]>(
    () => [...doubleHashInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  return (
    <VizSection
      ariaLabel="Double-hash insert"
      codePanelAriaLabel="Double-hash insert pseudocode"
      caption={`Inserting ${INSERT_SEQUENCE.join(", ")} into ${CAPACITY} slots — every key has h1=5, distinct h2`}
      steps={steps}
      source={doubleHashInsertPython}
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
