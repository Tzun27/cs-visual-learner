"use client";

import { useMemo } from "react";
import { insertSequence } from "@/lib/dataStructures/hashTable";
import { hashTableInsertPython } from "@/lib/dataStructures/hashTableInsert.snippet";
import type { HashTableKV, HashTableSnapshot, HashTableStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { HashTableView, type HashCellHighlight } from "./HashTableView";
import { HashVizSection } from "./HashVizSection";

// Curated to show collisions building up in bucket 5, a smaller chain in
// bucket 4, and an OVERWRITE on the second put with key 5 (map semantics —
// the duplicate key replaces the existing value rather than getting
// dropped). Pairs are (key, value); think of them as (player_id, score).
//   (5, 100)  → b5
//   (13, 250) → b5 (collide)
//   (21, 75)  → b5 (collide again)
//   (4, 200)  → b4
//   (12, 90)  → b4 (collide)
//   (5, 150)  → OVERWRITE the existing key=5 entry's value 100 → 150
//   (7, 175)  → b7
const INSERT_SEQUENCE: readonly HashTableKV[] = [
  [5, 100],
  [13, 250],
  [21, 75],
  [4, 200],
  [12, 90],
  [5, 150],
  [7, 175],
] as const;
const EMPTY: HashTableSnapshot = {
  capacity: 8,
  entries: [],
  buckets: Array.from({ length: 8 }, () => []),
};
const insertLabel = (kv: HashTableKV) => `(${kv[0]}, ${kv[1]})`;

export type HashTableInsertVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HashTableStep | undefined): HashCellHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "hash":
    case "done":
      return [];
    case "probe":
      return [{ entryId: step.cursorEntryId, kind: "cursor" }];
    case "overwrite":
      // The entry's value was just replaced — paint it the "placed"
      // yellow so the user can read it as "the new value lives here."
      // (Same color we use for fresh placements; the annotation text
      // tells the user it was an overwrite rather than a brand-new
      // entry.)
      return [{ entryId: step.cursorEntryId, kind: "placed" }];
    case "place":
      return [{ entryId: step.newEntryId, kind: "placed" }];
  }
}

function activeBucketFor(step: HashTableStep | undefined): number | undefined {
  if (!step) return undefined;
  if ("bucketIndex" in step) return step.bucketIndex;
  return undefined;
}

function ghostBucketFor(step: HashTableStep | undefined): number | null {
  if (!step) return null;
  // After hashing but before deciding place vs duplicate, hint at where the
  // key will land if it isn't already present.
  if (step.kind === "hash") return step.bucketIndex;
  if (step.kind === "probe") return step.bucketIndex;
  return null;
}

function annotationFor(step: HashTableStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `put(${step.insertingKey}, ${step.insertingValue})`;
    case "hash":
      return `hash(${step.insertingKey}) % 8 = ${step.bucketIndex}`;
    case "probe": {
      const cursor = step.table.entries[step.cursorEntryId];
      return `Probing key ${cursor.key} (value ${cursor.value}) in bucket ${step.bucketIndex}`;
    }
    case "overwrite":
      return `Key ${step.insertingKey} already present — overwrite value ${step.oldValue} → ${step.insertingValue}`;
    case "place": {
      const entry = step.table.entries[step.newEntryId];
      return `Placed (${entry.key}, ${entry.value}) in bucket ${step.bucketIndex}`;
    }
    case "done":
      return "Done";
  }
}

export function HashTableInsertViz({ initialSpeedMs = 400 }: HashTableInsertVizProps) {
  const steps = useMemo<readonly HashTableStep[]>(() => [...insertSequence(INSERT_SEQUENCE)], []);

  return (
    <HashVizSection
      ariaLabel="Hash table insert"
      codePanelAriaLabel="Hash table insert pseudocode"
      caption={`Putting ${INSERT_SEQUENCE.map(insertLabel).join(", ")} into 8 buckets`}
      steps={steps}
      source={hashTableInsertPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Probes", value: countKind(visible, "probe") },
        { label: "Placed", value: countKind(visible, "place") },
        { label: "Overwrites", value: countKind(visible, "overwrite") },
      ]}
      renderView={(currentStep) => (
        <HashTableView
          table={currentStep?.table ?? EMPTY}
          highlights={highlightsFor(currentStep)}
          activeBucketIndex={activeBucketFor(currentStep)}
          ghostBucketIndex={ghostBucketFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
