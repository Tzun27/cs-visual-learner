import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_CAPACITY,
  bucketIndexFor,
  buildHashTable,
  deleteSequence,
  emptyHashTable,
  insertSequence,
  liveKeys,
  loadFactor,
  searchSequence,
} from "@/lib/dataStructures/hashTable";
import { hashTableDeletePython } from "@/lib/dataStructures/hashTableDelete.snippet";
import { hashTableInsertPython } from "@/lib/dataStructures/hashTableInsert.snippet";
import { hashTableSearchPython } from "@/lib/dataStructures/hashTableSearch.snippet";
import type { HashTableKV, HashTableSnapshot } from "@/lib/dataStructures/types";

function finalOf<S extends { kind: string; table: HashTableSnapshot }>(steps: readonly S[]) {
  const last = steps.at(-1);
  if (!last || last.kind !== "done") throw new Error("expected 'done' as last step");
  return last.table;
}

// Compact builder: convert a bare key list into (key, value) pairs where
// value === key. Saves test boilerplate and keeps assertions readable —
// since tests below are about structure (buckets, hits, misses), they
// rarely care about the value specifically.
function kvs(...keys: number[]): HashTableKV[] {
  return keys.map((k) => [k, k] as const);
}

describe("bucketIndexFor", () => {
  it("returns key % capacity for non-negative keys", () => {
    expect(bucketIndexFor(0, 8)).toBe(0);
    expect(bucketIndexFor(7, 8)).toBe(7);
    expect(bucketIndexFor(8, 8)).toBe(0);
    expect(bucketIndexFor(17, 8)).toBe(1);
  });

  it("normalizes negatives into [0, capacity)", () => {
    expect(bucketIndexFor(-1, 8)).toBe(7);
    expect(bucketIndexFor(-8, 8)).toBe(0);
  });

  it("property: output is always in [0, capacity)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: 1, max: 64 }),
        (key, cap) => {
          const i = bucketIndexFor(key, cap);
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(cap);
        },
      ),
    );
  });
});

describe("emptyHashTable", () => {
  it("uses default capacity 8 when none provided", () => {
    const t = emptyHashTable();
    expect(t.capacity).toBe(DEFAULT_CAPACITY);
    expect(t.buckets).toHaveLength(8);
    for (const b of t.buckets) expect(b).toEqual([]);
    expect(t.entries).toEqual([]);
  });

  it("respects a custom capacity", () => {
    const t = emptyHashTable(4);
    expect(t.capacity).toBe(4);
    expect(t.buckets).toHaveLength(4);
  });
});

