export const bstInsertPython = `class Node:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None


def insert(root, value):
    if root is None:
        return Node(value)
    if value < root.value:
        root.left = insert(root.left, value)
    elif value > root.value:
        root.right = insert(root.right, value)
    # value == root.value: duplicate, ignore
    return root
`;

export const bstInsertLines = {
  begin: [8],
  compareLeft: [11, 12],
  compareRight: [13, 14],
  duplicate: [15],
  place: [9, 10],
  done: [16],
} as const;
