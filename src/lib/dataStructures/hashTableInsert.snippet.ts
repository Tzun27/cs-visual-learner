export const hashTableInsertPython = `def add(self, key):
    i = hash(key) % self.capacity
    bucket = self.buckets[i]
    for k in bucket:
        if k == key:
            return  # duplicate, skip
    bucket.append(key)
`;

export const hashTableInsertLines = {
  begin: [1],
  hash: [2, 3],
  probe: [4, 5],
  duplicate: [6],
  place: [7],
  done: [1],
} as const;
