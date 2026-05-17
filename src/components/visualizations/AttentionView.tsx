import type { AttentionSnapshot, Matrix } from "@/lib/ml/types";

export type AttentionViewProps = {
  snapshot: AttentionSnapshot;
  /** Optional query-row index to glow in the attention heatmap. */
  highlightQueryIndex?: number;
  // When true, the scaled-scores panel renders upper-triangle cells with
  // a red strikethrough — visually pinning what causal masking removes.
  // The flag is independent of `snapshot.masked` because the viz wants to
  // show the mask conceptually even on the scale-scores step (one beat
  // before the mask-scores step actually fires).
  showCausalMask?: boolean;
  className?: string;
};

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 420;

const COL = { tokens: 36, qkv: 130, attention: 400, output: 580 } as const;
const MATRIX_CELL = 28;
const HEATMAP_CELL = 42;
const SECTION_GAP = 28;

function fmt(v: number, digits = 2): string {
  return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function MatrixPanel({
  label,
  matrix,
  x,
  y,
  cellSize = MATRIX_CELL,
  precision = 2,
  // When true, paint cells where col > row with a red strikethrough +
  // muted text — the "this slot will be masked out" indicator used only
  // on the scaled-scores panel in causal mode.
  causalMaskOverlay = false,
}: {
  label: string;
  matrix: Matrix | undefined;
  x: number;
  y: number;
  cellSize?: number;
  precision?: number;
  causalMaskOverlay?: boolean;
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

function Heatmap({
  label,
  matrix,
  x,
  y,
  cellSize = HEATMAP_CELL,
  highlightRow,
}: {
  label: string;
  matrix: Matrix | undefined;
  x: number;
  y: number;
  cellSize?: number;
  highlightRow?: number;
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
                  fontSize={11}
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

export function AttentionView({
  snapshot,
  highlightQueryIndex,
  showCausalMask = false,
  className,
}: AttentionViewProps) {
  const tokens = snapshot.tokenLabels;
  const phase = snapshot.phase;
  // In causal mode, prefer rendering the post-mask scaled scores (with
  // -∞ values) once the mask step has fired; otherwise the pre-mask
  // scaled matrix is what's in scope.
  const scaledForPanel: Matrix | undefined =
    showCausalMask && snapshot.masked ? snapshot.masked : snapshot.scaled;

  // Layout: token labels (left column) → Q/K/V → attention heatmap → output
  const tokenStartY = 40;
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={`Attention head${showCausalMask ? " (causal)" : ""}, phase: ${phase}`}
    >
      {/* Token labels */}
      <text
        x={COL.tokens}
        y={tokenStartY - 12}
        fontFamily="var(--font-mono), monospace"
        fontSize={10}
        fill="var(--bar-default)"
      >
        tokens
      </text>
      {tokens.map((t, i) => (
        <text
          key={t}
          x={COL.tokens}
          y={tokenStartY + i * MATRIX_CELL + MATRIX_CELL / 2}
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={12}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {t}
        </text>
      ))}

      {/* X (embeddings) */}
      <MatrixPanel label="X" matrix={snapshot.embeddings} x={COL.tokens + 24} y={tokenStartY} />

      {/* Q, K, V */}
      <MatrixPanel label="Q" matrix={snapshot.q} x={COL.qkv} y={tokenStartY} />
      <MatrixPanel label="K" matrix={snapshot.k} x={COL.qkv + 90} y={tokenStartY} />
      <MatrixPanel label="V" matrix={snapshot.v} x={COL.qkv + 180} y={tokenStartY} />

      {/* Attention heatmap */}
      <Heatmap
        label="attention = softmax(QKᵀ/√d_k)"
        matrix={snapshot.attention}
        x={COL.attention}
        y={tokenStartY}
        highlightRow={highlightQueryIndex}
      />

      {/* Pre-softmax score readout below the heatmap */}
      <MatrixPanel
        label={
          showCausalMask
            ? snapshot.masked
              ? "masked scaled scores (−∞ = excluded)"
              : "scaled scores (causal mask preview)"
            : "scaled scores (pre-softmax)"
        }
        matrix={scaledForPanel}
        x={COL.attention}
        y={tokenStartY + HEATMAP_CELL * tokens.length + SECTION_GAP}
        cellSize={MATRIX_CELL}
        causalMaskOverlay={showCausalMask}
      />

      {/* Output Y */}
      <MatrixPanel label="Y = AV" matrix={snapshot.output} x={COL.output} y={tokenStartY} />
    </svg>
  );
}
