export const cuckooFilterDeletePython = `def delete(table, capacity, key):
    fp = fingerprint(key)
    h1 = hash(key) % capacity
    alt = h1 ^ hash_fp(fp)
    if table[h1] == fp:
        table[h1] = EMPTY
        return True
    if table[alt] == fp:
        table[alt] = EMPTY
        return True
    return False
`;

export const cuckooFilterDeleteLines = {
  begin: [1],
  fingerprint: [2],
  hash: [3, 4],
  checkHome: [5],
  foundHome: [5],
  removeHome: [5, 6, 7],
  checkAlt: [8],
  foundAlt: [8],
  removeAlt: [8, 9, 10],
  miss: [11],
  done: [11],
} as const;
