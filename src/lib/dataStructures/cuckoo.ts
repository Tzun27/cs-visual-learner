import { cuckooDeleteLines } from "./cuckooDelete.snippet";
import { cuckooInsertLines } from "./cuckooInsert.snippet";
import { cuckooSearchLines } from "./cuckooSearch.snippet";
import type {
  CuckooDeleteStep,
  CuckooInsertStep,
  CuckooSearchStep,
  CuckooSide,
  CuckooSlot,
  CuckooSnapshot,
} from "./types";

// Two parallel tables with independent hash functions. The lesson uses
// capacity 7 per table (so 14 slots total), with h1 = k mod c and
// h2 = ⌊k / c⌋ mod c. For keys in [0, c²) every (h1, h2) pair is unique
// — keeping the curated cascade demos legible without needing prime
// arithmetic tricks.

const EMPTY: CuckooSlot = { state: "empty" };

// Eviction cascades on a sane load factor finish in a handful of swaps;
// 8 is comfortably above the curated demos' worst-case depth of 3 while
// still being small enough to surface as a "cycle" if a bad input ever
// slips through.
export const CUCKOO_MAX_ITERATIONS = 8;

export function cuckooHash1(key: number, capacity: number): number {
  return (((key % capacity) + capacity) % capacity) | 0;
}

// Truncated-divide second hash. Works for negative keys via Math.floor —
// JS's `/` truncates toward zero, but the floor-divide variant keeps the
// residue in [0, capacity-1] without sign surprises.
export function cuckooHash2(key: number, capacity: number): number {
  const quotient = Math.floor(key / capacity);
  return (((quotient % capacity) + capacity) % capacity) | 0;
}

function deepCopySlots(slots: readonly CuckooSlot[]): CuckooSlot[] {
  return slots.map((s) => (s.state === "empty" ? EMPTY : { ...s }));
}

function snapshot(
  slotsA: readonly CuckooSlot[],
  slotsB: readonly CuckooSlot[],
  capacity: number,
): CuckooSnapshot {
  return { capacity, slotsA: deepCopySlots(slotsA), slotsB: deepCopySlots(slotsB) };
}

export function emptyCuckooTable(capacity: number): CuckooSnapshot {
  return {
    capacity,
    slotsA: Array.from({ length: capacity }, () => EMPTY),
    slotsB: Array.from({ length: capacity }, () => EMPTY),
  };
}

function slotOf(
  table: { readonly slotsA: readonly CuckooSlot[]; readonly slotsB: readonly CuckooSlot[] },
  side: CuckooSide,
  index: number,
): CuckooSlot {
  return side === "A" ? table.slotsA[index] : table.slotsB[index];
}

function hashFor(key: number, side: CuckooSide, capacity: number): number {
  return side === "A" ? cuckooHash1(key, capacity) : cuckooHash2(key, capacity);
}

function otherSide(side: CuckooSide): CuckooSide {
  return side === "A" ? "B" : "A";
}

