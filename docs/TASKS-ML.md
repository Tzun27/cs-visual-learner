# Tasks: ML Intuitions Pillar (v1)

> **Status:** Drafted from `docs/PLAN-ML.md`. Each task is intended to be **one commit**.
> Awaiting human review before Phase 4 (Implement).
> **Author:** Tzun · **Date:** 2026-05-12

## How to read this file

- Tasks are ordered by dependency. Don't skip ahead.
- Each task lists **Acceptance** (what's true when done) and **Verify** (exact commands
  to run or manual checks). Touch the listed **Files** — if a task wants to touch more
  than ~5 files, that's a smell; break it down.
- **One task = one commit** per `AGENTS.md` discipline. Commit message format follows
  the repo's existing style (`feat(scope): …` / `test(scope): …` / `docs: …` etc.).
- A task is "done" when its Verify steps all pass and the commit lands on `main` (or a
  branch that's been merged). Update `next_session.md` only in Phase E unless a task
  changes a load-bearing fact mid-stream.

---

## Phase A — Foundations (3 tasks)

### A1. Wire coverage gate + ML types stub

- **Description:** Extend the Vitest coverage gate to include `src/lib/ml/**`. Land a
  placeholder `index.ts` so the include glob matches at least one file (avoids the
  empty-directory edge case). Defer per-lesson step unions to their respective
  commits (no `never` placeholder types in this commit).
- **Acceptance:**
  - `vitest.config.ts` lists `src/lib/ml/**/*.ts` in the coverage `include` array
    alongside `algorithms/` and `dataStructures/`.
  - 100% line/branch/function/statement thresholds apply to the new include.
  - `src/lib/ml/index.ts` exists (empty `export {};` is fine).
  - `npm run test:coverage` passes locally with the gate in place.
- **Verify:**
  - `npm run typecheck && npm run lint && npm run test:coverage`
  - Inspect coverage output: `src/lib/ml/` appears in the report (or "no files" report
    is acceptable for empty dir — but confirm the threshold doesn't fail).
- **Files:** `vitest.config.ts`, `src/lib/ml/index.ts` (new).
- **Commit:** `chore(ml): wire src/lib/ml/** into the 100% coverage gate`

### A2. `<MathLevel>` context, components, and ML layout

- **Description:** Land the math-level toggle and its context provider. Includes the
  `<MathLevel />` toggle pill (radio group), `<IntuitionOnly>` / `<MathOnly>` gating
  components, `useMathLevel` hook, and the `app/lessons/ml/layout.tsx` that wires the
  provider for all future ML lessons.
- **Acceptance:**
  - `useMathLevel` defaults to `"intuition"`, swaps to persisted value via `useEffect`
    post-mount (SSR-safe — no `localStorage` access on server).
  - `<MathLevel />` renders as a `role="radiogroup"` with two pills; `aria-checked`
    reflects state; keyboard-reachable (Tab + Space/Enter to toggle, Arrow keys to move
    between pills — match the radio-group ARIA contract).
  - `<IntuitionOnly>` and `<MathOnly>` render children or null based on context.
  - `app/lessons/ml/layout.tsx` wraps children in the provider.
  - Unit tests cover: default value, set + read, SSR safety (no crash with `window`
    undefined-simulated), keyboard interaction.
- **Verify:**
  - `npm run typecheck && npm run lint && npm test -- src/lib/hooks/useMathLevel src/components/mdx/MathLevel`
  - Manual sanity: open `/lessons/ml/_test-route` (or any tmp route added during dev) —
    no hydration warning in DevTools console.
- **Files:** `src/lib/hooks/useMathLevel.ts` (new), `src/components/mdx/MathLevel.tsx` (new),
  `src/app/lessons/ml/layout.tsx` (new), `src/lib/hooks/useMathLevel.test.ts` (new),
  `src/components/mdx/MathLevel.test.tsx` (new). **5 files — at the limit.**
- **Commit:** `feat(ml): add <MathLevel> toggle + context + ml layout`

### A3. `Controls` trajectory button + `useStepThrough.runToCompletion()`

- **Description:** Add an optional `onRunToCompletion` button to `Controls` and a
  `runToCompletion()` method to `useStepThrough`. Under reduced motion: snap to last
  step. Otherwise: reuse the existing auto-advance timer (don't spin a second one).
- **Acceptance:**
  - `Controls` only renders the button when `onRunToCompletion` is passed.
  - Button is disabled when `status === "playing"` or `canStepForward === false`.
  - `useStepThrough.runToCompletion()` advances to the last step using the existing
    timer in normal mode, snaps under reduced motion.
  - Unit tests cover: button visibility, click emits callback, hook behavior in both
    motion modes.
  - No existing tests break (`Controls` consumers without the new prop still work).
- **Verify:**
  - `npm run typecheck && npm run lint && npm test -- Controls useStepThrough`
- **Files:** `src/components/visualizations/Controls.tsx`, `src/lib/hooks/useStepThrough.ts`,
  `src/components/visualizations/Controls.test.tsx`, `src/lib/hooks/useStepThrough.test.ts`.
- **Commit:** `feat(controls): add run-to-completion trajectory button`

---

## Phase B — Gradient Descent (4 tasks)

### B1. GD generator + snippet + tests

- **Description:** Pure generator `gradientDescentSequence(params)` over the asymmetric
  bowl loss $f(w_1, w_2) = w_1^2 + 3 w_2^2$. Co-located Python snippet with line
  constants. Step kinds: `begin`, `compute-gradient`, `apply-update`, `converged`,
  `done`. Each carries `codeLines` per branch.
- **Acceptance:**
  - `gradientDescentSequence` is a pure generator (no DOM, no globals).
  - Snippet exports `gradientDescentPython` (string) and `gradientDescentLines`
    (named line numbers). Lines reference branches, not just kinds (e.g., the
    convergence return is a different line from the max-steps return).
  - 100% coverage on `gradientDescent.ts` and `gradientDescent.snippet.ts`.
  - Tests cover: convergence from 3 fixed starts, lr=0 yields no movement, start at
    origin terminates immediately, every step's `codeLines` is within source bounds,
    snapshot immutability.
  - Property test (fast-check, 200 runs): random start ∈ [-5, 5]² and lr ∈ (0, 0.3]
    either converges or hits maxSteps; trajectory length = update count + 1.
- **Verify:**
  - `npm run typecheck && npm run lint && npm run test:coverage -- src/lib/ml/gradientDescent`
  - Coverage report shows 100% lines/branches/functions for both new files.
- **Files:** `src/lib/ml/gradientDescent.ts` (new), `src/lib/ml/gradientDescent.snippet.ts` (new),
  `src/lib/ml/gradientDescent.test.ts` (new), `src/lib/ml/types.ts` (new — adds
  `GradientDescentStep` + `GradientDescentSnapshot`). **4 files.**
- **Commit:** `feat(ml): add gradient-descent generator + snippet + tests`

### B2. `ContourView` primitive + bowl contours data + tests

- **Description:** Pure SVG primitive rendering a contour-line background, a trajectory
  polyline, the current point, and an optional gradient arrow. Bowl-contour level set
  lives in `src/lib/ml/gradientDescent.contours.ts` (data, not lesson copy) so it's
  testable and re-usable.
- **Acceptance:**
  - `ContourView` accepts `snapshot`, `contours`, `bounds`, optional `gradient` arrow.
  - Renders without crashing for empty / single-point / multi-step trajectories.
  - Reduced-motion compliant — no animations on its own; new points pop in per step.
  - aria-label describes the current state ("Gradient descent at step N of M, current
    loss X").
  - 100% coverage on the new files.
- **Verify:**
  - `npm run typecheck && npm run lint && npm run test:coverage -- ContourView gradientDescent.contours`
- **Files:** `src/components/visualizations/ContourView.tsx` (new),
  `src/lib/ml/gradientDescent.contours.ts` (new),
  `src/components/visualizations/ContourView.test.tsx` (new),
  `src/lib/ml/gradientDescent.contours.test.ts` (new). **4 files.**
- **Commit:** `feat(viz): add ContourView + bowl-contour data`

### B3. `GradientDescentViz` wrapper + tests

- **Description:** Client component wiring `gradientDescentSequence` into
  `useStepThrough` (with `runToCompletion`). `<ContourView>` + `<CodePanel>` side-by-side
  at md+. Annotation strip + counters (Steps / Current loss / Gradient norm). lr select.
- **Acceptance:**
  - `<section aria-label="Gradient descent">` wraps the viz (e2e selector scoping).
  - lr select resets state; Run button reaches converged state; step buttons advance
    annotation; CodePanel highlight follows step's `codeLines`.
  - Unit tests cover: step advances annotation, lr select resets, run-to-completion
    reaches done state.
- **Verify:**
  - `npm run typecheck && npm run lint && npm test -- GradientDescentViz`
- **Files:** `src/components/visualizations/GradientDescentViz.tsx` (new),
  `src/components/visualizations/GradientDescentViz.test.tsx` (new). **2 files.**
- **Commit:** `feat(viz): add GradientDescentViz + lr-select + run-to-completion`

### B4. GD MDX page + e2e + a11y route

- **Description:** Lesson MDX with `<MathLevel />` toggle, intuition prose, math prose,
  two callouts, and the embedded viz. Playwright spec exercising step / run / math
  toggle. Extend `a11y.spec.ts` from 17 → 18 routes.
- **Acceptance:**
  - `/lessons/ml/gradient-descent` lives.
  - Bundle for this route < 175 KB gzipped (`npm run build` output).
  - e2e covers: load, step, run-to-completion, math toggle swaps prose, no console
    errors.
  - axe-core green on the new route at `serious` or higher.
  - Lessons-index entry stays `coming-soon` for now (E1 promotes it).
- **Verify:**
  - `npm run build` — inspect route size in output.
  - `npm run e2e -- gradient-descent.spec` + `npm run e2e -- a11y.spec`
- **Files:** `src/app/lessons/ml/gradient-descent/page.mdx` (new),
  `e2e/gradient-descent.spec.ts` (new), `e2e/a11y.spec.ts` (extend). **3 files.**
- **Commit:** `feat(lessons): add Gradient Descent lesson + e2e`

---

## Phase C — Backprop (4 tasks)

### C1. Backprop generator + snippet + tests

- **Description:** Pure generator over a fixed 2 → 2 → 1 ReLU MLP and one curated
  training example. Step kinds cover forward/backward/update at the granularity laid
  out in PLAN-ML.md §C1. Snippet co-located with branch-level line constants.
- **Acceptance:**
  - Forward pass output matches hand-computed value to 1e-9.
  - Backward gradients match a forward-difference numerical-gradient check to within
    1e-4 (the numerical helper lives in the test file, not in `src/lib/ml/`).
  - After one update with the chosen lr, loss strictly decreases.
  - 100% coverage on both new files.
  - Every step's `codeLines` is within source bounds.
- **Verify:**
  - `npm run typecheck && npm run lint && npm run test:coverage -- src/lib/ml/backprop`
- **Files:** `src/lib/ml/backprop.ts` (new), `src/lib/ml/backprop.snippet.ts` (new),
  `src/lib/ml/backprop.test.ts` (new), `src/lib/ml/types.ts` (extend with
  `BackpropStep` + `BackpropSnapshot`). **4 files.**
- **Commit:** `feat(ml): add backprop generator + snippet + tests`

### C2. `NetworkView` primitive + tests

- **Description:** Pure SVG primitive: 3 columns of nodes (2/2/1), weighted edges,
  per-node activation/gradient labels. Phase-aware coloring (forward = blue, backward
  = orange, neutral = zinc). Shape redundancy via arrow direction.
- **Acceptance:**
  - Renders all four phases (`forward`/`backward`/`update`/`done`) without crashing.
  - Highlight a single node or edge via a `highlights` prop (mirrors `PairingHeapView`
    contract).
  - aria-label describes current phase + current node/edge.
  - 100% coverage.
- **Verify:**
  - `npm run typecheck && npm run lint && npm run test:coverage -- NetworkView`
- **Files:** `src/components/visualizations/NetworkView.tsx` (new),
  `src/components/visualizations/NetworkView.test.tsx` (new). **2 files.**
- **Commit:** `feat(viz): add NetworkView (small MLP renderer)`

### C3. `BackpropViz` wrapper + tests

- **Description:** Client component wiring `backpropSequence` into `useStepThrough` with
  `runToCompletion`. `<NetworkView>` + `<CodePanel>` side-by-side. Annotation strip +
  counters (Phase / Step / Loss).
- **Acceptance:**
  - `<section aria-label="Backpropagation">` wraps the viz.
  - Step button cycles through forward/backward/update/done.
  - Run-to-completion reaches `done` phase.
  - Unit tests cover step/run behavior.
- **Verify:**
  - `npm run typecheck && npm run lint && npm test -- BackpropViz`
- **Files:** `src/components/visualizations/BackpropViz.tsx` (new),
  `src/components/visualizations/BackpropViz.test.tsx` (new). **2 files.**
- **Commit:** `feat(viz): add BackpropViz + run-to-completion`

### C4. Backprop MDX page + e2e + a11y route

- **Description:** Lesson MDX with `<MathLevel />`, intuition prose ("blame
  assignment"), math prose (chain rule), two callouts (ReLU choice, ReLU kink), embedded
  viz. Playwright spec. Extend `a11y.spec.ts` 18 → 19 routes.
- **Acceptance:**
  - `/lessons/ml/backprop` lives.
  - Bundle < 175 KB.
  - e2e + axe green.
- **Verify:**
  - `npm run build` + `npm run e2e -- backprop.spec a11y.spec`
- **Files:** `src/app/lessons/ml/backprop/page.mdx` (new),
  `e2e/backprop.spec.ts` (new), `e2e/a11y.spec.ts` (extend). **3 files.**
- **Commit:** `feat(lessons): add Backprop lesson + e2e`

---

## Phase D — Attention (4 tasks)

### D1. Attention generator + snippet + tests

- **Description:** Pure generator over a fixed single attention head, 3 tokens labeled
  `t1/t2/t3`, Q/K/V dim = 2, fixed projection matrices. Step kinds per PLAN-ML.md §D1.
- **Acceptance:**
  - Attention rows sum to 1.0 ± 1e-10 after softmax.
  - Output for token i is a convex combination of value rows.
  - Deterministic given fixed Q/K/V.
  - 100% coverage on both new files.
- **Verify:**
  - `npm run typecheck && npm run lint && npm run test:coverage -- src/lib/ml/attention`
- **Files:** `src/lib/ml/attention.ts` (new), `src/lib/ml/attention.snippet.ts` (new),
  `src/lib/ml/attention.test.ts` (new), `src/lib/ml/types.ts` (extend with
  `AttentionStep` + `AttentionSnapshot`). **4 files.**
- **Commit:** `feat(ml): add attention generator + snippet + tests`

### D2. `AttentionView` primitive + tests

- **Description:** Pure SVG primitive: top row of token labels, Q/K/V matrices on the
  left, 3×3 attention heatmap center, output vectors right. Two palettes: diverging
  for pre-softmax scores, sequential [0,1] for post-softmax weights. Numerical cell
  labels everywhere (shape redundancy with color).
- **Acceptance:**
  - Renders all step phases.
  - Highlights via `highlights` prop (current query row, current key column, current
    attention cell).
  - aria-label describes the current step.
  - 100% coverage.
- **Verify:**
  - `npm run typecheck && npm run lint && npm run test:coverage -- AttentionView`
- **Files:** `src/components/visualizations/AttentionView.tsx` (new),
  `src/components/visualizations/AttentionView.test.tsx` (new). **2 files.**
- **Commit:** `feat(viz): add AttentionView (Q/K/V + heatmap)`

### D3. `AttentionViz` wrapper + tests

- **Description:** Client component wiring `attentionSequence` into `useStepThrough`
  with `runToCompletion`. `<AttentionView>` + `<CodePanel>` side-by-side. Annotation
  strip + counters (Step / Phase).
- **Acceptance:**
  - `<section aria-label="Attention">` wraps the viz.
  - Run-to-completion reaches `done` phase.
  - Unit tests cover step/run behavior.
- **Verify:**
  - `npm run typecheck && npm run lint && npm test -- AttentionViz`
- **Files:** `src/components/visualizations/AttentionViz.tsx` (new),
  `src/components/visualizations/AttentionViz.test.tsx` (new). **2 files.**
- **Commit:** `feat(viz): add AttentionViz + run-to-completion`

### D4. Attention MDX page + e2e + a11y route

- **Description:** Lesson MDX with `<MathLevel />`, intuition prose (Q/K/V as "looking
  for / representing / contributing"), math prose ($\text{softmax}(QK^T/\sqrt{d_k}) V$),
  callouts (the $\sqrt{d_k}$ scaling, multi-head forward-link). Playwright spec. Extend
  `a11y.spec.ts` 19 → 20 routes.
- **Acceptance:**
  - `/lessons/ml/attention` lives.
  - Bundle < 175 KB.
  - e2e + axe green.
- **Verify:**
  - `npm run build` + `npm run e2e -- attention.spec a11y.spec`
- **Files:** `src/app/lessons/ml/attention/page.mdx` (new),
  `e2e/attention.spec.ts` (new), `e2e/a11y.spec.ts` (extend). **3 files.**
- **Commit:** `feat(lessons): add Attention lesson + e2e`

---

## Phase E — Rollout (2 tasks)

### E1. Promote ML lessons in `/lessons` index + Chrome DevTools MCP sweep

- **Description:** Flip the three ML entries in `src/app/lessons/page.tsx` from
  `coming-soon` to `live` (with their slugs). Refresh the ML topic blurb. Then run a
  Chrome DevTools MCP pass across all three lessons in light + dark + reduced-motion to
  catch anything axe couldn't.
- **Acceptance:**
  - All three lessons show as `live` on `/lessons`.
  - No console errors on any of the three routes in light / dark / reduced-motion
    modes. (Reduced-motion verified by toggling `prefers-reduced-motion` in DevTools.)
  - Math toggle works on each lesson; persistence carries across all three.
  - run-to-completion reaches done state on each lesson.
- **Verify:**
  - `npm run build && npm run e2e`
  - Chrome DevTools MCP: navigate each of the three new routes, screenshot, list
    console messages — assert empty.
- **Files:** `src/app/lessons/page.tsx`. **1 file.**
- **Commit:** `feat(lessons): promote ML pillar entries from coming-soon to live`

### E2. Refresh docs (next_session.md, SPEC-ML success criteria)

- **Description:** Update `next_session.md` to mention the ML pillar in "What ships
  today," bump test counts, update a11y route count to 20. Tick all 8 success-criteria
  checkboxes in `SPEC-ML.md`. Note v2 follow-ups surfaced during build (Pyodide,
  multi-head attention, optimizer zoo, loss-landscape playgrounds, etc.).
- **Acceptance:**
  - `next_session.md` reflects the new state.
  - `docs/SPEC-ML.md` checkboxes all ticked.
  - If surprising/non-obvious learnings emerged during build, add a memory file under
    `~/.claude/projects/-home-tzun-repos-cs-visual-learner/memory/` and link from
    `MEMORY.md`.
- **Verify:**
  - `git diff` review.
  - Read both files end-to-end to confirm accuracy.
- **Files:** `next_session.md`, `docs/SPEC-ML.md`. **2 files** (plus optional
  memory entry).
- **Commit:** `docs: refresh next_session.md after ML pillar v1`

---

## Summary

**17 tasks across 5 phases.** Each maps to one commit per AGENTS.md discipline.

| Phase | Tasks | Estimated sessions | Validates                |
| ----- | ----- | ------------------ | ------------------------ |
| A     | 3     | 1                  | Foundations land cleanly |
| B     | 4     | 1–2                | Pattern works end-to-end |
| C     | 4     | 2                  | Network viz primitive    |
| D     | 4     | 2                  | Heatmap viz primitive    |
| E     | 2     | 1                  | Rollout + docs           |

**Total commits expected:** 17.
**Total estimated sessions:** 7–8.

**Next step:** Phase 4 (Implement) — execute tasks in order, one commit per task. Use
`incremental-implementation` + `test-driven-development` skills as needed. Update
`next_session.md` only at E2 unless a task changes a load-bearing fact mid-stream.
