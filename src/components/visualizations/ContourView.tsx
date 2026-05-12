import type { BowlBounds, ContourPolyline } from "@/lib/ml/gradientDescent.contours";
import type { GradientDescentSnapshot } from "@/lib/ml/types";

export type ContourViewProps = {
  snapshot: GradientDescentSnapshot;
  contours: ReadonlyArray<ContourPolyline>;
  bounds: BowlBounds;
  /** Optional gradient arrow drawn from the current point, length-scaled. */
  gradient?: readonly [number, number];
  /** Optional human-readable summary appended to the aria-label. */
  caption?: string;
  className?: string;
};

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 460;
const PADDING_X = 36;
const PADDING_Y = 28;
const POINT_RADIUS = 5;
const GRADIENT_SCALE = 0.05;

export function ContourView({
  snapshot,
  contours,
  bounds,
  gradient,
  caption,
  className,
}: ContourViewProps) {
  const innerW = VIEWBOX_WIDTH - PADDING_X * 2;
  const innerH = VIEWBOX_HEIGHT - PADDING_Y * 2;

  const xToSvg = (x: number) =>
    PADDING_X + ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * innerW;
  // SVG y is inverted (top = small), so flip.
  const yToSvg = (y: number) =>
    PADDING_Y + (1 - (y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * innerH;

  const trajectory = snapshot.trajectory;
  const current = trajectory[trajectory.length - 1];

  const trajectoryD =
    trajectory.length === 0
      ? ""
      : trajectory
          .map(
            ([x, y], i) => `${i === 0 ? "M" : "L"}${xToSvg(x).toFixed(2)},${yToSvg(y).toFixed(2)}`,
          )
          .join(" ");

  const gradientLine = gradient
    ? (() => {
        const [gx, gy] = gradient;
        // Draw from current point in the -gradient direction (descent direction)
        // scaled by GRADIENT_SCALE so the arrow stays readable for any norm.
        const from: readonly [number, number] = current ?? [0, 0];
        const to: readonly [number, number] = [
          from[0] - gx * GRADIENT_SCALE,
          from[1] - gy * GRADIENT_SCALE,
        ];
        return {
          x1: xToSvg(from[0]),
          y1: yToSvg(from[1]),
          x2: xToSvg(to[0]),
          y2: yToSvg(to[1]),
        };
      })()
    : null;

  const baseLabel = `Gradient descent at step ${Math.max(0, trajectory.length - 1)}`;
  const ariaLabel = caption ? `${baseLabel} — ${caption}` : baseLabel;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <marker
          id="gd-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--bar-swap)" />
        </marker>
      </defs>

      {/* axes */}
      <line
        x1={PADDING_X}
        y1={yToSvg(0)}
        x2={VIEWBOX_WIDTH - PADDING_X}
        y2={yToSvg(0)}
        stroke="var(--bar-default-stroke)"
        strokeWidth={1}
        strokeOpacity={0.35}
      />
      <line
        x1={xToSvg(0)}
        y1={PADDING_Y}
        x2={xToSvg(0)}
        y2={VIEWBOX_HEIGHT - PADDING_Y}
        stroke="var(--bar-default-stroke)"
        strokeWidth={1}
        strokeOpacity={0.35}
      />

      {/* contour rings */}
      {contours.map((c) => (
        <polyline
          key={`contour-${c.level}`}
          points={c.points
            .map(([x, y]) => `${xToSvg(x).toFixed(2)},${yToSvg(y).toFixed(2)}`)
            .join(" ")}
          fill="none"
          stroke="var(--bar-default-stroke)"
          strokeWidth={1}
          strokeOpacity={0.45}
          strokeDasharray="2 2"
        />
      ))}

      {/* trajectory polyline */}
      {trajectory.length >= 2 && (
        <path
          data-testid="trajectory"
          d={trajectoryD}
          fill="none"
          stroke="var(--bar-compare)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* trajectory points (small dots) */}
      {trajectory.slice(0, -1).map(([x, y], i) => (
        <circle
          key={`pt-${i}`}
          cx={xToSvg(x)}
          cy={yToSvg(y)}
          r={2.5}
          fill="var(--bar-compare)"
          opacity={0.6}
        />
      ))}

      {/* current point (larger, vibrant) */}
      {current && (
        <circle
          cx={xToSvg(current[0])}
          cy={yToSvg(current[1])}
          r={POINT_RADIUS}
          fill="var(--bar-swap)"
          stroke="var(--bar-swap-stroke)"
          strokeWidth={1.5}
        />
      )}

      {/* gradient arrow (pointing in descent direction) */}
      {gradientLine && (
        <line
          x1={gradientLine.x1}
          y1={gradientLine.y1}
          x2={gradientLine.x2}
          y2={gradientLine.y2}
          stroke="var(--bar-swap)"
          strokeWidth={2}
          markerEnd="url(#gd-arrow)"
        />
      )}
    </svg>
  );
}
