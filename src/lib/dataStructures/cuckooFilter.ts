import { cuckooFilterDeleteLines } from "./cuckooFilterDelete.snippet";
import { cuckooFilterInsertLines } from "./cuckooFilterInsert.snippet";
import { cuckooFilterSearchLines } from "./cuckooFilterSearch.snippet";
import type {
  CuckooFilterDeleteStep,
  CuckooFilterInsertStep,
  CuckooFilterSearchStep,
  CuckooFilterSlot,
  CuckooFilterSnapshot,
} from "./types";

// Capacity 8 (power-of-2 simplifies the XOR-mod-capacity equivalence).
// Fingerprints live in [1, FP_RANGE]; 0 is reserved for "empty," which
// is why both bounds are visible in the helpers below.
export const CUCKOO_FILTER_FP_RANGE = 7;
export const CUCKOO_FILTER_MAX_ITERATIONS = 8;

const EMPTY: CuckooFilterSlot = { state: "empty" };

// fingerprint(k) = (k mod FP_RANGE) + 1. Always in [1, FP_RANGE], never
// 0. The +1 shift is what reserves 0 for the empty-slot sentinel.
export function cuckooFilterFingerprint(key: number): number {
  return (((key % CUCKOO_FILTER_FP_RANGE) + CUCKOO_FILTER_FP_RANGE) % CUCKOO_FILTER_FP_RANGE) + 1;
}

export function cuckooFilterHome(key: number, capacity: number): number {
  return (((key % capacity) + capacity) % capacity) | 0;
}

// hashFp(fp) maps a fingerprint to a non-zero XOR offset. With
// capacity = 8 and FP_RANGE = 7 this gives a bijection-like spread
// across {1..7}, so every fingerprint has a non-trivial alternate slot
// (alt != slot). MUST be non-zero for every legal fp — a zero offset
// would mean alt == slot, breaking the two-candidates guarantee.
export function cuckooFilterHashFp(fingerprint: number, capacity: number): number {
  // The factor 3 is coprime to 8, so this is a bijection on {1..7} → {1..7}.
  // For capacity 8 / FP_RANGE 7: outputs are {3, 6, 1, 4, 7, 2, 5} — all non-zero.
  return ((fingerprint * 3) % capacity) | 0;
}

// alt(slot, fp) = slot XOR hashFp(fp). Symmetric: alt(alt(s, fp), fp) = s.
// That symmetry is what lets the eviction cascade compute a displaced
// fingerprint's alternate slot from the fingerprint alone — no
// original-key bookkeeping required, which is the whole reason cuckoo
// filters get away with storing fingerprints instead of full keys.
export function cuckooFilterAlt(slotIndex: number, fingerprint: number, capacity: number): number {
  return (slotIndex ^ cuckooFilterHashFp(fingerprint, capacity)) | 0;
}

function deepCopySlots(slots: readonly CuckooFilterSlot[]): CuckooFilterSlot[] {
  return slots.map((s) => (s.state === "empty" ? EMPTY : { ...s }));
}

function snapshot(slots: readonly CuckooFilterSlot[], capacity: number): CuckooFilterSnapshot {
  return { capacity, slots: deepCopySlots(slots) };
}

export function emptyCuckooFilter(capacity: number): CuckooFilterSnapshot {
  return {
    capacity,
    slots: Array.from({ length: capacity }, () => EMPTY),
  };
}

