# Spec: ML Intuitions Pillar (v1)

> **Status:** Drafted from `docs/ideas/ml-pillar-v1.md` (Direction A). Awaiting human review before Phase 2 (Plan).
> **Author:** Tzun · **Date:** 2026-05-12

## Objective

Extend `cs-visual-learner` with a third pillar — **Machine Learning Intuitions** — that
applies the site's existing step-through pattern (pure-generator data layer → SVG view →
Python code panel synchronized to each step) to ML internals. v1 ships three independent
lessons under `/lessons/ml/`:

1. **Gradient Descent** — 2-parameter quadratic bowl, contour plot, vanilla GD trajectory.
2. **Backprop** — 2 → 2 → 1 tiny MLP, forward + backward + weight update on one example.
3. **Attention** — single attention head, 3–4 tokens, small Q/K/V dim, fixed input.

Each lesson carries a **`<MathLevel>` toggle** at the top of the page that swaps prose
between two registers — _intuition_ (no calculus required) and _with math_
($\nabla L$, chain rule, $\text{softmax}(QK^T/\sqrt{d_k}) V$). **The visualizations are
identical across modes**; only the prose changes. This is the load-bearing new
mechanism that lets the pillar serve both a CS freshman and a CS undergrad without
forking the site.

Each lesson supports two playback modes via a new **trajectory button** in `Controls`:

- **Step** — one click = one update (one gradient step / one node computation / one
  query × keys row), matching the existing step-through contract.
- **Run to completion** — draws the full trajectory as a continuous path. Reduced-motion
  users see the end state immediately; non-reduced-motion users see an animation. Same
  step data underneath; only rendering differs.

**Target user:**

- Undergrad CS student who has seen calculus and linear algebra and wants to _watch_
  the chain rule unfold rather than read about it. (with-math mode)
- CS freshman with weak/no calculus who has heard "gradient descent walks downhill" and
  wants to see what that actually looks like. (intuition mode)

**Success means:**

- A student lands on `/lessons/ml/gradient-descent`, flips between intuition / math modes,
  watches GD converge on a 2D contour plot, and leaves understanding that "downhill in
  parameter space" is a literal geometric thing.
- The pillar feels native to the site — same `Controls` toolbar, same `CodePanel`, same
  color palette, same reduced-motion behavior, same a11y guarantees.
- Adding a fourth ML lesson is a matter of writing one generator + one view primitive +
  one viz wrapper + one MDX page — no framework changes.

**Explicitly NOT v1 (deferred to v2 or later):**

- **Pyodide / live Python execution.** ~10 MB bundle cost, web-worker lifecycle, sandbox
  edge cases. Dual-track + hybrid-viz must prove itself first.
- Multi-head attention, positional encoding, layer norm, residuals — single-head
  attention should explain the mechanism, the full transformer is at least two more
  lessons.
- Optimizer zoo (momentum, Adam, RMSProp) — worth a follow-up lesson but too much
  surface area for v1.
- Loss-landscape playgrounds where users drag start points — v1 ships curated paths only.
- Single running example unifying all three lessons. Each lesson gets its own example;
  this was Direction B and was rejected.

## Tech Stack

Inherits the existing stack — **no new top-level dependencies**. The relevant parts:

| Layer             | Choice                                             | Why                                                                                   |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Framework         | Next.js 16 (App Router, Turbopack)                 | Already in use; see `AGENTS.md` re: breaking changes from training data.              |
| Language          | TypeScript (strict)                                | Existing convention. No `any`.                                                        |
| Runtime           | React 19.2                                         | Already in use.                                                                       |
| Styling           | Tailwind v4 + `@variant dark`                      | Already in use; class-based dark mode via `next-themes`.                              |
| Visualization     | Hand-rolled SVG                                    | No D3. Existing primitives (`TreeView`, `ArrayBars`, `LinearProbeView`) are pure SVG. |
| Content           | MDX (`@next/mdx`) + KaTeX (`rehype-katex`) + Shiki | Already in use.                                                                       |
| Math toggle state | React context + `localStorage` (client only)       | No new dep; persists per user across the pillar.                                      |
| Testing (unit)    | Vitest + `@testing-library/react`                  | Already in use.                                                                       |
| Testing (E2E)     | Playwright + `@axe-core/playwright`                | Already in use.                                                                       |
| Coverage gate     | Vitest istanbul provider, 100% on `src/lib/ml/**`  | New addition to the existing gate (extends `algorithms/` + `dataStructures/`).        |

