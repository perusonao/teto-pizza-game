import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { CATALOG_COUNTS, materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * New Sauces Phase B U1 representative E2E (Issue #578; the late catalog: yuzu-kosho -> yuzu-shrimp-pizza). The yuzu-kosho PAINT before the bake, the shrimp placed before the bake without
 * pre-cooking and every count are PROVISIONAL game-design values (the original page is not confirmed on them; the shiso is a finishing touch in the original). The late sauce played end to end:
 * Shop NEW (T4, 120 Pitz, 10 uses) and purchase, the single Research Entry (the label names only the cohort key; no identity leak), the SAUCE step painted with the existing PAINT gesture (the
 * muted yellow-olive `#a3ad52` (was `#b5c56a`) is PROVISIONAL until the Owner HV, so the painted dough is captured), the CHEESE step (mozzarella 2), shrimp 3, the bake, the shiso placed in FINISH, NEW DISCOVERY and the Dex.
 * The save does not list the new step's material: the ladder (the late step) grants it on load.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ID = "yuzu-shrimp-pizza";
const LAST_STEP = CATALOG_COUNTS.ladderSteps; // the yuzu-kosho late step is the last one; derived, never authored
const ALL_IDS = RECIPES.map((r) => r.id as string);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63]];

const saveJson = (discovered: readonly string[], owned: readonly string[]) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    // The new step's material is deliberately NOT listed: load-time entitlement (the ladder) must grant it.
    unlockedForShopIngredientIds: [...owned],
  });

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
async function capture(page: Page, name: string, project: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${project}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

test.describe("New Sauces Phase B U1 (representative: the late step; yuzu-kosho -> yuzu-shrimp-pizza)", () => {
  test.setTimeout(300_000);

  test("Shop NEW sauce -> purchase -> Research (no leak) -> paint the sauce, mozzarella, shrimp -> bake -> shiso in FINISH -> NEW DISCOVERY -> Dex", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const discovered = ALL_IDS.filter((id) => id !== ID);
    await page.goto("icons/icon-16.png");
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [SAVE_KEY, saveJson(discovered, materialsUpTo(LAST_STEP - 1))] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
    await hold(page);

    // 1. Shop: the sauce is NEW (T4: 120 Pitz; a spread sauce, k = 1 -> one pack is 10 uses).
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const row = page.locator('.shop-item[data-ingredient-id="yuzu-kosho"]');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("data-shop-state", "NEW");
    await expect(row).toContainText("柚子胡椒");
    await expect(row).toContainText("10ピザ分");
    await expect(row).toContainText(/初回 .*120 Pitz/);
    await noOverflow(page, "shop NEW");
    await capture(page, "new-sauces-u1-shop-new", project);
    await hold(page, 2200);
    await row.locator(".shop-item__buy-button").click();
    await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the single Research Entry: only the cohort key (the sauce) is named.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay__research")).toContainText("？？？ピザ（柚子胡椒）");
    await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
    await noOverflow(page, "Dex Research Entry");
    await capture(page, "new-sauces-u1-research-entry", project);
    await hold(page, 2000);
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（柚子胡椒）を研究する$/ }).click();
    await expectResearchLead(page, "？？？ピザ");
    await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");

    // 3. Cooking: paint the new sauce (the existing PAINT gesture), mozzarella 2 (CHEESE), shrimp 3 (TOPPING).
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await page.locator(".ingredient-chip").filter({ hasText: /柚子胡椒/ }).first().click();
    await capture(page, "new-sauces-u1-tray-sauce", project);
    await paintSauceRing(page, 25, 16);
    await hold(page, 2200);
    await capture(page, "new-sauces-u1-sauce-painted", project);
    await noOverflow(page, "sauce painted");
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    await page.getByRole("button", { name: /モッツァレラ/ }).first().click();
    await tapDoughPercent(page, ...SPOTS[0]);
    await tapDoughPercent(page, ...SPOTS[1]);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await (await chipOnTrayOrPin(page, /エビ/)).click();
    for (let i = 0; i < 3; i += 1) await tapDoughPercent(page, ...SPOTS[2 + i]);
    await capture(page, "new-sauces-u1-topped", project);
    await hold(page, 2000);

    // 4. Bake inside the generic Free Cooking window (58-78, also the recipe's own), then 仕上げ: the shiso is placed AFTER the bake.
    await bakeToTarget(page, { start: 60, end: 76 }, { finish: false });
    await expect(page.getByTestId("finish-dock")).toBeVisible();
    await expect(page.getByRole("tab", { name: "仕上げ" })).toHaveAttribute("aria-current", /.+/);
    await capture(page, "new-sauces-u1-finish", project);
    await hold(page, 1800);
    await (await chipOnTrayOrPin(page, /大葉/)).click(); // the FINISH tray lists every owned scatter topping, paged
    await tapDoughPercent(page, ...SPOTS[5]);
    await expect(page.getByTestId("finish-undo")).toBeEnabled();
    await noOverflow(page, "finish shiso placed");
    await capture(page, "new-sauces-u1-finish-shiso", project);
    await hold(page, 2200);
    await page.getByTestId("finish-complete").click();
    await page.waitForSelector(".result-panel");

    // 5. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("柚子えびピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "new-sauces-u1-new-recipe", project);
    await hold(page, 3000);

    // 6. Dex: complete; chapter 4 is now full; schema v2 unchanged.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "柚子えびピザ" });
    await expect(card).toHaveCount(1);
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: `第${CATALOG_COUNTS.chapterSizes.length}章` })).toContainText(`${last}/${last}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "new-sauces-u1-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(ID);
    expect(saved.unlockedForShopIngredientIds).toContain("yuzu-kosho");
    expect(errors).toEqual([]);
  });

  test("a never-launched save at the ladder step it shipped at (no yuzu-kosho or roe in its ledger) is granted both on the first launch, and opening the Dex rewrites nothing", async ({ page }) => {
    const discovered = ALL_IDS.filter((id) => id !== ID);
    const withoutLate = materialsUpTo(LAST_STEP - 1).filter((m) => m !== "salmon-roe");
    await page.goto("icons/icon-16.png");
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [SAVE_KEY, saveJson(discovered, withoutLate)] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    for (const id of ["salmon-roe", "yuzu-kosho"]) {
      const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
      await row.scrollIntoViewIfNeeded();
      await expect(row, id).toHaveAttribute("data-shop-state", "NEW");
    }
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.dex).toHaveLength(discovered.length); // nothing was lost or rewritten
  });
});
