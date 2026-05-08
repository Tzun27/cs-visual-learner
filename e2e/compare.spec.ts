import { test, expect } from "@playwright/test";

test.describe("/lessons/sorting/compare", () => {
  test("renders the heading, three slots, and the playback toolbar", async ({ page }) => {
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

    await page.goto("/lessons/sorting/compare");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Compare Sorting Algorithms/);
    await expect(page.getByRole("region", { name: /Sorting algorithm race/ })).toBeVisible();

    const slots = page.getByLabel(/race slot$/);
    await expect(slots).toHaveCount(3);

    const toolbar = page.getByRole("toolbar", { name: /Playback controls/ });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /Step forward/ })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("step forward advances every slot; reset returns to step 0", async ({ page }) => {
    await page.goto("/lessons/sorting/compare");
    const stepForward = page.getByRole("button", { name: /Step forward/ });
    const reset = page.getByRole("button", { name: /Reset/ });
    const slots = page.getByLabel(/race slot$/);

    await expect(slots.first()).toContainText(/Step\s*0\/\d+/);
    await stepForward.click();
    for (let i = 0; i < 3; i++) {
      await expect(slots.nth(i)).toContainText(/Step\s*1\/\d+/);
    }
    await reset.click();
    for (let i = 0; i < 3; i++) {
      await expect(slots.nth(i)).toContainText(/Step\s*0\/\d+/);
    }
  });

  test("changing a slot's algorithm via dropdown updates the slot label", async ({ page }) => {
    await page.goto("/lessons/sorting/compare");
    const slot1 = page.getByLabel("Algorithm for slot 1");
    await slot1.selectOption("heap");
    await expect(page.getByLabel(/Heap Sort race slot/)).toBeVisible();
  });
});
