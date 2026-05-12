export const linearProbeDeletePython = `def remove(table, capacity, key):
    i = hash(key) % capacity
    while table[i] is not EMPTY:
        if table[i] == key:
            table[i] = TOMBSTONE
            return
        i = (i + 1) % capacity
`;

export const linearProbeDeleteLines = {
  begin: [1],
  hash: [2],
  probeOccupied: [3, 4, 7],
  probeTombstone: [3, 4, 7],
  found: [4],
  tombstone: [5, 6],
  miss: [3],
  done: [6],
} as const;
