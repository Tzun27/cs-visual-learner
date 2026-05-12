import { test, expect } from "@playwright/test";

test.describe("/lessons/ml/gradient-descent", () => {
  test("renders heading, viz region, math toggle, and no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/ml/gradient-descent");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Gradient Descent/);

    const region = page.getByRole("region", { name: /Gradient descent visualization/ });
    await expect(region).toBeVisible();
    await expect(region.getByRole("button", { name: /Step forward/ })).toBeVisible();
    await expect(region.getByRole("button", { name: /Run to end/ })).toBeVisible();

    // Math toggle present + intuition mode is the default.
    const mathToggle = page.getByRole("group", { name: /Math level/ });
    await expect(mathToggle).toBeVisible();
    await expect(mathToggle.getByRole("button", { name: "Intuition" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    expect(consoleErrors).toEqual([]);
  });

  test("toggling math level swaps prose blocks", async ({ page }) => {
    await page.goto("/lessons/ml/gradient-descent");

    // Intuition prose is visible by default. Pick a phrase unique to that block.
    await expect(page.getByText(/Imagine standing on a hillside/)).toBeVisible();
    await expect(page.getByText(/Given a differentiable loss/)).toHaveCount(0);

    await page
      .getByRole("group", { name: /Math level/ })
      .getByRole("button", {
        name: "With math",
      })
      .click();

    await expect(page.getByText(/Imagine standing on a hillside/)).toHaveCount(0);
    await expect(page.getByText(/Given a differentiable loss/)).toBeVisible();
  });

  test("Run to end reaches a terminal state", async ({ page }) => {
    await page.goto("/lessons/ml/gradient-descent");
    const region = page.getByRole("region", { name: /Gradient descent visualization/ });
    await region.getByRole("button", { name: /Run to end/ }).click();
    await expect(region.getByText(/Converged|Stopped at max steps/)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("learning-rate switch resets Step counter", async ({ page }) => {
    await page.goto("/lessons/ml/gradient-descent");
    const region = page.getByRole("region", { name: /Gradient descent visualization/ });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 4; i++) await stepForward.click();

    await region.getByRole("button", { name: /0\.15 \(brisk\)/ }).click();
    await expect(region.locator("dl")).toContainText(/Step\s*0/);
  });
});
