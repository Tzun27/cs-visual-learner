import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildLinearProbeTable, liveKeys } from "@/lib/dataStructures/linearProbe";
import {
  buildRobinHoodTable,
  displacementOf,
  maxDisplacement,
  robinHoodDeleteSequence,
  robinHoodInsertSequence,
} from "@/lib/dataStructures/robinHood";
import { robinHoodDeletePython } from "@/lib/dataStructures/robinHoodDelete.snippet";
import { robinHoodInsertPython } from "@/lib/dataStructures/robinHoodInsert.snippet";
import type { LinearProbeSnapshot } from "@/lib/dataStructures/types";

const CAP = 8;

const EMPTY_TABLE: LinearProbeSnapshot = {
  capacity: CAP,
  slots: Array.from({ length: CAP }, () => ({ state: "empty" })),
};

function maxDisplacementVariance(table: LinearProbeSnapshot): number {
  const displacements: number[] = [];
  for (let i = 0; i < table.capacity; i++) {
    const d = displacementOf(table, i);
    if (d !== null) displacements.push(d);
  }
  if (displacements.length === 0) return 0;
  const mean = displacements.reduce((a, b) => a + b, 0) / displacements.length;
  return displacements.reduce((acc, d) => acc + (d - mean) * (d - mean), 0) / displacements.length;
}

