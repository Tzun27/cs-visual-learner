import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  CUCKOO_FILTER_FP_RANGE,
  CUCKOO_FILTER_MAX_ITERATIONS,
  buildCuckooFilter,
  cuckooFilterAlt,
  cuckooFilterContains,
  cuckooFilterDeleteSequence,
  cuckooFilterFingerprint,
  cuckooFilterHashFp,
  cuckooFilterHome,
  cuckooFilterInsertSequence,
  cuckooFilterSearchSequence,
  emptyCuckooFilter,
  liveCuckooFilterFingerprints,
} from "@/lib/dataStructures/cuckooFilter";
import { cuckooFilterDeletePython } from "@/lib/dataStructures/cuckooFilterDelete.snippet";
import { cuckooFilterInsertPython } from "@/lib/dataStructures/cuckooFilterInsert.snippet";
import { cuckooFilterSearchPython } from "@/lib/dataStructures/cuckooFilterSearch.snippet";
import type {
  CuckooFilterInsertStep,
  CuckooFilterSlot,
  CuckooFilterSnapshot,
} from "@/lib/dataStructures/types";

const CAP = 8;

function fromSlots(descriptor: readonly (number | "_")[]): CuckooFilterSnapshot {
  const slots: CuckooFilterSlot[] = descriptor.map((d) =>
    d === "_" ? { state: "empty" } : { state: "occupied", fingerprint: d },
  );
  return { capacity: descriptor.length, slots };
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

describe("cuckooFilterFingerprint", () => {
  it("always returns a value in [1, FP_RANGE]", () => {
    for (let k = 0; k < 200; k++) {
      const fp = cuckooFilterFingerprint(k);
      expect(fp).toBeGreaterThanOrEqual(1);
      expect(fp).toBeLessThanOrEqual(CUCKOO_FILTER_FP_RANGE);
    }
  });

  it("never returns 0 (reserved for the empty-slot sentinel)", () => {
    for (let k = -50; k < 200; k++) {
      expect(cuckooFilterFingerprint(k)).not.toBe(0);
    }
  });

  it("matches (k mod 7) + 1 for non-negative keys", () => {
    expect(cuckooFilterFingerprint(0)).toBe(1);
    expect(cuckooFilterFingerprint(5)).toBe(6); // 5 mod 7 = 5, +1 = 6
    expect(cuckooFilterFingerprint(7)).toBe(1);
    expect(cuckooFilterFingerprint(13)).toBe(7); // 13 mod 7 = 6, +1 = 7
  });

  it("handles negative integers symmetrically", () => {
    expect(cuckooFilterFingerprint(-1)).toBe(7); // -1 mod 7 normalized = 6, +1 = 7
    expect(cuckooFilterFingerprint(-7)).toBe(1);
  });
});

describe("cuckooFilterHome", () => {
  it("matches k % capacity for non-negatives", () => {
    expect(cuckooFilterHome(0, CAP)).toBe(0);
    expect(cuckooFilterHome(5, CAP)).toBe(5);
    expect(cuckooFilterHome(8, CAP)).toBe(0);
    expect(cuckooFilterHome(13, CAP)).toBe(5);
  });
});

describe("cuckooFilterHashFp", () => {
  it("is non-zero for every legal fingerprint at capacity 8", () => {
    for (let fp = 1; fp <= CUCKOO_FILTER_FP_RANGE; fp++) {
      expect(cuckooFilterHashFp(fp, CAP)).not.toBe(0);
    }
  });

  it("matches the documented (fp * 3) mod 8 mapping", () => {
    expect(cuckooFilterHashFp(1, CAP)).toBe(3);
    expect(cuckooFilterHashFp(2, CAP)).toBe(6);
    expect(cuckooFilterHashFp(3, CAP)).toBe(1);
    expect(cuckooFilterHashFp(4, CAP)).toBe(4);
    expect(cuckooFilterHashFp(5, CAP)).toBe(7);
    expect(cuckooFilterHashFp(6, CAP)).toBe(2);
    expect(cuckooFilterHashFp(7, CAP)).toBe(5);
  });
});

describe("cuckooFilterAlt", () => {
  it("is symmetric: alt(alt(s, fp), fp) == s — the XOR-trick invariant", () => {
    for (let slot = 0; slot < CAP; slot++) {
      for (let fp = 1; fp <= CUCKOO_FILTER_FP_RANGE; fp++) {
        const altSlot = cuckooFilterAlt(slot, fp, CAP);
        const backToOriginal = cuckooFilterAlt(altSlot, fp, CAP);
        expect(backToOriginal).toBe(slot);
      }
    }
  });

  it("always differs from the original slot (because hashFp is non-zero)", () => {
    for (let slot = 0; slot < CAP; slot++) {
      for (let fp = 1; fp <= CUCKOO_FILTER_FP_RANGE; fp++) {
        expect(cuckooFilterAlt(slot, fp, CAP)).not.toBe(slot);
      }
    }
  });

  it("matches the documented values for key 5 (home=5, fp=6 → alt=7)", () => {
    expect(cuckooFilterAlt(5, 6, CAP)).toBe(7); // 5 XOR 2 = 7
  });
});

describe("emptyCuckooFilter", () => {
  it("produces a snapshot with the requested capacity and all-empty slots", () => {
    const t = emptyCuckooFilter(CAP);
    expect(t.capacity).toBe(CAP);
    expect(t.slots).toHaveLength(CAP);
    expect(t.slots.every((s) => s.state === "empty")).toBe(true);
  });
});

describe("cuckooFilterInsertSequence", () => {
  it("yields only 'done' for an empty key list", () => {
    const steps = [...cuckooFilterInsertSequence(emptyCuckooFilter(CAP), [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("places a single key at its home slot via the home-check path", () => {
    const steps = [...cuckooFilterInsertSequence(emptyCuckooFilter(CAP), [5])];
    expect(steps.map((s) => s.kind)).toEqual([
      "begin",
      "fingerprint",
      "hash",
      "check",
      "place",
      "done",
    ]);
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(5);
    expect(place.placedFingerprint).toBe(6); // fp(5) = 6
    expect(place.phase).toBe("home");
  });

  it("falls through to the alt slot when home is occupied but alt is empty", () => {
    // Seed T[5] with some fingerprint; insert a key whose home is 5 and alt empty.
    const initial = fromSlots(["_", "_", "_", "_", "_", 4, "_", "_"]);
    // Pick a key with home=5 but fingerprint != 4. k=5 → fp=6, h1=5, alt=7. Works.
    const steps = [...cuckooFilterInsertSequence(initial, [5])];
    const place = steps.find((s) => s.kind === "place");
    if (place?.kind !== "place") throw new Error("expected place");
    expect(place.slotIndex).toBe(7);
    expect(place.phase).toBe("alt");
    // No eviction in this path.
    expect(steps.filter((s) => s.kind === "evict")).toHaveLength(0);
  });

  it("runs a two-step eviction cascade on the curated [5, 0, 7, 13] input", () => {
    // Trace:
    //   5 → fp=6, h1=5, place at T[5]
    //   0 → fp=1, h1=0, place at T[0]
    //   7 → fp=1, h1=7, place at T[7]
    //   13 → fp=7, h1=5, alt=0. Both occupied.
    //        Evict T[5] (fp=6), place fp=7 there. fp=6 → alt(5,6)=7. T[7] occupied (fp=1).
    //        Evict T[7], place fp=6 there. fp=1 → alt(7,1)=4. T[4] empty → place.
    const steps = [...cuckooFilterInsertSequence(emptyCuckooFilter(CAP), [5, 0, 7, 13])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[0]).toEqual({ state: "occupied", fingerprint: 1 });
    expect(last.table.slots[4]).toEqual({ state: "occupied", fingerprint: 1 });
    expect(last.table.slots[5]).toEqual({ state: "occupied", fingerprint: 7 });
    expect(last.table.slots[7]).toEqual({ state: "occupied", fingerprint: 6 });
    // Exactly 2 evict steps fired (both during the insertion of 13).
    const evicts = steps.filter((s) => s.kind === "evict");
    expect(evicts).toHaveLength(2);
  });

  it("evict steps carry both slotIndex and nextSlotIndex with the XOR-trick relation", () => {
    const steps = [...cuckooFilterInsertSequence(emptyCuckooFilter(CAP), [5, 0, 7, 13])];
    const evicts = steps.filter((s) => s.kind === "evict");
    for (const e of evicts) {
      if (e.kind !== "evict") throw new Error("expected evict");
      // nextSlotIndex must equal slotIndex XOR hashFp(evictedFingerprint).
      const expected = cuckooFilterAlt(e.slotIndex, e.evictedFingerprint, CAP);
      expect(e.nextSlotIndex).toBe(expected);
    }
  });

  it("every emitted insert step's codeLines fall inside the displayed Python source", () => {
    const lineCount = cuckooFilterInsertPython.split("\n").length;
    const steps = [...cuckooFilterInsertSequence(emptyCuckooFilter(CAP), [5, 0, 7, 13])];
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
    const initial = emptyCuckooFilter(CAP);
    const before = JSON.parse(JSON.stringify(initial));
    void [...cuckooFilterInsertSequence(initial, [5, 0, 7, 13])];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("emits fresh snapshot arrays per step (no aliased slot refs)", () => {
    const steps = [...cuckooFilterInsertSequence(emptyCuckooFilter(CAP), [5, 0, 7])];
    for (let i = 0; i < steps.length; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        expect(steps[i].table.slots).not.toBe(steps[j].table.slots);
      }
    }
  });

  it("emits a 'cycle' step and throws when the cascade exceeds MAX iterations", () => {
    // Pack the table to force a cycle when inserting another key with no
    // legal home. Fill every slot with fingerprint 1 — any key with
    // fp = 1 cycles because every slot already holds its own fingerprint.
    const packed = fromSlots([1, 1, 1, 1, 1, 1, 1, 1]);
    // k=7 has fp=1, h1=7, alt(7,1)=4. The cascade keeps swapping fp=1
    // around the table without finding an empty slot.
    const { steps, threw } = consumeUntilThrow(cuckooFilterInsertSequence(packed, [7]));
    expect(threw).not.toBeNull();
    expect(threw!.message).toMatch(/cycle/);
    const cycle = steps.find((s) => s.kind === "cycle");
    expect(cycle).toBeDefined();
    expect(steps.filter((s) => s.kind === "evict").length).toBe(CUCKOO_FILTER_MAX_ITERATIONS);
    expect(steps.filter((s) => s.kind === "place").length).toBe(0);
  });

  it("property: inserting unique keys (within capacity) never duplicates the table count", () => {
    fc.assert(
      fc.property(
        // Keep load very low to avoid spurious cycles on the tiny 8-slot demo.
        fc.uniqueArray(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 3 }),
        (vals) => {
          try {
            const final = buildCuckooFilter(CAP, vals);
            const live = liveCuckooFilterFingerprints(final);
            expect(live).toHaveLength(vals.length);
          } catch (e) {
            // Cycles allowed on adversarial inputs; only assert the
            // non-cycling case. Re-throw anything that isn't a cycle.
            if (!(e as Error).message.match(/cycle/)) throw e;
          }
        },
      ),
    );
  });

  it("property: every successfully inserted key reports contains() == true on its own fingerprint", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 3 }),
        (vals) => {
          try {
            const final = buildCuckooFilter(CAP, vals);
            for (const k of vals) {
              expect(cuckooFilterContains(final, k)).toBe(true);
            }
          } catch (e) {
            if (!(e as Error).message.match(/cycle/)) throw e;
          }
        },
      ),
    );
  });
});

describe("cuckooFilterSearchSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const filter = buildCuckooFilter(CAP, [5]);
    const steps = [...cuckooFilterSearchSequence(filter, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("finds a key at its home slot in one check", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    // 13 lives at T[5] after the cascade. Search 13 → check home, found.
    const steps = [...cuckooFilterSearchSequence(filter, [13])];
    const checks = steps.filter((s) => s.kind === "check");
    expect(checks).toHaveLength(1);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.phase).toBe("home");
    expect(found.slotIndex).toBe(5);
  });

  it("finds a key at its alt slot in two checks (the canonical worst case)", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    // 5's fp=6 was evicted from T[5] to T[7]. Search 5: home T[5] holds fp=7 (no), alt T[7] holds fp=6 (yes).
    const steps = [...cuckooFilterSearchSequence(filter, [5])];
    const checks = steps.filter((s) => s.kind === "check");
    expect(checks).toHaveLength(2);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.phase).toBe("alt");
    expect(found.slotIndex).toBe(7);
  });

  it("reports 'found' for the curated FALSE POSITIVE key 35 (fp matches at T[0])", () => {
    // 35: fp = 35 % 7 + 1 = 1. h1 = 35 % 8 = 3. alt = 3 XOR hashFp(1) = 3 XOR 3 = 0.
    // T[0] holds fp=1 (placed by inserting 0). Algorithm reports found, but 35 was never inserted.
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    const steps = [...cuckooFilterSearchSequence(filter, [35])];
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.targetKey).toBe(35);
    expect(found.phase).toBe("alt");
    expect(found.slotIndex).toBe(0);
    // The algorithm's "yes" is indistinguishable from a true positive —
    // this is the false-positive nature of the filter.
  });

  it("misses cleanly when neither slot holds the fingerprint", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    const steps = [...cuckooFilterSearchSequence(filter, [99])];
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
    expect(steps.filter((s) => s.kind === "check")).toHaveLength(2);
  });

  it("property: every search inspects at most two slots", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 3 }),
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 10 }),
        (vals, targets) => {
          let filter: CuckooFilterSnapshot;
          try {
            filter = buildCuckooFilter(CAP, vals);
          } catch (e) {
            if (!(e as Error).message.match(/cycle/)) throw e;
            return;
          }
          const steps = [...cuckooFilterSearchSequence(filter, targets)];
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

  it("every emitted search step's codeLines fall inside the displayed Python source", () => {
    const lineCount = cuckooFilterSearchPython.split("\n").length;
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    for (const step of cuckooFilterSearchSequence(filter, [13, 5, 35, 99])) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });
});

