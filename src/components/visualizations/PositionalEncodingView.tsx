import type { Matrix, PositionalEncodingSnapshot } from "@/lib/ml/types";
import { fmt } from "./svgPrimitives";

export type PositionalEncodingViewProps = {
  snapshot: PositionalEncodingSnapshot;
  className?: string;
};

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 240;
const CELL = 40;
const LABEL_HEIGHT = 24;
const PADDING_X = 16;

const COL = {
  tokens: 14,
  x: 70,
  pe: 250,
  combined: 460,
} as const;

function MatrixPanel({
  label,
  matrix,
  x,
  y,
  highlightRow,
  fadeUnrevealedFrom,
}: {
  label: string;
  matrix: Matrix | undefined;
  x: number;
  y: number;
  highlightRow?: number;
  // When set, rows >= this index are rendered with a faded outline and
  // grey text (the "not yet computed" treatment for the PE matrix).
  fadeUnrevealedFrom?: number;
}) {
  const rows = matrix?.length ?? 0;
  const cols = matrix?.[0]?.length ?? 0;
  return (
    <g>
      <text
        x={x}
        y={y - 8}
        fontFamily="var(--font-mono), monospace"
        fontSize={11}
        fontWeight={600}
        fill="var(--foreground)"
      >
        {label}
      </text>
      {matrix === undefined ? (
        <text
          x={x}
          y={y + CELL / 2}
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
            const faded = fadeUnrevealedFrom !== undefined && i >= fadeUnrevealedFrom;
            const isHighlight = highlightRow === i;
            return (
              <g key={`${i}-${j}`}>
                <rect
                  x={x + j * CELL}
                  y={y + i * CELL}
                  width={CELL}
                  height={CELL}
                  fill={
                    isHighlight ? "var(--bar-swap)" : faded ? "transparent" : "var(--background)"
                  }
                  fillOpacity={isHighlight ? 0.4 : 1}
                  stroke={
                    isHighlight
                      ? "var(--bar-swap-stroke)"
                      : faded
                        ? "var(--bar-default)"
                        : "var(--bar-default)"
                  }
                  strokeWidth={isHighlight ? 2 : 0.5}
                  strokeOpacity={faded ? 0.35 : 0.6}
                  strokeDasharray={faded ? "3 2" : undefined}
                />
                <text
                  x={x + j * CELL + CELL / 2}
                  y={y + i * CELL + CELL / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="var(--font-mono), monospace"
                  fontSize={11}
                  fill={faded ? "var(--bar-default)" : "var(--foreground)"}
                  fillOpacity={faded ? 0.4 : 1}
                  fontWeight={isHighlight ? 700 : 400}
                >
                  {faded ? "·" : fmt(matrix[i][j])}
                </text>
              </g>
            );
          }),
        )
      )}
    </g>
  );
}

export function PositionalEncodingView({ snapshot, className }: PositionalEncodingViewProps) {
  const tokens = snapshot.tokenLabels;
  const rows = tokens.length;
  const startY = 36;
  const phase = snapshot.phase;
  const revealedRows = snapshot.revealedRows ?? 0;

  // Highlight the most-recently-revealed PE row on compute-pe steps so
  // the user sees which row just appeared.
  const highlightPERow = phase === "compute-pe" ? revealedRows - 1 : undefined;

  // The "plus sign" between PE and combined only makes sense once
  // combined is populated.
  const showPlus = snapshot.combined !== undefined;
  const plusX = COL.pe + 2 * CELL + 16;
  const equalsX = COL.combined - 24;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={`Positional encoding panel, phase: ${phase}`}
    >
      {/* Token labels — leftmost column */}
      <text
        x={PADDING_X}
        y={startY - 8}
        fontFamily="var(--font-mono), monospace"
        fontSize={10}
        fill="var(--bar-default)"
      >
        tokens
      </text>
      {tokens.map((t, i) => (
        <text
          key={t}
          x={PADDING_X}
          y={startY + i * CELL + CELL / 2}
          dominantBaseline="central"
          fontFamily="var(--font-mono), monospace"
          fontSize={12}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {t}
        </text>
      ))}

      <MatrixPanel label="X (embeddings)" matrix={snapshot.embeddings} x={COL.x} y={startY} />

      <MatrixPanel
        label="PE (sin/cos)"
        matrix={snapshot.pe}
        x={COL.pe}
        y={startY}
        highlightRow={highlightPERow}
        fadeUnrevealedFrom={revealedRows}
      />

      {showPlus && (
        <>
          <text
            x={plusX}
            y={startY + (rows * CELL) / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-mono), monospace"
            fontSize={20}
            fontWeight={700}
            fill="var(--foreground)"
          >
            ↦
          </text>
          <text
            x={equalsX}
            y={startY + (rows * CELL) / 2 - 12}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-mono), monospace"
            fontSize={9}
            fill="var(--bar-default)"
          >
            X + PE
          </text>
        </>
      )}

      <MatrixPanel
        label="X′ (input to attention)"
        matrix={snapshot.combined}
        x={COL.combined}
        y={startY}
      />

      {/* Optional bottom-row label height reservation so layout stays stable */}
      <rect x={0} y={startY + rows * CELL + LABEL_HEIGHT} width={1} height={1} fill="transparent" />
    </svg>
  );
}
