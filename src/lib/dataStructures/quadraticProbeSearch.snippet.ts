export const quadraticProbeSearchPython = `def search(table, capacity, key):
    home = hash(key) % capacity
    for i in range(capacity):
        slot = (home + i * i) % capacity
        if table[slot] is EMPTY:
            return False
        if table[slot] == key:
            return True
    return False
`;

export const quadraticProbeSearchLines = {
  begin: [1],
  hash: [2],
  probeOccupied: [4, 5, 7],
  probeTombstone: [4, 5, 7],
  found: [4, 7, 8],
  miss: [5, 6],
  done: [9],
} as const;
