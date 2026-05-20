import { doubleHashDeleteLines } from "./doubleHashDelete.snippet";
import { doubleHashInsertLines } from "./doubleHashInsert.snippet";
import { doubleHashSearchLines } from "./doubleHashSearch.snippet";
import { emptyTable, snapshot, TOMBSTONE } from "./linearProbe";
import type {
  LinearProbeDeleteStep,
  LinearProbeInsertStep,
  LinearProbeSearchStep,
  LinearProbeSlot,
  LinearProbeSnapshot,
} from "./types";

// Double hashing reuses LinearProbeSnapshot exactly — three-state slots,
// fixed capacity, same view component. The probe sequence is
// (h1(k) + j * h2(k)) mod c, where h2(k) returns a value in [1, c-1]. With
// prime capacity c, every step h2 is coprime with c, so the probe sequence
// visits every slot — unlike quadratic probing, which only reaches (c+1)/2
// slots even with prime c.
//
// The lesson uses capacity 11 (prime). The step function is the standard
// h2(k) = 1 + (k mod (c - 1)) — guaranteed to be in [1, c-1] and never zero.
// For different keys with the same h1(k), h2(k) differs almost always —
// which is exactly what eliminates the secondary clustering that quadratic
// probing leaves on the table.

export function doubleHashHomeFor(key: number, capacity: number): number {
  return (((key % capacity) + capacity) % capacity) | 0;
}

// h2(k) = 1 + (k mod (c - 1)). The double-mod handles negative keys
// symmetrically with doubleHashHomeFor. With prime c, h2 ∈ [1, c-1] is
// always coprime with c, so probe sequences visit every slot.
export function doubleHashStepFor(key: number, capacity: number): number {
  if (capacity <= 1) return 1;
  const m = capacity - 1;
  return (1 + (((key % m) + m) % m)) | 0;
}

// Probe j (0-indexed) lands at (home + j * step) mod capacity.
export function doubleHashSlotFor(
  home: number,
  probe: number,
  step: number,
  capacity: number,
): number {
  return ((((home + probe * step) % capacity) + capacity) % capacity) | 0;
}

