import type { HopscotchSnapshot } from "@/lib/dataStructures/types";

export type HopscotchCellKind = "cursor" | "placed" | "duplicate";

export type HopscotchHighlight = {
  readonly slotIndex: number;
  readonly kind: HopscotchCellKind;
};

// Highlight a single hop-info bit cell (the "is bit j of slot i set?"
// squares below the slot row). Used by the search viz when stepping
// through `check-bit` events.
export type HopscotchBitHighlight = {
  readonly homeIndex: number;
  readonly bitIndex: number;
};

export type HopscotchViewProps = {
  table: HopscotchSnapshot;
  highlights?: readonly HopscotchHighlight[];
  bitHighlights?: readonly HopscotchBitHighlight[];
  // When set, the hop-info row for this home index is rendered with a
  // pronounced outline — used by the insert viz to mark "this is the home
  // whose hop mask just gained a bit." Optional decoration.
  activeHome?: number | null;
  className?: string;
};

const VIEWBOX_WIDTH = 720;
const PADDING_X = 16;
const PADDING_Y = 12;
const INDEX_LABEL_HEIGHT = 20;
const CELL_HEIGHT = 54;
const HOP_LABEL_HEIGHT = 16;
const HOP_ROW_HEIGHT = 24;
const ROW_GAP = 6;
const VIEWBOX_HEIGHT =
  PADDING_Y * 2 + INDEX_LABEL_HEIGHT + CELL_HEIGHT + ROW_GAP + HOP_LABEL_HEIGHT + HOP_ROW_HEIGHT;

const palette: Record<HopscotchCellKind, { fill: string; stroke: string }> = {
  cursor: { fill: "var(--bar-compare)", stroke: "var(--bar-compare-stroke)" },
  placed: { fill: "var(--bar-swap)", stroke: "var(--bar-swap-stroke)" },
  duplicate: { fill: "var(--bar-pivot)", stroke: "var(--bar-pivot-stroke)" },
};

const kindLabel: Record<HopscotchCellKind, string> = {
  cursor: "being probed",
  placed: "placed or pulled",
  duplicate: "duplicate match",
};

export function HopscotchView({
  table,
  highlights = [],
  bitHighlights = [],
  activeHome = null,
  className,
}: HopscotchViewProps) {
  const { capacity, neighborhood, slots, hopInfo } = table;
  const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
  const slotWidth = capacity > 0 ? innerWidth / capacity : innerWidth;

  const highlightBySlot = new Map<number, HopscotchCellKind>();
  for (const h of highlights) highlightBySlot.set(h.slotIndex, h.kind);

  const xOfSlot = (i: number) => PADDING_X + i * slotWidth;
  const cellY = PADDING_Y + INDEX_LABEL_HEIGHT;
  const hopLabelY = cellY + CELL_HEIGHT + ROW_GAP;
  const hopRowY = hopLabelY + HOP_LABEL_HEIGHT;

  const occupied = slots.filter((s) => s.state === "occupied").length;
  const labelParts: string[] = [];
  for (const h of highlights) {
    const slot = slots[h.slotIndex];
    const slotDesc = slot?.state === "occupied" ? `key ${slot.key} (home ${slot.home})` : "empty";
    labelParts.push(`slot ${h.slotIndex} (${slotDesc}) ${kindLabel[h.kind]}`);
  }
  const ariaLabel =
    occupied === 0
      ? `Empty hopscotch hash table with ${capacity} slots and neighborhood ${neighborhood}`
      : labelParts.length
        ? `Hopscotch hash table with ${occupied} keys; ${labelParts.join("; ")}`
        : `Hopscotch hash table with ${occupied} keys across ${capacity} slots`;

  const bitSize = Math.min(HOP_ROW_HEIGHT - 4, slotWidth / neighborhood - 4);
  const bitGap = slotWidth / neighborhood;
  const bitHighlightKey = (h: number, b: number) => `${h}:${b}`;
  const highlightedBits = new Set(
    bitHighlights.map(({ homeIndex, bitIndex }) => bitHighlightKey(homeIndex, bitIndex)),
  );

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {/* slot index labels */}
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

      {/* slot cells */}
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
                  y={cellY + CELL_HEIGHT / 2 - 4}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={16}
                  fontFamily="var(--font-mono), monospace"
                  fill="var(--foreground)"
                >
                  {slot.key}
                </text>
                <text
                  x={x + slotWidth / 2}
                  y={cellY + CELL_HEIGHT / 2 + 13}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fontFamily="var(--font-mono), monospace"
                  fill="var(--bar-default-stroke)"
                >
                  {`home ${slot.home}`}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* hop-info row label per slot */}
      {slots.map((_, i) => (
        <text
          key={`hop-label-${i}`}
          x={xOfSlot(i) + slotWidth / 2}
          y={hopLabelY + HOP_LABEL_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontFamily="var(--font-mono), monospace"
          fill={activeHome === i ? "var(--foreground)" : "var(--bar-default-stroke)"}
          fontWeight={activeHome === i ? 600 : 400}
        >
          {`hop[${i}]`}
        </text>
      ))}

      {/* hop-info bit squares */}
      {slots.map((_, i) => {
        const x0 = xOfSlot(i) + 2;
        const mask = hopInfo[i];
        return (
          <g key={`hop-${i}`}>
            {Array.from({ length: neighborhood }, (_, j) => {
              const isSet = (mask & (1 << j)) !== 0;
              const isHighlighted = highlightedBits.has(bitHighlightKey(i, j));
              const cx = x0 + j * bitGap + bitGap / 2 - bitSize / 2;
              return (
                <rect
                  key={`hop-${i}-${j}`}
                  x={cx}
                  y={hopRowY + (HOP_ROW_HEIGHT - bitSize) / 2}
                  width={bitSize}
                  height={bitSize}
                  rx={2}
                  ry={2}
                  fill={
                    isHighlighted
                      ? "var(--bar-compare)"
                      : isSet
                        ? "var(--foreground)"
                        : "transparent"
                  }
                  stroke={
                    isHighlighted
                      ? "var(--bar-compare-stroke)"
                      : isSet
                        ? "var(--foreground)"
                        : "var(--bar-default-stroke)"
                  }
                  strokeWidth={isHighlighted ? 2 : 1}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
