export const hopscotchSearchPython = `def search(table, capacity, H, key):
    home = hash(key) % capacity
    mask = table.hop_info(home)
    for j in range(H):
        if mask & (1 << j):
            if table[(home + j) % capacity] == key:
                return True
    return False
`;

export const hopscotchSearchLines = {
  begin: [1],
  hash: [2, 3],
  checkSet: [4, 5, 6, 7], // bit set; equality test runs
  checkClear: [4, 5], // bit not set; skip
  found: [6, 7],
  miss: [8],
  done: [8],
} as const;
