import Link from "next/link";

export const metadata = {
  title: "Lessons",
  description: "Browse interactive computer science lessons.",
};

const lessons = [
  { slug: "bubble-sort", title: "Bubble Sort" },
  { slug: "merge-sort", title: "Merge Sort" },
  { slug: "quick-sort", title: "Quick Sort" },
] as const;

export default function LessonsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Lessons</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Pick an algorithm to step through.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {lessons.map((l) => (
          <li key={l.slug}>
            <Link
              href={`/lessons/sorting/${l.slug}`}
              className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <span className="font-medium">{l.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