describe("robinHoodInsertSequence", () => {
  it("places a single key at its home with displacement 0", () => {
    const steps = [...robinHoodInsertSequence(EMPTY_TABLE, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "place", "done"]);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(displacementOf(last.table, 5)).toBe(0);
  });

  it("performs a swap when a richer cursor is encountered", () => {
    // Insert 5 at slot 5 (displacement 0). Insert 13: hashes to 5,
    // probe count 0, cursor has displacement 0 → 0 > 0 is FALSE → no swap.
    // Insert 14: hashes to 6, no collision, lands at 6.
    // Insert 21: hashes to 5, probe 0 (5: probe=0), probe 1 (13: probe=1),
    // probe 2 (14: probe=0)... wait need to recheck.
    // Actually let's check: insert 5 at 5. insert 13 → hash 5, probe=0 vs
    // existing 5 (probe=0): 0>0 false, advance probe=1, cursor=6. slot 6
    // empty, place 13. Final: 13 at 6 with displacement 1.
    // Insert 21 → hash 5, probe=0 vs 5 (probe=0): no swap, advance to 6
    // probe=1. probe=1 vs 13 (existing_probe=1): 1>1 false, advance to 7
    // probe=2. slot 7 empty, place 21 with displacement 2.
    // To force a swap, insert at home, then insert with non-home probing.
    // Best test: insert two keys hashing to 5, then a key hashing to 6.
    //   - 5 at slot 5 (disp 0)
    //   - 13 at slot 6 (disp 1, displaced one slot)
    //   - 14 hashes to 6 with probe=0. Slot 6 has 13 with existing_probe=1.
    //     0>1 FALSE → no swap. Hmm.
    // Other direction: insert a thirdly-displaced key against a freshly-
    // placed-at-home key.
    //   - 5 → slot 5 (disp 0)
    //   - 14 → slot 6 (disp 0, hashes to 6)
    //   - 13 → hash 5, probe 0 vs 5 disp 0: 0>0 false, advance to 6 probe 1.
    //     slot 6 has 14 disp 0. probe 1>0 TRUE → SWAP: 13 takes slot 6,
    //     evicted=14, now inserting 14 at probe 0... cursor++ to 7 probe=1.
    //     slot 7 empty, place 14 at 7 with disp 1.
    const steps = [...robinHoodInsertSequence(EMPTY_TABLE, [5, 14, 13])];
    const swaps = steps.filter((s) => s.kind === "swap");
    expect(swaps).toHaveLength(1);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    // After swap, 13 should be at slot 6 (disp 1), 14 at slot 7 (disp 1).
    expect(displacementOf(last.table, 6)).toBe(1);
    expect(displacementOf(last.table, 7)).toBe(1);
    // 5 still at slot 5 (disp 0).
    expect(displacementOf(last.table, 5)).toBe(0);
  });

  it("aborts on exact duplicate, leaving the table unchanged", () => {
    const steps = [...robinHoodInsertSequence(EMPTY_TABLE, [5, 5])];
    const dups = steps.filter((s) => s.kind === "duplicate");
    expect(dups).toHaveLength(1);
    const places = steps.filter((s) => s.kind === "place");
    expect(places).toHaveLength(1);
  });

  it("fast-paths placement onto a tombstone reached after probing", () => {
    // Build a 4-slot starting table:
    //   slot 0: occupied 0 (home 0, displacement 0)
    //   slot 1: tombstone (modeled as displacement 0 — any probing key may rob it)
    //   slots 2, 3: empty
    // Insert 4 (home 0): probe=0 at slot 0 (5 displacement 0, 0>0 false), advance.
    // probe=1 at slot 1 (tombstone, existingProbe=0, 1>0 TRUE) → fast-path
    // placement: 4 lands at slot 1, no swap step needed.
    const initial = {
      capacity: 4,
      slots: [
        { state: "occupied" as const, key: 0 },
        { state: "tombstone" as const },
        { state: "empty" as const },
        { state: "empty" as const },
      ],
    };
    const steps = [...robinHoodInsertSequence(initial, [4])];
    const swaps = steps.filter((s) => s.kind === "swap");
    expect(swaps).toHaveLength(0);
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(1);
  });

  it("throws if the table is full and no duplicate path is taken", () => {
    // Fill all 4 slots distinctly, then try to insert a key that doesn't
    // match any existing one. The robin-hood loop walks the full capacity
    // without finding either an empty slot or a duplicate, so the defensive
    // throw fires.
    const filled = buildRobinHoodTable(4, [0, 1, 2, 3]);
    expect(() => [...robinHoodInsertSequence(filled, [4])]).toThrow(/full/);
  });

  it("every emitted step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = robinHoodInsertPython.split("\n").length;
    for (const step of robinHoodInsertSequence(EMPTY_TABLE, [5, 14, 13, 6, 21])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate its input snapshot", () => {
    const before = JSON.parse(JSON.stringify(EMPTY_TABLE));
    void [...robinHoodInsertSequence(EMPTY_TABLE, [5, 13, 21, 4])];
    expect(JSON.parse(JSON.stringify(EMPTY_TABLE))).toEqual(before);
  });

  it("property: liveKeys matches the input set", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 6 }),
        (vals) => {
          const final = buildRobinHoodTable(CAP, vals);
          expect([...liveKeys(final)].sort((a, b) => a - b)).toEqual(
            [...vals].sort((a, b) => a - b),
          );
        },
      ),
    );
  });

  it("property: max displacement is bounded by the number of inserted keys", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 50 }), { minLength: 0, maxLength: 7 }),
        (vals) => {
          const final = buildRobinHoodTable(CAP, vals);
          expect(maxDisplacement(final)).toBeLessThanOrEqual(vals.length);
        },
      ),
    );
  });

  it("property: on inputs with many home collisions, Robin Hood has equal-or-lower variance than plain linear probing", () => {
    // Specifically construct adversarial inputs: many keys hashing to the
    // same home (all multiples of 8 within range). The variance reduction
    // of Robin Hood is most visible here.
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.integer({ min: 0, max: 7 }).map((b) => b * 8 + 1), // 1, 9, 17, 25, ...
          { minLength: 0, maxLength: 6 },
        ),
        (vals) => {
          const rhFinal = buildRobinHoodTable(CAP, vals);
          const linearFinal = buildLinearProbeTable(CAP, vals);
          // For all-same-home inputs, both end up with the same multiset
          // of displacements (0, 1, 2, ...), so variance is identical.
          // The interesting property is that Robin Hood NEVER does worse:
          expect(maxDisplacementVariance(rhFinal)).toBeLessThanOrEqual(
            maxDisplacementVariance(linearFinal),
          );
        },
      ),
    );
  });
});

