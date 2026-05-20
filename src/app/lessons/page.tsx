import Link from "next/link";
import { type Difficulty, topics } from "@/lib/lessons";

export const metadata = {
  title: "Lessons",
  description: "Browse interactive computer science lessons.",
};

const difficultyStyles: Record<Difficulty, string> = {
  beginner: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  intermediate: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  advanced: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${difficultyStyles[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}

export default function LessonsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Lessons</h1>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Each lesson combines short prose with an interactive visualization you can step through. New
        topics are added as the project grows.
      </p>

      <div className="mt-12 flex flex-col gap-14">
        {topics.map((topic) => (
          <section key={topic.title} aria-labelledby={`topic-${topic.title}`}>
            <h2 id={`topic-${topic.title}`} className="text-xl font-semibold tracking-tight">
              {topic.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{topic.description}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {topic.lessons.map((l) =>
                l.status === "live" ? (
                  <li key={l.slug}>
                    <Link
                      href={`${topic.pathPrefix}/${l.slug}`}
                      className="flex h-full flex-col rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{l.title}</span>
                        <DifficultyBadge difficulty={l.difficulty} />
                      </div>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{l.blurb}</p>
                    </Link>
                  </li>
                ) : (
                  <li key={l.title}>
                    <div
                      aria-disabled
                      className="flex h-full flex-col rounded-lg border border-dashed border-zinc-200 p-4 opacity-70 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-500">{l.title}</span>
                        <DifficultyBadge difficulty={l.difficulty} />
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">{l.blurb}</p>
                      <span className="mt-3 text-xs tracking-wider text-zinc-400 uppercase">
                        Coming soon
                      </span>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
