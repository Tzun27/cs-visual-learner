import type { Matrix, MultiHeadAttentionSnapshot, MultiHeadHeadState } from "@/lib/ml/types";

export type MultiHeadAttentionViewProps = {
  snapshot: MultiHeadAttentionSnapshot;
  /** Optional query-row index to glow in every head's attention heatmap. */
  highlightQueryIndex?: number;
  className?: string;
};

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 840;

const MATRIX_CELL = 26;
const HEATMAP_CELL = 32;

// Y-band layout: shared X row, then one band per head, then a final output band.
const Y_X_BAND = 24;
const Y_HEAD0 = 160;
const Y_HEAD1 = 360;
const Y_OUTPUT = 580;

const COL = {
  label: 8,
  q: 100,
  k: 200,
  v: 300,
  attention: 410,
  output: 580,
  // Output-band columns
  concatLabel: 8,
  concat: 80,
  dot: 222,
  wO: 244,
  eq: 386,
  finalY: 414,
} as const;

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
  emptyText = "(pending)",
}: {
  label?: string;
  matrix: Matrix | undefined;
  x: number;
  y: number;
  cellSize?: number;
  precision?: number;
  emptyText?: string;
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
                  fontSize={10}
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

function HeadBand({
  head,
  headIndex,
  y,
  isActive,
  highlightQueryIndex,
}: {
  head: MultiHeadHeadState;
  headIndex: number;
  y: number;
  isActive: boolean;
  highlightQueryIndex?: number;
}) {
  const sectionStroke = isActive ? "var(--bar-swap-stroke)" : "var(--bar-default)";
  const strokeWidth = isActive ? 1.5 : 0.6;
  return (
    <g>
      {/* Band outline so users see which head is being computed */}
      <rect
        x={4}
        y={y - 12}
        width={VIEWBOX_WIDTH - 8}
        height={170}
        rx={6}
        fill="none"
        stroke={sectionStroke}
        strokeOpacity={isActive ? 0.6 : 0.25}
        strokeWidth={strokeWidth}
        strokeDasharray={isActive ? undefined : "3 3"}
      />
      <text
        x={COL.label}
        y={y - 2}
        fontFamily="var(--font-mono), monospace"
        fontSize={11}
        fontWeight={700}
        fill={isActive ? "var(--bar-swap-stroke)" : "var(--foreground)"}
      >
        Head {headIndex + 1}
      </text>

      <MatrixPanel label={`Q^(${headIndex + 1})`} matrix={head.q} x={COL.q} y={y + 16} />
      <MatrixPanel label={`K^(${headIndex + 1})`} matrix={head.k} x={COL.k} y={y + 16} />
      <MatrixPanel label={`V^(${headIndex + 1})`} matrix={head.v} x={COL.v} y={y + 16} />
      <Heatmap
        label={`A^(${headIndex + 1}) = softmax(QKᵀ/√d_k)`}
        matrix={head.attention}
        x={COL.attention}
        y={y + 16}
        highlightRow={highlightQueryIndex}
      />
      <MatrixPanel
        label={`Y^(${headIndex + 1}) = A^(${headIndex + 1})·V^(${headIndex + 1})`}
        matrix={head.output}
        x={COL.output}
        y={y + 16}
      />
    </g>
  );
}

export function MultiHeadAttentionView({
  snapshot,
  highlightQueryIndex,
  className,
}: MultiHeadAttentionViewProps) {
  const tokens = snapshot.tokenLabels;
  const phase = snapshot.phase;
  const isConcatActive = phase === "concat";
  const isOutputActive = phase === "project-output" || phase === "done";

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={`Multi-head attention, phase: ${phase}`}
    >
      {/* Top band: tokens + X */}
      <text
        x={COL.label}
        y={Y_X_BAND - 4}
        fontFamily="var(--font-mono), monospace"
        fontSize={11}
        fontWeight={700}
        fill="var(--foreground)"
      >
        Input
      </text>
      {tokens.map((t, i) => (
        <text
          key={t}
          x={COL.label + 36}
          y={Y_X_BAND + 12 + i * MATRIX_CELL + MATRIX_CELL / 2}
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={12}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {t}
        </text>
      ))}
      <MatrixPanel
        label="X (embeddings)"
        matrix={snapshot.embeddings}
        x={COL.label + 76}
        y={Y_X_BAND + 12}
      />

      {/* Per-head bands */}
      {snapshot.heads.map((head, idx) => (
        <HeadBand
          key={idx}
          head={head}
          headIndex={idx}
          y={idx === 0 ? Y_HEAD0 : Y_HEAD1}
          isActive={snapshot.activeHead === idx}
          highlightQueryIndex={highlightQueryIndex}
        />
      ))}

      {/* Output band */}
      <rect
        x={4}
        y={Y_OUTPUT - 12}
        width={VIEWBOX_WIDTH - 8}
        height={230}
        rx={6}
        fill="none"
        stroke={isConcatActive || isOutputActive ? "var(--bar-swap-stroke)" : "var(--bar-default)"}
        strokeOpacity={isConcatActive || isOutputActive ? 0.6 : 0.25}
        strokeWidth={isConcatActive || isOutputActive ? 1.5 : 0.6}
        strokeDasharray={isConcatActive || isOutputActive ? undefined : "3 3"}
      />
      <text
        x={COL.concatLabel}
        y={Y_OUTPUT - 2}
        fontFamily="var(--font-mono), monospace"
        fontSize={11}
        fontWeight={700}
        fill={isConcatActive || isOutputActive ? "var(--bar-swap-stroke)" : "var(--foreground)"}
      >
        Combine
      </text>

      <MatrixPanel
        label="concat([Y^(1) | Y^(2)])"
        matrix={snapshot.concat}
        x={COL.concat}
        y={Y_OUTPUT + 16}
        emptyText="(awaiting heads)"
      />

      {/* · symbol between concat and W_O */}
      <text
        x={COL.dot}
        y={Y_OUTPUT + 16 + MATRIX_CELL * 1.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-mono), monospace"
        fontSize={18}
        fill="var(--foreground)"
      >
        ·
      </text>

      <MatrixPanel label="W_O" matrix={snapshot.wO} x={COL.wO} y={Y_OUTPUT + 16} />

      {/* = symbol between W_O and final Y */}
      <text
        x={COL.eq}
        y={Y_OUTPUT + 16 + MATRIX_CELL * 1.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-mono), monospace"
        fontSize={16}
        fill="var(--foreground)"
      >
        =
      </text>

      <MatrixPanel
        label="Y = concat · W_O"
        matrix={snapshot.output}
        x={COL.finalY}
        y={Y_OUTPUT + 16}
        emptyText="(awaiting W_O)"
      />
    </svg>
  );
}
