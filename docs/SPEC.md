# Spec: CS Concept Visualizer (working title)

> **Status:** v1 implemented · awaiting deploy authorization (D6)
> **Author:** Tzun · **Date:** 2026-05-05

## Objective

A web-based learning platform that helps CS students build intuition by _seeing_ how algorithms and architectures work, not just reading about them. Each lesson is a short, interactive page with an embedded visualization the student can scrub, step, parameterize, and break.

**Target user:** undergraduate / self-taught CS students who can read pseudocode but want intuition for _why_ something behaves the way it does. Specifically:

- Someone studying for a DS&A interview who wants to _feel_ the difference between O(n log n) and O(n²) by watching it.
- A student in their first ML course who has read about attention but doesn't yet have a mental model.

**v1 scope (the thing we ship first):** three sorting algorithm visualizations — bubble sort, merge sort, quicksort — each with step controls, speed controls, an array-size slider, and a live operation counter. Plus a landing page and one written "intro to algorithm visualization" lesson.

**Roadmap (NOT v1):**

- More algorithms: insertion/heap/radix sort, binary search, BFS/DFS, Dijkstra, A\*
- Data structures: linked lists, trees, graphs, heaps, hash tables
- Dynamic programming (knapsack, LCS, edit distance)
- ML basics: gradient descent, backprop, simple neural net forward pass
- Transformer architecture: attention heads, positional encoding, full block visualization
- Possibly later: user accounts + progress tracking, community contributions

**Success means:**

- A student lands on `/sorting/bubble-sort`, plays with the visualization for 60+ seconds, and leaves understanding _why_ bubble sort is O(n²) — not because they read it, but because they watched the comparisons stack up.
- The site feels fast and polished enough that it doesn't feel like a school project.
- Adding a new lesson is a matter of writing one `.mdx` file plus (optionally) one new visualization component.

## Tech Stack

| Layer                | Choice                                            | Why                                                            |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| Framework            | Next.js 15+ (App Router)                          | RSC, MDX support, great SEO for educational long-tail searches |
| Language             | TypeScript (strict)                               | Non-negotiable for a codebase that will grow                   |
| Runtime              | React 19+                                         | Concurrent features useful for animation-heavy UI              |
| Styling              | Tailwind CSS v4                                   | Utility-first, no CSS-in-JS runtime cost                       |
| Component primitives | shadcn/ui                                         | Accessible, copy-in (no dep weight)                            |
| Content              | MDX (`@next/mdx`)                                 | Markdown lesson prose + interactive React components inline    |
| 2D visualizations    | D3.js (selection + scales + transitions)          | Industry standard for data viz                                 |
| 3D visualizations    | three.js + @react-three/fiber + drei              | For transformer/embedding viz on the roadmap                   |
| Animation            | Framer Motion                                     | Declarative, plays nicely with React                           |
| Math rendering       | KaTeX (via `rehype-katex`)                        | Faster than MathJax                                            |
| Code highlighting    | Shiki (via `rehype-pretty-code`)                  | Build-time, zero runtime cost                                  |
| Testing (unit)       | Vitest                                            | Fast, Vite-native                                              |
| Testing (E2E)        | Playwright                                        | Real browser interaction for visualizations                    |
| Linting              | ESLint + Prettier                                 | Standard                                                       |
| Hosting              | Vercel                                            | Zero-config Next.js, free tier, edge cache                     |
| Analytics            | Vercel Analytics (privacy-respecting, no cookies) | Real-user perf monitoring                                      |

## Commands

```
Install:    npm install
Dev:        npm run dev               # http://localhost:3000
Build:      npm run build
Preview:    npm run start             # serves the production build
Lint:       npm run lint              # eslint
Format:     npm run format            # prettier --write .
Typecheck:  npm run typecheck         # tsc --noEmit
Test:       npm test                  # vitest run
Test watch: npm run test:watch        # vitest
E2E:        npm run e2e               # playwright test
```

## Project Structure

