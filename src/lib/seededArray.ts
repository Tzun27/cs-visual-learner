// Deterministic array generation shared by SortingViz and RaceViz. SSR and
// the first client paint must agree on the input array, so seeding never
// touches Math.random (see AGENTS architectural decision 4); callers reseed
// with Math.random only in response to post-hydration user actions.

/** FNV-1a hash of a string — used to derive a stable seed from lesson params. */
export function fnv1a(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/** A deterministic shuffled array of `size` values derived purely from `seed`. */
export function makeSeededArray(size: number, seed: number): number[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  return Array.from({ length: size }, (_, i) => Math.floor(rand() * 90) + i + 1)
    .map((value) => ({ value, key: rand() }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.value);
}
