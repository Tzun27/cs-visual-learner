"use client";

import { useCallback, useEffect, useReducer } from "react";

export type StepThroughStatus = "idle" | "playing" | "paused" | "done";

export type StepThroughOptions = {
  initialSpeed?: number;
  reducedMotion?: boolean;
};

export type StepThroughApi<T> = {
  steps: readonly T[];
  status: StepThroughStatus;
  stepIndex: number;
  currentStep: T | undefined;
  speed: number;
  reducedMotion: boolean;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  reset: () => void;
  setSpeed: (ms: number) => void;
  runToCompletion: () => void;
};

type State = {
  status: StepThroughStatus;
  stepIndex: number;
  speed: number;
};

type Action =
  | { type: "play" }
  | { type: "pause" }
  | { type: "stepForward"; total: number }
  | { type: "stepBackward" }
  | { type: "reset" }
  | { type: "setSpeed"; speed: number }
  | { type: "syncTotal"; total: number }
  | { type: "jumpToEnd"; total: number };

const DEFAULT_SPEED_MS = 250;
const MIN_SPEED_MS = 16;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "play":
      if (state.status === "playing" || state.status === "done") return state;
      return { ...state, status: "playing" };
    case "pause":
      if (state.status !== "playing") return state;
      return { ...state, status: "paused" };
    case "stepForward": {
      if (action.total === 0) return { ...state, status: "done" };
      const last = action.total - 1;
      const next = Math.min(state.stepIndex + 1, last);
      if (next === last) return { ...state, stepIndex: next, status: "done" };
      const status: StepThroughStatus = state.status === "playing" ? "playing" : "paused";
      return { ...state, stepIndex: next, status };
    }
    case "stepBackward": {
      const next = Math.max(state.stepIndex - 1, -1);
      const status: StepThroughStatus = next === -1 ? "idle" : "paused";
      return { ...state, stepIndex: next, status };
    }
    case "reset":
      return { ...state, stepIndex: -1, status: "idle" };
    case "setSpeed":
      return { ...state, speed: Math.max(MIN_SPEED_MS, action.speed) };
    case "syncTotal":
      if (state.stepIndex >= action.total) {
        return { ...state, stepIndex: -1, status: "idle" };
      }
      return state;
    case "jumpToEnd":
      if (action.total === 0) return { ...state, status: "done" };
      return { ...state, stepIndex: action.total - 1, status: "done" };
  }
}

export function useStepThrough<T>(
  steps: readonly T[],
  options: StepThroughOptions = {},
): StepThroughApi<T> {
  const { initialSpeed = DEFAULT_SPEED_MS, reducedMotion = false } = options;

  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): State => ({
      status: "idle",
      stepIndex: -1,
      speed: Math.max(MIN_SPEED_MS, initialSpeed),
    }),
  );

  const total = steps.length;

  useEffect(() => {
    dispatch({ type: "syncTotal", total });
  }, [total]);

  useEffect(() => {
    if (state.status !== "playing") return;
    if (reducedMotion) return;
    const id = window.setTimeout(() => {
      dispatch({ type: "stepForward", total });
    }, state.speed);
    return () => window.clearTimeout(id);
  }, [state.status, state.stepIndex, state.speed, reducedMotion, total]);

  const play = useCallback(() => {
    if (reducedMotion) return;
    dispatch({ type: "play" });
  }, [reducedMotion]);

  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  const stepForward = useCallback(() => dispatch({ type: "stepForward", total }), [total]);
  const stepBackward = useCallback(() => dispatch({ type: "stepBackward" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const setSpeed = useCallback((ms: number) => dispatch({ type: "setSpeed", speed: ms }), []);
  const runToCompletion = useCallback(() => {
    if (reducedMotion) {
      dispatch({ type: "jumpToEnd", total });
      return;
    }
    dispatch({ type: "play" });
  }, [reducedMotion, total]);

  return {
    steps,
    status: state.status,
    stepIndex: state.stepIndex,
    currentStep: state.stepIndex >= 0 ? steps[state.stepIndex] : undefined,
    speed: state.speed,
    reducedMotion,
    play,
    pause,
    stepForward,
    stepBackward,
    reset,
    setSpeed,
    runToCompletion,
  };
}
