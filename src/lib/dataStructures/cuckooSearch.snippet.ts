export const cuckooSearchPython = `def search(TA, TB, key):
    if TA[h1(key)] == key:
        return TA[h1(key)]
    if TB[h2(key)] == key:
        return TB[h2(key)]
    return None
`;

export const cuckooSearchLines = {
  begin: [1],
  hash: [2, 4],
  checkA: [2],
  checkB: [4],
  foundA: [2, 3],
  foundB: [4, 5],
  miss: [6],
  done: [6],
} as const;
