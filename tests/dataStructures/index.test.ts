import { describe, it, expect } from "vitest";
import { bstOperations, bstOperationLabels } from "@/lib/dataStructures";
import { insertSequence } from "@/lib/dataStructures/binarySearchTree";

describe("data-structures index registry", () => {
  it("registers BST insert under the 'insert' key with a label", () => {
    expect(bstOperations.insert).toBe(insertSequence);
    expect(bstOperationLabels.insert).toBe("Insert sequence");
  });

  it("the registered operation is callable as a sequence generator", () => {
    const steps = [...bstOperations.insert([5, 3])];
    // Sanity-only: shape of the first/last step. Detailed BST tests
    // already cover the generator's correctness.
    expect(steps[0].kind).toBe("begin");
    expect(steps.at(-1)?.kind).toBe("done");
  });
});
