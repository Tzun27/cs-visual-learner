export const cuckooFilterInsertPython = `def insert(table, capacity, key, MAX=8):
    fp = fingerprint(key)
    h1 = hash(key) % capacity
    alt = h1 ^ hash_fp(fp)
    if table[h1] is EMPTY:
        table[h1] = fp
        return
    if table[alt] is EMPTY:
        table[alt] = fp
        return
    cur = h1
    for _ in range(MAX):
        fp, table[cur] = table[cur], fp
        cur = cur ^ hash_fp(fp)
        if table[cur] is EMPTY:
            table[cur] = fp
            return
    raise Exception("cycle - rehash needed")
`;

export const cuckooFilterInsertLines = {
  begin: [1],
  fingerprint: [2],
  hash: [3, 4],
  checkHome: [5],
  placeHome: [5, 6, 7],
  checkAlt: [8],
  placeAlt: [8, 9, 10],
  // Cascade eviction: swap fp into cur, recompute cur via XOR trick.
  evict: [13, 14],
  checkCascade: [15],
  placeCascade: [15, 16, 17],
  cycle: [18],
  done: [7],
} as const;
