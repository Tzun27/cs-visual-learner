"use client";

import { useMemo } from "react";
import {
  buildDoubleHashTable,
  doubleHashDeleteSequence,
  doubleHashSearchSequence,
  doubleHashStepFor,
} from "@/lib/dataStructures/doubleHash";
import { doubleHashSearchPython } from "@/lib/dataStructures/doubleHashSearch.snippet";
import type { LinearProbeSearchStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 11;

// Same starting state as the insert section ends on (5,16,27,38,49 at
// slots 5,1,2,3,4), then delete 16 so slot 1 holds a tombstone. The
// tombstone is the load-bearing case for search: probing past it still
// finds keys further along the same h2 path. Note: we must use
// doubleHashDeleteSequence here (not linearProbeDeleteSequence) because 16
// doesn't live next to slot 5 — it lives at slot 1 via 16's own h2=7 jump.
function buildInitialTable(): LinearProbeSnapshot {
  const inserted = buildDoubleHashTable(CAPACITY, [5, 16, 27, 38, 49]);
  const after = [...doubleHashDeleteSequence(inserted, [16])].at(-1);
  if (!after || after.kind !== "done") {
    throw new Error("expected 'done' from tombstone setup");
  }
  return after.table;
}

// Targets:
//   5  → home hit at slot 5, zero probes
//   27 → probe past slot 5, jump by h2(27)=8 → find at slot 2 (1 probe)
//   16 → MISS (deleted) — probe past slot 5, jump by h2(16)=7 to slot 1
//        (tombstone, probe), then i=2 jumps to slot 8 (empty) → miss
//   99 → MISS at home slot 0 (empty), zero probes
const SEARCH_TARGETS = [5, 27, 16, 99] as const;

export type DoubleHashSearchVizProps = {
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
    case "begin": {
      const home = step.targetKey % step.table.capacity;
      const stepSize = doubleHashStepFor(step.targetKey, step.table.capacity);
      return `Searching for ${step.targetKey} (h1=${home}, h2=${stepSize})`;
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
    case "miss":
      return `Slot ${step.slotIndex} is empty → ${step.targetKey} not in table`;
    case "done":
      return "Done";
  }
}

export function DoubleHashSearchViz({ initialSpeedMs = 400 }: DoubleHashSearchVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeSearchStep[]>(
    () => [...doubleHashSearchSequence(initial, SEARCH_TARGETS)],
    [initial],
  );

  return (
    <VizSection
      ariaLabel="Double-hash search"
      codePanelAriaLabel="Double-hash search pseudocode"
      caption={`Searching ${SEARCH_TARGETS.join(", ")} (slot 1 is a tombstone — 16 was deleted)`}
      steps={steps}
      source={doubleHashSearchPython}
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
