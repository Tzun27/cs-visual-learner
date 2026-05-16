export const doubleHashSearchPython = `def search(table, capacity, key):
    home = hash1(key) % capacity
    step = 1 + (hash2(key) % (capacity - 1))
    for i in range(capacity):
        slot = (home + i * step) % capacity
        if table[slot] is EMPTY:
            return False
        if table[slot] == key:
            return True
    return False
`;

export const doubleHashSearchLines = {
  begin: [1],
  hash: [2, 3],
  probeOccupied: [5, 6, 8],
  probeTombstone: [5, 6, 8],
  found: [5, 8, 9],
  miss: [6, 7],
  done: [10],
} as const;
