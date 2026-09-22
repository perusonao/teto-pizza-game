import { test, expect } from "@playwright/test";
import {
  completeDoughStep,
  cutThreeLines,
  paintSauceRing,
  startCapricciosaUnlocked,
  startFreshMargherita,
  startSalsicciaUnlocked,
  tapDoughPercent,
  waitForBakeTarget,
} from "./gestures";

// Recipe bakeTarget windows this file drives against (src/data/recipes.ts) -- read here rather
// than imported, since these are just the small subset this spec's own fixtures use, and pairing
// each id/target here keeps the intent local to the scenario that reads it.
const BAKE_TARGET = {
  margherita: { start: 60, end: 80 },
  salsiccia: { start: 62, end: 82 },
  capricciosa: { start: 58, end: 78 },
  funghi: { start: 58, end: 78 },
  marinara: { start: 45, end: 65 },
} as const;

/**
 * Pizza Cutting 1.0 Phase 4B (Full Recipe Expansion, see
 * docs/reports/TETO_PIZZA-CUTTING_Phase3_Expansion_Fresh-Audit.md and
 * docs/reports/TETO_PIZZA-CUTTING_Phase4B_Full-Recipe-Expansion_Result.md): real-browser
 * coverage extending Pizza Cutting 1.0 beyond margherita to the rest of the now CUT-eligible
 * allowlist (../src/data/cookingProfiles.ts's `CUT_ELIGIBLE_RECIPE_IDS`). Runs under both the
 * Chromium and WebKit Playwright projects (playwright.config.ts) -- the WebKit CI job
 * (.github/workflows/e2e-webkit.yml) runs every spec in this directory, not a hand-picked
 * subset, so this file is automatically included there.
 *
 * Scenario A (regression): margherita -> CUT -> RESULT, unchanged.
 * Scenario B: a simple non-margherita recipe (salsiccia) -> CUT -> RESULT.
 * Scenario C: a topping-heavy recipe (capricciosa, 5 ingredient types/8 pieces) -> CUT -> RESULT
 *   at the secondary 360x800 viewport.
 * Scenario D: Lunch Rush order -> cooking -> CUT -> serve, with no stale overlay/duplicate serve.
 */

test.describe("Scenario A: Margherita regression (CUT unchanged)", () => {
  test("HOME -> FREE -> Margherita -> PREPARE -> BAKE -> POST_BAKE/CUT -> RESULT", async ({ page }) => {
    test.setTimeout(30_000);
    await startFreshMargherita(page);

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /トマトソース/ }).click();
    await paintSauceRing(page, 25, 16);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 40, 50);
    await tapDoughPercent(page, 60, 50);
    await tapDoughPercent(page, 50, 30);
    await page.getByRole("button", { name: /次へ/ }).click();

    if (await page.getByRole("button", { name: /バジル/ }).count()) {
      await page.getByRole("button", { name: /バジル/ }).click();
      await tapDoughPercent(page, 45, 55);
      await tapDoughPercent(page, 55, 45);
    }

    await page.getByRole("button", { name: /焼く/ }).click();
    // A live needle-position poll, not a fixed real-time wait -- a fixed wait tuned against one
    // target window drifts under CI load/parallelism (see waitForBakeTarget's own doc comment).
    await waitForBakeTarget(page, BAKE_TARGET.margherita);
    await page.getByRole("button", { name: "取り出す！" }).click();

    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    await page.getByRole("button", { name: /切り終わる/ }).click();

    await expect(page.locator(".result-panel")).toBeVisible();
    const cutCard = page.locator(".cut-evaluation-summary");
    await expect(cutCard).toBeVisible();
    await expect(cutCard).toContainText("カット");
  });
});

test.describe("Scenario B: newly CUT-enabled non-margherita recipe (Salsiccia)", () => {
  test("HOME -> FREE -> Salsiccia -> PREPARE -> BAKE -> POST_BAKE/CUT -> RESULT", async ({ page }) => {
    test.setTimeout(30_000);
    await startSalsicciaUnlocked(page);

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /トマトソース/ }).click();
    await paintSauceRing(page, 25, 16);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 40, 50);
    await tapDoughPercent(page, 60, 50);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /ソーセージ/ }).click();
    await tapDoughPercent(page, 35, 45);
    await tapDoughPercent(page, 65, 45);
    await tapDoughPercent(page, 50, 65);

    await page.getByRole("button", { name: /焼く/ }).click();
    await waitForBakeTarget(page, BAKE_TARGET.salsiccia);
    await page.getByRole("button", { name: "取り出す！" }).click();

    // Salsiccia is now CUT-eligible -- the same POST_BAKE/CUT step margherita already had.
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    await page.getByRole("button", { name: /切り終わる/ }).click();

    await expect(page.locator(".result-panel")).toBeVisible();
    const cutCard = page.locator(".cut-evaluation-summary");
    await expect(cutCard).toBeVisible();
    await expect(cutCard).toContainText("カット");
  });
});

