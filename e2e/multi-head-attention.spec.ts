import { test, expect } from "@playwright/test";

test.describe("/lessons/ml/multi-head-attention", () => {
  test("renders heading, viz region, math toggle, and no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/ml/multi-head-attention");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Multi-Head Attention/);

    const region = page.getByRole("region", { name: /Multi-head attention visualization/ });
    await expect(region).toBeVisible();
    await expect(region.getByRole("button", { name: /Step forward/ })).toBeVisible();
    await expect(region.getByRole("button", { name: /Run to end/ })).toBeVisible();

    const mathToggle = page.getByRole("group", { name: /Math level/ });
    await expect(mathToggle).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("toggling math level swaps prose blocks", async ({ page }) => {
    await page.goto("/lessons/ml/multi-head-attention");

    // The intuition prose contains the bank/loan motivating example.
    await expect(page.getByText(/bank approved the loan/)).toBeVisible();
    // The math prose contains the per-head matrix dimensions.
    await expect(page.getByText(/h triples of/)).toHaveCount(0);

    await page
      .getByRole("group", { name: /Math level/ })
      .getByRole("button", { name: "With math" })
      .click();

    await expect(page.getByText(/bank approved the loan/)).toHaveCount(0);
    await expect(page.getByText(/h triples of/)).toBeVisible();
  });

  test("Run to end reaches the 'Done' annotation after 18 steps total", async ({ page }) => {
    await page.goto("/lessons/ml/multi-head-attention");
    const region = page.getByRole("region", { name: /Multi-head attention visualization/ });
    await region.getByRole("button", { name: /Run to end/ }).click();
    await expect(region.getByText(/Done — one full multi-head attention pass/)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("active-head counter ticks from head 1 to head 2 as the cursor advances", async ({
    page,
  }) => {
    await page.goto("/lessons/ml/multi-head-attention");
    const region = page.getByRole("region", { name: /Multi-head attention visualization/ });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    // Two clicks: stepIndex = 1 = head 1's project-q (head 0's first step).
    await stepForward.click();
    await stepForward.click();
    await expect(counters).toContainText(/Active head\s*head 1/);

    // Seven more clicks (9 total): stepIndex = 8 = head 2's project-q (head 1 begins).
    for (let i = 0; i < 7; i++) await stepForward.click();
    await expect(counters).toContainText(/Active head\s*head 2/);
  });

  test("step-forward through the full sequence ends at done", async ({ page }) => {
    await page.goto("/lessons/ml/multi-head-attention");
    const region = page.getByRole("region", { name: /Multi-head attention visualization/ });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 25; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(region.getByText(/Done — one full multi-head attention pass/)).toBeVisible();
  });
});
