# Plan: ML Intuitions Pillar (v1)

> **Status:** Drafted from `docs/SPEC-ML.md`. Awaiting human review before Phase 3 (Tasks).
> **Author:** Tzun · **Date:** 2026-05-12

## Overview

Five phases, gated by verification checkpoints. **Phase A is foundational** (the math
toggle, the trajectory button, the type spine) — everything else assumes it. **Phases
B/C/D are per-lesson** and could in principle run in parallel; we'll do them
sequentially to honor the "commit after every finished task" discipline and to let each
lesson teach us something before the next one starts. **Phase E is the rollout**
(lessons-index promotion, e2e sweep, `next_session.md` refresh).

```
A. Foundations ──→ B. Gradient Descent ──→ C. Backprop ──→ D. Attention ──→ E. Rollout
        │                  │                    │              │               │
        ▼                  ▼                    ▼              ▼               ▼
  type spine +       first lesson         second lesson    third lesson    index promo,
  MathLevel +        validates the        validates the    validates the   e2e/a11y at
  Controls ext       pattern              network viz      heatmap viz     20 routes
```

## Phase A — Foundations

**Goal:** Land the type spine, the math-level toggle, and the trajectory extension to
`Controls` before any lesson code exists. After Phase A, every subsequent phase is a
straightforward per-lesson implementation against settled foundations.

### A1. `src/lib/ml/types.ts` + coverage-gate wiring

- Define shared `StepBase = { codeLines?: readonly number[] }`.
- Define per-lesson discriminated unions as **empty unions for now** with placeholder
  comments — `export type GradientDescentStep = never;` — so the file compiles even
  before generators exist. They'll be replaced incrementally as each lesson lands.
  - Alternative: define them in each lesson's commit (no `never`). Pick this one — it's
    cleaner and means PR diffs per lesson include their types.
- Extend `vitest.config.ts`:
  - Add `src/lib/ml/**/*.ts` to the coverage `include` array (alongside `algorithms/`
    and `dataStructures/`).
  - Same 100% threshold (lines/branches/functions/statements).
- Add `src/lib/ml/index.ts` as a placeholder re-export hub.

**Risk:** Enabling the 100% threshold against an empty directory will fail CI. **Mitigation:**
the include glob only applies to files that exist; an empty dir produces no coverage
input. Verify locally before pushing — run `npm run test:coverage` and assert the
threshold check passes. If it doesn't, gate the include behind a sentinel `placeholder.ts`
that's covered by a no-op test, then delete both once the first real generator lands.

### A2. `<MathLevel>` context + components

- `src/lib/hooks/useMathLevel.ts` — context hook + provider. Default = `"intuition"`.
  Reads from `localStorage` only on mount (in a `useEffect`); SSR + first render are
  deterministic.
- `src/components/mdx/MathLevel.tsx` — exports three things:
  - `<MathLevel />` — the radio-style toggle (two pills: "Intuition" / "With math").
    Uses `role="radiogroup"` + `aria-checked` per pill so the state is announced. Renders
    inline at the top of MDX pages.
  - `<IntuitionOnly>` and `<MathOnly>` — wrapping components that read the context and
    render their children or null.
  - `<MathLevelProvider>` — top-level provider. Mount it inside the MDX layout for `/lessons/ml/`
    so all three lessons share one provider instance.
- Add a thin `app/lessons/ml/layout.tsx` that wraps children in `<MathLevelProvider>`.

**Risk 1 — Hydration mismatch.** If the toggle renders the persisted choice before
hydration, SSR HTML won't match. **Mitigation:** render the default ("intuition") on
SSR and during the first client render; swap to the persisted value in a `useEffect`
post-mount. Same trick as `useReducedMotion` in this codebase.

**Risk 2 — Prose blocks render twice during the hydration swap, causing a visible flash.**
**Mitigation:** during the brief first-render window, render the intuition block. After
the post-mount swap, if the persisted value is "math", swap. Test that the swap is
non-jarring with reduced motion enabled (no animation expected anyway).

**Risk 3 — `aria-pressed` vs. `aria-checked`.** `aria-pressed` is for toggle buttons;
the radio-group pattern uses `aria-checked` on each radio. **Decision:** use
`role="radiogroup"` + `aria-checked` per pill — this is two mutually-exclusive choices,
which is exactly what radios are for. Matches `TraversalViz`'s existing pattern.

