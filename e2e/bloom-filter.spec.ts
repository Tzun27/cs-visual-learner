import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/bloom-filter", () => {
  test("renders heading, two viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/bloom-filter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Bloom Filter/);

    for (const name of ["Bloom filter insert", "Bloom filter contains"]) {
      const region = page.getByRole("region", { name, exact: true });
      await expect(region).toBeVisible();
      await expect(
        region.getByRole("toolbar", { name: /Playback controls/ }).getByRole("button", {
          name: /Step forward/,
        }),
      ).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test("insert viz runs to completion: 4 items, 11 of 16 bits set", async ({ page }) => {
    await page.goto("/lessons/data-structures/bloom-filter");
    const region = page.getByRole("region", { name: "Bloom filter insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 200; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // [1, 6, 12, 9]: 4 items, k=3 set-bit ops each = 12 ops, but bit 9
    // is already set when 9's insert hits it → 11 actually flipped bits.
    await expect(counters).toContainText(/Items\s*4/);
    await expect(counters).toContainText(/Bits set \(of 16\)\s*11/);
    await expect(counters).toContainText(/Bit-set ops\s*12/);
  });

  test("reset returns the insert counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/bloom-filter");
    const region = page.getByRole("region", { name: "Bloom filter insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 8; i++) await stepForward.click();
    await reset.click();
    await expect(counters).toContainText(/Items\s*0/);
    await expect(counters).toContainText(/Bits set \(of 16\)\s*0/);
    await expect(counters).toContainText(/Bit-set ops\s*0/);
  });

  test("contains viz: 3 found, 1 false positive, 1 miss", async ({ page }) => {
    await page.goto("/lessons/data-structures/bloom-filter");
    const region = page.getByRole("region", { name: "Bloom filter contains", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 200; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // Targets [1, 9, 7, 5]:
    //   1 → TP (3 checks)
    //   9 → TP (3 checks)
    //   7 → FP (3 checks)
    //   5 → miss after 2 checks
    // Total: Found=3, False+=1, Misses=1, Lookups=11.
    await expect(counters).toContainText(/Found\s*3/);
    await expect(counters).toContainText(/False\+\s*1/);
    await expect(counters).toContainText(/Misses\s*1/);
    await expect(counters).toContainText(/Lookups\s*11/);
  });
});