## Commands

```
Install:    npm install
Dev:        npm run dev               # http://localhost:3000
Build:      npm run build             # next build (Turbopack)
Preview:    npm run start             # serves the production build
Lint:       npm run lint
Format:     npm run format            # prettier --write .
Typecheck:  npm run typecheck         # tsc --noEmit
Test:       npm test                  # vitest run
Coverage:   npm run test:coverage     # vitest run --coverage
E2E:        npm run e2e               # playwright test
```

## Project Structure

New + changed paths only (everything else inherits from the existing layout):

```
src/
  app/lessons/
    page.tsx                        → register three ML lessons (status: "live")
    ml/
      gradient-descent/page.mdx     → NEW
      backprop/page.mdx             → NEW
      attention/page.mdx            → NEW
  components/
    visualizations/
      ContourView.tsx               → NEW · 2D contour + trajectory polyline
      NetworkView.tsx               → NEW · small MLP diagram (nodes + weighted edges)
      AttentionView.tsx             → NEW · token row + Q/K/V matrices + attention heatmap
      GradientDescentViz.tsx        → NEW · ContourView + CodePanel + Controls
      BackpropViz.tsx               → NEW · NetworkView + CodePanel + Controls
      AttentionViz.tsx              → NEW · AttentionView + CodePanel + Controls
      Controls.tsx                  → EXTEND · add optional `onRunToCompletion` button
    mdx/
      MathLevel.tsx                 → NEW · context provider + top-of-page toggle + per-block gates
  lib/
    ml/                             → NEW directory · 100% coverage gate
      types.ts                      → MLStep unions per lesson + shared StepBase + snapshot types
      gradientDescent.ts            → pure generator: vanilla GD on a 2-param scalar loss
      gradientDescent.snippet.ts    → Python source + line constants
      backprop.ts                   → pure generator: forward + backward + update over one example
      backprop.snippet.ts           → Python source + line constants
      attention.ts                  → pure generator: per-query softmax(Q·K^T/√d_k)·V
      attention.snippet.ts          → Python source + line constants
      index.ts                      → re-exports
    hooks/
      useMathLevel.ts               → NEW · context hook + localStorage persistence
tests/                              → mirror src/lib/ml/ — one test file per generator
e2e/
  a11y.spec.ts                      → EXTEND · 17 → 20 routes
  gradient-descent.spec.ts          → NEW · step / run-to-completion / math-toggle smoke
  backprop.spec.ts                  → NEW
  attention.spec.ts                 → NEW
vitest.config.ts                    → EXTEND · add src/lib/ml/** to the 100% include list
docs/
  SPEC-ML.md                        → this file
```

### Conventions (load-bearing — preserve them)

These are inherited from the existing pillars. Calling them out so we don't accidentally
violate one when adding ML.

1. **Pure generators, additive discriminated unions.** Every algorithm in `src/lib/ml/`
   is `function* foo(input): Generator<MLStep>`. Views replay steps; algorithms never
   touch React. Each step variant wraps `StepBase = { codeLines?: readonly number[] }`.
2. **Snippets co-locate.** `gradientDescent.snippet.ts` exports the displayed Python
   source plus named line constants (`gradientDescentLines.gradStep = 5` etc.). The
   generator references constants by name so editing displayed Python only touches one
   file. Tests assert every step's `codeLines` falls within `source.split("\n").length`.
