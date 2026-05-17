import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  CUCKOO_MAX_ITERATIONS,
  buildCuckooTable,
  cuckooDeleteSequence,
  cuckooHash1,
  cuckooHash2,
  cuckooInsertSequence,
  cuckooSearchSequence,
  emptyCuckooTable,
  liveCuckooKeys,
} from "@/lib/dataStructures/cuckoo";
import { cuckooDeletePython } from "@/lib/dataStructures/cuckooDelete.snippet";
import { cuckooInsertPython } from "@/lib/dataStructures/cuckooInsert.snippet";
import { cuckooSearchPython } from "@/lib/dataStructures/cuckooSearch.snippet";
import type {
  CuckooInsertStep,
  CuckooSide,
  CuckooSlot,
  CuckooSnapshot,
} from "@/lib/dataStructures/types";

// 7 slots per table (so 14 slots total). h1(k)=k%7, h2(k)=⌊k/7⌋%7.
const CAP = 7;

function tableFromDescriptors(
  a: readonly (number | "_")[],
  b: readonly (number | "_")[],
): CuckooSnapshot {
  const mk = (d: number | "_"): CuckooSlot =>
    d === "_" ? { state: "empty" } : { state: "occupied", key: d };
  return { capacity: a.length, slotsA: a.map(mk), slotsB: b.map(mk) };
}

function consumeUntilThrow<T>(gen: Generator<T>): { steps: T[]; threw: Error | null } {
  const steps: T[] = [];
  let threw: Error | null = null;
  try {
    for (const s of gen) steps.push(s);
  } catch (e) {
    threw = e as Error;
  }
  return { steps, threw };
}

describe("cuckooHash1", () => {
  it("matches plain key % capacity for non-negative keys", () => {
    expect(cuckooHash1(0, CAP)).toBe(0);
    expect(cuckooHash1(5, CAP)).toBe(5);
    expect(cuckooHash1(7, CAP)).toBe(0);
    expect(cuckooHash1(14, CAP)).toBe(0);
  });

  it("handles negative integers without -0 quirks", () => {
    expect(cuckooHash1(-1, CAP)).toBe(6);
    expect(cuckooHash1(-7, CAP)).toBe(0);
    expect(Object.is(cuckooHash1(-7, CAP), 0)).toBe(true);
  });
});

describe("cuckooHash2", () => {
  it("returns ⌊k/c⌋ mod c for non-negative keys", () => {
    expect(cuckooHash2(0, CAP)).toBe(0);
    expect(cuckooHash2(5, CAP)).toBe(0);
    expect(cuckooHash2(7, CAP)).toBe(1);
    expect(cuckooHash2(14, CAP)).toBe(2);
    expect(cuckooHash2(49, CAP)).toBe(0);
  });

  it("yields a result in [0, capacity - 1]", () => {
    for (let k = -50; k < 200; k++) {
      const h = cuckooHash2(k, CAP);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(CAP - 1);
    }
  });

  it("uses floor-divide so negative keys land in a canonical positive bucket", () => {
    // ⌊-1 / 7⌋ = -1, then ((-1 % 7) + 7) % 7 = 6.
    expect(cuckooHash2(-1, CAP)).toBe(6);
  });
});

describe("emptyCuckooTable", () => {
  it("produces both side arrays of the requested capacity", () => {
    const t = emptyCuckooTable(CAP);
    expect(t.capacity).toBe(CAP);
    expect(t.slotsA).toHaveLength(CAP);
    expect(t.slotsB).toHaveLength(CAP);
    expect(t.slotsA.every((s) => s.state === "empty")).toBe(true);
    expect(t.slotsB.every((s) => s.state === "empty")).toBe(true);
  });
});

