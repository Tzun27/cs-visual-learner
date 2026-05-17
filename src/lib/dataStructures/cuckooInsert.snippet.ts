export const cuckooInsertPython = `def insert(TA, TB, key, MAX=8):
    a, b = h1(key), h2(key)
    if TA[a] == key:
        return  # duplicate in T_A
    if TB[b] == key:
        return  # duplicate in T_B
    cur, side = key, "A"
    for _ in range(MAX):
        slot = h1(cur) if side == "A" else h2(cur)
        T = TA if side == "A" else TB
        if T[slot] is EMPTY:
            T[slot] = cur
            return
        cur, T[slot] = T[slot], cur
        side = "B" if side == "A" else "A"
    raise Exception("cycle - rehash needed")
`;

export const cuckooInsertLines = {
  begin: [1],
  hash: [2],
  dedupCheckA: [3],
  dedupCheckB: [5],
  duplicateA: [3, 4],
  duplicateB: [5, 6],
  check: [9, 10, 11],
  place: [11, 12, 13],
  evict: [14, 15],
  cycle: [16],
  done: [13],
} as const;
