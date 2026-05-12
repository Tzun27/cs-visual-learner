import { slotIndexFor } from "./linearProbe";
import { robinHoodInsertLines } from "./robinHoodInsert.snippet";
import type { LinearProbeSlot, LinearProbeSnapshot, RobinHoodInsertStep } from "./types";

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

export function maxDisplacement(table: LinearProbeSnapshot): number {
  let max = 0;
  for (let i = 0; i < table.capacity; i++) {
    const d = displacementOf(table, i);
    if (d !== null && d > max) max = d;
  }
  return max;
}