describe("cuckooInsertSequence", () => {
  it("yields only 'done' for an empty key list", () => {
    const steps = [...cuckooInsertSequence(emptyCuckooTable(CAP), [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("places a single key directly at T_A[h1(k)] without an eviction", () => {
    const steps = [...cuckooInsertSequence(emptyCuckooTable(CAP), [5])];
    expect(steps.map((s) => s.kind)).toEqual([
      "begin",
      "hash",
      "dedup-check",
      "dedup-check",
      "check",
      "place",
      "done",
    ]);
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.side).toBe<CuckooSide>("A");
    expect(place.slotIndex).toBe(5);
  });

  it("evicts and re-homes a single collision into T_B (one swap)", () => {
    // 5 lands at TA[5]. 12 has h1=5 → collides. Swap → TA[5]=12; 5 → TB[h2(5)]=TB[0] empty.
    const steps = [...cuckooInsertSequence(emptyCuckooTable(CAP), [5, 12])];
    const evicts = steps.filter((s) => s.kind === "evict");
    expect(evicts).toHaveLength(1);
    const evict = evicts[0];
    if (evict.kind !== "evict") throw new Error("expected evict");
    expect(evict.placedKey).toBe(12);
    expect(evict.evictedKey).toBe(5);
    expect(evict.side).toBe<CuckooSide>("A");
    expect(evict.slotIndex).toBe(5);
    expect(evict.nextSide).toBe<CuckooSide>("B");
    expect(evict.nextSlotIndex).toBe(0);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slotsA[5]).toEqual({ state: "occupied", key: 12 });
    expect(last.table.slotsB[0]).toEqual({ state: "occupied", key: 5 });
  });

  it("runs a three-step cascade when inserting 14 into [5, 0, 12]", () => {
    // After [5, 0, 12]: TA[5]=12, TA[0]=0, TB[0]=5.
    // Insert 14 (h1=0, h2=2): TA[0]=0 → swap with 14, cur=0;
    //   0 → TB[h2(0)]=TB[0]=5 → swap, cur=5;
    //   5 → TA[h1(5)]=TA[5]=12 → swap, cur=12;
    //   12 → TB[h2(12)]=TB[1] empty → place. 3 evictions total.
    const steps = [...cuckooInsertSequence(emptyCuckooTable(CAP), [5, 0, 12, 14])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slotsA[0]).toEqual({ state: "occupied", key: 14 });
    expect(last.table.slotsA[5]).toEqual({ state: "occupied", key: 5 });
    expect(last.table.slotsB[0]).toEqual({ state: "occupied", key: 0 });
    expect(last.table.slotsB[1]).toEqual({ state: "occupied", key: 12 });

    // Count evictions within the insertion of 14 only.
    const beginIndices = steps.map((s, i) => (s.kind === "begin" ? i : -1)).filter((i) => i >= 0);
    const insert14Slice = steps.slice(beginIndices[3]);
    const evicts14 = insert14Slice.filter((s) => s.kind === "evict");
    expect(evicts14).toHaveLength(3);
  });

  it("detects a duplicate via T_A's dedup-check without entering the eviction loop", () => {
    const steps = [...cuckooInsertSequence(emptyCuckooTable(CAP), [5, 5])];
    const dup = steps.find((s) => s.kind === "duplicate");
    if (dup?.kind !== "duplicate") throw new Error("expected duplicate");
    expect(dup.side).toBe<CuckooSide>("A");
    expect(dup.slotIndex).toBe(5);
    // No eviction loop, no place step on the second insert.
    const places = steps.filter((s) => s.kind === "place");
    expect(places).toHaveLength(1); // only the first 5
    const checks = steps.filter((s) => s.kind === "check");
    expect(checks).toHaveLength(1); // only the first 5's loop check
  });

  it("detects a duplicate via T_B's dedup-check after T_A misses", () => {
    // Set TB[0]=5 (occupied), TA[5] empty. Inserting 5 should hit dedup-B.
    const initial = tableFromDescriptors(
      ["_", "_", "_", "_", "_", "_", "_"],
      [5, "_", "_", "_", "_", "_", "_"],
    );
    const steps = [...cuckooInsertSequence(initial, [5])];
    const dup = steps.find((s) => s.kind === "duplicate");
    if (dup?.kind !== "duplicate") throw new Error("expected duplicate");
    expect(dup.side).toBe<CuckooSide>("B");
    expect(dup.slotIndex).toBe(0);
  });

  it("every emitted insert step's codeLines fall inside the displayed Python source", () => {
    const lineCount = cuckooInsertPython.split("\n").length;
    const steps = [...cuckooInsertSequence(emptyCuckooTable(CAP), [5, 0, 12, 14, 5])];
    for (const step of steps) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate its input snapshot", () => {
    const initial = emptyCuckooTable(CAP);
    const before = JSON.parse(JSON.stringify(initial));
    void [...cuckooInsertSequence(initial, [5, 0, 12, 14])];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("emits fresh snapshot arrays per step (no aliased side refs)", () => {
    const steps = [...cuckooInsertSequence(emptyCuckooTable(CAP), [5, 0, 12])];
    for (let i = 0; i < steps.length; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        expect(steps[i].table.slotsA).not.toBe(steps[j].table.slotsA);
        expect(steps[i].table.slotsB).not.toBe(steps[j].table.slotsB);
      }
    }
  });

  it("emits a 'cycle' step and throws when the eviction cascade exceeds MAX iterations", () => {
    // Keys 0, 49, 98 all share (h1, h2) = (0, 0), so once two of them are
    // placed (TA[0], TB[0]) the third can never find an empty alternate.
    const initial = buildCuckooTable(CAP, [0, 49]);
    const { steps, threw } = consumeUntilThrow(cuckooInsertSequence(initial, [98]));
    expect(threw).not.toBeNull();
    expect(threw!.message).toMatch(/cycle/);
    const cycle = steps.find((s) => s.kind === "cycle");
    expect(cycle).toBeDefined();
    // CUCKOO_MAX_ITERATIONS evict steps exactly (no successful place).
    const evicts = steps.filter((s) => s.kind === "evict");
    expect(evicts.length).toBe(CUCKOO_MAX_ITERATIONS);
    const places = steps.filter((s) => s.kind === "place");
    expect(places.length).toBe(0);
  });

  it("property: after inserting a unique-key list, liveKeys equals the input set", () => {
    fc.assert(
      fc.property(
        // Keep load low enough to avoid cycles on the small 14-slot capacity.
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 5 }),
        (vals) => {
          const final = buildCuckooTable(CAP, vals);
          expect([...liveCuckooKeys(final)].sort((a, b) => a - b)).toEqual(
            [...vals].sort((a, b) => a - b),
          );
        },
      ),
    );
  });

  it("each occupied slot in the final state holds a key whose h1 or h2 equals that slot's index", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 5 }),
        (vals) => {
          const final = buildCuckooTable(CAP, vals);
          for (let i = 0; i < CAP; i++) {
            const a = final.slotsA[i];
            if (a.state === "occupied") expect(cuckooHash1(a.key, CAP)).toBe(i);
            const b = final.slotsB[i];
            if (b.state === "occupied") expect(cuckooHash2(b.key, CAP)).toBe(i);
          }
        },
      ),
    );
  });

  it("inserting a duplicate is a no-op on the snapshot state", () => {
    const before = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const after = [...cuckooInsertSequence(before, [5])].at(-1) as CuckooInsertStep;
    if (after.kind !== "done") throw new Error("expected done");
    expect(after.table.slotsA).toEqual(before.slotsA);
    expect(after.table.slotsB).toEqual(before.slotsB);
  });
});

