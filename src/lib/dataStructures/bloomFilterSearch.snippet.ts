export const bloomFilterSearchPython = `def contains(table, m, key):
    b1 = key % m
    b2 = (3 * key + 5) % m
    b3 = (7 * key + 11) % m
    if table[b1] == 0:
        return False
    if table[b2] == 0:
        return False
    if table[b3] == 0:
        return False
    return True
`;

export const bloomFilterSearchLines = {
  begin: [1],
  computeHashes: [2, 3, 4],
  // Per-bit check ops. checkBit[i] is the `if table[bN] == 0:` line for
  // hash i; missAt[i] is the matching `return False` line that fires
  // when that check short-circuits.
  checkBit: [[5], [7], [9]] as const,
  missAt: [
    [5, 6],
    [7, 8],
    [9, 10],
  ] as const,
  found: [11],
  done: [11],
} as const;
