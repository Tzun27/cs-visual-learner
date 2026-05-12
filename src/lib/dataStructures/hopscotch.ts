import { hopscotchInsertLines } from "./hopscotchInsert.snippet";
import { hopscotchSearchLines } from "./hopscotchSearch.snippet";
import type {
  HopscotchInsertStep,
  HopscotchSearchStep,
  HopscotchSlot,
  HopscotchSnapshot,
} from "./types";

// H, the neighborhood size. Production hopscotch tables use 32 or 64
// (one machine word). The lesson uses 4 so the bitmask is visible at a
// glance and the swap chain triggers on small inputs.
export const HOPSCOTCH_NEIGHBORHOOD = 4;

const EMPTY: HopscotchSlot = { state: "empty" };

function deepCopySlots(slots: readonly HopscotchSlot[]): HopscotchSlot[] {
  return slots.map((s) => (s.state === "empty" ? EMPTY : { ...s }));
}

function snapshot(
  slots: readonly HopscotchSlot[],
  hopInfo: readonly number[],
  capacity: number,
  neighborhood: number,
): HopscotchSnapshot {
  return { capacity, neighborhood, slots: deepCopySlots(slots), hopInfo: [...hopInfo] };
}

export function emptyHopscotchTable(
  capacity: number,
  neighborhood = HOPSCOTCH_NEIGHBORHOOD,
): HopscotchSnapshot {
  return {
    capacity,
    neighborhood,
    slots: Array.from({ length: capacity }, () => EMPTY),
    hopInfo: Array.from({ length: capacity }, () => 0),
  };
}

export function hopscotchHomeFor(key: number, capacity: number): number {
  return (((key % capacity) + capacity) % capacity) | 0;
}

function mod(x: number, m: number): number {
  return ((x % m) + m) % m;
}

export function* hopscotchInsertSequence(
  initial: HopscotchSnapshot,
  keys: readonly number[],
): Generator<HopscotchInsertStep> {
  const { capacity, neighborhood } = initial;
  const slots = deepCopySlots(initial.slots);
  const hopInfo = [...initial.hopInfo];

  for (const key of keys) {
    yield {
      kind: "begin",
      table: snapshot(slots, hopInfo, capacity, neighborhood),
      insertingKey: key,
      codeLines: hopscotchInsertLines.begin,
    };

    const home = hopscotchHomeFor(key, capacity);
    yield {
      kind: "hash",
      table: snapshot(slots, hopInfo, capacity, neighborhood),
      insertingKey: key,
      home,
      codeLines: hopscotchInsertLines.hash,
    };

    // Phase 1: linear scan forward for the nearest empty slot, with
    // duplicate-key short-circuit. Bounded by `capacity`; if the scan
    // walks every slot without finding empty the table is genuinely
    // full and we throw.
    let cursor = home;
    let foundEmpty = false;
    let duplicate = false;
    let steps = 0;
    while (steps < capacity) {
      const slot = slots[cursor];
      if (slot.state === "empty") {
        foundEmpty = true;
        break;
      }
      if (slot.key === key) {
        yield {
          kind: "duplicate",
          table: snapshot(slots, hopInfo, capacity, neighborhood),
          insertingKey: key,
          home,
          slotIndex: cursor,
          codeLines: hopscotchInsertLines.duplicate,
        };
        duplicate = true;
        break;
      }
      yield {
        kind: "scan",
        table: snapshot(slots, hopInfo, capacity, neighborhood),
        insertingKey: key,
        home,
        slotIndex: cursor,
        distance: mod(cursor - home, capacity),
        codeLines: hopscotchInsertLines.scanProbe,
      };
      cursor = (cursor + 1) % capacity;
      steps++;
    }

    if (duplicate) continue;
    if (!foundEmpty) {
      throw new Error(`hopscotch insert: table full (no empty slot for ${key})`);
    }

    // Phase 2: if the empty slot is too far from home, run the swap
    // chain to walk it backwards. Each iteration picks a swap candidate
    // j in [cursor-H+1, cursor-1] whose resident's home is within H of
    // cursor — moving that resident forward to cursor frees a slot
    // closer to home.
    let dist = mod(cursor - home, capacity);
    while (dist >= neighborhood) {
      let swapped = false;
      for (let offset = neighborhood - 1; offset >= 1; offset--) {
        const cand = mod(cursor - offset, capacity);
        const candSlot = slots[cand];
        // Scan-forward guarantees every slot in [home, cursor-1] is occupied,
        // and (since dist >= H) the candidate window [cursor-H+1, cursor-1]
        // is contained in that range. So `candSlot.state === "occupied"`
        // holds by invariant; the guard exists only to narrow the type and
        // protect against future algorithm changes that break this property.
        /* v8 ignore next */
        if (candSlot.state !== "occupied") continue;
        const candHome = candSlot.home;
        const distCandHomeToCursor = mod(cursor - candHome, capacity);
        if (distCandHomeToCursor < neighborhood) {
          // Move resident from `cand` → `cursor`. The empty slot now
          // lives at `cand`.
          const pulledKey = candSlot.key;
          slots[cursor] = { state: "occupied", key: pulledKey, home: candHome };
          slots[cand] = EMPTY;
          // Update candHome's hop mask: clear the bit for the old slot,
          // set the bit for the new slot. Both bit positions are mod H.
          const oldBit = mod(cand - candHome, capacity);
          const newBit = mod(cursor - candHome, capacity);
          hopInfo[candHome] = (hopInfo[candHome] & ~(1 << oldBit)) | (1 << newBit);
          yield {
            kind: "swap",
            table: snapshot(slots, hopInfo, capacity, neighborhood),
            insertingKey: key,
            home,
            fromIndex: cand,
            toIndex: cursor,
            pulledKey,
            pulledHome: candHome,
            codeLines: hopscotchInsertLines.swap,
          };
          cursor = cand;
          dist = mod(cursor - home, capacity);
          swapped = true;
          break;
        }
      }
      if (!swapped) {
        throw new Error(`hopscotch insert: swap chain dead end inserting ${key} (needs rehash)`);
      }
    }

    // Phase 3: place the key at the now-close-enough empty slot and
    // set home's hop bit at position `dist`.
    slots[cursor] = { state: "occupied", key, home };
    hopInfo[home] = hopInfo[home] | (1 << dist);
    yield {
      kind: "place",
      table: snapshot(slots, hopInfo, capacity, neighborhood),
      insertingKey: key,
      home,
      slotIndex: cursor,
      distance: dist,
      codeLines: hopscotchInsertLines.place,
    };
  }

  yield {
    kind: "done",
    table: snapshot(slots, hopInfo, capacity, neighborhood),
    codeLines: hopscotchInsertLines.done,
  };
}