```
src/
  app/                          → Next.js App Router
    layout.tsx                  → Root layout (nav, footer, theme)
    page.tsx                    → Landing page
    lessons/
      page.tsx                  → Lesson index
      sorting/
        page.tsx                → Sorting topic overview
        bubble-sort/
          page.mdx              → Lesson content
        merge-sort/page.mdx
        quick-sort/page.mdx
  components/
    visualizations/             → Reusable visualization components
      SortingViz.tsx            → Generic sorting visualization shell
      ArrayBars.tsx             → Bar-chart array renderer
      Controls.tsx              → Play/pause/step/speed/reset
    ui/                         → shadcn primitives (button, slider, etc.)
    layout/                     → Nav, footer, theme toggle
  lib/
    algorithms/                 → Pure algorithm implementations as generators
      bubbleSort.ts             → yields each comparison/swap step
      mergeSort.ts
      quickSort.ts
    hooks/                      → useStepThrough, useReducedMotion, etc.
    utils/                      → cn(), formatters, etc.
  styles/
    globals.css
tests/
  algorithms/                   → Unit tests for algorithm correctness
e2e/
  smoke.spec.ts                 → "Page loads, viz renders, controls work"
docs/
  SPEC.md                       → This file
  CONTRIBUTING.md               → How to add a new lesson
public/                         → Static assets, og images
```

**Conventions:**

- Algorithm implementations are **pure generator functions** that yield a sequence of `Step` objects (`{ type: 'compare' | 'swap' | 'pivot' | ..., indices: number[], array: number[] }`). The visualization replays these steps. This separates _what the algorithm does_ from _how it's drawn_ — testable in isolation, and reusable across visualizations.
- Each lesson MDX imports its visualization from `components/visualizations/` and configures it via props.

## Code Style

Real example — the bubble sort generator and how a lesson uses it:

```ts
// src/lib/algorithms/bubbleSort.ts
export type SortStep =
  | { type: "compare"; indices: [number, number]; array: number[] }
  | { type: "swap"; indices: [number, number]; array: number[] }
  | { type: "done"; array: number[] };

export function* bubbleSort(input: readonly number[]): Generator<SortStep> {
  const arr = [...input];
  for (let i = 0; i < arr.length - 1; i++) {
    for (let j = 0; j < arr.length - 1 - i; j++) {
      yield { type: "compare", indices: [j, j + 1], array: [...arr] };
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        yield { type: "swap", indices: [j, j + 1], array: [...arr] };
      }
    }
  }
  yield { type: "done", array: arr };
}
```

```mdx
// src/app/lessons/sorting/bubble-sort/page.mdx
import { SortingViz } from '@/components/visualizations/SortingViz';
import { bubbleSort } from '@/lib/algorithms/bubbleSort';

# Bubble Sort

Bubble sort walks through the array, swapping adjacent pairs when they're
out of order. Watch the largest values "bubble" to the end with each pass.

<SortingViz algorithm={bubbleSort} initialSize={20} />

## Why is it O(n²)?

Each pass through the array makes at most `n - 1` comparisons, and we need
up to `n - 1` passes...
```

**Key conventions:**

- Components are function components, named exports, PascalCase.
- Files match the primary export's name. One component per file unless tightly coupled.
- Hooks live in `src/lib/hooks/` and start with `use`.
- Algorithm implementations never touch the DOM; visualizations never implement the algorithm.
- No `any`, no `// @ts-ignore`. Use `unknown` + narrowing if you must.
- Tailwind classes ordered: layout → spacing → typography → color → state. Use `clsx`/`cn` helper for conditionals.
- Imports: external → internal alias (`@/...`) → relative. Sorted within groups.

## Testing Strategy

**Layer 1 — algorithm correctness (Vitest, fast, runs in CI on every push):**

- Every algorithm in `src/lib/algorithms/` has a test that exhausts the generator and asserts the final array is sorted.
- Property-based test using `fast-check`: for any random array of length 0–50, the algorithm produces a sorted output equal to `[...arr].sort((a,b)=>a-b)`.
- Edge cases explicitly: empty array, single element, already-sorted, reverse-sorted, all-duplicates.

**Layer 2 — component rendering (Vitest + Testing Library):**

- Visualization components render without crashing across a range of props.
- Controls dispatch the right state changes (Play, Pause, Step, Reset).

**Layer 3 — E2E smoke (Playwright, runs on PRs):**

- Each lesson page loads, visualization mounts, Play button advances state, Reset returns to initial.
- No console errors on any lesson page.

**Coverage targets:** `src/lib/algorithms/` at 100% (it's pure logic, there's no excuse). Everywhere else: no fixed target — write tests where bugs would actually hurt.

## Boundaries

**Always:**

