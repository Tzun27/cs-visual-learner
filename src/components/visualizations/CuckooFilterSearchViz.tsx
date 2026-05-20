"use client";

import { useMemo } from "react";
import {
  buildCuckooFilter,
  cuckooFilterAlt,
  cuckooFilterFingerprint,
  cuckooFilterHome,
  cuckooFilterSearchSequence,
} from "@/lib/dataStructures/cuckooFilter";
import { cuckooFilterSearchPython } from "@/lib/dataStructures/cuckooFilterSearch.snippet";
import type { CuckooFilterSearchStep, CuckooFilterSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { CuckooFilterView, type CuckooFilterHighlight } from "./CuckooFilterView";
import { HashVizSection } from "./HashVizSection";

const CAPACITY = 8;
const INSERT_SEQUENCE = [5, 0, 7, 13] as const;

// Curated set covers all five outcomes:
//   13 → home hit at T[5], one check.
//   5  → home miss (T[5]=fp=7), alt hit at T[7] (fp=6), two checks. Worst-case for true positives.
//   0  → home hit at T[0], one check.
//   35 → FALSE POSITIVE. Never inserted. fp(35)=1, h₁=3, alt=0. T[3] empty, T[0]=fp=1 → reports found.
//        The lesson's load-bearing pedagogical moment.
//   99 → true negative. fp(99)=2, h₁=3, alt=5. T[3] empty, T[5]=fp=7 → miss.
const SEARCH_TARGETS = [13, 5, 0, 35, 99] as const;

// Keys actually inserted into the filter — used to label whether each
// "found" report is a true positive or a false positive.
const ACTUALLY_INSERTED = new Set<number>(INSERT_SEQUENCE);

export type CuckooFilterSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: CuckooFilterSearchStep | undefined): CuckooFilterHighlight[] {
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
      // A found-step that's actually a false positive gets the "duplicate"
      // (red) color to visually flag the disagreement between algorithm
      // and reality. True positives get "placed" (yellow).
      return [
        {
          slotIndex: step.slotIndex,
          kind: ACTUALLY_INSERTED.has(step.targetKey) ? "placed" : "duplicate",
        },
      ];
  }
}

function annotationFor(step: CuckooFilterSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetKey}`;
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
    case "found": {
      const realLabel = ACTUALLY_INSERTED.has(step.targetKey)
        ? "true positive"
        : "FALSE POSITIVE — never inserted";
      return `Reports ${step.targetKey} found at T[${step.slotIndex}] (${realLabel})`;
    }
    case "miss":
      return `${step.targetKey} not in filter — fp=${step.fingerprint} absent from both candidate slots`;
    case "done":
      return "Done";
  }
}

// "found" steps where the target was never actually inserted.
function countFalsePositives(steps: readonly CuckooFilterSearchStep[]): number {
  let n = 0;
  for (const s of steps) {
    if (s.kind === "found" && !ACTUALLY_INSERTED.has(s.targetKey)) n++;
  }
  return n;
}

export function CuckooFilterSearchViz({ initialSpeedMs = 400 }: CuckooFilterSearchVizProps) {
  const initial = useMemo<CuckooFilterSnapshot>(
    () => buildCuckooFilter(CAPACITY, INSERT_SEQUENCE),
    [],
  );
  const steps = useMemo<readonly CuckooFilterSearchStep[]>(
    () => [...cuckooFilterSearchSequence(initial, SEARCH_TARGETS)],
    [initial],
  );

  const legend = SEARCH_TARGETS.map((k) => {
    const fp = cuckooFilterFingerprint(k);
    const home = cuckooFilterHome(k, CAPACITY);
    const alt = cuckooFilterAlt(home, fp, CAPACITY);
    return `${k}: fp=${fp}, h₁=${home}, alt=${alt}`;
  }).join(" · ");

  return (
    <HashVizSection
      ariaLabel="Cuckoo filter contains"
      codePanelAriaLabel="Cuckoo filter contains pseudocode"
      caption={legend}
      steps={steps}
      source={cuckooFilterSearchPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Lookups", value: countKind(visible, "check") },
        { label: "Found", value: countKind(visible, "found") },
        { label: "False+", value: countFalsePositives(visible) },
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
