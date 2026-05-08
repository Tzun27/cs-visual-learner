import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/binary-search-tree", () => {
  test("renders heading, viz region, source toggle, and toolbar", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/binary-search-tree");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Binary Search Tree/);
    const insertRegion = page.getByRole("region", { name: /Binary search tree visualization/ });
    await expect(insertRegion).toBeVisible();
    await expect(page.getByRole("group", { name: /Insert order/ })).toBeVisible();
    const toolbar = insertRegion.getByRole("toolbar", { name: /Playback controls/ });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /Step forward/ })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("step forward advances comparisons or placed; reset returns to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/binary-search-tree");
    const insertRegion = page.getByRole("region", { name: /Binary search tree visualization/ });
    const stepForward = insertRegion.getByRole("button", { name: /Step forward/ });
    const reset = insertRegion.getByRole("button", { name: /Reset/ });
    const counters = insertRegion.locator("dl");

    const advanced = /(Comparisons|Placed)\s*[1-9]/;
    await expect(counters).toContainText(/Placed\s*0/);
    for (let i = 0; i < 6; i++) {
      await stepForward.click();
      const text = (await counters.textContent()) ?? "";
      if (advanced.test(text)) break;
    }
    await expect(counters).toContainText(advanced);

    await reset.click();
    await expect(counters).toContainText(/Comparisons\s*0/);
    await expect(counters).toContainText(/Placed\s*0/);
    await expect(counters).toContainText(/Max depth\s*0/);
  });

  test("toggling Sorted order activates that pressed state and resets counters", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/binary-search-tree");
    const insertRegion = page.getByRole("region", { name: /Binary search tree visualization/ });
    const stepForward = insertRegion.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 4; i++) await stepForward.click();
    const sortedBtn = page.getByRole("button", { name: /Sorted order/ });
    await expect(sortedBtn).toHaveAttribute("aria-pressed", "false");
    await sortedBtn.click();
    await expect(sortedBtn).toHaveAttribute("aria-pressed", "true");
    await expect(insertRegion.locator("dl")).toContainText(/Placed\s*0/);
  });

  test("the search section renders with its own toolbar and counters", async ({ page }) => {
    await page.goto("/lessons/data-structures/binary-search-tree");
    const searchRegion = page.getByRole("region", { name: /Binary search tree search/ });
    await expect(searchRegion).toBeVisible();
    await expect(searchRegion.getByText(/Searching for/)).toBeVisible();
    await expect(searchRegion.locator("dl")).toContainText(/Comparisons\s*0/);
    await expect(searchRegion.locator("dl")).toContainText(/Found\s*0/);
    await expect(searchRegion.locator("dl")).toContainText(/Misses\s*0/);
  });

  test("stepping the search viz eventually ticks the Comparisons counter", async ({ page }) => {
    await page.goto("/lessons/data-structures/binary-search-tree");
    const searchRegion = page.getByRole("region", { name: /Binary search tree search/ });
    const stepForward = searchRegion.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 4; i++) await stepForward.click();
    await expect(searchRegion.locator("dl")).toContainText(/Comparisons\s*[1-9]/);
  });

  test("the delete section renders with its own toolbar and the three case-specific counters", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/binary-search-tree");
    const deleteRegion = page.getByRole("region", { name: /Binary search tree delete/ });
    await expect(deleteRegion).toBeVisible();
    await expect(deleteRegion.getByText(/Deleting/)).toBeVisible();
    const counters = deleteRegion.locator("dl");
    await expect(counters).toContainText(/Comparisons\s*0/);
    await expect(counters).toContainText(/Successor walks\s*0/);
    await expect(counters).toContainText(/Removed\s*0/);
  });

  test("stepping the delete viz eventually ticks Removed (a full delete completes)", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/binary-search-tree");
    const deleteRegion = page.getByRole("region", { name: /Binary search tree delete/ });
    const stepForward = deleteRegion.getByRole("button", { name: /Step forward/ });
    const counters = deleteRegion.locator("dl");
    // Worst case (3-cmp leaf delete) is 5 steps to first unlink; budget some slack.
    for (let i = 0; i < 12; i++) {
      await stepForward.click();
      const text = (await counters.textContent()) ?? "";
      if (/Removed\s*[1-9]/.test(text)) break;
    }
    await expect(counters).toContainText(/Removed\s*[1-9]/);
  });
});
