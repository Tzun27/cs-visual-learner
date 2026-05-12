import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntuitionOnly, MathLevel, MathOnly } from "@/components/mdx/MathLevel";

function Harness() {
  return (
    <>
      <MathLevel />
      <IntuitionOnly>
        <p>intuition block</p>
      </IntuitionOnly>
      <MathOnly>
        <p>math block</p>
      </MathOnly>
    </>
  );
}

describe("MathLevel toggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders both pills with correct aria-pressed state on default 'intuition'", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Intuition" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "With math" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders intuition content and hides math content by default", () => {
    render(<Harness />);
    expect(screen.getByText("intuition block")).toBeInTheDocument();
    expect(screen.queryByText("math block")).not.toBeInTheDocument();
  });

  it("swaps gated content when the math pill is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "With math" }));
    expect(screen.queryByText("intuition block")).not.toBeInTheDocument();
    expect(screen.getByText("math block")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "With math" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("respects a custom className when provided", () => {
    render(<MathLevel className="my-toggle" />);
    expect(screen.getByRole("group", { name: "Math level" })).toHaveClass("my-toggle");
  });
});
