import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RaceViz } from "@/components/visualizations/RaceViz";

describe("RaceViz", () => {
  it("renders three slots, each with its own bars and counters", () => {
    render(<RaceViz initialSize={8} />);
    const slots = screen.getAllByLabelText(/race slot$/);
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(within(slot).getByText(/Compares/)).toBeInTheDocument();
      expect(within(slot).getByText(/Swaps/)).toBeInTheDocument();
      expect(within(slot).getByText(/Step$/)).toBeInTheDocument();
    }
  });

  it("starts every slot at step 0/N with status 'idle'", () => {
    render(<RaceViz initialSize={6} initial={["bubble", "merge", "quick"]} />);
    const slots = screen.getAllByLabelText(/race slot$/);
    for (const slot of slots) {
      expect(slot.textContent).toMatch(/Step\s*0\/\d+/);
      expect(slot.textContent).toMatch(/Compares\s*0/);
      expect(slot.textContent).toMatch(/Swaps\s*0/);
    }
  });

  it("step forward advances every slot's step counter by one", async () => {
    render(<RaceViz initialSize={6} initial={["bubble", "merge", "quick"]} />);
    await userEvent.click(screen.getByRole("button", { name: /Step forward/ }));
    const slots = screen.getAllByLabelText(/race slot$/);
    for (const slot of slots) {
      expect(slot.textContent).toMatch(/Step\s*1\/\d+/);
    }
  });

  it("changing a dropdown swaps the algorithm in just that slot", async () => {
    render(<RaceViz initialSize={6} initial={["bubble", "merge", "quick"]} />);
    const slot1Select = screen.getByRole("combobox", { name: /Algorithm for slot 1/ });
    await userEvent.selectOptions(slot1Select, "heap");
    const slots = screen.getAllByLabelText(/race slot$/);
    expect(slots[0].getAttribute("aria-label")).toContain("Heap Sort");
    expect(slots[1].getAttribute("aria-label")).toContain("Merge Sort");
    expect(slots[2].getAttribute("aria-label")).toContain("Quick Sort");
  });

  it("renders a shared playback toolbar", () => {
    render(<RaceViz initialSize={6} />);
    const toolbar = screen.getByRole("toolbar", { name: /Playback/ });
    expect(within(toolbar).getByRole("button", { name: /Step forward/ })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /Step backward/ })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /Reset/ })).toBeInTheDocument();
  });
});
