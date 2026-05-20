import type { CrossAttentionSnapshot } from "@/lib/ml/types";
import { Heatmap, MatrixPanel } from "./AttentionView";

export type CrossAttentionViewProps = {
  snapshot: CrossAttentionSnapshot;
  className?: string;
};

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 276;

// The decoder band sits above the encoder band so the source split —
// queries from one sequence, keys/values from another — is visible at a
// glance. The heatmap to the right makes the rectangular shape explicit.
const DEC_Y = 46;
const ENC_Y = 152;
const HEATMAP = { x: 408, y: 66, cell: 42 } as const;
const ROW_CELL = 28;

export function CrossAttentionView({ snapshot, className }: CrossAttentionViewProps) {
  const dec = snapshot.decoderTokenLabels;
  const enc = snapshot.encoderTokenLabels;
  const phase = snapshot.phase;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={`Encoder-decoder cross-attention, phase: ${phase}`}
    >
      {/* ---- Decoder band: token labels, X_dec, Q ---- */}
      <text
        x={16}
        y={DEC_Y - 18}
        fontFamily="var(--font-mono), monospace"
        fontSize={10}
        fontWeight={700}
        fill="var(--bar-swap-stroke)"
      >
        decoder · queries
      </text>
      {dec.map((t, i) => (
        <text
          key={`d-${t}`}
          x={16}
          y={DEC_Y + i * ROW_CELL + ROW_CELL / 2}
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={12}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {t}
        </text>
      ))}
      <MatrixPanel label="X_dec" matrix={snapshot.decoderEmbeddings} x={44} y={DEC_Y} />
      <MatrixPanel label="Q = X_dec·W_Q" matrix={snapshot.q} x={150} y={DEC_Y} />

      {/* ---- Encoder band: token labels, X_enc, K, V ---- */}
      <text
        x={16}
        y={ENC_Y - 18}
        fontFamily="var(--font-mono), monospace"
        fontSize={10}
        fontWeight={700}
        fill="var(--bar-compare-stroke)"
      >
        encoder · keys &amp; values
      </text>
      {enc.map((t, i) => (
        <text
          key={`e-${t}`}
          x={16}
          y={ENC_Y + i * ROW_CELL + ROW_CELL / 2}
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={12}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {t}
        </text>
      ))}
      <MatrixPanel label="X_enc" matrix={snapshot.encoderEmbeddings} x={44} y={ENC_Y} />
      <MatrixPanel label="K = X_enc·W_K" matrix={snapshot.k} x={150} y={ENC_Y} />
      <MatrixPanel label="V = X_enc·W_V" matrix={snapshot.v} x={256} y={ENC_Y} />

      {/* ---- Attention heatmap: rows = decoder queries, cols = encoder keys ---- */}
      <text
        x={HEATMAP.x}
        y={HEATMAP.y - 28}
        fontFamily="var(--font-mono), monospace"
        fontSize={10}
        fill="var(--bar-default)"
      >
        attention A (decoder × encoder)
      </text>
      {/* encoder token labels above the columns */}
      {enc.map((t, j) => (
        <text
          key={`hc-${t}`}
          x={HEATMAP.x + j * HEATMAP.cell + HEATMAP.cell / 2}
          y={HEATMAP.y - 9}
          textAnchor="middle"
          fontFamily="var(--font-mono), monospace"
          fontSize={9}
          fontWeight={600}
          fill="var(--bar-compare-stroke)"
        >
          {t}
        </text>
      ))}
      {/* decoder token labels left of the rows */}
      {dec.map((t, i) => (
        <text
          key={`hr-${t}`}
          x={HEATMAP.x - 9}
          y={HEATMAP.y + i * HEATMAP.cell + HEATMAP.cell / 2}
          textAnchor="end"
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={9}
          fontWeight={600}
          fill="var(--bar-swap-stroke)"
        >
          {t}
        </text>
      ))}
      <Heatmap label="" matrix={snapshot.attention} x={HEATMAP.x} y={HEATMAP.y} />

      {/* scaled scores below the heatmap — same rectangular shape */}
      <MatrixPanel
        label="scaled scores Q·Kᵀ/√d_k"
        matrix={snapshot.scaled}
        x={HEATMAP.x}
        y={HEATMAP.y + HEATMAP.cell * dec.length + 36}
      />

      {/* ---- Output Y: one row per decoder token ---- */}
      <MatrixPanel label="Y = A·V" matrix={snapshot.output} x={612} y={HEATMAP.y} />
    </svg>
  );
}