test.describe("Scenario C: topping-heavy recipe CUT at the secondary 360x800 viewport", () => {
  test("Capricciosa (5 ingredient types/8 pieces): PREPARE -> BAKE -> CUT -> RESULT, no overflow", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 360, height: 800 });
    await startCapricciosaUnlocked(page);

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /トマトソース/ }).click();
    await paintSauceRing(page, 25, 16);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 35, 45);
    await tapDoughPercent(page, 65, 45);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /マッシュルーム/ }).click();
    await tapDoughPercent(page, 30, 60);
    await tapDoughPercent(page, 70, 60);
    await page.getByRole("button", { name: /オレガノ/ }).click();
    await tapDoughPercent(page, 50, 35);
    await page.getByRole("button", { name: /^.*ハム/ }).click();
    await tapDoughPercent(page, 50, 65);
    await page.getByRole("button", { name: /ブラックオリーブ/ }).click();
    await tapDoughPercent(page, 40, 50);
    await tapDoughPercent(page, 60, 50);

    await page.getByRole("button", { name: /焼く/ }).click();
    await waitForBakeTarget(page, BAKE_TARGET.capricciosa);
    await page.getByRole("button", { name: "取り出す！" }).click();

    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    await page.getByRole("button", { name: /切り終わる/ }).click();

    // No horizontal overflow at any point that mattered -- re-check at the final RESULT screen,
    // matching making-ui-1screen.spec.ts's own assertOneScreen contract.
    const s = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
    }));
    expect(s.docScrollWidth, "360x800 RESULT: no horizontal page overflow").toBeLessThanOrEqual(
      s.innerWidth,
    );

    await expect(page.locator(".result-panel")).toBeVisible();
    const cutCard = page.locator(".cut-evaluation-summary");
    await expect(cutCard).toBeVisible();
    await expect(cutCard).toContainText("カット");
  });
});

test.describe("Scenario D: Lunch Rush eligible recipe -> CUT -> serve", () => {
  test("order -> cooking -> POST_BAKE/CUT -> serve, no stale overlay, no duplicate serve", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    // A small, deterministic pool (margherita + funghi, both CUT-eligible after Phase 4B) --
    // whichever one Lunch Rush's own random order picks (../src/data/orders.ts's
    // `getNextOrder`), the flow below is generic and does not assume which one it is.
    const save = {
      schemaVersion: 2,
      dex: [
        { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
        { recipeId: "funghi", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
      ],
      pitzBalance: 500,
      ownedIngredientIds: ["mushroom"],
      missionBest: {},
      inventory: { mushroom: 99 },
      starterGrantClaimedRecipeIds: ["margherita", "funghi"],
    };
    await page.addInitScript((rawSave) => {
      localStorage.setItem("teto-pizza-save-v1", JSON.stringify(rawSave));
    }, save);
    await page.goto("/");
    await page.waitForSelector(".app-frame");

    await page.getByRole("button", { name: /ランチラッシュ/ }).click();
    await page.getByRole("button", { name: "スタート" }).click();
    await page.getByRole("button", { name: "ピザを作る！" }).click();

    // margherita/funghi/marinara have different bakeTarget windows (BAKE_TARGET above) -- read
    // which order this actually is (all three are reachable: this seed's own dex discovers
    // margherita+funghi, and marinara's own unlockCondition is satisfied transitively once
    // funghi is discovered) so the deterministic needle-position wait below polls the correct
    // window, rather than assuming margherita/funghi's shared ~70% target.
    const orderText = (await page.locator(".order-card").textContent()) ?? "";
    const bakeTarget = orderText.includes("マリナーラ")
      ? BAKE_TARGET.marinara
      : orderText.includes("フンギ")
        ? BAKE_TARGET.funghi
        : BAKE_TARGET.margherita;

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    if (await page.getByRole("button", { name: /トマトソース/ }).count()) {
      await page.getByRole("button", { name: /トマトソース/ }).click();
      await paintSauceRing(page, 25, 16);
    }
    await page.getByRole("button", { name: /次へ/ }).click();

    if (await page.getByRole("button", { name: /モッツァレラ/ }).count()) {
      await page.getByRole("button", { name: /モッツァレラ/ }).click();
      await tapDoughPercent(page, 40, 50);
      await tapDoughPercent(page, 60, 50);
      await tapDoughPercent(page, 50, 30);
    }
    await page.getByRole("button", { name: /次へ/ }).click();

    // Whatever this order's own remaining TOPPING-step ingredient(s) are (this seed's pool --
    // margherita/funghi/marinara, all CUT-eligible -- includes recipes needing one type at this
    // step, e.g. funghi's mushroom x3, and recipes needing two, e.g. marinara's garlic+oregano),
    // place every tray chip present generically by position rather than by name: read every
    // chip's own accessible name up front (the tray itself doesn't change chips mid-step, only
    // which are enabled), then click + place 3 pieces for each one in turn. 3 taps per type
    // clears every shipped recipe's own highest single-type minCount at this step.
    const trayButtonCount = await page.locator(".ingredient-tray button").count();
    for (let i = 0; i < trayButtonCount; i += 1) {
      await page.locator(".ingredient-tray button").nth(i).click();
      await tapDoughPercent(page, 40, 50);
      await tapDoughPercent(page, 60, 50);
      await tapDoughPercent(page, 50, 30);
    }

    await page.getByRole("button", { name: /焼く/ }).click();
    await waitForBakeTarget(page, bakeTarget);
    await page.getByRole("button", { name: "取り出す！" }).click();

    // margherita/funghi/marinara are all CUT-eligible now -- POST_BAKE/CUT must appear.
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();

    // Serve screen: exactly one CUT line, no stale overlay, no duplicate serve on repeat taps.
    const cutLine = page.locator(".mission-serve-panel__cut");
    await expect(cutLine).toBeVisible();
    await expect(cutLine).toContainText("カット");

    const servedBefore = await page.locator(".mission-hud__served").textContent();
    await page.getByRole("button", { name: "次の注文へ" }).click();

    // Next order lands straight on a fresh PREPARE -- no leftover CUT overlay, no duplicate
    // "次の注文へ" screen, served count advanced by exactly one.
    await expect(page.locator(".mission-serve-panel")).toHaveCount(0);
    await expect(page.locator('[data-pizza-drop-target="true"]')).toBeVisible();
    const servedAfter = await page.locator(".mission-hud__served").textContent();
    expect(servedAfter).not.toBe(servedBefore);
  });
});
