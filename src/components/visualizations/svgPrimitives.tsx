import type { Matrix } from "@/lib/ml/types";

/**
 * Format a numeric cell value for display: fixed-precision when finite,
 * an em-dash placeholder otherwise. `undefined` is also rendered as the
 * dash so callers holding optional values (e.g. NetworkView weights) can
 * pass them straight through.
 *
 * Shared by NetworkView / AttentionView / MultiHeadAttentionView /
 * PositionalEncodingView, which previously each defined an identical copy.
 */
export function fmt(value: number | undefined, digits = 2): string {
  return value !== undefined && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

/**
 * Highlight kinds shared by the hash-table-family slot views
 * (LinearProbeView / HopscotchView / CuckooView / CuckooFilterView).
 */
export type SlotCellKind = "cursor" | "placed" | "duplicate";

/**
 * Fill/stroke colours for a highlighted slot cell, keyed by highlight kind.
 * Identical across every slot-row view, so defined once here.
 */
export const slotHighlightPalette: Record<SlotCellKind, { fill: string; stroke: string }> = {
  cursor: { fill: "var(--bar-compare)", stroke: "var(--bar-compare-stroke)" },
  placed: { fill: "var(--bar-swap)", stroke: "var(--bar-swap-stroke)" },
  duplicate: { fill: "var(--bar-pivot)", stroke: "var(--bar-pivot-stroke)" },
};

/**
 * Accessible-label fragments describing each highlight kind, in the
 * "being inspected" phrasing shared verbatim by CuckooView and
 * CuckooFilterView. LinearProbeView and HopscotchView keep their own
 * records because their wording genuinely differs ("being probed", and
 * Hopscotch's "placed or pulled").
 */
export const cuckooKindLabel: Record<SlotCellKind, string> = {
  cursor: "being inspected",
  placed: "matched",
  duplicate: "duplicate match",
};

/**
 * Derive the fill/stroke/strokeWidth/dashArray of a slot cell from its
 * highlight kind and emptiness — the exact logic LinearProbeView,
 * HopscotchView, CuckooView and CuckooFilterView each inlined.
 */
export function slotCellStyle(kind: SlotCellKind | undefined, isEmpty: boolean) {
  const colors = kind ? slotHighlightPalette[kind] : undefined;
  return {
    fill: colors?.fill ?? (isEmpty ? "transparent" : "var(--background)"),
    stroke: colors?.stroke ?? "var(--bar-default)",
    strokeWidth: kind ? 2.5 : 1.5,
    dashArray: isEmpty && !kind ? "4 3" : undefined,
  };
}

/**
 * The rounded-rectangle background of a single slot cell, shared by the
 * four slot-row views. Renders pixel-identically to the inline `<rect>`
 * each view previously emitted: `x + 1` / `y + 2` inset, `width - 2`,
 * `height - 4`, `rx`/`ry` = 6. Per-view cell contents (keys, fingerprints,
 * tombstone marks, home labels) are layered on by the caller separately.
 */
export function SlotRect({
  x,
  y,
  width,
  height,
  kind,
  isEmpty,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: SlotCellKind | undefined;
  isEmpty: boolean;
}) {
  const style = slotCellStyle(kind, isEmpty);
  return (
    <rect
      x={x + 1}
      y={y + 2}
      width={width - 2}
      height={height - 4}
      rx={6}
      ry={6}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      strokeDasharray={style.dashArray}
    />
  );
}

/**
 * A labelled grid of numbers. Shared by every attention-family view.
 *
 * `label` is optional: when omitted (or empty) the caption text node is
 * not emitted at all — used by MultiHeadAttentionView's per-cell panels.
 * `causalMaskOverlay` paints cells where col > row with a red
 * strikethrough (the "this slot will be masked out" preview); `emptyText`
 * customises the placeholder shown when `matrix` is undefined.
 */
export function MatrixPanel({
  label,
  matrix,
  x,
  y,
  cellSize = 28,
  precision = 2,
  emptyText = "(pending)",
  causalMaskOverlay = false,
}: {
  label?: string;
  matrix: Matrix | undefined;
  x: number;
  y: number;
  cellSize?: number;
  precision?: number;
  emptyText?: string;
  causalMaskOverlay?: boolean;
}) {
  const rows = matrix?.length ?? 0;
  const cols = matrix?.[0]?.length ?? 0;
  return (
    <g>
      {label && (
        <text
          x={x}
          y={y - 6}
          fontFamily="var(--font-mono), monospace"
          fontSize={10}
          fill="var(--bar-default)"
        >
          {label}
        </text>
      )}
      {matrix === undefined ? (
        <text
          x={x}
          y={y + cellSize / 2}
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={11}
          fill="var(--bar-default)"
          fillOpacity={0.55}
        >
          {emptyText}
        </text>
      ) : (
        Array.from({ length: rows }, (_, i) =>
          Array.from({ length: cols }, (_, j) => {
            const value = matrix[i][j];
            const masked = causalMaskOverlay && j > i;
            const isNegInf = value === -Infinity;
            const displayText = isNegInf ? "−∞" : fmt(value, precision);
            return (
              <g key={`${i}-${j}`}>
                <rect
                  x={x + j * cellSize}
                  y={y + i * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={masked ? "var(--bar-pivot)" : "var(--background)"}
                  fillOpacity={masked ? 0.18 : 1}
                  stroke={masked ? "var(--bar-pivot-stroke)" : "var(--bar-default)"}
                  strokeWidth={masked ? 1 : 0.5}
                  strokeOpacity={masked ? 1 : 0.6}
                />
                <text
                  x={x + j * cellSize + cellSize / 2}
                  y={y + i * cellSize + cellSize / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="var(--font-mono), monospace"
                  fontSize={9}
                  fill={masked || isNegInf ? "var(--bar-pivot-stroke)" : "var(--foreground)"}
                  fillOpacity={masked && !isNegInf ? 0.6 : 1}
                  textDecoration={masked && !isNegInf ? "line-through" : undefined}
                >
                  {displayText}
                </text>
              </g>
            );
          }),
        )
      )}
    </g>
  );
}

/**
 * A softmax-weight grid where cell opacity tracks the value. Shared by
 * the attention-family views (rectangular maps are supported, so this
 * also serves cross-attention).
 *
 * `cellTextSize` is the per-cell font size — AttentionView uses 11,
 * MultiHeadAttentionView uses 10.
 */
export function Heatmap({
  label,
  matrix,
  x,
  y,
  cellSize = 42,
  highlightRow,
  cellTextSize = 11,
}: {
  label: string;
  matrix: Matrix | undefined;
  x: number;
  y: number;
  cellSize?: number;
  highlightRow?: number;
  cellTextSize?: number;
}) {
  const rows = matrix?.length ?? 0;
  const cols = matrix?.[0]?.length ?? 0;
  return (
    <g>
      <text
        x={x}
        y={y - 6}
        fontFamily="var(--font-mono), monospace"
        fontSize={10}
        fill="var(--bar-default)"
      >
        {label}
      </text>
      {matrix === undefined ? (
        <text
          x={x}
          y={y + cellSize / 2}
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={11}
          fill="var(--bar-default)"
          fillOpacity={0.55}
        >
          (pending)
        </text>
      ) : (
        Array.from({ length: rows }, (_, i) =>
          Array.from({ length: cols }, (_, j) => {
            const value = matrix[i][j];
            // Softmax values are in [0, 1]; opacity = intensity.
            const intensity = Math.max(0, Math.min(1, value));
            const isHighlightRow = highlightRow === i;
            return (
              <g key={`${i}-${j}`}>
                <rect
                  x={x + j * cellSize}
                  y={y + i * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="var(--bar-compare)"
                  fillOpacity={intensity}
                  stroke={isHighlightRow ? "var(--bar-swap-stroke)" : "var(--bar-default)"}
                  strokeWidth={isHighlightRow ? 2 : 0.5}
                />
                <text
                  x={x + j * cellSize + cellSize / 2}
                  y={y + i * cellSize + cellSize / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="var(--font-mono), monospace"
                  fontSize={cellTextSize}
                  fill={intensity > 0.5 ? "var(--background)" : "var(--foreground)"}
                  fontWeight={isHighlightRow ? 700 : 400}
                >
                  {fmt(value, 2)}
                </text>
              </g>
            );
          }),
        )
      )}
    </g>
  );
}
