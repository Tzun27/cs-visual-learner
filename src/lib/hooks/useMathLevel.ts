"use client";

import { useCallback, useSyncExternalStore } from "react";

export type MathLevel = "intuition" | "math";

const STORAGE_KEY = "ml.mathLevel";
const CHANGE_EVENT = "ml:mathLevelChange";
const DEFAULT_LEVEL: MathLevel = "intuition";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): MathLevel {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "intuition" || raw === "math") return raw;
  } catch {
    // localStorage access can throw in sandboxed iframes / private mode.
  }
  return DEFAULT_LEVEL;
}

function getServerSnapshot(): MathLevel {
  return DEFAULT_LEVEL;
}

export type MathLevelState = {
  readonly level: MathLevel;
  readonly setLevel: (next: MathLevel) => void;
};

export function useMathLevel(): MathLevelState {
  const level = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLevel = useCallback((next: MathLevel) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // see getSnapshot
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return { level, setLevel };
}
