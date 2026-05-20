import { emptyTable, snapshot, TOMBSTONE } from "./linearProbe";
import { quadraticProbeDeleteLines } from "./quadraticProbeDelete.snippet";
import { quadraticProbeInsertLines } from "./quadraticProbeInsert.snippet";
import { quadraticProbeSearchLines } from "./quadraticProbeSearch.snippet";
import type {
  LinearProbeDeleteStep,
  LinearProbeInsertStep,
  LinearProbeSearchStep,
  LinearProbeSlot,
  LinearProbeSnapshot,
} from "./types";

// Quadratic probing shares LinearProbeSnapshot exactly — three-state slots,
// fixed capacity, same view component. Only the probe sequence changes:
// (home + i*i) mod capacity instead of (home + i) mod capacity. Step shapes
// are identical, so we reuse LinearProbe*Step types directly.
//
// Important caveat the lesson copy spells out: quadratic probing only
// guarantees an empty slot at load factor < 0.5 with prime capacity. We use
// capacity 11 (prime) for the curated demos so the probe sequence is
// well-defined and the "no clustering" pedagogy lands cleanly.

// Probe i (0-indexed) lands at (home + i*i) mod capacity. Double-mod
// handles negative inputs symmetrically with slotIndexFor's contract.
export function quadraticSlotFor(home: number, probe: number, capacity: number): number {
  return ((((home + probe * probe) % capacity) + capacity) % capacity) | 0;
}

export function quadraticHomeFor(key: number, capacity: number): number {
  return (((key % capacity) + capacity) % capacity) | 0;
}

export function* quadraticProbeInsertSequence(
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
      codeLines: quadraticProbeInsertLines.begin,
    };

    const home = quadraticHomeFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      insertingKey: key,
      slotIndex: home,
      codeLines: quadraticProbeInsertLines.hash,
    };

    let placed = false;
    let duplicate = false;
    let probeCount = 0;
    for (let i = 0; i < capacity; i++) {
      const cursor = quadraticSlotFor(home, i, capacity);
      const slot = slots[cursor];
      if (slot.state === "empty") {
        slots[cursor] = { state: "occupied", key };
        yield {
          kind: "place",
          table: snapshot(slots, capacity),
          insertingKey: key,
          slotIndex: cursor,
          codeLines: quadraticProbeInsertLines.place,
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
          codeLines: quadraticProbeInsertLines.duplicate,
        };
        duplicate = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? quadraticProbeInsertLines.probeTombstone
          : quadraticProbeInsertLines.probeOccupied;
      yield {
        kind: "probe",
        table: snapshot(slots, capacity),
        insertingKey: key,
        slotIndex: cursor,
        probeCount,
        codeLines: probeLines,
      };
    }

    // No slot found within `capacity` probes. With prime capacity at load
    // factor < 0.5 the curated demos never hit this. The generator throws
    // so a regression couldn't silently drop a key.
    if (!placed && !duplicate) {
      throw new Error(`quadratic-probe insert: no slot available for ${key}`);
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: quadraticProbeInsertLines.done,
  };
}

export function* quadraticProbeSearchSequence(
  initial: LinearProbeSnapshot,
  targets: readonly number[],
): Generator<LinearProbeSearchStep> {
  const { capacity, slots } = initial;
  for (const key of targets) {
    yield {
      kind: "begin",
      table: initial,
      targetKey: key,
      codeLines: quadraticProbeSearchLines.begin,
    };

    const home = quadraticHomeFor(key, capacity);
    yield {
      kind: "hash",
      table: initial,
      targetKey: key,
      slotIndex: home,
      codeLines: quadraticProbeSearchLines.hash,
    };

    let probeCount = 0;
    let found = false;
    let missed = false;
    let lastCursor = home;
    for (let i = 0; i < capacity; i++) {
      const cursor = quadraticSlotFor(home, i, capacity);
      lastCursor = cursor;
      const slot = slots[cursor];
      if (slot.state === "empty") {
        yield {
          kind: "miss",
          table: initial,
          targetKey: key,
          slotIndex: cursor,
          codeLines: quadraticProbeSearchLines.miss,
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
          codeLines: quadraticProbeSearchLines.found,
        };
        found = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? quadraticProbeSearchLines.probeTombstone
          : quadraticProbeSearchLines.probeOccupied;
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
        codeLines: quadraticProbeSearchLines.miss,
      };
    }
  }
  yield {
    kind: "done",
    table: initial,
    codeLines: quadraticProbeSearchLines.done,
  };
}

export function* quadraticProbeDeleteSequence(
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
      codeLines: quadraticProbeDeleteLines.begin,
    };

    const home = quadraticHomeFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      targetKey: key,
      slotIndex: home,
      codeLines: quadraticProbeDeleteLines.hash,
    };

    let probeCount = 0;
    let removed = false;
    let missed = false;
    let lastCursor = home;
    for (let i = 0; i < capacity; i++) {
      const cursor = quadraticSlotFor(home, i, capacity);
      lastCursor = cursor;
      const slot = slots[cursor];
      if (slot.state === "empty") {
        yield {
          kind: "miss",
          table: snapshot(slots, capacity),
          targetKey: key,
          slotIndex: cursor,
          codeLines: quadraticProbeDeleteLines.miss,
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
          codeLines: quadraticProbeDeleteLines.found,
        };
        slots[cursor] = TOMBSTONE;
        yield {
          kind: "tombstone",
          table: snapshot(slots, capacity),
          targetKey: key,
          slotIndex: cursor,
          codeLines: quadraticProbeDeleteLines.tombstone,
        };
        removed = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? quadraticProbeDeleteLines.probeTombstone
          : quadraticProbeDeleteLines.probeOccupied;
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
        codeLines: quadraticProbeDeleteLines.miss,
      };
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: quadraticProbeDeleteLines.done,
  };
}

export function buildQuadraticProbeTable(
  capacity: number,
  keys: readonly number[],
): LinearProbeSnapshot {
  let final = emptyTable(capacity);
  for (const step of quadraticProbeInsertSequence(final, keys)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}
