# Implementation Plan: CS Concept Visualizer v1

> **Status:** Draft v1 · awaiting human review
> **Companion to:** [SPEC.md](./SPEC.md)
> **Date:** 2026-05-05

## Strategy

Build the architectural bet first, prove it works, then replicate. The risky part of this project isn't writing three sorting algorithms — it's the **generator-yields-Step / visualization-replays-Step** abstraction. If that pattern doesn't generalize cleanly across all three algorithms, we'd rather find out in week 1 than week 4.

So: get bubble sort end-to-end first (algorithm + tests + viz + lesson), _then_ add merge sort. Merge sort is the real test — it has auxiliary state (the temp array during merge) that bubble sort doesn't. If our `Step` type can describe merge sort without growing ugly, the pattern is sound and quicksort drops in cheaply.

Polish (landing, lesson index, dark mode, perf, deploy) happens **after** all three lessons render correctly. Ship-ready beats feature-complete.

## Major Components & Dependencies

```
                    ┌─────────────────────┐
                    │  1. Project scaffold │  ← foundation
                    │  (Next + TS + TW)    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌─────────────┐  ┌──────────────┐  ┌────────────┐
      │ 2. Tooling  │  │  3. MDX      │  │ 4. Layout  │
      │ (lint/test/ │  │  pipeline    │  │  shell     │
      │   CI)       │  │              │  │            │
      └──────┬──────┘  └──────┬───────┘  └─────┬──────┘
             │                │                 │
             └────────────────┼─────────────────┘
                              ▼
                  ┌──────────────────────┐
                  │  5. Step type +      │  ← architectural bet
                  │  bubbleSort gen +    │     (validate early)
                  │  property tests      │
                  └──────────┬───────────┘
                             ▼
                  ┌──────────────────────┐
                  │  6. Viz shell        │
                  │  (ArrayBars,         │
                  │  Controls, hooks)    │
                  └──────────┬───────────┘
                             ▼
                  ┌──────────────────────┐
                  │  7. Bubble sort      │  ← first end-to-end
                  │     lesson page      │     CHECKPOINT: pattern works?
                  └──────────┬───────────┘
                             ▼
              ┌──────────────┴──────────────┐
              ▼                             ▼
      ┌──────────────┐            ┌──────────────┐
      │ 8. Merge sort│            │ 9. Quick sort│  ← parallelizable
      │ (real test)  │            │              │     once #7 lands
      └──────┬───────┘            └──────┬───────┘
             └──────────────┬─────────────┘
                            ▼
                ┌─────────────────────────┐
                │ 10. Landing + index +   │
                │     a11y + perf pass    │
                └────────────┬────────────┘
                             ▼
                ┌─────────────────────────┐
                │ 11. Deploy to Vercel    │
                └─────────────────────────┘
```

## Phased Execution

### Phase A — Foundation (sequential, ~1 session)

1. **Scaffold Next.js 15 App Router project** with TS strict, Tailwind v4, ESLint, Prettier.
2. **Tooling:** Vitest config, Playwright config, lint-staged + simple-git-hooks pre-commit, GitHub Actions CI (typecheck + lint + unit + e2e on PR).
3. **MDX pipeline:** wire `@next/mdx` with `rehype-katex`, `rehype-pretty-code` (Shiki), `remark-gfm`. Verify a hello-world `.mdx` renders.
4. **Layout shell:** root layout, top nav (logo + links), footer, theme toggle (light/dark via `next-themes`), 404 page.

**Checkpoint A:** `npm run dev` boots, a stub `/lessons/hello` MDX page renders with code highlighting and math, dark mode toggles, CI is green on the empty repo.

### Phase B — The architectural bet (sequential, gated)

5. **Define `Step` type and `bubbleSort` generator** in `src/lib/algorithms/`. Pure, no React, no DOM.
6. **Algorithm tests:** unit tests for known inputs + property test (`fast-check`) over random arrays.
7. **Viz primitives:**
   - `useStepThrough(generator, options)` — hook that owns the playback state machine (idle/playing/paused, current step index, speed, reduced-motion fallback).
   - `useReducedMotion()` — wraps the media query.
   - `ArrayBars` — pure presentational SVG/CSS bar chart that takes `{ array, highlights }`.
   - `Controls` — Play/Pause/Step±/Reset/Speed/Size, fully keyboard-accessible.
   - `SortingViz` — composes the above; takes `algorithm` (a generator function) as a prop.
8. **Bubble sort lesson MDX:** prose + `<SortingViz algorithm={bubbleSort} />`.

**Checkpoint B (the real one):** open `/lessons/sorting/bubble-sort`, click play, watch comparisons + swaps animate, scrub backwards with Step Back, change array size, see counters update. Tab through all controls. Toggle reduced-motion in DevTools and verify it falls back to instant stepping.

