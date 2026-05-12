import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttentionViz } from "@/components/visualizations/AttentionViz";

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

describe("AttentionViz", () => {
  beforeEach(() => installMatchMedia(false));
  afterEach(() => vi.unstubAllGlobals());

  it("renders region, attention SVG, code panel, counters and run-to-end button", () => {
    render(<AttentionViz />);
    const region = screen.getByRole("region", { name: /Attention head visualization/ });
    expect(within(region).getByRole("img").getAttribute("aria-label")).toMatch(/Attention head/);
    const counters = region.querySelector("dl");
    expect(within(counters!).getByText("Phase")).toBeInTheDocument();
    expect(within(counters!).getByText("Step")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /Run to end/ })).toBeInTheDocument();
  });

  it("step-forward through nine clicks ends at the done annotation", async () => {
    const user = userEvent.setup();
    render(<AttentionViz />);
    const region = screen.getByRole("region", { name: /Attention head visualization/ });
    const stepForward = within(region).getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 9; i++) await user.click(stepForward);
    expect(within(region).getByText(/Done — one full pass/)).toBeInTheDocument();
  });

  it("Run-to-end under reduced motion snaps to done", async () => {
    vi.unstubAllGlobals();
    installMatchMedia(true);
    const user = userEvent.setup();
    render(<AttentionViz />);
    const region = screen.getByRole("region", { name: /Attention head visualization/ });
    await user.click(within(region).getByRole("button", { name: /Run to end/ }));
    expect(within(region).getByText(/Done — one full pass/)).toBeInTheDocument();
  });
});
