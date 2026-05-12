import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/hash-tables", () => {
  test("renders heading, all three regions, and a toolbar per region", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/hash-tables");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hash Tables/);

    const insertRegion = page.getByRole("region", { name: "Hash table insert", exact: true });
    const searchRegion = page.getByRole("region", { name: "Hash table search", exact: true });
    const deleteRegion = page.getByRole("region", { name: "Hash table delete", exact: true });
    await expect(insertRegion).toBeVisible();
    await expect(searchRegion).toBeVisible();
    await expect(deleteRegion).toBeVisible();

    for (const region of [insertRegion, searchRegion, deleteRegion]) {
      const toolbar = region.getByRole("toolbar", { name: /Playback controls/ });
      await expect(toolbar).toBeVisible();
      await expect(toolbar.getByRole("button", { name: /Step forward/ })).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test("stepping the insert viz eventually ticks Placed (a key gets stored)", async ({ page }) => {
    await page.goto("/lessons/data-structures/hash-tables");
    const insertRegion = page.getByRole("region", { name: "Hash table insert", exact: true });
    const stepForward = insertRegion.getByRole("button", { name: /Step forward/ });
    const counters = insertRegion.locator("dl");

    await expect(counters).toContainText(/Placed\s*0/);
    // Worst case to first place is begin → hash → place = 3 clicks. Budget slack.
    for (let i = 0; i < 8; i++) {
      await stepForward.click();
      const text = (await counters.textContent()) ?? "";
      if (/Placed\s*[1-9]/.test(text)) break;
    }
    await expect(counters).toContainText(/Placed\s*[1-9]/);
  });

  test("reset returns the insert counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/hash-tables");
    const insertRegion = page.getByRole("region", { name: "Hash table insert", exact: true });
    const stepForward = insertRegion.getByRole("button", { name: /Step forward/ });
    const reset = insertRegion.getByRole("button", { name: /Reset/ });
    const counters = insertRegion.locator("dl");

    for (let i = 0; i < 6; i++) await stepForward.click();
    await reset.click();
    await expect(counters).toContainText(/Probes\s*0/);
    await expect(counters).toContainText(/Placed\s*0/);
    await expect(counters).toContainText(/Overwrites\s*0/);
  });

  test("the search section has its own targets list and counter triplet", async ({ page }) => {
    await page.goto("/lessons/data-structures/hash-tables");
    const searchRegion = page.getByRole("region", { name: "Hash table search", exact: true });
    // Match the title strip's comma-separated form (won't collide with the
    // single `def get(self, key):` line in the Python snippet).
    await expect(searchRegion.getByText(/get\(1\), get\(17\)/)).toBeVisible();
    const counters = searchRegion.locator("dl");
    await expect(counters).toContainText(/Probes\s*0/);
    await expect(counters).toContainText(/Found\s*0/);
    await expect(counters).toContainText(/Misses\s*0/);
  });

  test("stepping the search viz eventually ticks Found", async ({ page }) => {
    await page.goto("/lessons/data-structures/hash-tables");
    const searchRegion = page.getByRole("region", { name: "Hash table search", exact: true });
    const stepForward = searchRegion.getByRole("button", { name: /Step forward/ });
    const counters = searchRegion.locator("dl");

    // First search target is 1 (head-of-chain hit): begin → hash → probe → found = 4 clicks.
    for (let i = 0; i < 8; i++) {
      await stepForward.click();
      const text = (await counters.textContent()) ?? "";
      if (/Found\s*[1-9]/.test(text)) break;
    }
    await expect(counters).toContainText(/Found\s*[1-9]/);
  });

  test("the delete section renders with the unlink-oriented counter triplet", async ({ page }) => {
    await page.goto("/lessons/data-structures/hash-tables");
    const deleteRegion = page.getByRole("region", { name: "Hash table delete", exact: true });
    // Match the title strip's comma-separated form (won't collide with the
    // single `def remove(self, key):` line in the Python snippet).
    await expect(deleteRegion.getByText(/remove\(9\), remove\(25\)/)).toBeVisible();
    const counters = deleteRegion.locator("dl");
    await expect(counters).toContainText(/Probes\s*0/);
    await expect(counters).toContainText(/Removed\s*0/);
    await expect(counters).toContainText(/Misses\s*0/);
  });

  test("stepping the delete viz eventually ticks Removed (a full unlink completes)", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/hash-tables");
    const deleteRegion = page.getByRole("region", { name: "Hash table delete", exact: true });
    const stepForward = deleteRegion.getByRole("button", { name: /Step forward/ });
    const counters = deleteRegion.locator("dl");

    // First delete target is 9 (middle of chain): begin, hash, probe(1), probe(9),
    // found, unlink = 6 clicks. Budget slack.
    for (let i = 0; i < 12; i++) {
      await stepForward.click();
      const text = (await counters.textContent()) ?? "";
      if (/Removed\s*[1-9]/.test(text)) break;
    }
    await expect(counters).toContainText(/Removed\s*[1-9]/);
  });
});
