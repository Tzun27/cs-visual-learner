import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/tree-traversal", () => {
  test("renders heading, viz region, mode toggle, sequence strip, and toolbar", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/tree-traversal");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Tree Traversal/);

    const region = page.getByRole("region", {
      name: "Tree traversal visualization",
      exact: true,
    });
    await expect(region).toBeVisible();

    const modeToggle = region.getByRole("group", { name: /Traversal mode/ });
    await expect(modeToggle).toBeVisible();
    for (const label of ["Preorder", "Inorder", "Postorder", "Level-order"]) {
      await expect(modeToggle.getByRole("button", { name: label })).toBeVisible();
    }

    await expect(region.getByRole("group", { name: /Visited sequence/ })).toBeVisible();

    const toolbar = region.getByRole("toolbar", { name: /Playback controls/ });
    await expect(toolbar.getByRole("button", { name: /Step forward/ })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("stepping the preorder viz appends 4 (root) as the first sequence entry", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/tree-traversal");
    const region = page.getByRole("region", {
      name: "Tree traversal visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const sequence = region.getByRole("group", { name: /Visited sequence/ });

    await expect(sequence).toContainText(/\(empty\)/);
    // Preorder is the default. begin → visit(root=4) = 2 clicks to see "4".
    await stepForward.click();
    await stepForward.click();
    await expect(region.getByRole("list")).toContainText("4");
  });

  test("toggling Inorder swaps the source code and resets the sequence to empty", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/tree-traversal");
    const region = page.getByRole("region", {
      name: "Tree traversal visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });

    // Make some progress in preorder.
    for (let i = 0; i < 3; i++) await stepForward.click();
    const sequence = region.getByRole("group", { name: /Visited sequence/ });

    const inorderBtn = region.getByRole("button", { name: "Inorder", exact: true });
    await expect(inorderBtn).toHaveAttribute("aria-pressed", "false");
    await inorderBtn.click();
    await expect(inorderBtn).toHaveAttribute("aria-pressed", "true");
    await expect(sequence).toContainText(/\(empty\)/);

    // Inorder on this tree visits 1 first (deepest left). begin → visit(1) — 2 clicks.
    await stepForward.click();
    await stepForward.click();
    await expect(region.getByRole("list")).toContainText("1");
  });

  test("stepping to completion (preorder) yields all seven values", async ({ page }) => {
    await page.goto("/lessons/data-structures/tree-traversal");
    const region = page.getByRole("region", {
      name: "Tree traversal visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    // 1 begin + 7 visit + 1 done = 9 steps. Stop early if the button disables.
    for (let i = 0; i < 12; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Visits\s*7/);
    await expect(counters).toContainText(/Remaining\s*0/);
  });

  test("Reset clears the sequence and returns counters to zero", async ({ page }) => {
    await page.goto("/lessons/data-structures/tree-traversal");
    const region = page.getByRole("region", {
      name: "Tree traversal visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 5; i++) await stepForward.click();
    await reset.click();
    await expect(counters).toContainText(/Visits\s*0/);
    await expect(counters).toContainText(/Remaining\s*7/);
    await expect(region.getByRole("group", { name: /Visited sequence/ })).toContainText(
      /\(empty\)/,
    );
  });
});
