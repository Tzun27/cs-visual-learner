import { describe, it, expect } from "vitest";
import {
  buildHopscotchTable,
  emptyHopscotchTable,
  HOPSCOTCH_NEIGHBORHOOD,
  hopscotchHomeFor,
  hopscotchInsertSequence,
  hopscotchSearchSequence,
} from "@/lib/dataStructures/hopscotch";
import { hopscotchInsertPython } from "@/lib/dataStructures/hopscotchInsert.snippet";
import { hopscotchSearchPython } from "@/lib/dataStructures/hopscotchSearch.snippet";
import type { HopscotchSlot, HopscotchSnapshot } from "@/lib/dataStructures/types";

const CAP = 8;
const H = HOPSCOTCH_NEIGHBORHOOD;

describe("HOPSCOTCH_NEIGHBORHOOD", () => {
  it("is 4 — small enough to demo the bit mask, large enough for swap chains", () => {
    expect(H).toBe(4);
  });
});

describe("hopscotchHomeFor", () => {
  it("matches key % capacity for non-negative keys", () => {
    expect(hopscotchHomeFor(0, CAP)).toBe(0);
    expect(hopscotchHomeFor(8, CAP)).toBe(0);
    expect(hopscotchHomeFor(5, CAP)).toBe(5);
  });
  it("handles negative integers without -0 quirks", () => {
    expect(hopscotchHomeFor(-1, CAP)).toBe(7);
    expect(Object.is(hopscotchHomeFor(-8, CAP), 0)).toBe(true);
  });
});

describe("emptyHopscotchTable", () => {
  it("returns capacity slots of state 'empty' and zeroed hopInfo", () => {
    const table = emptyHopscotchTable(CAP);
    expect(table.capacity).toBe(CAP);
    expect(table.neighborhood).toBe(H);
    expect(table.slots).toHaveLength(CAP);
    expect(table.hopInfo).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    for (const s of table.slots) expect(s.state).toBe("empty");
  });
  it("respects an explicit neighborhood override", () => {
    const table = emptyHopscotchTable(8, 2);
    expect(table.neighborhood).toBe(2);
  });
});

