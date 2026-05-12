export const heapDecreaseKeyPython = `def decrease_key(heap, i, new_value):
    assert new_value <= heap[i]
    heap[i] = new_value
    while i > 0:
        parent = (i - 1) // 2
        if heap[i] < heap[parent]:
            heap[i], heap[parent] = heap[parent], heap[i]
            i = parent
        else:
            break
    return heap
`;

export const heapDecreaseKeyLines = {
  begin: [1, 2],
  set: [3],
  compareParent: [5, 6],
  swapUp: [7, 8],
  settle: [9, 10],
  done: [11],
} as const;
