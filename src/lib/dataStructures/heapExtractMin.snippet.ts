export const heapExtractMinPython = `def extract_min(heap):
    if not heap:
        return None
    min_value = heap[0]
    last = heap.pop()
    if heap:
        heap[0] = last
        i = 0
        while True:
            left = 2 * i + 1
            right = 2 * i + 2
            smallest = i
            if left < len(heap) and heap[left] < heap[smallest]:
                smallest = left
            if right < len(heap) and heap[right] < heap[smallest]:
                smallest = right
            if smallest == i:
                break
            heap[i], heap[smallest] = heap[smallest], heap[i]
            i = smallest
    return min_value
`;

export const heapExtractMinLines = {
  begin: [1],
  empty: [2, 3],
  takeRoot: [4],
  moveLast: [5, 6, 7, 8],
  compareChildren: [13, 14, 15, 16],
  swapDown: [19, 20],
  settle: [17, 18],
  done: [21],
} as const;
