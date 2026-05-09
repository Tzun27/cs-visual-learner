# Next Session Handoff

Quick orientation for the next agent picking up this project.

## Where we are

- **Repo:** https://github.com/Tzun27/cs-visual-learner (public, owner Tzun27)
- **Local path:** `/home/tzun/repos/cs-visual-learner`
- **Branch:** `main`, tracking `origin/main`.
- **Status:** v1 shipped + three post-v1 sorts (insertion, heap, radix) + side-by-side compare page + first data-structures lesson (BST insert + search + delete) + Python code panel synchronized with every visualization (six sorts and three BST ops). Not yet deployed.

Read these before writing code:

1. `AGENTS.md` — repo-level instructions. **Important:** Next.js 16 has breaking changes from training data; consult `node_modules/next/dist/docs/` rather than recalling Next 14/15 patterns from memory.
2. `docs/SPEC.md` — v1 spec, success criteria checklist, walkthrough.
3. `docs/PLAN.md` — phased plan (A scaffolding → B viz core → C content/MDX → D polish/deploy).
4. `docs/TASKS.md` — task breakdown (D6 deploy is the only remaining open item).

## What ships today

- **Six sorting visualizations** at `/lessons/sorting/{bubble,insertion,merge,quick,heap,radix}-sort` — step forward/back, play/pause, speed slider, array-size slider, live comparison/swap counters, **and a Python code panel that highlights the line(s) corresponding to the current step**. (Radix sort is non-comparison-based so its Comparisons counter stays at 0; the Swaps counter doubles as a "writes" counter for it.)
- **Side-by-side compare page** at `/lessons/sorting/compare` — three algorithm slots, each with a dropdown picker, all sharing one input and one playback toolbar. Per-slot step/compare/swap counters; finish indicator shows total step count when a slot completes. Uses `RaceViz` + `useParallelStepThrough`.
- **Binary Search Tree lesson** at `/lessons/data-structures/binary-search-tree` — covers insert, search, and delete. Each section pairs the tree on the left with a Python code panel on the right (responsive grid: stacked on small, side-by-side at md+). All three Python snippets are recursive — easier to read than the iterative TS generators — and the highlight tracks which branch the cursor took, not just the step kind.
  - Insert section: `insertSequence` generator + `BSTViz`. Toggle between Balanced and Sorted insert order to see Max depth jump from 4 to 12.
  - Search section: `searchSequence` generator + `BSTSearchViz`, walking a curated mix of hits and misses against the balanced tree.
  - Delete section: `deleteSequence` generator + `BSTDeleteViz`. Curated demo deletes 6 (leaf), 38 (one child), and 50 (two children, successor walk 75 → 63 → 56) against the same balanced tree, exercising all three textbook cases. `TreeView` SVG primitive (inorder x-positioning, dynamic row height) is shared by all three vizes.
