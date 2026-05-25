"use client";

import { useMemo } from "react";
import {
  buildCuckooTable,
  cuckooDeleteSequence,
  cuckooHash1,
  cuckooHash2,
} from "@/lib/dataStructures/cuckoo";
import { cuckooDeletePython } from "@/lib/dataStructures/cuckooDelete.snippet";
import type { CuckooDeleteStep, CuckooSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { CuckooView, type CuckooHighlight } from "./CuckooView";
import { VizSection } from "./VizSection";

const CAPACITY = 7;
const INSERT_SEQUENCE = [5, 0, 12, 14] as const;

// Three delete targets covering the meaningful outcomes — and the
// load-bearing claim of cuckoo deletion: no tombstone is left behind,
// because lookups never need to "walk past" a removed slot.
//   14 → T_A[0] direct hit (1 check, 1 remove)
//   12 → T_A[5] miss, T_B[1] hit (2 checks, 1 remove)
//   99 → both candidate slots miss (2 checks, 0 remove)
const DELETE_TARGETS = [14, 12, 99] as const;

export type CuckooDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooDeleteStep | undefined): CuckooHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
      return [
        { side: "A", slotIndex: step.home1, kind: "cursor" },
        { side: "B", slotIndex: step.home2, kind: "cursor" },
      ];
    case "check":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
    case "remove":
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      return [];
  }
}

function annotationFor(step: CuckooDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Deleting ${step.targetKey}`;
    case "hash":
      return `h₁(${step.targetKey}) = ${step.home1}, h₂(${step.targetKey}) = ${step.home2}`;
    case "check": {
      const slot =
        step.side === "A" ? step.table.slotsA[step.slotIndex] : step.table.slotsB[step.slotIndex];
      const desc =
        slot.state === "occupied"
          ? slot.key === step.targetKey
            ? `holds ${slot.key} — match`
            : `holds ${slot.key}`
          : "empty";
      return `Check T_${step.side}[${step.slotIndex}]: ${desc}`;
    }
    case "found":
      return `Found ${step.targetKey} at T_${step.side}[${step.slotIndex}]`;
    case "remove":
      return `Cleared T_${step.side}[${step.slotIndex}] — no tombstone needed`;
    case "miss":
      return `${step.targetKey} not in either candidate slot — nothing to remove`;
    case "done":
      return "Done";
  }
}

export function CuckooDeleteViz({ initialSpeedMs = 400 }: CuckooDeleteVizProps) {
  const initial = useMemo<CuckooSnapshot>(() => buildCuckooTable(CAPACITY, INSERT_SEQUENCE), []);
  const steps = useMemo<readonly CuckooDeleteStep[]>(
    () => [...cuckooDeleteSequence(initial, DELETE_TARGETS)],
    [initial],
  );

  const legend = DELETE_TARGETS.map(
    (k) => `${k} (h₁=${cuckooHash1(k, CAPACITY)}, h₂=${cuckooHash2(k, CAPACITY)})`,
  ).join(", ");

  return (
    <VizSection
      ariaLabel="Cuckoo delete"
      codePanelAriaLabel="Cuckoo delete pseudocode"
      caption={legend}
      steps={steps}
      source={cuckooDeletePython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Lookups", value: countKind(visible, "check") },
        { label: "Removed", value: countKind(visible, "remove") },
        { label: "Misses", value: countKind(visible, "miss") },
      ]}
      renderView={(currentStep) => (
        <CuckooView
          table={currentStep?.table ?? initial}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
