export const levelOrderPython = `def level_order(root):
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            continue
        visit(node)
        queue.append(node.left)
        queue.append(node.right)
`;

export const levelOrderLines = {
  begin: [1, 2],
  visit: [4, 7],
  done: [1],
} as const;
