import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  BLOOM_FILTER_K,
  BLOOM_FILTER_M,
  bloomFilterBitIndices,
  bloomFilterContains,
  bloomFilterInsertSequence,
  bloomFilterPopcount,
  bloomFilterSearchSequence,
  buildBloomFilter,
  emptyBloomFilter,
} from "@/lib/dataStructures/bloomFilter";
import { bloomFilterInsertPython } from "@/lib/dataStructures/bloomFilterInsert.snippet";
import { bloomFilterSearchPython } from "@/lib/dataStructures/bloomFilterSearch.snippet";
import type {
  BloomFilterInsertStep,
  BloomFilterSearchStep,
  BloomFilterSnapshot,
} from "@/lib/dataStructures/types";

const M = BLOOM_FILTER_M; // 16
const K = BLOOM_FILTER_K; // 3

describe("bloomFilterBitIndices", () => {
  it("returns exactly k = 3 indices per key", () => {
    for (let key = 0; key < 50; key++) {
      const idx = bloomFilterBitIndices(key, M);
      expect(idx).toHaveLength(K);
    }
  });

  it("returns indices in [0, m) for every legal key", () => {
    for (let key = 0; key < 100; key++) {
      for (const i of bloomFilterBitIndices(key, M)) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(M);
      }
    }
  });

  it("matches the documented hash trio for the demo keys", () => {
    // h1 = key mod m; h2 = (3*key + 5) mod m; h3 = (7*key + 11) mod m.
    expect(bloomFilterBitIndices(1, M)).toEqual([1, 8, 2]);
    expect(bloomFilterBitIndices(6, M)).toEqual([6, 7, 5]);
    expect(bloomFilterBitIndices(12, M)).toEqual([12, 9, 15]);
    expect(bloomFilterBitIndices(9, M)).toEqual([9, 0, 10]);
  });

  it("handles negative keys symmetrically (no -0, no out-of-range)", () => {
    // The `((value % m) + m) % m` form guarantees a non-negative
    // result; verify against a few negatives the lesson never actually
    // feeds but the function still has to handle correctly.
    for (let key = -32; key < 0; key++) {
      for (const i of bloomFilterBitIndices(key, M)) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(M);
        // No -0 leaking in (Object.is(-0, 0) is false in TS, would
        // break `.toBe(0)`).
        expect(Object.is(i, -0)).toBe(false);
      }
    }
  });

  it("the false-positive demo key 7 hits bits {7, 10, 12}", () => {
    // The bit set used by the curated false positive — three bits that
    // (after the curated inserts) each came from a different prior item.
    expect(bloomFilterBitIndices(7, M)).toEqual([7, 10, 12]);
  });
});

describe("emptyBloomFilter", () => {
  it("produces a snapshot with m bits, k = 3, all zeros", () => {
    const t = emptyBloomFilter(M);
    expect(t.m).toBe(M);
    expect(t.k).toBe(K);
    expect(t.bits).toHaveLength(M);
    expect(t.bits.every((b) => b === 0)).toBe(true);
  });

  it("defaults to BLOOM_FILTER_M when no argument is supplied", () => {
    const t = emptyBloomFilter();
    expect(t.m).toBe(BLOOM_FILTER_M);
    expect(t.bits).toHaveLength(BLOOM_FILTER_M);
  });
});

