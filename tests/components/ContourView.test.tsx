import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ContourView } from "@/components/visualizations/ContourView";
import { BOWL_BOUNDS, BOWL_CONTOURS } from "@/lib/ml/gradientDescent.contours";

describe("ContourView", () => {
  it("renders without crashing for a single-point trajectory", () => {
    const { container } = render(
      <ContourView
        snapshot={{ params: [2, 1], trajectory: [[2, 1]] }}
        contours={BOWL_CONTOURS}
        bounds={BOWL_BOUNDS}
      />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    // One contour polyline per level + axis lines + current-point circle.
    expect(container.querySelectorAll("polyline").length).toBe(BOWL_CONTOURS.length);
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a trajectory path for >= 2 points", () => {
    const { container } = render(
      <ContourView
        snapshot={{
          params: [0, 0],
          trajectory: [
            [3, 2],
            [2, 1.2],
            [1.4, 0.7],
            [0.9, 0.4],
          ],
        }}
        contours={BOWL_CONTOURS}
        bounds={BOWL_BOUNDS}
      />,
    );
    expect(container.querySelector("[data-testid='trajectory']")).toBeInTheDocument();
  });

  it("renders no trajectory path for an empty trajectory", () => {
    const { container } = render(
      <ContourView
        snapshot={{ params: [0, 0], trajectory: [] }}
        contours={BOWL_CONTOURS}
        bounds={BOWL_BOUNDS}
      />,
    );
    expect(container.querySelector("[data-testid='trajectory']")).not.toBeInTheDocument();
  });

  it("renders no trajectory path for a single-point trajectory (path needs >= 2 points)", () => {
    const { container } = render(
      <ContourView
        snapshot={{ params: [3, 2], trajectory: [[3, 2]] }}
        contours={BOWL_CONTOURS}
        bounds={BOWL_BOUNDS}
      />,
    );
    expect(container.querySelector("[data-testid='trajectory']")).not.toBeInTheDocument();
  });

  it("emits an aria-label that includes the step count and optional caption", () => {
    const { getByRole } = render(
      <ContourView
        snapshot={{
          params: [1, 1],
          trajectory: [
            [3, 2],
            [1, 1],
          ],
        }}
        contours={BOWL_CONTOURS}
        bounds={BOWL_BOUNDS}
        caption="loss 4"
      />,
    );
    const svg = getByRole("img");
    expect(svg.getAttribute("aria-label")).toMatch(/step 1/);
    expect(svg.getAttribute("aria-label")).toMatch(/loss 4/);
  });

  it("renders a gradient arrow when 'gradient' is provided", () => {
    const { container } = render(
      <ContourView
        snapshot={{ params: [2, 1], trajectory: [[2, 1]] }}
        contours={BOWL_CONTOURS}
        bounds={BOWL_BOUNDS}
        gradient={[4, 6]}
      />,
    );
    // marker-end is set on the gradient arrow line specifically.
    const arrow = container.querySelector("line[marker-end]");
    expect(arrow).toBeInTheDocument();
  });

  it("draws a gradient arrow even when the trajectory is empty (falls back to origin)", () => {
    const { container } = render(
      <ContourView
        snapshot={{ params: [0, 0], trajectory: [] }}
        contours={BOWL_CONTOURS}
        bounds={BOWL_BOUNDS}
        gradient={[1, 1]}
      />,
    );
    expect(container.querySelector("line[marker-end]")).toBeInTheDocument();
  });
});
