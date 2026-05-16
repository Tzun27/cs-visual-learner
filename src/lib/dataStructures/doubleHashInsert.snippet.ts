export const doubleHashInsertPython = `def insert(table, capacity, key):
    home = hash1(key) % capacity
    step = 1 + (hash2(key) % (capacity - 1))
    for i in range(capacity):
        slot = (home + i * step) % capacity
        if table[slot] is EMPTY:
            table[slot] = key
            return
        if table[slot] == key:
            return  # duplicate, do not insert
    raise Exception("no slot available")
`;

// The probe step covers both "occupied with non-matching key" and
// "tombstone" — same lines reached, both fall through to the next iteration.
export const doubleHashInsertLines = {
  begin: [1],
  hash: [2, 3],
  probeOccupied: [5, 6, 9],
  probeTombstone: [5, 6, 9],
  duplicate: [5, 9, 10],
  place: [5, 6, 7],
  done: [8],
} as const;
