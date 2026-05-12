# Next Session Handoff

Quick orientation for the next agent picking up this project.

## Where we are

- **Repo:** https://github.com/Tzun27/cs-visual-learner (public, owner Tzun27)
- **Local path:** `/home/tzun/repos/cs-visual-learner`
- **Branch:** `main`, tracking `origin/main`.
- **Status:** v1 shipped + three post-v1 sorts (insertion, heap, radix) + side-by-side compare page + four data-structures lessons (BST insert/search/delete, Hash Tables add/contains/remove, Tree Traversal in four orders, Min-heap insert/extract-min) + Python code panel synchronized with every visualization. Not yet deployed.
- **Test counts at HEAD:** 289 unit + 50 Playwright e2e (incl. 8 axe-core a11y routes) — all green.

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
- **Hash Tables lesson** at `/lessons/data-structures/hash-tables` — covers add (insert), contains (search), and remove (delete) on a separate-chaining hash _set_ of capacity 8. Each section pairs a `HashTableView` SVG (8 bucket headers across the top, linked-chain ellipses dropping below) with a per-op Python snippet. The hash function is `hash(key) % capacity`, which equals `key % capacity` in Python for non-negative ints — so the displayed Python is faithful to what the generator computes.
  - Insert section: curated input `[5, 13, 21, 4, 12, 5, 7]` makes bucket 5 collide three times, bucket 4 collide once, and the second `5` get dropped as a duplicate. `HashTableInsertViz` also feeds the view a `ghostBucketIndex` during `hash` / `probe` steps to preview where the key would land.
  - Search section: pre-built table where bucket 1 = `[1, 9, 17]` and bucket 2 = `[2, 50]`. Targets `[1, 17, 50, 25, 3]` cover head-of-chain hit, end-of-chain hit, hit in a shorter chain, miss-after-probing-non-empty-bucket, and miss-on-empty-bucket (zero probes).
  - Delete section: pre-built table with bucket 1 = `[1, 9, 17, 25]` and bucket 2 = `[2]`. Targets `[9, 25, 1, 99]` cover middle / new-tail / head / empty-bucket-miss.
- **Tree Traversal lesson** at `/lessons/data-structures/tree-traversal` — single viz with a four-button mode toggle (preorder / inorder / postorder / level-order) over the same balanced demo tree from the BST lesson (`buildTree([4, 2, 6, 1, 3, 5, 7])` — 7 nodes, depth 3). Each visit step appends one value to an "Output sequence" strip below the tree, and the CodePanel swaps Python source per mode so the position of `visit(node)` is visibly different across the three DFS orders. One parameterized `traversalSequence(tree, mode)` generator covers all four orderings; DFS uses inner recursion, level-order uses an explicit queue, matching the displayed snippets. Expected outputs on the demo tree:
  - **Preorder:** `[4, 2, 1, 3, 6, 5, 7]` (root → left subtree → right subtree)
  - **Inorder:** `[1, 2, 3, 4, 5, 6, 7]` (left → root → right — sorted, because this is a BST)
  - **Postorder:** `[1, 3, 2, 5, 7, 6, 4]` (left → right → root — root last)
  - **Level-order:** `[4, 2, 6, 1, 3, 5, 7]` (depth 0, depth 1, depth 2 — same first 3 values as preorder by coincidence)
