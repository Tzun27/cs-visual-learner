import { describe, it, expect } from "vitest";
import {
  BOWL_BOUNDS,
  BOWL_CONTOURS,
  BOWL_CONTOUR_LEVELS,
  maxContourError,
} from "@/lib/ml/gradientDescent.contours";

describe("bowl contours", () => {
  it("emits one polyline per declared level", () => {
    expect(BOWL_CONTOURS.length).toBe(BOWL_CONTOUR_LEVELS.length);
    for (let i = 0; i < BOWL_CONTOURS.length; i++) {
      expect(BOWL_CONTOURS[i].level).toBe(BOWL_CONTOUR_LEVELS[i]);
    }
  });

  it("every polyline closes back on itself (first ≈ last point)", () => {
    for (const c of BOWL_CONTOURS) {
      const first = c.points[0];
      const last = c.points[c.points.length - 1];
      expect(last[0]).toBeCloseTo(first[0], 10);
      expect(last[1]).toBeCloseTo(first[1], 10);
    }
  });

  it("every sampled point lies on its declared level within a tight tolerance", () => {
    for (const c of BOWL_CONTOURS) {
      // Tolerance is generous in absolute terms but tight relative to the level.
      // Parametric sampling produces exact algebra; only fp error remains.
      expect(maxContourError(c)).toBeLessThan(1e-9);
    }
  });

  it("bounds cover the largest contour ring", () => {
    const maxLevel = Math.max(...BOWL_CONTOUR_LEVELS);
    const xExtent = Math.sqrt(maxLevel);
    const yExtent = Math.sqrt(maxLevel / 3);
    expect(BOWL_BOUNDS.xMax).toBeGreaterThanOrEqual(xExtent);
    expect(BOWL_BOUNDS.xMin).toBeLessThanOrEqual(-xExtent);
    expect(BOWL_BOUNDS.yMax).toBeGreaterThanOrEqual(yExtent);
    expect(BOWL_BOUNDS.yMin).toBeLessThanOrEqual(-yExtent);
  });
});
