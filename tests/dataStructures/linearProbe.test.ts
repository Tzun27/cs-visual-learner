import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildLinearProbeTable,
  emptyTable,
  linearProbeDeleteSequence,
  linearProbeInsertSequence,
  linearProbeSearchSequence,
  liveKeys,
  loadFactor,
  slotIndexFor,
} from "@/lib/dataStructures/linearProbe";
import { linearProbeDeletePython } from "@/lib/dataStructures/linearProbeDelete.snippet";
import { linearProbeInsertPython } from "@/lib/dataStructures/linearProbeInsert.snippet";
import { linearProbeSearchPython } from "@/lib/dataStructures/linearProbeSearch.snippet";
import type { LinearProbeSlot, LinearProbeSnapshot } from "@/lib/dataStructures/types";

const CAP = 8;

function fromSlotsDescriptor(descriptor: readonly (number | "_" | "X")[]): LinearProbeSnapshot {
  // Compact builder for tests: 'X' = tombstone, '_' = empty, number = occupied.
  const slots: LinearProbeSlot[] = descriptor.map((d) => {
    if (d === "_") return { state: "empty" };
    if (d === "X") return { state: "tombstone" };
    return { state: "occupied", key: d };
  });
  return { capacity: descriptor.length, slots };
}

describe("slotIndexFor", () => {
  it("handles non-negative integers via plain mod", () => {
    expect(slotIndexFor(5, 8)).toBe(5);
    expect(slotIndexFor(13, 8)).toBe(5);
    expect(slotIndexFor(0, 8)).toBe(0);
  });

  it("handles negative integers without -0 quirks", () => {
    expect(slotIndexFor(-1, 8)).toBe(7);
    expect(slotIndexFor(-8, 8)).toBe(0);
    expect(Object.is(slotIndexFor(-8, 8), 0)).toBe(true);
  });
});

