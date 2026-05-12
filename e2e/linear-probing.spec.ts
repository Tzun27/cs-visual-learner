import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/linear-probing", () => {
  test("renders heading, three viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/linear-probing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hash Tables: Linear Probing/);

    for (const name of [
      "Linear-probe insert",
      "Linear-probe search",
      "Linear-probe delete",
      "Robin Hood insert",
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

  test("stepping the insert viz eventually ticks Probes or Placed; Reset returns to zero", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/linear-probing");
    const region = page.getByRole("region", { name: "Linear-probe insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    await expect(counters).toContainText(/Probes\s*0/);
    await expect(counters).toContainText(/Placed\s*0/);

    const advanced = /(Probes|Placed)\s*[1-9]/;
    for (let i = 0; i < 10; i++) {
      await stepForward.click();
      const text = (await counters.textContent()) ?? "";
      if (advanced.test(text)) break;
    }
    await expect(counters).toContainText(advanced);

    await reset.click();
    await expect(counters).toContainText(/Probes\s*0/);
    await expect(counters).toContainText(/Placed\s*0/);
  });

  test("insert viz runs to completion: 5 placed, 1 duplicate, ≥ 4 probes", async ({ page }) => {
    await page.goto("/lessons/data-structures/linear-probing");
    const region = page.getByRole("region", { name: "Linear-probe insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Placed\s*5/);
    await expect(counters).toContainText(/Duplicates\s*1/);
    // Insert sequence [5,13,21,4,23,5] needs: 0 probes for 5, 1 for 13, 2 for 21,
    // 0 for 4, 1 for 23, 0 for the duplicate. Total = 4.
    await expect(counters).toContainText(/Probes\s*4/);
  });

  test("search viz hits 5 and 21 (probing past a tombstone), misses on 13 and 12", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/linear-probing");
    const region = page.getByRole("region", { name: "Linear-probe search", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // Targets [5, 21, 13, 12, 4]: 3 hits (5, 21, 4), 2 misses (13, 12).
    await expect(counters).toContainText(/Found\s*3/);
    await expect(counters).toContainText(/Misses\s*2/);
  });

  test("Robin Hood insert viz runs to completion: ≥1 swap, 4 placed", async ({ page }) => {
    await page.goto("/lessons/data-structures/linear-probing");
    const region = page.getByRole("region", { name: "Robin Hood insert", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // Input [5, 14, 13, 22]: one swap (when 13 evicts 14), 4 keys placed total.
    await expect(counters).toContainText(/Placed\s*4/);
    await expect(counters).toContainText(/Swaps\s*1/);
  });

  test("delete viz tombstones two slots and reports one miss on key 99", async ({ page }) => {
    await page.goto("/lessons/data-structures/linear-probing");
    const region = page.getByRole("region", { name: "Linear-probe delete", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // Targets [13, 4, 99]: 2 removed, 1 miss.
    await expect(counters).toContainText(/Removed\s*2/);
    await expect(counters).toContainText(/Misses\s*1/);
  });
});