describe("cuckooSearchSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const table = buildCuckooTable(CAP, [5]);
    const steps = [...cuckooSearchSequence(table, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("finds a T_A resident after a single check", () => {
    // After inserting [5, 0, 12, 14], TA[5]=5. Search 5 → 1 check, found.
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const steps = [...cuckooSearchSequence(table, [5])];
    const checks = steps.filter((s) => s.kind === "check");
    expect(checks).toHaveLength(1);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.side).toBe<CuckooSide>("A");
    expect(found.slotIndex).toBe(5);
  });

  it("finds a T_B resident after exactly two checks", () => {
    // After [5, 0, 12, 14], 12 lives in TB[1]. Search 12 → check TA[5]=5 (miss),
    // then check TB[1]=12 (found). The lesson's load-bearing claim.
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const steps = [...cuckooSearchSequence(table, [12])];
    const checks = steps.filter((s) => s.kind === "check");
    expect(checks).toHaveLength(2);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.side).toBe<CuckooSide>("B");
    expect(found.slotIndex).toBe(1);
  });

  it("misses after exactly two checks for a key not in the table", () => {
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const steps = [...cuckooSearchSequence(table, [99])];
    const checks = steps.filter((s) => s.kind === "check");
    expect(checks).toHaveLength(2);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.targetKey).toBe(99);
  });

  it("every emitted search step's codeLines fall inside the displayed Python source", () => {
    const lineCount = cuckooSearchPython.split("\n").length;
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    for (const step of cuckooSearchSequence(table, [5, 0, 12, 99])) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the input snapshot", () => {
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const before = JSON.parse(JSON.stringify(table));
    void [...cuckooSearchSequence(table, [5, 99])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("inspects at most two slots per target on any input", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 5 }),
        fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 10 }),
        (vals, targets) => {
          const table = buildCuckooTable(CAP, vals);
          const steps = [...cuckooSearchSequence(table, targets)];
          let checksThisTarget = 0;
          for (const s of steps) {
            if (s.kind === "begin") checksThisTarget = 0;
            if (s.kind === "check") checksThisTarget++;
            if (s.kind === "found" || s.kind === "miss") {
              expect(checksThisTarget).toBeLessThanOrEqual(2);
            }
          }
        },
      ),
    );
  });
});

