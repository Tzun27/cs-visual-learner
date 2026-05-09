export const bubbleSortPython = `def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
`;

export const bubbleSortLines = {
  compare: [5],
  swap: [6],
  done: [7],
} as const;
