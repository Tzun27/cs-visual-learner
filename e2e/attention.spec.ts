import { test, expect } from "@playwright/test";

test.describe("/lessons/ml/attention", () => {
  test("renders heading, viz region, math toggle, and no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/ml/attention");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Attention/);

    const region = page.getByRole("region", { name: /Attention head visualization/ });
    await expect(region).toBeVisible();
    await expect(region.getByRole("button", { name: /Step forward/ })).toBeVisible();
    await expect(region.getByRole("button", { name: /Run to end/ })).toBeVisible();

    const mathToggle = page.getByRole("group", { name: /Math level/ });
    await expect(mathToggle).toBeVisible();
    await expect(mathToggle.getByRole("button", { name: "Intuition" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    expect(consoleErrors).toEqual([]);
  });

  test("toggling math level swaps prose blocks", async ({ page }) => {
    await page.goto("/lessons/ml/attention");

    await expect(page.getByText(/asks every other token/)).toBeVisible();
    await expect(page.getByText(/Two design choices worth unpacking/)).toHaveCount(0);

    await page
      .getByRole("group", { name: /Math level/ })
      .getByRole("button", { name: "With math" })
      .click();

    await expect(page.getByText(/asks every other token/)).toHaveCount(0);
    await expect(page.getByText(/Two design choices worth unpacking/)).toBeVisible();
  });

  test("Run to end reaches the 'Done' annotation", async ({ page }) => {
    await page.goto("/lessons/ml/attention");
    const region = page.getByRole("region", { name: /Attention head visualization/ });
    await region.getByRole("button", { name: /Run to end/ }).click();
    await expect(region.getByText(/Done — one full pass/)).toBeVisible({ timeout: 30_000 });
  });

  test("step-forward through nine clicks ends at done", async ({ page }) => {
    await page.goto("/lessons/ml/attention");
    const region = page.getByRole("region", { name: /Attention head visualization/ });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 9; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(region.getByText(/Done — one full pass/)).toBeVisible();
  });

  test("positional encoding viz renders and Run to end fills X′", async ({ page }) => {
    await page.goto("/lessons/ml/attention");
    const region = page.getByRole("region", { name: /Positional encoding visualization/ });
    await expect(region).toBeVisible();

    // Counter starts at "0 / 3" PE rows ready.
    await expect(region.getByText(/PE rows ready/)).toBeVisible();
    await expect(region.locator("dl")).toContainText(/PE rows ready\s*0\s*\/\s*3/);

    await region.getByRole("button", { name: /Run to end/ }).click();
    await expect(region.getByText(/Done\. X′ is what feeds/)).toBeVisible({ timeout: 30_000 });
    await expect(region.locator("dl")).toContainText(/PE rows ready\s*3\s*\/\s*3/);
  });

  test("causal attention viz runs to completion and lands on the next-token annotation", async ({
    page,
  }) => {
    await page.goto("/lessons/ml/attention");
    const region = page.getByRole("region", { name: /Causal attention visualization/ });
    await expect(region).toBeVisible();
    await expect(region.getByRole("button", { name: /Step forward/ })).toBeVisible();

    await region.getByRole("button", { name: /Run to end/ }).click();
    await expect(region.getByText(/causal attention preserves/)).toBeVisible({ timeout: 30_000 });
  });

  test("causal attention step-forward through ten clicks reaches done (mask-scores adds one step)", async ({
    page,
  }) => {
    await page.goto("/lessons/ml/attention");
    const region = page.getByRole("region", { name: /Causal attention visualization/ });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    // 10 steps total: begin + Q/K/V (3) + scores + scale + mask + softmax + weighted-sum + done.
    for (let i = 0; i < 10; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(region.getByText(/causal attention preserves/)).toBeVisible();
  });

  test("cross-attention viz renders and Run to end reaches the done annotation", async ({
    page,
  }) => {
    await page.goto("/lessons/ml/attention");
    // Exact name — the CodePanel sibling is "Cross-attention pseudocode",
    // so a loose regex would match two regions (strict-mode violation).
    const region = page.getByRole("region", {
      name: "Cross-attention visualization",
      exact: true,
    });
    await expect(region).toBeVisible();
    await expect(region.getByRole("button", { name: /Step forward/ })).toBeVisible();

    await region.getByRole("button", { name: /Run to end/ }).click();
    await expect(region.getByText(/decoder pulled context from the encoder/)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("cross-attention step-forward through nine clicks ends at done", async ({ page }) => {
    await page.goto("/lessons/ml/attention");
    const region = page.getByRole("region", {
      name: "Cross-attention visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    // 9 steps: begin + Q/K/V (3) + scores + scale + softmax + weighted-sum + done.
    for (let i = 0; i < 9; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(region.getByText(/decoder pulled context from the encoder/)).toBeVisible();
  });
});
