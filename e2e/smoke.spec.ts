import { test, expect } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/CS Concept Visualizer/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CS Concept Visualizer");
});
