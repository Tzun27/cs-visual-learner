# Task Breakdown: CS Concept Visualizer v1

> **Companion to:** [SPEC.md](./SPEC.md) · [PLAN.md](./PLAN.md)
> **Date:** 2026-05-05
> **Convention:** Each task is sized for one focused session and touches ≤ ~5 files. Acceptance criteria are testable. Tasks are ordered by dependency, not priority.

---

## Phase A — Foundation

### A1. Scaffold Next.js project

- **Acceptance:** `npm run dev` boots Next.js 15 App Router on `localhost:3000` with TypeScript strict, Tailwind v4, the default landing page replaced with a placeholder.
- **Verify:** `npm run dev` returns 200 on `/`; `npm run build` succeeds; `npm run typecheck` passes.
- **Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.

### A2. Configure linting, formatting, pre-commit

- **Acceptance:** ESLint (Next + a11y), Prettier, lint-staged + simple-git-hooks all configured. `npm run lint` and `npm run format` work. Commits trigger lint+format on staged files.
- **Verify:** Make a deliberately ugly change → commit → see it auto-formatted and fail/pass lint.
- **Files:** `eslint.config.mjs`, `.prettierrc`, `package.json` (scripts + hooks config).

### A3. Configure unit testing (Vitest)

- **Acceptance:** Vitest + Testing Library set up. A trivial `1 + 1 === 2` test passes via `npm test`. Vitest is wired into the same TS path aliases (`@/`).
- **Verify:** `npm test` runs and reports 1 passing test. `npm run test:watch` works.
- **Files:** `vitest.config.ts`, `package.json` (scripts + deps), `tests/sanity.test.ts`.

### A4. Configure E2E testing (Playwright)

- **Acceptance:** Playwright installed with chromium only (keep CI fast). One smoke test: visit `/`, assert page title.
- **Verify:** `npm run e2e` passes locally against `npm run dev`.
- **Files:** `playwright.config.ts`, `e2e/smoke.spec.ts`, `package.json`.

### A5. CI pipeline

- **Acceptance:** GitHub Actions workflow runs typecheck + lint + unit + e2e on every PR and on push to `main`. Caches `node_modules` and Playwright browsers.
- **Verify:** Open a draft PR; CI runs and is green.
- **Files:** `.github/workflows/ci.yml`.

### A6. MDX pipeline

- **Acceptance:** `@next/mdx` configured with `remark-gfm`, `rehype-katex` + `rehype-pretty-code` (Shiki). A test page at `/lessons/hello/page.mdx` renders prose, GFM tables, KaTeX math, and a syntax-highlighted code block.
- **Verify:** Visit `/lessons/hello` in dev — math renders as math, code is highlighted, GFM table renders.
- **Files:** `next.config.ts`, `mdx-components.tsx`, `src/app/lessons/hello/page.mdx`, `package.json`.

### A7. Layout shell + dark mode

- **Acceptance:** Root layout has nav (logo + links to `/`, `/lessons`), footer, and a working light/dark toggle via `next-themes`. No FOUC. Tailwind dark variant applied.
- **Verify:** Toggle theme; refresh; theme persists. Lighthouse accessibility ≥ 95 on `/`.
- **Files:** `src/app/layout.tsx`, `src/components/layout/Nav.tsx`, `src/components/layout/Footer.tsx`, `src/components/layout/ThemeToggle.tsx`, `src/components/providers.tsx`.

> **Checkpoint A:** dev server runs · MDX renders with math + code highlighting · CI green · theme toggle works.

---

## Phase B — The architectural bet

### B1. `Step` type + `bubbleSort` generator

- **Acceptance:** `src/lib/algorithms/types.ts` defines `SortStep` discriminated union. `bubbleSort.ts` is a pure generator function that yields `compare`, `swap`, and `done` steps. No React, no DOM imports.
- **Verify:** Unit test exhausts the generator on `[3,1,2]` and asserts the precise step sequence. Property test (`fast-check`, 1000 runs) confirms final array is sorted for arbitrary inputs of length 0–50. `npm test` passes; coverage on this file is 100%.
- **Files:** `src/lib/algorithms/types.ts`, `src/lib/algorithms/bubbleSort.ts`, `tests/algorithms/bubbleSort.test.ts`.

### B2. `useReducedMotion` hook

- **Acceptance:** Reads `(prefers-reduced-motion: reduce)`, updates on change, SSR-safe (returns `false` during SSR, hydrates correctly).
- **Verify:** Unit test using `matchMedia` mock for both states.
- **Files:** `src/lib/hooks/useReducedMotion.ts`, `tests/hooks/useReducedMotion.test.tsx`.

### B3. `useStepThrough` hook

