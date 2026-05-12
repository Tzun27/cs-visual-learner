# ML Intuitions Pillar (v1)

## Problem Statement

How might we extend cs-visual-learner's step-through pattern — pure-generator
algorithms feeding SVG vizes with synchronized Python code — to ML internals,
so a student who's just watched quicksort partition an array can watch a tiny
network learn? And how do we do it in a way that serves both a CS freshman
with no calculus _and_ a CS undergrad who's comfortable with $\nabla L$ and the
chain rule, without forking the site into two parallel tracks?

## Recommended Direction

**Three disciplined lessons + dual-track prose + hybrid step / trajectory viz.**

The ML pillar ships as three independent lessons — Gradient Descent, Backprop,
Attention — each with its own toy example and viz primitives, each
structurally similar to a sort or data-structures lesson (pure data layer →
SVG view → viz composition → MDX page). What makes the pillar feel like a
pillar (and not just three more lessons) is a new content mechanism: **every
lesson has a math-floor toggle at the top — "intuition" vs. "with math" — that
swaps prose blocks while the vizes stay constant**. This is the load-bearing
novel feature; it's the answer to "how do we serve both audiences without
giving anyone a worse version of the site." The hybrid viz discipline (each
click is one update, plus a "run-to-completion" button that draws the full
trajectory as a continuous path) is the secondary novel feature — it pays for
the continuous-math content the site has been avoiding.

Direction B (single running example across all three lessons) was tempting but
fragile: the natural example spaces for GD (smooth scalar loss), backprop
(small MLP classifier), and attention (sequence transform) are different
enough that unifying them compromises each. Direction C (Pyodide-powered live
Python execution) is genuinely exciting but is a separate project — defer to
v2 of the pillar.

## Key Assumptions to Validate

- [ ] **Dual-track prose works for both audiences without one feeling
      shortchanged.** Untested — the site has no precedent. Validate by
      shipping the GD lesson first with the toggle, dog-fooding both modes,
      and asking a freshman + an undergrad reader.
