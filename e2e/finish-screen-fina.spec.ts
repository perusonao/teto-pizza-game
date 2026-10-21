import { expect, test, type Page } from "@playwright/test";

/**
 * FINISH FIN-A (Issue #294): the real GameScreen at the FINISH step (e2e/harness/finish-screen.html, the test-only BBQ-shaped fixture
 * recipe driven through the real reducer). Measured at 390x844 and 360x800 (the two projects): the 仕上げ tab, Mito's hint row, the
 * stage and the post-bake layer all fit on one screen without page scroll. FIN-B adds the tray (see finish-tray-finb.spec.ts); 1つ戻す and the
 * completion control are FIN-C and are not there. Production does not reach this screen: no shipped profile has FINISH (src/state/finishD2Inert.test.ts).
 */
const HARNESS = "./e2e/harness/finish-screen.html";

async function open(page: Page, query = "") {
  await page.goto(`${HARNESS}?${query}`);
  await page.waitForSelector(".game-screen, .app-frame");
  await page.waitForTimeout(300);
}

for (const bake of ["raw", "perfect", "burnt"]) {
  test(`FINISH (${bake}): tab, hint, compact stage and post layer fit the screen with no page scroll`, async ({ page }) => {
    await open(page, `bake=${bake}&post=3`);
    const viewport = page.viewportSize()!;
    await expect(page.getByRole("tab", { name: "仕上げ" })).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("finish-hint")).toBeVisible();
    await expect(page.locator(".pizza-stage--compact")).toHaveCount(1);
    await expect(page.locator(".pizza-post-layer")).toHaveCount(1);
    const m = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)?.getBoundingClientRect();
      const dough = r(".pizza-dough")!;
      const stage = r(".pizza-stage")!;
      const tabs = r(".making-step-tabs")!;
      const hint = r(".order-card")!;
      return {
        scrollW: document.documentElement.scrollWidth,
        scrollH: document.documentElement.scrollHeight,
        dough: [dough.x, dough.y, dough.width, dough.height],
        doughInsideStage: dough.left >= stage.left - 0.5 && dough.right <= stage.right + 0.5 && dough.top >= stage.top - 0.5 && dough.bottom <= stage.bottom + 0.5,
        tabsRight: tabs.right,
        hintBottom: hint.bottom,
        stageTop: stage.top,
        tabs: Array.from(document.querySelectorAll(".making-step-tab")).map((t) => { const b = t.getBoundingClientRect(); return [b.left, b.right]; }),
      };
    });
    expect(m.scrollW).toBeLessThanOrEqual(viewport.width);
    expect(m.scrollH).toBeLessThanOrEqual(viewport.height);
    expect(m.doughInsideStage).toBe(true);
    expect(m.hintBottom).toBeLessThanOrEqual(m.stageTop + 0.5); // the hint row sits above the stage, not over it
    for (const [l, r] of m.tabs) {
      expect(l).toBeGreaterThanOrEqual(-0.5);
      expect(r).toBeLessThanOrEqual(viewport.width + 0.5);
    }
    expect(m.dough[2]).toBeGreaterThan(viewport.width * 0.6); // the compact (tray) stage keeps the pizza large
  });
}

test("FINISH: nothing from FIN-C is on the screen (no 1つ戻す, no completion control)", async ({ page }) => {
  await open(page, "post=2");
  await expect(page.getByRole("button", { name: "1つ戻す" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /次へ|焼く！|完成/ })).toHaveCount(0);
});

test("FINISH: the hint follows the pieces placed (name the late ingredient, then 'done')", async ({ page }) => {
  await open(page, "post=0");
  await expect(page.getByTestId("finish-hint")).toHaveText("パセリを仕上げにのせよう！");
  await open(page, "post=2");
  await expect(page.getByTestId("finish-hint")).toContainText("仕上げはここまで！");
});

test("FINISH with CUT after it: the CUT tab is locked and cannot advance the round", async ({ page }) => {
  await open(page, "cut=1&post=2");
  await expect(page.getByRole("tab", { name: "カット" })).toBeDisabled();
});

for (const round of ["LUNCH_RUSH", "DINNER", "FREE_COOK"]) {
  test(`${round}: a profile carrying FINISH renders no FINISH view`, async ({ page }) => {
    await open(page, `round=${round}&post=2`);
    await expect(page.getByTestId("finish-order-card")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "仕上げ" })).toHaveCount(0);
  });
}
