export const linearProbeSearchPython = `def contains(table, capacity, key):
    i = hash(key) % capacity
    while table[i] is not EMPTY:
        if table[i] == key:
            return True
        i = (i + 1) % capacity
    return False
`;

export const linearProbeSearchLines = {
  begin: [1],
  hash: [2],
  probeOccupied: [3, 4, 6],
  probeTombstone: [3, 4, 6],
  found: [4, 5],
  miss: [3, 7],
  done: [5, 7],
} as const;
