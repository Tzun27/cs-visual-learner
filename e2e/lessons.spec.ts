import { test, expect, type Page } from "@playwright/test";

const lessons = [
  { slug: "bubble-sort", title: "Bubble Sort" },
  { slug: "insertion-sort", title: "Insertion Sort" },
  { slug: "merge-sort", title: "Merge Sort" },
  { slug: "quick-sort", title: "Quick Sort" },
  { slug: "heap-sort", title: "Heap Sort" },
  { slug: "radix-sort", title: "Radix Sort" },
] as const;

async function gotoLesson(page: Page, slug: string) {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      consoleErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto(`/lessons/sorting/${slug}`);
  return consoleErrors;
}

for (const { slug, title } of lessons) {
  test.describe(`/lessons/sorting/${slug}`, () => {
    test("renders heading, viz, and full controls toolbar", async ({ page }) => {
      const errors = await gotoLesson(page, slug);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByRole("region", { name: /Sorting visualization/ })).toBeVisible();
      const toolbar = page.getByRole("toolbar", { name: /Playback controls/ });
      await expect(toolbar).toBeVisible();
      await expect(toolbar.getByRole("button", { name: /Step forward/ })).toBeVisible();
      await expect(toolbar.getByRole("button", { name: /Step backward/ })).toBeVisible();
      await expect(toolbar.getByRole("button", { name: /Reset/ })).toBeVisible();
      expect(errors).toEqual([]);
    });

    test("Step forward advances at least one counter; Reset returns to zero", async ({ page }) => {
      await gotoLesson(page, slug);
      const stepForward = page.getByRole("button", { name: /Step forward/ });
      const reset = page.getByRole("button", { name: /Reset/ });
      const counters = page.locator("dl");

      // Comparisons-or-Swaps because radix sort is non-comparison-based and
      // only emits writes (counted under Swaps).
      const advanced = /(Comparisons|Swaps)\s*[1-9]/;

      await expect(counters).toContainText(/Comparisons\s*0/);
      await stepForward.click();
      // Some algorithms emit a 'range' or 'pivot' before any comparison/write;
      // click up to a few times so a counter reliably shows ≥ 1.
      for (let i = 0; i < 6; i++) {
        const text = (await counters.textContent()) ?? "";
        if (advanced.test(text)) break;
        await stepForward.click();
      }
      await expect(counters).toContainText(advanced);

      await reset.click();
      await expect(counters).toContainText(/Comparisons\s*0/);
      await expect(counters).toContainText(/Swaps\s*0/);
      await expect(counters).toContainText(/idle/i);
    });
  });
}