- **Production landing** at `/` with embedded bubble-sort playground.
- **Topic-grouped lesson index** at `/lessons` with live + coming-soon entries (Sorting / Data Structures / ML).
- **MDX lessons** with KaTeX math, Shiki code highlighting, GFM tables.
- **Class-based dark mode** via `next-themes` + Tailwind v4 `@variant dark`.
- **a11y:** WCAG 2.1 AA verified by axe-core in CI; `role="toolbar"`, `aria-pressed` on play/pause, color-blind safe palette (Wong 2011) with shape redundancy, reduced-motion support throughout.
- **SEO:** `metadataBase`, OG/Twitter metadata, edge-runtime OG image at `/opengraph-image.png`, `sitemap.xml`, `robots.txt`.
- **CI:** GitHub Actions runs lint/typecheck/format-check, unit + property tests with 100% coverage on `src/lib/algorithms/`, production build, and Playwright e2e (smoke + per-algorithm sort lessons + compare + BST insert/search/delete + axe).

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
9. **BST node ids equal their array index — and stay that way through deletes.** `BstSnapshot.nodes` is keyed positionally — `nodes[id]` is the node with `id`. `insertSequence` assigns `id = nodes.length` on insert. `deleteSequence` preserves this contract by **orphaning rather than splicing**: removed nodes stay in `nodes[]` but no parent points at them and they're unreachable from `rootId`. `TreeView` walks from the root to build its layout, so orphans render as gone for free, while `nodes[id]` lookups stay valid even after deletes. Don't try to compact ids on delete — every step's snapshot would change cardinality and indexes.
10. **Lessons index uses `topic.pathPrefix`.** `src/app/lessons/page.tsx` builds links as `${topic.pathPrefix}/${slug}` so non-sorting topics route correctly. When adding a new topic, set `pathPrefix` (e.g. `/lessons/ml`) at the topic level, not per-lesson.
11. **`Controls`'s array-size slider is conditional.** It renders only when both `arraySize` and `onArraySizeChange` are passed. Keep it that way — `BSTViz` and any future non-array viz needs to omit them cleanly.
12. **Multiple vizes on one lesson page → scope e2e selectors to a region.** The BST page renders `BSTViz`, `BSTSearchViz`, and `BSTDeleteViz` together, so each gets its own `<section aria-label>` and the e2e tests use `page.getByRole("region", { name: ... })` as a parent before locating buttons / dl counters. Page-level `page.locator("dl")` will match all three and fail the assertions silently.
13. **`deleteSequence`'s `swap-value` step is intentionally a non-BST snapshot for one tick.** During the two-children case, the target's value gets overwritten with the successor's value before the successor is unlinked — so for that one step the tree contains a duplicate value and violates the right-subtree-greater rule. The next `unlink` step restores the invariant. Property tests must skip `swap-value` snapshots when asserting BST-ness, and any future code that walks delete steps should know this transient exists.
14. **`codeLines` is an optional, additive field on every step type.** Both `SortStep` (`src/lib/algorithms/types.ts`) and the three BST step unions (`src/lib/dataStructures/types.ts`) wrap their variants in a `StepBase = { readonly codeLines?: readonly number[] }` intersection. The viz reads `playback.currentStep?.codeLines ?? []` and passes it to `CodePanel`. Generators that haven't been annotated yet still type-check (the field is optional). When you annotate a new step kind, decide line ranges per _branch_ taken — not just per kind — so the highlight visibly bounces. Examples: `mergeSort` distinguishes `writeI` vs `writeJ`; `bstInsert` distinguishes `compareLeft` vs `compareRight`; `bstDelete` distinguishes all three `found*` cases plus `unlinkSimple` vs `unlinkRecursive`.
15. **Snippets co-locate with generators as `*.snippet.ts`.** `src/lib/algorithms/mergeSort.snippet.ts` exports `mergeSortPython` (the displayed source) and `mergeSortLines` (named line-number constants). The generator imports from it and references constants by name (`mergeSortLines.compare`, etc.) so changing the displayed Python only touches one file. Tests count `lineCount = source.split("\n").length` and assert every step's `codeLines` falls within. Same pattern for `src/lib/dataStructures/{insert,search,delete}Sequence.snippet.ts`.
16. **`sortAlgorithmSnippets` registry is the gate.** `SortingViz` looks up `sortAlgorithmSnippets[algorithm]`; if the result is undefined, no code panel renders. All six sorts ship with snippets today, but adding a new sort _without_ a snippet is still valid — the viz degrades gracefully. The registry is `Partial<Record<SortAlgorithmKey, string>>` so missing entries are a type-safe optional. BST vizes import their snippet directly (one snippet per viz); they don't go through a registry.
17. **`CodePanel` lazy-loads Shiki on the client; SortingViz/BSTViz must NOT pre-render it.** Shiki adds ~200 KB to the client bundle, gated behind a dynamic import in `CodePanel`'s effect. Initial render shows plain text; tokens upgrade in once `getSingletonHighlighter` resolves. The dual-theme mode (`themes: { light: 'github-light', dark: 'github-dark' }`) emits both colors as CSS custom properties on every token (`--shiki-light`, `--shiki-dark`), so theme toggle is instant and doesn't re-tokenize. If you ever need to pre-tokenize at build time, do it in a server module that the client never imports — otherwise Shiki bloats the client bundle.
18. **CodePanel's scrollable region must be keyboard-focusable and the line-number contrast must be ≥4.5.** Two axe rules surfaced when CodePanel landed on the BST page: `scrollable-region-focusable` (the inner `<div ref={scrollRootRef}>` needs `tabIndex={0}`) and `color-contrast` on the line-number color. Light-mode line numbers are `text-zinc-500` and dark-mode is `text-zinc-400`; lighter values fail axe on `bg-zinc-50/50` / `bg-zinc-900/40`. Don't downgrade either to `zinc-400` (light) or `zinc-600` (dark) without verifying contrast.
19. **CodePanel needs `not-prose`.** The MDX layouts wrap children in `prose`, which restyles every `<pre>` with a dark background and inverts colors. CodePanel's outer `<section>` carries `not-prose` to opt out — without it, the syntax highlighting collides with prose's pre styles. Any new MDX-embedded viz that renders a `<pre>` needs the same.
20. **Highlight scrolls inside the panel only — do NOT use `Element.scrollIntoView` on a child line.** `scrollIntoView` propagates up the document and scrolls the page when the line is below viewport, which yanks the bars out of view. CodePanel uses `root.scrollTo({ top: ... })` on the inner ref instead, computing offsets via `target.offsetTop - root.offsetTop`. If you ever change this back to `scrollIntoView`, scope it with `scrollIntoViewOptions` and verify the browser doesn't bubble. The Shiki dual-theme outer wrapper is also why the line-highlight colors (amber background) sit on top: Shiki sets text color via inline-styled spans, the highlight CSS sets background on the line wrapper, so the two compose without conflict.

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

