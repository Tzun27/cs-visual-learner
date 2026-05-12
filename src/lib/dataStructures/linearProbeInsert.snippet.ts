export const linearProbeInsertPython = `def insert(table, capacity, key):
    i = hash(key) % capacity
    while table[i] is not EMPTY:
        if table[i] == key:
            return  # duplicate, do not insert
        i = (i + 1) % capacity
    table[i] = key
`;

// Per-branch line maps. The probe step covers either "slot occupied with
// non-matching key" or "slot is a tombstone" — both reach the same lines
// because `table[i] == key` returns False for the tombstone sentinel.
export const linearProbeInsertLines = {
  begin: [1],
  hash: [2],
  probeOccupied: [3, 4, 6],
  probeTombstone: [3, 4, 6],
  duplicate: [4, 5],
  place: [3, 7],
  done: [7],
} as const;
