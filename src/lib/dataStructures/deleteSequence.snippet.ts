export const bstDeletePython = `def delete(root, target):
    if root is None:
        return None  # miss
    if target < root.value:
        root.left = delete(root.left, target)
    elif target > root.value:
        root.right = delete(root.right, target)
    else:
        # found target — pick a strategy by child count
        if root.left is None:
            return root.right
        if root.right is None:
            return root.left
        # two children: copy inorder successor, then delete it
        successor = root.right
        while successor.left is not None:
            successor = successor.left
        root.value = successor.value
        root.right = delete(root.right, successor.value)
    return root
`;

export const bstDeleteLines = {
  begin: [1],
  compareLeft: [4, 5],
  compareRight: [6, 7],
  compareEqual: [8],
  foundLeaf: [10, 11],
  foundOneChild: [10, 11, 12, 13],
  foundTwoChildren: [14, 15],
  findSuccessor: [16, 17],
  swapValue: [18],
  unlinkSimple: [10, 11, 12, 13],
  unlinkRecursive: [19],
  miss: [2, 3],
  done: [20],
} as const;
