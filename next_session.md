# Next Session Handoff

Quick orientation for the next agent picking up this project.

## Where we are

- **Repo:** https://github.com/Tzun27/cs-visual-learner (public, owner Tzun27)
- **Local path:** `/home/tzun/repos/cs-visual-learner`
- **Branch:** `main`, tracking `origin/main`.
- **Status:** v1 shipped + three post-v1 sorts (insertion, heap, radix) + side-by-side compare page + first data-structures lesson (BST insert + search). Not yet deployed.

Read these before writing code:

1. `AGENTS.md` — repo-level instructions. **Important:** Next.js 16 has breaking changes from training data; consult `node_modules/next/dist/docs/` rather than recalling Next 14/15 patterns from memory.
2. `docs/SPEC.md` — v1 spec, success criteria checklist, walkthrough.
3. `docs/PLAN.md` — phased plan (A scaffolding → B viz core → C content/MDX → D polish/deploy).
4. `docs/TASKS.md` — task breakdown (D6 deploy is the only remaining open item).

## What ships today

- **Six sorting visualizations** at `/lessons/sorting/{bubble,insertion,merge,quick,heap,radix}-sort` — step forward/back, play/pause, speed slider, array-size slider, live comparison/swap counters. (Radix sort is non-comparison-based so its Comparisons counter stays at 0; the Swaps counter doubles as a "writes" counter for it.)
- **Side-by-side compare page** at `/lessons/sorting/compare` — three algorithm slots, each with a dropdown picker, all sharing one input and one playback toolbar. Per-slot step/compare/swap counters; finish indicator shows total step count when a slot completes. Uses `RaceViz` + `useParallelStepThrough`.
- **Binary Search Tree lesson** at `/lessons/data-structures/binary-search-tree` — covers both insert and search.
  - Insert section: `insertSequence` generator + `BSTViz`. Toggle between Balanced and Sorted insert order to see Max depth jump from 4 to 12.
  - Search section: `searchSequence` generator + `BSTSearchViz`, walking a curated mix of hits and misses against the balanced tree. `TreeView` SVG primitive (inorder x-positioning, dynamic row height) is shared between both.
- **Production landing** at `/` with embedded bubble-sort playground.
- **Topic-grouped lesson index** at `/lessons` with live + coming-soon entries (Sorting / Data Structures / ML).
- **MDX lessons** with KaTeX math, Shiki code highlighting, GFM tables.
- **Class-based dark mode** via `next-themes` + Tailwind v4 `@variant dark`.
- **a11y:** WCAG 2.1 AA verified by axe-core in CI; `role="toolbar"`, `aria-pressed` on play/pause, color-blind safe palette (Wong 2011) with shape redundancy, reduced-motion support throughout.
- **SEO:** `metadataBase`, OG/Twitter metadata, edge-runtime OG image at `/opengraph-image.png`, `sitemap.xml`, `robots.txt`.
- **CI:** GitHub Actions runs lint/typecheck/format-check, unit + property tests with 100% coverage on `src/lib/algorithms/`, production build, and Playwright e2e (smoke + lessons + axe).

## Architectural load-bearing decisions

These are easy to miss and expensive to violate:

1. **String-keyed algorithm registry** (`src/lib/algorithms/index.ts`). RSC cannot serialize functions across the server→client boundary. `SortingViz` takes `algorithm: SortAlgorithmKey` (a string) and looks it up via `sortAlgorithms[key]`. Do not change this to pass the function directly — server-rendered pages that import `SortingViz` from MDX will fail to build.
2. **Pure generator pattern.** Algorithms in `src/lib/algorithms/*.ts` are pure functions returning `Generator<SortStep>`. The viz replays steps; algorithms never touch React. Adding a new sort = add a generator + register it. `SortStep` is an additive discriminated union (`src/lib/algorithms/types.ts`) — adding a new variant is safe.
3. **MDX plugins as string names.** Under Turbopack, `next.config.ts` must use string names (e.g. `"remark-gfm"`) not imported functions, due to the JS/Rust boundary. Per Next 16 docs in `node_modules/next/dist/docs/01-app/02-guides/mdx.md`.
4. **Deterministic seed in `SortingViz`.** The initial array uses an FNV-1a hash of `(algorithm, size)` so SSR and client agree. `Math.random` reseed only on user-driven size changes (post-hydration). Do not reintroduce `Math.random` in the `useState` initializer — it triggers hydration mismatch.
5. **`useReducedMotion`** uses `useSyncExternalStore` with `getServerSnapshot` returning `false` for SSR safety. `useStepThrough` no-ops `play()` under reduced motion and skips the auto-advance effect.
6. **100% coverage threshold** on `src/lib/algorithms/**/*.ts` (`vitest.config.ts`). Adding an algorithm without tests will fail CI.
7. **Step→view helpers live in `stepView.ts`.** `SortingViz` and `RaceViz` both import `highlightsFor` / `activeRangeFor` / `countCompares` / `countSwapsAndWrites` from `src/components/visualizations/stepView.ts`. Keep new viz consumers using these helpers rather than re-implementing the discriminated-union switch.
8. **`useParallelStepThrough` keys totals by content, not reference.** The hook joins `totals` into a string for the effect dep array (with `eslint-disable-next-line` on capture sites). If you change its API, preserve that behavior so caller-side `useMemo` churn doesn't restart the playback timer.
9. **BST node ids equal their array index.** `BstSnapshot.nodes` is keyed positionally — `nodes[id]` is the node with `id`. The generator assigns `id = nodes.length` at insert time. If you ever delete nodes, you'll need to either tombstone (preserve indices) or rewrite this contract; lookups assume dense ids today.
10. **Lessons index uses `topic.pathPrefix`.** `src/app/lessons/page.tsx` builds links as `${topic.pathPrefix}/${slug}` so non-sorting topics route correctly. When adding a new topic, set `pathPrefix` (e.g. `/lessons/ml`) at the topic level, not per-lesson.
11. **`Controls`'s array-size slider is conditional.** It renders only when both `arraySize` and `onArraySizeChange` are passed. Keep it that way — `BSTViz` and any future non-array viz needs to omit them cleanly.
12. **Multiple vizes on one lesson page → scope e2e selectors to a region.** The BST page renders both `BSTViz` and `BSTSearchViz`, so each gets its own `<section aria-label>` and the e2e tests use `page.getByRole("region", { name: ... })` as a parent before locating buttons / dl counters. Page-level `page.locator("dl")` will match both and fail the assertions silently.

## Useful commands

```
npm run dev              # turbopack dev server
npm run build            # production build
npm run start            # serve production build (used by playwright)
npm test                 # unit + property tests
npm run test:coverage    # with coverage gate
npm run e2e              # playwright (chromium only)
npm run analyze          # ANALYZE=true bundle analyzer
npm run typecheck
npm run lint
npm run format           # prettier --write .
npm run format:check
```

Pre-commit (`simple-git-hooks` + `lint-staged`) auto-runs Prettier and ESLint on staged files. Don't bypass with `--no-verify` — fix the underlying issue.

## Open work

### Pending: D6 — Deploy to Vercel

User deferred this. When you do it:

- Set `NEXT_PUBLIC_SITE_URL` to the production origin so `metadataBase`, the sitemap, and robots produce absolute URLs.
- Verify the edge-runtime OG image renders correctly (sanity-check the unfurl in a Slack/Discord preview).
- Add the deploy URL to the GitHub repo's "About" section.

### Suggested next features

