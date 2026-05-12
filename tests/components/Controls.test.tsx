import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controls } from "@/components/visualizations/Controls";

function makeProps(overrides: Partial<React.ComponentProps<typeof Controls>> = {}) {
  return {
    status: "idle" as const,
    speed: 200,
    arraySize: 20,
    reducedMotion: false,
    canStepBack: true,
    canStepForward: true,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStepBack: vi.fn(),
    onStepForward: vi.fn(),
    onReset: vi.fn(),
    onSpeedChange: vi.fn(),
    onArraySizeChange: vi.fn(),
    ...overrides,
  };
}

describe("Controls", () => {
  it("renders Play, Step backward, Step forward, and Reset", () => {
    render(<Controls {...makeProps()} />);
    expect(screen.getByRole("button", { name: /^Play$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Step backward/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Step forward/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reset/ })).toBeInTheDocument();
  });

  it("clicking Play fires onPlay", async () => {
    const props = makeProps();
    render(<Controls {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    expect(props.onPlay).toHaveBeenCalledOnce();
  });

  it("when status is 'playing' the Play button switches to Pause and fires onPause", async () => {
    const props = makeProps({ status: "playing" });
    render(<Controls {...props} />);
    const btn = screen.getByRole("button", { name: /^Pause$/ });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(btn);
    expect(props.onPause).toHaveBeenCalledOnce();
  });

  it("Step backward is disabled when canStepBack is false", async () => {
    const props = makeProps({ canStepBack: false });
    render(<Controls {...props} />);
    const btn = screen.getByRole("button", { name: /Step backward/ });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(props.onStepBack).not.toHaveBeenCalled();
  });

  it("Step forward is disabled when canStepForward is false", () => {
    render(<Controls {...makeProps({ canStepForward: false })} />);
    expect(screen.getByRole("button", { name: /Step forward/ })).toBeDisabled();
  });

  it("speed slider fires onSpeedChange with a number", () => {
    const props = makeProps();
    render(<Controls {...props} />);
    const slider = screen.getByRole("slider", { name: /Step delay/ });
    expect(slider).toHaveValue("200");
  });

  it("under reduced-motion the Play button is disabled with an explanatory label", () => {
    render(<Controls {...makeProps({ reducedMotion: true })} />);
    const btn = screen.getByRole("button", { name: /Auto-play disabled/ });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Auto-play is disabled/)).toBeInTheDocument();
  });

  it("supports keyboard activation (Space) on the Play button", async () => {
    const props = makeProps();
    render(<Controls {...props} />);
    const btn = screen.getByRole("button", { name: /^Play$/ });
    btn.focus();
    await userEvent.keyboard(" ");
    expect(props.onPlay).toHaveBeenCalledOnce();
  });

  it("does not render the Run-to-end button when onRunToCompletion is omitted", () => {
    render(<Controls {...makeProps()} />);
    expect(screen.queryByRole("button", { name: /Run to end/ })).not.toBeInTheDocument();
  });

  it("renders the Run-to-end button when onRunToCompletion is provided", () => {
    const onRunToCompletion = vi.fn();
    render(<Controls {...makeProps({ onRunToCompletion })} />);
    expect(screen.getByRole("button", { name: /Run to end/ })).toBeInTheDocument();
  });

  it("clicking Run to end fires onRunToCompletion", async () => {
    const onRunToCompletion = vi.fn();
    render(<Controls {...makeProps({ onRunToCompletion })} />);
    await userEvent.click(screen.getByRole("button", { name: /Run to end/ }));
    expect(onRunToCompletion).toHaveBeenCalledOnce();
  });

  it("Run to end is disabled when canStepForward is false", () => {
    const onRunToCompletion = vi.fn();
    render(<Controls {...makeProps({ canStepForward: false, onRunToCompletion })} />);
    expect(screen.getByRole("button", { name: /Run to end/ })).toBeDisabled();
  });

  it("Run to end is disabled while status is 'playing'", () => {
    const onRunToCompletion = vi.fn();
    render(<Controls {...makeProps({ status: "playing", onRunToCompletion })} />);
    expect(screen.getByRole("button", { name: /Run to end/ })).toBeDisabled();
  });
});