export function* doubleHashInsertSequence(
  initial: LinearProbeSnapshot,
  keys: readonly number[],
): Generator<LinearProbeInsertStep> {
  const { capacity } = initial;
  const slots: LinearProbeSlot[] = initial.slots.map((s) => ({ ...s }));

  for (const key of keys) {
    yield {
      kind: "begin",
      table: snapshot(slots, capacity),
      insertingKey: key,
      codeLines: doubleHashInsertLines.begin,
    };

    const home = doubleHashHomeFor(key, capacity);
    const step = doubleHashStepFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      insertingKey: key,
      slotIndex: home,
      codeLines: doubleHashInsertLines.hash,
    };

    let placed = false;
    let duplicate = false;
    let probeCount = 0;
    for (let i = 0; i < capacity; i++) {
      const cursor = doubleHashSlotFor(home, i, step, capacity);
      const slot = slots[cursor];
      if (slot.state === "empty") {
        slots[cursor] = { state: "occupied", key };
        yield {
          kind: "place",
          table: snapshot(slots, capacity),
          insertingKey: key,
          slotIndex: cursor,
          codeLines: doubleHashInsertLines.place,
        };
        placed = true;
        break;
      }
      if (slot.state === "occupied" && slot.key === key) {
        yield {
          kind: "duplicate",
          table: snapshot(slots, capacity),
          insertingKey: key,
          slotIndex: cursor,
          codeLines: doubleHashInsertLines.duplicate,
        };
        duplicate = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? doubleHashInsertLines.probeTombstone
          : doubleHashInsertLines.probeOccupied;
      yield {
        kind: "probe",
        table: snapshot(slots, capacity),
        insertingKey: key,
        slotIndex: cursor,
        probeCount,
        codeLines: probeLines,
      };
    }

    // With prime capacity and h2 ∈ [1, c-1], the probe sequence visits every
    // slot — so the only way we exit the loop without placing or finding a
    // duplicate is a completely full table. The curated demo never hits this.
    if (!placed && !duplicate) {
      throw new Error(`double-hash insert: table full when inserting ${key}`);
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: doubleHashInsertLines.done,
  };
}

export function* doubleHashSearchSequence(
  initial: LinearProbeSnapshot,
  targets: readonly number[],
): Generator<LinearProbeSearchStep> {
  const { capacity, slots } = initial;
  for (const key of targets) {
    yield {
      kind: "begin",
      table: initial,
      targetKey: key,
      codeLines: doubleHashSearchLines.begin,
    };

    const home = doubleHashHomeFor(key, capacity);
    const step = doubleHashStepFor(key, capacity);
    yield {
      kind: "hash",
      table: initial,
      targetKey: key,
      slotIndex: home,
      codeLines: doubleHashSearchLines.hash,
    };

    let probeCount = 0;
    let found = false;
    let missed = false;
    let lastCursor = home;
    for (let i = 0; i < capacity; i++) {
      const cursor = doubleHashSlotFor(home, i, step, capacity);
      lastCursor = cursor;
      const slot = slots[cursor];
      if (slot.state === "empty") {
        yield {
          kind: "miss",
          table: initial,
          targetKey: key,
          slotIndex: cursor,
          codeLines: doubleHashSearchLines.miss,
        };
        missed = true;
        break;
      }
      if (slot.state === "occupied" && slot.key === key) {
        yield {
          kind: "found",
          table: initial,
          targetKey: key,
          slotIndex: cursor,
          codeLines: doubleHashSearchLines.found,
        };
        found = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? doubleHashSearchLines.probeTombstone
          : doubleHashSearchLines.probeOccupied;
      yield {
        kind: "probe",
        table: initial,
        targetKey: key,
        slotIndex: cursor,
        probeCount,
        codeLines: probeLines,
      };
    }
    // Walked the full probe sequence without finding an empty: same as a miss.
    if (!found && !missed) {
      yield {
        kind: "miss",
        table: initial,
        targetKey: key,
        slotIndex: lastCursor,
        codeLines: doubleHashSearchLines.miss,
      };
    }
  }
  yield {
    kind: "done",
    table: initial,
    codeLines: doubleHashSearchLines.done,
  };
}

export function* doubleHashDeleteSequence(
  initial: LinearProbeSnapshot,
  targets: readonly number[],
): Generator<LinearProbeDeleteStep> {
  const { capacity } = initial;
  const slots: LinearProbeSlot[] = initial.slots.map((s) => ({ ...s }));

  for (const key of targets) {
    yield {
      kind: "begin",
      table: snapshot(slots, capacity),
      targetKey: key,
      codeLines: doubleHashDeleteLines.begin,
    };

    const home = doubleHashHomeFor(key, capacity);
    const step = doubleHashStepFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      targetKey: key,
      slotIndex: home,
      codeLines: doubleHashDeleteLines.hash,
    };

    let probeCount = 0;
    let removed = false;
    let missed = false;
    let lastCursor = home;
    for (let i = 0; i < capacity; i++) {
      const cursor = doubleHashSlotFor(home, i, step, capacity);
      lastCursor = cursor;
      const slot = slots[cursor];
      if (slot.state === "empty") {
        yield {
          kind: "miss",
          table: snapshot(slots, capacity),
          targetKey: key,
          slotIndex: cursor,
          codeLines: doubleHashDeleteLines.miss,
        };
        missed = true;
        break;
      }
      if (slot.state === "occupied" && slot.key === key) {
        yield {
          kind: "found",
          table: snapshot(slots, capacity),
          targetKey: key,
          slotIndex: cursor,
          codeLines: doubleHashDeleteLines.found,
        };
        slots[cursor] = TOMBSTONE;
        yield {
          kind: "tombstone",
          table: snapshot(slots, capacity),
          targetKey: key,
          slotIndex: cursor,
          codeLines: doubleHashDeleteLines.tombstone,
        };
        removed = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? doubleHashDeleteLines.probeTombstone
          : doubleHashDeleteLines.probeOccupied;
      yield {
        kind: "probe",
        table: snapshot(slots, capacity),
        targetKey: key,
        slotIndex: cursor,
        probeCount,
        codeLines: probeLines,
      };
    }
    if (!removed && !missed) {
      yield {
        kind: "miss",
        table: snapshot(slots, capacity),
        targetKey: key,
        slotIndex: lastCursor,
        codeLines: doubleHashDeleteLines.miss,
      };
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: doubleHashDeleteLines.done,
  };
}

export function buildDoubleHashTable(
  capacity: number,
  keys: readonly number[],
): LinearProbeSnapshot {
  let final = emptyTable(capacity);
  for (const step of doubleHashInsertSequence(final, keys)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}
