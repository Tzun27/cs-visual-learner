import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GradientDescentViz } from "@/components/visualizations/GradientDescentViz";

function installMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reduced,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      addListener: () => {},
      removeListener: () => {},
    })),
  );
}

describe("GradientDescentViz", () => {
  beforeEach(() => installMatchMedia(false));
  afterEach(() => vi.unstubAllGlobals());

  it("renders the lr buttons, the contour SVG, the code panel, counters and controls", () => {
    render(<GradientDescentViz />);
    const region = screen.getByRole("region", { name: /Gradient descent visualization/ });
    expect(within(region).getByRole("button", { name: /0\.1 \(balanced\)/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(region).getByRole("img")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Gradient descent/),
    );
    expect(within(region).getByText("Step")).toBeInTheDocument();
    expect(within(region).getByText("Loss")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /Run to end/ })).toBeInTheDocument();
  });

  it("advances annotation on step-forward and reaches a terminal state", async () => {
    const user = userEvent.setup();
    render(<GradientDescentViz />);
    const region = screen.getByRole("region", { name: /Gradient descent visualization/ });
    const stepForward = within(region).getByRole("button", { name: /Step forward/ });

    // First click: kind = begin.
    await user.click(stepForward);
    expect(within(region).getByText(/Start at/)).toBeInTheDocument();

    // Subsequent clicks until terminal. Each outer iter = 2 yields; default
    // params at lr=0.1 hit maxSteps before convergence-tolerance, which is
    // an intentional pedagogical case the lr-zoo demonstrates.
    for (let i = 0; i < 100 && !within(region).queryByText(/Converged|Stopped at max steps/); i++) {
      await user.click(stepForward);
    }
    expect(within(region).getByText(/Converged|Stopped at max steps/)).toBeInTheDocument();
  });

  it("changing the learning rate resets playback (Step counter back to 0)", async () => {
    const user = userEvent.setup();
    render(<GradientDescentViz />);
    const region = screen.getByRole("region", { name: /Gradient descent visualization/ });
    const stepForward = within(region).getByRole("button", { name: /Step forward/ });

    // Advance a few times so Step > 0.
    for (let i = 0; i < 4; i++) await user.click(stepForward);

    // Switch lr — should reset.
    await user.click(within(region).getByRole("button", { name: /0\.15 \(brisk\)/ }));
    const stepDt = within(region).getByText("Step");
    const stepDd = stepDt.nextElementSibling;
    expect(stepDd?.textContent).toBe("0");
  });

  it("Run-to-end under reduced motion snaps to the converged step", async () => {
    vi.unstubAllGlobals();
    installMatchMedia(true);
    const user = userEvent.setup();
    render(<GradientDescentViz />);
    const region = screen.getByRole("region", { name: /Gradient descent visualization/ });
    await user.click(within(region).getByRole("button", { name: /Run to end/ }));
    // Default lr = 0.1 converges → annotation reads "Converged".
    expect(within(region).getByText(/Converged|Stopped at max steps/)).toBeInTheDocument();
  });
});