export function* cuckooInsertSequence(
  initial: CuckooSnapshot,
  keys: readonly number[],
): Generator<CuckooInsertStep> {
  const { capacity } = initial;
  const slotsA: CuckooSlot[] = deepCopySlots(initial.slotsA);
  const slotsB: CuckooSlot[] = deepCopySlots(initial.slotsB);

  for (const key of keys) {
    yield {
      kind: "begin",
      table: snapshot(slotsA, slotsB, capacity),
      insertingKey: key,
      codeLines: cuckooInsertLines.begin,
    };

    const home1 = cuckooHash1(key, capacity);
    const home2 = cuckooHash2(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slotsA, slotsB, capacity),
      insertingKey: key,
      home1,
      home2,
      codeLines: cuckooInsertLines.hash,
    };

    // Dedup-check T_A first.
    yield {
      kind: "dedup-check",
      table: snapshot(slotsA, slotsB, capacity),
      insertingKey: key,
      side: "A",
      slotIndex: home1,
      codeLines: cuckooInsertLines.dedupCheckA,
    };
    const slotAtHome1 = slotsA[home1];
    if (slotAtHome1.state === "occupied" && slotAtHome1.key === key) {
      yield {
        kind: "duplicate",
        table: snapshot(slotsA, slotsB, capacity),
        insertingKey: key,
        side: "A",
        slotIndex: home1,
        codeLines: cuckooInsertLines.duplicateA,
      };
      continue;
    }

    // Dedup-check T_B.
    yield {
      kind: "dedup-check",
      table: snapshot(slotsA, slotsB, capacity),
      insertingKey: key,
      side: "B",
      slotIndex: home2,
      codeLines: cuckooInsertLines.dedupCheckB,
    };
    const slotAtHome2 = slotsB[home2];
    if (slotAtHome2.state === "occupied" && slotAtHome2.key === key) {
      yield {
        kind: "duplicate",
        table: snapshot(slotsA, slotsB, capacity),
        insertingKey: key,
        side: "B",
        slotIndex: home2,
        codeLines: cuckooInsertLines.duplicateB,
      };
      continue;
    }

    // Eviction loop: alternating tables, starting at T_A.
    let activeKey = key;
    let side: CuckooSide = "A";
    let placedInLoop = false;
    let cycled = false;
    for (let iter = 0; iter < CUCKOO_MAX_ITERATIONS; iter++) {
      const slotIndex = hashFor(activeKey, side, capacity);
      yield {
        kind: "check",
        table: snapshot(slotsA, slotsB, capacity),
        activeKey,
        side,
        slotIndex,
        codeLines: cuckooInsertLines.check,
      };
      const current = slotOf({ slotsA, slotsB }, side, slotIndex);
      if (current.state === "empty") {
        const placed: CuckooSlot = { state: "occupied", key: activeKey };
        if (side === "A") slotsA[slotIndex] = placed;
        else slotsB[slotIndex] = placed;
        yield {
          kind: "place",
          table: snapshot(slotsA, slotsB, capacity),
          placedKey: activeKey,
          side,
          slotIndex,
          codeLines: cuckooInsertLines.place,
        };
        placedInLoop = true;
        break;
      }
      // Swap: place active in this slot, displaced becomes new active,
      // switch tables.
      const displacedKey = current.key;
      const newSlot: CuckooSlot = { state: "occupied", key: activeKey };
      if (side === "A") slotsA[slotIndex] = newSlot;
      else slotsB[slotIndex] = newSlot;
      const nextSide = otherSide(side);
      const nextSlotIndex = hashFor(displacedKey, nextSide, capacity);
      yield {
        kind: "evict",
        table: snapshot(slotsA, slotsB, capacity),
        placedKey: activeKey,
        evictedKey: displacedKey,
        side,
        slotIndex,
        nextSide,
        nextSlotIndex,
        codeLines: cuckooInsertLines.evict,
      };
      activeKey = displacedKey;
      side = nextSide;
    }

    if (!placedInLoop) {
      yield {
        kind: "cycle",
        table: snapshot(slotsA, slotsB, capacity),
        insertingKey: key,
        codeLines: cuckooInsertLines.cycle,
      };
      cycled = true;
    }

    if (cycled) {
      // Throw is the natural production semantic, but the generator
      // emits a cycle step first so the viz can render the failure
      // state before bailing. Curated demos never hit this branch.
      throw new Error(`cuckoo insert: cycle while inserting ${key}; rehash required`);
    }
  }

  yield {
    kind: "done",
    table: snapshot(slotsA, slotsB, capacity),
    codeLines: cuckooInsertLines.done,
  };
}

export function* cuckooSearchSequence(
  initial: CuckooSnapshot,
  targets: readonly number[],
): Generator<CuckooSearchStep> {
  const { capacity, slotsA, slotsB } = initial;

  for (const key of targets) {
    yield {
      kind: "begin",
      table: initial,
      targetKey: key,
      codeLines: cuckooSearchLines.begin,
    };

    const home1 = cuckooHash1(key, capacity);
    const home2 = cuckooHash2(key, capacity);
    yield {
      kind: "hash",
      table: initial,
      targetKey: key,
      home1,
      home2,
      codeLines: cuckooSearchLines.hash,
    };

    // Check T_A first.
    yield {
      kind: "check",
      table: initial,
      targetKey: key,
      side: "A",
      slotIndex: home1,
      codeLines: cuckooSearchLines.checkA,
    };
    const slotA = slotsA[home1];
    if (slotA.state === "occupied" && slotA.key === key) {
      yield {
        kind: "found",
        table: initial,
        targetKey: key,
        side: "A",
        slotIndex: home1,
        codeLines: cuckooSearchLines.foundA,
      };
      continue;
    }

    // Check T_B.
    yield {
      kind: "check",
      table: initial,
      targetKey: key,
      side: "B",
      slotIndex: home2,
      codeLines: cuckooSearchLines.checkB,
    };
    const slotB = slotsB[home2];
    if (slotB.state === "occupied" && slotB.key === key) {
      yield {
        kind: "found",
        table: initial,
        targetKey: key,
        side: "B",
        slotIndex: home2,
        codeLines: cuckooSearchLines.foundB,
      };
      continue;
    }

    yield {
      kind: "miss",
      table: initial,
      targetKey: key,
      codeLines: cuckooSearchLines.miss,
    };
  }
  yield {
    kind: "done",
    table: initial,
    codeLines: cuckooSearchLines.done,
  };
}