describe("insertSequence", () => {
  it("yields only a 'done' step for empty input", () => {
    const steps = [...insertSequence([])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
    expect(steps[0].table.entries).toEqual([]);
  });

  it("every emitted step carries codeLines inside the displayed Python source", () => {
    const lineCount = hashTableInsertPython.split("\n").length;
    for (const step of insertSequence(kvs(5, 13, 5, 1, 9))) {
      expect(step.codeLines).toBeDefined();
      expect(step.codeLines!.length).toBeGreaterThan(0);
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("yields begin → hash → place for a first insert (empty bucket)", () => {
    const steps = [...insertSequence(kvs(3))];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "place", "done"]);
    const place = steps[2];
    if (place.kind !== "place") throw new Error("expected place");
    expect(place.newEntryId).toBe(0);
    expect(place.bucketIndex).toBe(3);
  });

  it("walks the chain when inserting into a colliding bucket", () => {
    // With default capacity 8, both 1 and 9 hash to bucket 1.
    const steps = [...insertSequence(kvs(1, 9))];
    const kinds = steps.map((s) => s.kind);
    // begin, hash, place (for 1), then begin, hash, probe(1), place (for 9)
    expect(kinds).toEqual(["begin", "hash", "place", "begin", "hash", "probe", "place", "done"]);
    const finalTable = finalOf(steps);
    expect(finalTable.buckets[1]).toEqual([0, 1]); // both entry ids land in bucket 1, in insertion order
  });

  it("overwrites the existing entry's value when the key is already present (map semantics)", () => {
    // Same key, different values. The first put places a new entry; the
    // second put walks to the existing entry, sees the key match, and
    // overwrites the value. No second 'place' step.
    const steps = [
      ...insertSequence([
        [5, 100],
        [5, 200],
      ]),
    ];
    const kinds = steps.map((s) => s.kind);
    expect(kinds).toEqual([
      "begin",
      "hash",
      "place",
      "begin",
      "hash",
      "probe",
      "overwrite",
      "done",
    ]);
    expect(steps.filter((s) => s.kind === "place")).toHaveLength(1);
    const finalTable = finalOf(steps);
    expect(finalTable.entries).toHaveLength(1);
    expect(finalTable.entries[0]).toMatchObject({ key: 5, value: 200 });
    const overwrite = steps.find((s) => s.kind === "overwrite");
    if (overwrite?.kind !== "overwrite") throw new Error("expected overwrite");
    expect(overwrite.oldValue).toBe(100);
    expect(overwrite.insertingValue).toBe(200);
  });

  it("does not mutate its input", () => {
    const input: HashTableKV[] = [
      [3, 30],
      [1, 10],
      [2, 20],
    ];
    const snap = JSON.parse(JSON.stringify(input));
    void [...insertSequence(input)];
    expect(JSON.parse(JSON.stringify(input))).toEqual(snap);
  });

  it("emits fresh table snapshots, not aliased mutable refs", () => {
    const steps = [...insertSequence(kvs(1, 9, 17))];
    const tables = steps.map((s) => s.table);
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        expect(tables[i].buckets).not.toBe(tables[j].buckets);
        expect(tables[i].entries).not.toBe(tables[j].entries);
      }
    }
  });

  it("property: every step's bucketIndex (when set) equals bucketIndexFor(key, capacity)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 200 }), { maxLength: 30 }),
        fc.integer({ min: 1, max: 16 }),
        (keys, cap) => {
          for (const step of insertSequence(kvs(...keys), cap)) {
            if ("bucketIndex" in step && "insertingKey" in step) {
              expect(step.bucketIndex).toBe(bucketIndexFor(step.insertingKey, cap));
            }
          }
        },
      ),
    );
  });

  it("property: final liveKeys equals the deduplicated input as a set", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 200 }), { maxLength: 30 }),
        fc.integer({ min: 1, max: 16 }),
        (keys, cap) => {
          const final = finalOf([...insertSequence(kvs(...keys), cap)]);
          const live = new Set(liveKeys(final));
          expect(live).toEqual(new Set(keys));
        },
      ),
    );
  });

  it("property: the final value for any duplicated key is its LAST put", () => {
    // Map semantics: re-putting the same key overwrites the value, so
    // for keys that appear multiple times in the input the final entry
    // carries the last (key, value) pair's value.
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 1000 })), {
          minLength: 1,
          maxLength: 25,
        }),
        (pairs) => {
          const lastValue = new Map<number, number>();
          for (const [k, v] of pairs) lastValue.set(k, v);
          const final = finalOf([...insertSequence(pairs)]);
          for (const bucket of final.buckets) {
            for (const id of bucket) {
              const e = final.entries[id];
              expect(e.value).toBe(lastValue.get(e.key));
            }
          }
        },
      ),
    );
  });
});

describe("buildHashTable", () => {
  it("returns an empty snapshot for empty input", () => {
    expect(buildHashTable([])).toEqual(emptyHashTable());
  });

  it("matches the last 'done' step of insertSequence", () => {
    const pairs = kvs(1, 9, 17, 2, 10, 50);
    const fromGen = finalOf([...insertSequence(pairs)]);
    expect(buildHashTable(pairs)).toEqual(fromGen);
  });

  it("can build with a custom capacity", () => {
    const t = buildHashTable(kvs(1, 5, 9), 4);
    expect(t.capacity).toBe(4);
    // 1 → 1, 5 → 1, 9 → 1; all collide in bucket 1 under capacity 4.
    expect(t.buckets[1]).toHaveLength(3);
  });
});

describe("loadFactor", () => {
  it("returns 0 for an empty table", () => {
    expect(loadFactor(emptyHashTable())).toBe(0);
  });

  it("returns liveKeys.length / capacity", () => {
    const t = buildHashTable(kvs(1, 9, 17)); // 3 distinct, capacity 8
    expect(loadFactor(t)).toBeCloseTo(3 / 8);
  });

  it("returns 0 (not NaN) for a zero-capacity table", () => {
    // Defensive guard: division by 0 would yield NaN otherwise.
    const zeroCap = { capacity: 0, entries: [], buckets: [] } as const;
    expect(loadFactor(zeroCap)).toBe(0);
  });
});

