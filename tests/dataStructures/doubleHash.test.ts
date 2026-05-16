import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildDoubleHashTable,
  doubleHashDeleteSequence,
  doubleHashHomeFor,
  doubleHashInsertSequence,
  doubleHashSearchSequence,
  doubleHashSlotFor,
  doubleHashStepFor,
} from "@/lib/dataStructures/doubleHash";
import { doubleHashDeletePython } from "@/lib/dataStructures/doubleHashDelete.snippet";
import { doubleHashInsertPython } from "@/lib/dataStructures/doubleHashInsert.snippet";
import { doubleHashSearchPython } from "@/lib/dataStructures/doubleHashSearch.snippet";
import { emptyTable } from "@/lib/dataStructures/linearProbe";
import type { LinearProbeSlot, LinearProbeSnapshot } from "@/lib/dataStructures/types";

// 11 (prime) is the lesson's working capacity — every h2(k) ∈ [1, 10] is
// coprime with 11, so the probe sequence visits every slot.
const CAP = 11;

function fromSlotsDescriptor(descriptor: readonly (number | "_" | "X")[]): LinearProbeSnapshot {
  const slots: LinearProbeSlot[] = descriptor.map((d) => {
    if (d === "_") return { state: "empty" };
    if (d === "X") return { state: "tombstone" };
    return { state: "occupied", key: d };
  });
  return { capacity: descriptor.length, slots };
}

describe("doubleHashHomeFor", () => {
  it("matches plain key % capacity for non-negative keys", () => {
    expect(doubleHashHomeFor(5, 11)).toBe(5);
    expect(doubleHashHomeFor(16, 11)).toBe(5);
    expect(doubleHashHomeFor(0, 11)).toBe(0);
  });

  it("handles negative integers without -0 quirks", () => {
    expect(doubleHashHomeFor(-1, 11)).toBe(10);
    expect(doubleHashHomeFor(-11, 11)).toBe(0);
    expect(Object.is(doubleHashHomeFor(-11, 11), 0)).toBe(true);
  });
});

describe("doubleHashStepFor", () => {
  it("always returns a value in [1, capacity - 1]", () => {
    for (let k = 0; k < 100; k++) {
      const s = doubleHashStepFor(k, CAP);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(CAP - 1);
    }
  });

  it("computes 1 + (k mod (c - 1)) for non-negative keys", () => {
    expect(doubleHashStepFor(5, 11)).toBe(6); // 1 + (5 % 10)
    expect(doubleHashStepFor(16, 11)).toBe(7); // 1 + (16 % 10)
    expect(doubleHashStepFor(27, 11)).toBe(8);
    expect(doubleHashStepFor(38, 11)).toBe(9);
    expect(doubleHashStepFor(49, 11)).toBe(10);
  });

  it("handles negative integers symmetrically with the home function", () => {
    expect(doubleHashStepFor(-1, 11)).toBe(10); // 1 + ((-1 mod 10 + 10) mod 10) = 1 + 9
    expect(doubleHashStepFor(-10, 11)).toBe(1); // 1 + 0
  });

  it("degenerates safely to step=1 for capacity <= 1", () => {
    expect(doubleHashStepFor(42, 1)).toBe(1);
    expect(doubleHashStepFor(42, 0)).toBe(1);
  });
});

describe("doubleHashSlotFor", () => {
  it("returns the home slot for probe=0", () => {
    expect(doubleHashSlotFor(5, 0, 6, 11)).toBe(5);
  });

  it("advances by step on each probe", () => {
    expect(doubleHashSlotFor(5, 1, 6, 11)).toBe(0); // (5 + 6) mod 11
    expect(doubleHashSlotFor(5, 2, 6, 11)).toBe(6); // (5 + 12) mod 11
    expect(doubleHashSlotFor(5, 3, 6, 11)).toBe(1); // (5 + 18) mod 11
  });

  it("handles negative home gracefully", () => {
    expect(doubleHashSlotFor(-1, 1, 1, 11)).toBe(0);
  });
});

