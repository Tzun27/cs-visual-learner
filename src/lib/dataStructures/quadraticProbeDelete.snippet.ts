export const quadraticProbeDeletePython = `def remove(table, capacity, key):
    home = hash(key) % capacity
    for i in range(capacity):
        slot = (home + i * i) % capacity
        if table[slot] is EMPTY:
            return  # not present
        if table[slot] == key:
            table[slot] = TOMBSTONE
            return
`;

export const quadraticProbeDeleteLines = {
  begin: [1],
  hash: [2],
  probeOccupied: [4, 5, 7],
  probeTombstone: [4, 5, 7],
  found: [4, 7],
  tombstone: [4, 7, 8],
  miss: [5, 6],
  done: [9],
} as const;
