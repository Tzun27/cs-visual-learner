export const radixSortPython = `def radix_sort(arr):
    if not arr:
        return arr
    max_val = max(arr)
    exp = 1
    while max_val // exp > 0:
        # bucket pass for current digit
        buckets = [[] for _ in range(10)]
        for v in arr:
            digit = (v // exp) % 10
            buckets[digit].append(v)
        # write back, in bucket order
        pos = 0
        for bucket in buckets:
            for v in bucket:
                arr[pos] = v
                pos += 1
        exp *= 10
    return arr
`;

export const radixSortLines = {
  range: [9, 10, 11],
  write: [16, 17],
  done: [19],
} as const;
