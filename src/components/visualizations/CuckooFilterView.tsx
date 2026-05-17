import type { CuckooFilterSnapshot } from "@/lib/dataStructures/types";

export type CuckooFilterCellKind = "cursor" | "placed" | "duplicate";

export type CuckooFilterHighlight = {
  readonly slotIndex: number;
  readonly kind: CuckooFilterCellKind;
};

export type CuckooFilterViewProps = {
  table: CuckooFilterSnapshot;
  highlights?: readonly CuckooFilterHighlight[];
  className?: string;
};

const VIEWBOX_WIDTH = 640;
const PADDING_X = 16;
const PADDING_Y = 16;
const INDEX_LABEL_HEIGHT = 22;
const CELL_HEIGHT = 64;
const VIEWBOX_HEIGHT = PADDING_Y * 2 + INDEX_LABEL_HEIGHT + CELL_HEIGHT;

const palette: Record<CuckooFilterCellKind, { fill: string; stroke: string }> = {
  cursor: { fill: "var(--bar-compare)", stroke: "var(--bar-compare-stroke)" },
  placed: { fill: "var(--bar-swap)", stroke: "var(--bar-swap-stroke)" },
  duplicate: { fill: "var(--bar-pivot)", stroke: "var(--bar-pivot-stroke)" },
};

const kindLabel: Record<CuckooFilterCellKind, string> = {
  cursor: "being inspected",
  placed: "matched",
  duplicate: "duplicate match",
};

export function CuckooFilterView({ table, highlights = [], className }: CuckooFilterViewProps) {
  const { capacity, slots } = table;
  const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
  const slotWidth = capacity > 0 ? innerWidth / capacity : innerWidth;

  const highlightBySlot = new Map<number, CuckooFilterCellKind>();
  for (const h of highlights) highlightBySlot.set(h.slotIndex, h.kind);

  const xOfSlot = (i: number) => PADDING_X + i * slotWidth;
  const cellY = PADDING_Y + INDEX_LABEL_HEIGHT;

  const occupied = slots.filter((s) => s.state === "occupied").length;
  const labelParts: string[] = [];
  for (const h of highlights) {
    const slot = slots[h.slotIndex];
    const slotDesc = slot?.state === "occupied" ? `fingerprint ${slot.fingerprint}` : "empty";
    labelParts.push(`slot ${h.slotIndex} (${slotDesc}) ${kindLabel[h.kind]}`);
  }
  const ariaLabel =
    occupied === 0
      ? `Empty cuckoo filter with ${capacity} slots`
      : labelParts.length
        ? `Cuckoo filter with ${occupied} live fingerprints across ${capacity} slots; ${labelParts.join("; ")}`
        : `Cuckoo filter with ${occupied} live fingerprints across ${capacity} slots`;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {/* index labels */}
      {slots.map((_, i) => (
        <text
          key={`idx-${i}`}
          x={xOfSlot(i) + slotWidth / 2}
          y={PADDING_Y + INDEX_LABEL_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontFamily="var(--font-mono), monospace"
          fill="var(--bar-default-stroke)"
        >
          {i}
        </text>
      ))}

      {slots.map((slot, i) => {
        const x = xOfSlot(i);
        const w = slotWidth - 2;
        const kind = highlightBySlot.get(i);
        const colors = kind ? palette[kind] : undefined;
        const isEmpty = slot.state === "empty";
        const fill = colors?.fill ?? (isEmpty ? "transparent" : "var(--background)");
        const stroke = colors?.stroke ?? "var(--bar-default)";
        const strokeWidth = kind ? 2.5 : 1.5;
        const dashArray = isEmpty && !kind ? "4 3" : undefined;
        return (
          <g key={`slot-${i}`}>
            <rect
              x={x + 1}
              y={cellY + 2}
              width={w}
              height={CELL_HEIGHT - 4}
              rx={6}
              ry={6}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
            />
            {slot.state === "occupied" && (
              <>
                <text
                  x={x + slotWidth / 2}
                  y={cellY + CELL_HEIGHT / 2 - 7}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontFamily="var(--font-mono), monospace"
                  fill="var(--bar-default-stroke)"
                >
                  fp
                </text>
                <text
                  x={x + slotWidth / 2}
                  y={cellY + CELL_HEIGHT / 2 + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={16}
                  fontFamily="var(--font-mono), monospace"
                  fill="var(--foreground)"
                >
                  {slot.fingerprint}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
