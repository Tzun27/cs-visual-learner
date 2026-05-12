export const hopscotchInsertPython = `def insert(table, capacity, H, key):
    home = hash(key) % capacity
    # Scan forward for any empty slot
    e = home
    while table[e] is not EMPTY:
        if table[e] == key:
            return  # duplicate, do not insert
        e = (e + 1) % capacity
    # If empty slot is within H of home, place directly
    while (e - home) % capacity >= H:
        # Find a slot j in [e-H+1, e-1] whose resident can move to e
        for j in range(1, H):
            cand = (e - j) % capacity
            if (e - table.home_of(cand)) % capacity < H:
                table[e] = table[cand]
                table[cand] = EMPTY
                e = cand
                break
        else:
            raise Exception("table full; rehash")
    table[e] = key
`;

export const hopscotchInsertLines = {
  begin: [1],
  hash: [2],
  scanProbe: [4, 5, 7], // walking the linear scan past an occupied non-match
  duplicate: [5, 6],
  swap: [8, 9, 10, 11, 12, 13, 14], // a successful swap iteration
  place: [16, 17],
  done: [17],
} as const;