describe("doubleHashInsertSequence", () => {
  it("yields only 'done' for an empty input list", () => {
    const steps = [...doubleHashInsertSequence(emptyTable(CAP), [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("places a single key at hash1(key) % capacity", () => {
    const steps = [...doubleHashInsertSequence(emptyTable(CAP), [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "place", "done"]);
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(5);
  });

  it("spreads same-h1 keys via distinct h2 steps (5,16,27,38,49 land at 5,1,2,3,4)", () => {
    // All five keys have h1 = 5 but different h2: 6, 7, 8, 9, 10. So after
    // the first place at home, each subsequent insert collides at slot 5 then
    // jumps by its own step to land at a different empty slot.
    const steps = [...doubleHashInsertSequence(emptyTable(CAP), [5, 16, 27, 38, 49])];
    const places = steps.filter((s) => s.kind === "place");
    expect(places.map((p) => p.slotIndex)).toEqual([5, 1, 2, 3, 4]);
  });

  it("emits exactly one 'probe' step per same-h1 placement past the home slot", () => {
    // 16 has h2=7. From home 5 (occupied by 5), one probe at slot 5, then
    // i=1 jumps to (5+7)%11=1 → empty → place. One probe per placement.
    const steps = [...doubleHashInsertSequence(emptyTable(CAP), [5, 16])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    expect(probes[0].slotIndex).toBe(5);
    expect(probes[0].probeCount).toBe(1);
  });

  it("aborts on duplicate without yielding a 'place' step", () => {
    const steps = [...doubleHashInsertSequence(emptyTable(CAP), [5, 5])];
    expect(steps.filter((s) => s.kind === "place")).toHaveLength(1);
    expect(steps.filter((s) => s.kind === "duplicate")).toHaveLength(1);
  });

  it("returns 'duplicate' even after probing past collisions on the key's own path", () => {
    // Insert 5, 16, then re-insert 16 — 16 probes its own h2=7 path: slot 5
    // (occupied by 5, probe), then i=1 lands at slot 1 (occupied by 16) → dup.
    const steps = [...doubleHashInsertSequence(emptyTable(CAP), [5, 16, 16])];
    const dups = steps.filter((s) => s.kind === "duplicate");
    expect(dups).toHaveLength(1);
    if (dups[0].kind !== "duplicate") throw new Error("expected duplicate");
    expect(dups[0].slotIndex).toBe(1);
  });

  it("probes past tombstones (does not reuse them)", () => {
    // Slot 5 = 5, slot 1 = tombstone, slot 6 = _. Insert 16 (h1=5, h2=7) →
    // probe past slot 5 (occupied), then i=1 lands at (5+7)%11=1 (tombstone,
    // probe), then i=2 lands at (5+14)%11=8 (empty) → place at 8.
    const initial = fromSlotsDescriptor(["_", "X", "_", "_", "_", 5, "_", "_", "_", "_", "_"]);
    const steps = [...doubleHashInsertSequence(initial, [16])];
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(8);
  });

  it("every emitted insert step carries codeLines inside the displayed Python source", () => {
    const lineCount = doubleHashInsertPython.split("\n").length;
    for (const step of doubleHashInsertSequence(emptyTable(CAP), [5, 16, 27, 5])) {
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
    void [...doubleHashInsertSequence(initial, [5, 16])];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("emits fresh snapshots per step (no aliased slot refs)", () => {
    const steps = [...doubleHashInsertSequence(emptyTable(CAP), [5, 16, 27])];
    const slotArrays = steps.map((s) => s.table.slots);
    for (let i = 0; i < slotArrays.length; i++) {
      for (let j = i + 1; j < slotArrays.length; j++) {
        expect(slotArrays[i]).not.toBe(slotArrays[j]);
      }
    }
  });

  it("throws when the table is completely full and the new key isn't a duplicate", () => {
    const full = fromSlotsDescriptor([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(() => [...doubleHashInsertSequence(full, [99])]).toThrow(/table full/);
  });

  it("property: liveKeys-equivalent for unique keys with prime capacity", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 7 }),
        (vals) => {
          const final = buildDoubleHashTable(CAP, vals);
          const live = final.slots
            .filter((s) => s.state === "occupied")
            .map((s) => (s.state === "occupied" ? s.key : -1));
          expect([...live].sort((a, b) => a - b)).toEqual([...vals].sort((a, b) => a - b));
        },
      ),
    );
  });

  it("uses strictly fewer probes than quadratic on the curated same-h1 input", () => {
    // [5, 16, 27, 38, 49] all have h1=5. Each placement under double-hashing
    // does exactly 1 probe past home (their h2 jumps land in empty slots
    // immediately). Quadratic probing on the same input does 0+1+2+3+4=10
    // probes. The headline pedagogical claim.
    const steps = [...doubleHashInsertSequence(emptyTable(CAP), [5, 16, 27, 38, 49])];
    const probes = steps.filter((s) => s.kind === "probe").length;
    expect(probes).toBe(4); // 4 placements collide at home; first key probes 0 times
  });
});

describe("doubleHashSearchSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const steps = [...doubleHashSearchSequence(table, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("finds a key at its home slot in zero probes", () => {
    const table = buildDoubleHashTable(CAP, [5]);
    const steps = [...doubleHashSearchSequence(table, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "found", "done"]);
  });

  it("finds a key by walking the key's own h2 path", () => {
    // 16 lives at slot 1 after [5, 16] are inserted. Search 16 → probe slot 5
    // (occupied by 5), then jump by h2(16)=7 to slot 1 (found).
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const steps = [...doubleHashSearchSequence(table, [16])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(1);
  });

  it("probes past tombstones (does not terminate on tombstone)", () => {
    // Slot 5 = tombstone, slot 1 = 16. Search 16 (h1=5, h2=7) → probe at 5
    // (tombstone), then i=1 lands at 1 (found).
    const table = fromSlotsDescriptor(["_", 16, "_", "_", "_", "X", "_", "_", "_", "_", "_"]);
    const steps = [...doubleHashSearchSequence(table, [16])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(1);
  });

  it("misses on an empty slot at the home position with zero probes", () => {
    const table = buildDoubleHashTable(CAP, []);
    const steps = [...doubleHashSearchSequence(table, [5])];
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(5);
    expect(steps.filter((s) => s.kind === "probe")).toHaveLength(0);
  });

  it("missing key inside a probe cluster terminates on the first empty slot along its h2 path", () => {
    // After [5, 16], slot 5 and slot 1 are occupied. Search 27 (h1=5, h2=8):
    // probe slot 5, then jump to (5+8)%11=2 → empty → miss at slot 2.
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const steps = [...doubleHashSearchSequence(table, [27])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(2);
  });

  it("every emitted search step carries codeLines inside the displayed Python source", () => {
    const lineCount = doubleHashSearchPython.split("\n").length;
    const table = buildDoubleHashTable(CAP, [5, 16, 27, 6]);
    for (const step of doubleHashSearchSequence(table, [5, 16, 27, 99, 6])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the table snapshot", () => {
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const before = JSON.parse(JSON.stringify(table));
    void [...doubleHashSearchSequence(table, [5, 99])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("misses cleanly after walking the full probe sequence with no empty", () => {
    // Fully-occupied table where 99 doesn't match any key. h2(99) = 1 +
    // (99 % 10) = 10, so the probe path is the full cycle of 11 slots.
    const filled = fromSlotsDescriptor([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const steps = [...doubleHashSearchSequence(filled, [99])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes.length).toBe(CAP);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });
});

describe("doubleHashDeleteSequence", () => {
  it("replaces the matched slot with a tombstone (not empty)", () => {
    const table = buildDoubleHashTable(CAP, [5]);
    const steps = [...doubleHashDeleteSequence(table, [5])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[5]).toEqual({ state: "tombstone" });
  });

  it("yields begin → hash → found → tombstone → done for a home-slot delete", () => {
    const table = buildDoubleHashTable(CAP, [5]);
    const steps = [...doubleHashDeleteSequence(table, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "found", "tombstone", "done"]);
  });

  it("walks a probe path to find a deeper key", () => {
    // 16 lives at slot 1 after [5, 16]. Delete 16 → probe past slot 5 (5
    // is occupied, 5≠16), jump to slot 1, found.
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const steps = [...doubleHashDeleteSequence(table, [16])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[1]).toEqual({ state: "tombstone" });
    expect(last.table.slots[5]).toEqual({ state: "occupied", key: 5 });
  });

  it("misses when the probe path reaches an empty slot", () => {
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const steps = [...doubleHashDeleteSequence(table, [27])];
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(2); // first empty along 27's h2=8 path from home 5
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[5]).toEqual({ state: "occupied", key: 5 });
    expect(last.table.slots[1]).toEqual({ state: "occupied", key: 16 });
  });

  it("every emitted delete step carries codeLines inside the displayed Python source", () => {
    const lineCount = doubleHashDeletePython.split("\n").length;
    const table = buildDoubleHashTable(CAP, [5, 16, 27]);
    for (const step of doubleHashDeleteSequence(table, [16, 5, 99])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the input table snapshot", () => {
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const before = JSON.parse(JSON.stringify(table));
    void [...doubleHashDeleteSequence(table, [5])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("delete-then-search misses (tombstone obeys the deletion)", () => {
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const afterDelete = [...doubleHashDeleteSequence(table, [5])].at(-1)!.table;
    const searchSteps = [...doubleHashSearchSequence(afterDelete, [5])];
    expect(searchSteps.find((s) => s.kind === "miss")).toBeDefined();
    expect(searchSteps.find((s) => s.kind === "found")).toBeUndefined();
  });

  it("delete-then-search still finds keys past the tombstone", () => {
    // Delete 5 → slot 5 becomes tombstone. Search 16 (h1=5, h2=7) → probe
    // tombstone-at-5, then jump to slot 1 (found).
    const table = buildDoubleHashTable(CAP, [5, 16]);
    const afterDelete = [...doubleHashDeleteSequence(table, [5])].at(-1)!.table;
    const searchSteps = [...doubleHashSearchSequence(afterDelete, [16])];
    const found = searchSteps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(1);
  });

  it("misses cleanly after walking the full probe sequence", () => {
    const filled = fromSlotsDescriptor([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const steps = [...doubleHashDeleteSequence(filled, [99])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes.length).toBe(CAP);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });

  it("probes past a tombstone when deleting a key that lives after it", () => {
    const table = fromSlotsDescriptor(["_", 16, "_", "_", "_", "X", "_", "_", "_", "_", "_"]);
    const steps = [...doubleHashDeleteSequence(table, [16])];
    const probeStep = steps.find((s) => s.kind === "probe");
    if (probeStep?.kind !== "probe") throw new Error("expected probe");
    expect(probeStep.slotIndex).toBe(5);
  });
});
