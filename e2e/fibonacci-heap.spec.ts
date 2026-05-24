import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/fibonacci-heap", () => {
  test("renders heading, three viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/fibonacci-heap");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Fibonacci Heap/);

    for (const name of [
      "Fibonacci heap insert",
      "Fibonacci heap extract-min",
      "Fibonacci heap decrease-key",
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

  test("insert viz: 5 inserts → 5 singleton roots", async ({ page }) => {
    await page.goto("/lessons/data-structures/fibonacci-heap");
    const region = page.getByRole("region", { name: "Fibonacci heap insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 200; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Inserts\s*5/);
    await expect(counters).toContainText(/Roots\s*5/);
  });

  test("extract-min viz: 3 pairs, 3 links, finishes with 1 root", async ({ page }) => {
    await page.goto("/lessons/data-structures/fibonacci-heap");
    const region = page.getByRole("region", {
      name: "Fibonacci heap extract-min",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 200; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // 5 inserts → extract removes value 1 → consolidate runs 3 pairings
    // (deg0,deg0)×2 then (deg1,deg1) → final has 1 tree of degree 2.
    await expect(counters).toContainText(/Pairs found\s*3/);
    await expect(counters).toContainText(/Links\s*3/);
    await expect(counters).toContainText(/Roots\s*1/);
  });

  test("decrease-key viz: 3-cut cascade, 0 cascade-marks (cascade walks all the way up)", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/fibonacci-heap");
    const region = page.getByRole("region", {
      name: "Fibonacci heap decrease-key",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 200; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // Three cuts: the deep leaf gets cut, then both marked ancestors
    // cascade-cut. The third cut's parent is the original root, so no
    // cascade-mark fires anywhere — the cascade just stops at a root.
    await expect(counters).toContainText(/Cuts\s*3/);
    await expect(counters).toContainText(/Cascade-marks\s*0/);
    // Resulting root list: original root + 3 newly-cut subtrees = 4 roots.
    await expect(counters).toContainText(/Roots\s*4/);
  });

  test("reset returns insert counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/fibonacci-heap");
    const region = page.getByRole("region", { name: "Fibonacci heap insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 4; i++) await stepForward.click();
    await reset.click();
    await expect(counters).toContainText(/Inserts\s*0/);
    await expect(counters).toContainText(/Roots\s*0/);
  });
});
