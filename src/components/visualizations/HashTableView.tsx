import type { HashTableSnapshot } from "@/lib/dataStructures/types";

export type HashCellKind = "cursor" | "placed" | "duplicate";

export type HashCellHighlight = {
  readonly entryId: number;
  readonly kind: HashCellKind;
};

export type HashTableViewProps = {
  table: HashTableSnapshot;
  highlights?: readonly HashCellHighlight[];
  activeBucketIndex?: number;
  ghostBucketIndex?: number | null;
  className?: string;
};

const VIEWBOX_WIDTH = 600;
const PADDING_X = 16;
const PADDING_Y = 16;
const HEADER_HEIGHT = 28;
// Wider/shallower than the pre-map version to give "k: v" cells room
// to breathe — the longest value with 3 digits + colon + space + 2-digit
// key needs ~7 monospace glyphs at fontSize 12 ≈ 50 px of inner width.
const CELL_RADIUS_X = 28;
const CELL_RADIUS_Y = 14;
const CELL_SPACING_Y = 38;
const CONNECTOR_OVERLAP = 4;
const MIN_HEIGHT = 140;

const palette: Record<HashCellKind, { fill: string; stroke: string }> = {
  cursor: { fill: "var(--bar-compare)", stroke: "var(--bar-compare-stroke)" },
  placed: { fill: "var(--bar-swap)", stroke: "var(--bar-swap-stroke)" },
  duplicate: { fill: "var(--bar-pivot)", stroke: "var(--bar-pivot-stroke)" },
};

const kindLabel: Record<HashCellKind, string> = {
  cursor: "being probed",
  placed: "matched",
  duplicate: "duplicate match",
};

export function HashTableView({
  table,
  highlights = [],
  activeBucketIndex,
  ghostBucketIndex = null,
  className,
}: HashTableViewProps) {
  const capacity = table.capacity;
  const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
  const bucketSlotWidth = capacity > 0 ? innerWidth / capacity : innerWidth;

  const maxChainLength = table.buckets.reduce((m, b) => Math.max(m, b.length), 0);
  const ghostExtra = ghostBucketIndex !== null && ghostBucketIndex !== undefined ? 1 : 0;
  const longestVisualChain = Math.max(maxChainLength, ghostExtra);

  const height = Math.max(
    MIN_HEIGHT,
    PADDING_Y * 2 + HEADER_HEIGHT + longestVisualChain * CELL_SPACING_Y + CELL_RADIUS_Y * 2,
  );

  const xOfBucket = (i: number) => PADDING_X + (i + 0.5) * bucketSlotWidth;
  const yOfChainSlot = (slot: number) =>
    PADDING_Y + HEADER_HEIGHT + CELL_RADIUS_Y + slot * CELL_SPACING_Y;

  const highlightByEntry = new Map<number, HashCellKind>();
  for (const h of highlights) highlightByEntry.set(h.entryId, h.kind);

  const liveCount = table.buckets.reduce((n, b) => n + b.length, 0);
  const labelParts: string[] = [];
  if (activeBucketIndex !== undefined) {
    labelParts.push(`active bucket ${activeBucketIndex}`);
  }
  for (const h of highlights) {
    const entry = table.entries[h.entryId];
    if (entry) labelParts.push(`entry ${entry.key}: ${entry.value} ${kindLabel[h.kind]}`);
  }
  const ariaLabel =
    liveCount === 0
      ? `Empty hash table with ${capacity} buckets`
      : labelParts.length
        ? `Hash table with ${liveCount} keys across ${capacity} buckets; ${labelParts.join("; ")}`
        : `Hash table with ${liveCount} keys across ${capacity} buckets`;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {table.buckets.map((bucket, i) => {
        const x = xOfBucket(i);
        const headerY = PADDING_Y + HEADER_HEIGHT / 2;
        const isActive = i === activeBucketIndex;
        return (
          <g key={`bucket-header-${i}`}>
            <rect
              x={x - bucketSlotWidth / 2 + 4}
              y={PADDING_Y}
              width={bucketSlotWidth - 8}
              height={HEADER_HEIGHT}
              rx={6}
              ry={6}
              fill={isActive ? "var(--bar-compare)" : "var(--background)"}
              stroke={isActive ? "var(--bar-compare-stroke)" : "var(--bar-default)"}
              strokeWidth={isActive ? 2 : 1}
              opacity={isActive ? 0.18 : 1}
            />
            <text
              x={x}
              y={headerY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontFamily="var(--font-mono), monospace"
              fill="var(--foreground)"
            >
              {i}
            </text>
          </g>
        );
      })}

      {/* Connector strokes from bucket header down through the chain */}
      {table.buckets.map((bucket, bucketIndex) => {
        if (bucket.length === 0) return null;
        const x = xOfBucket(bucketIndex);
        const yTop = PADDING_Y + HEADER_HEIGHT;
        const yBottom = yOfChainSlot(bucket.length - 1) - CELL_RADIUS_Y + CONNECTOR_OVERLAP;
        return (
          <line
            key={`connector-${bucketIndex}`}
            x1={x}
            y1={yTop}
            x2={x}
            y2={yBottom}
            stroke="var(--bar-default)"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Ghost slot (e.g. previewing a not-yet-placed insertion) */}
      {ghostBucketIndex !== null && ghostBucketIndex !== undefined && (
        <g key="ghost">
          <line
            x1={xOfBucket(ghostBucketIndex)}
            y1={PADDING_Y + HEADER_HEIGHT}
            x2={xOfBucket(ghostBucketIndex)}
            y2={yOfChainSlot(table.buckets[ghostBucketIndex].length) - CELL_RADIUS_Y}
            stroke="var(--bar-compare)"
            strokeWidth={1.5}
            strokeDasharray="3 4"
            opacity={0.6}
          />
          <ellipse
            cx={xOfBucket(ghostBucketIndex)}
            cy={yOfChainSlot(table.buckets[ghostBucketIndex].length)}
            rx={CELL_RADIUS_X}
            ry={CELL_RADIUS_Y}
            fill="none"
            stroke="var(--bar-compare)"
            strokeWidth={1.5}
            strokeDasharray="3 4"
            opacity={0.6}
          />
        </g>
      )}

      {/* Entry cells */}
      {table.buckets.flatMap((bucket, bucketIndex) =>
        bucket.map((entryId, slot) => {
          const entry = table.entries[entryId];
          const cx = xOfBucket(bucketIndex);
          const cy = yOfChainSlot(slot);
          const kind = highlightByEntry.get(entryId);
          const colors = kind ? palette[kind] : undefined;
          return (
            <g key={`entry-${entryId}`}>
              <ellipse
                cx={cx}
                cy={cy}
                rx={CELL_RADIUS_X}
                ry={CELL_RADIUS_Y}
                fill={colors?.fill ?? "var(--background)"}
                stroke={colors?.stroke ?? "var(--bar-default)"}
                strokeWidth={kind ? 2.5 : 1.5}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontFamily="var(--font-mono), monospace"
                fill="var(--foreground)"
              >
                {`${entry.key}: ${entry.value}`}
              </text>
              {kind === "placed" && (
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={CELL_RADIUS_X + 4}
                  ry={CELL_RADIUS_Y + 4}
                  fill="none"
                  stroke={colors?.stroke}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}
