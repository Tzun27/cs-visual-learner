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
    await expect(
      page.getByRole("region", { name: /Binary search tree visualization/ }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: /Insert order/ })).toBeVisible();
    const toolbar = page.getByRole("toolbar", { name: /Playback controls/ });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /Step forward/ })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("step forward advances comparisons or placed; reset returns to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/binary-search-tree");
    const stepForward = page.getByRole("button", { name: /Step forward/ });
    const reset = page.getByRole("button", { name: /Reset/ });
    const counters = page.locator("dl");

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
    const stepForward = page.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 4; i++) await stepForward.click();
    const sortedBtn = page.getByRole("button", { name: /Sorted order/ });
    await expect(sortedBtn).toHaveAttribute("aria-pressed", "false");
    await sortedBtn.click();
    await expect(sortedBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("dl")).toContainText(/Placed\s*0/);
  });
});