export function* cuckooFilterInsertSequence(
  initial: CuckooFilterSnapshot,
  keys: readonly number[],
): Generator<CuckooFilterInsertStep> {
  const { capacity } = initial;
  const slots: CuckooFilterSlot[] = deepCopySlots(initial.slots);

  for (const key of keys) {
    yield {
      kind: "begin",
      table: snapshot(slots, capacity),
      insertingKey: key,
      codeLines: cuckooFilterInsertLines.begin,
    };

    const fp = cuckooFilterFingerprint(key);
    yield {
      kind: "fingerprint",
      table: snapshot(slots, capacity),
      insertingKey: key,
      fingerprint: fp,
      codeLines: cuckooFilterInsertLines.fingerprint,
    };

    const home = cuckooFilterHome(key, capacity);
    const alt = cuckooFilterAlt(home, fp, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      insertingKey: key,
      fingerprint: fp,
      home,
      alt,
      codeLines: cuckooFilterInsertLines.hash,
    };

    // Check home first.
    yield {
      kind: "check",
      table: snapshot(slots, capacity),
      activeFingerprint: fp,
      slotIndex: home,
      phase: "home",
      codeLines: cuckooFilterInsertLines.checkHome,
    };
    if (slots[home].state === "empty") {
      slots[home] = { state: "occupied", fingerprint: fp };
      yield {
        kind: "place",
        table: snapshot(slots, capacity),
        placedFingerprint: fp,
        slotIndex: home,
        phase: "home",
        codeLines: cuckooFilterInsertLines.placeHome,
      };
      continue;
    }

    // Check alt.
    yield {
      kind: "check",
      table: snapshot(slots, capacity),
      activeFingerprint: fp,
      slotIndex: alt,
      phase: "alt",
      codeLines: cuckooFilterInsertLines.checkAlt,
    };
    if (slots[alt].state === "empty") {
      slots[alt] = { state: "occupied", fingerprint: fp };
      yield {
        kind: "place",
        table: snapshot(slots, capacity),
        placedFingerprint: fp,
        slotIndex: alt,
        phase: "alt",
        codeLines: cuckooFilterInsertLines.placeAlt,
      };
      continue;
    }

    // Both home and alt are occupied — eviction cascade. Start by
    // evicting from the home slot (deterministic; real implementations
    // pick randomly to spread cascades).
    let activeFp = fp;
    let cur = home;
    let placedInLoop = false;
    let cycled = false;
    for (let iter = 0; iter < CUCKOO_FILTER_MAX_ITERATIONS; iter++) {
      const slot = slots[cur];
      // Swap: place activeFp here, displace the resident.
      // The guard exists to satisfy the type narrower; in the cascade
      // path we only enter this branch when the slot is occupied
      // (either the first eviction at `home`, or the next cascade slot
      // that the previous iteration found to be occupied).
      /* v8 ignore next */
      if (slot.state !== "occupied") {
        // Shouldn't happen given the loop's invariants; defensive.
        throw new Error(`cuckoo filter cascade entered empty slot ${cur}`);
      }
      const displacedFp = slot.fingerprint;
      slots[cur] = { state: "occupied", fingerprint: activeFp };
      const nextSlot = cuckooFilterAlt(cur, displacedFp, capacity);
      yield {
        kind: "evict",
        table: snapshot(slots, capacity),
        placedFingerprint: activeFp,
        evictedFingerprint: displacedFp,
        slotIndex: cur,
        nextSlotIndex: nextSlot,
        codeLines: cuckooFilterInsertLines.evict,
      };
      activeFp = displacedFp;
      cur = nextSlot;
      // Check whether the next slot fits the displaced fingerprint.
      yield {
        kind: "check",
        table: snapshot(slots, capacity),
        activeFingerprint: activeFp,
        slotIndex: cur,
        phase: "cascade",
        codeLines: cuckooFilterInsertLines.checkCascade,
      };
      if (slots[cur].state === "empty") {
        slots[cur] = { state: "occupied", fingerprint: activeFp };
        yield {
          kind: "place",
          table: snapshot(slots, capacity),
          placedFingerprint: activeFp,
          slotIndex: cur,
          phase: "cascade",
          codeLines: cuckooFilterInsertLines.placeCascade,
        };
        placedInLoop = true;
        break;
      }
    }

    if (!placedInLoop) {
      yield {
        kind: "cycle",
        table: snapshot(slots, capacity),
        insertingKey: key,
        codeLines: cuckooFilterInsertLines.cycle,
      };
      cycled = true;
    }
    if (cycled) {
      throw new Error(`cuckoo filter insert: cycle while inserting ${key}; rehash required`);
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: cuckooFilterInsertLines.done,
  };
}

export function* cuckooFilterSearchSequence(
  initial: CuckooFilterSnapshot,
  targets: readonly number[],
): Generator<CuckooFilterSearchStep> {
  const { capacity, slots } = initial;

  for (const key of targets) {
    yield {
      kind: "begin",
      table: initial,
      targetKey: key,
      codeLines: cuckooFilterSearchLines.begin,
    };

    const fp = cuckooFilterFingerprint(key);
    yield {
      kind: "fingerprint",
      table: initial,
      targetKey: key,
      fingerprint: fp,
      codeLines: cuckooFilterSearchLines.fingerprint,
    };

    const home = cuckooFilterHome(key, capacity);
    const alt = cuckooFilterAlt(home, fp, capacity);
    yield {
      kind: "hash",
      table: initial,
      targetKey: key,
      fingerprint: fp,
      home,
      alt,
      codeLines: cuckooFilterSearchLines.hash,
    };

    // Check home.
    yield {
      kind: "check",
      table: initial,
      targetKey: key,
      fingerprint: fp,
      slotIndex: home,
      phase: "home",
      codeLines: cuckooFilterSearchLines.checkHome,
    };
    const slotHome = slots[home];
    if (slotHome.state === "occupied" && slotHome.fingerprint === fp) {
      yield {
        kind: "found",
        table: initial,
        targetKey: key,
        fingerprint: fp,
        slotIndex: home,
        phase: "home",
        codeLines: cuckooFilterSearchLines.foundHome,
      };
      continue;
    }

    // Check alt.
    yield {
      kind: "check",
      table: initial,
      targetKey: key,
      fingerprint: fp,
      slotIndex: alt,
      phase: "alt",
      codeLines: cuckooFilterSearchLines.checkAlt,
    };
    const slotAlt = slots[alt];
    if (slotAlt.state === "occupied" && slotAlt.fingerprint === fp) {
      yield {
        kind: "found",
        table: initial,
        targetKey: key,
        fingerprint: fp,
        slotIndex: alt,
        phase: "alt",
        codeLines: cuckooFilterSearchLines.foundAlt,
      };
      continue;
    }

    yield {
      kind: "miss",
      table: initial,
      targetKey: key,
      fingerprint: fp,
      codeLines: cuckooFilterSearchLines.miss,
    };
  }
  yield {
    kind: "done",
    table: initial,
    codeLines: cuckooFilterSearchLines.done,
  };
}

export function* cuckooFilterDeleteSequence(
  initial: CuckooFilterSnapshot,
  targets: readonly number[],
): Generator<CuckooFilterDeleteStep> {
  const { capacity } = initial;
  const slots: CuckooFilterSlot[] = deepCopySlots(initial.slots);

  for (const key of targets) {
    yield {
      kind: "begin",
      table: snapshot(slots, capacity),
      targetKey: key,
      codeLines: cuckooFilterDeleteLines.begin,
    };

    const fp = cuckooFilterFingerprint(key);
    yield {
      kind: "fingerprint",
      table: snapshot(slots, capacity),
      targetKey: key,
      fingerprint: fp,
      codeLines: cuckooFilterDeleteLines.fingerprint,
    };

    const home = cuckooFilterHome(key, capacity);
    const alt = cuckooFilterAlt(home, fp, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      targetKey: key,
      fingerprint: fp,
      home,
      alt,
      codeLines: cuckooFilterDeleteLines.hash,
    };

    yield {
      kind: "check",
      table: snapshot(slots, capacity),
      targetKey: key,
      fingerprint: fp,
      slotIndex: home,
      phase: "home",
      codeLines: cuckooFilterDeleteLines.checkHome,
    };
    const slotHome = slots[home];
    if (slotHome.state === "occupied" && slotHome.fingerprint === fp) {
      yield {
        kind: "found",
        table: snapshot(slots, capacity),
        targetKey: key,
        fingerprint: fp,
        slotIndex: home,
        phase: "home",
        codeLines: cuckooFilterDeleteLines.foundHome,
      };
      slots[home] = EMPTY;
      yield {
        kind: "remove",
        table: snapshot(slots, capacity),
        targetKey: key,
        fingerprint: fp,
        slotIndex: home,
        phase: "home",
        codeLines: cuckooFilterDeleteLines.removeHome,
      };
      continue;
    }

    yield {
      kind: "check",
      table: snapshot(slots, capacity),
      targetKey: key,
      fingerprint: fp,
      slotIndex: alt,
      phase: "alt",
      codeLines: cuckooFilterDeleteLines.checkAlt,
    };
    const slotAlt = slots[alt];
    if (slotAlt.state === "occupied" && slotAlt.fingerprint === fp) {
      yield {
        kind: "found",
        table: snapshot(slots, capacity),
        targetKey: key,
        fingerprint: fp,
        slotIndex: alt,
        phase: "alt",
        codeLines: cuckooFilterDeleteLines.foundAlt,
      };
      slots[alt] = EMPTY;
      yield {
        kind: "remove",
        table: snapshot(slots, capacity),
        targetKey: key,
        fingerprint: fp,
        slotIndex: alt,
        phase: "alt",
        codeLines: cuckooFilterDeleteLines.removeAlt,
      };
      continue;
    }

    yield {
      kind: "miss",
      table: snapshot(slots, capacity),
      targetKey: key,
      fingerprint: fp,
      codeLines: cuckooFilterDeleteLines.miss,
    };
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: cuckooFilterDeleteLines.done,
  };
}

export function buildCuckooFilter(capacity: number, keys: readonly number[]): CuckooFilterSnapshot {
  let final = emptyCuckooFilter(capacity);
  for (const step of cuckooFilterInsertSequence(final, keys)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}

// Live fingerprints across the table. Note: this returns FINGERPRINTS,
// not original keys — that's the whole point of the filter (keys
// aren't stored). Duplicates are expected (different keys can share a
// fingerprint, and the same fingerprint can legitimately live at two
// slots from independent insertions).
export function liveCuckooFilterFingerprints(table: CuckooFilterSnapshot): number[] {
  const out: number[] = [];
  for (const slot of table.slots) {
    if (slot.state === "occupied") out.push(slot.fingerprint);
  }
  return out;
}

// Pure-function contains: no step trace, just the boolean. Used by
// tests as the oracle for "what would the algorithm say?".
export function cuckooFilterContains(table: CuckooFilterSnapshot, key: number): boolean {
  const fp = cuckooFilterFingerprint(key);
  const home = cuckooFilterHome(key, table.capacity);
  const alt = cuckooFilterAlt(home, fp, table.capacity);
  const a = table.slots[home];
  if (a.state === "occupied" && a.fingerprint === fp) return true;
  const b = table.slots[alt];
  if (b.state === "occupied" && b.fingerprint === fp) return true;
  return false;
}
