export const postorderPython = `def postorder(node):
    if node is None:
        return
    postorder(node.left)
    postorder(node.right)
    visit(node)          # emit root last
`;

export const postorderLines = {
  begin: [1],
  visit: [5],
  done: [1],
} as const;