describe("cuckooFilterDeleteSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const filter = buildCuckooFilter(CAP, [5]);
    const steps = [...cuckooFilterDeleteSequence(filter, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("clears the matched slot on a home-slot hit (no tombstones)", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    const steps = [...cuckooFilterDeleteSequence(filter, [13])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(last.table.slots[5]).toEqual({ state: "empty" });
    // No tombstone state — just empty/occupied.
    for (const slot of last.table.slots) {
      expect(slot.state === "empty" || slot.state === "occupied").toBe(true);
    }
  });

  it("misses without modifying any slot when both candidate slots fail", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    const before = JSON.parse(JSON.stringify(filter));
    const steps = [...cuckooFilterDeleteSequence(filter, [99])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(JSON.parse(JSON.stringify(last.table))).toEqual(before);
  });

  it("DEMONSTRATES the delete-safety pitfall: deleting a never-inserted key whose fp collides clears a real entry", () => {
    // Critical pedagogical case. 35 was never inserted but its fp matches
    // what 0's insert wrote at T[0]. Deleting 35 reports success and
    // clears T[0] — silently breaking the lookup for 0.
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    expect(cuckooFilterContains(filter, 0)).toBe(true);

    const afterDelete35 = [...cuckooFilterDeleteSequence(filter, [35])].at(-1);
    if (afterDelete35?.kind !== "done") throw new Error("expected done");
    expect(afterDelete35.table.slots[0]).toEqual({ state: "empty" });
    // 0 is now LOST — the filter no longer reports it as present.
    expect(cuckooFilterContains(afterDelete35.table, 0)).toBe(false);
  });

  it("does not mutate the input snapshot", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    const before = JSON.parse(JSON.stringify(filter));
    void [...cuckooFilterDeleteSequence(filter, [13])];
    expect(JSON.parse(JSON.stringify(filter))).toEqual(before);
  });

  it("every emitted delete step's codeLines fall inside the displayed Python source", () => {
    const lineCount = cuckooFilterDeletePython.split("\n").length;
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    for (const step of cuckooFilterDeleteSequence(filter, [13, 99])) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("found-then-remove pair is consecutive (the remove step's slot equals the found step's slot)", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    const steps = [...cuckooFilterDeleteSequence(filter, [13])];
    const foundIdx = steps.findIndex((s) => s.kind === "found");
    expect(foundIdx).toBeGreaterThanOrEqual(0);
    const removeStep = steps[foundIdx + 1];
    expect(removeStep.kind).toBe("remove");
    if (steps[foundIdx].kind !== "found" || removeStep.kind !== "remove") {
      throw new Error("type narrowing");
    }
    expect(removeStep.slotIndex).toBe(steps[foundIdx].slotIndex);
  });
});

describe("liveCuckooFilterFingerprints", () => {
  it("returns just the fingerprints (not original keys) in slot order", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    // From the trace: T[0]=1, T[4]=1, T[5]=7, T[7]=6 → [1, 1, 7, 6].
    expect(liveCuckooFilterFingerprints(filter)).toEqual([1, 1, 7, 6]);
  });

  it("returns empty for an empty filter", () => {
    expect(liveCuckooFilterFingerprints(emptyCuckooFilter(CAP))).toEqual([]);
  });
});

describe("buildCuckooFilter", () => {
  it("matches the final-state snapshot from the equivalent insert sequence", () => {
    const built = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    const last = [...cuckooFilterInsertSequence(emptyCuckooFilter(CAP), [5, 0, 7, 13])].at(
      -1,
    ) as CuckooFilterInsertStep;
    if (last.kind !== "done") throw new Error("expected done");
    expect(built.slots).toEqual(last.table.slots);
  });
});

describe("cuckooFilterContains", () => {
  it("returns true for all four inserted keys on the curated demo", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    for (const k of [5, 0, 7, 13]) {
      expect(cuckooFilterContains(filter, k)).toBe(true);
    }
  });

  it("returns true for the false-positive key 35", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    expect(cuckooFilterContains(filter, 35)).toBe(true);
  });

  it("returns false for true negatives", () => {
    const filter = buildCuckooFilter(CAP, [5, 0, 7, 13]);
    expect(cuckooFilterContains(filter, 99)).toBe(false);
  });
});
