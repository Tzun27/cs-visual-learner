import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/double-hashing", () => {
  test("renders heading, three viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/double-hashing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hash Tables: Double Hashing/);

    for (const name of ["Double-hash insert", "Double-hash search", "Double-hash delete"]) {
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

  test("insert viz runs to completion: 5 placed, 1 duplicate, 5 probes (1 per same-h1 collision)", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/double-hashing");
    const region = page.getByRole("region", { name: "Double-hash insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 100; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Placed\s*5/);
    await expect(counters).toContainText(/Duplicates\s*1/);
    // [5, 16, 27, 38, 49, 27]: each placement after the first collides at
    // slot 5 once before jumping to an empty slot (4 probes total), and the
    // duplicate 27 also probes home once before finding itself (1 probe).
    await expect(counters).toContainText(/Probes\s*5/);
  });

  test("reset returns the insert counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/double-hashing");
    const region = page.getByRole("region", { name: "Double-hash insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 8; i++) await stepForward.click();
    await reset.click();
    await expect(counters).toContainText(/Probes\s*0/);
    await expect(counters).toContainText(/Placed\s*0/);
    await expect(counters).toContainText(/Duplicates\s*0/);
  });

  test("search viz finds 5 and 27 (probes past tombstone), misses on 16 and 99", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/double-hashing");
    const region = page.getByRole("region", { name: "Double-hash search", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Found\s*2/);
    await expect(counters).toContainText(/Misses\s*2/);
    // 5: 0 probes; 27: 1 probe past slot 5; 16: 2 probes (slot 5, then
    // tombstone at slot 1); 99: 0 probes. Total = 3.
    await expect(counters).toContainText(/Probes\s*3/);
  });

  test("delete viz ticks Removed for two deletes; one miss; reset clears", async ({ page }) => {
    await page.goto("/lessons/data-structures/double-hashing");
    const region = page.getByRole("region", { name: "Double-hash delete", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Removed\s*2/);
    await expect(counters).toContainText(/Misses\s*1/);
    // 27: 1 probe; 5: 0 probes (direct hit); 99: 0 probes (home empty).
    await expect(counters).toContainText(/Probes\s*1/);

    await reset.click();
    await expect(counters).toContainText(/Removed\s*0/);
    await expect(counters).toContainText(/Misses\s*0/);
  });
});