describe("linearProbeInsertSequence", () => {
  it("yields only 'done' for an empty input list", () => {
    const steps = [...linearProbeInsertSequence(emptyTable(CAP), [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("places a single key at hash(key) % capacity", () => {
    const steps = [...linearProbeInsertSequence(emptyTable(CAP), [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "place", "done"]);
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(5);
  });

  it("probes forward when the home slot is occupied", () => {
    // First insert 5 → slot 5. Then insert 13 (also hashes to 5) → probes to slot 6.
    const steps = [...linearProbeInsertSequence(emptyTable(CAP), [5, 13])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    expect(probes[0].slotIndex).toBe(5); // probed past slot 5
    const placements = steps.filter((s) => s.kind === "place");
    expect(placements).toHaveLength(2);
    expect(placements[1].slotIndex).toBe(6);
  });

  it("aborts on duplicate without yielding a 'place' step", () => {
    const steps = [...linearProbeInsertSequence(emptyTable(CAP), [5, 5])];
    const placements = steps.filter((s) => s.kind === "place");
    expect(placements).toHaveLength(1); // only the first 5
    const dups = steps.filter((s) => s.kind === "duplicate");
    expect(dups).toHaveLength(1);
  });

  it("wraps around the end of the table", () => {
    // Capacity 4, fill 3 and 1 with insert(3) insert(7) — wait, hash(7)%4=3
    // and hash(3)%4=3. Then insert(11) — hash(11)%4=3, probes 3,0(wrap) since 3,0,1,2
    // wait probe walks 3→0→1→2 but slot 3 is occupied, slot 0 is what 7 went to.
    // Let me redo: cap=4. insert(3) puts at 3. insert(7) hashes to 3, probes to 0
    // (wrap). insert(11) hashes to 3, probes to 0 (occupied by 7), probes to 1 (empty).
    const steps = [...linearProbeInsertSequence(emptyTable(4), [3, 7, 11])];
    const placements = steps.filter((s) => s.kind === "place");
    expect(placements.map((p) => p.slotIndex)).toEqual([3, 0, 1]);
  });

  it("probes past tombstones (does not reuse them)", () => {
    // Set up: slot 5 = 5, slot 6 = tombstone. Insert 13 (hashes to 5) →
    // probes 5 (occupied), probes 6 (tombstone), places at 7.
    const initial = fromSlotsDescriptor(["_", "_", "_", "_", "_", 5, "X", "_"]);
    const steps = [...linearProbeInsertSequence(initial, [13])];
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(7);
  });

  it("every emitted insert step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = linearProbeInsertPython.split("\n").length;
    for (const step of linearProbeInsertSequence(emptyTable(CAP), [5, 13, 21, 6, 6, 5])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate its input snapshot's slots", () => {
    const initial = emptyTable(CAP);
    const before = JSON.parse(JSON.stringify(initial));
    void [...linearProbeInsertSequence(initial, [5, 13])];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("emits fresh snapshots per step (no aliased slot refs)", () => {
    const steps = [...linearProbeInsertSequence(emptyTable(CAP), [5, 13, 21])];
    const slotArrays = steps.map((s) => s.table.slots);
    for (let i = 0; i < slotArrays.length; i++) {
      for (let j = i + 1; j < slotArrays.length; j++) {
        expect(slotArrays[i]).not.toBe(slotArrays[j]);
      }
    }
  });

  it("throws if the table is full and no duplicate path is taken", () => {
    // Fill all 4 slots, then try to insert a fifth (non-duplicate) key.
    const filled = buildLinearProbeTable(4, [0, 1, 2, 3]);
    expect(() => [...linearProbeInsertSequence(filled, [4])]).toThrow(/full/);
  });

  it("property: liveKeys of insert(unique keys) equals the set of inserted keys", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 6 }),
        (vals) => {
          const final = buildLinearProbeTable(CAP, vals);
          expect([...liveKeys(final)].sort((a, b) => a - b)).toEqual(
            [...vals].sort((a, b) => a - b),
          );
        },
      ),
    );
  });
});

describe("linearProbeSearchSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const table = buildLinearProbeTable(CAP, [5, 13]);
    const steps = [...linearProbeSearchSequence(table, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("finds a key at its home slot in one compare", () => {
    const table = buildLinearProbeTable(CAP, [5]);
    const steps = [...linearProbeSearchSequence(table, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "found", "done"]);
  });

  it("finds a key by probing past collisions", () => {
    const table = buildLinearProbeTable(CAP, [5, 13]); // 5 at slot 5, 13 at slot 6
    const steps = [...linearProbeSearchSequence(table, [13])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1); // probed past slot 5
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(6);
  });

  it("probes past tombstones (does not terminate on tombstone)", () => {
    // Slot 5 = tombstone, slot 6 = 13. Search 13 → hash to 5 (tombstone, probe),
    // then 6 (found). The key insight: an "empty" terminates search; a
    // "tombstone" does not.
    const table = fromSlotsDescriptor(["_", "_", "_", "_", "_", "X", 13, "_"]);
    const steps = [...linearProbeSearchSequence(table, [13])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(6);
  });

  it("misses on an empty slot at the home position with zero probes", () => {
    const table = buildLinearProbeTable(CAP, []);
    const steps = [...linearProbeSearchSequence(table, [5])];
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(5);
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(0);
  });

  it("missing key inside a probe cluster terminates on the first empty slot", () => {
    // Slots: 5 → 5, 6 → 13, 7 → empty. Search 21 (hashes to 5) → probe past 5
    // (not 21), probe past 13 (not 21), stop at empty slot 7.
    const table = buildLinearProbeTable(CAP, [5, 13]);
    const steps = [...linearProbeSearchSequence(table, [21])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(2);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(7);
  });

  it("every emitted search step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = linearProbeSearchPython.split("\n").length;
    const table = buildLinearProbeTable(CAP, [5, 13, 21, 6]);
    for (const step of linearProbeSearchSequence(table, [5, 13, 21, 99, 6])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the table snapshot", () => {
    const table = buildLinearProbeTable(CAP, [5, 13]);
    const before = JSON.parse(JSON.stringify(table));
    void [...linearProbeSearchSequence(table, [5, 99])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("misses cleanly after walking a fully-occupied table", () => {
    // Defensive guard: when the table has no empty slots anywhere and the
    // target isn't present, the inner loop hits probeCount === capacity and
    // exits without emitting a miss. The trailing `if (!found && !missed)`
    // emit must fire so the user sees a terminal step.
    const filled = buildLinearProbeTable(4, [0, 1, 2, 3]);
    const steps = [...linearProbeSearchSequence(filled, [4])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(4); // walked every slot
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });
});

describe("linearProbeDeleteSequence", () => {
  it("replaces the matched slot with a tombstone (not empty)", () => {
    const table = buildLinearProbeTable(CAP, [5]);
    const steps = [...linearProbeDeleteSequence(table, [5])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[5]).toEqual({ state: "tombstone" });
  });

  it("yields begin → hash → found → tombstone → done for a home-slot delete", () => {
    const table = buildLinearProbeTable(CAP, [5]);
    const steps = [...linearProbeDeleteSequence(table, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "found", "tombstone", "done"]);
  });

  it("walks a probe cluster to find a deeper key", () => {
    const table = buildLinearProbeTable(CAP, [5, 13]); // 13 at slot 6
    const steps = [...linearProbeDeleteSequence(table, [13])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[6]).toEqual({ state: "tombstone" });
    // The key originally at slot 5 must be untouched.
    expect(last.table.slots[5]).toEqual({ state: "occupied", key: 5 });
  });

  it("misses when probing reaches an empty slot", () => {
    const table = buildLinearProbeTable(CAP, [5, 13]);
    const steps = [...linearProbeDeleteSequence(table, [21])];
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(7);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[5]).toEqual({ state: "occupied", key: 5 });
    expect(last.table.slots[6]).toEqual({ state: "occupied", key: 13 });
  });

  it("every emitted delete step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = linearProbeDeletePython.split("\n").length;
    const table = buildLinearProbeTable(CAP, [5, 13, 21]);
    for (const step of linearProbeDeleteSequence(table, [13, 5, 99])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the input table snapshot", () => {
    const table = buildLinearProbeTable(CAP, [5, 13]);
    const before = JSON.parse(JSON.stringify(table));
    void [...linearProbeDeleteSequence(table, [5])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("delete-then-search misses (tombstone obeys the deletion)", () => {
    const table = buildLinearProbeTable(CAP, [5, 13]);
    const afterDelete = [...linearProbeDeleteSequence(table, [5])].at(-1)!.table;
    const searchSteps = [...linearProbeSearchSequence(afterDelete, [5])];
    const miss = searchSteps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
    const found = searchSteps.find((s) => s.kind === "found");
    expect(found).toBeUndefined();
  });

  it("delete-then-search still finds keys past the tombstone", () => {
    // After deleting 5, slot 5 is a tombstone. Searching 13 (hashes to 5)
    // must probe past the tombstone and find 13 at slot 6.
    const table = buildLinearProbeTable(CAP, [5, 13]);
    const afterDelete = [...linearProbeDeleteSequence(table, [5])].at(-1)!.table;
    const searchSteps = [...linearProbeSearchSequence(afterDelete, [13])];
    const found = searchSteps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(6);
  });

  it("misses cleanly after walking a fully-occupied table", () => {
    // Defensive guard mirror of the search-side test: full table, target
    // not present → loop exits via probeCount === capacity and the trailing
    // miss emit must fire.
    const filled = buildLinearProbeTable(4, [0, 1, 2, 3]);
    const steps = [...linearProbeDeleteSequence(filled, [99])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(4);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });

  it("probes past a tombstone when deleting a key that lives after it", () => {
    // Table: slot 5 = tombstone, slot 6 = 13. Delete 13 — must probe past
    // the tombstone (selecting probeTombstone codeLines) on the way to
    // finding 13 at slot 6.
    const table = fromSlotsDescriptor(["_", "_", "_", "_", "_", "X", 13, "_"]);
    const steps = [...linearProbeDeleteSequence(table, [13])];
    const probeStep = steps.find((s) => s.kind === "probe");
    if (probeStep?.kind !== "probe") throw new Error("expected probe");
    expect(probeStep.slotIndex).toBe(5); // tombstone slot
    // codeLines for a tombstone probe should be the tombstone variant
    // (semantically equivalent but distinct from probeOccupied — both
    // ensures the branch executed).
    expect(probeStep.codeLines).toBeDefined();
  });
});

describe("liveKeys + loadFactor", () => {
  it("liveKeys returns only occupied slots, ignoring tombstones and empty", () => {
    const table = fromSlotsDescriptor([5, "X", "_", 13, "_", "X", 21, "_"]);
    expect([...liveKeys(table)].sort((a, b) => a - b)).toEqual([5, 13, 21]);
  });

  it("loadFactor measures occupied / capacity", () => {
    expect(loadFactor(buildLinearProbeTable(8, []))).toBe(0);
    expect(loadFactor(buildLinearProbeTable(8, [1, 2]))).toBe(0.25);
    expect(loadFactor(buildLinearProbeTable(4, [0, 1, 2]))).toBe(0.75);
  });
});
