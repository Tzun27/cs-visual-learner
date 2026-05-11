export const preorderPython = `def preorder(node):
    if node is None:
        return
    visit(node)          # emit root first
    preorder(node.left)
    preorder(node.right)
`;

export const preorderLines = {
  begin: [1],
  visit: [4],
  done: [1],
} as const;