3. **String-keyed registries cross RSC.** If a registry-like mapping is needed at any
   point (probably not for v1 — each viz wraps its own generator), pass strings not
   functions across the server→client boundary. See `sortAlgorithms` in
   `src/lib/algorithms/index.ts`.
4. **MDX plugins by string name.** `next.config.ts` continues to use string names
   (e.g. `"remark-math"`) under Turbopack. New plugins → string names.
5. **Per-step Python line highlighting.** Highlight branches, not just step kinds.
   `mergeSort` distinguishes `writeI` vs `writeJ`; `bstInsert` distinguishes `compareLeft`
   vs `compareRight`. Apply the same discipline to ML: GD's `compute-gradient` step has
   different lines than `apply-update`; backprop's `forward-node` is a different line
   than `backward-node`; attention's `compute-scores` is different from `softmax` and
   `weighted-sum`.
6. **`CodePanel`'s constraints.** Keep `not-prose` on the wrapper; keep `tabIndex={0}` on
   the inner scroll region; keep line-number contrast ≥ 4.5 (don't downgrade
   `text-zinc-500` light / `text-zinc-400` dark). Don't switch from `root.scrollTo()` to
   `Element.scrollIntoView()` — the latter yanks the page.
7. **`useStepThrough` reduced-motion contract.** Auto-advance no-ops under reduced
   motion. `play()` becomes a no-op. The trajectory button must respect this too — under
   reduced motion, "run to completion" snaps to the end state without an animation.
8. **`Controls` keeps array-size slider optional.** It renders only when `arraySize` and
   `onArraySizeChange` are both passed. ML vizes likely won't pass them.
9. **e2e selector scoping.** Lesson pages with multiple vizes need each viz wrapped in a
   `<section aria-label>` and tests use `page.getByRole("region", { name: ... })` as a
   parent. v1 ML lessons have one viz each, but the GD lesson might gain a "different
   starting points" subsection in v2 — design the wrapper so it survives that.
10. **`pathPrefix` per topic in `/lessons/page.tsx`.** ML lessons live under
    `/lessons/ml`; the existing topic entry already has `pathPrefix: "/lessons/ml"`. To
    promote them from `coming-soon` to `live`, add `status: "live"` + `slug` fields to
    the existing entries.

## Code Style

Real example — what the gradient-descent generator and viz will look like.

```ts
// src/lib/ml/gradientDescent.ts
import { gradientDescentLines } from "./gradientDescent.snippet";
import type { GradientDescentSnapshot, GradientDescentStep } from "./types";

export type GradientDescentParams = {
  readonly start: readonly [number, number];
  readonly learningRate: number;
  readonly maxSteps: number;
  readonly tolerance: number;
};

/** Vanilla GD on f(w₁, w₂) = w₁² + 3·w₂² (a quadratic bowl). */
export function* gradientDescentSequence(
  p: GradientDescentParams,
): Generator<GradientDescentStep, void, void> {
  let [w1, w2] = p.start;
  const trajectory: Array<readonly [number, number]> = [[w1, w2]];

  yield {
    kind: "begin",
    snapshot: snapshotOf(w1, w2, trajectory),
    codeLines: [gradientDescentLines.start],
  };

  for (let i = 0; i < p.maxSteps; i++) {
    const gw1 = 2 * w1;
    const gw2 = 6 * w2;
    const gradNorm = Math.hypot(gw1, gw2);

    yield {
      kind: "compute-gradient",
      gradient: [gw1, gw2],
      snapshot: snapshotOf(w1, w2, trajectory),
      codeLines: [gradientDescentLines.gradient],
    };

    if (gradNorm < p.tolerance) {
      yield {
        kind: "converged",
        snapshot: snapshotOf(w1, w2, trajectory),
        codeLines: [gradientDescentLines.check],
      };
      return;
    }

    w1 -= p.learningRate * gw1;
    w2 -= p.learningRate * gw2;
    trajectory.push([w1, w2]);

    yield {
      kind: "apply-update",
      snapshot: snapshotOf(w1, w2, trajectory),
      codeLines: [gradientDescentLines.update],
    };
  }
  yield { kind: "done", snapshot: snapshotOf(w1, w2, trajectory) };
}

function snapshotOf(
  w1: number,
  w2: number,
  trajectory: ReadonlyArray<readonly [number, number]>,
): GradientDescentSnapshot {
  return { params: [w1, w2], trajectory: trajectory.slice() };
}
```

