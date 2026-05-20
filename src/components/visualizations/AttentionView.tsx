import type { AttentionSnapshot, Matrix } from "@/lib/ml/types";
import { Heatmap, MatrixPanel } from "./svgPrimitives";

// Re-exported so sibling attention views (cross-attention, etc.) can keep
// importing the cell-rendering primitives from AttentionView — see
// architectural decision 54. The implementations now live in svgPrimitives.
export { Heatmap, MatrixPanel } from "./svgPrimitives";

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