- [ ] **A 3-4 token attention head with small Q/K/V dim is enough to teach the
      attention mechanism.** The 2D constraint relaxes here; check that the
      core insight ("attention scores = which other tokens this one looks
      at") survives the simplification.
- [ ] **The contour-plot / heatmap viz primitives translate cleanly from
      sorting's `ArrayBars` / data-structures' `TreeView` styling vocabulary.**
      Color palette (Wong 2011 + shape redundancy), reduced-motion behavior,
      and step-through controls all need to feel native to the existing site.
- [ ] **A "run-to-completion" trajectory button doesn't break the
      reduced-motion contract.** Reduced-motion users see the end state
      immediately; non-reduced users see a continuous animation. Same step
      data underneath; only the rendering differs.

## MVP Scope

**Three new lessons under `/lessons/ml/`:**

1. **Gradient Descent** (`/lessons/ml/gradient-descent`).
   - Single 2-parameter problem (e.g., $f(w_1, w_2)$ a quadratic bowl, or
     least-squares on a tiny dataset).
   - One viz: 2D contour plot with optimizer trajectory.
   - One optimizer: vanilla GD with learning-rate input.
   - Step = one gradient update. Trajectory = the whole path.
   - Dual-track prose: intuition mode talks about "the steepest-downhill
     direction"; math mode introduces $\nabla L$ and $w \leftarrow w - \alpha
     \nabla L$.

2. **Backprop** (`/lessons/ml/backprop`).
   - Tiny network: 2 inputs → 2 hidden → 1 output. One activation function
     (sigmoid or ReLU).
   - One viz: the network diagram with forward-pass values flowing left → right
     and backward-pass gradients flowing right → left in a second pass.
   - One example: a single training example computing one full
     forward + backward + weight update.
   - Step = one node computation (forward) or one gradient computation
     (backward).
   - Dual-track prose: intuition mode talks about "how much did this weight
     contribute to the wrong answer"; math mode introduces the chain rule.

3. **Attention** (`/lessons/ml/attention`).
   - Single attention head. 3-4 tokens. Small Q/K/V dim (probably 2).
   - One viz: token row at top, three weight matrices below, an attention
     matrix heatmap, and the output vectors.
   - One example: a fixed input sequence ("the cat sat" or similar) with
     pre-set Q/K/V matrices so the demonstration is deterministic.
   - Step = one query × all keys → softmax → weighted sum, per query token.
   - Dual-track prose: intuition mode talks about "each token decides who to
     pay attention to"; math mode introduces $\text{softmax}(QK^T / \sqrt{d_k}) V$.

**Cross-cutting:**

- **`<MathLevel>` toggle component** at the top of each MDX lesson,
  switching between two prose blocks. Persists per-user via localStorage so
  picking a level once carries across the pillar.
- **New `ContourView` / `NetworkView` / `AttentionView` SVG primitives** in
  `src/components/visualizations/`, mirroring the per-topic primitive pattern
  (`TreeView`, `LinearProbeView`, `HopscotchView`).
- **One generator per lesson** in `src/lib/ml/`, mirroring the per-topic
  module pattern (`heap.ts`, `pairingHeap.ts`).
- **Python snippets per lesson**, mirroring the `*.snippet.ts` convention.
  Each snippet stays in the codepanel-with-step-highlights territory.
- **e2e + a11y coverage** for all three new lesson routes (+3 a11y routes).
- **100% unit-test coverage** on `src/lib/ml/**` (same gate as `algorithms/`
  and `dataStructures/`).
- **Lessons-index entry** under a new "Machine learning intuitions" topic
  group (or promote the existing "coming soon" placeholders).

## Not Doing (and Why)

- **Pyodide / live Python execution.** Out of scope for v1. ~10 MB bundle
  cost, web-worker lifecycle complexity, sandboxing edge cases. Defer to v2;
  let the dual-track + hybrid-viz prove itself first.
- **Multi-head attention, positional encoding, layer norm, residuals.** Out
  of scope. The single-head attention lesson should explain the mechanism;
  the full transformer is at least two more lessons of work.
- **Real-size models / GPU intuition / distributed training.** Wrong scale.
  The site teaches mechanisms, not infrastructure.
- **Single running example unifying all three lessons (Direction B).**
  Editorially appealing, structurally fragile. Each lesson gets its own
  example.
- **Optimizers beyond vanilla GD.** Momentum, Adam, RMSProp are worth a
  follow-up lesson but not part of v1 — too much surface to cover well.
- **TypeScript code panel toggle.** Orthogonal feature (already on the v2
  list). Don't bundle with the ML pillar.
- **Loss landscape exploration / playgrounds where users drag start
  points.** Save for v2 / interactive-decrease_key-style follow-up. v1 ships
  the curated paths.
- **Numpy-only or JAX-only Python.** Stay on the existing PyTorch-flavored
  Python conventions where possible (matrix ops as `@` etc.) so the snippets
  feel like real ML code without committing to a specific library's API
  surface.

## Open Questions

- **Where does the `<MathLevel>` toggle live?** Lesson-header (matches
  TraversalViz's mode toggle) or inline with the CodePanel? Header is more
  discoverable; inline keeps the levels visually close to the code.
- **Default math level?** Probably "intuition" — broader entry point. With a
  visible "switch to with-math" affordance for the curious. Confirm during
  build.
- **Does the toggle persist across the pillar or per-lesson?** localStorage
  by default; reset on Reset button? Probably persistent — the user's
  comfort level doesn't change between lessons.
- **How do we sequence the lessons in the index?** GD → backprop →
  attention is the conceptual order, but a freshman skimming the lessons
  page might want a different entry point (e.g., attention first, since
  it's the most visually striking).
- **Is the trajectory-mode button worth its own UI component, or just a
  `Controls.tsx` extension?** Probably the latter — the existing playback
  toolbar already has play / pause / step-forward; "run to completion" is
  one more button.
- **Backprop's "show me the chain rule applied" view — is one viz enough,
  or do we need a math-only auxiliary view?** Possibly the math-mode prose
  is enough; the viz stays constant across modes.

---

**Status:** Refined. Ready for `spec-driven-development` skill to produce
`docs/SPEC-ML.md` or `planning-and-task-breakdown` skill to break this MVP
scope into ordered tasks.
