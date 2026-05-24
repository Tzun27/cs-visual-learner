export const fibonacciHeapExtractMinPython = `def extract_min(heap):
    z = heap.min
    if z is None:
        return None
    for child in z.children:
        child.parent = None
        heap.roots.append(child)
    heap.roots.remove(z)
    consolidate(heap)
    return z.value

def consolidate(heap):
    buckets = {}
    for w in list(heap.roots):
        x = w
        d = x.degree
        while d in buckets:
            y = buckets[d]
            if x.value > y.value:
                x, y = y, x
            link(heap, y, x)
            del buckets[d]
            d += 1
        buckets[d] = x
    heap.min = min(heap.roots, key=lambda r: r.value, default=None)
`;

export const fibonacciHeapExtractMinLines = {
  begin: [1],
  empty: [3, 4],
  // remove-min covers detaching children + removing z from the root
  // list, since the viz collapses both into one snapshot.
  removeMin: [5, 6, 7, 8],
  // consolidate-start lands on the bucket-init line so the user sees
  // where the pass begins.
  consolidateStart: [11, 12],
  // Each consolidate-inspect step lands on the "for w in roots" line —
  // the cursor is the root being examined.
  consolidateInspect: [13, 14, 15],
  // consolidate-pair fires when the while-loop body executes: a
  // matching degree was found in buckets.
  consolidatePair: [16, 17, 18, 19],
  // consolidate-link is the link() call + degree-array maintenance.
  consolidateLink: [20, 21, 22],
  // update-min walks the final root list and picks the smallest.
  updateMin: [24],
  done: [9],
} as const;
