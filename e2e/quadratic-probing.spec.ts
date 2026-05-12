import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/quadratic-probing", () => {
  test("renders heading, three viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/quadratic-probing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Hash Tables: Quadratic Probing/,
    );

    for (const name of [
      "Quadratic-probe insert",
      "Quadratic-probe search",
      "Quadratic-probe delete",
    ]) {
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

  test("insert viz runs to completion: 5 placed, 1 duplicate, 10 probes (i² spread)", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/quadratic-probing");
    const region = page.getByRole("region", { name: "Quadratic-probe insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 100; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Placed\s*5/);
    await expect(counters).toContainText(/Duplicates\s*1/);
    // [5, 16, 27, 38, 49, 16]: probe counts are 0+1+2+3+4 for the 5 placements
    // (cumulative 10), plus 1 probe-past-slot-5 for the duplicate-16 search.
    await expect(counters).toContainText(/Probes\s*11/);
  });

  test("reset returns the insert counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/quadratic-probing");
    const region = page.getByRole("region", { name: "Quadratic-probe insert", exact: true });
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
    await page.goto("/lessons/data-structures/quadratic-probing");
    const region = page.getByRole("region", { name: "Quadratic-probe search", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Found\s*2/);
    await expect(counters).toContainText(/Misses\s*2/);
  });

  test("delete viz ticks Removed for two deletes; one miss; reset clears", async ({ page }) => {
    await page.goto("/lessons/data-structures/quadratic-probing");
    const region = page.getByRole("region", { name: "Quadratic-probe delete", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Removed\s*2/);
    await expect(counters).toContainText(/Misses\s*1/);

    await reset.click();
    await expect(counters).toContainText(/Removed\s*0/);
    await expect(counters).toContainText(/Misses\s*0/);
  });
});
