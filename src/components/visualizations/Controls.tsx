"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import type { StepThroughStatus } from "@/lib/hooks/useStepThrough";

export type ControlsProps = {
  status: StepThroughStatus;
  speed: number;
  arraySize: number;
  reducedMotion: boolean;
  canStepBack: boolean;
  canStepForward: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onReset: () => void;
  onSpeedChange: (ms: number) => void;
  onArraySizeChange: (n: number) => void;
  minSpeedMs?: number;
  maxSpeedMs?: number;
  minArraySize?: number;
  maxArraySize?: number;
};

const buttonClasses =
  "inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900";

export function Controls({
  status,
  speed,
  arraySize,
  reducedMotion,
  canStepBack,
  canStepForward,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onReset,
  onSpeedChange,
  onArraySizeChange,
  minSpeedMs = 32,
  maxSpeedMs = 800,
  minArraySize = 4,
  maxArraySize = 60,
}: ControlsProps) {
  const isPlaying = status === "playing";
  const playLabel = isPlaying ? "Pause" : "Play";
  const PlayIcon = isPlaying ? Pause : Play;
  const playDisabled = reducedMotion;

  return (
    <div className="flex flex-col gap-4">
      <div role="toolbar" aria-label="Playback controls" className="flex items-center gap-2">
        <button
          type="button"
          onClick={onStepBack}
          disabled={!canStepBack}
          aria-label="Step backward"
          className={buttonClasses}
        >
          <SkipBack className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          disabled={playDisabled}
          aria-label={playDisabled ? "Auto-play disabled by reduced-motion preference" : playLabel}
          aria-pressed={isPlaying}
          className={buttonClasses}
        >
          <PlayIcon className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onStepForward}
          disabled={!canStepForward}
          aria-label="Step forward"
          className={buttonClasses}
        >
          <SkipForward className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset"
          className={`${buttonClasses} ml-2`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="flex items-center justify-between">
            <span>Step delay</span>
            <span className="font-mono text-zinc-500">{speed} ms</span>
          </span>
          <input
            type="range"
            min={minSpeedMs}
            max={maxSpeedMs}
            step={8}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-full accent-zinc-700 dark:accent-zinc-300"
            aria-label="Step delay in milliseconds"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="flex items-center justify-between">
            <span>Array size</span>
            <span className="font-mono text-zinc-500">{arraySize}</span>
          </span>
          <input
            type="range"
            min={minArraySize}
            max={maxArraySize}
            step={1}
            value={arraySize}
            onChange={(e) => onArraySizeChange(Number(e.target.value))}
            className="w-full accent-zinc-700 dark:accent-zinc-300"
            aria-label="Array size"
          />
        </label>
      </div>

      {reducedMotion && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Auto-play is disabled while your system has reduced motion enabled. Use the step buttons
          to advance manually.
        </p>
      )}
    </div>
  );
}
