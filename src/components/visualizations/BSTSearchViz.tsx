"use client";

import { useMemo } from "react";
import { buildTree, searchSequence } from "@/lib/dataStructures/binarySearchTree";
import { bstSearchPython } from "@/lib/dataStructures/searchSequence.snippet";
import type { BstSearchStep } from "@/lib/dataStructures/types";
import { countKind } from "@/lib/stepCount";
import { TreeView, type TreeHighlight } from "./TreeView";
import { VizSection } from "./VizSection";

const BUILD_SEQUENCE = [50, 25, 75, 12, 38, 63, 88, 6, 19, 31, 56, 81] as const;
// Curated mix: 12 (left subtree hit), 56 (right subtree hit), 50 (root hit),
// 33 (lands between 31 and 38 — miss), 99 (off the right end — miss).
const SEARCH_TARGETS = [12, 56, 50, 33, 99] as const;

export type BSTSearchVizProps = {
  initialSpeedMs?: number;
};

function highlightsFor(step: BstSearchStep | undefined): TreeHighlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "begin":
    case "miss":
    case "done":
      return [];
    case "compare":
      return [{ nodeId: step.cursorId, kind: "cursor" }];
    case "found":
      return [{ nodeId: step.cursorId, kind: "placed" }];
  }
}

function annotationFor(step: BstSearchStep | undefined): string | null {
  if (!step) return null;
  switch (step.kind) {
    case "begin":
      return `Searching for ${step.targetValue}`;
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
      return `Found ${step.targetValue}`;
    case "miss":
      return `${step.targetValue} not in tree`;
    case "done":
      return "Done";
  }
}

export function BSTSearchViz({ initialSpeedMs = 350 }: BSTSearchVizProps) {
  const tree = useMemo(() => buildTree(BUILD_SEQUENCE), []);
  const steps = useMemo<readonly BstSearchStep[]>(
    () => [...searchSequence(tree, SEARCH_TARGETS)],
    [tree],
  );

  return (
    <VizSection
      ariaLabel="Binary search tree search"
      codePanelAriaLabel="BST search pseudocode"
      caption={`Searching for ${SEARCH_TARGETS.join(", ")}`}
      steps={steps}
      source={bstSearchPython}
      initialSpeedMs={initialSpeedMs}
      annotationFor={annotationFor}
      counters={(visible) => [
        { label: "Comparisons", value: countKind(visible, "compare") },
        { label: "Found", value: countKind(visible, "found") },
        { label: "Misses", value: countKind(visible, "miss") },
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
