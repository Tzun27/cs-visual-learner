export const heapInsertPython = `def insert(heap, value):
    heap.append(value)
    i = len(heap) - 1
    while i > 0:
        parent = (i - 1) // 2
        if heap[i] < heap[parent]:
            heap[i], heap[parent] = heap[parent], heap[i]
            i = parent
        else:
            break
    return heap
`;

export const heapInsertLines = {
  begin: [1],
  append: [2, 3],
  compareParent: [5, 6],
  swapUp: [7, 8],
  settle: [9, 10],
  done: [11],
} as const;
