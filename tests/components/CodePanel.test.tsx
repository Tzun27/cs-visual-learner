import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CodePanel } from "@/components/visualizations/CodePanel";

const SAMPLE = `def foo():
    return 1

def bar():
    return 2`;

describe("CodePanel", () => {
  it("renders one line element per source line", () => {
    const { container } = render(<CodePanel source={SAMPLE} />);
    expect(container.querySelectorAll("[data-line]")).toHaveLength(5);
  });

  it("trims a trailing newline so it does not render an empty extra line", () => {
    const { container } = render(<CodePanel source={"a\nb\n"} />);
    expect(container.querySelectorAll("[data-line]")).toHaveLength(2);
  });

  it("marks only the highlighted lines with data-highlighted and aria-current", () => {
    const { container } = render(<CodePanel source={SAMPLE} highlightedLines={[2, 4]} />);
    const highlighted = container.querySelectorAll("[data-highlighted='true']");
    expect(highlighted).toHaveLength(2);
    expect(highlighted[0].getAttribute("data-line")).toBe("2");
    expect(highlighted[1].getAttribute("data-line")).toBe("4");
    expect(highlighted[0].getAttribute("aria-current")).toBe("step");
  });

  it("renders no highlights when highlightedLines is empty", () => {
    const { container } = render(<CodePanel source={SAMPLE} />);
    expect(container.querySelectorAll("[data-highlighted='true']")).toHaveLength(0);
  });

  it("uses the supplied aria-label on the region", () => {
    const { getByRole } = render(<CodePanel source={SAMPLE} ariaLabel="Merge sort source" />);
    expect(getByRole("region").getAttribute("aria-label")).toBe("Merge sort source");
  });

  it("announces the first highlighted line via the live region", () => {
    const { container } = render(<CodePanel source={SAMPLE} highlightedLines={[3, 4]} />);
    const live = container.querySelector("[aria-live='polite']");
    expect(live?.textContent).toBe("current line 3");
  });

  it("announces 'no current line' when nothing is highlighted", () => {
    const { container } = render(<CodePanel source={SAMPLE} />);
    const live = container.querySelector("[aria-live='polite']");
    expect(live?.textContent).toBe("no current line");
  });
});
