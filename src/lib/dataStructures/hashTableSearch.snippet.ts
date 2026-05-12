export const hashTableSearchPython = `def get(self, key):
    i = hash(key) % self.capacity
    bucket = self.buckets[i]
    for k, v in bucket:
        if k == key:
            return v
    return None
`;

export const hashTableSearchLines = {
  begin: [1],
  hash: [2, 3],
  probe: [4, 5],
  found: [5, 6],
  miss: [7],
  done: [1],
} as const;
