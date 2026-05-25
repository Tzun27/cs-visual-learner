"use client";

import { useMemo } from "react";
import { buildHashTable, deleteSequence } from "@/lib/dataStructures/hashTable";
import { hashTableDeletePython } from "@/lib/dataStructures/hashTableDelete.snippet";
import type { HashTableDeleteStep, HashTableKV } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { HashTableView, type HashCellHighlight } from "./HashTableView";
import { VizSection } from "./VizSection";

// Pre-built table:
//   bucket 1 = [(1, 10), (9, 90), (17, 170), (25, 250)]
//   bucket 2 = [(2, 20)]
// Values are 10× key for easy sanity-reading by the user.
const BUILD_PAIRS: readonly HashTableKV[] = [
  [1, 10],
  [9, 90],
  [17, 170],
  [25, 250],
  [2, 20],
] as const;
// 9  → middle of chain;  25 → tail of chain;  1 → head of chain;
// 99 → miss in an empty bucket (no probes).
const DELETE_TARGETS = [9, 25, 1, 99] as const;

export type HashTableDeleteVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: HashTableDeleteStep | undefined): HashCellHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "hash":
    case "miss":
    case "unlink":
    case "done":
      return [];
    case "probe":
      return [{ entryId: step.cursorEntryId, kind: "cursor" }];
    case "found":
      return [{ entryId: step.cursorEntryId, kind: "duplicate" }];
  }
}

function activeBucketFor(step: HashTableDeleteStep | undefined): number | undefined {
  if (!step) return undefined;
  if ("bucketIndex" in step) return step.bucketIndex;
  return undefined;
}

function annotationFor(step: HashTableDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `remove(${step.targetKey})`;
    case "hash":
      return `hash(${step.targetKey}) % 8 = ${step.bucketIndex}`;
    case "probe": {
      const cursor = step.table.entries[step.cursorEntryId];
      return `Probing key ${cursor.key} (value ${cursor.value}) in bucket ${step.bucketIndex}`;
    }
    case "found":
      return `Found key ${step.targetKey}`;
    case "unlink":
      return `Removed key ${step.targetKey} from bucket ${step.bucketIndex}`;
    case "miss":
      return `${step.targetKey} not in bucket ${step.bucketIndex}`;
    case "done":
      return "Done";
  }
}

export function HashTableDeleteViz({ initialSpeedMs = 400 }: HashTableDeleteVizProps) {
  const initial = useMemo(() => buildHashTable(BUILD_PAIRS), []);
  const steps = useMemo<readonly HashTableDeleteStep[]>(
    () => [...deleteSequence(initial, DELETE_TARGETS)],
    [initial],
  );

  return (
    <VizSection
      ariaLabel="Hash table delete"
      codePanelAriaLabel="Hash table delete pseudocode"
      caption={`remove(${DELETE_TARGETS.join("), remove(")})`}
      steps={steps}
      source={hashTableDeletePython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Probes", value: countKind(visible, "probe") },
        { label: "Removed", value: countKind(visible, "unlink") },
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
