export const cuckooDeletePython = `def delete(TA, TB, key):
    if TA[h1(key)] == key:
        TA[h1(key)] = EMPTY
        return
    if TB[h2(key)] == key:
        TB[h2(key)] = EMPTY
        return
    # key not in table — nothing to remove
`;

export const cuckooDeleteLines = {
  begin: [1],
  hash: [2, 5],
  checkA: [2],
  checkB: [5],
  foundA: [2, 3],
  foundB: [5, 6],
  removeA: [3, 4],
  removeB: [6, 7],
  miss: [8],
  done: [8],
} as const;
