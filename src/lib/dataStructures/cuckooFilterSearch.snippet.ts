export const cuckooFilterSearchPython = `def contains(table, capacity, key):
    fp = fingerprint(key)
    h1 = hash(key) % capacity
    alt = h1 ^ hash_fp(fp)
    if table[h1] == fp:
        return True
    if table[alt] == fp:
        return True
    return False
`;

export const cuckooFilterSearchLines = {
  begin: [1],
  fingerprint: [2],
  hash: [3, 4],
  checkHome: [5],
  foundHome: [5, 6],
  checkAlt: [7],
  foundAlt: [7, 8],
  miss: [9],
  done: [9],
} as const;
