import { test, expect, type Page } from "@playwright/test";

/**
 * Discovery Progression Inspector bugfix: the game shell (index.css) locks html/body/#root to a fixed
 * height with `overflow: hidden`, so the Inspector (`?inspector=discovery`, DEV / Preview only) must be its
 * own vertical scroll container. Real-browser layout test (jsdom cannot see scrolling), run at 390×844 and
 * 360×800 on Chromium and WebKit. Read-only: the Inspector never writes the save.
 */

const URL = "/teto-pizza-game/?inspector=discovery";

async function openInspector(page: Page) {
  await page.goto(URL);
  await expect(page.locator("[data-inspector]")).toBeVisible();
  await expect(page.getByTestId("dpi-step-count")).toHaveText("26"); // 24 W1 steps + No.27's step 25 + Expansion Slice 1's step 26
}

/** Scrolls the Inspector's own scroller to the bottom the way a finger would end up, and reports it. */
async function scrollState(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-inspector]")!;
    const before = el.scrollTop;
    el.scrollTop = el.scrollHeight;
    return {
      before,
      after: el.scrollTop,
      scrollable: el.scrollHeight > el.clientHeight + 1,
      hOverflow: el.scrollWidth > el.clientWidth + 1 || document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

async function expectLastStepReachable(page: Page) {
  const s = await scrollState(page);
  expect(s.scrollable).toBe(true);
  expect(s.after).toBeGreaterThan(s.before);
  expect(s.hOverflow).toBe(false);
  await expect(page.getByTestId("dpi-row-26")).toBeInViewport();
  await expect(page.getByTestId("dpi-row-1")).not.toBeInViewport();
}

test("Inspector scrolls from Step 1 to Step 26", async ({ page }) => {
  await openInspector(page);
  await expect(page.getByTestId("dpi-row-1")).toBeInViewport();
  await expectLastStepReachable(page);
});

test("Inspector still scrolls after the search box and a filter chip, and with a row expanded", async ({ page }) => {
  await openInspector(page);
  const chips = page.locator(".dpi__filter");
  await chips.nth(1).click();
  await chips.nth(0).click();
  await page.getByLabel("search").fill("egg");
  await page.getByLabel("search").fill("");
  await expect(page.getByTestId("dpi-visible-count")).toContainText("26 / 26");
  await page.getByTestId("dpi-row-1").locator("button").first().click();
  await page.locator("[data-inspector]").evaluate((el) => (el.scrollTop = 0));
  await expectLastStepReachable(page);
});

test("the game shell's scroll lock is unchanged: the normal app has no scrolling document", async ({ page }) => {
  await page.goto("/teto-pizza-game/");
  await page.waitForSelector(".app-frame");
  const r = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflow,
    body: getComputedStyle(document.body).overflow,
    root: getComputedStyle(document.getElementById("root")!).overflow,
    inspector: document.querySelector("[data-inspector]") !== null,
  }));
  expect(r).toEqual({ html: "hidden", body: "hidden", root: "hidden", inspector: false });
});
