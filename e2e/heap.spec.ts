import { test, expect } from "@playwright/test";

test.describe("/lessons/data-structures/heap", () => {
  test("renders heading and both viz regions with their own toolbars", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (response) => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto("/lessons/data-structures/heap");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Heaps & Priority Queues/);

    const insertRegion = page.getByRole("region", {
      name: "Min-heap insert visualization",
      exact: true,
    });
    await expect(insertRegion).toBeVisible();
    await expect(insertRegion.getByRole("group", { name: /Insert order/ })).toBeVisible();
    await expect(
      insertRegion.getByRole("toolbar", { name: /Playback controls/ }).getByRole("button", {
        name: /Step forward/,
      }),
    ).toBeVisible();

    const heapifyRegion = page.getByRole("region", {
      name: "Min-heap heapify visualization",
      exact: true,
    });
    await expect(heapifyRegion).toBeVisible();
    await expect(
      heapifyRegion.getByRole("toolbar", { name: /Playback controls/ }).getByRole("button", {
        name: /Step forward/,
      }),
    ).toBeVisible();

    const extractRegion = page.getByRole("region", {
      name: "Min-heap extract-min visualization",
      exact: true,
    });
    await expect(extractRegion).toBeVisible();
    await expect(extractRegion.getByRole("group", { name: /Extracted minimums/ })).toBeVisible();
    await expect(
      extractRegion.getByRole("toolbar", { name: /Playback controls/ }).getByRole("button", {
        name: /Step forward/,
      }),
    ).toBeVisible();

    const decreaseRegion = page.getByRole("region", {
      name: "Min-heap decrease-key visualization",
      exact: true,
    });
    await expect(decreaseRegion).toBeVisible();
    await expect(
      decreaseRegion.getByRole("toolbar", { name: /Playback controls/ }).getByRole("button", {
        name: /Step forward/,
      }),
    ).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("stepping the heapify viz eventually ticks Sift-down passes and Swaps", async ({ page }) => {
    await page.goto("/lessons/data-structures/heap");
    const region = page.getByRole("region", {
      name: "Min-heap heapify visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    await expect(counters).toContainText(/Sift-down passes\s*0/);
    await expect(counters).toContainText(/Swaps\s*0/);

    // n=9 input → 4 sift-down passes max; click enough to reach the first pass.
    for (let i = 0; i < 30; i++) {
      await stepForward.click();
      const text = (await counters.textContent()) ?? "";
      if (/Sift-down passes\s*[1-9]/.test(text)) break;
    }
    await expect(counters).toContainText(/Sift-down passes\s*[1-9]/);
  });

  test("running the heapify viz to completion produces the expected counts (4 passes)", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/heap");
    const region = page.getByRole("region", {
      name: "Min-heap heapify visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // n=9 input → floor(9/2) = 4 sift-down passes (one per internal node).
    await expect(counters).toContainText(/Sift-down passes\s*4/);
  });

  test("stepping the insert viz eventually ticks Comparisons or Swaps; Reset returns to zero", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/heap");
    const region = page.getByRole("region", {
      name: "Min-heap insert visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const reset = region.getByRole("button", { name: /Reset/ });
    const counters = region.locator("dl");

    await expect(counters).toContainText(/Comparisons\s*0/);
    await expect(counters).toContainText(/Heap size\s*0/);

    const advanced = /(Comparisons|Swaps)\s*[1-9]/;
    for (let i = 0; i < 10; i++) {
      await stepForward.click();
      const text = (await counters.textContent()) ?? "";
      if (advanced.test(text)) break;
    }
    await expect(counters).toContainText(advanced);

    await reset.click();
    await expect(counters).toContainText(/Comparisons\s*0/);
    await expect(counters).toContainText(/Swaps\s*0/);
    await expect(counters).toContainText(/Heap size\s*0/);
  });

  test("toggling 'New minimum each time' activates the pressed state and resets counters", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/heap");
    const region = page.getByRole("region", {
      name: "Min-heap insert visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 3; i++) await stepForward.click();

    const descBtn = region.getByRole("button", { name: /New minimum each time/ });
    await expect(descBtn).toHaveAttribute("aria-pressed", "false");
    await descBtn.click();
    await expect(descBtn).toHaveAttribute("aria-pressed", "true");
    await expect(region.locator("dl")).toContainText(/Heap size\s*0/);
  });

  test("stepping the extract-min viz appends 1 (the minimum) as the first extracted value", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/heap");
    const region = page.getByRole("region", {
      name: "Min-heap extract-min visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const extractedGroup = region.getByRole("group", { name: /Extracted minimums/ });

    await expect(extractedGroup).toContainText(/\(none yet\)/);

    // begin → take-root = 2 clicks before the extracted list shows the first value.
    for (let i = 0; i < 12; i++) {
      await stepForward.click();
      const text = (await extractedGroup.textContent()) ?? "";
      if (/\b1\b/.test(text)) break;
    }
    await expect(extractedGroup.getByRole("list")).toContainText("1");
  });

  test("running the extract-min viz to completion extracts four values in ascending order", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/heap");
    const region = page.getByRole("region", {
      name: "Min-heap extract-min visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    // Step through until the button disables.
    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    await expect(counters).toContainText(/Extracted\s*4/);
    const extractedItems = region
      .getByRole("group", { name: /Extracted minimums/ })
      .getByRole("listitem");
    await expect(extractedItems).toHaveText(["1", "2", "3", "4"]);
  });

  test("running the decrease-key viz to completion produces 3 compares + 2 swaps + 2 ops", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/heap");
    const region = page.getByRole("region", {
      name: "Min-heap decrease-key visualization",
      exact: true,
    });
    const stepForward = region.getByRole("button", { name: /Step forward/ });
    const counters = region.locator("dl");

    for (let i = 0; i < 80; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // decrease(6, 2): 2 compares + 2 swaps. decrease(4, 10): 1 compare + 0 swaps.
    // Two begin steps = 2 ops total.
    await expect(counters).toContainText(/Comparisons\s*3/);
    await expect(counters).toContainText(/Swaps\s*2/);
    await expect(counters).toContainText(/Operations\s*2/);
  });

  test("interactive decrease_key: picking an index + new value runs the algorithm", async ({
    page,
  }) => {
    await page.goto("/lessons/data-structures/heap");
    const region = page.getByRole("region", { name: "Interactive decrease_key", exact: true });
    await expect(region).toBeVisible();

    const indexButtons = region.getByRole("group", { name: /Heap node index buttons/ });
    await expect(indexButtons).toBeVisible();
    // Click the index-5 button (value 8 in the demo heap).
    const fifthButton = indexButtons.getByRole("button").nth(5);
    await fifthButton.click();
    await expect(fifthButton).toHaveAttribute("aria-pressed", "true");

    // Default new-value draft auto-fills to current - 1. Override to 1
    // so siftUp bubbles to the root for a clear animation.
    const newValueInput = region.getByLabel(/New value for the selected node/);
    await newValueInput.fill("1");

    const runButton = region.getByRole("button", { name: /Run decrease_key/ });
    await expect(runButton).toBeEnabled();
    await runButton.click();

    // After Run, the playback controls take over. Step forward through
    // the entire trace.
    const stepForward = region
      .getByRole("toolbar", { name: /Playback controls/ })
      .getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 20; i++) {
      if (!(await stepForward.isEnabled())) break;
      await stepForward.click();
    }
    // Animation done. Step forward is disabled. The root button (index 0)
    // now shows the new minimum (1) — siftUp bubbled the decreased value
    // to the root because 1 < everything else along the path.
    await expect(stepForward).toBeDisabled();
    const rootButton = indexButtons.getByRole("button").nth(0);
    await expect(rootButton).toContainText("1");
  });
});
