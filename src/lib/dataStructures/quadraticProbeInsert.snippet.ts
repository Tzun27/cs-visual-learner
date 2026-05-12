export const quadraticProbeInsertPython = `def insert(table, capacity, key):
    home = hash(key) % capacity
    for i in range(capacity):
        slot = (home + i * i) % capacity
        if table[slot] is EMPTY:
            table[slot] = key
            return
        if table[slot] == key:
            return  # duplicate, do not insert
    raise Exception("no slot available")
`;

// The probe step covers both "occupied with non-matching key" and
// "tombstone" — same lines reached, same `is EMPTY` / `== key` checks fall
// through to the next iteration.
export const quadraticProbeInsertLines = {
  begin: [1],
  hash: [2],
  probeOccupied: [4, 5, 8],
  probeTombstone: [4, 5, 8],
  duplicate: [4, 8, 9],
  place: [4, 5, 6],
  done: [7],
} as const;