- Run `npm run typecheck && npm run lint && npm test` before commits (enforce via lint-staged + simple-git-hooks).
- Respect `prefers-reduced-motion`: visualizations fall back to instant step-through, no auto-play.
- Keyboard support: every interactive control reachable via Tab; Space/Enter activates; arrow keys for step/speed where it makes sense.
- Color-blind-safe palettes; never encode meaning in color alone (also use shape/position/label).
- Stay within performance budgets per lesson page: **LCP < 2.5s, CLS < 0.1, INP < 200ms** on a 4G connection. JS bundle per lesson route < 150 KB gzipped.
- All MDX lessons have a frontmatter title, summary, and difficulty level.
- Algorithm implementations are pure (no globals, no DOM).

**Ask first:**

- Adding any new top-level dependency (especially anything that adds to client bundle).
- Adding a backend / API route / database — the v1 plan is fully static.
- Changing CI configuration or deployment settings.
- Introducing a new content format or a new top-level route group.
- Refactors that touch more than ~5 files unless they're trivially mechanical.

**Never:**

- Commit secrets, `.env*` files, or any API keys.
- Ship a regression on Core Web Vitals without a documented reason.
- Override `prefers-reduced-motion` (no "but it looks cooler animated").
- Use `dangerouslySetInnerHTML` outside of trusted, build-time-rendered content (MDX/Shiki output).
- Disable accessibility lints to make warnings go away — fix the root cause.
- Remove or skip a failing test without human approval.

## Success Criteria

v1 walkthrough as of 2026-05-05:

- [x] `/` (landing) renders, explains the project, links to the lesson index — `src/app/page.tsx`.
- [x] `/lessons` lists available lessons grouped by topic with difficulty badges and "coming soon" placeholders — `src/app/lessons/page.tsx`.
- [x] `/lessons/sorting/bubble-sort`, `/merge-sort`, `/quick-sort` each:
  - [x] Render an interactive visualization with Play / Pause / Step Forward / Step Back / Reset / Speed slider / Array-size slider.
  - [x] Show a live count of comparisons and swaps.
  - [ ] **Pass Lighthouse ≥ 90 across the board.** Not yet measured against a deployed URL — bundle sizes (largest gzipped chunk ~71 KB; per-route additions 10–40 KB) and zero axe violations are favorable signals, but a real Lighthouse run on production happens after D6 (deploy).
  - [x] Keyboard-navigable end-to-end (verified by axe and Controls component tests).
  - [x] Respect `prefers-reduced-motion` (verified in `useStepThrough` tests).
- [x] Each algorithm has 100% line + branch coverage in `src/lib/algorithms/` (vitest coverage report).
- [x] Property-based tests pass — `fast-check`, 1000 runs each on bubble / merge / quick sort.
- [x] E2E smoke tests pass for all three lessons (`e2e/lessons.spec.ts`) plus axe a11y checks on three routes (`e2e/a11y.spec.ts`).
- [x] Adding a new sorting algorithm requires (a) one new file in `src/lib/algorithms/`, (b) one new entry in the `sortAlgorithms` registry (`src/lib/algorithms/index.ts`), (c) one new MDX page — and _nothing else_. The registry exists because Next.js RSC cannot pass function values across the server→client boundary, so visualizations are addressed by string key. **Architecture generalized cleanly across three algorithms with materially different shapes** (in-place pair swaps, divide-and-conquer with auxiliary array, in-place partitioning around pivots). `SortStep` was extended additively from 3 variants to 6.
- [ ] **Site deployed and publicly accessible.** Pending — D6 needs Vercel authorization from the user.

## Open Questions

These need a human answer before or during implementation:

1. **Project name + domain.** "CS Concept Visualizer" is a placeholder. Suggestions welcome — needs to be brandable and not already taken.
2. **Public repo from day one?** Implies adding LICENSE (MIT? Apache 2.0?), CONTRIBUTING.md, code of conduct.
3. **Comments / discussion under lessons?** Out of scope for v1, but worth knowing whether we'd add Giscus or similar later — affects info architecture.
4. **Dark mode required for v1, or roadmap?** I'd default to "yes for v1" since it's table stakes, but it adds design work.
5. **Mobile experience for dense visualizations** — graceful degradation (show simplified version) or "please use desktop" prompt? My default is graceful degradation, but it's real work.
6. **Internationalization** ever? If yes, the MDX content structure should plan for it now. Default assumption: English only.
7. **Are you the sole author for the foreseeable future?** Affects how much we invest in `CONTRIBUTING.md` and the lesson-authoring DX upfront.
