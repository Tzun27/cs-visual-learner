"use client";

import { useMemo } from "react";
import {
  cuckooHash1,
  cuckooHash2,
  cuckooInsertSequence,
  emptyCuckooTable,
} from "@/lib/dataStructures/cuckoo";
import { cuckooInsertPython } from "@/lib/dataStructures/cuckooInsert.snippet";
import type { CuckooInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { CuckooView, type CuckooHighlight } from "./CuckooView";
import { VizSection } from "./VizSection";

const CAPACITY = 7;
// Curated cascade: [5, 0] place directly; 12 triggers a 1-step swap; 14
// triggers a 3-step cascade (the lesson's hero — 14 displaces 0, which
// displaces 5, which displaces 12, which lands cleanly). Final insert
// (5 again) exercises the T_A dedup-check short-circuit.
const INSERT_SEQUENCE = [5, 0, 12, 14, 5] as const;
const INITIAL = emptyCuckooTable(CAPACITY);

export type CuckooInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooInsertStep | undefined): CuckooHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
    case "cycle":
      return [];
    case "hash":
      return [
        { side: "A", slotIndex: step.home1, kind: "cursor" },
        { side: "B", slotIndex: step.home2, kind: "cursor" },
      ];
    case "dedup-check":
    case "check":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "cursor" }];
    case "duplicate":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "duplicate" }];
    case "place":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "placed" }];
    case "evict":
      // Dual highlight (per decision 39 convention): `placed` = active key
      // now lives here; `cursor` = next slot the evicted key will inspect.
      return [
        { side: step.side, slotIndex: step.slotIndex, kind: "placed" },
        { side: step.nextSide, slotIndex: step.nextSlotIndex, kind: "cursor" },
      ];
  }
}

function annotationFor(step: CuckooInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "hash":
      return `h₁(${step.insertingKey}) = ${step.home1}, h₂(${step.insertingKey}) = ${step.home2}`;
    case "dedup-check":
      return `Dedup: T_${step.side}[${step.slotIndex}] holds the existing key for ${step.insertingKey}?`;
    case "duplicate":
      return `${step.insertingKey} already present at T_${step.side}[${step.slotIndex}] — skip`;
    case "check":
      return `Try T_${step.side}[${step.slotIndex}] for ${step.activeKey}`;
    case "place":
      return `Placed ${step.placedKey} at T_${step.side}[${step.slotIndex}]`;
    case "evict":
      return `Swap: ${step.placedKey} into T_${step.side}[${step.slotIndex}], ${step.evictedKey} bumped → T_${step.nextSide}[${step.nextSlotIndex}]`;
    case "cycle":
      return `Cycle while inserting ${step.insertingKey} — rehash required`;
    case "done":
      return "Done";
  }
}

export function CuckooInsertViz({ initialSpeedMs = 400 }: CuckooInsertVizProps) {
  const steps = useMemo<readonly CuckooInsertStep[]>(
    () => [...cuckooInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  // Quick legend of the (h1, h2) pairs so users can verify what they see.
  const legend = INSERT_SEQUENCE.map(
    (k) => `${k} (h₁=${cuckooHash1(k, CAPACITY)}, h₂=${cuckooHash2(k, CAPACITY)})`,
  ).join(", ");

  return (
    <VizSection
      ariaLabel="Cuckoo insert"
      codePanelAriaLabel="Cuckoo insert pseudocode"
      caption={legend}
      steps={steps}
      source={cuckooInsertPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Placed", value: countKind(visible, "place") },
        { label: "Evictions", value: countKind(visible, "evict") },
        { label: "Duplicates", value: countKind(visible, "duplicate") },
      ]}
      renderView={(currentStep) => (
        <CuckooView
          table={currentStep?.table ?? INITIAL}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
