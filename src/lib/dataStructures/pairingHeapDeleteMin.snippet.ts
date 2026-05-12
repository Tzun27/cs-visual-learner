export const pairingHeapDeleteMinPython = `def delete_min(root):
    if root is None: return None
    children = collect_children(root)  # list, left to right
    # Pass 1: pair-merge from left to right
    pairs = []
    i = 0
    while i + 1 < len(children):
        pairs.append(merge(children[i], children[i + 1]))
        i += 2
    if i < len(children):
        pairs.append(children[i])
    # Pass 2: fold right to left
    result = pairs[-1] if pairs else None
    for j in range(len(pairs) - 2, -1, -1):
        result = merge(pairs[j], result)
    return result
`;

export const pairingHeapDeleteMinLines = {
  begin: [1],
  emptyHeap: [2],
  removeRoot: [3],
  pairStart: [7, 8],
  pairLink: [8, 9],
  fold: [12, 13, 14],
  foldLink: [14],
  done: [15],
} as const;
