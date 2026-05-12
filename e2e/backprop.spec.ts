import { test, expect } from "@playwright/test";

test.describe("/lessons/ml/backprop", () => {
  test("renders heading, viz region, math toggle, and no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/ml/backprop");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Backpropagation/);

    const region = page.getByRole("region", { name: /Backpropagation visualization/ });
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
    await page.goto("/lessons/ml/backprop");

    await expect(page.getByText(/blamed/)).toBeVisible();
    await expect(page.getByText(/directed computation graph/)).toHaveCount(0);

    await page
      .getByRole("group", { name: /Math level/ })
      .getByRole("button", { name: "With math" })
      .click();

    await expect(page.getByText(/blamed/)).toHaveCount(0);
    await expect(page.getByText(/directed computation graph/)).toBeVisible();
  });

  test("Run to end reaches the 'Done' annotation", async ({ page }) => {
    await page.goto("/lessons/ml/backprop");
    const region = page.getByRole("region", { name: /Backpropagation visualization/ });
    await region.getByRole("button", { name: /Run to end/ }).click();
    await expect(region.getByText(/Done — one full step/)).toBeVisible({ timeout: 30_000 });
  });

  test("step-forward through ten clicks ends with apply-update + done state", async ({ page }) => {
    await page.goto("/lessons/ml/backprop");
    const region = page.getByRole("region", { name: /Backpropagation visualization/ });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 10; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(region.getByText(/Done — one full step/)).toBeVisible();
  });
});
