"use client";

import { useMemo } from "react";
import {
  cuckooFilterAlt,
  cuckooFilterFingerprint,
  cuckooFilterHome,
  cuckooFilterInsertSequence,
  emptyCuckooFilter,
} from "@/lib/dataStructures/cuckooFilter";
import { cuckooFilterInsertPython } from "@/lib/dataStructures/cuckooFilterInsert.snippet";
import type { CuckooFilterInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { CuckooFilterView, type CuckooFilterHighlight } from "./CuckooFilterView";
import { HashVizSection } from "./HashVizSection";

const CAPACITY = 8;
// Curated cascade: [5, 0, 7] place directly via the home-check path;
// 13 triggers a two-step eviction cascade — its primary and alternate
// slots are both occupied, the eviction at home displaces fp=6 which
// finds its alternate also occupied, displaces fp=1 which lands at the
// empty T[4]. Final: T = [1, _, _, _, 1, 7, _, 6].
const INSERT_SEQUENCE = [5, 0, 7, 13] as const;
const INITIAL = emptyCuckooFilter(CAPACITY);

export type CuckooFilterInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooFilterInsertStep | undefined): CuckooFilterHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "fingerprint":
    case "done":
    case "cycle":
      return [];
    case "hash":
      return [
        { slotIndex: step.home, kind: "cursor" },
        { slotIndex: step.alt, kind: "cursor" },
      ];
    case "check":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "place":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "evict":
      // Dual highlight per cuckoo-hashing decision 44: placed = where
      // the active fp now lives; cursor = next slot the displaced fp
      // will inspect.
      return [
        { slotIndex: step.slotIndex, kind: "placed" },
        { slotIndex: step.nextSlotIndex, kind: "cursor" },
      ];
  }
}

function annotationFor(step: CuckooFilterInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "fingerprint":
      return `Fingerprint of ${step.insertingKey} = ${step.fingerprint}`;
    case "hash":
      return `h₁ = ${step.home}, alt = h₁ ⊕ hashFp(${step.fingerprint}) = ${step.alt}`;
    case "check": {
      const phaseDesc =
        step.phase === "home" ? "home" : step.phase === "alt" ? "alternate" : "cascade alternate";
      const slot = step.table.slots[step.slotIndex];
      const desc =
        slot.state === "occupied"
          ? slot.fingerprint === step.activeFingerprint
            ? `holds fp=${slot.fingerprint} (same fingerprint — collision)`
            : `holds fp=${slot.fingerprint}`
          : "empty";
      return `Check ${phaseDesc} slot T[${step.slotIndex}]: ${desc}`;
    }
    case "place":
      return `Placed fp=${step.placedFingerprint} at T[${step.slotIndex}]`;
    case "evict":
      return `Evict T[${step.slotIndex}]: store fp=${step.placedFingerprint}, fp=${step.evictedFingerprint} now heading to T[${step.nextSlotIndex}]`;
    case "cycle":
      return `Cycle while inserting ${step.insertingKey} — rehash required`;
    case "done":
      return "Done";
  }
}

export function CuckooFilterInsertViz({ initialSpeedMs = 400 }: CuckooFilterInsertVizProps) {
  const steps = useMemo<readonly CuckooFilterInsertStep[]>(
    () => [...cuckooFilterInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  const legend = INSERT_SEQUENCE.map((k) => {
    const fp = cuckooFilterFingerprint(k);
    const home = cuckooFilterHome(k, CAPACITY);
    const alt = cuckooFilterAlt(home, fp, CAPACITY);
    return `${k}: fp=${fp}, h₁=${home}, alt=${alt}`;
  }).join(" · ");

  return (
    <HashVizSection
      ariaLabel="Cuckoo filter insert"
      codePanelAriaLabel="Cuckoo filter insert pseudocode"
      caption={legend}
      steps={steps}
      source={cuckooFilterInsertPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Placed", value: countKind(visible, "place") },
        { label: "Evictions", value: countKind(visible, "evict") },
      ]}
      renderView={(currentStep) => (
        <CuckooFilterView
          table={currentStep?.table ?? INITIAL}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
