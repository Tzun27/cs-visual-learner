"use client";

import { useMemo } from "react";
import {
  BLOOM_FILTER_M,
  bloomFilterBitIndices,
  bloomFilterSearchSequence,
  buildBloomFilter,
} from "@/lib/dataStructures/bloomFilter";
import { bloomFilterSearchPython } from "@/lib/dataStructures/bloomFilterSearch.snippet";
import type { BloomFilterSearchStep, BloomFilterSnapshot } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { BloomFilterView, type BloomFilterHighlight } from "./BloomFilterView";
import { HashVizSection } from "./HashVizSection";

const INSERT_SEQUENCE = [1, 6, 12, 9] as const;

// Targets curated to cover all four outcomes:
//   1  → true positive. Bits {1, 2, 8} all set. Three checks.
//   9  → true positive with bit-sharing. Bits {0, 9, 10} all set;
//        bit 9 was set both by inserting 12 and again by 9 itself.
//   7  → FALSE POSITIVE. Never inserted. Bits {7, 10, 12} happen to all
//        be set — each by a DIFFERENT prior insert: bit 7 from 6, bit
//        10 from 9, bit 12 from 12. The lesson's load-bearing moment.
//   5  → true negative. Bits {5, 4, 14}: bit 5 set, bit 4 not set —
//        short-circuits on the second check, showing early termination.
const SEARCH_TARGETS = [1, 9, 7, 5] as const;

// Keys actually inserted — used to label whether each "found" report
// is a true positive or a false positive.
const ACTUALLY_INSERTED = new Set<number>(INSERT_SEQUENCE);

export type BloomFilterSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: BloomFilterSearchStep | undefined): BloomFilterHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "done":
      return [];
    case "compute-hashes":
      return step.bitIndices.map((bitIndex) => ({ bitIndex, kind: "cursor" }) as const);
    case "check-bit":
      return [{ bitIndex: step.bitIndex, kind: "cursor" }];
    case "found":
      // A found-step whose target was never inserted is a false
      // positive; colour all matched bits red. True positives go
      // yellow. This mirrors the cuckoo filter viz's true-vs-false-
      // positive cue.
      return step.bitIndices.map(
        (bitIndex) =>
          ({
            bitIndex,
            kind: ACTUALLY_INSERTED.has(step.targetKey) ? "placed" : "duplicate",
          }) as const,
      );
    case "miss":
      return [{ bitIndex: step.offBitIndex, kind: "duplicate" }];
  }
}

function annotationFor(step: BloomFilterSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Checking ${step.targetKey}`;
    case "compute-hashes":
      return `Hash ${step.targetKey} → bits {${step.bitIndices.join(", ")}}`;
    case "check-bit": {
      const setDesc = step.isSet ? "is 1" : "is 0 — short-circuit miss";
      return `Check bit ${step.bitIndex} (h${step.hashIndex + 1}): ${setDesc}`;
    }
    case "found": {
      const realLabel = ACTUALLY_INSERTED.has(step.targetKey)
        ? "true positive"
        : "FALSE POSITIVE — never inserted";
      return `Reports ${step.targetKey} found — all k bits set (${realLabel})`;
    }
    case "miss":
      return `${step.targetKey} not in filter — bit ${step.offBitIndex} is 0`;
    case "done":
      return "Done";
  }
}

// "found" steps where the target was never actually inserted.
function countFalsePositives(steps: readonly BloomFilterSearchStep[]): number {
  let n = 0;
  for (const s of steps) {
    if (s.kind === "found" && !ACTUALLY_INSERTED.has(s.targetKey)) n++;
  }
  return n;
}

export function BloomFilterSearchViz({ initialSpeedMs = 400 }: BloomFilterSearchVizProps) {
  const initial = useMemo<BloomFilterSnapshot>(
    () => buildBloomFilter(BLOOM_FILTER_M, INSERT_SEQUENCE),
    [],
  );
  const steps = useMemo<readonly BloomFilterSearchStep[]>(
    () => [...bloomFilterSearchSequence(initial, SEARCH_TARGETS)],
    [initial],
  );

  const legend = SEARCH_TARGETS.map((k) => {
    const bits = bloomFilterBitIndices(k, BLOOM_FILTER_M);
    return `${k}: bits {${bits.join(", ")}}`;
  }).join(" · ");

  return (
    <HashVizSection
      ariaLabel="Bloom filter contains"
      codePanelAriaLabel="Bloom filter contains pseudocode"
      caption={legend}
      steps={steps}
      source={bloomFilterSearchPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Lookups", value: countKind(visible, "check-bit") },
        { label: "Found", value: countKind(visible, "found") },
        { label: "False+", value: countFalsePositives(visible) },
        { label: "Misses", value: countKind(visible, "miss") },
      ]}
      renderView={(currentStep) => (
        <BloomFilterView
          table={currentStep?.table ?? initial}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