describe("searchSequence", () => {
  const t = buildHashTable(kvs(1, 9, 17, 2, 50));

  it("yields only a 'done' step for empty targets", () => {
    const steps = [...searchSequence(t, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("every emitted search step carries codeLines pointing inside the displayed Python source", () => {
    const lineCount = hashTableSearchPython.split("\n").length;
    for (const step of searchSequence(t, [1, 9, 99, 50])) {
      expect(step.codeLines).toBeDefined();
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("hits an existing key at the head of its bucket on the first probe", () => {
    // 1 is the first key inserted into bucket 1.
    const steps = [...searchSequence(t, [1])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "probe", "found", "done"]);
  });

  it("walks the chain to hit a key further down the bucket", () => {
    // 17 is third in bucket 1 after 1, 9.
    const steps = [...searchSequence(t, [17])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(3);
    expect(steps.some((s) => s.kind === "found")).toBe(true);
  });

  it("misses when the bucket is empty (no probe steps)", () => {
    const steps = [...searchSequence(t, [3])];
    const probes = steps.filter((s) => s.kind === "probe");
    expect(probes).toHaveLength(0);
    expect(steps.some((s) => s.kind === "miss")).toBe(true);
  });

  it("misses when the bucket has non-matching keys (probes all entries first)", () => {
    // 25 → bucket 1, which contains [1, 9, 17]. None match.
    const steps = [...searchSequence(t, [25])];
    expect(steps.filter((s) => s.kind === "probe")).toHaveLength(3);
    const miss = steps.find((s) => s.kind === "miss");
    expect(miss).toBeDefined();
    if (miss?.kind !== "miss") throw new Error("expected miss");
    expect(miss.bucketIndex).toBe(1);
  });

  it("processes multiple targets sequentially", () => {
    const steps = [...searchSequence(t, [1, 99, 9])];
    expect(steps.filter((s) => s.kind === "begin")).toHaveLength(3);
    expect(steps.filter((s) => s.kind === "found")).toHaveLength(2);
    expect(steps.filter((s) => s.kind === "miss")).toHaveLength(1);
    expect(steps.at(-1)?.kind).toBe("done");
  });

  it("found steps surface the stored value alongside the key", () => {
    // Confirm map semantics on the search side: 'found' must carry the
    // value that was put under this key, not just an acknowledgement.
    const map = buildHashTable([
      [1, 111],
      [9, 999],
    ]);
    const steps = [...searchSequence(map, [9, 1])];
    const founds = steps.filter((s) => s.kind === "found");
    expect(founds.map((f) => (f.kind === "found" ? f.foundValue : null))).toEqual([999, 111]);
  });

  it("property: every present key is reported 'found' exactly once with its stored value", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 200 }), { minLength: 1, maxLength: 25 }),
        (keys) => {
          const pairs = keys.map((k) => [k, k * 7] as const);
          const table = buildHashTable(pairs);
          const steps = [...searchSequence(table, keys)];
          const founds = steps.filter((s) => s.kind === "found");
          expect(founds).toHaveLength(keys.length);
          expect(steps.some((s) => s.kind === "miss")).toBe(false);
          for (const f of founds) {
            if (f.kind !== "found") throw new Error("expected found");
            expect(f.foundValue).toBe(f.targetKey * 7);
          }
        },
      ),
    );
  });

  it("property: every absent key is reported 'miss'", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 20 }),
        (keys) => {
          const table = buildHashTable(kvs(...keys));
          const present = new Set(keys);
          const absent = [500, 501, 502, 503].filter((k) => !present.has(k));
          if (absent.length === 0) return;
          const steps = [...searchSequence(table, absent)];
          expect(steps.filter((s) => s.kind === "found")).toHaveLength(0);
          expect(steps.filter((s) => s.kind === "miss")).toHaveLength(absent.length);
        },
      ),
    );
  });
});

