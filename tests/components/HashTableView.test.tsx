import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HashTableView } from "@/components/visualizations/HashTableView";
import { buildHashTable, emptyHashTable } from "@/lib/dataStructures/hashTable";
import type { HashTableKV } from "@/lib/dataStructures/types";

// Bare-key → (key, key) tuple, matching the convention from hashTable.test.ts.
// These component tests are about layout and aria-label structure, not
// values — value === key keeps assertions readable.
function kvs(...keys: number[]): HashTableKV[] {
  return keys.map((k) => [k, k] as const);
}

describe("HashTableView", () => {
  it("renders an empty hash table without crashing and labels it as empty", () => {
    const { getByRole } = render(<HashTableView table={emptyHashTable()} />);
    const svg = getByRole("img");
    expect(svg.getAttribute("aria-label")).toMatch(/Empty hash table/);
    expect(svg.getAttribute("aria-label")).toMatch(/8 buckets/);
  });

  it("renders one ellipse per live entry and prints each 'key: value' as text", () => {
    const table = buildHashTable(kvs(1, 9, 17)); // all collide in bucket 1
    const { container } = render(<HashTableView table={table} />);
    // 8 bucket headers (rects) + 3 entry ellipses (and possibly highlight rings)
    const ellipses = container.querySelectorAll("ellipse");
    expect(ellipses.length).toBeGreaterThanOrEqual(3);
    const text = container.textContent ?? "";
    expect(text).toContain("1: 1");
    expect(text).toContain("9: 9");
    expect(text).toContain("17: 17");
  });

  it("describes key count and bucket count in aria-label when no highlights present", () => {
    const table = buildHashTable(kvs(1, 2, 3));
    const { getByRole } = render(<HashTableView table={table} />);
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/3 keys across 8 buckets/);
  });

  it("includes highlight context (kind + key:value) in aria-label", () => {
    const table = buildHashTable(kvs(7));
    const { getByRole } = render(
      <HashTableView table={table} highlights={[{ entryId: 0, kind: "cursor" }]} />,
    );
    const label = getByRole("img").getAttribute("aria-label") ?? "";
    expect(label).toMatch(/entry 7: 7 being probed/);
  });

  it("includes the active bucket index in aria-label", () => {
    const table = buildHashTable(kvs(5));
    const { getByRole } = render(<HashTableView table={table} activeBucketIndex={5} />);
    const label = getByRole("img").getAttribute("aria-label") ?? "";
    expect(label).toMatch(/active bucket 5/);
  });

  it("draws a connector line for every non-empty bucket", () => {
    const table = buildHashTable(kvs(1, 9, 17)); // one non-empty bucket
    const { container } = render(<HashTableView table={table} />);
    expect(container.querySelectorAll("line").length).toBe(1);
  });

  it("renders a ghost slot when ghostBucketIndex is set", () => {
    const table = emptyHashTable();
    const { container } = render(<HashTableView table={table} ghostBucketIndex={3} />);
    // Ghost is rendered as a dashed line + dashed ellipse.
    const dashed = container.querySelectorAll('[stroke-dasharray="3 4"]');
    expect(dashed.length).toBeGreaterThanOrEqual(2);
  });
});
