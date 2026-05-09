export const mergeSortPython = `def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    _sort(arr, 0, len(arr) - 1)
    return arr


def _sort(arr, lo, hi):
    if lo >= hi:
        return
    mid = (lo + hi) // 2
    _sort(arr, lo, mid)
    _sort(arr, mid + 1, hi)
    merge(arr, lo, mid, hi)


def merge(arr, lo, mid, hi):
    aux = arr[lo:hi + 1]
    i, j, k = 0, mid + 1 - lo, lo

    while i <= mid - lo and j <= hi - lo:
        if aux[i] <= aux[j]:
            arr[k] = aux[i]
            i += 1
        else:
            arr[k] = aux[j]
            j += 1
        k += 1

    while i <= mid - lo:
        arr[k] = aux[i]
        i += 1
        k += 1

    while j <= hi - lo:
        arr[k] = aux[j]
        j += 1
        k += 1
`;

export const mergeSortLines = {
  done: [5],
  mergeEntry: [17, 18, 19],
  compare: [22],
  writeI: [23, 24],
  writeJ: [26, 27],
  drainI: [31, 32],
  drainJ: [36, 37],
} as const;
