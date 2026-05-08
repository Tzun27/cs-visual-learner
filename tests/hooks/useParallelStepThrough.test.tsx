import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useParallelStepThrough } from "@/lib/hooks/useParallelStepThrough";

describe("useParallelStepThrough", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in 'idle' with every index at -1", () => {
    const { result } = renderHook(() => useParallelStepThrough([3, 5, 2]));
    expect(result.current.status).toBe("idle");
    expect(result.current.indexes).toEqual([-1, -1, -1]);
  });

  it("stepForward advances every list by one and pauses", () => {
    const { result } = renderHook(() => useParallelStepThrough([3, 5, 2]));
    act(() => result.current.stepForward());
    expect(result.current.indexes).toEqual([0, 0, 0]);
    expect(result.current.status).toBe("paused");
  });

  it("lists that finish early stay clamped while others continue", () => {
    const { result } = renderHook(() => useParallelStepThrough([2, 4]));
    act(() => result.current.stepForward());
    act(() => result.current.stepForward());
    expect(result.current.indexes).toEqual([1, 1]);
    expect(result.current.status).toBe("paused");
    act(() => result.current.stepForward());
    // first list is at its last index (1) and clamps; second advances.
    expect(result.current.indexes).toEqual([1, 2]);
    expect(result.current.status).toBe("paused");
    act(() => result.current.stepForward());
    expect(result.current.indexes).toEqual([1, 3]);
    expect(result.current.status).toBe("done");
  });

  it("stepBackward moves every list back, returning to 'idle' at all -1", () => {
    const { result } = renderHook(() => useParallelStepThrough([3, 3]));
    act(() => result.current.stepForward());
    act(() => result.current.stepForward());
    act(() => result.current.stepBackward());
    expect(result.current.indexes).toEqual([0, 0]);
    expect(result.current.status).toBe("paused");
    act(() => result.current.stepBackward());
    expect(result.current.indexes).toEqual([-1, -1]);
    expect(result.current.status).toBe("idle");
  });

  it("play auto-advances on a shared timer until 'done'", () => {
    const { result } = renderHook(() => useParallelStepThrough([2, 3], { initialSpeed: 100 }));
    act(() => result.current.play());
    expect(result.current.status).toBe("playing");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.indexes).toEqual([0, 0]);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.indexes).toEqual([1, 1]);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.indexes).toEqual([1, 2]);
    expect(result.current.status).toBe("done");
  });

  it("pause halts the shared timer", () => {
    const { result } = renderHook(() => useParallelStepThrough([5, 5], { initialSpeed: 100 }));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.indexes).toEqual([0, 0]);
    expect(result.current.status).toBe("paused");
  });

  it("reset zeros out indexes and returns to 'idle'", () => {
    const { result } = renderHook(() => useParallelStepThrough([3, 3]));
    act(() => result.current.stepForward());
    act(() => result.current.stepForward());
    act(() => result.current.reset());
    expect(result.current.indexes).toEqual([-1, -1]);
    expect(result.current.status).toBe("idle");
  });

  it("setSpeed clamps to a sane minimum", () => {
    const { result } = renderHook(() => useParallelStepThrough([3, 3], { initialSpeed: 200 }));
    act(() => result.current.setSpeed(0));
    expect(result.current.speed).toBeGreaterThan(0);
    act(() => result.current.setSpeed(500));
    expect(result.current.speed).toBe(500);
  });

  it("reduced-motion blocks play() but not manual stepping", () => {
    const { result } = renderHook(() =>
      useParallelStepThrough([3, 3], { initialSpeed: 100, reducedMotion: true }),
    );
    act(() => result.current.play());
    expect(result.current.status).toBe("idle");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.indexes).toEqual([-1, -1]);
    act(() => result.current.stepForward());
    expect(result.current.indexes).toEqual([0, 0]);
  });

  it("changing the totals length resets indexes and status", () => {
    let totals: readonly number[] = [3, 3];
    const { result, rerender } = renderHook(() => useParallelStepThrough(totals));
    act(() => result.current.stepForward());
    act(() => result.current.stepForward());
    expect(result.current.indexes).toEqual([1, 1]);
    totals = [3, 3, 3];
    rerender();
    expect(result.current.indexes).toEqual([-1, -1, -1]);
    expect(result.current.status).toBe("idle");
  });

  it("shrinking totals clamps the affected index back to -1", () => {
    let totals: readonly number[] = [5, 5];
    const { result, rerender } = renderHook(() => useParallelStepThrough(totals));
    act(() => result.current.stepForward());
    act(() => result.current.stepForward());
    act(() => result.current.stepForward());
    expect(result.current.indexes).toEqual([2, 2]);
    totals = [5, 2];
    rerender();
    // second slot's previous index (2) is now out of range (last is 1), so it resets.
    expect(result.current.indexes[1]).toBe(-1);
  });

  it("treats empty lists as already done and ignores them in 'done' detection", () => {
    const { result } = renderHook(() => useParallelStepThrough([0, 2]));
    act(() => result.current.stepForward());
    expect(result.current.indexes).toEqual([-1, 0]);
    act(() => result.current.stepForward());
    expect(result.current.indexes).toEqual([-1, 1]);
    expect(result.current.status).toBe("done");
  });

  it("all-empty totals never report 'done'", () => {
    const { result } = renderHook(() => useParallelStepThrough([0, 0]));
    act(() => result.current.stepForward());
    expect(result.current.status).not.toBe("done");
  });
});