- **Heaps & Priority Queues lesson** at `/lessons/data-structures/heap` — covers insert (siftUp), heapify (bottom-up O(n) construction), and extract-min (siftDown) on a packed-array min-heap. Three viz sections share the lesson page. The lesson is deliberately distinct from the existing `heap-sort` sorting lesson: this one is a min-heap (priority-queue framing, Dijkstra etc.), heap-sort uses a max-heap; this one renders the heap as a tree, heap-sort animates it as bars.
  - Insert section: `HeapInsertViz` with two toggleable sequences. **"Mixed order"** = `[4, 9, 1, 7, 2, 8, 3]` exercises a variety of bubble lengths; **"New minimum each time"** = `[7, 6, 5, 4, 3, 2, 1]` makes every value bubble to the root, demonstrating that heap shape stays balanced even with adversarial input (the BST analogue of this input produces a depth-7 chain). Counters: Comparisons / Swaps / Heap size.
  - Heapify section: `HeapifyViz` runs the bottom-up sift-down construction over `[9, 4, 7, 1, 8, 3, 5, 2, 6]`. Exactly `floor(n/2) = 4` sift-down passes (one per internal node, indices 3 → 2 → 1 → 0). Counters: Sift-down passes / Comparisons / Swaps. The MDX section explains the $O(n)$ amortized bound (geometric decay of subtree sizes beats linear sift-down cost) and contrasts with $n$ successive inserts at $O(n \log n)$.
  - Extract section: `HeapExtractMinViz` runs four `extract_min` calls against the result of the "Mixed order" inserts above, drawing the extracted values out into an ordered list strip below the tree. Counters: Extracted / Comparisons / Sift-down swaps. The extracted list comes out `[1, 2, 3, 4]` confirming the priority-queue property.