- **Acceptance:** Owns playback state machine: `{ status: 'idle'|'playing'|'paused'|'done', stepIndex, steps }`. API: `play()`, `pause()`, `stepForward()`, `stepBackward()`, `reset()`, `setSpeed(ms)`. Materializes the generator's steps on mount and on input change. Auto-advances when playing using `setTimeout`. Falls back to manual stepping when `prefers-reduced-motion` is set (no auto-advance).
- **Verify:** Unit tests for each transition. Test that reduced-motion blocks auto-play.
- **Files:** `src/lib/hooks/useStepThrough.ts`, `tests/hooks/useStepThrough.test.tsx`.

### B4. `ArrayBars` component

- **Acceptance:** Pure presentational SVG. Props: `{ array: number[], highlights?: { indices: number[], kind: 'compare'|'swap'|'pivot'|'sorted' } }`. Color-blind-safe palette (uses both color and a small icon/border per `kind`). No animation logic — that lives in the parent.
- **Verify:** Component test renders without crashing across a range of array sizes; snapshot test for highlighted states.
- **Files:** `src/components/visualizations/ArrayBars.tsx`, `tests/components/ArrayBars.test.tsx`.

### B5. `Controls` component

- **Acceptance:** Buttons for Play / Pause / Step Back / Step Forward / Reset; sliders for Speed and Array Size. All keyboard-accessible (Tab order is sane, Space/Enter activates buttons, arrow keys adjust sliders). Visible focus rings. ARIA labels on every control.
- **Verify:** Component test simulates keyboard interaction and asserts callbacks fire. Manual: tab through every control with no mouse.
- **Files:** `src/components/visualizations/Controls.tsx`, `tests/components/Controls.test.tsx`.

### B6. `SortingViz` composition

- **Acceptance:** Takes `algorithm: (input: number[]) => Generator<SortStep>` and `initialSize` props. Composes `ArrayBars` + `Controls` + `useStepThrough`. Shows live counters for comparisons and swaps. Re-runs algorithm when array size or input changes.
- **Verify:** Component test mounts with `bubbleSort`, simulates clicking Play, advances state. Counters update.
- **Files:** `src/components/visualizations/SortingViz.tsx`, `tests/components/SortingViz.test.tsx`.

### B7. Bubble sort lesson MDX

- **Acceptance:** `/lessons/sorting/bubble-sort` renders prose explaining the algorithm + an embedded `<SortingViz algorithm={bubbleSort} initialSize={20} />`. Lesson has frontmatter `{ title, summary, difficulty }`.
- **Verify:** Visit page in dev. Click Play, watch it work. Tab through controls. Toggle reduced-motion in DevTools → confirm auto-play stops, manual stepping still works.
- **Files:** `src/app/lessons/sorting/bubble-sort/page.mdx`, `src/app/lessons/sorting/layout.tsx`.

> **Checkpoint B:** bubble sort lesson works end-to-end · keyboard accessible · reduced-motion respected.
> **Checkpoint B-gate (architectural):** does `SortStep` still feel clean? Will it absorb merge sort's auxiliary array without growing ugly? **Stop and refactor here if not.**

---

## Phase C — Replicate

### C1. `mergeSort` generator + tests

- **Acceptance:** Pure generator. Yields steps that capture: which sub-range is being merged, comparisons within the merge, writes to the auxiliary array, and the copy-back to the main array. `SortStep` is extended with new variants if needed (`range-active`, `aux-write`, `merge-write`) — but the extension should feel natural, not forced. If it doesn't, return to B-gate.
- **Verify:** Unit + property tests pass on 1000+ random arrays. Coverage 100% on this file.
- **Files:** `src/lib/algorithms/types.ts` (extend), `src/lib/algorithms/mergeSort.ts`, `tests/algorithms/mergeSort.test.ts`.

### C2. Update `ArrayBars` for new step kinds (if needed)

- **Acceptance:** Render auxiliary array state and "active range" highlighting. Stays color-blind safe.
- **Verify:** Snapshot tests for new states. Manual visual check.
- **Files:** `src/components/visualizations/ArrayBars.tsx`, `tests/components/ArrayBars.test.tsx`.

### C3. Merge sort lesson MDX

- **Acceptance:** `/lessons/sorting/merge-sort` renders, viz works, prose explains divide-and-conquer.
- **Verify:** Same checklist as B7.
- **Files:** `src/app/lessons/sorting/merge-sort/page.mdx`.

### C4. `quickSort` generator + tests

- **Acceptance:** Pure generator with pivot/partition steps. Should reuse existing `SortStep` variants (with maybe one `pivot` addition); if it requires a third round of `Step` extensions, that's a smell.
- **Verify:** Unit + property tests pass. Coverage 100%.
- **Files:** `src/lib/algorithms/quickSort.ts`, `src/lib/algorithms/types.ts` (if extending), `tests/algorithms/quickSort.test.ts`.

