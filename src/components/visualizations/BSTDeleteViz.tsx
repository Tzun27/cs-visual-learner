"use client";

import { useMemo } from "react";
import { buildTree, deleteSequence } from "@/lib/dataStructures/binarySearchTree";
import { bstDeletePython } from "@/lib/dataStructures/deleteSequence.snippet";
import type { BstDeleteStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { TreeView, type TreeHighlight } from "./TreeView";
import { VizSection } from "./VizSection";

const BUILD_SEQUENCE = [50, 25, 75, 12, 38, 63, 88, 6, 19, 31, 56, 81] as const;
// Curated to demonstrate all three textbook cases in order:
//   6  → leaf delete
//   38 → one-child delete (38 has only a left child, 31)
//   50 → two-children delete (successor walk: 75 → 63 → 56)
const DELETE_TARGETS = [6, 38, 50] as const;

export type BSTDeleteVizProps = {
  initialSpeedMs?: number;
};

const CASE_LABEL = {
  leaf: "leaf",
  "one-child": "one child",
  "two-children": "two children",
} as const;

function highlightsFor(step: BstDeleteStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "miss":
    case "unlink":
    case "done":
      return [];
    case "compare":
      return [{ nodeId: step.cursorId, kind: "cursor" }];
    case "found":
      return [{ nodeId: step.cursorId, kind: "duplicate" }];
    case "find-successor":
      return [
        { nodeId: step.targetCursorId, kind: "duplicate" },
        { nodeId: step.cursorId, kind: "cursor" },
      ];
    case "swap-value":
      return [
        { nodeId: step.targetCursorId, kind: "placed" },
        { nodeId: step.successorId, kind: "duplicate" },
      ];
  }
}

function annotationFor(step: BstDeleteStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Deleting ${step.targetValue}`;
    case "compare": {
      const node = step.tree.nodes[step.cursorId];
      const direction =
        step.targetValue < node.value
          ? "go left"
          : step.targetValue > node.value
            ? "go right"
            : "match";
      return `Compare ${step.targetValue} vs ${node.value} → ${direction}`;
    }
    case "found":
      return `Found ${step.targetValue} — ${CASE_LABEL[step.deleteCase]} case`;
    case "find-successor": {
      const node = step.tree.nodes[step.cursorId];
      return `Walking to inorder successor — at ${node.value}`;
    }
    case "swap-value":
      return `Copy successor ${step.newValue} into target slot`;
    case "unlink":
      return `Removed ${step.removedValue} (${CASE_LABEL[step.deleteCase]})`;
    case "miss":
      return `${step.targetValue} not in tree`;
    case "done":
      return "Done";
  }
}

export function BSTDeleteViz({ initialSpeedMs = 450 }: BSTDeleteVizProps) {
  const tree = useMemo(() => buildTree(BUILD_SEQUENCE), []);
  const steps = useMemo<readonly BstDeleteStep[]>(
    () => [...deleteSequence(tree, DELETE_TARGETS)],
    [tree],
  );

  return (
    <VizSection
      ariaLabel="Binary search tree delete"
      codePanelAriaLabel="BST delete pseudocode"
      caption={`Deleting ${DELETE_TARGETS.join(", ")} from a balanced tree`}
      steps={steps}
      source={bstDeletePython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Comparisons", value: countKind(visible, "compare") },
        { label: "Successor walks", value: countKind(visible, "find-successor") },
        { label: "Removed", value: countKind(visible, "unlink") },
      ]}
      renderView={(currentStep) => (
        <TreeView
          tree={currentStep?.tree ?? tree}
          highlights={highlightsFor(currentStep)}
          className="w-full"
        />
      )}
    />
  );
}
