import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildLinearProbeTable, liveKeys } from "@/lib/dataStructures/linearProbe";
import {
  buildRobinHoodTable,
  displacementOf,
  maxDisplacement,
  robinHoodInsertSequence,
} from "@/lib/dataStructures/robinHood";
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