### C5. Quick sort lesson MDX

- **Acceptance:** `/lessons/sorting/quick-sort` renders, viz works, prose explains partitioning.
- **Verify:** Same checklist as B7.
- **Files:** `src/app/lessons/sorting/quick-sort/page.mdx`.

### C6. E2E smoke tests for all three lessons

- **Acceptance:** Playwright spec visits each lesson, asserts viz mounts (an SVG with bars is present), clicks Play, asserts state advances within 2s, clicks Reset, asserts state returns to initial. No console errors on any lesson page.
- **Verify:** `npm run e2e` green.
- **Files:** `e2e/lessons.spec.ts`.

> **Checkpoint C:** all three lessons render · all property tests pass · E2E smoke green.

---

## Phase D — Ship-readiness

### D1. Landing page

- **Acceptance:** `/` has a hero (title, one-sentence pitch), a "what you'll learn" section linking to lesson topics, and a "how it works" section explaining the visualization-first philosophy. Link to GitHub. Copy is good enough that I'd send it to a friend.
- **Verify:** Read it out loud. Lighthouse ≥ 90 across the board.
- **Files:** `src/app/page.tsx`, `src/components/landing/*`.

### D2. Lesson index

- **Acceptance:** `/lessons` lists topics (Sorting first), each topic shows its lessons with difficulty badges. "Coming soon" placeholders for the roadmap (data structures, ML, transformers) so visitors see direction.
- **Verify:** Visit page; click each lesson link; all resolve. Lighthouse ≥ 90.
- **Files:** `src/app/lessons/page.tsx`, `src/components/lessons/LessonCard.tsx`, possibly `src/lib/lessons.ts` (lesson registry).

### D3. Accessibility pass

- **Acceptance:** axe-core run on every route returns zero violations. Manual keyboard-only navigation works on every page. Manual screen-reader smoke test (NVDA or VoiceOver) confirms viz controls are announced sensibly.
- **Verify:** Add `@axe-core/playwright` check to E2E suite. Document any waived issues with rationale.
- **Files:** `e2e/a11y.spec.ts`.

### D4. Performance pass

- **Acceptance:** Lighthouse Performance ≥ 90 on every route. Per-route JS < 150 KB gzipped (verified with bundle analyzer). LCP < 2.5s, CLS < 0.1, INP < 200ms on a throttled 4G run. D3 imports are tree-shaken (no umbrella `d3` import).
- **Verify:** `npm run build && npm run analyze` shows budgets met. Lighthouse CI run on each route.
- **Files:** `next.config.ts` (bundle analyzer), possibly small refactors to lazy-load viz components.

### D5. Metadata, OG, SEO

- **Acceptance:** Each page has title + description metadata. OG image (can be auto-generated via Next.js `opengraph-image`). `sitemap.xml` and `robots.txt` generated. Favicon set.
- **Verify:** View source on each page. Test OG image with the Twitter card validator (or local preview).
- **Files:** `src/app/layout.tsx` (metadata), `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`, `public/favicon.ico`.

### D6. Deploy to Vercel

- **Acceptance:** Site is live on a Vercel domain (custom domain optional later). Vercel Analytics enabled. Build passes on Vercel.
- **Verify:** Visit the deployed URL; all routes work; analytics shows traffic.
- **Files:** `vercel.json` if needed (likely not — zero-config).

### D7. Verify v1 success criteria

- **Acceptance:** Walk through every checkbox in SPEC.md "Success Criteria" and confirm. Document any waivers.
- **Verify:** Each criterion ticked off in a final review note appended to SPEC.md.
- **Files:** `docs/SPEC.md` (update status to "v1 shipped").

> **Checkpoint D:** all v1 success criteria from SPEC.md are met · site is live · Vercel Analytics receiving real-user data.

---

## Out-of-band tasks (any time, low priority)

- README.md with screenshots once visualizations exist
- LICENSE file (MIT recommended) — depends on open-source decision in SPEC open questions
- CONTRIBUTING.md describing how to author a new lesson — write after Phase C so the recipe is honest

## Dependency summary

```
A1 → A2,A3,A4,A5 (parallel) → A6 → A7
A7 → B1,B2 (parallel)
B1,B2 → B3,B4 (parallel) → B5 → B6 → B7
B7 → [B-gate] → C1 → C2 → C3
C1 → C4 → C5  (in parallel with C2,C3 once C1 lands)
C3,C5 → C6
C6 → D1,D2 (parallel) → D3,D4 (parallel) → D5 → D6 → D7
```
