// Single source of truth for the lesson catalog. Consumed by the lessons
// index page (`/lessons`) and by `sitemap.ts` — keeping both in one place
// means the sitemap can't drift out of sync with the routes that ship.

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Lesson =
  | { status: "live"; slug: string; title: string; difficulty: Difficulty; blurb: string }
  | { status: "coming-soon"; title: string; difficulty: Difficulty; blurb: string };

export type Topic = {
  title: string;
  description: string;
  pathPrefix: string;
  lessons: readonly Lesson[];
};

export const topics: readonly Topic[] = [
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
        blurb: "Separate chaining: how collisions become linked lists. Add, contains, and remove.",
      },
      {
        status: "live",
        slug: "linear-probing",
        title: "Hash Tables: Linear Probing",
        difficulty: "intermediate",
        blurb: "Open addressing — keys live in a single flat array. Why deletes leave tombstones.",
      },
      {
        status: "live",
        slug: "quadratic-probing",
        title: "Hash Tables: Quadratic Probing",
        difficulty: "intermediate",
        blurb:
          "Same flat array, different probe sequence — gaps grow as i² instead of i. Breaks up clustering.",
      },
      {
        status: "live",
        slug: "double-hashing",
        title: "Hash Tables: Double Hashing",
        difficulty: "intermediate",
        blurb:
          "A second hash function decides the probe step — different keys with the same home walk different paths.",
      },
      {
        status: "live",
        slug: "hopscotch",
        title: "Hash Tables: Hopscotch Hashing",
        difficulty: "intermediate",
        blurb:
          "Bounded lookup via a per-slot hop bitmask. Inserts swap keys backwards to keep the H-neighborhood invariant.",
      },
      {
        status: "live",
        slug: "cuckoo-hashing",
        title: "Hash Tables: Cuckoo Hashing",
        difficulty: "intermediate",
        blurb:
          "Two tables, two hash functions, constant-cost lookups. Inserts evict and cascade until a key finds an empty slot.",
      },
      {
        status: "live",
        slug: "cuckoo-filter",
        title: "Cuckoo Filter",
        difficulty: "intermediate",
        blurb:
          "Probabilistic set built on cuckoo hashing — stores fingerprints, not keys. Constant-cost contains + supports delete (caveat included).",
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
      {
        status: "live",
        slug: "pairing-heap",
        title: "Pairing Heap",
        difficulty: "intermediate",
        blurb:
          "A heap built around fast merge. Insert is O(1), merge is O(1), delete-min is amortized O(log n).",
      },
    ],
  },
  {
    title: "Machine learning intuitions",
    description:
      "Visualizations that build intuition for ML internals — every lesson has a math-level toggle so you can read it as casual prose or with the chain rule and ∇L in plain sight.",
    pathPrefix: "/lessons/ml",
    lessons: [
      {
        status: "live",
        slug: "gradient-descent",
        title: "Gradient Descent",
        difficulty: "beginner",
        blurb:
          "Watch the optimizer walk down a 2D loss landscape — pick an lr, see the trajectory bend.",
      },
      {
        status: "live",
        slug: "backprop",
        title: "Backpropagation",
        difficulty: "intermediate",
        blurb:
          "One forward + one backward pass on a 2 → 2 → 1 ReLU MLP — chain rule made concrete.",
      },
      {
        status: "live",
        slug: "attention",
        title: "Attention",
        difficulty: "advanced",
        blurb:
          "Single attention head over 3 tokens, decomposed into Q, K, V — plus positional encoding and causal masking, the two pieces every real transformer adds.",
      },
      {
        status: "live",
        slug: "multi-head-attention",
        title: "Multi-Head Attention",
        difficulty: "advanced",
        blurb:
          "Stack two attention heads in parallel, concatenate, project through W_O — the operation at the heart of every transformer block.",
      },
    ],
  },
];

/** Routable paths for every live lesson, e.g. `/lessons/sorting/bubble-sort`. */
export const liveLessonPaths: readonly string[] = topics.flatMap((topic) =>
  topic.lessons
    .filter((lesson): lesson is Extract<Lesson, { status: "live" }> => lesson.status === "live")
    .map((lesson) => `${topic.pathPrefix}/${lesson.slug}`),
);