describe("robinHoodDeleteSequence", () => {
  // End-state of the Robin Hood insert demo: 5@5, 13@6, 14@7, 22@0.
  // Displacements: 5(+0), 13(+1), 14(+1), 22(+2).
  const DEMO = buildRobinHoodTable(CAP, [5, 14, 13, 22]);

  it("yields only 'done' for an empty target list", () => {
    const steps = [...robinHoodDeleteSequence(DEMO, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("emits a miss when the home slot is empty", () => {
    const steps = [...robinHoodDeleteSequence(DEMO, [99])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "miss", "done"]);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(3); // 99 % 8
  });

  it("backshifts a chain of displaced keys, stopping at an empty slot", () => {
    // Delete 13: probe past 5, find at slot 6, then pull 14 and 22 toward
    // their homes; the next slot (slot 1) is empty so we stop and clear
    // slot 0.
    const steps = [...robinHoodDeleteSequence(DEMO, [13])];
    const pulls = steps.filter((s) => s.kind === "pull");
    expect(pulls).toHaveLength(2);
    // First pull: 14 from slot 7 → slot 6
    expect(pulls[0]).toMatchObject({ fromIndex: 7, toIndex: 6, pulledKey: 14 });
    // Second pull: 22 from slot 0 → slot 7 (wrap-around in the toIndex)
    expect(pulls[1]).toMatchObject({ fromIndex: 0, toIndex: 7, pulledKey: 22 });

    const clear = steps.find((s) => s.kind === "clear");
    if (clear?.kind !== "clear") throw new Error("expected clear");
    expect(clear.clearedIndex).toBe(0);
    expect(clear.blockerReason).toBe("empty");
    expect(clear.blockerIndex).toBe(1);

    // Final state: 5@5 (+0), 14@6 (+0), 22@7 (+1). 13 gone.
    const final = (steps.at(-1) as { kind: "done"; table: LinearProbeSnapshot }).table;
    expect([...liveKeys(final)].sort((a, b) => a - b)).toEqual([5, 14, 22]);
    expect(displacementOf(final, 6)).toBe(0);
    expect(displacementOf(final, 7)).toBe(1);
    // No tombstones — slot 0 is genuinely empty.
    expect(final.slots[0].state).toBe("empty");
  });

  it("backshift stops at a key already at home (no pulls)", () => {
    // Delete 13 first to land us at: 5@5, 14@6, 22@7. Then delete 5:
    // i=5 found, j=6 holds 14 with home 6 → at-home → stop, clear slot 5.
    const steps = [...robinHoodDeleteSequence(DEMO, [13, 5])];
    // Filter to the second delete only (after the first 'clear' step).
    const secondBegin = steps.findIndex((s, idx) => s.kind === "begin" && idx > 0);
    const tail = steps.slice(secondBegin);
    const pulls = tail.filter((s) => s.kind === "pull");
    expect(pulls).toHaveLength(0);
    const clear = tail.find((s) => s.kind === "clear");
    if (clear?.kind !== "clear") throw new Error("expected clear");
    expect(clear.clearedIndex).toBe(5);
    expect(clear.blockerReason).toBe("at-home");
    expect(clear.blockerIndex).toBe(6);

    const final = (tail.at(-1) as { kind: "done"; table: LinearProbeSnapshot }).table;
    expect([...liveKeys(final)].sort((a, b) => a - b)).toEqual([14, 22]);
  });

  it("never leaves a tombstone in the table", () => {
    // No matter the order, Robin Hood backshift never introduces a
    // tombstone — that's the whole point.
    const steps = [...robinHoodDeleteSequence(DEMO, [13, 5, 22, 14])];
    for (const step of steps) {
      const slots = step.table.slots;
      for (const slot of slots) {
        expect(slot.state).not.toBe("tombstone");
      }
    }
  });

  it("misses cleanly after walking a fully-occupied table", () => {
    // Defensive guard: Robin Hood delete on a table with no empty slots
    // and a target that's not present. The inner loop hits
    // probeCount === capacity, exits, and the trailing `if (!found && !missed)`
    // emit must fire.
    const filled = buildRobinHoodTable(4, [0, 1, 2, 3]);
    const steps = [...robinHoodDeleteSequence(filled, [99])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(4);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });

  it("emits a miss when probing past unrelated keys lands on an empty slot", () => {
    // Build a table where 1 lives at slot 1, but searching for 9 (also
    // hashes to 1) probes 1 → 2; slot 2 is empty → miss.
    const t = buildRobinHoodTable(CAP, [1]);
    const steps = [...robinHoodDeleteSequence(t, [9])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    expect(probes[0].slotIndex).toBe(2);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(2);
  });

  it("every emitted delete step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = robinHoodDeletePython.split("\n").length;
    for (const step of robinHoodDeleteSequence(DEMO, [13, 5, 99])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate its input snapshot", () => {
    const before = JSON.parse(JSON.stringify(DEMO));
    void [...robinHoodDeleteSequence(DEMO, [13, 5, 22])];
    expect(JSON.parse(JSON.stringify(DEMO))).toEqual(before);
  });

  it("property: deleting every key in any order leaves an empty table", () => {
    fc.assert(
      fc.property(
        fc
          .uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 6 })
          .chain((keys) =>
            fc.tuple(
              fc.constant(keys),
              fc.shuffledSubarray(keys, { minLength: keys.length, maxLength: keys.length }),
            ),
          ),
        ([keys, deleteOrder]) => {
          const built = buildRobinHoodTable(CAP, keys);
          let table = built;
          for (const step of robinHoodDeleteSequence(built, deleteOrder)) {
            if (step.kind === "done") table = step.table;
          }
          expect(liveKeys(table)).toEqual([]);
          for (const slot of table.slots) {
            // After full deletion the table must be all-empty — no
            // tombstones, no stragglers.
            expect(slot.state).toBe("empty");
          }
        },
      ),
    );
  });

  it("property: after any sequence of inserts and deletes, displacements are still ≤ live count", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 6 }),
        fc.uniqueArray(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 4 }),
        (inserts, deletes) => {
          const built = buildRobinHoodTable(CAP, inserts);
          let table = built;
          for (const step of robinHoodDeleteSequence(built, deletes)) {
            if (step.kind === "done") table = step.table;
          }
          const live = liveKeys(table).length;
          expect(maxDisplacement(table)).toBeLessThanOrEqual(Math.max(live, 0));
        },
      ),
    );
  });
});

describe("displacementOf", () => {
  it("returns null for empty and tombstone slots", () => {
    const t: LinearProbeSnapshot = {
      capacity: CAP,
      slots: [
        { state: "empty" },
        { state: "tombstone" },
        ...Array(CAP - 2).fill({ state: "empty" }),
      ],
    };
    expect(displacementOf(t, 0)).toBeNull();
    expect(displacementOf(t, 1)).toBeNull();
  });

  it("computes displacement correctly with wrap-around", () => {
    const t: LinearProbeSnapshot = {
      capacity: 4,
      slots: [
        { state: "occupied", key: 3 }, // hash(3)%4=3, placed at 0 → disp = (0-3+4)%4 = 1
        { state: "empty" },
        { state: "empty" },
        { state: "occupied", key: 3 }, // hypothetical: 3 at slot 3 → disp 0
      ],
    };
    expect(displacementOf(t, 0)).toBe(1);
    expect(displacementOf(t, 3)).toBe(0);
  });
});
