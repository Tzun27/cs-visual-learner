"use client";

import type { ReactNode } from "react";
import { useMathLevel, type MathLevel as MathLevelValue } from "@/lib/hooks/useMathLevel";

const LEVELS: ReadonlyArray<{ value: MathLevelValue; label: string }> = [
  { value: "intuition", label: "Intuition" },
  { value: "math", label: "With math" },
];

export function MathLevel({ className }: { className?: string }) {
  const { level, setLevel } = useMathLevel();
  return (
    <div
      role="group"
      aria-label="Math level"
      className={
        className ??
        "not-prose flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50/50 p-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
      }
    >
      <span className="text-[11px] tracking-wider text-zinc-500 uppercase">Math level</span>
      {LEVELS.map((opt) => {
        const selected = level === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLevel(opt.value)}
            aria-pressed={selected}
            className={`rounded border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none ${
              selected
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function IntuitionOnly({ children }: { children: ReactNode }) {
  const { level } = useMathLevel();
  if (level !== "intuition") return null;
  return <>{children}</>;
}

export function MathOnly({ children }: { children: ReactNode }) {
  const { level } = useMathLevel();
  if (level !== "math") return null;
  return <>{children}</>;
}