describe("hopscotchInsertSequence", () => {
  it("yields only 'done' for an empty input list", () => {
    const steps = [...hopscotchInsertSequence(emptyHopscotchTable(CAP), [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("places a single key at its home slot when the slot is empty", () => {
    const steps = [...hopscotchInsertSequence(emptyHopscotchTable(CAP), [5])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "place", "done"]);
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(5);
    expect(place.distance).toBe(0);
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.hopInfo[5]).toBe(1); // bit 0 set
    const slot = last.table.slots[5];
    if (slot.state !== "occupied") throw new Error("expected occupied");
    expect(slot.key).toBe(5);
    expect(slot.home).toBe(5);
  });

  it("scans forward when home is occupied (no swap needed if within H)", () => {
    // 0 places at slot 0. 8 (also home 0) must scan past slot 0 → place at slot 1.
    const steps = [...hopscotchInsertSequence(emptyHopscotchTable(CAP), [0, 8])];
    const second = steps.filter((s) => s.kind === "place")[1];
    expect(second.slotIndex).toBe(1);
    expect(second.distance).toBe(1);
    const scans = steps.filter((s) => s.kind === "scan");
    // One scan past slot 0 during the second insert.
    expect(scans).toHaveLength(1);
    expect(scans[0].slotIndex).toBe(0);
  });

  it("runs a swap chain when the nearest empty is ≥ H from home", () => {
    // Sequence [0, 1, 8, 9, 16]: after placing the first four into
    // slots 0,1,2,3, key 16 (home 0) scans through all four, finds
    // empty at slot 4 (distance 4 == H), and runs one swap iteration
    // pulling 1 from slot 1 to slot 4. 16 ends up at slot 1.
    const steps = [...hopscotchInsertSequence(emptyHopscotchTable(CAP), [0, 1, 8, 9, 16])];
    const swaps = steps.filter((s) => s.kind === "swap");
    expect(swaps).toHaveLength(1);
    if (swaps[0].kind !== "swap") throw new Error("expected swap");
    expect(swaps[0].fromIndex).toBe(1);
    expect(swaps[0].toIndex).toBe(4);
    expect(swaps[0].pulledKey).toBe(1);
    expect(swaps[0].pulledHome).toBe(1);

    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    // Final table layout: slots 0,1,2,3,4 → 0,16,8,9,1.
    const occupied = last.table.slots.map((s) =>
      s.state === "occupied" ? `${s.key}@${s.home}` : "_",
    );
    expect(occupied.slice(0, 5)).toEqual(["0@0", "16@0", "8@0", "9@1", "1@1"]);
    // hopInfo[0] = bits {0,1,2} = 7. hopInfo[1] = bits {2,3} = 12.
    expect(last.table.hopInfo[0]).toBe(0b0111);
    expect(last.table.hopInfo[1]).toBe(0b1100);
  });

  it("detects duplicates during the scan-forward phase", () => {
    const steps = [...hopscotchInsertSequence(emptyHopscotchTable(CAP), [5, 5])];
    const dups = steps.filter((s) => s.kind === "duplicate");
    expect(dups).toHaveLength(1);
    expect(steps.filter((s) => s.kind === "place")).toHaveLength(1);
  });

  it("detects duplicates after a scan past unrelated keys", () => {
    // Pre-populate so 13 lives at slot 6 (home 5 → scan to empty 6).
    // Inserting 13 again must scan past slot 5 (= 5), find 13 at slot 6,
    // emit duplicate (not place).
    const table = buildHopscotchTable(CAP, [5, 13]);
    const steps = [...hopscotchInsertSequence(table, [13])];
    const dup = steps.find((s) => s.kind === "duplicate");
    if (dup?.kind !== "duplicate") throw new Error("expected duplicate");
    expect(dup.slotIndex).toBe(6);
    expect(steps.filter((s) => s.kind === "place")).toHaveLength(0);
  });

  it("throws when the table has no empty slot anywhere", () => {
    const filled = buildHopscotchTable(CAP, [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(() => [...hopscotchInsertSequence(filled, [99])]).toThrow(/table full/);
  });

  it("throws when the swap chain can't make room within H", () => {
    // Cap 8, H = 4. Fill slots 0,1,2,3 with home-0 keys (0, 8, 16, 24),
    // then try to insert 32 (also home 0). Scan past 0,1,2,3, empty at 4.
    // dist=4 ≥ H. Swap chain: cand slots are 1,2,3 — all homes are 0,
    // dist(0,4)=4 not < H. Dead end → throw.
    const stuck = buildHopscotchTable(CAP, [0, 8, 16, 24]);
    expect(() => [...hopscotchInsertSequence(stuck, [32])]).toThrow(/dead end/);
  });

  it("does not mutate its input snapshot", () => {
    const initial = emptyHopscotchTable(CAP);
    const before = JSON.parse(JSON.stringify(initial));
    void [...hopscotchInsertSequence(initial, [0, 1, 8, 9, 16])];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("emits fresh snapshots per step (no aliased slot refs)", () => {
    const steps = [...hopscotchInsertSequence(emptyHopscotchTable(CAP), [0, 1, 8])];
    const slotArrays = steps.map((s) => s.table.slots);
    for (let i = 0; i < slotArrays.length; i++) {
      for (let j = i + 1; j < slotArrays.length; j++) {
        expect(slotArrays[i]).not.toBe(slotArrays[j]);
      }
    }
  });

  it("every emitted insert step carries codeLines inside the displayed Python source", () => {
    const lineCount = hopscotchInsertPython.split("\n").length;
    for (const step of hopscotchInsertSequence(emptyHopscotchTable(CAP), [0, 1, 8, 9, 16, 16])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("scan-forward wraps around the end of the table", () => {
    // Fill slots 7, 0, 1 (home 7 → scan past 7 to 0 to 1 etc.). Insert a
    // key with home 7 needing to scan into slot 2.
    //   key 7 → slot 7. key 15 (home 7) scans to 0 (wrap). key 23 scans
    //   to 1. key 31 scans to 2.
    const steps = [...hopscotchInsertSequence(emptyHopscotchTable(CAP), [7, 15, 23, 31])];
    const places = steps.filter((s) => s.kind === "place");
    expect(places.map((p) => p.slotIndex)).toEqual([7, 0, 1, 2]);
    // distance for 31: empty slot 2 from home 7 = (2 - 7 + 8) % 8 = 3.
    expect(places[3].distance).toBe(3);
  });
});

describe("hopscotchSearchSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const steps = [...hopscotchSearchSequence(emptyHopscotchTable(CAP), [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("finds a home-slot key on the first bit check", () => {
    const table = buildHopscotchTable(CAP, [5]);
    const steps = [...hopscotchSearchSequence(table, [5])];
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(5);
    // Only one check-bit emitted (we break after finding).
    const checks = steps.filter((s) => s.kind === "check-bit");
    expect(checks.length).toBe(1);
  });

  it("finds an in-neighborhood key by scanning bits set in the home mask", () => {
    // After inserting [0, 1, 8, 9, 16], 8 lives at slot 2 (home 0, bit 2).
    // Search 8: home 0, mask = 7 (bits 0,1,2). bit 0 (slot 0 = 0 ≠ 8),
    // bit 1 (slot 1 = 16 ≠ 8), bit 2 (slot 2 = 8 = 8) → found.
    const table = buildHopscotchTable(CAP, [0, 1, 8, 9, 16]);
    const steps = [...hopscotchSearchSequence(table, [8])];
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.slotIndex).toBe(2);
    // Three check-bits: bit 0 set+nomatch, bit 1 set+nomatch, bit 2 set+match.
    const checks = steps.filter((s) => s.kind === "check-bit");
    expect(checks.length).toBe(3);
  });

  it("misses cleanly when no hop bit is set for the home", () => {
    // Search a key whose home has hopInfo = 0 — checks all H bits, all
    // are clear, then miss.
    const table = buildHopscotchTable(CAP, [0]);
    const steps = [...hopscotchSearchSequence(table, [3])];
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
    const checks = steps.filter((s) => s.kind === "check-bit");
    expect(checks.length).toBe(H);
    for (const c of checks) {
      if (c.kind !== "check-bit") continue;
      expect(c.isSet).toBe(false);
    }
  });

  it("misses when home has set bits but none of the indicated slots match", () => {
    // hopInfo[0] bits {0,1,2} but no slot holds the target. Bits get
    // checked, slot-key compared, none match → miss after all bits.
    const table = buildHopscotchTable(CAP, [0, 1, 8]);
    const steps = [...hopscotchSearchSequence(table, [99])];
    // 99 % 8 = 3, hopInfo[3] = 0; all 4 bit checks come back clear → miss.
    const checks = steps.filter((s) => s.kind === "check-bit");
    expect(checks.length).toBe(H);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });

  it("every emitted search step carries codeLines inside the displayed Python source", () => {
    const lineCount = hopscotchSearchPython.split("\n").length;
    const table = buildHopscotchTable(CAP, [0, 1, 8, 9, 16]);
    for (const step of hopscotchSearchSequence(table, [0, 8, 99])) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("does not mutate the input snapshot", () => {
    const table = buildHopscotchTable(CAP, [0, 1, 8]);
    const before = JSON.parse(JSON.stringify(table));
    void [...hopscotchSearchSequence(table, [0, 99])];
    expect(JSON.parse(JSON.stringify(table))).toEqual(before);
  });

  it("returns miss when a home-mask bit is set but its slot is empty (defensive)", () => {
    // Construct an artificial bad-state table: hopInfo[0] = 1 but slot 0
    // is empty. Search 0 → home 0, mask = 1, check bit 0 (set), slot 0
    // empty → no match → bit 0 only set bit, then loop exits → miss.
    const slots: HopscotchSlot[] = Array.from({ length: CAP }, () => ({
      state: "empty" as const,
    }));
    const table: HopscotchSnapshot = {
      capacity: CAP,
      neighborhood: H,
      slots,
      hopInfo: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    const steps = [...hopscotchSearchSequence(table, [0])];
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
  });
});

describe("buildHopscotchTable", () => {
  it("constructs from a key sequence and matches the insert end-state", () => {
    const table = buildHopscotchTable(CAP, [0, 1, 8, 9, 16]);
    const occupied = table.slots.map((s) => (s.state === "occupied" ? `${s.key}@${s.home}` : "_"));
    expect(occupied.slice(0, 5)).toEqual(["0@0", "16@0", "8@0", "9@1", "1@1"]);
    expect(table.hopInfo[0]).toBe(0b0111);
    expect(table.hopInfo[1]).toBe(0b1100);
  });
});
