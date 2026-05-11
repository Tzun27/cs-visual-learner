export const hashTableSearchPython = `def contains(self, key):
    i = hash(key) % self.capacity
    bucket = self.buckets[i]
    for k in bucket:
        if k == key:
            return True
    return False
`;

export const hashTableSearchLines = {
  begin: [1],
  hash: [2, 3],
  probe: [4, 5],
  found: [6],
  miss: [7],
  done: [1],
} as const;
