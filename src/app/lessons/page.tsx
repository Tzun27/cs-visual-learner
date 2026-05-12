import Link from "next/link";

export const metadata = {
  title: "Lessons",
  description: "Browse interactive computer science lessons.",
};

type Difficulty = "beginner" | "intermediate" | "advanced";

type Lesson =
  | { status: "live"; slug: string; title: string; difficulty: Difficulty; blurb: string }
  | { status: "coming-soon"; title: string; difficulty: Difficulty; blurb: string };

type Topic = {
  title: string;
  description: string;
  pathPrefix: string;
  lessons: readonly Lesson[];
};

const topics: readonly Topic[] = [
  {
    title: "Sorting algorithms",
    description:
      "Six classic sorts — comparison-based and not — six different ways to think about ordering data.",
    pathPrefix: "/lessons/sorting",
    lessons: [
      {
        status: "live",
        slug: "bubble-sort",
        title: "Bubble Sort",
        difficulty: "beginner",
        blurb: "Adjacent swaps until everything is in place. The simplest sort.",
      },
      {
        status: "live",
        slug: "merge-sort",
        title: "Merge Sort",
        difficulty: "intermediate",
        blurb: "Divide-and-conquer with a guaranteed O(n log n) ceiling.",
      },
      {
        status: "live",
        slug: "quick-sort",
        title: "Quick Sort",
        difficulty: "intermediate",
        blurb: "Pick a pivot, partition, recurse. Fast on average.",
      },
      {
        status: "live",
        slug: "insertion-sort",
        title: "Insertion Sort",
        difficulty: "beginner",
        blurb: "How most people sort cards in their hand.",
      },
      {
        status: "live",
        slug: "heap-sort",
        title: "Heap Sort",
        difficulty: "intermediate",
        blurb: "An in-place O(n log n) sort built on a binary heap.",
      },
      {
        status: "live",
        slug: "radix-sort",
        title: "Radix Sort",
        difficulty: "intermediate",
        blurb: "Sorting without comparisons, one digit at a time.",
      },
      {
        status: "live",
        slug: "compare",
        title: "Compare Sorts",
        difficulty: "intermediate",
        blurb: "Race three algorithms on the same input. Pick any pair from the dropdowns.",
      },
    ],
  },
  {
    title: "Data structures",
    description:
      "How values get organized so that lookup, insert, and delete stay fast — and what breaks when the structure goes wrong.",
    pathPrefix: "/lessons/data-structures",
    lessons: [
      {
        status: "live",
        slug: "binary-search-tree",
        title: "Binary Search Trees",
        difficulty: "intermediate",
        blurb: "Watch insertion order decide whether lookups stay O(log n) or collapse to O(n).",
      },
      {
        status: "live",
        slug: "hash-tables",
        title: "Hash Tables",
        difficulty: "intermediate",
        blurb: "Collision strategies, load factor, and when O(1) is a lie.",
      },
      {
        status: "live",
        slug: "tree-traversal",
        title: "Tree Traversal",
        difficulty: "beginner",
        blurb:
          "Four ways to walk a tree — preorder, inorder, postorder, level-order — side by side.",
      },
      {
        status: "live",
        slug: "heap",
        title: "Heaps & Priority Queues",
        difficulty: "intermediate",
        blurb: "The data structure behind heap sort and Dijkstra.",
      },
    ],
  },
  {
    title: "Machine learning intuitions",
    description: "Coming soon. Visualizations that build intuition for ML internals.",
    pathPrefix: "/lessons/ml",
    lessons: [
      {
        status: "coming-soon",
        title: "Gradient Descent",
        difficulty: "beginner",
        blurb: "Watch the optimizer walk down a loss landscape.",
      },
      {
        status: "coming-soon",
        title: "Backpropagation",
        difficulty: "intermediate",
        blurb: "How a network learns by reverse-mode differentiation.",
      },
      {
        status: "coming-soon",
        title: "Transformer Attention",
        difficulty: "advanced",
        blurb: "The attention head, decomposed into Q, K, V — and what each one is doing.",
      },
    ],
  },
];

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