- **More data-structures lessons.** BST insert and search both ship. The next natural BST follow-up is **delete** — meaty (three cases: leaf, one-child, two-children-with-successor-swap), worth its own section on the same page. After that, **Hash Tables** (`/lessons/data-structures/hash-tables`) needs a new presentational primitive — a row of buckets with linked-list chains or open-addressing probes — but follows the same generator pattern.
- **Heaps & Priority Queues.** The `heap-sort` lesson already animates the heap inside an array. A dedicated heap lesson would visualize it as an actual binary tree (TreeView reusable!) and walk through `siftUp`/`siftDown`.
- **ML intuitions track** — long-term roadmap goal: gradient descent → backprop → transformer attention. Materially different visualizations; treat as a new project pillar rather than incremental work.
- **Promote insertion sort to the landing page primer.** The "What you'll learn first" section curates three cards (bubble / merge / quick). With insertion sort live and beginner-rated, it could replace one of the intermediate cards there. Current copy already links to the full lessons page, so the call is editorial, not technical.

### Light follow-ups

- Real-device Lighthouse pass (D4 was checked off based on local Lighthouse, not field data).
- Property-test coverage for `quickSort` is currently length-only (in-place partition has transient duplicates). The newly added stable sorts (insertion, radix) keep this constraint at the per-step level for similar reasons (transient writes); their final-array property tests do the full multiset check.
- The smoke test relies on heading text ("Learn computer science"). If the landing copy changes, update `e2e/smoke.spec.ts` in the same commit.
- The package.json `name` is still `addyosmani-test` from initial scaffolding — harmless but inconsistent with the repo name. Rename if/when convenient.
- The `vitest.config.ts` 100% coverage gate currently only covers `src/lib/algorithms/`. Extending it to `src/lib/dataStructures/` would prevent the same drift in the new track — left out of the BST PR to avoid bundling unrelated config tightening.

## Things to leave alone

- `eslint.config.mjs` does not need `eslint-plugin-jsx-a11y` — `eslint-config-next` already includes it. Adding it back causes a plugin conflict.
- `vitest.config.ts` uses Vitest 4's native `resolve.tsconfigPaths: true`. Don't add `vite-tsconfig-paths`.
- `ThemeToggle` reads `resolvedTheme` lazily in the click handler and uses Tailwind's `dark:` variant for the icon swap. The "mounted" pattern triggers React 19's `react-hooks/set-state-in-effect` rule.

## File map quick reference

```
src/app/                            App Router routes
  page.tsx                          Production landing
  layout.tsx                        Root layout, metadata, fonts
  lessons/page.tsx                  Topic-grouped index
  lessons/sorting/*/page.mdx        Per-algorithm sort lesson content
  lessons/sorting/compare/page.mdx  Side-by-side comparison lesson
  lessons/data-structures/          Data-structures track (layout + lessons)
    binary-search-tree/page.mdx     BST insert lesson
  opengraph-image.tsx               Edge-runtime OG card (1200x630)
  sitemap.ts, robots.ts             SEO

src/components/
  layout/{Nav,Footer,ThemeToggle}.tsx
  providers.tsx                     next-themes wrapper
  visualizations/
    ArrayBars.tsx                   SVG presentational (sort viz)
    TreeView.tsx                    SVG presentational (tree viz)
    Controls.tsx                    Toolbar (play/pause/step/reset/speed; size optional)
    SortingViz.tsx                  Single-algorithm composition + state
    RaceViz.tsx                     Multi-slot composition + parallel state
    BSTViz.tsx                      BST insert composition + state
    BSTSearchViz.tsx                BST search composition + state
    stepView.ts                     Shared step→highlight + counter helpers (sort)

src/lib/
  algorithms/
    types.ts                        SortStep discriminated union
    index.ts                        String-keyed registry + display labels
    {bubble,heap,insertion,         Pure generators (one per algorithm)
     merge,quick,radix}Sort.ts
  dataStructures/
    types.ts                        BstNode / BstSnapshot / BstStep / BstSearchStep
    binarySearchTree.ts             insertSequence + searchSequence + buildTree
    index.ts                        Operation registry + labels
  hooks/
    useStepThrough.ts               Single-list reducer state machine
    useParallelStepThrough.ts       N-list reducer with shared timer
    useReducedMotion.ts             SSR-safe matchMedia

tests/                              Unit + property tests (Vitest)
e2e/                                Playwright (smoke, lessons, compare, BST, a11y)
docs/                               SPEC, PLAN, TASKS
```
