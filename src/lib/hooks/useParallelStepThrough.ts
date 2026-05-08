"use client";

import { useCallback, useEffect, useReducer } from "react";

export type ParallelStatus = "idle" | "playing" | "paused" | "done";

export type ParallelStepThroughOptions = {
  initialSpeed?: number;
  reducedMotion?: boolean;
};

export type ParallelStepThroughApi = {
  status: ParallelStatus;
  indexes: readonly number[];
  speed: number;
  reducedMotion: boolean;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  reset: () => void;
  setSpeed: (ms: number) => void;
};

type State = {
  status: ParallelStatus;
  indexes: number[];
  speed: number;
};

type Action =
  | { type: "play" }
  | { type: "pause" }
  | { type: "stepForward"; totals: readonly number[] }
  | { type: "stepBackward" }
  | { type: "reset"; count: number }
  | { type: "setSpeed"; speed: number }
  | { type: "syncTotals"; totals: readonly number[] };

const DEFAULT_SPEED_MS = 250;
const MIN_SPEED_MS = 16;

function lastIndex(total: number): number {
  return total - 1;
}

function allDone(indexes: readonly number[], totals: readonly number[]): boolean {
  let hasWork = false;
  for (let i = 0; i < totals.length; i++) {
    const t = totals[i] ?? 0;
    if (t > 0) {
      hasWork = true;
      if ((indexes[i] ?? -1) < lastIndex(t)) return false;
    }
  }
  return hasWork;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "play":
      if (state.status === "playing" || state.status === "done") return state;
      return { ...state, status: "playing" };
    case "pause":
      if (state.status !== "playing") return state;
      return { ...state, status: "paused" };
    case "stepForward": {
      const next = state.indexes.map((idx, i) => {
        const total = action.totals[i] ?? 0;
        if (total === 0) return -1;
        return Math.min(idx + 1, lastIndex(total));
      });
      const done = allDone(next, action.totals);
      const status: ParallelStatus = done
        ? "done"
        : state.status === "playing"
          ? "playing"
          : "paused";
      return { ...state, indexes: next, status };
    }
    case "stepBackward": {
      const next = state.indexes.map((idx) => Math.max(idx - 1, -1));
      const allBeforeStart = next.every((i) => i === -1);
      const status: ParallelStatus = allBeforeStart ? "idle" : "paused";
      return { ...state, indexes: next, status };
    }
    case "reset":
      return {
        ...state,
        indexes: Array.from({ length: action.count }, () => -1),
        status: "idle",
      };
    case "setSpeed":
      return { ...state, speed: Math.max(MIN_SPEED_MS, action.speed) };
    case "syncTotals": {
      if (state.indexes.length !== action.totals.length) {
        return {
          ...state,
          indexes: Array.from({ length: action.totals.length }, () => -1),
          status: "idle",
        };
      }
      const indexes = state.indexes.map((idx, i) => {
        const total = action.totals[i] ?? 0;
        if (idx >= total) return -1;
        return idx;
      });
      const indexesChanged = indexes.some((v, i) => v !== state.indexes[i]);
      if (!indexesChanged) return state;
      const allReset = indexes.every((v) => v === -1);
      return { ...state, indexes, status: allReset ? "idle" : state.status };
    }
  }
}

export function useParallelStepThrough(
  totals: readonly number[],
  options: ParallelStepThroughOptions = {},
): ParallelStepThroughApi {
  const { initialSpeed = DEFAULT_SPEED_MS, reducedMotion = false } = options;

  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): State => ({
      status: "idle",
      indexes: Array.from({ length: totals.length }, () => -1),
      speed: Math.max(MIN_SPEED_MS, initialSpeed),
    }),
  );

  // Encode totals as a primitive so effects only re-fire when content changes,
  // not when the caller passes a new-but-equal array reference.
  const totalsKey = totals.join(",");

  useEffect(() => {
    dispatch({ type: "syncTotals", totals });
    // totals array is captured but only its content matters; key dep guards re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalsKey]);

  useEffect(() => {
    if (state.status !== "playing") return;
    if (reducedMotion) return;
    const id = window.setTimeout(() => {
      dispatch({ type: "stepForward", totals });
    }, state.speed);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.indexes, state.speed, reducedMotion, totalsKey]);

  const play = useCallback(() => {
    if (reducedMotion) return;
    dispatch({ type: "play" });
  }, [reducedMotion]);

  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  const stepForward = useCallback(
    () => dispatch({ type: "stepForward", totals }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totalsKey],
  );
  const stepBackward = useCallback(() => dispatch({ type: "stepBackward" }), []);
  const reset = useCallback(
    () => dispatch({ type: "reset", count: totals.length }),
    [totals.length],
  );
  const setSpeed = useCallback((ms: number) => dispatch({ type: "setSpeed", speed: ms }), []);

  return {
    status: state.status,
    indexes: state.indexes,
    speed: state.speed,
    reducedMotion,
    play,
    pause,
    stepForward,
    stepBackward,
    reset,
    setSpeed,
  };
}