describe("deleteSequence", () => {
  const basePairs: HashTableKV[] = kvs(1, 9, 17, 2, 50);

  it("yields only a 'done' step for empty targets", () => {
    const t = buildHashTable(basePairs);
    const steps = [...deleteSequence(t, [])];
    expect(steps.map((s) => s.kind)).toEqual(["done"]);
  });

  it("every emitted delete step carries codeLines pointing inside the displayed Python source", () => {
    const t = buildHashTable(basePairs);
    const lineCount = hashTableDeletePython.split("\n").length;
    for (const step of deleteSequence(t, [1, 9, 17, 99])) {
      expect(step.codeLines).toBeDefined();
      for (const line of step.codeLines!) {
        expect(line).toBeGreaterThanOrEqual(1);
        expect(line).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("emits 'miss' when the bucket is empty", () => {
    const t = buildHashTable(basePairs);
    const steps = [...deleteSequence(t, [3])];
    expect(steps.some((s) => s.kind === "miss")).toBe(true);
    expect(steps.some((s) => s.kind === "found")).toBe(false);
    expect(steps.filter((s) => s.kind === "probe")).toHaveLength(0);
  });

  it("emits 'miss' when the bucket has only non-matching keys", () => {
    const t = buildHashTable(basePairs);
    // 25 → bucket 1 with [1, 9, 17]; none match.
    const steps = [...deleteSequence(t, [25])];
    expect(steps.filter((s) => s.kind === "probe")).toHaveLength(3);
    expect(steps.some((s) => s.kind === "miss")).toBe(true);
    expect(steps.some((s) => s.kind === "found")).toBe(false);
  });

  it("removes a head-of-bucket key with one probe + found + unlink", () => {
    const t = buildHashTable(basePairs);
    const steps = [...deleteSequence(t, [1])];
    expect(steps.map((s) => s.kind)).toEqual(["begin", "hash", "probe", "found", "unlink", "done"]);
    const final = finalOf(steps);
    expect(final.buckets[1]).toEqual([1, 2]); // entry ids of 9 and 17 remain
    expect(new Set(liveKeys(final))).toEqual(new Set([9, 17, 2, 50]));
  });

  it("removes a middle-of-chain key, preserving the rest of the chain", () => {
    const t = buildHashTable(basePairs);
    // Delete 9 from [1, 9, 17] → [1, 17].
    const steps = [...deleteSequence(t, [9])];
    const final = finalOf(steps);
    expect(final.buckets[1]).toEqual([0, 2]); // entry ids of 1 and 17
    expect(new Set(liveKeys(final))).toEqual(new Set([1, 17, 2, 50]));
  });

  it("orphans entries on delete — the entry stays in entries[] but is not reachable from any bucket", () => {
    const t = buildHashTable(kvs(1, 9));
    const steps = [...deleteSequence(t, [1])];
    const final = finalOf(steps);
    expect(final.entries).toHaveLength(2); // tombstoned, not spliced
    const reachableIds = new Set<number>();
    for (const b of final.buckets) for (const id of b) reachableIds.add(id);
    expect(reachableIds.has(0)).toBe(false); // entry 0 (key 1) was orphaned
    expect(reachableIds.has(1)).toBe(true);
  });

  it("processes multiple targets and shares the running table", () => {
    const t = buildHashTable(basePairs);
    const steps = [...deleteSequence(t, [1, 17, 99])];
    expect(steps.filter((s) => s.kind === "begin")).toHaveLength(3);
    expect(steps.filter((s) => s.kind === "unlink")).toHaveLength(2);
    expect(steps.filter((s) => s.kind === "miss")).toHaveLength(1);
    const final = finalOf(steps);
    expect(new Set(liveKeys(final))).toEqual(new Set([9, 2, 50]));
  });

  it("does not mutate the input snapshot", () => {
    const t = buildHashTable(basePairs);
    const beforeBuckets = t.buckets.map((b) => [...b]);
    const beforeEntries = t.entries.map((e) => ({ ...e }));
    void [...deleteSequence(t, [1, 9])];
    expect(t.buckets.map((b) => [...b])).toEqual(beforeBuckets);
    expect(t.entries.map((e) => ({ ...e }))).toEqual(beforeEntries);
  });

  it("emits fresh table snapshots, not aliased mutable refs", () => {
    const t = buildHashTable(basePairs);
    const tables = [...deleteSequence(t, [1, 9])].map((s) => s.table);
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        expect(tables[i].buckets).not.toBe(tables[j].buckets);
        expect(tables[i].entries).not.toBe(tables[j].entries);
      }
    }
  });

  it("property: liveKeys of final equals the set difference (insert \\ delete)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 20 }),
        fc.array(fc.integer({ min: 0, max: 50 }), { maxLength: 10 }),
        (insertKeys, deleteKeys) => {
          const t = buildHashTable(kvs(...insertKeys));
          const steps = [...deleteSequence(t, deleteKeys)];
          const final = finalOf(steps);
          const remaining = new Set(insertKeys);
          for (const k of deleteKeys) remaining.delete(k);
          expect(new Set(liveKeys(final))).toEqual(remaining);
        },
      ),
    );
  });
});