→ **If the `Step` type feels awkward at this point, stop and refactor before adding more algorithms.** This is the cheapest moment to change the abstraction.

### Phase C — Replicate (parallelizable)

9. **Merge sort.** Real stress test — needs to represent the auxiliary array, "currently merging this range" state, and the recursion stack visually. Likely extends `Step` with a couple new variants (`split`, `merge-write`, `range-active`). If `Step` resists clean extension, that's the signal to redesign.
10. **Quick sort.** Pivot selection, partition pointers, recursion. Should drop in cheaply if merge sort worked.

Each gets: algorithm + tests + lesson MDX. No new viz components needed if the abstraction held.

**Checkpoint C:** all three lessons render, all three pass property tests on 1000+ random inputs, E2E smoke tests pass for each.

### Phase D — Ship-readiness (sequential)

11. **Landing page** (`/`): hero, "what is this," lesson index preview, link to GitHub.
12. **Lesson index** (`/lessons`): grouped by topic, difficulty badges, "coming soon" placeholders for roadmap items so visitors see direction.
13. **A11y pass:** axe-core run on every page, keyboard-only walkthrough, screen reader smoke test (VoiceOver on macOS), color contrast audit.
14. **Perf pass:** Lighthouse CI on each lesson; bundle analyzer to verify per-route JS < 150 KB gzipped; lazy-load D3 only on lesson pages, not landing.
15. **OG images, favicon, metadata, sitemap.xml, robots.txt.**
16. **Deploy to Vercel**, verify Core Web Vitals on real-user data after 24h.

**Checkpoint D:** v1 success criteria from SPEC.md all check out. Site is live.

## Risks & Mitigations

| Risk                                                           | Likelihood | Impact                                 | Mitigation                                                                                                                                                                  |
| -------------------------------------------------------------- | ---------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Step` type doesn't generalize past bubble sort**            | Medium     | High — would force mid-project rewrite | Validate against merge sort _immediately after_ bubble sort, before quick sort. Allow algorithm-specific step variants from day 1; don't over-unify.                        |
| **Bundle bloat from D3 + Framer Motion**                       | Medium     | Medium                                 | Import named symbols only (`d3-scale`, `d3-selection`), not the umbrella `d3` package. Lazy-load visualizations with `dynamic(..., { ssr: false })`. Bundle-analyzer in CI. |
| **MDX + RSC client/server boundary confusion**                 | Medium     | Low                                    | Mark all visualization components `'use client'`. MDX prose stays server-rendered. Document the boundary in CONTRIBUTING.                                                   |
| **Animations regress for users with `prefers-reduced-motion`** | Low        | Medium (a11y)                          | Bake the check into `useStepThrough`, not individual visualizations. Test in CI via Playwright with `forcedColors`/`reducedMotion` emulation.                               |
| **Lighthouse score craters once D3 loads**                     | Medium     | Medium                                 | Set per-route bundle budget in CI. Pre-render the first frame of the visualization so LCP isn't blocked on JS hydration.                                                    |
| **Scope creep into roadmap items**                             | High       | High                                   | Re-read SPEC.md success criteria when tempted. v1 is three sorting algorithms — nothing else gets a route until v1 ships.                                                   |
| **Generator pattern has perf issues for large arrays**         | Low        | Low                                    | Materialize all steps upfront on a worker thread if it ever matters. Not a v1 concern; bubble sort with N=50 is ~2500 steps, trivial.                                       |

## What can run in parallel

Once Phase B's checkpoint passes:

- Merge sort and quick sort implementations are independent (Phase C).
- Landing page and lesson index design can start in parallel with Phase C.
- A11y and perf audits run continuously in CI; not a separate "phase" so much as a standing requirement.

What is **strictly sequential**:

- Phase A → Phase B (need scaffold + MDX before writing lessons).
- Bubble sort end-to-end → merge sort (need the abstraction validated first).
- All three lessons → ship-readiness pass (Phase D needs the content to audit).

## Verification Checkpoints (summary)

| Checkpoint | Gate before advancing                                                   |
| ---------- | ----------------------------------------------------------------------- |
| **A**      | Dev server runs; MDX renders with KaTeX + Shiki; CI green               |
| **B**      | Bubble sort lesson works end-to-end; keyboard + reduced-motion verified |
| **B-gate** | `Step` type still feels clean — if not, refactor before Phase C         |
| **C**      | All three lessons render; property tests pass; E2E smoke green          |
| **D**      | All v1 success criteria from SPEC.md check out; deployed                |

## Out of Scope for v1 (explicit)

To prevent drift, these are _not_ getting built in v1, even if tempting:

- User accounts, login, progress tracking
- Comments / discussion
- Search across lessons
- Any non-sorting algorithm
- Any data structure visualization
- Any ML / transformer content
- 3D visualizations (no `react-three-fiber` install yet — defer until first ML lesson)
- i18n
- Custom analytics beyond Vercel's built-in
