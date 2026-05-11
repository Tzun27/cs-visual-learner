export const inorderPython = `def inorder(node):
    if node is None:
        return
    inorder(node.left)
    visit(node)          # emit root between subtrees
    inorder(node.right)
`;

export const inorderLines = {
  begin: [1],
  visit: [4],
  done: [1],
} as const;
