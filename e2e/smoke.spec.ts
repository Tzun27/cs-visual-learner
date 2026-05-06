import { test, expect } from "@playwright/test";

test("home page renders with hero heading and primary CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/CS Concept Visualizer/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Learn computer science/);
  await expect(page.getByRole("link", { name: /Browse lessons/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start with bubble sort/ })).toBeVisible();
});
