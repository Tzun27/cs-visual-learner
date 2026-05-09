export type CodePanelProps = {
  source: string;
  highlightedLines?: readonly number[];
  ariaLabel?: string;
  className?: string;
};

export function CodePanel({
  source,
  highlightedLines = [],
  ariaLabel = "Algorithm pseudocode",
  className,
}: CodePanelProps) {
  const lines = source.replace(/\n$/, "").split("\n");
  const highlightSet = new Set(highlightedLines);
  const firstHighlight = highlightedLines[0];
  const announcement =
    firstHighlight === undefined ? "no current line" : `current line ${firstHighlight}`;

  return (
    <section
      aria-label={ariaLabel}
      className={[
        "overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50/50 p-3",
        "dark:border-zinc-800 dark:bg-zinc-900/40",
        className ?? "",
      ].join(" ")}
    >
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
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
    </section>
  );
}