export function* hopscotchSearchSequence(
  initial: HopscotchSnapshot,
  targets: readonly number[],
): Generator<HopscotchSearchStep> {
  const { capacity, neighborhood, slots, hopInfo } = initial;
  for (const key of targets) {
    yield {
      kind: "begin",
      table: initial,
      targetKey: key,
      codeLines: hopscotchSearchLines.begin,
    };

    const home = hopscotchHomeFor(key, capacity);
    const mask = hopInfo[home];
    yield {
      kind: "hash",
      table: initial,
      targetKey: key,
      home,
      hopMask: mask,
      codeLines: hopscotchSearchLines.hash,
    };

    let found = false;
    let foundSlot = home;
    for (let j = 0; j < neighborhood; j++) {
      const slotIndex = (home + j) % capacity;
      const isSet = (mask & (1 << j)) !== 0;
      yield {
        kind: "check-bit",
        table: initial,
        targetKey: key,
        home,
        bitIndex: j,
        slotIndex,
        isSet,
        codeLines: isSet ? hopscotchSearchLines.checkSet : hopscotchSearchLines.checkClear,
      };
      if (!isSet) continue;
      const slot = slots[slotIndex];
      if (slot.state === "occupied" && slot.key === key) {
        found = true;
        foundSlot = slotIndex;
        break;
      }
    }

    if (found) {
      yield {
        kind: "found",
        table: initial,
        targetKey: key,
        home,
        slotIndex: foundSlot,
        codeLines: hopscotchSearchLines.found,
      };
    } else {
      yield {
        kind: "miss",
        table: initial,
        targetKey: key,
        home,
        codeLines: hopscotchSearchLines.miss,
      };
    }
  }
  yield {
    kind: "done",
    table: initial,
    codeLines: hopscotchSearchLines.done,
  };
}

export function buildHopscotchTable(
  capacity: number,
  keys: readonly number[],
  neighborhood = HOPSCOTCH_NEIGHBORHOOD,
): HopscotchSnapshot {
  let final = emptyHopscotchTable(capacity, neighborhood);
  for (const step of hopscotchInsertSequence(final, keys)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}
