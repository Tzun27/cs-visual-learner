"use client";

import { useMemo } from "react";
import {
  BLOOM_FILTER_M,
  bloomFilterBitIndices,
  bloomFilterInsertSequence,
  emptyBloomFilter,
} from "@/lib/dataStructures/bloomFilter";
import { bloomFilterInsertPython } from "@/lib/dataStructures/bloomFilterInsert.snippet";
import type { BloomFilterInsertStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { BloomFilterView, type BloomFilterHighlight } from "./BloomFilterView";
import { VizSection } from "./VizSection";

// Curated input. [1, 6, 12, 9] is chosen so that:
//   - 1 → bits {1, 2, 8} (three fresh bits)
//   - 6 → bits {5, 6, 7} (three fresh bits)
//   - 12 → bits {9, 12, 15} (three fresh bits)
//   - 9 → bits {0, 9, 10} — bit 9 is ALREADY set from inserting 12.
//     The viz uses the `alreadySet` field on this step to flag it red,
//     teaching the "Bloom filters can't tell who set a bit" moment.
// After all four inserts: 11 of 16 bits are set.
const INSERT_SEQUENCE = [1, 6, 12, 9] as const;
const INITIAL = emptyBloomFilter(BLOOM_FILTER_M);

export type BloomFilterInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: BloomFilterInsertStep | undefined): BloomFilterHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "compute-hashes":
      // Preview all three bits the insert is about to touch.
      return step.bitIndices.map((bitIndex) => ({ bitIndex, kind: "cursor" }) as const);
    case "set-bit":
      // `duplicate` (red) for already-set bits, `placed` (yellow) for
      // freshly set ones. This is the load-bearing visual cue for the
      // bit-sharing teaching moment.
      return [{ bitIndex: step.bitIndex, kind: step.alreadySet ? "duplicate" : "placed" }];
  }
}

function annotationFor(step: BloomFilterInsertStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Inserting ${step.insertingKey}`;
    case "compute-hashes":
      return `Hash ${step.insertingKey} → bits {${step.bitIndices.join(", ")}}`;
    case "set-bit": {
      const dup = step.alreadySet ? " (was already 1 — bit shared with an earlier insert)" : "";
      return `Set bit ${step.bitIndex} (h${step.hashIndex + 1}) = 1${dup}`;
    }
    case "done":
      return "Done";
  }
}

// Bits that flipped 0 → 1 during the visible step prefix. Different
// from total set-bit ops (k × items so far) because shared bits don't
// count twice — this is the actual saturation of the bit array.
function countNewBits(steps: readonly BloomFilterInsertStep[]): number {
  let n = 0;
  for (const s of steps) {
    if (s.kind === "set-bit" && !s.alreadySet) n++;
  }
  return n;
}

export function BloomFilterInsertViz({ initialSpeedMs = 400 }: BloomFilterInsertVizProps) {
  const steps = useMemo<readonly BloomFilterInsertStep[]>(
    () => [...bloomFilterInsertSequence(INITIAL, INSERT_SEQUENCE)],
    [],
  );

  const legend = INSERT_SEQUENCE.map((k) => {
    const bits = bloomFilterBitIndices(k, BLOOM_FILTER_M);
    return `${k}: bits {${bits.join(", ")}}`;
  }).join(" · ");

  return (
    <VizSection
      ariaLabel="Bloom filter insert"
      codePanelAriaLabel="Bloom filter insert pseudocode"
      caption={legend}
      steps={steps}
      source={bloomFilterInsertPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => {
        // Total items inserted so far = count of begin steps.
        const items = countKind(visible, "begin");
        const newBits = countNewBits(visible);
        return [
          { label: "Items", value: items },
          { label: `Bits set (of ${BLOOM_FILTER_M})`, value: newBits },
          { label: "Bit-set ops", value: countKind(visible, "set-bit") },
        ];
      }}
      renderView={(currentStep) => (
        <BloomFilterView
          table={currentStep?.table ?? INITIAL}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
