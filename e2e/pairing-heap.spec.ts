import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/pairing-heap", () => {
  test("renders heading, two viz regions, and their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/pairing-heap");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Pairing Heap/);

    for (const name of ["Pairing-heap merge", "Pairing-heap delete-min"]) {
      const region = page.getByRole("region", { name, exact: true });
      await expect(region).toBeVisible();
      await expect(
        region.getByRole("toolbar", { name: /Playback controls/ }).getByRole("button", {
          name: /Step forward/,
        }),
      ).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test("merge viz steps through to a single-root heap", async ({ page }) => {
    await page.goto("/lessons/data-structures/pairing-heap");
    const region = page.getByRole("region", { name: "Pairing-heap merge", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 10; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(stepForward).toBeDisabled();
    // Final aria-label mentions a single-root heap with 5 nodes.
    const svg = region.getByRole("img");
    await expect(svg).toHaveAttribute("aria-label", /5 nodes/);
  });

  test("delete-min viz produces 2 pair-links + 1 fold-link", async ({ page }) => {
    await page.goto("/lessons/data-structures/pairing-heap");
    const region = page.getByRole("region", { name: "Pairing-heap delete-min", exact: true });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 20; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Pair-links \(pass 1\)\s*2/);
    await expect(counters).toContainText(/Fold-links \(pass 2\)\s*1/);
  });
});
