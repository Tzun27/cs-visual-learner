"use client";

import { useMemo } from "react";
import { buildHopscotchTable, hopscotchSearchSequence } from "@/lib/dataStructures/hopscotch";
import { hopscotchSearchPython } from "@/lib/dataStructures/hopscotchSearch.snippet";
import type { HopscotchSearchStep, HopscotchSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { HashVizSection } from "./HashVizSection";
import {
  HopscotchView,
  type HopscotchBitHighlight,
  type HopscotchHighlight,
} from "./HopscotchView";

const CAPACITY = 8;

// Same end state as the insert section: slots 0,1,2,3,4 → 0,16,8,9,1.
// hopInfo[0] = bits {0,1,2} (slots 0, 1, 2 hold keys with home 0);
// hopInfo[1] = bits {2,3} (slots 3, 4 hold keys with home 1).
function buildInitialTable(): HopscotchSnapshot {
  return buildHopscotchTable(CAPACITY, [0, 1, 8, 9, 16]);
}

// Targets exercise the four pedagogical cases for hopscotch lookup:
//   0  → home 0, mask bit 0 set, slot 0 = 0 → found in one check
//   16 → home 0, bit 0 (slot 0 = 0, ≠ 16), bit 1 (slot 1 = 16, = 16) → found
//   9  → home 1, bit 0 (clear), bit 1 (clear), bit 2 (slot 3 = 9, = 9) → found
//   99 → home 3, hopInfo[3] = 0; all four bit checks come back clear → miss
const SEARCH_TARGETS = [0, 16, 9, 99] as const;

export type HopscotchSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HopscotchSearchStep | undefined): HopscotchHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "hash":
      return [{ slotIndex: step.home, kind: "cursor" }];
    case "check-bit":
      // Highlight the slot the bit refers to (set or clear) so the reader
      // sees the bit ↔ slot mapping.
      return [{ slotIndex: step.slotIndex, kind: "cursor" }];
    case "found":
      return [{ slotIndex: step.slotIndex, kind: "placed" }];
    case "miss":
      return [{ slotIndex: step.home, kind: "duplicate" }];
  }
}

function bitHighlightsFor(step: HopscotchSearchStep | undefined): HopscotchBitHighlight[] {
  if (!step) return [];
  if (step.kind === "check-bit") {
    return [{ homeIndex: step.home, bitIndex: step.bitIndex }];
  }
  return [];
}

function activeHomeFor(step: HopscotchSearchStep | undefined): number | null {
  if (!step) return null;
  switch (step.kind) {
    case "hash":
    case "check-bit":
    case "found":
    case "miss":
      return step.home;
    default:
      return null;
  }
}

function annotationFor(step: HopscotchSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetKey}`;
    case "hash":
      return `hash(${step.targetKey}) % ${step.table.capacity} = ${step.home}; mask = 0b${step.hopMask.toString(2).padStart(step.table.neighborhood, "0")}`;
    case "check-bit": {
      const slot = step.table.slots[step.slotIndex];
      const slotDesc = slot.state === "occupied" ? `holds ${slot.key}` : "is empty";
      return step.isSet
        ? `Bit ${step.bitIndex} set → check slot ${step.slotIndex} (${slotDesc})`
        : `Bit ${step.bitIndex} clear → skip slot ${step.slotIndex}`;
    }
    case "found":
      return `Found ${step.targetKey} at slot ${step.slotIndex}`;
    case "miss":
      return `Not found — no set bit produced a match`;
    case "done":
      return "Done";
  }
}

export function HopscotchSearchViz({ initialSpeedMs = 450 }: HopscotchSearchVizProps) {
  const initial = useMemo<HopscotchSnapshot>(() => buildInitialTable(), []);
  const steps = useMemo<readonly HopscotchSearchStep[]>(
    () => [...hopscotchSearchSequence(initial, SEARCH_TARGETS)],
    [initial],
  );

  return (
    <HashVizSection
      ariaLabel="Hopscotch search"
      codePanelAriaLabel="Hopscotch search pseudocode"
      caption={`Searching ${SEARCH_TARGETS.join(", ")} — lookups always look at at most ${
        CAPACITY === 8 ? 4 : "H"
      } slots`}
      steps={steps}
      source={hopscotchSearchPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Bits checked", value: countKind(visible, "check-bit") },
        { label: "Found", value: countKind(visible, "found") },
        { label: "Misses", value: countKind(visible, "miss") },
      ]}
      renderView={(currentStep) => (
        <HopscotchView
          table={currentStep?.table ?? initial}
          highlights={highlightsFor(currentStep)}
          bitHighlights={bitHighlightsFor(currentStep)}
          activeHome={activeHomeFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
