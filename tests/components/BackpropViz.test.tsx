import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackpropViz } from "@/components/visualizations/BackpropViz";

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

describe("BackpropViz", () => {
  beforeEach(() => installMatchMedia(false));
  afterEach(() => vi.unstubAllGlobals());

  it("renders region, network SVG, code panel, counters, and run-to-end button", () => {
    render(<BackpropViz />);
    const region = screen.getByRole("region", { name: /Backpropagation visualization/ });
    expect(within(region).getByRole("img").getAttribute("aria-label")).toMatch(/Backprop/);
    // Counters live in the dl; "y" also appears as an SVG text label, so scope.
    const counters = region.querySelector("dl");
    expect(counters).not.toBeNull();
    expect(within(counters!).getByText("Phase")).toBeInTheDocument();
    expect(within(counters!).getByText("Loss")).toBeInTheDocument();
    expect(within(counters!).getByText("y")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /Run to end/ })).toBeInTheDocument();
  });

  it("step-forward advances annotation through forward → backward → update", async () => {
    const user = userEvent.setup();
    render(<BackpropViz />);
    const region = screen.getByRole("region", { name: /Backpropagation visualization/ });
    const stepForward = within(region).getByRole("button", { name: /Step forward/ });

    await user.click(stepForward);
    expect(within(region).getByText(/Inputs x/)).toBeInTheDocument();

    // Walk to the done step (10 clicks total).
    for (let i = 0; i < 9; i++) await user.click(stepForward);
    expect(within(region).getByText(/Done — one full step/)).toBeInTheDocument();
  });

  it("Run-to-end under reduced motion snaps to the done step", async () => {
    vi.unstubAllGlobals();
    installMatchMedia(true);
    const user = userEvent.setup();
    render(<BackpropViz />);
    const region = screen.getByRole("region", { name: /Backpropagation visualization/ });
    await user.click(within(region).getByRole("button", { name: /Run to end/ }));
    expect(within(region).getByText(/Done — one full step/)).toBeInTheDocument();
  });

  it("Phase counter reflects current step state", async () => {
    const user = userEvent.setup();
    render(<BackpropViz />);
    const region = screen.getByRole("region", { name: /Backpropagation visualization/ });
    const stepForward = within(region).getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 5; i++) await user.click(stepForward);
    // After 5 clicks we're at compute-loss; phase should be "loss".
    const phaseDt = within(region).getByText("Phase");
    const phaseDd = phaseDt.nextElementSibling;
    expect(phaseDd?.textContent?.toLowerCase()).toBe("loss");
  });
});
