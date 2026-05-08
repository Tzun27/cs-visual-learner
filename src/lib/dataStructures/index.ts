import { insertSequence } from "./binarySearchTree";
import type { BstSequenceOp } from "./types";

export const bstOperations = {
  insert: insertSequence,
} as const satisfies Record<string, BstSequenceOp>;

export type BstOperationKey = keyof typeof bstOperations;

export const bstOperationLabels: Record<BstOperationKey, string> = {
  insert: "Insert sequence",
};
