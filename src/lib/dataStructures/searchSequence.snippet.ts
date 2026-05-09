export const bstSearchPython = `def search(root, target):
    if root is None:
        return None  # miss
    if target == root.value:
        return root  # found
    if target < root.value:
        return search(root.left, target)
    else:
        return search(root.right, target)
`;

export const bstSearchLines = {
  begin: [1],
  compareEqual: [4],
  compareLeft: [6, 7],
  compareRight: [8, 9],
  found: [4, 5],
  miss: [2, 3],
  done: [1],
} as const;
