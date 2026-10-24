import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * New Sauces Phase A representative E2E (Issue #578; step 55: fromage-blanc-sauce -> flammkuchen). The first new sauce played end to end: Shop NEW (T4, 120 Pitz, 10 uses) and purchase,
 * the single Research Entry (the label names only the cohort key; no identity leak), the SAUCE step painted with the existing PAINT gesture (the near-white `#fffdf8` is PROVISIONAL until the
 * Owner HV, so the painted dough is captured), NO cheese step, onion 3 / bacon 3, NEW DISCOVERY and the Dex (chapter 4 now 27). The save does not list the new step's material: the ladder grants it.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ID = "flammkuchen";
const LAST_STEP = 55; // fromage-blanc-sauce
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

test.describe("New Sauces Phase A (representative: step 55 flammkuchen; fromage-blanc-sauce)", () => {
  test.setTimeout(300_000);

  test("step 55: Shop NEW sauce -> purchase -> Research (no leak) -> paint the sauce, no cheese, onion + bacon -> NEW DISCOVERY -> Dex (chapter 4 = 27)", async ({ page }, testInfo) => {
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

    // 1. Shop: the sauce is NEW (T4: 120 Pitz; a spread sauce, k = 1 -> one pack is 10 uses), no per-ingredient price.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const row = page.locator('.shop-item[data-ingredient-id="fromage-blanc-sauce"]');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("data-shop-state", "NEW");
    await expect(row).toContainText("フロマージュブランソース");
    await expect(row).toContainText("10ピザ分");
    await expect(row).toContainText(/初回 .*120 Pitz/);
    await noOverflow(page, "shop NEW");
    await capture(page, "new-sauces-a-shop-new", project);
    await hold(page, 2200);
    await row.locator(".shop-item__buy-button").click();
    await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the single Research Entry: only the cohort key (the sauce) is named.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay__research")).toContainText("？？？ピザ（フロマージュブランソース）");
    await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
    await noOverflow(page, "Dex Research Entry");
    await capture(page, "new-sauces-a-research-entry", project);
    await hold(page, 2000);
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（フロマージュブランソース）を研究する$/ }).click();
    await expectResearchLead(page, "？？？ピザ");
    await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");

    // 3. Cooking: paint the new sauce (the existing PAINT gesture), skip the cheese step (the recipe has none), onion 3 / bacon 3.
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await page.locator(".ingredient-chip").filter({ hasText: /フロマージュブラン/ }).first().click();
    await capture(page, "new-sauces-a-tray-sauce", project);
    await paintSauceRing(page, 25, 16);
    await hold(page, 2200);
    await capture(page, "new-sauces-a-sauce-painted", project);
    await noOverflow(page, "sauce painted");
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await bar(page).getByRole("button", { name: /次へ/ }).click(); // no cheese
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    let spot = 0;
    for (const [name, count] of [[/たまねぎ/, 3], [/ベーコン/, 3]] as [RegExp, number][]) {
      await (await chipOnTrayOrPin(page, name)).click();
      for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
    }
    await capture(page, "new-sauces-a-topped", project);
    await hold(page, 2000);
    // Free Cooking judges the bake on the generic window (58-78), which is also the recipe's own window: aim inside both.
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");

    // 4. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("タルトフランベ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "new-sauces-a-new-recipe", project);
    await hold(page, 3000);

    // 5. Dex: complete; chapter 4 is now 27 / 27; schema v2 unchanged.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "タルトフランベ" });
    await expect(card).toHaveCount(1);
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: `第${CATALOG_COUNTS.chapterSizes.length}章` })).toContainText(`${last}/${last}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "new-sauces-a-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(ID);
    expect(errors).toEqual([]);
  });

  test("a save that had every earlier chapter-4 recipe keeps them all: the chapter reads 26/27 until flammkuchen is made", async ({ page }) => {
    const discovered = ALL_IDS.filter((id) => id !== ID);
    await page.goto("icons/icon-16.png");
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [SAVE_KEY, saveJson(discovered, materialsUpTo(LAST_STEP - 1))] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: "第4章" })).toContainText(`${last - 1}/${last}`); // every earlier chapter-4 recipe is kept; only flammkuchen is missing (later batches append after it)
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.dex).toHaveLength(discovered.length); // opening the Dex rewrote nothing
  });
});
