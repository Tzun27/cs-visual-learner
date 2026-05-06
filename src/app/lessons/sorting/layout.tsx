import type { ReactNode } from "react";

export default function SortingLayout({ children }: { children: ReactNode }) {
  return (
    <article className="prose prose-zinc dark:prose-invert mx-auto w-full max-w-3xl px-6 py-12">
      {children}
    </article>
  );
}
