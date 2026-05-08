import type { BstSnapshot } from "@/lib/dataStructures/types";

export type TreeHighlightKind = "cursor" | "placed" | "duplicate";

export type TreeHighlight = {
  nodeId: number;
  kind: TreeHighlightKind;
};

export type TreeViewProps = {
  tree: BstSnapshot;
  highlights?: readonly TreeHighlight[];
  className?: string;
};

const NODE_RADIUS = 14;
const PADDING_X = 24;
const PADDING_Y = 24;
const VIEWBOX_WIDTH = 600;
const MIN_HEIGHT = 120;
// Row height shrinks as the tree gets deeper so the rendered SVG stays in a
// reasonable vertical budget. A depth-12 degenerate tree still fits.
const HEIGHT_BUDGET = 380;
const MAX_ROW_HEIGHT = 60;
const MIN_ROW_HEIGHT = 28;

function rowHeightFor(maxDepth: number): number {
  if (maxDepth <= 0) return MAX_ROW_HEIGHT;
  return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, HEIGHT_BUDGET / (maxDepth + 1)));
}

const palette: Record<TreeHighlightKind, { fill: string; stroke: string }> = {
  cursor: { fill: "var(--bar-compare)", stroke: "var(--bar-compare-stroke)" },
  placed: { fill: "var(--bar-swap)", stroke: "var(--bar-swap-stroke)" },
  duplicate: { fill: "var(--bar-pivot)", stroke: "var(--bar-pivot-stroke)" },
};

const kindLabel: Record<TreeHighlightKind, string> = {
  cursor: "being compared",
  placed: "just placed",
  duplicate: "duplicate match",
};

type Layout = {
  x: Map<number, number>;
  y: Map<number, number>;
  count: number;
  maxDepth: number;
};

function computeLayout(tree: BstSnapshot): Layout {
  const xRank = new Map<number, number>();
  const depth = new Map<number, number>();
  let order = 0;
  const visit = (id: number | null, d: number): void => {
    if (id === null) return;
    const node = tree.nodes[id];
    visit(node.leftId, d + 1);
    xRank.set(id, order++);
    depth.set(id, d);
    visit(node.rightId, d + 1);
  };
  visit(tree.rootId, 0);
  const count = order;
  const maxDepth = depth.size > 0 ? Math.max(...depth.values()) : 0;
  return { x: xRank, y: depth, count, maxDepth };
}

export function TreeView({ tree, highlights = [], className }: TreeViewProps) {
  const layout = computeLayout(tree);
  const { count, maxDepth } = layout;
  const rowHeight = rowHeightFor(maxDepth);
  const height = Math.max(MIN_HEIGHT, PADDING_Y * 2 + (maxDepth + 1) * rowHeight);
  const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
  const slotWidth = count > 0 ? innerWidth / count : innerWidth;

  const xOf = (id: number) => PADDING_X + (layout.x.get(id)! + 0.5) * slotWidth;
  const yOf = (id: number) => PADDING_Y + (layout.y.get(id)! + 0.5) * rowHeight;

  const highlightById = new Map<number, TreeHighlightKind>();
  for (const h of highlights) highlightById.set(h.nodeId, h.kind);

  const labelParts = highlights.map((h) => {
    const node = tree.nodes[h.nodeId];
    return node ? `node ${node.value} ${kindLabel[h.kind]}` : "";
  });
  const ariaLabel =
    count === 0
      ? "Empty tree"
      : labelParts.length
        ? `Binary search tree with ${count} nodes; ${labelParts.filter(Boolean).join("; ")}`
        : `Binary search tree with ${count} nodes`;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {/* edges first so they render under the node circles */}
      {tree.nodes.map((node) => {
        if (!layout.x.has(node.id)) return null;
        const px = xOf(node.id);
        const py = yOf(node.id);
        return (
          <g key={`edges-${node.id}`}>
            {node.leftId !== null && layout.x.has(node.leftId) && (
              <line
                x1={px}
                y1={py}
                x2={xOf(node.leftId)}
                y2={yOf(node.leftId)}
                stroke="var(--bar-default)"
                strokeWidth={1.5}
              />
            )}
            {node.rightId !== null && layout.x.has(node.rightId) && (
              <line
                x1={px}
                y1={py}
                x2={xOf(node.rightId)}
                y2={yOf(node.rightId)}
                stroke="var(--bar-default)"
                strokeWidth={1.5}
              />
            )}
          </g>
        );
      })}

      {tree.nodes.map((node) => {
        if (!layout.x.has(node.id)) return null;
        const cx = xOf(node.id);
        const cy = yOf(node.id);
        const kind = highlightById.get(node.id);
        const colors = kind ? palette[kind] : undefined;
        return (
          <g key={`node-${node.id}`}>
            <circle
              cx={cx}
              cy={cy}
              r={NODE_RADIUS}
              fill={colors?.fill ?? "var(--background)"}
              stroke={colors?.stroke ?? "var(--bar-default)"}
              strokeWidth={kind ? 2.5 : 1.5}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fontFamily="var(--font-mono), monospace"
              fill="var(--foreground)"
            >
              {node.value}
            </text>
            {kind === "placed" && (
              <circle
                cx={cx}
                cy={cy}
                r={NODE_RADIUS + 4}
                fill="none"
                stroke={colors?.stroke}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
