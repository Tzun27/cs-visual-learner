export const pairingHeapMergePython = `def merge(a, b):
    if a is None: return b
    if b is None: return a
    if a.value <= b.value:
        b.next_sibling = a.first_child
        a.first_child = b
        return a
    else:
        a.next_sibling = b.first_child
        b.first_child = a
        return b
`;

export const pairingHeapMergeLines = {
  begin: [1],
  emptyA: [2],
  emptyB: [3],
  compareRoots: [4, 8],
  linkAFirst: [5, 6, 7],
  linkBFirst: [9, 10, 11],
  done: [7],
} as const;
