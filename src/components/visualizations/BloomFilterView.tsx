import { bloomFilterPopcount } from "@/lib/dataStructures/bloomFilter";
import type { BloomFilterSnapshot } from "@/lib/dataStructures/types";
import { SlotRect, slotHighlightPalette } from "./svgPrimitives";
import type { SlotCellKind } from "./svgPrimitives";

export type BloomFilterCellKind = SlotCellKind;

export type BloomFilterHighlight = {
  readonly bitIndex: number;
  readonly kind: BloomFilterCellKind;
};

export type BloomFilterViewProps = {
  table: BloomFilterSnapshot;
  highlights?: readonly BloomFilterHighlight[];
  className?: string;
};

const VIEWBOX_WIDTH = 640;
const PADDING_X = 16;
const PADDING_Y = 16;
const INDEX_LABEL_HEIGHT = 22;
const CELL_HEIGHT = 56;
const VIEWBOX_HEIGHT = PADDING_Y * 2 + INDEX_LABEL_HEIGHT + CELL_HEIGHT;

// Different verb from cuckoo because the Bloom filter operates on
// bits, not slots holding fingerprints. "Set" is the verb actually
// performed; "checked" matches the contains step kind.
const kindLabel: Record<SlotCellKind, string> = {
  cursor: "being checked",
  placed: "matched",
  duplicate: "already set (collision)",
};

export function BloomFilterView({ table, highlights = [], className }: BloomFilterViewProps) {
  const { m, bits } = table;
  const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
  const cellWidth = m > 0 ? innerWidth / m : innerWidth;

  const highlightByBit = new Map<number, BloomFilterCellKind>();
  for (const h of highlights) highlightByBit.set(h.bitIndex, h.kind);

  const xOfBit = (i: number) => PADDING_X + i * cellWidth;
  const cellY = PADDING_Y + INDEX_LABEL_HEIGHT;

  const popcount = bloomFilterPopcount(table);
  const labelParts: string[] = [];
  for (const h of highlights) {
    const bit = bits[h.bitIndex];
    const valueDesc = bit === 1 ? "1" : "0";
    labelParts.push(`bit ${h.bitIndex} (value ${valueDesc}) ${kindLabel[h.kind]}`);
  }
  const ariaLabel =
    popcount === 0
      ? `Empty Bloom filter with ${m} bits`
      : labelParts.length
        ? `Bloom filter with ${popcount} of ${m} bits set; ${labelParts.join("; ")}`
        : `Bloom filter with ${popcount} of ${m} bits set`;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {/* index labels */}
      {bits.map((_, i) => (
        <text
          key={`idx-${i}`}
          x={xOfBit(i) + cellWidth / 2}
          y={PADDING_Y + INDEX_LABEL_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fontFamily="var(--font-mono), monospace"
          fill="var(--bar-default-stroke)"
        >
          {i}
        </text>
      ))}

      {bits.map((bit, i) => {
        const x = xOfBit(i);
        const kind = highlightByBit.get(i);
        // "isEmpty" for the shared SlotRect drives the dashed-border
        // treatment used by every other slot-row view. For Bloom filter
        // we want the dashed look on bit=0 cells (visually distinct
        // from set bits) so we treat bit=0 as "empty".
        const isEmpty = bit === 0;
        // Set bits use the "set" colour (a saturated tint that reads
        // as "this is data, not a placeholder"); the highlight palette
        // overrides it when a kind is supplied.
        const setBitFill = slotHighlightPalette.placed.fill;
        return (
          <g key={`bit-${i}`}>
            {bit === 1 && !kind && (
              // Render a filled background for set bits so they're
              // visually distinct from the dashed empties even without
              // a per-step highlight.
              <rect
                x={x + 1}
                y={cellY + 2}
                width={cellWidth - 2}
                height={CELL_HEIGHT - 4}
                rx={6}
                ry={6}
                fill={setBitFill}
                fillOpacity={0.25}
                stroke="var(--bar-default)"
                strokeWidth={1.5}
              />
            )}
            {(bit === 0 || kind) && (
              <SlotRect
                x={x}
                y={cellY}
                width={cellWidth}
                height={CELL_HEIGHT}
                kind={kind}
                isEmpty={isEmpty}
              />
            )}
            <text
              x={x + cellWidth / 2}
              y={cellY + CELL_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={18}
              fontFamily="var(--font-mono), monospace"
              fontWeight={bit === 1 ? 700 : 400}
              fill={bit === 1 ? "var(--foreground)" : "var(--bar-default-stroke)"}
              fillOpacity={bit === 1 ? 1 : 0.6}
            >
              {bit}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
