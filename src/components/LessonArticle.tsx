import type { ReactNode } from "react";

/** The shared `prose` article shell wrapping MDX lesson pages. */
export function LessonArticle({ children }: { children: ReactNode }) {
  return (
    <article className="prose prose-zinc dark:prose-invert mx-auto w-full max-w-3xl px-6 py-12">
      {children}
    </article>
  );
}
