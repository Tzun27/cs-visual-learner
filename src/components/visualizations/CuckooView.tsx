import type { CuckooSide, CuckooSnapshot } from "@/lib/dataStructures/types";

export type CuckooCellKind = "cursor" | "placed" | "duplicate";

export type CuckooHighlight = {
  readonly side: CuckooSide;
  readonly slotIndex: number;
  readonly kind: CuckooCellKind;
};

export type CuckooViewProps = {
  table: CuckooSnapshot;
  highlights?: readonly CuckooHighlight[];
  className?: string;
};

const VIEWBOX_WIDTH = 640;
const PADDING_X = 60;
const PADDING_Y = 16;
const LABEL_GUTTER = 50;
const INDEX_LABEL_HEIGHT = 22;
const CELL_HEIGHT = 56;
const ROW_GAP = 20;
const VIEWBOX_HEIGHT = PADDING_Y * 2 + (INDEX_LABEL_HEIGHT + CELL_HEIGHT) * 2 + ROW_GAP;

const palette: Record<CuckooCellKind, { fill: string; stroke: string }> = {
  cursor: { fill: "var(--bar-compare)", stroke: "var(--bar-compare-stroke)" },
  placed: { fill: "var(--bar-swap)", stroke: "var(--bar-swap-stroke)" },
  duplicate: { fill: "var(--bar-pivot)", stroke: "var(--bar-pivot-stroke)" },
};

const kindLabel: Record<CuckooCellKind, string> = {
  cursor: "being inspected",
  placed: "matched",
  duplicate: "duplicate match",
};

const sideLabel: Record<CuckooSide, string> = {
  A: "T_A (h₁)",
  B: "T_B (h₂)",
};

function bandKey(side: CuckooSide, slotIndex: number) {
  return `${side}-${slotIndex}`;
}

export function CuckooView({ table, highlights = [], className }: CuckooViewProps) {
  const { capacity, slotsA, slotsB } = table;
  const innerWidth = VIEWBOX_WIDTH - PADDING_X - LABEL_GUTTER;
  const slotWidth = capacity > 0 ? innerWidth / capacity : innerWidth;

  const highlightByKey = new Map<string, CuckooCellKind>();
  for (const h of highlights) highlightByKey.set(bandKey(h.side, h.slotIndex), h.kind);

  const xOfSlot = (i: number) => LABEL_GUTTER + i * slotWidth;
  const rowA_indexY = PADDING_Y + INDEX_LABEL_HEIGHT / 2;
  const rowA_cellY = PADDING_Y + INDEX_LABEL_HEIGHT;
  const rowB_indexY =
    PADDING_Y + INDEX_LABEL_HEIGHT + CELL_HEIGHT + ROW_GAP + INDEX_LABEL_HEIGHT / 2;
  const rowB_cellY = PADDING_Y + INDEX_LABEL_HEIGHT + CELL_HEIGHT + ROW_GAP + INDEX_LABEL_HEIGHT;

  const occA = slotsA.filter((s) => s.state === "occupied").length;
  const occB = slotsB.filter((s) => s.state === "occupied").length;
  const labelParts: string[] = [];
  for (const h of highlights) {
    const slot = (h.side === "A" ? slotsA : slotsB)[h.slotIndex];
    const slotDesc = slot?.state === "occupied" ? `key ${slot.key}` : "empty";
    labelParts.push(`T_${h.side}[${h.slotIndex}] (${slotDesc}) ${kindLabel[h.kind]}`);
  }
  const ariaLabel =
    occA === 0 && occB === 0
      ? `Empty cuckoo hash table with ${capacity} slots per side`
      : labelParts.length
        ? `Cuckoo hash table: ${occA} keys in T_A, ${occB} keys in T_B (capacity ${capacity} per side); ${labelParts.join("; ")}`
        : `Cuckoo hash table: ${occA} keys in T_A, ${occB} keys in T_B (capacity ${capacity} per side)`;

  const renderRow = (
    side: CuckooSide,
    slots: CuckooSnapshot["slotsA"],
    indexY: number,
    cellY: number,
  ) => (
    <g>
      <text
        x={LABEL_GUTTER - 8}
        y={cellY + CELL_HEIGHT / 2}
        textAnchor="end"
        dominantBaseline="central"
        fontSize={13}
        fontFamily="var(--font-mono), monospace"
        fill="var(--foreground)"
      >
        {sideLabel[side]}
      </text>
      {slots.map((_, i) => (
        <text
          key={`idx-${side}-${i}`}
          x={xOfSlot(i) + slotWidth / 2}
          y={indexY}
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
        const kind = highlightByKey.get(bandKey(side, i));
        const colors = kind ? palette[kind] : undefined;
        const isEmpty = slot.state === "empty";
        const fill = colors?.fill ?? (isEmpty ? "transparent" : "var(--background)");
        const stroke = colors?.stroke ?? "var(--bar-default)";
        const strokeWidth = kind ? 2.5 : 1.5;
        const dashArray = isEmpty && !kind ? "4 3" : undefined;
        return (
          <g key={`slot-${side}-${i}`}>
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
              <text
                x={x + slotWidth / 2}
                y={cellY + CELL_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={16}
                fontFamily="var(--font-mono), monospace"
                fill="var(--foreground)"
              >
                {slot.key}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {renderRow("A", slotsA, rowA_indexY, rowA_cellY)}
      {renderRow("B", slotsB, rowB_indexY, rowB_cellY)}
    </svg>
  );
}
