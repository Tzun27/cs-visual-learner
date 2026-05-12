import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMathLevel } from "@/lib/hooks/useMathLevel";

const STORAGE_KEY = "ml.mathLevel";

describe("useMathLevel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to 'intuition' when nothing is persisted", () => {
    const { result } = renderHook(() => useMathLevel());
    expect(result.current.level).toBe("intuition");
  });

  it("reads a persisted 'math' value from localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "math");
    const { result } = renderHook(() => useMathLevel());
    expect(result.current.level).toBe("math");
  });

  it("ignores an invalid persisted value and uses the default", () => {
    window.localStorage.setItem(STORAGE_KEY, "garbage");
    const { result } = renderHook(() => useMathLevel());
    expect(result.current.level).toBe("intuition");
  });

  it("setLevel updates state and writes to localStorage", () => {
    const { result } = renderHook(() => useMathLevel());
    act(() => result.current.setLevel("math"));
    expect(result.current.level).toBe("math");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("math");
  });

  it("two independent consumers stay in sync after setLevel", () => {
    const a = renderHook(() => useMathLevel());
    const b = renderHook(() => useMathLevel());
    act(() => a.result.current.setLevel("math"));
    expect(a.result.current.level).toBe("math");
    expect(b.result.current.level).toBe("math");
  });

  it("falls back to default when localStorage.getItem throws", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    try {
      const { result } = renderHook(() => useMathLevel());
      expect(result.current.level).toBe("intuition");
    } finally {
      spy.mockRestore();
    }
  });

  it("swallows errors from localStorage.setItem without crashing", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    try {
      const { result } = renderHook(() => useMathLevel());
      expect(() => act(() => result.current.setLevel("math"))).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
