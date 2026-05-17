import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/cuckoo-hashing", () => {
  test("renders heading, three viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/cuckoo-hashing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hash Tables: Cuckoo Hashing/);

    for (const name of ["Cuckoo insert", "Cuckoo search", "Cuckoo delete"]) {
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

  test("insert viz runs to completion: 4 placed, 1 duplicate, 4 evictions (1 + 3 cascade)", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/cuckoo-hashing");
    const region = page.getByRole("region", { name: "Cuckoo insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 200; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // [5, 0, 12, 14, 5]: 4 unique keys land; the second 5 is dedup-rejected.
    await expect(counters).toContainText(/Placed\s*4/);
    await expect(counters).toContainText(/Duplicates\s*1/);
    // 12 triggers a 1-step swap; 14 triggers a 3-step cascade. Total = 4.
    await expect(counters).toContainText(/Evictions\s*4/);
  });

  test("reset returns the insert counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/cuckoo-hashing");
    const region = page.getByRole("region", { name: "Cuckoo insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 8; i++) await stepForward.click();
    await reset.click();
    await expect(counters).toContainText(/Placed\s*0/);
    await expect(counters).toContainText(/Evictions\s*0/);
    await expect(counters).toContainText(/Duplicates\s*0/);
  });

  test("search viz: 3 found, 1 miss, 7 lookups (5→1 + 12→2 + 0→2 + 99→2)", async ({ page }) => {
    await page.goto("/lessons/data-structures/cuckoo-hashing");
    const region = page.getByRole("region", { name: "Cuckoo search", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 100; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Found\s*3/);
    await expect(counters).toContainText(/Misses\s*1/);
    // 5 takes 1 lookup; 12, 0, 99 each take 2 (T_A miss then T_B). Total = 7.
    await expect(counters).toContainText(/Lookups\s*7/);
  });

  test("delete viz: 2 removed, 1 miss, 5 lookups (14→1 + 12→2 + 99→2); reset clears", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/cuckoo-hashing");
    const region = page.getByRole("region", { name: "Cuckoo delete", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 100; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Removed\s*2/);
    await expect(counters).toContainText(/Misses\s*1/);
    await expect(counters).toContainText(/Lookups\s*5/);

    await reset.click();
    await expect(counters).toContainText(/Removed\s*0/);
    await expect(counters).toContainText(/Misses\s*0/);
    await expect(counters).toContainText(/Lookups\s*0/);
  });
});