```mdx
{/* src/app/lessons/ml/gradient-descent/page.mdx */}
import { MathLevel, IntuitionOnly, MathOnly } from "@/components/mdx/MathLevel";
import { GradientDescentViz } from "@/components/visualizations/GradientDescentViz";

# Gradient Descent

<MathLevel />

<IntuitionOnly>
  Imagine standing on a hillside in fog. You can feel which way is downhill under your feet, even if
  you can't see the bottom. Take one small step in the steepest downhill direction. Then do it
  again. That's gradient descent.
</IntuitionOnly>

<MathOnly>
  Given a differentiable loss $L: \mathbb{R}^n \to \mathbb{R}$, gradient descent iterates $\mathbf
  {w} \leftarrow \mathbf{w} - \alpha \nabla L(\mathbf{w})$ where $\alpha$ is the learning rate. Each
  step moves the parameter vector in the direction of steepest descent.
</MathOnly>

<GradientDescentViz />
```

**Key conventions specific to ML:**

- Generators take a small `Params` object, not positional args — these will grow.
- `Snapshot` shapes are flat: no nested mutable references. Always emit immutable copies
  (`.slice()`, `[...]`, or a fresh object literal) so step-back doesn't mutate history.
- Viz primitives (`ContourView`, `NetworkView`, `AttentionView`) accept a `snapshot` and
  optional `highlights` (mirroring `PairingHeapView`'s `highlights` array). No `useState`
  inside primitives — they're pure renderers.
- `MathLevel` exports three things: `<MathLevel />` (the toggle), `<IntuitionOnly>`, and
  `<MathOnly>` (gating wrappers). The toggle is server-renderable as a placeholder; the
  context provider hydrates client-side and persists choice in `localStorage`.

## Testing Strategy

**Layer 1 — algorithm correctness (Vitest, 100% coverage gate on `src/lib/ml/`):**

- Every generator has a test that exhausts it and asserts the final snapshot meets a
  written invariant:
  - **GD:** trajectory monotonically decreases on the quadratic bowl loss
    ($f(w_1, w_2) = w_1^2 + 3w_2^2$) within tolerance; converges from at least three
    starting points; reduces to a single step when started at the minimum.
  - **Backprop:** forward pass on a hand-computed example matches expected output to 1e-9;
    backward pass gradients match numerical-gradient check (5-decimal precision); after
    one update, loss strictly decreases.
  - **Attention:** softmax rows sum to 1; output for token i is a convex combination of
    value rows; deterministic given fixed Q/K/V.
- Property-based tests where it pays:
  - **GD** with random start in $[-5, 5]^2$ and learning rate in $(0, 0.5]$: always
    converges or terminates at max-steps; trajectory length matches step count.
  - **Backprop** with random weights: gradient check passes within tolerance.
  - **Attention** with random Q/K/V (small dim): attention rows always sum to 1.
- Edge cases explicit per lesson:
  - **GD:** lr = 0 (no movement), lr too large (oscillation but no NaN), gradient = 0
    at start (immediate convergence).
  - **Backprop:** zero input (only bias matters), gradient at activation kinks (ReLU)
    handled deterministically.
  - **Attention:** identical Q rows produce identical attention weights; one-hot key
    vector concentrates all weight on its match.

**Layer 2 — component rendering (Vitest + Testing Library):**

- `ContourView`, `NetworkView`, `AttentionView` render without crashing across the full
  step sequence of their respective lessons.
- `MathLevel`:
  - Defaults to "intuition" on first render.
  - Toggling rerenders gated children correctly.
  - Persisted choice survives unmount/remount within the same `localStorage` scope.
  - SSR renders without crashing (default value used; no `localStorage` access on server).
- `Controls`:
  - `onRunToCompletion` button renders only when provided.
  - Under reduced motion, clicking "run to completion" snaps to the end state without
    triggering the playback timer.

**Layer 3 — E2E smoke (Playwright):**

- Each of the three ML lesson routes loads, viz mounts, step button advances, run-to-
  completion completes without errors, math toggle swaps prose, no console errors.
- `e2e/a11y.spec.ts` extends from 17 to 20 routes covering the three new lessons.
- Each viz section is wrapped in `<section aria-label>` so multi-section future lessons
  don't need test rewrites.

**Coverage targets:** `src/lib/ml/**/*.ts` at 100% line + branch + function. Everywhere
else: no fixed target — write tests where bugs would actually hurt.

## Boundaries

**Always:**

- Run `npm run typecheck && npm run lint && npm test` before commits (lint-staged +
  simple-git-hooks). Same gate as the rest of the repo.
- Each ML generator has a test reaching 100% coverage **in the same commit** as the
  generator. No "we'll add tests later."
- Respect `prefers-reduced-motion` throughout. Auto-play and trajectory animation both
  no-op under reduced motion; users always have a step-through path.
- Color-blind-safe palette (Wong 2011) + shape/position redundancy. Don't encode meaning
  in color alone — applies to contour fills, attention heatmaps, gradient arrows.
- Stay within performance budgets per lesson route: **LCP < 2.5s, CLS < 0.1, INP <
  200ms** on a 4G connection. JS bundle per ML lesson route < 175 KB gzipped (slightly
  higher than sorting's 150 KB to absorb the math toggle + new viz primitive).
- Math content uses KaTeX via the existing `remark-math` + `rehype-katex` pipeline. No
  inline `<MathJax>` or other engines.
- `<MathLevel>` toggle is keyboard-reachable and announces state to screen readers
  (`aria-pressed` or `role="radiogroup"`).
- New lessons annotate `codeLines` per step at the **branch** level, not just the kind
  level — same discipline as `bstInsert` / `bstDelete`.

**Ask first:**

- Adding any new top-level dependency. v1 should be doable with what's already installed.
- Adding a backend / API route / database. The site stays fully static for v1.
- Changing CI configuration or deployment settings.
- Adding a new top-level route group beyond `/lessons/ml/`.
- Introducing a new content format (e.g., embedded Jupyter, Pyodide) — those are v2.
- Refactors that touch more than ~5 files unless trivially mechanical.

**Never:**

- Commit secrets, `.env*` files, or any API keys.
- Ship a regression on Core Web Vitals without a documented reason.
- Override `prefers-reduced-motion` ("but the trajectory animation looks cooler" is not a
  reason).
- Use `dangerouslySetInnerHTML` outside of trusted, build-time-rendered content (MDX /
  Shiki / KaTeX output).
- Disable accessibility lints to make warnings go away — fix the root cause.
- Remove or skip a failing test without human approval.
- Add Pyodide, WebAssembly runtimes, or any compute-heavy in-browser library in v1.
- Encode mathematical correctness in floating-point assertions without a tolerance
  (`toBeCloseTo` with a documented epsilon, never raw `===` on a computed gradient).
- Render math content that doesn't have an intuition counterpart — every with-math block
  must have a matching intuition block, or the toggle is a lie.

## Success Criteria

Concrete, testable conditions for "v1 of the ML pillar is done":

- [ ] **Three lesson routes live and registered.**
  - [ ] `/lessons/ml/gradient-descent` renders, viz mounts, step/play/run-to-completion
        all work, math toggle swaps prose.
  - [ ] `/lessons/ml/backprop` same.
  - [ ] `/lessons/ml/attention` same.
  - [ ] `/lessons/page.tsx` shows all three as `status: "live"` (no "Coming soon").
- [ ] **`<MathLevel>` toggle implemented.**
  - [ ] Defaults to "intuition" on first visit.
  - [ ] Choice persists via `localStorage` across the three lessons.
  - [ ] Keyboard-reachable, `aria-pressed` reflects state.
  - [ ] SSR renders without errors (no `localStorage` access on server).
- [ ] **Trajectory button in `Controls`.**
  - [ ] Renders only when the calling viz passes `onRunToCompletion`.
  - [ ] Animates the full sequence at the current speed for non-reduced-motion users.
  - [ ] Snaps to end state for reduced-motion users without spinning the timer.
- [ ] **100% coverage on `src/lib/ml/**`** — extends the existing `algorithms/`+
   `dataStructures/` gate. CI fails without it.
- [ ] **Property tests pass** — fast-check on GD convergence, backprop gradient check,
      attention softmax invariants. 1000 runs each in CI.
- [ ] **e2e + axe sweep extended** from 17 routes to 20 (all three ML lessons), zero
      axe-core violations on `serious` or higher.
- [ ] **Python snippets synced** — every step kind has `codeLines` annotated, branches
      get distinct highlights, line numbers are within `source.split("\n").length`.
- [ ] **Bundle budget honored.** Each ML lesson route < 175 KB gzipped per the Next
      build report.
- [ ] **`next_session.md` updated** post-ship with new test counts + ML pillar in
      "What ships today."

## Open Questions

These need a human answer before or during implementation. None of them block Phase 2
(Plan); they're better resolved during the relevant phase.

1. **Where exactly does `<MathLevel />` sit on the page?** Lesson-header (matches
   `TraversalViz`'s mode toggle, more discoverable) or inline with the first prose block
   (keeps the toggle visually close to the content it gates)? **Default proposal:**
   lesson-header, right under the H1.
2. **One toggle for the pillar, or per-lesson?** `localStorage` persistence implies one
   choice across all three lessons. Reset behavior on the Reset button — probably
   no, the user's math comfort doesn't change between lessons. **Default proposal:**
   persistent across the pillar, Reset does NOT clear math level.
3. **Default math level — "intuition" or detect?** Probably "intuition" as the broader
   entry point. Could attempt to detect via referrer / user-agent hints but that's over-
   engineering. **Default proposal:** "intuition" with a visible "switch to with-math"
   affordance.
4. **Lesson ordering on the index.** GD → backprop → attention is the conceptual order
   but a freshman might want attention first (most visually striking). **Default
   proposal:** conceptual order; the index page is exploratory anyway.
5. **GD example — quadratic bowl or least-squares?** The bowl is cleaner pedagogically;
   least-squares is more honest about what GD is _for_. **Default proposal:** quadratic
   bowl $f(w_1, w_2) = w_1^2 + 3w_2^2$ (asymmetric so the trajectory bends, easier to
   see than a symmetric bowl). Defer least-squares to a v2 follow-up.
6. **Backprop activation — sigmoid or ReLU?** Sigmoid is smoother for visualization but
   ReLU is what modern networks use. **Default proposal:** ReLU. Acknowledge the kink in
   the with-math prose; pick fixed inputs that don't sit exactly at zero so gradients
   are deterministic.
7. **Attention input sequence — toy phrase or pure numbers?** "the cat sat" is more
   memorable but adds a tokenizer concept the lesson doesn't otherwise need. **Default
   proposal:** label tokens `t1, t2, t3` and stop. The mechanism is the lesson, not
   tokenization.
8. **Backprop chain-rule view — one viz or auxiliary math view?** Possibly the with-math
   prose is enough and the viz stays constant across modes. **Default proposal:** one
   viz, math mode adds an inline derivation block under the network diagram. Validate
   during build — if the math block feels disconnected from the viz, add a math overlay
   pass.

---

**Next step:** Phase 2 (Plan) — turn this spec into a phased technical plan
(`docs/PLAN-ML.md`) identifying components, dependencies, build order, risks, and
verification checkpoints.
