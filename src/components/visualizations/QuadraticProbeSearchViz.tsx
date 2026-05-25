"use client";

import { useMemo } from "react";
import { linearProbeDeleteSequence } from "@/lib/dataStructures/linearProbe";
import {
  buildQuadraticProbeTable,
  quadraticProbeSearchSequence,
} from "@/lib/dataStructures/quadraticProbe";
import { quadraticProbeSearchPython } from "@/lib/dataStructures/quadraticProbeSearch.snippet";
import type { LinearProbeSearchStep, LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { VizSection } from "./VizSection";
import { LinearProbeView, type LinearProbeHighlight } from "./LinearProbeView";

const CAPACITY = 11;

// Same starting shape the insert section ends on (5,16,27,38,49 at slots
// 5,6,9,3,10), then delete 16 so slot 6 holds a tombstone. The tombstone
// is the load-bearing case for search: probing past it still finds 27 at
// slot 9 (the next i*i jump after slot 6).
function buildInitialTable(): LinearProbeSnapshot {
  const inserted = buildQuadraticProbeTable(CAPACITY, [5, 16, 27, 38, 49]);
  // linearProbeDeleteSequence uses the same slot model and a plain
  // `cursor++ % cap` walk to find 16 at its known location (slot 6) —
  // the tombstone-planting step is identical for the two probe schemes.
  const after = [...linearProbeDeleteSequence(inserted, [16])].at(-1);
  if (!after || after.kind !== "done") {
    throw new Error("expected 'done' from tombstone setup");
  }
  return after.table;
}

// Targets:
//   5  → home hit at slot 5, zero probes
//   27 → probe past 5, probe past tombstone-at-6 → find at slot 9 (i=2)
//   16 → MISS (deleted) — probes 5, tombstone-6, 27-at-9, 38-at-3, 49-at-10,
//        then i=5 jumps to slot (5+25)%11=8 which is empty → miss at 8
//   99 → MISS at home slot 0 (empty), zero probes
const SEARCH_TARGETS = [5, 27, 16, 99] as const;

export type QuadraticProbeSearchVizProps = {
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
      return `Probe ${step.probeCount} → slot ${step.slotIndex} ${desc} — try next i²`;
    }
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}`;
    case "miss":
      return `Slot ${step.slotIndex} is empty → ${step.targetKey} not in table`;
    case "done":
      return "Done";
  }
}

export function QuadraticProbeSearchViz({ initialSpeedMs = 400 }: QuadraticProbeSearchVizProps) {
  const initial = useMemo<LinearProbeSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly LinearProbeSearchStep[]>(
    () => [...quadraticProbeSearchSequence(initial, SEARCH_TARGETS)],
    [initial],
  );

  return (
    <VizSection
      ariaLabel="Quadratic-probe search"
      codePanelAriaLabel="Quadratic-probe search pseudocode"
      caption={`Searching ${SEARCH_TARGETS.join(", ")} (slot 6 is a tombstone — 16 was deleted)`}
      steps={steps}
      source={quadraticProbeSearchPython}
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
