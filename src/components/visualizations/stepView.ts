import type { SortStep } from "@/lib/algorithms/types";
import type { Highlight } from "./ArrayBars";

export function highlightsFor(step: SortStep | undefined): Highlight[] {
  if (!step) return [];
  switch (step.kind) {
    case "compare":
      return step.indices.map((i) => ({ index: i, kind: "compare" }) as const);
    case "swap":
      return step.indices.map((i) => ({ index: i, kind: "swap" }) as const);
    case "write":
      return [{ index: step.index, kind: "swap" }];
    case "pivot":
      return [{ index: step.index, kind: "pivot" }];
    case "range":
      return [];
    case "done":
      return step.array.map((_, i) => ({ index: i, kind: "sorted" }) as const);
  }
}

export function activeRangeFor(step: SortStep | undefined): readonly [number, number] | undefined {
  if (!step) return undefined;
  if (step.kind === "range") return step.range;
  if ("range" in step) return step.range;
  return undefined;
}

export function countCompares(steps: readonly SortStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "compare") n++;
  return n;
}

export function countSwapsAndWrites(steps: readonly SortStep[]): number {
  let n = 0;
  for (const s of steps) if (s.kind === "swap" || s.kind === "write") n++;
  return n;
}