### A3. `Controls.tsx` — trajectory button extension

- Add optional `onRunToCompletion?: () => void` prop.
- When passed, render a new button labeled "Run" (or "Run to end") between Step-forward
  and Reset. Disabled when `status === "playing"` or when there's nothing to play.
- The trajectory animation logic itself lives in `useStepThrough` (call it
  `runToCompletion()`), not in `Controls`. `Controls` only emits the click; the hook
  decides what to do.
- Extend `useStepThrough` with a `runToCompletion()` method:
  - Under reduced motion: snap to last step (sets `stepIndex` to `steps.length - 1`).
  - Otherwise: advance one step per frame (or one per `speed` ms — match existing
    auto-advance cadence), settable behavior. Use the existing timer machinery; don't
    introduce a second timer.

**Risk:** The trajectory animation runs faster than the user can scrub, so they can't
stop and look at intermediate states. **Mitigation:** the existing playback controls
already solve this — pause, then step-forward/back. The trajectory button is for
"watch the whole thing happen"; the existing controls cover "let me inspect step 7."

**Verification checkpoint (end of Phase A):**

- [ ] `npm run test` green; `npm run typecheck` green; `npm run lint` green.
- [ ] Unit test for `useMathLevel`: default = "intuition", set persists via localStorage,
      SSR-safe (no `localStorage` access on server).
- [ ] Unit test for `<MathLevel />`: toggle changes context value; `<IntuitionOnly>` /
      `<MathOnly>` render conditionally.
- [ ] Unit test for `Controls`: `onRunToCompletion` renders only when prop is provided;
      click emits the callback.
- [ ] Unit test for `useStepThrough.runToCompletion()`: under reduced motion, snaps to
      end; otherwise advances frame-by-frame.
- [ ] No `<MathLevel />` rendered in a real route yet (no GD lesson exists). Foundation
      is reusable but not yet wired.

**Estimated effort:** 1 session (~3 hours of focused work + tests).

## Phase B — Gradient Descent

**Goal:** Ship `/lessons/ml/gradient-descent` end-to-end. This validates the entire ML
pillar pattern in the simplest possible case. Don't move to Phase C until this is
deployed-equivalent (e2e green, math toggle works in a real page, bundle within budget).

### B1. Generator + snippet (`gradientDescent.ts` + `gradientDescent.snippet.ts`)

- `gradientDescent.snippet.ts` first (pseudocode is the source of truth):
  ```python
  def gradient_descent(w, lr, max_steps, tol):
      for step in range(max_steps):
          grad = compute_gradient(w)
          if norm(grad) < tol:
              return w
          w = w - lr * grad
      return w
  ```
  Export `gradientDescentLines = { start: 1, gradient: 3, check: 4, return_conv: 5, update: 6, return_max: 7 }`.
- `gradientDescent.ts` exports `gradientDescentSequence(params)` yielding
  `{ kind, snapshot, codeLines }` per step. Loss = $w_1^2 + 3 w_2^2$ (asymmetric bowl
  per spec default). Each step type maps to one `gradientDescentLines.*` constant.
- `GradientDescentSnapshot = { params: readonly [number, number]; trajectory: readonly (readonly [number, number])[] }`.
  Immutable — fresh array per snapshot.

### B2. `ContourView.tsx`

- Input: `snapshot`, `bounds` (xy range), `levels` (contour values), optional
  `highlights` (e.g., current point, gradient arrow).
- Renders:
  - Background contour rings (a pre-computed mesh of polylines — at build time, not
    per render; either ship a static `bowlContours.ts` constant or compute once in a
    `useMemo`).
  - Trajectory polyline through `snapshot.trajectory`.
  - Current point marker (circle at last trajectory entry).
  - Optional gradient arrow at the current point.
  - Axis labels.
- Reduced-motion compliant: the polyline doesn't animate; new points pop in
  step-by-step.

