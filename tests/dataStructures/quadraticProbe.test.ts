import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { emptyTable } from "@/lib/dataStructures/linearProbe";
import {
  buildQuadraticProbeTable,
  quadraticHomeFor,
  quadraticProbeDeleteSequence,
  quadraticProbeInsertSequence,
  quadraticProbeSearchSequence,
  quadraticSlotFor,
} from "@/lib/dataStructures/quadraticProbe";
import { quadraticProbeDeletePython } from "@/lib/dataStructures/quadraticProbeDelete.snippet";
import { quadraticProbeInsertPython } from "@/lib/dataStructures/quadraticProbeInsert.snippet";
import { quadraticProbeSearchPython } from "@/lib/dataStructures/quadraticProbeSearch.snippet";
import type { LinearProbeSlot, LinearProbeSnapshot } from "@/lib/dataStructures/types";

// 11 is the canonical small prime used by the lesson — i*i mod 11 visits
// (p+1)/2 = 6 distinct values, enough to demonstrate non-clustering at
// load < 0.5 without ever cycling on the curated demo inputs.
const CAP = 11;

function fromSlotsDescriptor(descriptor: readonly (number | "_" | "X")[]): LinearProbeSnapshot {
  const slots: LinearProbeSlot[] = descriptor.map((d) => {
    if (d === "_") return { state: "empty" };
    if (d === "X") return { state: "tombstone" };
    return { state: "occupied", key: d };
  });
  return { capacity: descriptor.length, slots };
}

describe("quadraticHomeFor", () => {
  it("matches plain key % capacity for non-negative keys", () => {
    expect(quadraticHomeFor(5, 11)).toBe(5);
    expect(quadraticHomeFor(16, 11)).toBe(5);
    expect(quadraticHomeFor(0, 11)).toBe(0);
  });

  it("handles negative integers without -0 quirks", () => {
    expect(quadraticHomeFor(-1, 11)).toBe(10);
    expect(quadraticHomeFor(-11, 11)).toBe(0);
    expect(Object.is(quadraticHomeFor(-11, 11), 0)).toBe(true);
  });
});

describe("quadraticSlotFor", () => {
  it("returns the home slot for probe=0", () => {
    expect(quadraticSlotFor(5, 0, 11)).toBe(5);
  });

  it("advances by i*i mod capacity", () => {
    expect(quadraticSlotFor(5, 1, 11)).toBe(6);
    expect(quadraticSlotFor(5, 2, 11)).toBe(9);
    expect(quadraticSlotFor(5, 3, 11)).toBe(3); // (5+9) % 11
    expect(quadraticSlotFor(5, 4, 11)).toBe(10); // (5+16) % 11
  });

  it("handles negative home gracefully", () => {
    expect(quadraticSlotFor(-1, 2, 11)).toBe(3); // ((-1+4)%11+11)%11
  });
});