- **Production landing** at `/` with embedded bubble-sort playground.
- **Topic-grouped lesson index** at `/lessons` with live + coming-soon entries (Sorting / Data Structures / ML).
- **MDX lessons** with KaTeX math, Shiki code highlighting, GFM tables.
- **Class-based dark mode** via `next-themes` + Tailwind v4 `@variant dark`.
- **a11y:** WCAG 2.1 AA verified by axe-core in CI; `role="toolbar"`, `aria-pressed` on play/pause, color-blind safe palette (Wong 2011) with shape redundancy, reduced-motion support throughout.
- **SEO:** `metadataBase`, OG/Twitter metadata, edge-runtime OG image at `/opengraph-image.png`, `sitemap.xml`, `robots.txt`.
- **CI:** GitHub Actions runs lint/typecheck/format-check, unit + property tests with 100% coverage on `src/lib/algorithms/`, production build, and Playwright e2e (smoke + per-algorithm sort lessons + compare + BST insert/search/delete + hash-table add/contains/remove + tree-traversal 4-mode + heap insert/heapify/extract-min + axe).

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
21. **CodePanel soft-wraps long lines with a hanging indent.** The row span carries `whitespace-pre-wrap pr-2 pl-11 -indent-9` so each row is `display: block`, wraps on spaces, and continues wrapped text under the code column (not under the line-number gutter). Math: line-number gutter = `w-6 mr-3` = 2.25rem; row `pl-11` = 2.75rem; row `-indent-9` = -2.25rem → first line places the number at the gutter, wrapped lines start at 2.75rem (under the code). Don't restore `whitespace-pre` or drop the indent without checking the bubble-sort line 6 (`arr[j], arr[j + 1] = arr[j + 1], arr[j]`) — it overflows the half-column at md+ viewports.
22. **Hash table entries are dense-id and tombstoned on delete, mirroring the BST contract.** `HashTableSnapshot.entries` is keyed positionally — `entries[id]` returns the original entry forever. `buckets[i]` is `readonly number[]` (entry ids, in insertion order); delete splices the id out of the bucket list but leaves the entry in `entries[]` (unreachable from any bucket). `liveKeys(table)` walks buckets, not entries, so orphans are correctly invisible to "what's currently stored?" queries. Property tests check `new Set(liveKeys(final))` against the insert-minus-delete set — don't try to compact entry ids on remove, you'd invalidate every prior step's snapshot.
23. **`bucketIndexFor` uses `((k % cap) + cap) % cap` for `-0` safety.** Plain `k % cap` in JS returns `-0` when `k` is a negative multiple of `cap` (e.g. `-8 % 8 === -0`), which fails `Object.is` equality with `+0` and breaks Vitest's `.toBe(0)`. The double-mod is the standard "always positive modulo" trick and matches Python's `hash(k) % cap` for both negative and positive ints. Don't simplify back to single-mod.
24. **`HashTableView` highlights live on three dimensions: per-entry, the active bucket, and an optional ghost slot.** `highlights: HashCellHighlight[]` colors specific entries (cursor / placed / duplicate, same palette as `TreeView`). `activeBucketIndex` glows the bucket header in compare-orange — applied for any step whose type carries a `bucketIndex` field. `ghostBucketIndex` (only the insert viz uses it) renders a dashed line + dashed ellipse at the end of a chain to preview where a not-yet-placed key will land. Search/delete vizes leave `ghostBucketIndex` null.
25. **Hash-table viz `aria-label`s collide with their CodePanel siblings under loose regex.** Each section is `<section aria-label="Hash table insert" />` and its `<CodePanel ariaLabel="Hash table insert pseudocode" />`. A Playwright locator like `getByRole("region", { name: /Hash table insert/ })` matches both and errors with `strict mode violation`. Use exact-string matching: `getByRole("region", { name: "Hash table insert", exact: true })`. Same rule applies to any future viz that pairs a section with a CodePanel where both labels share a prefix — `TreeTraversalViz` already follows this.
26. **`<ol>` / `<ul>` may only contain `<li>` children — placeholders included.** Axe's `list` rule flags any non-`<li>` direct child as a structure violation (`only-listitems`). When `TreeTraversalViz` is in empty state, the "(empty)" placeholder is a `<p>`, and the `<ol>` is only rendered once there's at least one visited value. Don't embed a `<span>(empty)</span>` directly inside the list — Playwright a11y sweep will catch it.
27. **Traversal steps carry the growing sequence on every step, not just the latest visit.** `BstTraversalStep.sequence` is a `readonly number[]` snapshot. The viz reads `currentStep.sequence` directly to render the output strip — no separate accumulator state. If you add new traversal modes (Morris, level-order with depth-grouping, etc.), preserve this contract so step-back works correctly via snapshots.
28. **Heap snapshots carry both the array AND `size`; the viz reads `heap.slice(0, size)`.** `HeapSnapshot = { heap: readonly number[]; size: number }`. The extract path could conceivably keep removed values in the array tail for a step or two (as the BST delete does with orphaned nodes), but the current generator pops them immediately — so today `heap.length === size` on every step. Future contracts (e.g., a "popped-but-not-yet-cleared" visualization beat) can rely on `size` being authoritative without breaking existing consumers.
29. **`heapToTree(snap)` maps a heap onto a `BstSnapshot` so `TreeView` can render it without modification.** Heap children at `2i+1` / `2i+2`, root at id 0. The function lives in `src/lib/dataStructures/heap.ts` and is called inline in both heap vizes (no `useMemo` — the heap object is fresh every render so memoization wouldn't help). This means highlight `nodeId` values in the heap vizes are heap indices, not BST node ids. Confusing if you swap viz types — keep heap and BST highlight code separate.
30. **Heap insert's `swap-up` / extract's `swap-down` steps use `cursorIndex` + `fromIndex` (not `parentIndex` / `childIndex`).** `cursorIndex` = where the active value now lives _after_ the swap; `fromIndex` = the slot it just vacated. Both are highlighted with the same `placed` kind so the user sees a two-slot swap. The earlier naming (`parentIndex`) was ambiguous post-swap and was renamed during this lesson's authoring; resist switching back.
31. **Heap insert emits exactly one `settle` step per insert; intermediate snapshots may violate the min-heap invariant.** The transient is on `compare-parent` and during long bubble chains, swap-up restores the invariant locally but the new cursor may still violate against its new grandparent. Property tests assert `isMinHeap` only on `settle` and `done` snapshots — extend the same contract to any future heap operations (decrease-key, etc.) that perform staged rebalancing.
32. **`heapifySequence` only walks indices `(n // 2) - 1` down to `0`; leaves are skipped.** That's where the $O(n)$ bound comes from — sift-down's cost is bounded by the _subtree height below the node_, not the tree height overall, and the bottom half of an array-backed heap is leaves with subtree height 0. Don't "fix" the loop to start at `n - 1` thinking you're being thorough; it would still produce a correct heap but ruin the linear bound that's the whole point of heapify-vs-n-inserts. Property tests assert sift-pass count equals `floor(n / 2)` exactly.

## Useful commands

```
npm run dev              # turbopack dev server (binds :3000)
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

**Workflow notes the last sessions learned the hard way:**

- A `npm run dev` server is typically already running on `:3000` while the user is iterating. Playwright's `webServer` config has `reuseExistingServer: !process.env.CI`, so e2e runs against the dev server locally — meaning you can iterate on viz code, hot-reload, and then re-run `npx playwright test` without restarting anything. In CI, Playwright builds + serves production.
- When stepping a viz programmatically via `mcp__chrome-devtools__evaluate_script`, React state batching means multiple `.click()` calls in a single synchronous script all see the same stale state. Insert `await new Promise(r => requestAnimationFrame(r))` between clicks to let the reducer flush. Without that, the viz appears frozen even though tests pass.
- Direct pushes to `main` in auto mode trip the safety classifier roughly every 1–3 cycles and require fresh user authorization. Plan your commits so you can show the user a summary and ask once, rather than asking for permission after every commit. The hash-tables + tree-traversal sessions both ended with five-commit stacks waiting on a single push approval — works fine.

## Open work

### Pending: D6 — Deploy to Vercel

User deferred this. When you do it:

- Set `NEXT_PUBLIC_SITE_URL` to the production origin so `metadataBase`, the sitemap, and robots produce absolute URLs.
- Verify the edge-runtime OG image renders correctly (sanity-check the unfurl in a Slack/Discord preview).
- Add the deploy URL to the GitHub repo's "About" section.

### Suggested next features

- **`decrease_key` on the heap page.** Heapify shipped this session; `decrease_key` is the remaining textbook operation called out in the lesson's "What you didn't see" list. The hard part is bookkeeping — you need an index map from value-or-handle → heap-index so you can locate the node in $O(1)$ before sifting up — or you accept duplicate-entry semantics where stale priorities just get pulled and discarded. Either approach is interesting and ties directly to Dijkstra. Conventional viz would show the user clicking a node to lower its key, then watching it bubble up.
- **Open-addressing hash table.** The current hash-tables lesson uses separate chaining. A companion lesson (or an additional section) that swaps in **linear probing** would showcase tombstones (`deleted` markers vs. `empty`), primary-vs-secondary clustering, and why probe sequences can't terminate early on miss. Most of the scaffolding — `HashTableView`, snippet pattern, exact-match aria-label rule — generalizes; the data model swaps from `buckets: number[][]` to `slots: (entryId | null | "tombstone")[]`.
- **ML intuitions track** — long-term roadmap goal: gradient descent → backprop → transformer attention. Materially different visualizations; treat as a new project pillar rather than incremental work.
- **Promote insertion sort to the landing page primer.** The "What you'll learn first" section curates three cards (bubble / merge / quick). With insertion sort live and beginner-rated, it could replace one of the intermediate cards there. Current copy already links to the full lessons page, so the call is editorial, not technical.
- **Language toggle on the code panel.** All snippets are Python today. Adding TypeScript (the actual generator source) or another teaching language would re-tokenize on toggle and roughly double the snippet-authoring work per algorithm. The pieces are in place: `CodePanel` already accepts a `language` prop and Shiki supports many languages — what's missing is a per-algorithm registry of `{ python: source, typescript: source }` and matching line-number maps.

### Light follow-ups

- Real-device Lighthouse pass (D4 was checked off based on local Lighthouse, not field data).
- Property-test coverage for `quickSort` is currently length-only (in-place partition has transient duplicates). The newly added stable sorts (insertion, radix) keep this constraint at the per-step level for similar reasons (transient writes); their final-array property tests do the full multiset check.
- The smoke test relies on heading text ("Learn computer science"). If the landing copy changes, update `e2e/smoke.spec.ts` in the same commit.
- The package.json `name` is still `addyosmani-test` from initial scaffolding — harmless but inconsistent with the repo name. Rename if/when convenient.
- The `vitest.config.ts` 100% coverage gate currently only covers `src/lib/algorithms/`. Extending it to `src/lib/dataStructures/` would prevent the same drift in the new track — left out of the BST and hash-tables PRs to avoid bundling unrelated config tightening. With BST + hash tables both now substantial modules, this is overdue.
- Axe-core now runs on eight routes (`/`, `/lessons`, `/lessons/sorting/bubble-sort`, `/lessons/sorting/compare`, `/lessons/data-structures/binary-search-tree`, `/lessons/data-structures/hash-tables`, `/lessons/data-structures/tree-traversal`, `/lessons/data-structures/heap`). The other four sort pages (`insertion-sort`, `merge-sort`, `quick-sort`, `heap-sort`, `radix-sort`) ship with `CodePanel` but aren't in the sweep. Adding them would catch any future panel-related regressions earlier — the existing routes cover the structural shape, but each algorithm has its own snippet length and could surface unique contrast/wrapping edge cases.
- The hash-tables viz uses keys-only ("hash set") semantics. If you ever want it to behave as a hash _map_, extend `HashTableEntry` with a `value` field, update the snippets (`bucket = [(k, v), ...]`), and update `HashTableView` to render `k: v` cells. Most of the rest of the pipeline is value-agnostic.

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
    binary-search-tree/page.mdx     BST insert + search + delete lesson
    hash-tables/page.mdx            Hash table add + contains + remove lesson
    tree-traversal/page.mdx         Preorder / inorder / postorder / level-order
    heap/page.mdx                   Min-heap insert (siftUp) + extract-min (siftDown)
  opengraph-image.tsx               Edge-runtime OG card (1200x630)
  sitemap.ts, robots.ts             SEO

src/components/
  layout/{Nav,Footer,ThemeToggle}.tsx
  providers.tsx                     next-themes wrapper
  visualizations/
    ArrayBars.tsx                   SVG presentational (sort viz)
    TreeView.tsx                    SVG presentational (tree viz)
    HashTableView.tsx               SVG presentational (hash table viz; buckets + chains)
    CodePanel.tsx                   Client component: source + line highlights + lazy Shiki
    Controls.tsx                    Toolbar (play/pause/step/reset/speed; size optional)
    SortingViz.tsx                  Single-algorithm composition + state (renders CodePanel when snippet exists)
    RaceViz.tsx                     Multi-slot composition + parallel state
    BSTViz.tsx                      BST insert composition + state (renders CodePanel)
    BSTSearchViz.tsx                BST search composition + state (renders CodePanel)
    BSTDeleteViz.tsx                BST delete composition + state, 3-case demo (renders CodePanel)
    HashTableInsertViz.tsx          Hash table insert composition (renders CodePanel + ghost slot)
    HashTableSearchViz.tsx          Hash table search composition (head/end/empty-bucket targets)
    HashTableDeleteViz.tsx          Hash table delete composition (middle/tail/head/miss targets)
    TreeTraversalViz.tsx            Tree traversal composition (4-mode toggle + output sequence strip)
    HeapInsertViz.tsx               Min-heap insert composition (siftUp; 2-sequence toggle)
    HeapifyViz.tsx                  Min-heap heapify composition (bottom-up siftDown; single curated input)
    HeapExtractMinViz.tsx           Min-heap extract-min composition (siftDown; extracted-list strip)
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
    types.ts                        BstNode / BstSnapshot / Bst*Step + HashTableEntry / HashTableSnapshot / HashTable*Step + TraversalMode / BstTraversalStep + HeapSnapshot / HeapInsertStep / HeapifyStep / HeapExtractStep
    binarySearchTree.ts             BST insertSequence + searchSequence + deleteSequence + buildTree
    hashTable.ts                    Hash table insertSequence + searchSequence + deleteSequence + buildHashTable + bucketIndexFor + liveKeys + loadFactor
    traversal.ts                    Parameterized traversalSequence(tree, mode) + TRAVERSAL_MODES + labels
    heap.ts                         Min-heap heapInsertSequence + heapifySequence + heapExtractMinSequence + buildHeap + isMinHeap + heapToTree
    index.ts                        BST operation registry + labels (insert only — search/delete have a different signature)
    {insert,search,delete}Sequence.snippet.ts        Python source + named line-number constants (BST)
    hashTable{Insert,Search,Delete}.snippet.ts        Python source + named line-number constants (hash table)
    {preorder,inorder,postorder,levelOrder}Traversal.snippet.ts  Python source + named line-number constants (traversal)
    heap{Insert,ExtractMin}.snippet.ts               Python source + named line-number constants (heap)
    heapify.snippet.ts                               Python source + named line-number constants (heapify)
  hooks/
    useStepThrough.ts               Single-list reducer state machine
    useParallelStepThrough.ts       N-list reducer with shared timer
    useReducedMotion.ts             SSR-safe matchMedia

tests/                              Unit + property tests (Vitest)
e2e/                                Playwright (smoke, lessons, compare, BST, hash-tables, tree-traversal, a11y)
docs/                               SPEC, PLAN, TASKS
```

## Reading the code by topic

If you need to make a focused change, these are the files that matter for each subsystem. Read them in this order to come up to speed quickly.

- **Add a new sorting algorithm:** `src/lib/algorithms/types.ts` (step union, add a variant if needed) → write `src/lib/algorithms/foo.snippet.ts` → write `src/lib/algorithms/foo.ts` (the generator) → register in `src/lib/algorithms/index.ts` → write `tests/algorithms/foo.test.ts` (100% coverage required) → create `src/app/lessons/sorting/foo-sort/page.mdx` → add to `src/app/lessons/page.tsx` lessons array → add e2e to `e2e/lessons.spec.ts`'s array.
- **Add a new BST or hash-table or heap operation:** `src/lib/dataStructures/types.ts` (step union) → write `*.snippet.ts` → extend `binarySearchTree.ts` or `hashTable.ts` or `heap.ts` with a generator → write tests in `tests/dataStructures/*.test.ts` → wire up a new `*Viz.tsx` composition next to the existing ones → render it on the lesson MDX.
- **Add a new data-structure lesson from scratch:** Mirror Hash Tables. New `*.snippet.ts` per operation + new generator file + new `*View.tsx` presentational primitive (if existing primitives don't fit) + per-operation `*Viz.tsx` compositions + lesson MDX + lessons-index entry (`status: "live"`, set `slug`) + e2e spec + add the route to `e2e/a11y.spec.ts` route list.
- **Touch the CodePanel:** `src/components/visualizations/CodePanel.tsx` + `tests/components/CodePanel.test.tsx`. Decisions 17–21 cover the load-bearing constraints (lazy Shiki, focusable scroll region, line-number contrast, `not-prose`, scroll math, soft-wrap hanging indent).
- **Touch the TreeView SVG:** `src/components/visualizations/TreeView.tsx`. Highlight palette uses `--bar-compare / swap / pivot` CSS vars defined in `src/app/globals.css` (light + dark variants). Reused by BST insert/search/delete vizes, TreeTraversalViz, **and all three heap vizes via `heapToTree`** — exercise all eight before merging.

## What changed in the most recent session

This session shipped the **Heaps & Priority Queues** lesson with three viz sections (insert, heapify, extract-min), and added a single-line "git commit discipline" rule to `AGENTS.md`. Commits landed in two phases — initial three-viz rollout followed by the heapify section as an in-place extension:

| #   | subject                                                                            |
| --- | ---------------------------------------------------------------------------------- |
| 1   | `docs(agents)`: add git commit discipline guidance to AGENTS.md                    |
| 2   | `feat(ds)`: add min-heap insert + extract-min generators + snippets + tests        |
| 3   | `feat(viz)`: add HeapInsertViz + HeapExtractMinViz (reuse TreeView via heapToTree) |
| 4   | `feat(lessons)`: add heap & priority queues lesson + promote in index              |
| 5   | `test(e2e)`: cover heap lesson + add it to axe sweep                               |
| 6   | `docs`: refresh next_session.md after heap rollout                                 |
| 7   | `feat(ds)`: add heapify generator + snippet + tests                                |
| 8   | `feat(viz)`: add HeapifyViz composition                                            |
| 9   | `feat(lessons)`: add heapify section to heap lesson MDX                            |
| 10  | `test(e2e)`: cover heapify section in heap spec                                    |
| 11  | `docs`: refresh next_session.md after heapify rollout                              |

Narrative summary:

1. **AGENTS.md update** (commit 1). One-line addition recording the project's "commit per logical task" convention. The rule was implicit before this session; making it explicit removes future-agent ambiguity.
2. **Heap data structure** (commit 2). New min-heap module mirroring the BST module's shape: `HeapSnapshot` (`heap: readonly number[]; size: number`), two step unions, `heapInsertSequence` (siftUp via `(i-1)>>1` parent), `heapExtractMinSequence` (siftDown picking the smaller of two children), `buildHeap`, `isMinHeap`, and `heapToTree` (the structural mapper used by the vizes). 28 unit + property tests including the "extract all yields sorted" property that ties insert and extract together.
3. **Heap vizes** (commit 3). Two composition components following the BSTViz pattern: `HeapInsertViz` (2-sequence toggle, three counters) and `HeapExtractMinViz` (curated 4-extract demo, extracted-list strip below the tree, three counters). Both call `heapToTree` inline and feed the result to the existing `TreeView` — zero modifications to the SVG primitive. Highlight conventions: `cursor` (orange) for compared participants, `placed` (yellow with dashed halo) for the active node + the slot it just vacated on a swap, `duplicate` (red) for the root about to leave on extract.
4. **Heap lesson + index promotion** (commit 4). `src/app/lessons/data-structures/heap/page.mdx` covers the priority-queue framing (`extract_min`, Dijkstra, top-k), explicitly contrasts heap balance with BST degenerate insertion order, and flips the lessons-index entry from `coming-soon` → `live`. Includes a deliberate "What you didn't see" section listing `heapify`, `decrease_key`, and d-ary/Fibonacci heaps as the natural follow-up surface.
5. **E2E + a11y** (commit 5). New `e2e/heap.spec.ts` with 5 specs (insert region presence, counter ticking, toggle behavior, extract-min produces "1" first, full extract yields `[1,2,3,4]`) and the route added to `e2e/a11y.spec.ts`'s axe sweep. Verified live in Chrome DevTools MCP — `[1, 2, 3, 4]` extracted in order, no console errors.
6. **Doc refresh** (commit 6). Decisions 28–31 capture heap-specific gotchas (`heap.size` vs `heap.length`, `heapToTree` semantics, `cursorIndex`/`fromIndex` naming, transient invariant on `compare-parent`).
7. **Heapify generator** (commit 7). New `HeapifyStep` union + `heapifySequence` + `heapify.snippet.ts`. The generator walks indices `(n // 2) - 1 → 0` running an inner sift-down per internal node — exactly the bottom-up construction whose $O(n)$ amortized bound comes from leaf-skipping and the geometric decay of subtree heights. 10 unit/property tests, including the "heapify result has the same multiset as the input and is a valid min-heap" property, and "heapify + extract-all = sorted order" tying it back to the existing operations.
8. **HeapifyViz** (commit 8). Single-curated-input composition: `[9, 4, 7, 1, 8, 3, 5, 2, 6]` (n=9, so exactly 4 sift-down passes). Same TreeView + CodePanel layout as the other heap vizes, counters: Sift-down passes / Comparisons / Swaps. No source toggle — the lesson value is observing the bottom-up traversal, not comparing inputs.
9. **Heapify lesson section** (commit 9). New "Building a heap from an array" section inserted _between_ Insert and Extract in the MDX. Explains the $O(n)$ argument (sum of `n/2^(h+1) · O(h)` telescopes to $O(n)$) and removes `heapify` from the lesson's "What you didn't see" list, leaving only `decrease_key` and d-ary/Fibonacci heaps as named follow-ups.
10. **E2E expansion** (commit 10). Two new specs in `e2e/heap.spec.ts` — heapify region presence + counter ticking, and "running to completion produces exactly 4 sift-down passes" pinned to the input size. Brought the spec to 7 tests total.
11. **Doc refresh** (commit 11). This file. New decision 32 captures the leaf-skipping invariant in `heapifySequence` that's load-bearing for the $O(n)$ bound.

Test counts grew from **251 unit / 42 e2e (incl. 7 axe routes)** at session start to **289 unit / 50 e2e (incl. 8 axe routes)** at HEAD (+38 unit, +8 e2e — +28 unit from initial heap, +10 from heapify; +5 e2e from initial heap, +2 from heapify, +1 axe route).
