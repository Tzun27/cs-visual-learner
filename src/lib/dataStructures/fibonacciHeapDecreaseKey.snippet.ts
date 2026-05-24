export const fibonacciHeapDecreaseKeyPython = `def decrease_key(heap, node, new_value):
    if new_value > node.value:
        raise ValueError("new value greater than current")
    node.value = new_value
    p = node.parent
    if p is not None and node.value < p.value:
        cut(heap, node, p)
        cascading_cut(heap, p)
    if node.value < heap.min.value:
        heap.min = node

def cut(heap, x, p):
    p.children.remove(x)
    p.degree -= 1
    heap.roots.append(x)
    x.parent = None
    x.mark = False

def cascading_cut(heap, p):
    g = p.parent
    if g is None:
        return
    if not p.mark:
        p.mark = True
    else:
        cut(heap, p, g)
        cascading_cut(heap, g)
`;

export const fibonacciHeapDecreaseKeyLines = {
  begin: [1],
  setValue: [4],
  checkParent: [5, 6],
  noViolation: [9, 10],
  // cut step lands on the cut() body so the line tracks where the
  // child→root relinking happens.
  cut: [12, 13, 14, 15, 16, 17],
  // cascade-mark: parent was unmarked, mark it now (cascade stops).
  cascadeMark: [22, 23],
  updateMin: [9, 10],
  done: [10],
} as const;
