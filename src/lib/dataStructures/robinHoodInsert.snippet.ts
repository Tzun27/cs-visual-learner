export const robinHoodInsertPython = `def insert(table, capacity, key):
    i = hash(key) % capacity
    probe = 0
    while table[i] is not EMPTY:
        existing = table[i]
        if existing == key:
            return  # duplicate
        existing_home = hash(existing) % capacity
        existing_probe = (i - existing_home) % capacity
        if probe > existing_probe:
            table[i] = key      # rob from the rich
            key = existing      # give to the poor
            probe = existing_probe
        i = (i + 1) % capacity
        probe += 1
    table[i] = key
`;

export const robinHoodInsertLines = {
  begin: [1],
  hash: [2, 3],
  duplicate: [5, 6, 7],
  compareDisplacement: [8, 9, 10],
  swap: [11, 12, 13],
  probe: [14, 15],
  place: [16],
  done: [16],
} as const;