export function* cuckooDeleteSequence(
  initial: CuckooSnapshot,
  targets: readonly number[],
): Generator<CuckooDeleteStep> {
  const { capacity } = initial;
  const slotsA: CuckooSlot[] = deepCopySlots(initial.slotsA);
  const slotsB: CuckooSlot[] = deepCopySlots(initial.slotsB);

  for (const key of targets) {
    yield {
      kind: "begin",
      table: snapshot(slotsA, slotsB, capacity),
      targetKey: key,
      codeLines: cuckooDeleteLines.begin,
    };

    const home1 = cuckooHash1(key, capacity);
    const home2 = cuckooHash2(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slotsA, slotsB, capacity),
      targetKey: key,
      home1,
      home2,
      codeLines: cuckooDeleteLines.hash,
    };

    // Check T_A first.
    yield {
      kind: "check",
      table: snapshot(slotsA, slotsB, capacity),
      targetKey: key,
      side: "A",
      slotIndex: home1,
      codeLines: cuckooDeleteLines.checkA,
    };
    const slotA = slotsA[home1];
    if (slotA.state === "occupied" && slotA.key === key) {
      yield {
        kind: "found",
        table: snapshot(slotsA, slotsB, capacity),
        targetKey: key,
        side: "A",
        slotIndex: home1,
        codeLines: cuckooDeleteLines.foundA,
      };
      slotsA[home1] = EMPTY;
      yield {
        kind: "remove",
        table: snapshot(slotsA, slotsB, capacity),
        targetKey: key,
        side: "A",
        slotIndex: home1,
        codeLines: cuckooDeleteLines.removeA,
      };
      continue;
    }

    // Check T_B.
    yield {
      kind: "check",
      table: snapshot(slotsA, slotsB, capacity),
      targetKey: key,
      side: "B",
      slotIndex: home2,
      codeLines: cuckooDeleteLines.checkB,
    };
    const slotB = slotsB[home2];
    if (slotB.state === "occupied" && slotB.key === key) {
      yield {
        kind: "found",
        table: snapshot(slotsA, slotsB, capacity),
        targetKey: key,
        side: "B",
        slotIndex: home2,
        codeLines: cuckooDeleteLines.foundB,
      };
      slotsB[home2] = EMPTY;
      yield {
        kind: "remove",
        table: snapshot(slotsA, slotsB, capacity),
        targetKey: key,
        side: "B",
        slotIndex: home2,
        codeLines: cuckooDeleteLines.removeB,
      };
      continue;
    }

    yield {
      kind: "miss",
      table: snapshot(slotsA, slotsB, capacity),
      targetKey: key,
      codeLines: cuckooDeleteLines.miss,
    };
  }
  yield {
    kind: "done",
    table: snapshot(slotsA, slotsB, capacity),
    codeLines: cuckooDeleteLines.done,
  };
}

export function buildCuckooTable(capacity: number, keys: readonly number[]): CuckooSnapshot {
  let final = emptyCuckooTable(capacity);
  for (const step of cuckooInsertSequence(final, keys)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}

// Collect the keys currently in the table by walking both side arrays —
// used by tests and any consumer that needs "what's actually stored?"
// without re-running the insert sequence.
export function liveCuckooKeys(table: CuckooSnapshot): number[] {
  const keys: number[] = [];
  for (const slot of table.slotsA) {
    if (slot.state === "occupied") keys.push(slot.key);
  }
  for (const slot of table.slotsB) {
    if (slot.state === "occupied") keys.push(slot.key);
  }
  return keys;
}
