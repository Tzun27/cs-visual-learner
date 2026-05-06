export type HighlightKind = "compare" | "swap" | "pivot" | "sorted";

export type Highlight = {
  index: number;
  kind: HighlightKind;
};

export type ArrayBarsProps = {
  array: readonly number[];
  highlights?: readonly Highlight[];
  max?: number;
  className?: string;
};

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 240;
const PADDING = 8;
const GAP = 1;

const palette: Record<HighlightKind, { fill: string; stroke: string }> = {
  compare: { fill: "var(--bar-compare)", stroke: "var(--bar-compare-stroke)" },
  swap: { fill: "var(--bar-swap)", stroke: "var(--bar-swap-stroke)" },
  pivot: { fill: "var(--bar-pivot)", stroke: "var(--bar-pivot-stroke)" },
  sorted: { fill: "var(--bar-sorted)", stroke: "var(--bar-sorted-stroke)" },
};

const kindLabel: Record<HighlightKind, string> = {
  compare: "being compared",
  swap: "being swapped",
  pivot: "pivot",
  sorted: "in final sorted position",
};

export function ArrayBars({ array, highlights = [], max, className }: ArrayBarsProps) {
  const length = array.length;
  if (length === 0) {
    return (
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className={className}
        role="img"
        aria-label="Empty array"
      />
    );
  }

  const effectiveMax = max ?? Math.max(...array, 1);
  const innerWidth = VIEWBOX_WIDTH - PADDING * 2;
  const innerHeight = VIEWBOX_HEIGHT - PADDING * 2;
  const barWidth = (innerWidth - GAP * (length - 1)) / length;

  const highlightByIndex = new Map<number, HighlightKind>();
  for (const h of highlights) highlightByIndex.set(h.index, h.kind);

  const summary = highlights.length
    ? highlights.map((h) => `position ${h.index} ${kindLabel[h.kind]}`).join("; ")
    : null;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={
        summary
          ? `Array of ${length} values; ${summary}`
          : `Array of ${length} values awaiting action`
      }
    >
      {array.map((value, i) => {
        const kind = highlightByIndex.get(i);
        const colors = kind ? palette[kind] : undefined;
        const heightFraction = effectiveMax > 0 ? value / effectiveMax : 0;
        const h = Math.max(2, heightFraction * innerHeight);
        const x = PADDING + i * (barWidth + GAP);
        const y = PADDING + (innerHeight - h);
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={2}
              ry={2}
              fill={colors?.fill ?? "var(--bar-default)"}
              stroke={colors?.stroke ?? "transparent"}
              strokeWidth={kind ? 2 : 0}
            />
            {kind === "swap" && (
              <line
                x1={x + barWidth / 2}
                y1={PADDING + innerHeight - 4}
                x2={x + barWidth / 2}
                y2={PADDING + innerHeight + 2}
                stroke={colors?.stroke}
                strokeWidth={2}
              />
            )}
            {kind === "pivot" && (
              <circle
                cx={x + barWidth / 2}
                cy={PADDING + innerHeight + 4}
                r={3}
                fill={colors?.stroke}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
