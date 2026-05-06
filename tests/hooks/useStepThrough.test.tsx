import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStepThrough } from "@/lib/hooks/useStepThrough";

const STEPS = ["a", "b", "c", "d"] as const;

describe("useStepThrough", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in 'idle' with stepIndex -1", () => {
    const { result } = renderHook(() => useStepThrough(STEPS));
    expect(result.current.status).toBe("idle");
    expect(result.current.stepIndex).toBe(-1);
    expect(result.current.currentStep).toBeUndefined();
  });

  it("stepForward advances and pauses", () => {
    const { result } = renderHook(() => useStepThrough(STEPS));
    act(() => result.current.stepForward());
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.currentStep).toBe("a");
    expect(result.current.status).toBe("paused");
  });

  it("stepForward at the last step transitions to 'done'", () => {
    const { result } = renderHook(() => useStepThrough(["x"]));
    act(() => result.current.stepForward());
    expect(result.current.status).toBe("done");
    expect(result.current.stepIndex).toBe(0);
  });

  it("stepBackward goes back, and to 'idle' from index 0", () => {
    const { result } = renderHook(() => useStepThrough(STEPS));
    act(() => {
      result.current.stepForward();
      result.current.stepForward();
    });
    expect(result.current.stepIndex).toBe(1);
    act(() => result.current.stepBackward());
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.status).toBe("paused");
    act(() => result.current.stepBackward());
    expect(result.current.stepIndex).toBe(-1);
    expect(result.current.status).toBe("idle");
  });

  it("stepBackward is a no-op at index -1", () => {
    const { result } = renderHook(() => useStepThrough(STEPS));
    act(() => result.current.stepBackward());
    expect(result.current.stepIndex).toBe(-1);
  });

  it("play advances automatically on a timer", () => {
    const { result } = renderHook(() => useStepThrough(STEPS, { initialSpeed: 100 }));
    act(() => result.current.play());
    expect(result.current.status).toBe("playing");

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.stepIndex).toBe(0);

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.stepIndex).toBe(1);
  });

  it("playback halts at the final step with status 'done'", () => {
    const { result } = renderHook(() => useStepThrough(["x", "y"], { initialSpeed: 50 }));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(50));
    expect(result.current.stepIndex).toBe(0);
    act(() => vi.advanceTimersByTime(50));
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.status).toBe("done");
  });

  it("pause stops the timer", () => {
    const { result } = renderHook(() => useStepThrough(STEPS, { initialSpeed: 100 }));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.pause());
    expect(result.current.status).toBe("paused");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.stepIndex).toBe(0);
  });

  it("reset returns to idle at index -1", () => {
    const { result } = renderHook(() => useStepThrough(STEPS, { initialSpeed: 100 }));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(250));
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.stepIndex).toBe(-1);
  });

  it("setSpeed clamps to a sane minimum", () => {
    const { result } = renderHook(() => useStepThrough(STEPS, { initialSpeed: 200 }));
    act(() => result.current.setSpeed(0));
    expect(result.current.speed).toBeGreaterThan(0);
    act(() => result.current.setSpeed(500));
    expect(result.current.speed).toBe(500);
  });

  it("reduced-motion blocks play() but allows manual stepping", () => {
    const { result } = renderHook(() =>
      useStepThrough(STEPS, { initialSpeed: 100, reducedMotion: true }),
    );
    act(() => result.current.play());
    expect(result.current.status).toBe("idle");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.stepIndex).toBe(-1);

    act(() => result.current.stepForward());
    expect(result.current.stepIndex).toBe(0);
  });

  it("changing the steps array resets index when out-of-range", () => {
    let steps: readonly string[] = ["a", "b", "c"];
    const { result, rerender } = renderHook(() => useStepThrough(steps));
    act(() => {
      result.current.stepForward();
      result.current.stepForward();
    });
    expect(result.current.stepIndex).toBe(1);
    steps = ["x"];
    rerender();
    expect(result.current.stepIndex).toBe(-1);
    expect(result.current.status).toBe("idle");
  });
});
