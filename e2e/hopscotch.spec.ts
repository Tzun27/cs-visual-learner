import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/hopscotch", () => {
  test("renders heading, two viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/hopscotch");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Hash Tables: Hopscotch Hashing/,
    );

    for (const name of ["Hopscotch insert", "Hopscotch search"]) {
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

  test("insert viz runs to completion: 5 placed, 1 swap, ≥ 1 scan", async ({ page }) => {
    await page.goto("/lessons/data-structures/hopscotch");
    const region = page.getByRole("region", { name: "Hopscotch insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Placed\s*5/);
    await expect(counters).toContainText(/Swaps\s*1/);
    await expect(counters).toContainText(/Scans\s*[1-9]/);
  });

  test("reset returns the insert counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/hopscotch");
    const region = page.getByRole("region", { name: "Hopscotch insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 6; i++) await stepForward.click();
    await reset.click();
    await expect(counters).toContainText(/Scans\s*0/);
    await expect(counters).toContainText(/Swaps\s*0/);
    await expect(counters).toContainText(/Placed\s*0/);
  });

  test("search viz runs to completion: 3 found, 1 miss, 10 bits checked", async ({ page }) => {
    await page.goto("/lessons/data-structures/hopscotch");
    const region = page.getByRole("region", { name: "Hopscotch search", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Found\s*3/);
    await expect(counters).toContainText(/Misses\s*1/);
    // Targets [0, 16, 9, 99] use 1 + 2 + 3 + 4 = 10 bit checks total.
    await expect(counters).toContainText(/Bits checked\s*10/);
  });
});
