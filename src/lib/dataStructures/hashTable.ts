import { hashTableDeleteLines } from "./hashTableDelete.snippet";
import { hashTableInsertLines } from "./hashTableInsert.snippet";
import { hashTableSearchLines } from "./hashTableSearch.snippet";
import type {
  HashTableDeleteStep,
  HashTableEntry,
  HashTableKV,
  HashTableSearchStep,
  HashTableSnapshot,
  HashTableStep,
} from "./types";

export const DEFAULT_CAPACITY = 8;

// Matches the Python snippet's `hash(key) % self.capacity` for non-negative
// integer keys (Python's int `hash` is identity for small ints). For negative
// inputs we normalize so the bucket index is always in `[0, capacity)`.
export function bucketIndexFor(key: number, capacity: number): number {
  // Double mod avoids JS's `-0` result when `key` is a negative multiple of
  // `capacity` (e.g. -8 % 8 === -0, which fails Object.is equality with +0).
  return ((key % capacity) + capacity) % capacity;
}

function emptyBuckets(capacity: number): number[][] {
  return Array.from({ length: capacity }, () => []);
}

function snapshot(
  capacity: number,
  entries: readonly HashTableEntry[],
  buckets: readonly (readonly number[])[],
): HashTableSnapshot {
  return {
    capacity,
    entries: entries.map((e) => ({ ...e })),
    buckets: buckets.map((b) => [...b]),
  };
}

export function emptyHashTable(capacity: number = DEFAULT_CAPACITY): HashTableSnapshot {
  return { capacity, entries: [], buckets: emptyBuckets(capacity) };
}

export function* insertSequence(
  pairs: readonly HashTableKV[],
  capacity: number = DEFAULT_CAPACITY,
): Generator<HashTableStep> {
  const entries: HashTableEntry[] = [];
  const buckets: number[][] = emptyBuckets(capacity);

  for (const [key, value] of pairs) {
    yield {
      kind: "begin",
      table: snapshot(capacity, entries, buckets),
      insertingKey: key,
      insertingValue: value,
      codeLines: hashTableInsertLines.begin,
    };

    const bucketIndex = bucketIndexFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(capacity, entries, buckets),
      insertingKey: key,
      insertingValue: value,
      bucketIndex,
      codeLines: hashTableInsertLines.hash,
    };

    const bucket = buckets[bucketIndex];
    let overwritten = false;
    for (const entryId of bucket) {
      const cursor = entries[entryId];
      yield {
        kind: "probe",
        table: snapshot(capacity, entries, buckets),
        insertingKey: key,
        insertingValue: value,
        bucketIndex,
        cursorEntryId: entryId,
        codeLines: hashTableInsertLines.probe,
      };
      if (cursor.key === key) {
        // Map semantics: the key already lives here, replace the value.
        const oldValue = cursor.value;
        entries[entryId] = { ...cursor, value };
        yield {
          kind: "overwrite",
          table: snapshot(capacity, entries, buckets),
          insertingKey: key,
          insertingValue: value,
          oldValue,
          bucketIndex,
          cursorEntryId: entryId,
          codeLines: hashTableInsertLines.overwrite,
        };
        overwritten = true;
        break;
      }
    }

    if (overwritten) continue;

    const newEntryId = entries.length;
    entries.push({ id: newEntryId, key, value });
    buckets[bucketIndex] = [...bucket, newEntryId];
    yield {
      kind: "place",
      table: snapshot(capacity, entries, buckets),
      newEntryId,
      bucketIndex,
      codeLines: hashTableInsertLines.place,
    };
  }

  yield {
    kind: "done",
    table: snapshot(capacity, entries, buckets),
    codeLines: hashTableInsertLines.done,
  };
}