describe("quadraticProbeInsertSequence", () => {
  it("yields only 'done' for an empty input list", () => {
    const steps = [...quadraticProbeInsertSequence(emptyTable(CAP), [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("places a single key at hash(key) % capacity", () => {
    const steps = [...quadraticProbeInsertSequence(emptyTable(CAP), [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "place", "done"]);
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(5);
  });

  it("spreads same-bucket keys by i*i (5,16,27,38 land at 5,6,9,3)", () => {
    // All four keys mod 11 = 5. Their quadratic probe sequence from home 5
    // is 5, 6, 9, 3 — the headline demo for non-clustering.
    const steps = [...quadraticProbeInsertSequence(emptyTable(CAP), [5, 16, 27, 38])];
    const places = steps.filter((s) => s.kind === "place");
    expect(places.map((p) => p.slotIndex)).toEqual([5, 6, 9, 3]);
  });

  it("emits one 'probe' step per rejected slot on the path to a placement", () => {
    // Inserting 27 after [5, 16] fills slots 5 and 6, so 27 probes twice
    // (rejects 5, rejects 6) before placing at 9.
    const table = buildQuadraticProbeTable(CAP, [5, 16]);
    const steps = [...quadraticProbeInsertSequence(table, [27])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes.map((p) => p.slotIndex)).toEqual([5, 6]);
    expect(probes.map((p) => p.probeCount)).toEqual([1, 2]);
  });

  it("aborts on duplicate without yielding a 'place' step", () => {
    const steps = [...quadraticProbeInsertSequence(emptyTable(CAP), [5, 5])];
    expect(steps.filter((s) => s.kind === "place")).toHaveLength(1);
    expect(steps.filter((s) => s.kind === "duplicate")).toHaveLength(1);
  });

  it("returns 'duplicate' even after probing past collisions", () => {
    // Insert 5, 16, then re-insert 16 — 16 hashes to 5, probes past slot 5,
    // finds itself at slot 6 → duplicate, not place.
    const steps = [...quadraticProbeInsertSequence(emptyTable(CAP), [5, 16, 16])];
    const dups = steps.filter((s) => s.kind === "duplicate");
    expect(dups).toHaveLength(1);
    if (dups[0].kind !== "duplicate") throw new Error("expected duplicate");
    expect(dups[0].slotIndex).toBe(6);
  });

  it("probes past tombstones (does not reuse them)", () => {
    // Pre-built: slot 5 = 5, slot 6 = tombstone, slot 7 = _. Insert 16 →
    // probes past 5 (occupied) and 6 (tombstone), then i=2 jumps to slot 9.
    const initial = fromSlotsDescriptor(["_", "_", "_", "_", "_", 5, "X", "_", "_", "_", "_"]);
    const steps = [...quadraticProbeInsertSequence(initial, [16])];
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(9);
  });

  it("every emitted insert step carries codeLines inside the displayed Python source", () => {
    const lineCount = quadraticProbeInsertPython.split("\n").length;
    for (const step of quadraticProbeInsertSequence(emptyTable(CAP), [5, 16, 27, 5])) {
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
    void [...quadraticProbeInsertSequence(initial, [5, 16])];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("emits fresh snapshots per step (no aliased slot refs)", () => {
    const steps = [...quadraticProbeInsertSequence(emptyTable(CAP), [5, 16, 27])];
    const slotArrays = steps.map((s) => s.table.slots);
    for (let i = 0; i < slotArrays.length; i++) {
      for (let j = i + 1; j < slotArrays.length; j++) {
        expect(slotArrays[i]).not.toBe(slotArrays[j]);
      }
    }
  });

  it("throws when the probe sequence cannot reach an empty slot", () => {
    // Capacity 4 is non-prime: i*i mod 4 ∈ {0, 1}. From any home, only two
    // distinct slots are visited. With slots [99, 99, _, _] and home=0,
    // both reachable slots are occupied with a non-matching key → throw.
    const stuck = fromSlotsDescriptor([99, 99, "_", "_"]);
    expect(() => [...quadraticProbeInsertSequence(stuck, [4])]).toThrow(/no slot/);
  });

  it("property: liveKeys-equivalent for unique keys at load < 0.5", () => {
    // Bounded inputs so the curated `cap=11` table stays at load < 0.5
    // (avoids the quadratic-probing reachability caveat).
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 5 }),
        (vals) => {
          const final = buildQuadraticProbeTable(CAP, vals);
          const live = final.slots
            .filter((s) => s.state === "occupied")
            .map((s) => (s.state === "occupied" ? s.key : -1));
          expect([...live].sort((a, b) => a - b)).toEqual([...vals].sort((a, b) => a - b));
        },
      ),
    );
  });
});

describe("quadraticProbeSearchSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const table = buildQuadraticProbeTable(CAP, [5, 16]);
    const steps = [...quadraticProbeSearchSequence(table, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("finds a key at its home slot in zero probes", () => {
    const table = buildQuadraticProbeTable(CAP, [5]);
    const steps = [...quadraticProbeSearchSequence(table, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "found", "done"]);
  });

  it("finds a key by probing past i*i collisions", () => {
    // 5, 16, 27 land at 5, 6, 9. Search 27 → probe past 5, probe past 6,
    // find at 9.
    const table = buildQuadraticProbeTable(CAP, [5, 16, 27]);
    const steps = [...quadraticProbeSearchSequence(table, [27])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(2);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(9);
  });

  it("probes past tombstones (does not terminate on tombstone)", () => {
    // Slot 5 = tombstone, slot 6 = 16. Search 16 → hash to 5 (tombstone,
    // probe), then i=1 lands at 6 (found).
    const table = fromSlotsDescriptor(["_", "_", "_", "_", "_", "X", 16, "_", "_", "_", "_"]);
    const steps = [...quadraticProbeSearchSequence(table, [16])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(1);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(6);
  });

  it("misses on an empty slot at the home position with zero probes", () => {
    const table = buildQuadraticProbeTable(CAP, []);
    const steps = [...quadraticProbeSearchSequence(table, [5])];
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(5);
    expect(steps.filter((s) => s.kind === "probe")).toHaveLength(0);
  });

  it("missing key inside a probe cluster terminates on the first empty slot in the sequence", () => {
    // After inserting [5, 16], slots 5 and 6 occupied; slot 9 (= probe i=2)
    // is still empty. Searching 27 hashes to 5, probes past 5 and 6, misses
    // at 9.
    const table = buildQuadraticProbeTable(CAP, [5, 16]);
    const steps = [...quadraticProbeSearchSequence(table, [27])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(2);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(9);
  });

  it("every emitted search step carries codeLines inside the displayed Python source", () => {
    const lineCount = quadraticProbeSearchPython.split("\n").length;
    const table = buildQuadraticProbeTable(CAP, [5, 16, 27, 6]);
    for (const step of quadraticProbeSearchSequence(table, [5, 16, 27, 99, 6])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the table snapshot", () => {
    const table = buildQuadraticProbeTable(CAP, [5, 16]);
    const before = JSON.parse(JSON.stringify(table));
    void [...quadraticProbeSearchSequence(table, [5, 99])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("misses cleanly after walking the full probe sequence with no empty", () => {
    // Cap 4: probe sequence from home 3 visits slots {3, 0, 3, 0} only.
    // With [0,1,2,3] occupying every slot, target 99 walks the loop to
    // exhaustion without seeing an empty → trailing miss fires.
    const filled = fromSlotsDescriptor([0, 1, 2, 3]);
    const steps = [...quadraticProbeSearchSequence(filled, [99])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes.length).toBe(4);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });
});

describe("quadraticProbeDeleteSequence", () => {
  it("replaces the matched slot with a tombstone (not empty)", () => {
    const table = buildQuadraticProbeTable(CAP, [5]);
    const steps = [...quadraticProbeDeleteSequence(table, [5])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[5]).toEqual({ state: "tombstone" });
  });

  it("yields begin → hash → found → tombstone → done for a home-slot delete", () => {
    const table = buildQuadraticProbeTable(CAP, [5]);
    const steps = [...quadraticProbeDeleteSequence(table, [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "found", "tombstone", "done"]);
  });

  it("walks a probe sequence to find a deeper key", () => {
    // 5,16,27 → slots 5,6,9. Delete 27 → probe past 5, probe past 6, find at 9.
    const table = buildQuadraticProbeTable(CAP, [5, 16, 27]);
    const steps = [...quadraticProbeDeleteSequence(table, [27])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(2);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[9]).toEqual({ state: "tombstone" });
    expect(last.table.slots[5]).toEqual({ state: "occupied", key: 5 });
    expect(last.table.slots[6]).toEqual({ state: "occupied", key: 16 });
  });

  it("misses when the probe sequence reaches an empty slot", () => {
    const table = buildQuadraticProbeTable(CAP, [5, 16]);
    const steps = [...quadraticProbeDeleteSequence(table, [27])];
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.slotIndex).toBe(9); // first empty along the probe sequence
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[5]).toEqual({ state: "occupied", key: 5 });
    expect(last.table.slots[6]).toEqual({ state: "occupied", key: 16 });
  });

  it("every emitted delete step carries codeLines inside the displayed Python source", () => {
    const lineCount = quadraticProbeDeletePython.split("\n").length;
    const table = buildQuadraticProbeTable(CAP, [5, 16, 27]);
    for (const step of quadraticProbeDeleteSequence(table, [16, 5, 99])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the input table snapshot", () => {
    const table = buildQuadraticProbeTable(CAP, [5, 16]);
    const before = JSON.parse(JSON.stringify(table));
    void [...quadraticProbeDeleteSequence(table, [5])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("delete-then-search misses (tombstone obeys the deletion)", () => {
    const table = buildQuadraticProbeTable(CAP, [5, 16]);
    const afterDelete = [...quadraticProbeDeleteSequence(table, [5])].at(-1)!.table;
    const searchSteps = [...quadraticProbeSearchSequence(afterDelete, [5])];
    expect(searchSteps.find((s) => s.kind === "miss")).toBeDefined();
    expect(searchSteps.find((s) => s.kind === "found")).toBeUndefined();
  });

  it("delete-then-search still finds keys past the tombstone", () => {
    // Delete 5 → slot 5 tombstone. Search 16 (also hashes to 5) → probe
    // past tombstone at 5, find at 6.
    const table = buildQuadraticProbeTable(CAP, [5, 16]);
    const afterDelete = [...quadraticProbeDeleteSequence(table, [5])].at(-1)!.table;
    const searchSteps = [...quadraticProbeSearchSequence(afterDelete, [16])];
    const found = searchSteps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(6);
  });

  it("misses cleanly after walking the full probe sequence", () => {
    const filled = fromSlotsDescriptor([0, 1, 2, 3]);
    const steps = [...quadraticProbeDeleteSequence(filled, [99])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes.length).toBe(4);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });

  it("probes past a tombstone when deleting a key that lives after it", () => {
    const table = fromSlotsDescriptor(["_", "_", "_", "_", "_", "X", 16, "_", "_", "_", "_"]);
    const steps = [...quadraticProbeDeleteSequence(table, [16])];
    const probeStep = steps.find((s) => s.kind === "probe");
    if (probeStep?.kind !== "probe") throw new Error("expected probe");
    expect(probeStep.slotIndex).toBe(5);
  });
});