describe("bloomFilterInsertSequence", () => {
  it("yields only 'done' for an empty key list", () => {
    const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("emits begin → compute-hashes → k × set-bit per inserted key", () => {
    const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), [1])];
    // 1 begin + 1 compute-hashes + 3 set-bit + 1 done = 6 steps total.
    expect(steps.map((s) => s.kind)).toEqual([
      "begin",
      "compute-hashes",
      "set-bit",
      "set-bit",
      "set-bit",
      "done",
    ]);
  });

  it("sets the three documented bits when inserting 1", () => {
    const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), [1])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    for (const i of [1, 2, 8]) expect(last.table.bits[i]).toBe(1);
    expect(bloomFilterPopcount(last.table)).toBe(3);
  });

  it("flags alreadySet on a bit a prior insert touched (the bit-sharing teaching moment)", () => {
    // Curated insert [1, 6, 12, 9] — 9's first bit (h1 = 9) was already
    // set by inserting 12 (h2(12) = 9). That set-bit step should carry
    // alreadySet = true.
    const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), [1, 6, 12, 9])];
    const setBitsFor9 = steps.filter(
      (s): s is Extract<BloomFilterInsertStep, { kind: "set-bit" }> =>
        s.kind === "set-bit" && s.insertingKey === 9,
    );
    expect(setBitsFor9).toHaveLength(3);
    // h1(9) = 9 — already set.
    expect(setBitsFor9[0]).toMatchObject({ bitIndex: 9, alreadySet: true });
    // h2(9) = 0 — fresh.
    expect(setBitsFor9[1]).toMatchObject({ bitIndex: 0, alreadySet: false });
    // h3(9) = 10 — fresh.
    expect(setBitsFor9[2]).toMatchObject({ bitIndex: 10, alreadySet: false });
  });

  it("final table after the curated [1, 6, 12, 9] insert has 11 of 16 bits set", () => {
    const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), [1, 6, 12, 9])];
    const last = steps.at(-1);
    if (last?.kind !== "done") throw new Error("expected done");
    expect(bloomFilterPopcount(last.table)).toBe(11);
    // {0, 1, 2, 5, 6, 7, 8, 9, 10, 12, 15} set; {3, 4, 11, 13, 14} not.
    for (const i of [0, 1, 2, 5, 6, 7, 8, 9, 10, 12, 15]) {
      expect(last.table.bits[i]).toBe(1);
    }
    for (const i of [3, 4, 11, 13, 14]) {
      expect(last.table.bits[i]).toBe(0);
    }
  });

  it("does not mutate its input snapshot", () => {
    const initial = emptyBloomFilter(M);
    const before = JSON.parse(JSON.stringify(initial));
    void [...bloomFilterInsertSequence(initial, [1, 6, 12, 9])];
    expect(JSON.parse(JSON.stringify(initial))).toEqual(before);
  });

  it("emits fresh snapshot arrays per step (no aliased bit refs)", () => {
    const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), [1, 6])];
    for (let i = 0; i < steps.length; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        expect(steps[i].table.bits).not.toBe(steps[j].table.bits);
      }
    }
  });

  it("compute-hashes carries the same bit indices as bloomFilterBitIndices", () => {
    const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), [1, 6, 12, 9])];
    const computeSteps = steps.filter(
      (s): s is Extract<BloomFilterInsertStep, { kind: "compute-hashes" }> =>
        s.kind === "compute-hashes",
    );
    expect(computeSteps).toHaveLength(4);
    for (const cs of computeSteps) {
      expect([...cs.bitIndices]).toEqual([...bloomFilterBitIndices(cs.insertingKey, M)]);
    }
  });

  it("every emitted insert step's codeLines fall inside the displayed Python source", () => {
    const lineCount = bloomFilterInsertPython.split("\n").length;
    const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), [1, 6, 12, 9])];
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

  it("property: popcount monotonically increases across the step prefix", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 8 }),
        (vals) => {
          const steps = [...bloomFilterInsertSequence(emptyBloomFilter(M), vals)];
          let last = 0;
          for (const step of steps) {
            const pop = bloomFilterPopcount(step.table);
            expect(pop).toBeGreaterThanOrEqual(last);
            last = pop;
          }
        },
      ),
    );
  });
});

