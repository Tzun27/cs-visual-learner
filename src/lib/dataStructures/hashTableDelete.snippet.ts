export const hashTableDeletePython = `def remove(self, key):
    i = hash(key) % self.capacity
    bucket = self.buckets[i]
    for j, (k, v) in enumerate(bucket):
        if k == key:
            bucket.pop(j)
            return True
    return False
`;

export const hashTableDeleteLines = {
  begin: [1],
  hash: [2, 3],
  probe: [4, 5],
  found: [5],
  unlink: [6, 7],
  miss: [8],
  done: [1],
} as const;