- **More data-structures lessons.** BST insert, search, and delete all ship now. **Hash Tables** (`/lessons/data-structures/hash-tables`) is the next natural one — needs a new presentational primitive (a row of buckets with linked-list chains or open-addressing probes) but follows the same generator pattern. **Tree traversal** (preorder / inorder / postorder / level-order) is also a great fit since `TreeView` is already a reusable primitive — could even live on the BST page or a sibling page. New ops should also ship with a `*.snippet.ts` and `codeLines` annotations from day one — the pattern is established (decisions 14–20).
- **Heaps & Priority Queues.** The `heap-sort` lesson already animates the heap inside an array. A dedicated heap lesson would visualize it as an actual binary tree (TreeView reusable!) and walk through `siftUp`/`siftDown`. The Python snippet would mirror what already exists in `heapSort.snippet.ts` — could share the source or split it.
- **ML intuitions track** — long-term roadmap goal: gradient descent → backprop → transformer attention. Materially different visualizations; treat as a new project pillar rather than incremental work.
- **Promote insertion sort to the landing page primer.** The "What you'll learn first" section curates three cards (bubble / merge / quick). With insertion sort live and beginner-rated, it could replace one of the intermediate cards there. Current copy already links to the full lessons page, so the call is editorial, not technical.
- **Language toggle on the code panel.** All snippets are Python today. Adding TypeScript (the actual generator source) or another teaching language would re-tokenize on toggle and roughly double the snippet-authoring work per algorithm. The pieces are in place: `CodePanel` already accepts a `language` prop and Shiki supports many languages — what's missing is a per-algorithm registry of `{ python: source, typescript: source }` and matching line-number maps.

### Light follow-ups

- Real-device Lighthouse pass (D4 was checked off based on local Lighthouse, not field data).
- Property-test coverage for `quickSort` is currently length-only (in-place partition has transient duplicates). The newly added stable sorts (insertion, radix) keep this constraint at the per-step level for similar reasons (transient writes); their final-array property tests do the full multiset check.
- The smoke test relies on heading text ("Learn computer science"). If the landing copy changes, update `e2e/smoke.spec.ts` in the same commit.
- The package.json `name` is still `addyosmani-test` from initial scaffolding — harmless but inconsistent with the repo name. Rename if/when convenient.
- The `vitest.config.ts` 100% coverage gate currently only covers `src/lib/algorithms/`. Extending it to `src/lib/dataStructures/` would prevent the same drift in the new track — left out of the BST PR to avoid bundling unrelated config tightening.
- Axe-core only runs on a subset of routes (`/`, `/lessons`, `/lessons/sorting/bubble-sort`, `/lessons/sorting/compare`, `/lessons/data-structures/binary-search-tree`). The merge-sort page (and the four other sorts that now ship with `CodePanel`) aren't in the sweep. Adding `/lessons/sorting/merge-sort` to `e2e/a11y.spec.ts:routes` would catch any future panel-related regressions earlier — the BST page already covered the main shape.

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
    binary-search-tree/page.mdx     BST insert + search lesson
  opengraph-image.tsx               Edge-runtime OG card (1200x630)
  sitemap.ts, robots.ts             SEO

src/components/
  layout/{Nav,Footer,ThemeToggle}.tsx
  providers.tsx                     next-themes wrapper
  visualizations/
    ArrayBars.tsx                   SVG presentational (sort viz)
    TreeView.tsx                    SVG presentational (tree viz)
    CodePanel.tsx                   Client component: source + line highlights + lazy Shiki
    Controls.tsx                    Toolbar (play/pause/step/reset/speed; size optional)
    SortingViz.tsx                  Single-algorithm composition + state (renders CodePanel when snippet exists)
    RaceViz.tsx                     Multi-slot composition + parallel state
    BSTViz.tsx                      BST insert composition + state (renders CodePanel)
    BSTSearchViz.tsx                BST search composition + state (renders CodePanel)
    BSTDeleteViz.tsx                BST delete composition + state, 3-case demo (renders CodePanel)
    stepView.ts                     Shared step→highlight + counter helpers (sort)

src/lib/
  algorithms/
    types.ts                        SortStep discriminated union (with optional codeLines via StepBase)
    index.ts                        String-keyed registry + labels + sortAlgorithmSnippets registry
    {bubble,heap,insertion,         Pure generators (one per algorithm), each importing
     merge,quick,radix}Sort.ts        named line constants from its sibling .snippet.ts
    {bubble,heap,insertion,         Python source + named line-number constants
     merge,quick,radix}Sort.snippet.ts
  dataStructures/
    types.ts                        BstNode / BstSnapshot / Bst*Step (all carry optional codeLines)
    binarySearchTree.ts             insertSequence + searchSequence + deleteSequence + buildTree
    index.ts                        Operation registry + labels (insert only — search/delete have a different signature)
    {insert,search,delete}Sequence.snippet.ts  Python source + named line-number constants
  hooks/
    useStepThrough.ts               Single-list reducer state machine
    useParallelStepThrough.ts       N-list reducer with shared timer
    useReducedMotion.ts             SSR-safe matchMedia

tests/                              Unit + property tests (Vitest)
e2e/                                Playwright (smoke, lessons, compare, BST insert/search/delete, a11y)
docs/                               SPEC, PLAN, TASKS
```