describe("bloomFilterSearchSequence", () => {
  it("yields only 'done' for an empty target list", () => {
    const filter = buildBloomFilter(M, [1]);
    const steps = [...bloomFilterSearchSequence(filter, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("finds a true positive on key 1 — all three bits set, k checks, found", () => {
    const filter = buildBloomFilter(M, [1, 6, 12, 9]);
    const steps = [...bloomFilterSearchSequence(filter, [1])];
    expect(steps.filter((s) => s.kind === "check-bit")).toHaveLength(3);
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.targetKey).toBe(1);
    expect([...found.bitIndices]).toEqual([1, 8, 2]);
  });

  it("reports 'found' for the curated FALSE POSITIVE key 7 (bits {7, 10, 12} from three different items)", () => {
    const filter = buildBloomFilter(M, [1, 6, 12, 9]);
    const steps = [...bloomFilterSearchSequence(filter, [7])];
    const found = steps.find((s) => s.kind === "found");
    if (found?.kind !== "found") throw new Error("expected found");
    expect(found.targetKey).toBe(7);
    expect([...found.bitIndices]).toEqual([7, 10, 12]);
    // The algorithm's "yes" is indistinguishable from a true positive —
    // this is the false-positive nature of the filter.
  });

  it("misses cleanly (short-circuits) on the second check for key 5", () => {
    // h1(5) = 5 (SET), h2(5) = 4 (NOT SET) → short-circuit miss.
    // Third bit (h3(5) = 14) is never checked.
    const filter = buildBloomFilter(M, [1, 6, 12, 9]);
    const steps = [...bloomFilterSearchSequence(filter, [5])];
    const checks = steps.filter((s) => s.kind === "check-bit");
    expect(checks).toHaveLength(2);
    const miss = steps.find((s) => s.kind === "miss");
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.offBitIndex).toBe(4);
  });

  it("misses on the first check when the first hash bit is 0", () => {
    // Empty filter — every query misses on the first bit check.
    const empty = emptyBloomFilter(M);
    const steps = [...bloomFilterSearchSequence(empty, [42])];
    const checks = steps.filter((s) => s.kind === "check-bit");
    expect(checks).toHaveLength(1);
    expect(steps.some((s) => s.kind === "miss")).toBe(true);
  });

  it("property: every search inspects at most k bits", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 6 }),
        fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 10 }),
        (vals, targets) => {
          const filter = buildBloomFilter(M, vals);
          const steps = [...bloomFilterSearchSequence(filter, targets)];
          let checksThisTarget = 0;
          for (const s of steps) {
            if (s.kind === "begin") checksThisTarget = 0;
            if (s.kind === "check-bit") checksThisTarget++;
            if (s.kind === "found" || s.kind === "miss") {
              expect(checksThisTarget).toBeLessThanOrEqual(K);
            }
          }
        },
      ),
    );
  });

  it("property: NO FALSE NEGATIVES — every actually-inserted key reports found", () => {
    // The defining property of Bloom filters: false positives possible,
    // false negatives impossible. Every key we inserted must come back
    // as found.
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 0, maxLength: 6 }),
        (vals) => {
          const filter = buildBloomFilter(M, vals);
          for (const k of vals) {
            expect(bloomFilterContains(filter, k)).toBe(true);
          }
        },
      ),
    );
  });

  it("every emitted search step's codeLines fall inside the displayed Python source", () => {
    const lineCount = bloomFilterSearchPython.split("\n").length;
    const filter = buildBloomFilter(M, [1, 6, 12, 9]);
    for (const step of bloomFilterSearchSequence(filter, [1, 9, 7, 5])) {
      expect(step.codeLines).toBeDefined();
      const lines = step.codeLines as readonly number[];
      for (const line of lines) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("found step's bitIndices match bloomFilterBitIndices for the target", () => {
    const filter = buildBloomFilter(M, [1, 6, 12, 9]);
    const steps = [...bloomFilterSearchSequence(filter, [1, 9, 7])];
    const foundSteps = steps.filter(
      (s): s is Extract<BloomFilterSearchStep, { kind: "found" }> => s.kind === "found",
    );
    for (const fs of foundSteps) {
      expect([...fs.bitIndices]).toEqual([...bloomFilterBitIndices(fs.targetKey, M)]);
    }
  });
});

describe("buildBloomFilter", () => {
  it("matches the final-state snapshot from the equivalent insert sequence", () => {
    const built = buildBloomFilter(M, [1, 6, 12, 9]);
    const last = [...bloomFilterInsertSequence(emptyBloomFilter(M), [1, 6, 12, 9])].at(
      -1,
    ) as BloomFilterInsertStep;
    if (last.kind !== "done") throw new Error("expected done");
    expect(built.bits).toEqual(last.table.bits);
  });

  it("starts from an empty filter on every call (no shared state across builds)", () => {
    const a = buildBloomFilter(M, [1]);
    const b = buildBloomFilter(M, [6]);
    // a should not have bits from b's insert.
    expect(a.bits[6]).toBe(0);
    expect(b.bits[1]).toBe(0);
  });
});

describe("bloomFilterContains", () => {
  it("returns true for all four inserted keys on the curated demo", () => {
    const filter = buildBloomFilter(M, [1, 6, 12, 9]);
    for (const k of [1, 6, 12, 9]) {
      expect(bloomFilterContains(filter, k)).toBe(true);
    }
  });

  it("returns true for the false-positive key 7 (never inserted, all bits coincidentally set)", () => {
    const filter = buildBloomFilter(M, [1, 6, 12, 9]);
    expect(bloomFilterContains(filter, 7)).toBe(true);
  });

  it("returns false for true negatives (e.g. 5: bit 4 is not set)", () => {
    const filter = buildBloomFilter(M, [1, 6, 12, 9]);
    expect(bloomFilterContains(filter, 5)).toBe(false);
  });

  it("returns false on an empty filter for any key", () => {
    const empty = emptyBloomFilter(M);
    for (let k = 0; k < 50; k++) {
      expect(bloomFilterContains(empty, k)).toBe(false);
    }
  });
});

describe("bloomFilterPopcount", () => {
  it("returns 0 for an empty filter", () => {
    expect(bloomFilterPopcount(emptyBloomFilter(M))).toBe(0);
  });

  it("counts 1s in a partially populated filter", () => {
    const filter: BloomFilterSnapshot = {
      m: 8,
      k: K,
      bits: [1, 0, 1, 0, 1, 0, 0, 0],
    };
    expect(bloomFilterPopcount(filter)).toBe(3);
  });

  it("equals m when every bit is set", () => {
    const full: BloomFilterSnapshot = {
      m: 4,
      k: K,
      bits: [1, 1, 1, 1],
    };
    expect(bloomFilterPopcount(full)).toBe(4);
  });
});