describe("cuckooDeleteSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const table = buildCuckooTable(CAP, [5]);
    const steps = [...cuckooDeleteSequence(table, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("removes a T_A resident with a single check", () => {
    const table = buildCuckooTable(CAP, [5]);
    const steps = [...cuckooDeleteSequence(table, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "check", "found", "remove", "done"]);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slotsA[5]).toEqual({ state: "empty" });
  });

  it("removes a T_B resident after two checks (T_A miss, T_B hit)", () => {
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const steps = [...cuckooDeleteSequence(table, [0])];
    const checks = steps.filter((s) => s.kind === "check");
    expect(checks).toHaveLength(2);
    const remove = steps.find((s) => s.kind === "remove");
    if (remove?.kind !== "remove") throw new Error("expected remove");
    expect(remove.side).toBe<CuckooSide>("B");
    expect(remove.slotIndex).toBe(0);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slotsB[0]).toEqual({ state: "empty" });
    // Unrelated slots untouched.
    expect(last.table.slotsA[0]).toEqual({ state: "occupied", key: 14 });
  });

  it("misses without leaving a tombstone — slots stay state:empty", () => {
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const steps = [...cuckooDeleteSequence(table, [99])];
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
    // Confirm: there is NO tombstone state in cuckoo at all — only empty/occupied.
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    for (const slot of [...last.table.slotsA, ...last.table.slotsB]) {
      expect(slot.state === "empty" || slot.state === "occupied").toBe(true);
    }
  });

  it("delete-then-search misses cleanly (no tombstone bookkeeping needed)", () => {
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const afterDelete = [...cuckooDeleteSequence(table, [12])].at(-1)!.table;
    const searchSteps = [...cuckooSearchSequence(afterDelete, [12])];
    expect(searchSteps.find((s) => s.kind === "miss")).toBeDefined();
    expect(searchSteps.find((s) => s.kind === "found")).toBeUndefined();
    // Other keys still found.
    const findOther = [...cuckooSearchSequence(afterDelete, [5, 0, 14])];
    expect(findOther.filter((s) => s.kind === "found").length).toBe(3);
  });

  it("every emitted delete step's codeLines fall inside the displayed Python source", () => {
    const lineCount = cuckooDeletePython.split("\n").length;
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    for (const step of cuckooDeleteSequence(table, [14, 0, 99])) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the input snapshot", () => {
    const table = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const before = JSON.parse(JSON.stringify(table));
    void [...cuckooDeleteSequence(table, [12])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("property: deleting every inserted key yields a fully empty table", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 5 }),
        (vals) => {
          const filled = buildCuckooTable(CAP, vals);
          const after = [...cuckooDeleteSequence(filled, vals)].at(-1)!.table;
          for (const slot of [...after.slotsA, ...after.slotsB]) {
            expect(slot.state).toBe("empty");
          }
          expect(liveCuckooKeys(after)).toHaveLength(0);
        },
      ),
    );
  });
});

describe("liveCuckooKeys", () => {
  it("returns keys from both tables in (T_A then T_B) order", () => {
    const t = tableFromDescriptors(
      ["_", 1, "_", "_", "_", "_", "_"],
      [10, "_", "_", "_", "_", "_", "_"],
    );
    expect(liveCuckooKeys(t)).toEqual([1, 10]);
  });

  it("returns empty for an empty table", () => {
    expect(liveCuckooKeys(emptyCuckooTable(CAP))).toEqual([]);
  });
});

describe("buildCuckooTable", () => {
  it("matches the final-state snapshot from the equivalent insert sequence", () => {
    const built = buildCuckooTable(CAP, [5, 0, 12, 14]);
    const steps = [...cuckooInsertSequence(emptyCuckooTable(CAP), [5, 0, 12, 14])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(built.slotsA).toEqual(last.table.slotsA);
    expect(built.slotsB).toEqual(last.table.slotsB);
  });
});
