import type { MultiHeadAttentionSnapshot, MultiHeadHeadState } from "@/lib/ml/types";
import { Heatmap, MatrixPanel } from "./svgPrimitives";

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

      <MatrixPanel
        label={`Q^(${headIndex + 1})`}
        matrix={head.q}
        x={COL.q}
        y={y + 16}
        cellSize={MATRIX_CELL}
      />
      <MatrixPanel
        label={`K^(${headIndex + 1})`}
        matrix={head.k}
        x={COL.k}
        y={y + 16}
        cellSize={MATRIX_CELL}
      />
      <MatrixPanel
        label={`V^(${headIndex + 1})`}
        matrix={head.v}
        x={COL.v}
        y={y + 16}
        cellSize={MATRIX_CELL}
      />
      <Heatmap
        label={`A^(${headIndex + 1}) = softmax(QKᵀ/√d_k)`}
        matrix={head.attention}
        x={COL.attention}
        y={y + 16}
        cellSize={HEATMAP_CELL}
        cellTextSize={10}
        highlightRow={highlightQueryIndex}
      />
      <MatrixPanel
        label={`Y^(${headIndex + 1}) = A^(${headIndex + 1})·V^(${headIndex + 1})`}
        matrix={head.output}
        x={COL.output}
        y={y + 16}
        cellSize={MATRIX_CELL}
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
        cellSize={MATRIX_CELL}
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
        cellSize={MATRIX_CELL}
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

      <MatrixPanel
        label="W_O"
        matrix={snapshot.wO}
        x={COL.wO}
        y={Y_OUTPUT + 16}
        cellSize={MATRIX_CELL}
      />

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
        cellSize={MATRIX_CELL}
        emptyText="(awaiting W_O)"
      />
    </svg>
  );
}
