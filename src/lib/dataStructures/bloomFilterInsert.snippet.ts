export const bloomFilterInsertPython = `def insert(table, m, key):
    b1 = key % m
    b2 = (3 * key + 5) % m
    b3 = (7 * key + 11) % m
    table[b1] = 1
    table[b2] = 1
    table[b3] = 1
`;

export const bloomFilterInsertLines = {
  begin: [1],
  // The three hash function computations are presented as a single
  // block since the generator emits them as one `compute-hashes` step.
  computeHashes: [2, 3, 4],
  // Per-bit set ops: indexed by hashIndex (0 → line 5, etc.) so the
  // cursor lands on the matching `table[bN] = 1` line each tick.
  setBit: [[5], [6], [7]] as const,
  done: [7],
} as const;
