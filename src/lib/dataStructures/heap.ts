import { heapExtractMinLines } from "./heapExtractMin.snippet";
import { heapInsertLines } from "./heapInsert.snippet";
import type { BstSnapshot, HeapExtractStep, HeapInsertStep, HeapSnapshot } from "./types";

function snapshot(heap: readonly number[], size: number): HeapSnapshot {
  return { heap: heap.slice(0, size), size };
}

function parentIndex(i: number): number {
  return (i - 1) >> 1;
}

export function* heapInsertSequence(
  initial: readonly number[],
  values: readonly number[],
): Generator<HeapInsertStep> {
  const heap: number[] = [...initial];

  for (const value of values) {
    yield {
      kind: "begin",
      heap: snapshot(heap, heap.length),
      insertingValue: value,
      codeLines: heapInsertLines.begin,
    };

    heap.push(value);
    let cursor = heap.length - 1;
    yield {
      kind: "append",
      heap: snapshot(heap, heap.length),
      cursorIndex: cursor,
      insertingValue: value,
      codeLines: heapInsertLines.append,
    };

    while (cursor > 0) {
      const pIdx = parentIndex(cursor);
      yield {
        kind: "compare-parent",
        heap: snapshot(heap, heap.length),
        cursorIndex: cursor,
        parentIndex: pIdx,
        insertingValue: value,
        codeLines: heapInsertLines.compareParent,
      };
      if (heap[cursor] < heap[pIdx]) {
        [heap[cursor], heap[pIdx]] = [heap[pIdx], heap[cursor]];
        yield {
          kind: "swap-up",
          heap: snapshot(heap, heap.length),
          cursorIndex: pIdx,
          fromIndex: cursor,
          insertingValue: value,
          codeLines: heapInsertLines.swapUp,
        };
        cursor = pIdx;
      } else {
        yield {
          kind: "settle",
          heap: snapshot(heap, heap.length),
          cursorIndex: cursor,
          insertingValue: value,
          codeLines: heapInsertLines.settle,
        };
        break;
      }
    }

    if (cursor === 0) {
      yield {
        kind: "settle",
        heap: snapshot(heap, heap.length),
        cursorIndex: 0,
        insertingValue: value,
        codeLines: heapInsertLines.settle,
      };
    }
  }

  yield {
    kind: "done",
    heap: snapshot(heap, heap.length),
    codeLines: heapInsertLines.done,
  };
}

export function* heapExtractMinSequence(
  initial: readonly number[],
  count: number,
): Generator<HeapExtractStep> {
  const heap: number[] = [...initial];

  for (let extraction = 0; extraction < count; extraction++) {
    yield {
      kind: "begin",
      heap: snapshot(heap, heap.length),
      codeLines: heapExtractMinLines.begin,
    };

    if (heap.length === 0) {
      yield {
        kind: "empty",
        heap: snapshot(heap, heap.length),
        codeLines: heapExtractMinLines.empty,
      };
      continue;
    }

    const extractedValue = heap[0];
    yield {
      kind: "take-root",
      heap: snapshot(heap, heap.length),
      extractedValue,
      codeLines: heapExtractMinLines.takeRoot,
    };

    const last = heap.pop() as number;
    if (heap.length === 0) {
      // Single-element heap: pop already drained it.
      continue;
    }

    heap[0] = last;
    yield {
      kind: "move-last",
      heap: snapshot(heap, heap.length),
      cursorIndex: 0,
      extractedValue,
      codeLines: heapExtractMinLines.moveLast,
    };

    let cursor = 0;
    while (true) {
      const left = 2 * cursor + 1;
      const right = 2 * cursor + 2;
      if (left >= heap.length) {
        yield {
          kind: "settle",
          heap: snapshot(heap, heap.length),
          cursorIndex: cursor,
          extractedValue,
          codeLines: heapExtractMinLines.settle,
        };
        break;
      }
      let smallest = cursor;
      if (heap[left] < heap[smallest]) smallest = left;
      const hasRight = right < heap.length;
      if (hasRight && heap[right] < heap[smallest]) smallest = right;
      yield {
        kind: "compare-children",
        heap: snapshot(heap, heap.length),
        cursorIndex: cursor,
        leftIndex: left,
        rightIndex: hasRight ? right : null,
        smallerIndex: smallest,
        extractedValue,
        codeLines: heapExtractMinLines.compareChildren,
      };
      if (smallest === cursor) {
        yield {
          kind: "settle",
          heap: snapshot(heap, heap.length),
          cursorIndex: cursor,
          extractedValue,
          codeLines: heapExtractMinLines.settle,
        };
        break;
      }
      [heap[cursor], heap[smallest]] = [heap[smallest], heap[cursor]];
      yield {
        kind: "swap-down",
        heap: snapshot(heap, heap.length),
        cursorIndex: smallest,
        fromIndex: cursor,
        extractedValue,
        codeLines: heapExtractMinLines.swapDown,
      };
      cursor = smallest;
    }
  }

  yield {
    kind: "done",
    heap: snapshot(heap, heap.length),
    codeLines: heapExtractMinLines.done,
  };
}

export function buildHeap(values: readonly number[]): HeapSnapshot {
  let final: HeapSnapshot = { heap: [], size: 0 };
  for (const step of heapInsertSequence([], values)) {
    if (step.kind === "done") final = step.heap;
  }
  return final;
}

// Map the packed-array heap onto a BstSnapshot-shaped tree so TreeView can
// render it. Node ids equal heap indices, children at 2i+1 / 2i+2, root at 0.
// This is structural only — heap nodes do not satisfy the BST invariant.
export function heapToTree(snap: HeapSnapshot): BstSnapshot {
  const { heap, size } = snap;
  if (size === 0) return { nodes: [], rootId: null };
  const nodes = [];
  for (let i = 0; i < size; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    nodes.push({
      id: i,
      value: heap[i],
      leftId: left < size ? left : null,
      rightId: right < size ? right : null,
    });
  }
  return { nodes, rootId: 0 };
}

export function isMinHeap(snap: HeapSnapshot): boolean {
  const { heap, size } = snap;
  for (let i = 0; i < size; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < size && heap[left] < heap[i]) return false;
    if (right < size && heap[right] < heap[i]) return false;
  }
  return true;
}
