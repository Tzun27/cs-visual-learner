import { bloomFilterInsertLines } from "./bloomFilterInsert.snippet";
import { bloomFilterSearchLines } from "./bloomFilterSearch.snippet";
import type { BloomFilterInsertStep, BloomFilterSearchStep, BloomFilterSnapshot } from "./types";

// Demo parameters. m = 16 bits is enough that the false-positive case
// is rare but reachable inside a 4-item insert; k = 3 keeps the per-op
// step count manageable for a learner walking each tick.
export const BLOOM_FILTER_M = 16;
export const BLOOM_FILTER_K = 3;

// The k hash functions, written out the same way the displayed Python
// snippet writes them. Keeping the array and the snippet in sync is
// what makes the codePanel's line-highlight track the right line as
// each bit gets set / checked.
const HASH_FUNCTIONS: readonly ((key: number, m: number) => number)[] = [
  (key, m) => (((key % m) + m) % m) | 0,
  (key, m) => ((((3 * key + 5) % m) + m) % m) | 0,
  (key, m) => ((((7 * key + 11) % m) + m) % m) | 0,
];

export function bloomFilterBitIndices(key: number, m: number): readonly number[] {
  return HASH_FUNCTIONS.map((h) => h(key, m));
}

export function emptyBloomFilter(m: number = BLOOM_FILTER_M): BloomFilterSnapshot {
  return { m, k: BLOOM_FILTER_K, bits: Array.from({ length: m }, () => 0) };
}

function snapshot(bits: readonly number[], m: number): BloomFilterSnapshot {
  // Copy the array so consumers can rely on snapshot identity for
  // step-replay safety.
  return { m, k: BLOOM_FILTER_K, bits: bits.slice() };
}

export function* bloomFilterInsertSequence(
  initial: BloomFilterSnapshot,
  keys: readonly number[],
): Generator<BloomFilterInsertStep> {
  const { m } = initial;
  const bits = initial.bits.slice();

  for (const key of keys) {
    yield {
      kind: "begin",
      table: snapshot(bits, m),
      insertingKey: key,
      codeLines: bloomFilterInsertLines.begin,
    };

    const bitIndices = bloomFilterBitIndices(key, m);
    yield {
      kind: "compute-hashes",
      table: snapshot(bits, m),
      insertingKey: key,
      bitIndices,
      codeLines: bloomFilterInsertLines.computeHashes,
    };

    for (let i = 0; i < bitIndices.length; i++) {
      const bitIndex = bitIndices[i];
      const alreadySet = bits[bitIndex] === 1;
      bits[bitIndex] = 1;
      yield {
        kind: "set-bit",
        table: snapshot(bits, m),
        insertingKey: key,
        hashIndex: i,
        bitIndex,
        alreadySet,
        codeLines: bloomFilterInsertLines.setBit[i],
      };
    }
  }

  yield {
    kind: "done",
    table: snapshot(bits, m),
    codeLines: bloomFilterInsertLines.done,
  };
}

export function* bloomFilterSearchSequence(
  initial: BloomFilterSnapshot,
  targets: readonly number[],
): Generator<BloomFilterSearchStep> {
  const { m, bits } = initial;

  for (const key of targets) {
    yield {
      kind: "begin",
      table: initial,
      targetKey: key,
      codeLines: bloomFilterSearchLines.begin,
    };

    const bitIndices = bloomFilterBitIndices(key, m);
    yield {
      kind: "compute-hashes",
      table: initial,
      targetKey: key,
      bitIndices,
      codeLines: bloomFilterSearchLines.computeHashes,
    };

    let missed = false;
    for (let i = 0; i < bitIndices.length; i++) {
      const bitIndex = bitIndices[i];
      const isSet = bits[bitIndex] === 1;
      yield {
        kind: "check-bit",
        table: initial,
        targetKey: key,
        hashIndex: i,
        bitIndex,
        isSet,
        codeLines: bloomFilterSearchLines.checkBit[i],
      };
      if (!isSet) {
        yield {
          kind: "miss",
          table: initial,
          targetKey: key,
          offBitIndex: bitIndex,
          codeLines: bloomFilterSearchLines.missAt[i],
        };
        missed = true;
        break;
      }
    }

    if (!missed) {
      yield {
        kind: "found",
        table: initial,
        targetKey: key,
        bitIndices,
        codeLines: bloomFilterSearchLines.found,
      };
    }
  }

  yield {
    kind: "done",
    table: initial,
    codeLines: bloomFilterSearchLines.done,
  };
}

export function buildBloomFilter(m: number, keys: readonly number[]): BloomFilterSnapshot {
  let final = emptyBloomFilter(m);
  for (const step of bloomFilterInsertSequence(final, keys)) {
    if (step.kind === "done") final = step.table;
  }
  return final;
}

// Pure-function contains: returns the boolean the algorithm would
// report. Used by tests as the oracle for "what would the algorithm
// say?" — including the false positives the viz makes pedagogical hay
// out of.
export function bloomFilterContains(table: BloomFilterSnapshot, key: number): boolean {
  for (const bitIndex of bloomFilterBitIndices(key, table.m)) {
    if (table.bits[bitIndex] !== 1) return false;
  }
  return true;
}

// Currently-set bit count. Useful for the "Bits set (of m)" counter,
// and for tests asserting bit-array saturation properties.
export function bloomFilterPopcount(table: BloomFilterSnapshot): number {
  let n = 0;
  for (const bit of table.bits) if (bit === 1) n++;
  return n;
}
