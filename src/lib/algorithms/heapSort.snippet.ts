export const heapSortPython = `def heap_sort(arr):
    n = len(arr)
    # build a max-heap
    for i in range(n // 2 - 1, -1, -1):
        sift_down(arr, i, n - 1)
    # extract the max repeatedly
    for end in range(n - 1, 0, -1):
        arr[0], arr[end] = arr[end], arr[0]
        sift_down(arr, 0, end - 1)
    return arr


def sift_down(arr, start, end):
    root = start
    while root * 2 + 1 <= end:
        left = root * 2 + 1
        right = root * 2 + 2
        larger = root
        if arr[left] > arr[larger]:
            larger = left
        if right <= end and arr[right] > arr[larger]:
            larger = right
        if larger == root:
            break
        arr[root], arr[larger] = arr[larger], arr[root]
        root = larger
`;

export const heapSortLines = {
  buildRange: [4, 5],
  extractRange: [9],
  extractSwap: [8],
  compareLeft: [19, 20],
  compareRight: [21, 22],
  siftSwap: [25, 26],
  done: [10],
} as const;
