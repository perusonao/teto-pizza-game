import { test, expect, type Page } from "@playwright/test";
import { runOnlyOnWidth } from "./support/projectGuard";

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

/**
 * Ported from the independently audited #832 (Owner decision: #834 is the adopted axis; #832 is not merged). Only checks that map onto the behaviour #834 already has
 * are ported -- take-out refusal, the stand-in stock knob and the Lab-wide timeout knob have no counterpart here and are NOT added (no unrequested features).
 */
test.describe("MID_BAKE Lab: storage isolation, entry exclusivity, short viewports (ported from #832)", () => {
  test("writes nothing to localStorage or sessionStorage across a whole round, including restart", async ({ page }) => {
    await open(page);
    await waitHolding(page);
    await page.getByTestId("lab-chip-natto").click();
    await page.getByTestId("lab-chip-natto").click();
    await expect(page.getByTestId("lab-result")).toBeVisible({ timeout: 8000 });
    await page.getByTestId("lab-restart").click();
    await expect(page.getByTestId("lab-status")).toHaveAttribute("data-lab-status", "running");
    const stored = await page.evaluate(() => ({ local: Object.keys(window.localStorage), session: Object.keys(window.sessionStorage) }));
    expect(stored).toEqual({ local: [], session: [] });
  });

  test("restart gives a fresh round (no pieces counted, tray closed, no result)", async ({ page }) => {
    await open(page);
    await waitHolding(page);
    await page.getByTestId("lab-chip-natto").click();
    await page.getByTestId("lab-close").click();
    await expect(page.getByTestId("lab-result")).toBeVisible({ timeout: 8000 });
    await page.getByTestId("lab-restart").click();
    await expect(page.getByTestId("lab-result")).toHaveCount(0);
    await expect(page.getByTestId("lab-chip-natto")).toBeDisabled();
    await expect(page.getByTestId("lab-chip-natto")).toContainText("0/2");
  });

  test("a hv= seed next to the Lab entry seeds nothing (the Lab never seeds the save)", async ({ page }) => {
    await open(page, "&hv=normal");
    await waitHolding(page);
    const keys = await page.evaluate(() => [...Object.keys(window.localStorage), ...Object.keys(window.sessionStorage)]);
    expect(keys).toEqual([]);
  });

  test("without the entry, with a wrong value, different case, or another dev entry, the Lab is not shown", async ({ page }) => {
    for (const query of ["", "?dev=", "?dev=midbake2", "?dev=MidBake", "?midbake=1", "?dev=postlayer", "?dev=state", "?cookMidBakeHv=1"]) {
      await page.goto(`./${query}`);
      await expect(page.locator("#root")).not.toBeEmpty();
      await expect(page.locator("[data-mid-bake-lab]"), query).toHaveCount(0);
    }
  });

  for (const forced of [
    { w: 390, h: 664 },
    { w: 360, h: 640 },
  ] as const) {
    test(`${forced.w}x${forced.h}: the Lab controls stay on screen at a short viewport`, async ({ page }, testInfo) => {
      runOnlyOnWidth(testInfo, forced.w);
      await page.setViewportSize({ width: forced.w, height: forced.h });
      await open(page);
      await waitHolding(page);
      const view = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, sw: document.documentElement.scrollWidth }));
      expect(view.sw).toBeLessThanOrEqual(view.w);
      for (const id of ["lab-gauge", "lab-chip-natto", "lab-close"]) {
        const box = await page.getByTestId(id).boundingBox();
        if (!box) throw new Error(`no box for ${id}`);
        expect(box.x, id).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, id).toBeLessThanOrEqual(view.w);
        expect(box.y, id).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, id).toBeLessThanOrEqual(view.h);
      }
      for (const id of ["lab-chip-natto", "lab-close"]) {
        expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

