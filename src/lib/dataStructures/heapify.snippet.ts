export const heapifyPython = `def heapify(arr):
    n = len(arr)
    for i in range(n // 2 - 1, -1, -1):
        sift_down(arr, i, n - 1)
    return arr


def sift_down(arr, start, end):
    root = start
    while root * 2 + 1 <= end:
        left = root * 2 + 1
        right = root * 2 + 2
        smallest = root
        if arr[left] < arr[smallest]:
            smallest = left
        if right <= end and arr[right] < arr[smallest]:
            smallest = right
        if smallest == root:
            break
        arr[root], arr[smallest] = arr[smallest], arr[root]
        root = smallest
`;

export const heapifyLines = {
  begin: [1, 2],
  startSift: [3, 4, 8],
  compareChildren: [12, 13, 14, 15],
  swapDown: [18, 19],
  settle: [16, 17],
  done: [5],
} as const;
