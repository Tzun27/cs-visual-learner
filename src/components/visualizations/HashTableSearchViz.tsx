"use client";

import { useMemo } from "react";
import { buildHashTable, searchSequence } from "@/lib/dataStructures/hashTable";
import { hashTableSearchPython } from "@/lib/dataStructures/hashTableSearch.snippet";
import type { HashTableKV, HashTableSearchStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { HashTableView, type HashCellHighlight } from "./HashTableView";
import { VizSection } from "./VizSection";

// Pre-built table:
//   bucket 1 = [(1, 10), (9, 90), (17, 170)]
//   bucket 2 = [(2, 20), (50, 500)]
// Values are 10× the key for easy mental verification — the user can sanity
// check "I asked for key 17 and got value 170" without external context.
const BUILD_PAIRS: readonly HashTableKV[] = [
  [1, 10],
  [9, 90],
  [17, 170],
  [2, 20],
  [50, 500],
] as const;
// 1  → head-of-chain hit; 17 → end-of-chain hit (3 probes);
// 50 → end-of-chain hit in a smaller bucket;
// 25 → miss after probing a non-empty bucket;
// 3  → miss against an empty bucket (0 probes).
const SEARCH_TARGETS = [1, 17, 50, 25, 3] as const;

export type HashTableSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HashTableSearchStep | undefined): HashCellHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "hash":
    case "miss":
    case "done":
      return [];
    case "probe":
      return [{ entryId: step.cursorEntryId, kind: "cursor" }];
    case "found":
      return [{ entryId: step.cursorEntryId, kind: "placed" }];
  }
}

function activeBucketFor(step: HashTableSearchStep | undefined): number | undefined {
  if (!step) return undefined;
  if ("bucketIndex" in step) return step.bucketIndex;
  return undefined;
}

function annotationFor(step: HashTableSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `get(${step.targetKey})`;
    case "hash":
      return `hash(${step.targetKey}) % 8 = ${step.bucketIndex}`;
    case "probe": {
      const cursor = step.table.entries[step.cursorEntryId];
      return `Probing key ${cursor.key} (value ${cursor.value}) in bucket ${step.bucketIndex}`;
    }
    case "found":
      return `Found key ${step.targetKey} → value ${step.foundValue}`;
    case "miss":
      return `${step.targetKey} not in bucket ${step.bucketIndex} → None`;
    case "done":
      return "Done";
  }
}

export function HashTableSearchViz({ initialSpeedMs = 400 }: HashTableSearchVizProps) {
  const initial = useMemo(() => buildHashTable(BUILD_PAIRS), []);
  const steps = useMemo<readonly HashTableSearchStep[]>(
    () => [...searchSequence(initial, SEARCH_TARGETS)],
    [initial],
  );

  return (
    <VizSection
      ariaLabel="Hash table search"
      codePanelAriaLabel="Hash table search pseudocode"
      caption={`get(${SEARCH_TARGETS.join("), get(")})`}
      steps={steps}
      source={hashTableSearchPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Probes", value: countKind(visible, "probe") },
        { label: "Found", value: countKind(visible, "found") },
        { label: "Misses", value: countKind(visible, "miss") },
      ]}
      renderView={(currentStep) => (
        <HashTableView
          table={currentStep?.table ?? initial}
          highlights={highlightsFor(currentStep)}
          activeBucketIndex={activeBucketFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
