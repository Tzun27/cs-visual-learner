import { bowlLoss } from "./gradientDescent";

export type ContourPolyline = {
  readonly level: number;
  readonly points: ReadonlyArray<readonly [number, number]>;
};

export type BowlBounds = {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
};

/**
 * Default plotting bounds for the bowl loss `f(w1,w2) = w1² + 3·w2²`.
 * Covers the curated GD demo trajectories without truncating any of them.
 */
export const BOWL_BOUNDS: BowlBounds = {
  xMin: -5,
  xMax: 5,
  yMin: -3,
  yMax: 3,
};

/** Level set values chosen to give visually-spaced rings inside BOWL_BOUNDS. */
export const BOWL_CONTOUR_LEVELS: readonly number[] = [0.5, 2, 5, 10, 16, 22, 25] as const;

const SAMPLES_PER_RING = 64;

/**
 * Pre-compute one closed polyline per level. Bowl ellipses are analytic:
 *   w1²/c + w2²/(c/3) = 1
 * so we parametrize as w1 = √c·cos(θ), w2 = √(c/3)·sin(θ).
 */
function ringFor(level: number): ContourPolyline {
  const a = Math.sqrt(level);
  const b = Math.sqrt(level / 3);
  const points: Array<readonly [number, number]> = [];
  for (let i = 0; i <= SAMPLES_PER_RING; i++) {
    const theta = (i / SAMPLES_PER_RING) * 2 * Math.PI;
    points.push([a * Math.cos(theta), b * Math.sin(theta)]);
  }
  return { level, points };
}

export const BOWL_CONTOURS: ReadonlyArray<ContourPolyline> = BOWL_CONTOUR_LEVELS.map(ringFor);

/** Sanity helper: max distance from any sampled point to its declared level. */
export function maxContourError(contour: ContourPolyline): number {
  let err = 0;
  for (const [x, y] of contour.points) {
    err = Math.max(err, Math.abs(bowlLoss(x, y) - contour.level));
  }
  return err;
}
