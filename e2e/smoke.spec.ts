import { test, expect } from "@playwright/test";

// Asserts structural contracts only — never specific landing copy. The two
// CTAs link to lessons and the bubble-sort entry point, both functionally
// load-bearing. The H1 carries id="hero-title" which is the stable anchor;
// we check that anchor renders with non-empty text. If hero copy changes,
// this test should NOT need an update.
test("home page renders with hero heading and primary CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
  const hero = page.locator("#hero-title");
  await expect(hero).toBeVisible();
  await expect(hero).not.toHaveText("");
  await expect(page.getByRole("link", { name: /Browse lessons/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start with bubble sort/ })).toBeVisible();
});
