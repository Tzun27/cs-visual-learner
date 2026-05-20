import { linearProbeDeleteLines } from "./linearProbeDelete.snippet";
import { linearProbeInsertLines } from "./linearProbeInsert.snippet";
import { linearProbeSearchLines } from "./linearProbeSearch.snippet";
import type {
  LinearProbeDeleteStep,
  LinearProbeInsertStep,
  LinearProbeSearchStep,
  LinearProbeSlot,
  LinearProbeSnapshot,
} from "./types";

const EMPTY: LinearProbeSlot = { state: "empty" };

/** Shared by every open-addressing probe strategy that reuses this snapshot. */
export const TOMBSTONE: LinearProbeSlot = { state: "tombstone" };

function emptySlots(capacity: number): LinearProbeSlot[] {
  return Array.from({ length: capacity }, () => EMPTY);
}

/** Deep-copies the slot array into a fresh, step-back-safe snapshot. */
export function snapshot(slots: readonly LinearProbeSlot[], capacity: number): LinearProbeSnapshot {
  return { capacity, slots: slots.map((s) => ({ ...s })) };
}

export function slotIndexFor(key: number, capacity: number): number {
  return ((key % capacity) + capacity) % capacity;
}

// Python's `key % capacity` for non-negative ints is `((k % cap) + cap) % cap`
// otherwise — the double-mod handles negative inputs without `-0` quirks.
// Matches the BST-style "everything in the data layer should be deterministic"
// rule.

export function* linearProbeInsertSequence(
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
      codeLines: linearProbeInsertLines.begin,
    };

    const start = slotIndexFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      insertingKey: key,
      slotIndex: start,
      codeLines: linearProbeInsertLines.hash,
    };

    let cursor = start;
    let probeCount = 0;
    let placed = false;
    let duplicate = false;
    while (probeCount < capacity) {
      const slot = slots[cursor];
      if (slot.state === "empty") {
        slots[cursor] = { state: "occupied", key };
        yield {
          kind: "place",
          table: snapshot(slots, capacity),
          insertingKey: key,
          slotIndex: cursor,
          codeLines: linearProbeInsertLines.place,
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
          codeLines: linearProbeInsertLines.duplicate,
        };
        duplicate = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? linearProbeInsertLines.probeTombstone
          : linearProbeInsertLines.probeOccupied;
      yield {
        kind: "probe",
        table: snapshot(slots, capacity),
        insertingKey: key,
        slotIndex: cursor,
        probeCount,
        codeLines: probeLines,
      };
      cursor = (cursor + 1) % capacity;
    }

    // If we walked the full table without placing or finding a duplicate,
    // the caller violated the no-full-table precondition. The lesson never
    // hits this with its curated inputs, but the generator is defensive.
    if (!placed && !duplicate) {
      throw new Error(`linear-probe insert: table full when inserting ${key}`);
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: linearProbeInsertLines.done,
  };
}

export function* linearProbeSearchSequence(
  initial: LinearProbeSnapshot,
  targets: readonly number[],
): Generator<LinearProbeSearchStep> {
  const { capacity, slots } = initial;
  for (const key of targets) {
    yield {
      kind: "begin",
      table: initial,
      targetKey: key,
      codeLines: linearProbeSearchLines.begin,
    };

    const start = slotIndexFor(key, capacity);
    yield {
      kind: "hash",
      table: initial,
      targetKey: key,
      slotIndex: start,
      codeLines: linearProbeSearchLines.hash,
    };

    let cursor = start;
    let probeCount = 0;
    let found = false;
    let missed = false;
    while (probeCount < capacity) {
      const slot = slots[cursor];
      if (slot.state === "empty") {
        yield {
          kind: "miss",
          table: initial,
          targetKey: key,
          slotIndex: cursor,
          codeLines: linearProbeSearchLines.miss,
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
          codeLines: linearProbeSearchLines.found,
        };
        found = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? linearProbeSearchLines.probeTombstone
          : linearProbeSearchLines.probeOccupied;
      yield {
        kind: "probe",
        table: initial,
        targetKey: key,
        slotIndex: cursor,
        probeCount,
        codeLines: probeLines,
      };
      cursor = (cursor + 1) % capacity;
    }
    // Walked the full table without empty: equivalent to a miss.
    if (!found && !missed) {
      yield {
        kind: "miss",
        table: initial,
        targetKey: key,
        slotIndex: cursor,
        codeLines: linearProbeSearchLines.miss,
      };
    }
  }
  yield {
    kind: "done",
    table: initial,
    codeLines: linearProbeSearchLines.done,
  };
}

export function* linearProbeDeleteSequence(
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
      codeLines: linearProbeDeleteLines.begin,
    };

    const start = slotIndexFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      targetKey: key,
      slotIndex: start,
      codeLines: linearProbeDeleteLines.hash,
    };

    let cursor = start;
    let probeCount = 0;
    let removed = false;
    let missed = false;
    while (probeCount < capacity) {
      const slot = slots[cursor];
      if (slot.state === "empty") {
        yield {
          kind: "miss",
          table: snapshot(slots, capacity),
          targetKey: key,
          slotIndex: cursor,
          codeLines: linearProbeDeleteLines.miss,
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
          codeLines: linearProbeDeleteLines.found,
        };
        slots[cursor] = TOMBSTONE;
        yield {
          kind: "tombstone",
          table: snapshot(slots, capacity),
          targetKey: key,
          slotIndex: cursor,
          codeLines: linearProbeDeleteLines.tombstone,
        };
        removed = true;
        break;
      }
      probeCount++;
      const probeLines =
        slot.state === "tombstone"
          ? linearProbeDeleteLines.probeTombstone
          : linearProbeDeleteLines.probeOccupied;
      yield {
        kind: "probe",
        table: snapshot(slots, capacity),
        targetKey: key,
        slotIndex: cursor,
        probeCount,
        codeLines: probeLines,
      };
      cursor = (cursor + 1) % capacity;
    }
    if (!removed && !missed) {
      yield {
        kind: "miss",
        table: snapshot(slots, capacity),
        targetKey: key,
        slotIndex: cursor,
        codeLines: linearProbeDeleteLines.miss,
      };
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: linearProbeDeleteLines.done,
  };
}

export function emptyTable(capacity: number): LinearProbeSnapshot {
  return { capacity, slots: emptySlots(capacity) };
}

export function buildLinearProbeTable(
  capacity: number,
  keys: readonly number[],
): LinearProbeSnapshot {
  let final = emptyTable(capacity);
  for (const step of linearProbeInsertSequence(final, keys)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}

export function liveKeys(table: LinearProbeSnapshot): number[] {
  const out: number[] = [];
  for (const slot of table.slots) {
    if (slot.state === "occupied") out.push(slot.key);
  }
  return out;
}

export function loadFactor(table: LinearProbeSnapshot): number {
  let live = 0;
  for (const slot of table.slots) {
    if (slot.state === "occupied") live++;
  }
  return live / table.capacity;
}
