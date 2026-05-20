/**
 * Count how many steps in a sequence carry a given discriminated-union `kind`.
 *
 * Visualization wrappers use this to derive their live counters (probes,
 * swaps, comparisons, …) from the steps played so far. It replaces the
 * per-wrapper hand-rolled `countX` helpers, which were all this same loop.
 */
export function countKind<S extends { readonly kind: string }>(
  steps: readonly S[],
  kind: S["kind"],
): number {
  let n = 0;
  for (const step of steps) {
    if (step.kind === kind) n += 1;
  }
  return n;
}
