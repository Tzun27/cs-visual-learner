export const hashTableInsertPython = `def put(self, key, value):
    i = hash(key) % self.capacity
    bucket = self.buckets[i]
    for j, (k, v) in enumerate(bucket):
        if k == key:
            bucket[j] = (key, value)  # overwrite
            return
    bucket.append((key, value))
`;

export const hashTableInsertLines = {
  begin: [1],
  hash: [2, 3],
  probe: [4, 5],
  overwrite: [5, 6, 7],
  place: [8],
  done: [1],
} as const;
