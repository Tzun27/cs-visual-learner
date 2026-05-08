import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/",
  "/lessons",
  "/lessons/sorting/bubble-sort",
  "/lessons/sorting/compare",
] as const;

for (const route of routes) {
  test(`axe-core finds no WCAG 2.1 AA violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
