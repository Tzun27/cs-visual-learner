export const fibonacciHeapInsertPython = `def insert(heap, value):
    node = Node(value)
    heap.roots.prepend(node)
    if heap.min is None or value < heap.min.value:
        heap.min = node
`;

export const fibonacciHeapInsertLines = {
  begin: [1],
  // Both the prepend and the min-update are visualized as one
  // "add-root" step, so its highlight covers all three lines.
  addRoot: [2, 3, 4, 5],
  done: [5],
} as const;
