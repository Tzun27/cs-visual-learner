"use client";

import { useMemo } from "react";
import {
  buildCuckooFilter,
  cuckooFilterAlt,
  cuckooFilterDeleteSequence,
  cuckooFilterFingerprint,
  cuckooFilterHome,
} from "@/lib/dataStructures/cuckooFilter";
import { cuckooFilterDeletePython } from "@/lib/dataStructures/cuckooFilterDelete.snippet";
import type { CuckooFilterDeleteStep, CuckooFilterSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { CuckooFilterView, type CuckooFilterHighlight } from "./CuckooFilterView";
import { HashVizSection } from "./HashVizSection";

const CAPACITY = 8;
const INSERT_SEQUENCE = [5, 0, 7, 13] as const;
// Two-target delete demo:
//   13 → fp=7, h₁=5, alt=0. T[5]=fp=7 matches → clear. One check, one removed.
//   99 → fp=2, h₁=3, alt=5. T[3] empty, T[5] now empty too → miss.
const DELETE_TARGETS = [13, 99] as const;

export type CuckooFilterDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooFilterDeleteStep | undefined): CuckooFilterHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "fingerprint":
    case "miss":
    case "done":
      return [];
    case "hash":
      return [
        { slotIndex: step.home, kind: "cursor" },
        { slotIndex: step.alt, kind: "cursor" },
      ];
    case "check":
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
    case "remove":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
  }
}

function annotationFor(step: CuckooFilterDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Deleting ${step.targetKey}`;
    case "fingerprint":
      return `Fingerprint of ${step.targetKey} = ${step.fingerprint}`;
    case "hash":
      return `h₁ = ${step.home}, alt = ${step.alt}`;
    case "check": {
      const phaseDesc = step.phase === "home" ? "home" : "alternate";
      const slot = step.table.slots[step.slotIndex];
      const desc =
        slot.state === "occupied"
          ? slot.fingerprint === step.fingerprint
            ? `holds fp=${slot.fingerprint} — match`
            : `holds fp=${slot.fingerprint}`
          : "empty";
      return `Check ${phaseDesc} T[${step.slotIndex}]: ${desc}`;
    }
    case "found":
      return `Matching fp=${step.fingerprint} at T[${step.slotIndex}]`;
    case "remove":
      return `Cleared T[${step.slotIndex}] — no tombstone needed`;
    case "miss":
      return `${step.targetKey} not in filter — nothing to remove`;
    case "done":
      return "Done";
  }
}

export function CuckooFilterDeleteViz({ initialSpeedMs = 400 }: CuckooFilterDeleteVizProps) {
  const initial = useMemo<CuckooFilterSnapshot>(
    () => buildCuckooFilter(CAPACITY, INSERT_SEQUENCE),
    [],
  );
  const steps = useMemo<readonly CuckooFilterDeleteStep[]>(
    () => [...cuckooFilterDeleteSequence(initial, DELETE_TARGETS)],
    [initial],
  );

  const legend = DELETE_TARGETS.map((k) => {
    const fp = cuckooFilterFingerprint(k);
    const home = cuckooFilterHome(k, CAPACITY);
    const alt = cuckooFilterAlt(home, fp, CAPACITY);
    return `${k}: fp=${fp}, h₁=${home}, alt=${alt}`;
  }).join(" · ");

  return (
    <HashVizSection
      ariaLabel="Cuckoo filter delete"
      codePanelAriaLabel="Cuckoo filter delete pseudocode"
      caption={legend}
      steps={steps}
      source={cuckooFilterDeletePython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Lookups", value: countKind(visible, "check") },
        { label: "Removed", value: countKind(visible, "remove") },
        { label: "Misses", value: countKind(visible, "miss") },
      ]}
      renderView={(currentStep) => (
        <CuckooFilterView
          table={currentStep?.table ?? initial}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
