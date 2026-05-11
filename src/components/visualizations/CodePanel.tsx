"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BundledLanguage, ThemedTokenWithVariants } from "shiki";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

export type CodePanelProps = {
  source: string;
  highlightedLines?: readonly number[];
  language?: string;
  ariaLabel?: string;
  className?: string;
};

type LineTokens = ThemedTokenWithVariants[];

export function CodePanel({
  source,
  highlightedLines,
  language,
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

  const [tokenLines, setTokenLines] = useState<readonly LineTokens[] | null>(null);

  useEffect(() => {
    if (!language) return;
    let cancelled = false;
    const lang = language as BundledLanguage;
    (async () => {
      const { getSingletonHighlighter } = await import("shiki");
      const hl = await getSingletonHighlighter({
        langs: [lang],
        themes: ["github-light", "github-dark"],
      });
      if (cancelled) return;
      const result = hl.codeToTokensWithThemes(source, {
        lang,
        themes: { light: "github-light", dark: "github-dark" },
      });
      if (!cancelled) setTokenLines(result);
    })().catch(() => {
      // Silently fall back to plain text on any tokenizer failure.
    });
    return () => {
      cancelled = true;
    };
  }, [source, language]);

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
      <div
        ref={scrollRootRef}
        tabIndex={0}
        className="max-h-72 overflow-auto rounded p-3 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none md:max-h-[28rem]"
      >
        <pre className="m-0 font-mono text-xs leading-relaxed sm:text-sm">
          {lines.map((line, i) => {
            const lineNumber = i + 1;
            const highlighted = highlightSet.has(lineNumber);
            const tokens = tokenLines?.[i];
            return (
              <span
                key={lineNumber}
                data-line={lineNumber}
                data-highlighted={highlighted ? "true" : undefined}
                aria-current={highlighted ? "step" : undefined}
                className={[
                  "block rounded pr-2 pl-11 -indent-9 whitespace-pre-wrap motion-safe:transition-colors",
                  highlighted
                    ? "bg-amber-200/70 text-zinc-900 dark:bg-amber-400/25 dark:text-amber-50"
                    : "",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="mr-3 inline-block w-6 text-right text-zinc-500 tabular-nums select-none dark:text-zinc-400"
                >
                  {lineNumber}
                </span>
                {tokens ? (
                  <span>{tokens.map((token, j) => renderToken(token, j))}</span>
                ) : (
                  <span>{line.length === 0 ? " " : line}</span>
                )}
              </span>
            );
          })}
        </pre>
      </div>
    </section>
  );
}

function renderToken(token: ThemedTokenWithVariants, key: number) {
  const lightColor = token.variants.light?.color;
  const darkColor = token.variants.dark?.color;
  const style = {
    "--shiki-light": lightColor,
    "--shiki-dark": darkColor,
  } as React.CSSProperties;
  return (
    <span
      key={key}
      style={style}
      className="text-[color:var(--shiki-light)] dark:text-[color:var(--shiki-dark)]"
    >
      {token.content}
    </span>
  );
}
