export const insertionSortPython = `def insertion_sort(arr):
    for i in range(1, len(arr)):
        j = i
        while j > 0 and arr[j - 1] > arr[j]:
            arr[j - 1], arr[j] = arr[j], arr[j - 1]
            j -= 1
    return arr
`;

export const insertionSortLines = {
  compare: [4],
  swap: [5, 6],
  done: [7],
} as const;
