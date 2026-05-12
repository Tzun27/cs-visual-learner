import type { AttentionSnapshot, Matrix } from "@/lib/ml/types";

export type AttentionViewProps = {
  snapshot: AttentionSnapshot;
  /** Optional query-row index to glow in the attention heatmap. */
  highlightQueryIndex?: number;
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
}: {
  label: string;
  matrix: Matrix | undefined;
  x: number;
  y: number;
  cellSize?: number;
  precision?: number;
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
          Array.from({ length: cols }, (_, j) => (
            <g key={`${i}-${j}`}>
              <rect
                x={x + j * cellSize}
                y={y + i * cellSize}
                width={cellSize}
                height={cellSize}
                fill="var(--background)"
                stroke="var(--bar-default)"
                strokeWidth={0.5}
                strokeOpacity={0.6}
              />
              <text
                x={x + j * cellSize + cellSize / 2}
                y={y + i * cellSize + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="var(--font-mono), monospace"
                fontSize={9}
                fill="var(--foreground)"
              >
                {fmt(matrix[i][j], precision)}
              </text>
            </g>
          )),
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

export function AttentionView({ snapshot, highlightQueryIndex, className }: AttentionViewProps) {
  const tokens = snapshot.tokenLabels;
  const phase = snapshot.phase;

  // Layout: token labels (left column) → Q/K/V → attention heatmap → output
  const tokenStartY = 40;
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={`Attention head, phase: ${phase}`}
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
        label="scaled scores (pre-softmax)"
        matrix={snapshot.scaled}
        x={COL.attention}
        y={tokenStartY + HEATMAP_CELL * tokens.length + SECTION_GAP}
        cellSize={MATRIX_CELL}
      />

      {/* Output Y */}
      <MatrixPanel label="Y = AV" matrix={snapshot.output} x={COL.output} y={tokenStartY} />
    </svg>
  );
}
