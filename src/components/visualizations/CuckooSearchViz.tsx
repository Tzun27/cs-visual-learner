"use client";

import { useMemo } from "react";
import {
  buildCuckooTable,
  cuckooHash1,
  cuckooHash2,
  cuckooSearchSequence,
} from "@/lib/dataStructures/cuckoo";
import { cuckooSearchPython } from "@/lib/dataStructures/cuckooSearch.snippet";
import type { CuckooSearchStep, CuckooSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { CuckooView, type CuckooHighlight } from "./CuckooView";
import { HashVizSection } from "./HashVizSection";

const CAPACITY = 7;
const INSERT_SEQUENCE = [5, 0, 12, 14] as const;

// Targets cover all four search outcomes:
//   5  → T_A[5] hit in one check
//   12 → T_A[5] miss (holds 5), T_B[1] hit in two checks (worst case)
//   0  → T_A[0] miss (holds 14), T_B[0] hit in two checks
//   99 → T_A[1] empty, T_B[0] miss (holds 0), miss after two checks
const SEARCH_TARGETS = [5, 12, 0, 99] as const;

export type CuckooSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooSearchStep | undefined): CuckooHighlight[] {
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
      return [{ side: step.side, slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      // No specific slot to fault — both candidates were checked. Leave
      // highlights empty so the annotation carries the message.
      return [];
  }
}

function annotationFor(step: CuckooSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetKey}`;
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
    case "miss":
      return `${step.targetKey} not in either candidate slot — miss`;
    case "done":
      return "Done";
  }
}

export function CuckooSearchViz({ initialSpeedMs = 400 }: CuckooSearchVizProps) {
  const initial = useMemo<CuckooSnapshot>(() => buildCuckooTable(CAPACITY, INSERT_SEQUENCE), []);
  const steps = useMemo<readonly CuckooSearchStep[]>(
    () => [...cuckooSearchSequence(initial, SEARCH_TARGETS)],
    [initial],
  );

  const legend = SEARCH_TARGETS.map(
    (k) => `${k} (h₁=${cuckooHash1(k, CAPACITY)}, h₂=${cuckooHash2(k, CAPACITY)})`,
  ).join(", ");

  return (
    <HashVizSection
      ariaLabel="Cuckoo search"
      codePanelAriaLabel="Cuckoo search pseudocode"
      caption={legend}
      steps={steps}
      source={cuckooSearchPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Lookups", value: countKind(visible, "check") },
        { label: "Found", value: countKind(visible, "found") },
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