export function buildHashTable(
  pairs: readonly HashTableKV[],
  capacity: number = DEFAULT_CAPACITY,
): HashTableSnapshot {
  let final: HashTableSnapshot = emptyHashTable(capacity);
  for (const step of insertSequence(pairs, capacity)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}

export function* searchSequence(
  initial: HashTableSnapshot,
  targets: readonly number[],
): Generator<HashTableSearchStep> {
  for (const targetKey of targets) {
    yield {
      kind: "begin",
      table: initial,
      targetKey,
      codeLines: hashTableSearchLines.begin,
    };

    const bucketIndex = bucketIndexFor(targetKey, initial.capacity);
    yield {
      kind: "hash",
      table: initial,
      targetKey,
      bucketIndex,
      codeLines: hashTableSearchLines.hash,
    };

    const bucket = initial.buckets[bucketIndex];
    let found = false;
    for (const entryId of bucket) {
      yield {
        kind: "probe",
        table: initial,
        targetKey,
        bucketIndex,
        cursorEntryId: entryId,
        codeLines: hashTableSearchLines.probe,
      };
      if (initial.entries[entryId].key === targetKey) {
        yield {
          kind: "found",
          table: initial,
          targetKey,
          foundValue: initial.entries[entryId].value,
          bucketIndex,
          cursorEntryId: entryId,
          codeLines: hashTableSearchLines.found,
        };
        found = true;
        break;
      }
    }

    if (!found) {
      yield {
        kind: "miss",
        table: initial,
        targetKey,
        bucketIndex,
        codeLines: hashTableSearchLines.miss,
      };
    }
  }

  yield { kind: "done", table: initial, codeLines: hashTableSearchLines.done };
}

export function* deleteSequence(
  initial: HashTableSnapshot,
  targets: readonly number[],
): Generator<HashTableDeleteStep> {
  const entries: HashTableEntry[] = initial.entries.map((e) => ({ ...e }));
  const buckets: number[][] = initial.buckets.map((b) => [...b]);
  const capacity = initial.capacity;

  for (const targetKey of targets) {
    yield {
      kind: "begin",
      table: snapshot(capacity, entries, buckets),
      targetKey,
      codeLines: hashTableDeleteLines.begin,
    };

    const bucketIndex = bucketIndexFor(targetKey, capacity);
    yield {
      kind: "hash",
      table: snapshot(capacity, entries, buckets),
      targetKey,
      bucketIndex,
      codeLines: hashTableDeleteLines.hash,
    };

    const bucket = buckets[bucketIndex];
    let removed: { entryId: number; positionInBucket: number } | null = null;
    for (let pos = 0; pos < bucket.length; pos++) {
      const entryId = bucket[pos];
      yield {
        kind: "probe",
        table: snapshot(capacity, entries, buckets),
        targetKey,
        bucketIndex,
        cursorEntryId: entryId,
        codeLines: hashTableDeleteLines.probe,
      };
      if (entries[entryId].key === targetKey) {
        removed = { entryId, positionInBucket: pos };
        yield {
          kind: "found",
          table: snapshot(capacity, entries, buckets),
          targetKey,
          bucketIndex,
          cursorEntryId: entryId,
          codeLines: hashTableDeleteLines.found,
        };
        break;
      }
    }

    if (removed === null) {
      yield {
        kind: "miss",
        table: snapshot(capacity, entries, buckets),
        targetKey,
        bucketIndex,
        codeLines: hashTableDeleteLines.miss,
      };
      continue;
    }

    const next = [...bucket];
    next.splice(removed.positionInBucket, 1);
    buckets[bucketIndex] = next;
    yield {
      kind: "unlink",
      table: snapshot(capacity, entries, buckets),
      targetKey,
      bucketIndex,
      removedEntryId: removed.entryId,
      codeLines: hashTableDeleteLines.unlink,
    };
  }

  yield {
    kind: "done",
    table: snapshot(capacity, entries, buckets),
    codeLines: hashTableDeleteLines.done,
  };
}

// Multiset-like inventory derived from a snapshot's bucket lists. Useful for
// tests that want "what's currently stored?" without traversing entries[]
// (since orphaned/tombstoned entries linger there after deletes).
export function liveKeys(table: HashTableSnapshot): number[] {
  const out: number[] = [];
  for (const bucket of table.buckets) {
    for (const id of bucket) out.push(table.entries[id].key);
  }
  return out;
}

export function loadFactor(table: HashTableSnapshot): number {
  if (table.capacity === 0) return 0;
  return liveKeys(table).length / table.capacity;
}
