import { test, expect, type Page } from "@playwright/test";

/**
 * MID_BAKE Lab E2E (Issue #795, stage C-3). The Lab is the DEV / Preview-only independent screen `?dev=midbake`
 * (src/components/midBakeLab, entry in src/main.tsx); it loads no App and no save. Runs under both viewport projects
 * (390x844 / 360x800, Chromium and WebKit) with REAL timers: the needle must stop at the window start, the tray must open only
 * while it is stopped, and every operation must resolve to the same additions. `hold=` shortens the provisional timeout.
 */
const LAB = "./?dev=midbake";

async function open(page: Page, query = "") {
  await page.goto(`${LAB}${query}`);
  await page.waitForSelector("[data-mid-bake-lab]");
}
const status = (page: Page) => page.getByTestId("lab-status").getAttribute("data-lab-status");
const waitHolding = (page: Page) => expect(page.getByTestId("lab-status")).toHaveAttribute("data-lab-status", "holding", { timeout: 6000 });
const gaugePos = async (page: Page) => Number(await page.getByTestId("lab-gauge").getAttribute("data-lab-position"));

test.describe("MID_BAKE Lab (#795 C-3)", () => {
  test("the needle stops at the window start and the tray is closed until then", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("lab-chip-natto")).toBeDisabled();
    expect(await status(page)).toBe("running");
    await waitHolding(page);
    expect(await gaugePos(page)).toBeCloseTo(65, 1);
    await expect(page.getByTestId("lab-chip-natto")).toBeEnabled();
    // The needle really is frozen while holding.
    const a = await gaugePos(page);
    await page.waitForTimeout(400);
    expect(await gaugePos(page)).toBe(a);
  });

  test("two taps release the hold, the bake resumes and ends complete", async ({ page }) => {
    await open(page);
    await waitHolding(page);
    await page.getByTestId("lab-chip-natto").click();
    await page.getByTestId("lab-chip-natto").click();
    await expect(page.getByTestId("lab-chip-natto")).toBeDisabled();
    await expect(page.getByTestId("lab-result")).toHaveAttribute("data-lab-completion", "complete", { timeout: 8000 });
    await expect(page.getByTestId("lab-log")).toContainText("accepted=2");
    await expect(page.getByTestId("lab-log")).toContainText("released=complete");
  });

  test("'とじる' with one piece ends the hold and the bake reports a miss", async ({ page }) => {
    await open(page);
    await waitHolding(page);
    await page.getByTestId("lab-chip-natto").click();
    await page.getByTestId("lab-close").click();
    await expect(page.getByTestId("lab-result")).toHaveAttribute("data-lab-completion", "missing-additions", { timeout: 8000 });
    await expect(page.getByTestId("lab-log")).toContainText("released=closed");
  });

  test("the hold timeout resumes by itself and the tray stays closed afterwards", async ({ page }) => {
    await open(page, "&hold=2500");
    await waitHolding(page);
    await expect(page.getByTestId("lab-status")).not.toHaveAttribute("data-lab-status", "holding", { timeout: 6000 });
    await expect(page.getByTestId("lab-chip-natto")).toBeDisabled();
    await expect(page.getByTestId("lab-result")).toHaveAttribute("data-lab-completion", "missing-additions", { timeout: 8000 });
    await expect(page.getByTestId("lab-log")).toContainText("released=timeout");
  });

  test("the alternative control adds through the same path (same counts, labelled as alternative)", async ({ page }) => {
    await open(page);
    await waitHolding(page);
    await page.getByTestId("lab-alt").locator("summary").click();
    await page.getByTestId("lab-alt-natto").click();
    await page.getByTestId("lab-alt-natto").click();
    await expect(page.getByTestId("lab-result")).toHaveAttribute("data-lab-completion", "complete", { timeout: 8000 });
    await expect(page.getByTestId("lab-log")).toContainText("alternative 2");
  });

  test("the screen fits the viewport without page scroll and the tap targets are at least 44px", async ({ page }) => {
    await open(page);
    await waitHolding(page);
    const m = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      overflowY: document.documentElement.scrollHeight - window.innerHeight,
    }));
    expect(m.overflowX).toBeLessThanOrEqual(0);
    expect(m.overflowY).toBeLessThanOrEqual(0);
    for (const id of ["lab-chip-natto", "lab-close"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.height, id).toBeGreaterThanOrEqual(44);
      expect(box!.width, id).toBeGreaterThanOrEqual(44);
    }
  });

  test("the Lab never touches the real save", async ({ page }) => {
    await open(page);
    await waitHolding(page);
    await page.getByTestId("lab-chip-natto").click();
    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys).toEqual([]);
  });
});
