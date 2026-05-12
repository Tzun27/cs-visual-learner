export const robinHoodDeletePython = `def remove(table, capacity, key):
    i = hash(key) % capacity
    while table[i] is not EMPTY:
        if table[i] == key:
            j = (i + 1) % capacity
            while table[j] is not EMPTY and hash(table[j]) % capacity != j:
                table[i] = table[j]
                i = j
                j = (j + 1) % capacity
            table[i] = EMPTY
            return
        i = (i + 1) % capacity
`;

export const robinHoodDeleteLines = {
  begin: [1],
  hash: [2],
  probe: [3, 12],
  miss: [3],
  found: [4, 5],
  pull: [6, 7, 8, 9],
  clear: [10, 11],
  done: [11],
} as const;
