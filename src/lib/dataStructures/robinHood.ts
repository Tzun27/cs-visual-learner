import { slotIndexFor } from "./linearProbe";
import { robinHoodDeleteLines } from "./robinHoodDelete.snippet";
import { robinHoodInsertLines } from "./robinHoodInsert.snippet";
import type {
  LinearProbeSlot,
  LinearProbeSnapshot,
  RobinHoodDeleteStep,
  RobinHoodInsertStep,
} from "./types";

function snapshot(slots: readonly LinearProbeSlot[], capacity: number): LinearProbeSnapshot {
  return { capacity, slots: slots.map((s) => ({ ...s })) };
}

// Probe distance of an occupied slot from its home: how many forward
// steps the key had to take to land there. For Robin Hood this is the
// per-slot "wealth" being equalized.
export function displacementOf(table: LinearProbeSnapshot, slotIndex: number): number | null {
  const slot = table.slots[slotIndex];
  if (slot.state !== "occupied") return null;
  const home = slotIndexFor(slot.key, table.capacity);
  return (slotIndex - home + table.capacity) % table.capacity;
}

export function* robinHoodInsertSequence(
  initial: LinearProbeSnapshot,
  keys: readonly number[],
): Generator<RobinHoodInsertStep> {
  const { capacity } = initial;
  const slots: LinearProbeSlot[] = initial.slots.map((s) => ({ ...s }));

  for (const inputKey of keys) {
    yield {
      kind: "begin",
      table: snapshot(slots, capacity),
      insertingKey: inputKey,
      codeLines: robinHoodInsertLines.begin,
    };

    let cursor = slotIndexFor(inputKey, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      insertingKey: inputKey,
      slotIndex: cursor,
      codeLines: robinHoodInsertLines.hash,
    };

    let key = inputKey;
    let probe = 0;
    let placed = false;
    let duplicate = false;
    while (probe < capacity) {
      const slot = slots[cursor];
      if (slot.state === "empty") {
        slots[cursor] = { state: "occupied", key };
        yield {
          kind: "place",
          table: snapshot(slots, capacity),
          insertingKey: key,
          slotIndex: cursor,
          probe,
          codeLines: robinHoodInsertLines.place,
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
          codeLines: robinHoodInsertLines.duplicate,
        };
        duplicate = true;
        break;
      }
      // Cursor is occupied (with a different key) OR is a tombstone.
      // Compute existing displacement, compare against ours.
      let existingProbe: number;
      if (slot.state === "tombstone") {
        // Treat tombstone as having displacement 0 (a "rich" resident
        // that any probing key can evict). This is the simplest correct
        // interpretation; production implementations vary.
        existingProbe = 0;
      } else {
        const existingHome = slotIndexFor(slot.key, capacity);
        existingProbe = (cursor - existingHome + capacity) % capacity;
      }
      yield {
        kind: "compare-displacement",
        table: snapshot(slots, capacity),
        insertingKey: key,
        slotIndex: cursor,
        insertingProbe: probe,
        existingProbe,
        codeLines: robinHoodInsertLines.compareDisplacement,
      };
      if (probe > existingProbe) {
        // Rob from the rich.
        if (slot.state === "tombstone") {
          // Reusing a tombstone: place the inserting key here, nothing
          // to carry forward. Continue inserting only if there's still
          // a key to insert; we don't currently emit a swap step in
          // this branch because the inserting key just lands here.
          slots[cursor] = { state: "occupied", key };
          yield {
            kind: "place",
            table: snapshot(slots, capacity),
            insertingKey: key,
            slotIndex: cursor,
            probe,
            codeLines: robinHoodInsertLines.place,
          };
          placed = true;
          break;
        }
        const evictedKey = slot.key;
        slots[cursor] = { state: "occupied", key };
        yield {
          kind: "swap",
          table: snapshot(slots, capacity),
          slotIndex: cursor,
          placedKey: key,
          evictedKey,
          probe: existingProbe,
          codeLines: robinHoodInsertLines.swap,
        };
        key = evictedKey;
        probe = existingProbe;
        // fall through into probe-advance below
      }
      cursor = (cursor + 1) % capacity;
      probe++;
      yield {
        kind: "probe",
        table: snapshot(slots, capacity),
        insertingKey: key,
        slotIndex: cursor,
        probe,
        codeLines: robinHoodInsertLines.probe,
      };
    }

    if (!placed && !duplicate) {
      throw new Error(`robin-hood insert: table full when inserting ${inputKey}`);
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: robinHoodInsertLines.done,
  };
}

export function buildRobinHoodTable(
  capacity: number,
  keys: readonly number[],
): LinearProbeSnapshot {
  const empty: LinearProbeSnapshot = {
    capacity,
    slots: Array.from({ length: capacity }, () => ({ state: "empty" as const })),
  };
  let final = empty;
  for (const step of robinHoodInsertSequence(empty, keys)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}

// Robin Hood backshift deletion: search like normal, then on a match,
// walk forward pulling each subsequent key one slot to the left until we
// hit an empty slot or a key already at displacement 0. No tombstones are
// produced — backshift is what replaces them in the Robin Hood scheme.
export function* robinHoodDeleteSequence(
  initial: LinearProbeSnapshot,
  targets: readonly number[],
): Generator<RobinHoodDeleteStep> {
  const { capacity } = initial;
  const slots: LinearProbeSlot[] = initial.slots.map((s) => ({ ...s }));

  for (const key of targets) {
    yield {
      kind: "begin",
      table: snapshot(slots, capacity),
      targetKey: key,
      codeLines: robinHoodDeleteLines.begin,
    };

    const start = slotIndexFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, capacity),
      targetKey: key,
      slotIndex: start,
      codeLines: robinHoodDeleteLines.hash,
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
          table: snapshot(slots, capacity),
          targetKey: key,
          slotIndex: cursor,
          codeLines: robinHoodDeleteLines.miss,
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
          codeLines: robinHoodDeleteLines.found,
        };
        // Backshift: walk forward pulling each subsequent key one slot
        // toward its home, until we hit a stop condition.
        let i = cursor;
        let j = (i + 1) % capacity;
        let blockerReason: "empty" | "at-home" = "empty";
        let pullsThisDelete = 0;
        // The inner loop is bounded by capacity for the same reason as
        // the linear-probing probe loops: pathological tables could in
        // principle have nothing but occupied non-home slots, and we
        // need a hard stop. In practice this never fires.
        while (pullsThisDelete < capacity) {
          const nextSlot = slots[j];
          if (nextSlot.state !== "occupied") {
            // Tombstones don't exist in Robin Hood's backshift world,
            // but defensively treat any non-occupied as a stop.
            blockerReason = "empty";
            break;
          }
          const nextHome = slotIndexFor(nextSlot.key, capacity);
          if (nextHome === j) {
            blockerReason = "at-home";
            break;
          }
          slots[i] = { state: "occupied", key: nextSlot.key };
          yield {
            kind: "pull",
            table: snapshot(slots, capacity),
            fromIndex: j,
            toIndex: i,
            pulledKey: nextSlot.key,
            codeLines: robinHoodDeleteLines.pull,
          };
          pullsThisDelete++;
          i = j;
          j = (j + 1) % capacity;
        }
        slots[i] = { state: "empty" };
        yield {
          kind: "clear",
          table: snapshot(slots, capacity),
          clearedIndex: i,
          blockerIndex: j,
          blockerReason,
          codeLines: robinHoodDeleteLines.clear,
        };
        found = true;
        break;
      }
      // Slot is occupied with a non-matching key (Robin Hood has no
      // tombstones, so this is the only "keep probing" case). Advance.
      probeCount++;
      cursor = (cursor + 1) % capacity;
      yield {
        kind: "probe",
        table: snapshot(slots, capacity),
        targetKey: key,
        slotIndex: cursor,
        probeCount,
        codeLines: robinHoodDeleteLines.probe,
      };
    }
    // If we walked the full table without finding or missing, treat as
    // a miss. Defensive: the curated inputs never trigger this.
    if (!found && !missed) {
      yield {
        kind: "miss",
        table: snapshot(slots, capacity),
        targetKey: key,
        slotIndex: cursor,
        codeLines: robinHoodDeleteLines.miss,
      };
    }
  }

  yield {
    kind: "done",
    table: snapshot(slots, capacity),
    codeLines: robinHoodDeleteLines.done,
  };
}

export function maxDisplacement(table: LinearProbeSnapshot): number {
  let max = 0;
  for (let i = 0; i < table.capacity; i++) {
    const d = displacementOf(table, i);
    if (d !== null && d > max) max = d;
  }
  return max;
}
