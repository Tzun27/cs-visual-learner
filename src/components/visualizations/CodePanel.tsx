"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

export type CodePanelProps = {
  source: string;
  highlightedLines?: readonly number[];
  ariaLabel?: string;
  className?: string;
};

export function CodePanel({
  source,
  highlightedLines,
  ariaLabel = "Algorithm pseudocode",
  className,
}: CodePanelProps) {
  const lines = useMemo(() => source.replace(/\n$/, "").split("\n"), [source]);
  const highlightSet = useMemo(() => new Set(highlightedLines ?? []), [highlightedLines]);
  const firstHighlight = highlightedLines?.[0];
  const announcement =
    firstHighlight === undefined ? "no current line" : `current line ${firstHighlight}`;

  const reducedMotion = useReducedMotion();
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (firstHighlight === undefined) return;
    const root = scrollRootRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(`[data-line="${firstHighlight}"]`);
    if (!target) return;
    const targetTop = target.offsetTop - root.offsetTop;
    const targetBottom = targetTop + target.offsetHeight;
    const visibleTop = root.scrollTop;
    const visibleBottom = visibleTop + root.clientHeight;
    if (targetTop < visibleTop || targetBottom > visibleBottom) {
      const desired = targetTop - root.clientHeight / 2 + target.offsetHeight / 2;
      root.scrollTo({
        top: Math.max(0, desired),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }, [firstHighlight, reducedMotion]);

  return (
    <section
      aria-label={ariaLabel}
      className={[
        "not-prose flex flex-col rounded-lg border border-zinc-200 bg-zinc-50/50",
        "dark:border-zinc-800 dark:bg-zinc-900/40",
        className ?? "",
      ].join(" ")}
    >
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      <div ref={scrollRootRef} className="max-h-72 overflow-auto p-3 md:max-h-[28rem]">
        <pre className="m-0 font-mono text-xs leading-relaxed sm:text-sm">
          {lines.map((line, i) => {
            const lineNumber = i + 1;
            const highlighted = highlightSet.has(lineNumber);
            return (
              <span
                key={lineNumber}
                data-line={lineNumber}
                data-highlighted={highlighted ? "true" : undefined}
                aria-current={highlighted ? "step" : undefined}
                className={[
                  "block rounded px-2 motion-safe:transition-colors",
                  highlighted
                    ? "bg-amber-200/70 text-zinc-900 dark:bg-amber-400/25 dark:text-amber-50"
                    : "",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="mr-3 inline-block w-6 text-right text-zinc-400 tabular-nums select-none dark:text-zinc-600"
                >
                  {lineNumber}
                </span>
                <span>{line.length === 0 ? " " : line}</span>
              </span>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
