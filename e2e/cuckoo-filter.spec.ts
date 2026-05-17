import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/cuckoo-filter", () => {
  test("renders heading, three viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/cuckoo-filter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Cuckoo Filter/);

    for (const name of ["Cuckoo filter insert", "Cuckoo filter contains", "Cuckoo filter delete"]) {
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

  test("insert viz runs to completion: 4 placed, 2 evictions (cascade depth 2)", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/cuckoo-filter");
    const region = page.getByRole("region", { name: "Cuckoo filter insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 200; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // [5, 0, 7, 13]: 4 keys, all placed. 13's insert triggers a 2-step
    // eviction cascade.
    await expect(counters).toContainText(/Placed\s*4/);
    await expect(counters).toContainText(/Evictions\s*2/);
  });

  test("reset returns the insert counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/cuckoo-filter");
    const region = page.getByRole("region", { name: "Cuckoo filter insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 8; i++) await stepForward.click();
    await reset.click();
    await expect(counters).toContainText(/Placed\s*0/);
    await expect(counters).toContainText(/Evictions\s*0/);
  });

  test("contains viz: 4 found, 1 false positive, 1 miss", async ({ page }) => {
    await page.goto("/lessons/data-structures/cuckoo-filter");
    const region = page.getByRole("region", { name: "Cuckoo filter contains", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 200; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // [13, 5, 0, 35, 99]: 4 true positives (13, 5, 0, plus 35 reports
    // found as a FP), 1 miss (99). Reported-Found = 4, False+ = 1, Misses = 1.
    await expect(counters).toContainText(/Found\s*4/);
    await expect(counters).toContainText(/False\+\s*1/);
    await expect(counters).toContainText(/Misses\s*1/);
  });

  test("delete viz: 1 removed, 1 miss, 3 lookups (13→1 + 99→2)", async ({ page }) => {
    await page.goto("/lessons/data-structures/cuckoo-filter");
    const region = page.getByRole("region", { name: "Cuckoo filter delete", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 100; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Removed\s*1/);
    await expect(counters).toContainText(/Misses\s*1/);
    // 13: home hit (1 check). 99: both candidates miss (2 checks).
    await expect(counters).toContainText(/Lookups\s*3/);

    await reset.click();
    await expect(counters).toContainText(/Removed\s*0/);
    await expect(counters).toContainText(/Misses\s*0/);
    await expect(counters).toContainText(/Lookups\s*0/);
  });
});
