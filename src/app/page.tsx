import Link from "next/link";
import { SortingViz } from "@/components/visualizations/SortingViz";

const lessons = [
  {
    slug: "bubble-sort",
    title: "Bubble Sort",
    blurb: "Watch the largest values bubble to the end one swap at a time. Feel the quadratic.",
  },
  {
    slug: "insertion-sort",
    title: "Insertion Sort",
    blurb: "Slide each new value into its place in the sorted prefix. Quadratic, but quietly so.",
  },
  {
    slug: "merge-sort",
    title: "Merge Sort",
    blurb: "Divide-and-conquer in motion. Sub-ranges shrink, then merge.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <section aria-labelledby="hero-title" className="flex flex-col gap-6">
        <h1
          id="hero-title"
          className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
        >
          Learn computer science by{" "}
          <span className="text-zinc-500 dark:text-zinc-400">watching it run.</span>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-pretty text-zinc-600 dark:text-zinc-400">
          Step through algorithms in real time. Scrub backwards. Change the inputs. Build the kind
          of intuition that comes from <em>seeing</em> things, not just reading about them.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/lessons"
            className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Browse lessons
          </Link>
          <Link
            href="/lessons/sorting/bubble-sort"
            className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-200 px-5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Start with bubble sort
          </Link>
        </div>
      </section>

      <section aria-labelledby="demo-title" className="mt-16">
        <h2 id="demo-title" className="text-sm font-medium tracking-wider text-zinc-500 uppercase">
          A small taste
        </h2>
        <div className="mt-4">
          <SortingViz algorithm="bubble" initialSize={12} initialSpeedMs={140} />
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          That&apos;s bubble sort. Each lesson has prose, math, and an interactive playground like
          this one.
        </p>
      </section>

      <section aria-labelledby="what" className="mt-20">
        <h2 id="what" className="text-2xl font-semibold tracking-tight">
          What you&apos;ll learn first
        </h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Start with three classic sorts — each a different approach to the same problem. More on
          the{" "}
          <Link
            href="/lessons"
            className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            lessons page
          </Link>
          .
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {lessons.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/lessons/sorting/${l.slug}`}
                className="block h-full rounded-lg border border-zinc-200 p-5 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="font-medium">{l.title}</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{l.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="mt-20">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <p className="text-zinc-600 dark:text-zinc-400">
            Every visualization is driven by the actual algorithm — not a pre-recorded animation.
            The algorithm yields one event at a time (a comparison, a swap, a write), and the
            renderer plays them back. You can step forward, step back, change the input size, and
            re-run.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            Reduced-motion users get manual stepping with no auto-play. Everything is keyboard
            navigable. Color is never the only signal — shape and label always carry the meaning
            too.
          </p>
        </div>
      </section>

      <section className="mt-20 border-t border-zinc-200 pt-8 text-sm text-zinc-500 dark:border-zinc-800">
        <p>
          Three pillars are live — sorting, data structures, and machine-learning intuitions — and
          more lessons land in each as the project grows. If you have a topic you&apos;d like to
          see, open an issue.
        </p>
      </section>
    </main>
  );
}
