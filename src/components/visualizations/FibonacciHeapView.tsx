import type { FibonacciHeapSnapshot } from "@/lib/dataStructures/types";

export type FibonacciHeapNodeKind = "cursor" | "placed" | "duplicate" | "removed";

export type FibonacciHeapHighlight = {
  readonly nodeId: number;
  readonly kind: FibonacciHeapNodeKind;
};

export type FibonacciHeapViewProps = {
  heap: FibonacciHeapSnapshot;
  highlights?: readonly FibonacciHeapHighlight[];
  className?: string;
};

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 320;
const PADDING_X = 20;
const PADDING_Y = 24;
const LEVEL_HEIGHT = 60;
const NODE_RADIUS = 20;
const TREE_GAP_SLOTS = 1;

const palette: Record<FibonacciHeapNodeKind, { fill: string; stroke: string; text: string }> = {
  cursor: {
    fill: "var(--bar-compare)",
    stroke: "var(--bar-compare-stroke)",
    text: "var(--foreground)",
  },
  placed: {
    fill: "var(--bar-swap)",
    stroke: "var(--bar-swap-stroke)",
    text: "var(--foreground)",
  },
  duplicate: {
    fill: "var(--bar-pivot)",
    stroke: "var(--bar-pivot-stroke)",
    text: "var(--foreground)",
  },
  removed: {
    fill: "transparent",
    stroke: "var(--bar-default)",
    text: "var(--bar-default)",
  },
};

const kindLabel: Record<FibonacciHeapNodeKind, string> = {
  cursor: "being inspected",
  placed: "linked",
  duplicate: "matched",
  removed: "removed",
};

function leafCount(snap: FibonacciHeapSnapshot, id: number): number {
  const node = snap.nodes[id];
  let total = 0;
  let child = node.firstChildId;
  while (child !== null) {
    total += leafCount(snap, child);
    child = snap.nodes[child].nextSiblingId;
  }
  return total === 0 ? 1 : total;
}

export function FibonacciHeapView({ heap, highlights = [], className }: FibonacciHeapViewProps) {
  const { nodes, roots, minId } = heap;
  const highlightById = new Map<number, FibonacciHeapNodeKind>();
  for (const h of highlights) highlightById.set(h.nodeId, h.kind);

  const positions = new Map<number, { x: number; y: number }>();
  if (roots.length > 0) {
    const totalWidthSlots =
      roots.map((id) => leafCount(heap, id)).reduce((a, b) => a + b, 0) +
      TREE_GAP_SLOTS * Math.max(0, roots.length - 1);
    const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
    const slotWidth = innerWidth / totalWidthSlots;
    let cursorSlot = 0;
    for (const rootId of roots) {
      positionTree(rootId, cursorSlot, 0);
      cursorSlot += leafCount(heap, rootId) + TREE_GAP_SLOTS;
    }

    function positionTree(id: number, leftSlot: number, depth: number): void {
      const node = nodes[id];
      const myLeaves = leafCount(heap, id);
      const x = PADDING_X + (leftSlot + myLeaves / 2) * slotWidth;
      const y = PADDING_Y + depth * LEVEL_HEIGHT;
      positions.set(id, { x, y });
      let curChild: number | null = node.firstChildId;
      let cursor = leftSlot;
      while (curChild !== null) {
        const childLeaves = leafCount(heap, curChild);
        positionTree(curChild, cursor, depth + 1);
        cursor += childLeaves;
        curChild = nodes[curChild].nextSiblingId;
      }
    }
  }

  const labelParts: string[] = [];
  for (const h of highlights) {
    const node = nodes[h.nodeId];
    if (node) labelParts.push(`node ${node.value} ${kindLabel[h.kind]}`);
  }
  const liveCount = positions.size;
  const ariaLabel =
    liveCount === 0
      ? "Empty Fibonacci heap"
      : labelParts.length
        ? `Fibonacci heap with ${liveCount} nodes across ${roots.length} root${roots.length === 1 ? "" : "s"}; ${labelParts.join("; ")}`
        : `Fibonacci heap with ${liveCount} nodes across ${roots.length} root${roots.length === 1 ? "" : "s"}`;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {liveCount === 0 && (
        <text
          x={VIEWBOX_WIDTH / 2}
          y={VIEWBOX_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={14}
          fill="var(--bar-default)"
        >
          (empty heap)
        </text>
      )}

      {/* parent → child edges */}
      {Array.from(positions.entries()).flatMap(([id, parentPos]) => {
        const edges = [];
        let curChild: number | null = nodes[id].firstChildId;
        while (curChild !== null) {
          const childPos = positions.get(curChild);
          if (childPos) {
            edges.push(
              <line
                key={`edge-${id}-${curChild}`}
                x1={parentPos.x}
                y1={parentPos.y + NODE_RADIUS}
                x2={childPos.x}
                y2={childPos.y - NODE_RADIUS}
                stroke="var(--bar-default)"
                strokeWidth={1.5}
              />,
            );
          }
          curChild = nodes[curChild].nextSiblingId;
        }
        return edges;
      })}

      {/* nodes */}
      {Array.from(positions.entries()).map(([id, pos]) => {
        const kind = highlightById.get(id);
        const colors = kind
          ? palette[kind]
          : { fill: "var(--background)", stroke: "var(--bar-default)", text: "var(--foreground)" };
        const node = nodes[id];
        const isMin = id === minId;
        return (
          <g key={`node-${id}`}>
            {/* min pointer ring: an outer dashed ring on the current min root */}
            {isMin && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={NODE_RADIUS + 5}
                fill="none"
                stroke="var(--bar-swap-stroke)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={NODE_RADIUS}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={kind ? 2.5 : 1.5}
              strokeDasharray={kind === "removed" ? "3 3" : undefined}
            />
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-mono), monospace"
              fontSize={14}
              fontWeight={isMin ? 700 : 400}
              fill={colors.text}
              style={{ textDecoration: kind === "removed" ? "line-through" : undefined }}
            >
              {node.value}
            </text>
            {/* mark badge: small filled circle in the upper-right corner */}
            {node.mark && (
              <>
                <circle
                  cx={pos.x + NODE_RADIUS * 0.7}
                  cy={pos.y - NODE_RADIUS * 0.7}
                  r={5}
                  fill="var(--bar-pivot)"
                  stroke="var(--bar-pivot-stroke)"
                  strokeWidth={1}
                />
                <title>marked (lost a child since becoming a non-root)</title>
              </>
            )}
            {/* degree badge: lower-right corner, only for non-leaves so the
                viz doesn't get noisy. */}
            {node.degree > 0 && (
              <text
                x={pos.x + NODE_RADIUS * 0.85}
                y={pos.y + NODE_RADIUS * 0.85}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontFamily="var(--font-mono), monospace"
                fill="var(--bar-default-stroke)"
                fillOpacity={0.8}
              >
                d{node.degree}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