**Risk:** Generating contours of $w_1^2 + 3 w_2^2$ at runtime is fine (it's algebra), but
shipping a general-purpose contour generator is scope creep. **Mitigation:** hard-code
the bowl's contour level set for v1. The component takes `levels: readonly Polyline[]`
as a prop; the GD viz passes pre-computed bowl contours. Future losses (least-squares
etc.) ship their own pre-computed sets.

**Risk 2:** A 2D contour rendered as a polyline mesh can be visually noisy. **Mitigation:**
pick 6–8 levels, label each, and use the Wong-2011 muted palette (don't compete with
the trajectory color).

### B3. `GradientDescentViz.tsx`

- Wires `gradientDescentSequence` into `useStepThrough` (with `runToCompletion`).
- Renders `<ContourView>` on the left, `<CodePanel>` on the right (md+ side-by-side,
  stacked on small).
- Annotation strip below: "Step 5: grad = (1.2, -3.6)" etc., per-step.
- Counters: Steps / Current loss / Gradient norm.
- A small `<select>` for learning rate (e.g., 0.05 / 0.1 / 0.3 / 0.6 → last one
  oscillates pedagogically). Changing it resets `useStepThrough`.

### B4. Tests (Vitest)

- Generator unit tests in `src/lib/ml/gradientDescent.test.ts`:
  - Convergence from 3 fixed starts to within `tol` in finite steps.
  - lr = 0 yields zero movement.
  - Start = (0, 0) terminates immediately (gradient norm < tol on step 1).
  - Every yielded step carries `codeLines` within source bounds.
  - Snapshot immutability: mutating a yielded snapshot doesn't affect next step.
- Property test (fast-check, 200 runs):
  - For random start in $[-5, 5]^2$ and lr in $(0, 0.3]$: either converges or yields
    exactly `maxSteps` `apply-update` events; trajectory length = update count + 1.
- `ContourView` rendering smoke: renders without crashing for empty trajectory, single-
  point trajectory, multi-step trajectory.
- `GradientDescentViz`:
  - Renders, step button advances annotation text, lr `<select>` resets state.
  - `runToCompletion` click reaches the converged state.

### B5. MDX page (`/lessons/ml/gradient-descent/page.mdx`)

- Header: H1 + `<MathLevel />`.
- Intuition block (~150 words): "downhill in fog" metaphor, why the algorithm makes
  many small steps instead of one big jump, what learning rate means.
- Math block (~200 words): $\nabla L$ definition for the bowl, $w \leftarrow w - \alpha
  \nabla L$, convergence criterion via norm threshold.
- `<GradientDescentViz />` embedded.
- "What if the learning rate is too big?" callout block referencing the 0.6 option.
- "Why a quadratic bowl?" callout block explaining that real losses aren't this simple
  but the geometry generalizes.

### B6. e2e (`e2e/gradient-descent.spec.ts`)

- Page loads, viz mounts, step button advances annotation.
- "Run" button completes; counter shows convergence.
- Math toggle: clicking "With math" reveals the math block, hides intuition block.
- Lighthouse-ish smoke: no console errors. (Real Lighthouse runs against deployed URLs;
  the spec acknowledges this gap.)

**Verification checkpoint (end of Phase B):**

- [ ] `/lessons/ml/gradient-descent` route lives and reachable from `/lessons` (still
      labeled "Coming soon" on the index — Phase E promotes it).
- [ ] Bundle for this route under 175 KB gzipped (run `npm run build` and inspect
      output).
- [ ] 100% coverage on `src/lib/ml/gradientDescent.ts` + `.snippet.ts`.
- [ ] e2e + axe smoke green on this single route.
- [ ] Manual: math toggle persists across hard refresh; reduced-motion + run-to-completion
      snaps to end without animation.

**Estimated effort:** 1–2 sessions.

## Phase C — Backprop

**Goal:** Ship `/lessons/ml/backprop`. Validates the network-diagram viz primitive.

### C1. Generator + snippet (`backprop.ts` + `backprop.snippet.ts`)

- Fixed 2 → 2 → 1 MLP with ReLU activations (spec default).
- One curated training example. Initial weights chosen so:
  - Forward pass produces a clearly-wrong output (loss > 0).
  - Backward pass produces non-zero gradients on every weight.
  - After one update with reasonable lr, loss strictly decreases.
- Step kinds (rough draft):
  - `forward-input` (mark inputs)
  - `forward-hidden-pre` (pre-activation) / `forward-hidden-post` (post-ReLU) — per node
  - `forward-output`
  - `compute-loss`
  - `backward-output-grad`
  - `backward-hidden-grad` — per node, two highlight rows (activation derivative + chain
    multiplication)
  - `backward-weight-grad` — per weight (this is the hero step for chain-rule intuition)
  - `apply-update`
  - `done`
- Each step's `codeLines` targets the relevant Python line; the chain rule applications
  get distinct highlights per branch.
- `BackpropSnapshot` carries activation values + gradient values for every node and
  weight, plus a `phase: "forward" | "backward" | "update" | "done"`.

### C2. `NetworkView.tsx`

- Renders three columns of nodes (2 inputs, 2 hidden, 1 output), edges weighted between
  them.
- Each node shows its current activation value (and gradient, in backward phase).
- Each edge shows weight (and gradient, in backward phase).
- Forward phase: forward arrows highlighted; node activations populate left-to-right.
- Backward phase: backward arrows highlighted (different color); gradients populate
  right-to-left.
- Update phase: weights flash with the delta applied.
- Color coding: forward = blue (Wong "sky blue"); backward = orange (Wong "vermillion");
  zero-gradient = neutral. Shape redundancy: arrows themselves point forward/backward.

**Risk:** A network diagram with both activations and gradients on every node + edge
gets visually crowded. **Mitigation:**

- Two-layer info: primary label always shows the relevant value for the current phase
  (activation in forward, gradient in backward).
- Secondary info revealed only on the highlighted node/edge (via a small `<title>` /
  callout).
- Test that the diagram is readable at the default lesson width (~720px viewBox).

### C3. `BackpropViz.tsx`

- Wires `backpropSequence` to `useStepThrough` (+ run-to-completion).
- `<NetworkView>` on the left, `<CodePanel>` right.
- Annotation strip: per-step explainer ("Computing ∂L/∂w₁₁ via chain rule").
- Counters: Phase / Step / Loss (current).

### C4. Tests

- Generator unit tests:
  - Forward pass output matches a hand-computed value to 1e-9.
  - Backward gradients match numerical-gradient check (5-decimal precision) — write the
    numerical helper in the test file, not in `src/lib/ml/`.
  - After one update, loss is strictly lower than before.
  - Every step carries `codeLines` within source bounds.
- Property test (fast-check, 100 runs):
  - For random weights, numerical-gradient check passes within tolerance.
- `NetworkView` smoke: renders all phases without crashing.
- `BackpropViz` smoke: step button cycles through forward + backward + update.

**Risk — coverage on a fixed example.** If `backpropSequence` ships with only one
curated example, every branch should still be exercised. **Mitigation:** if any branch
isn't reachable through the one example, _change the example_, not the code. Don't add
defensive branches that "could happen with different inputs" — those bloat coverage and
hide intent.

### C5. MDX page

- Same structure as GD: H1 + toggle + intuition prose + math prose + viz + callouts.
- Intuition block: "blame assignment" framing — how much did each weight contribute to
  the wrong answer.
- Math block: chain rule formally, partial derivative notation, the recursive structure.
- Callout: "Why ReLU and not sigmoid?" pointing at the activation choice.
- Callout: "What about the kink at 0?" addressing the ReLU non-differentiability.

### C6. e2e (`e2e/backprop.spec.ts`)

- Same shape as B6: load, step, run, math toggle, no console errors.

**Verification checkpoint (end of Phase C):**

- [ ] `/lessons/ml/backprop` lives, viz works, e2e + axe green.
- [ ] Bundle within budget.
- [ ] 100% coverage on `src/lib/ml/backprop.ts` + `.snippet.ts`.

**Estimated effort:** 2 sessions (the network viz is more involved than the contour).

## Phase D — Attention

**Goal:** Ship `/lessons/ml/attention`. Validates the heatmap viz and is the most
visually striking of the three.

### D1. Generator + snippet (`attention.ts` + `attention.snippet.ts`)

- 3-token input (per spec default — labels `t1, t2, t3`, not a phrase).
- Q/K/V dim = 2.
- Fixed Q/K/V weight matrices and fixed token embeddings — deterministic demo. Picked so:
  - Each query attends meaningfully to multiple keys (no degenerate one-hot).
  - The output vector for each token is visibly a blend.
- Step kinds:
  - `embed-tokens` (initial embedding matrix shown)
  - `project-query` / `project-key` / `project-value` — per token (so the lesson can
    walk through one Q, K, V at a time)
  - `compute-scores` — for each query row, $Q_i \cdot K_j$ all keys
  - `scale-and-softmax` — softmax of the score row
  - `weighted-sum` — $\sum_j \alpha_{ij} V_j$ producing the output vector for token $i$
  - `done`
- `AttentionSnapshot` carries: token embeddings, Q/K/V matrices, scores matrix (NaN
  where not yet computed), attention weights matrix (same), output vectors.

### D2. `AttentionView.tsx`

- Top row: token labels.
- Left side: Q/K/V matrices (3×2 each, small).
- Center: attention matrix (3×3 heatmap, color intensity = weight value).
- Right side: output vectors per token.
- Highlights: current query row glows; current key column glows; the corresponding
  attention cell pulses (one tick, no animation under reduced motion).

**Risk — heatmap color scale across steps.** As scores get computed and softmaxed, the
visible range changes. **Mitigation:** softmax outputs are always in [0, 1], so the
attention matrix uses a fixed [0, 1] color scale. The pre-softmax scores get a
different (diverging) palette and are clearly labeled "scores (pre-softmax)" — they
don't share the same color treatment.

**Risk — 3×3 attention matrix is small.** **Mitigation:** the lesson is about
mechanism, not scale. The matrix is exactly the right size for showing every cell with
its numerical value plus color. Don't try to look like a real-world attention map.

### D3. `AttentionViz.tsx`

- Wires `attentionSequence` to `useStepThrough` (+ run-to-completion).
- `<AttentionView>` + `<CodePanel>`.
- Annotation strip: "Computing attention scores for token t₂" etc.
- Counters: Step / Phase.

### D4. Tests

- Generator unit tests:
  - Attention rows sum to 1.0 ± 1e-10 after softmax.
  - Output for each token is a convex combination of value rows.
  - Deterministic given fixed Q/K/V.
  - Every step carries `codeLines` within source bounds.
- Property test (fast-check, 100 runs):
  - For random Q/K/V of dim 2: attention rows sum to 1; outputs lie in the convex hull
    of value rows.
- `AttentionView` smoke.
- `AttentionViz` smoke.

### D5. MDX page

- Header + toggle.
- Intuition block: "each token decides who to pay attention to" framing. The Q/K/V
  metaphor as "what am I looking for" / "what do I represent" / "what do I contribute."
- Math block: $\text{softmax}(QK^T / \sqrt{d_k}) V$, the $\sqrt{d_k}$ scaling.
- Callout: "Why $\sqrt{d_k}$?" addressing variance under random init.
- Callout: "What does multi-head buy you?" pointing forward to v2 work.

### D6. e2e (`e2e/attention.spec.ts`)

- Same shape as B6/C6.

**Verification checkpoint (end of Phase D):**

- [ ] `/lessons/ml/attention` lives, viz works, e2e + axe green.
- [ ] Bundle within budget.
- [ ] 100% coverage on `src/lib/ml/attention.ts` + `.snippet.ts`.

**Estimated effort:** 2 sessions.

## Phase E — Rollout

**Goal:** Promote the three lessons on the index, sweep e2e + a11y, update docs.

### E1. Lessons index

- `src/app/lessons/page.tsx`: update the three ML entries from `coming-soon` to `live`
  with their slugs.
- Update the ML topic blurb if needed (currently "Coming soon. Visualizations that
  build intuition for ML internals." — make it match the now-shipped content).

### E2. a11y sweep

- `e2e/a11y.spec.ts`: extend the route list from 17 → 20.
- Re-run the full e2e suite; investigate any new axe violations.

### E3. Cross-lesson regression check

- Manual: walk all three new lessons in light mode, dark mode, reduced motion, large
  text. Confirm no layout shift, no console errors, math toggle behaves consistently.
- Chrome DevTools MCP pass on all three (the same technique used for the Robin Hood
  lesson).

### E4. Docs

- `next_session.md`: append the ML pillar to "What ships today"; update test counts
  (unit, e2e, a11y route count); note any v2 follow-ups surfaced during build.
- Mark the spec's success-criteria checkboxes.

**Verification checkpoint (end of Phase E):**

- [ ] All 8 success-criteria checkboxes in `SPEC-ML.md` are ticked.
- [ ] e2e suite green across all 20 routes.
- [ ] `next_session.md` accurate.
- [ ] At least one `[[ml-pillar-v1]]` cross-link from `MEMORY.md` if the work surfaced
      anything non-obvious worth keeping.

**Estimated effort:** 1 session.

## Cross-cutting Risks

| Risk                                                                                 | Likelihood | Impact | Mitigation                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hydration mismatch on `<MathLevel />` first render                                   | Medium     | High   | Render default on SSR, swap to persisted in `useEffect` post-mount. Same trick as `useReducedMotion`. Cover with an explicit test.                                      |
| 100% coverage gate fails when `src/lib/ml/` is empty (Phase A end state)             | Low        | Medium | Test locally before pushing Phase A. If it fails, gate the include behind a sentinel file with a no-op test; remove once Phase B lands.                                 |
| Trajectory animation interacts badly with existing playback timer                    | Medium     | Medium | `runToCompletion()` reuses the existing auto-advance timer rather than starting a second one. Unit-test under both reduced-motion and normal modes.                     |
| Bundle bloat from new viz primitives + math toggle                                   | Low        | Medium | Each new primitive is pure SVG; no new deps. KaTeX is already bundled. Run `npm run build` after each lesson and verify per-route size against the 175 KB target.       |
| Backprop's coverage on a single hand-coded example leaves some branches unreachable  | Medium     | High   | Adjust the example until every branch fires. Don't add defensive branches for inputs that can't reach the generator. Use `/* v8 ignore */` only for provable dead code. |
| Numerical-gradient check in backprop tests is flaky                                  | Low        | Medium | Use a fixed seed + a fixed example. Tolerance set at 1e-4 (loose for a forward-difference numerical check, tight enough to catch real bugs).                            |
| `<MathLevel />` toggle is unreachable by keyboard / fails axe                        | Low        | High   | Use `role="radiogroup"` + `aria-checked`. Cover with axe in e2e and `@testing-library/user-event` keyboard test in unit.                                                |
| Attention heatmap color scale confuses users when pre-softmax scores are shown       | Medium     | Low    | Use two distinct palettes (diverging for scores, sequential for weights), label each with a small legend.                                                               |
| Lesson MDX duplication: maintaining parallel intuition + math prose drifts over time | Medium     | Medium | Keep the two prose blocks _adjacent_ in the MDX source so an editor sees them together. Document the convention in `SPEC-ML.md` (already done).                         |

## Parallelism

- Phases B, C, D are **independent** once Phase A lands — they could run as parallel
  branches if multiple agents/people are working on this. **Plan as written:** sequential,
  to honor commit discipline and let each lesson teach us before the next starts.
- Within Phase B (and C, D): generator + snippet + view + viz can be written in two
  sub-passes — _generator + snippet + tests_ first (commit), then _view + viz + MDX +
  e2e_ (commit). This matches the existing repo's pairing-heap rollout pattern.

## Open Questions to Surface to the Human Before Tasks (Phase 3)

These don't block planning, but they're the calls that affect task shape:

1. **Phase order — sequential or partial parallel?** Plan-as-written is sequential.
   Counter-argument: GD + backprop + attention have zero shared code besides Phase A,
   so they could ship as three parallel branches. **Recommended:** sequential; finish
   GD, learn from it, then start backprop.
2. **Should Phase A land as one commit or several?** Recommended: three commits inside
   Phase A — (a) types + coverage wiring, (b) MathLevel, (c) Controls extension. Each
   self-tests.
3. **Is the `gradient-descent` lesson MDX allowed to define its bowl-contour data
   inline, or should it live in `src/lib/ml/gradientDescent.contours.ts`?**
   **Recommended:** the latter — it's tested data, not lesson copy.
4. **Lighthouse during/after each phase, or just at the end?** Recommended: after each
   phase if local Lighthouse is set up; otherwise just before Phase E.

---

**Next step:** Phase 3 (Tasks) — break each phase above into discrete, implementable
tasks with acceptance criteria and verification commands. Output: `docs/TASKS-ML.md`.
