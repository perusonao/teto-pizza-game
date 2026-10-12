import { test, expect, type Page } from "@playwright/test";
import { cutThreeLines, completeDoughStep, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * #421 S2-B capture (NOT a regression test): the same pizza, the same placements and the same bake moments in M1 and the two Canvas
 * mozzarella modes, as screenshots for the Owner's comparison. Skipped unless CHEESE_CAPTURE_DIR is set. The mode comes from the
 * Preview / DEV query switch (?cheese=m1|c64|c96, src/preview/cheeseRenderMode.ts); the dev server the config starts allows it.
 */
const OUT = process.env.CHEESE_CAPTURE_DIR;
const DPR = Number(process.env.CHEESE_CAPTURE_DPR ?? 1);
test.use({ deviceScaleFactor: DPR });
const MODES = ["m1", "c64", "c96"] as const;
const SCENARIOS = {
  /** the usual Margherita: three pieces well apart, then basil */
  spread: { cheese: [[40, 50], [60, 50], [50, 30]], basil: [[45, 55], [55, 45]] },
  /** pieces close together, with basil on top of them: overlaps with each other, the sauce and the basil */
  cluster: { cheese: [[44, 48], [53, 50], [49, 41]], basil: [[47, 46], [52, 52]] },
  /** pieces near the dough edge: the pool must not be clipped or look different from M1 there */
  edge: { cheese: [[76, 50], [24, 52], [50, 78]], basil: [[50, 22]] },
} as const;
const BAKE_TARGET = { start: 60, end: 80 };

async function startMargherita(page: Page, mode: string) {
  await page.addInitScript(() => {
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify({
      schemaVersion: 1,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
      pitzBalance: 0,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
      missionBest: {},
    }));
  });
  await page.goto(`/?cheese=${mode}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
}

test.describe.configure({ mode: "serial" });
test.describe("S2-B capture", () => {
  test.skip(!OUT, "set CHEESE_CAPTURE_DIR");
  for (const [scenarioId, scenario] of Object.entries(SCENARIOS)) {
    for (const mode of MODES) {
      test(`${scenarioId} ${mode}`, async ({ page }) => {
        test.setTimeout(120_000);
        const vp = page.viewportSize()!;
        const name = (stage: string) => `${OUT}/${vp.width}x${vp.height}@${DPR}x-${scenarioId}-${stage}-${mode}.png`;
        await startMargherita(page, mode);
        await completeDoughStep(page);
        await page.getByRole("button", { name: /次へ/ }).click();
        await page.getByRole("button", { name: /トマトソース/ }).click();
        await paintSauceRing(page, 25, 16);
        await page.getByRole("button", { name: /次へ/ }).click();
        await page.getByRole("button", { name: /モッツァレラ/ }).click();
        for (const [x, y] of scenario.cheese) await tapDoughPercent(page, x, y);
        await page.waitForTimeout(500); // the landing animation (220 ms) is real time
        const expectCanvas = mode === "m1" ? 0 : scenario.cheese.length;
        await expect(page.locator(".pizza-cheese-canvas")).toHaveCount(expectCanvas);
        await page.getByRole("button", { name: /次へ/ }).click();
        await page.getByRole("button", { name: /バジル/ }).click();
        for (const [x, y] of scenario.basil) await tapDoughPercent(page, x, y);
        await page.waitForTimeout(500);
        await page.locator(".pizza-stage").first().screenshot({ path: name("1-making") });

        await enterBakePaused(page);
        await page.clock.runFor(1000); // needle ~33: the cheese is melting
        await page.locator(".pizza-stage").first().screenshot({ path: name("2-bake-melting") });
        await page.clock.runFor(700); // needle ~56: nearly done
        await page.locator(".pizza-stage").first().screenshot({ path: name("3-bake-nearly") });
        await landNeedleAndTakeOut(page, BAKE_TARGET);
        await page.waitForTimeout(400);
        await page.locator(".pizza-stage").first().screenshot({ path: name("4-baked") });
        await cutThreeLines(page);
        await page.getByRole("button", { name: /切り終わる/ }).click();
        await expect(page.locator(".result-panel")).toBeVisible();
        await page.waitForTimeout(600);
        await page.locator(".pizza-stage").first().screenshot({ path: name("5-result-stage") });
        await page.screenshot({ path: name("6-result-page") });
        if (mode !== "m1") expect(await page.locator(".pizza-cheese-canvas").count()).toBeGreaterThanOrEqual(scenario.cheese.length); // a cut pizza draws each topping in every piece it touches
      });
    }
  }
});
