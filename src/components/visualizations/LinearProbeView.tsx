import { slotIndexFor } from "@/lib/dataStructures/linearProbe";
import type { LinearProbeSnapshot } from "@/lib/dataStructures/types";
import { SlotRect } from "./svgPrimitives";
import type { SlotCellKind } from "./svgPrimitives";

export type LinearProbeCellKind = SlotCellKind;

export type LinearProbeHighlight = {
  readonly slotIndex: number;
  readonly kind: LinearProbeCellKind;
};

export type LinearProbeViewProps = {
  table: LinearProbeSnapshot;
  highlights?: readonly LinearProbeHighlight[];
  // When true, render a small "+N" badge inside each occupied cell
  // showing the slot's displacement from its key's home. Used by the
  // Robin Hood section where the displacement distribution is the point.
  showDisplacements?: boolean;
  className?: string;
};

const VIEWBOX_WIDTH = 600;
const PADDING_X = 16;
const PADDING_Y = 16;
const INDEX_LABEL_HEIGHT = 22;
const CELL_HEIGHT = 56;
const VIEWBOX_HEIGHT = PADDING_Y * 2 + INDEX_LABEL_HEIGHT + CELL_HEIGHT;

const kindLabel: Record<LinearProbeCellKind, string> = {
  cursor: "being probed",
  placed: "matched",
  duplicate: "duplicate match",
};

export function LinearProbeView({
  table,
  highlights = [],
  showDisplacements = false,
  className,
}: LinearProbeViewProps) {
  const { capacity, slots } = table;
  const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
  const slotWidth = capacity > 0 ? innerWidth / capacity : innerWidth;

  const highlightBySlot = new Map<number, LinearProbeCellKind>();
  for (const h of highlights) highlightBySlot.set(h.slotIndex, h.kind);

  const xOfSlot = (i: number) => PADDING_X + i * slotWidth;
  const cellY = PADDING_Y + INDEX_LABEL_HEIGHT;

  const occupied = slots.filter((s) => s.state === "occupied").length;
  const tombstoned = slots.filter((s) => s.state === "tombstone").length;
  const labelParts: string[] = [];
  for (const h of highlights) {
    const slot = slots[h.slotIndex];
    const slotDesc =
      slot?.state === "occupied"
        ? `key ${slot.key}`
        : slot?.state === "tombstone"
          ? "tombstone"
          : "empty";
    labelParts.push(`slot ${h.slotIndex} (${slotDesc}) ${kindLabel[h.kind]}`);
  }
  const ariaLabel =
    occupied === 0 && tombstoned === 0
      ? `Empty linear-probing hash table with ${capacity} slots`
      : labelParts.length
        ? `Linear-probing hash table with ${occupied} keys and ${tombstoned} tombstones across ${capacity} slots; ${labelParts.join("; ")}`
        : `Linear-probing hash table with ${occupied} keys and ${tombstoned} tombstones across ${capacity} slots`;

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
        const kind = highlightBySlot.get(i);
        const isEmpty = slot.state === "empty";
        const isTombstone = slot.state === "tombstone";
        return (
          <g key={`slot-${i}`}>
            <SlotRect
              x={x}
              y={cellY}
              width={slotWidth}
              height={CELL_HEIGHT}
              kind={kind}
              isEmpty={isEmpty}
            />
            {slot.state === "occupied" && (
              <>
                <text
                  x={x + slotWidth / 2}
                  y={cellY + CELL_HEIGHT / 2 + (showDisplacements ? -6 : 0)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={16}
                  fontFamily="var(--font-mono), monospace"
                  fill="var(--foreground)"
                >
                  {slot.key}
                </text>
                {showDisplacements && (
                  <text
                    x={x + slotWidth / 2}
                    y={cellY + CELL_HEIGHT / 2 + 12}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontFamily="var(--font-mono), monospace"
                    fill="var(--bar-default-stroke)"
                  >
                    {`+${(i - slotIndexFor(slot.key, capacity) + capacity) % capacity}`}
                  </text>
                )}
              </>
            )}
            {isTombstone && (
              <>
                {/* X mark for the tombstone */}
                <line
                  x1={x + slotWidth / 2 - 8}
                  y1={cellY + CELL_HEIGHT / 2 - 8}
                  x2={x + slotWidth / 2 + 8}
                  y2={cellY + CELL_HEIGHT / 2 + 8}
                  stroke="var(--bar-default-stroke)"
                  strokeWidth={2}
                />
                <line
                  x1={x + slotWidth / 2 + 8}
                  y1={cellY + CELL_HEIGHT / 2 - 8}
                  x2={x + slotWidth / 2 - 8}
                  y2={cellY + CELL_HEIGHT / 2 + 8}
                  stroke="var(--bar-default-stroke)"
                  strokeWidth={2}
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
