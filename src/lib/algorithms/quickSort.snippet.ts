export const quickSortPython = `def quick_sort(arr):
    _sort(arr, 0, len(arr) - 1)
    return arr


def _sort(arr, lo, hi):
    if lo >= hi:
        return
    p = partition(arr, lo, hi)
    _sort(arr, lo, p - 1)
    _sort(arr, p + 1, hi)


def partition(arr, lo, hi):
    pivot = arr[hi]
    i = lo
    for j in range(lo, hi):
        if arr[j] <= pivot:
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
    arr[i], arr[hi] = arr[hi], arr[i]
    return i
`;

export const quickSortLines = {
  range: [9],
  pivot: [15],
  compare: [18],
  swapLoop: [19, 20],
  swapPivot: [21],
  done: [3],
} as const;
