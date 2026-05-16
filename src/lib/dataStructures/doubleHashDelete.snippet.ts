export const doubleHashDeletePython = `def remove(table, capacity, key):
    home = hash1(key) % capacity
    step = 1 + (hash2(key) % (capacity - 1))
    for i in range(capacity):
        slot = (home + i * step) % capacity
        if table[slot] is EMPTY:
            return  # not present
        if table[slot] == key:
            table[slot] = TOMBSTONE
            return
`;

export const doubleHashDeleteLines = {
  begin: [1],
  hash: [2, 3],
  probeOccupied: [5, 6, 8],
  probeTombstone: [5, 6, 8],
  found: [5, 8],
  tombstone: [5, 8, 9],
  miss: [6, 7],
  done: [10],
} as const;
