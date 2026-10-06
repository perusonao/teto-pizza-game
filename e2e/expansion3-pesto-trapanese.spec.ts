import { expectResearchLead } from "./support/hintNote";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Expansion Slice 3 (pesto-trapanese + almond, appended ladder step 29), played for real on both iPhone widths.
 *
 * Save: every other recipe found (32 of 33), every material up to step 28 owned and stocked, 999 Pitz. Step 29 is reached, so
 * `almond` is entitled but not bought; pesto-trapanese is the single Research Entry. Shop purchase, Research Entry / Target and
 * the cook are real operations; only the starting save is seeded.
 */
const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 50, end: 70 };
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ID = "pesto-trapanese";
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);
const DISCOVERED = RECIPES.map((r) => r.id as string).filter((id) => id !== ID);
const OWNED_BEFORE = materialsUpTo(28);

const saveJson = () =>
  JSON.stringify({
    schemaVersion: 2,
    dex: DISCOVERED.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...OWNED_BEFORE],
    missionBest: {},
    inventory: Object.fromEntries(OWNED_BEFORE.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materialsUpTo(29),
  });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

test("Expansion Slice 3: Shop (almond NEW -> bought) -> Research Entry (no name leak) -> exact cook -> NEW RECIPE -> Dex", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, saveJson()] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/32\/33/);

  // 1. Shop: almond is NEW (T3: first pack 100 Pitz, 30 pieces), then bought.
  await page.getByRole("button", { name: /ショップ/ }).click();
  await page.waitForSelector(".shop-overlay__panel");
  const almond = page.locator('.shop-item[data-ingredient-id="almond"]');
  await expect(almond).toHaveCount(1);
  await expect(almond).toHaveAttribute("data-shop-state", "NEW");
  await expect(almond).toContainText("アーモンド");
  await expect(almond).toContainText("🥜");
  await expect(almond).toContainText("10ピザ分（30個）");
  await expect(almond).toContainText(/初回 .*100 Pitz/);
  await almond.scrollIntoViewIfNeeded();
  await noOverflow(page, "shop NEW");
  await almond.locator(".shop-item__buy-button").click();
  await expect(almond).not.toHaveAttribute("data-shop-state", "NEW");
  await expect(almond).toContainText("在庫 30");
  await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

  // 2. Dex -> the single Research Entry: its label is the unlock ingredient only; the recipe name never reaches the DOM.
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  const entry = page.locator(".dex-overlay__research .dex-research-card");
  await expect(entry).toHaveCount(1);
  await expect(page.locator(".dex-overlay__research")).toContainText("？？？ピザ（アーモンド）");
  await expectNoUndiscoveredIdentity(page, DISCOVERED, "Dex Research Entry");
  await noOverflow(page, "Dex Research Entry");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（アーモンド）を研究する$/ }).click();
  await expectResearchLead(page, "？？？ピザ");
  await expectNoUndiscoveredIdentity(page, DISCOVERED, "Research PREPARE");

  // 3. The exact recipe: pesto 1, tomato 2, garlic 2, almond 3, no cheese.
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /ジェノベーゼ|ペスト/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // no cheese
  const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36]];
  let spot = 0;
  for (const [name, count] of [[/(?<!チェリー)トマト(?!ソース)/, 2], [/にんにく/, 2], [/アーモンド/, 3]] as [RegExp, number][]) {
    const chip = await chipOnTrayOrPin(page, name);
    await chip.click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
  const discovery = page.locator(".result-panel--discovery");
  await expect(discovery).toBeVisible();
  await expect(discovery).toContainText("ペストトラパネーゼピザ");
  await noOverflow(page, "NEW RECIPE");

  // 4. Dex: 33 / 33, Chapter 3 last slot; schema v2 unchanged.
  await page.getByRole("button", { name: /ホーム/ }).first().click();
  await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
  await page.waitForSelector(".dex-overlay");
  await expect(page.locator(".dex-overlay")).toContainText(/33\s*\/\s*33/);
  const card = page.locator(".dex-card").filter({ hasText: "ペストトラパネーゼピザ" });
  await expect(card).toHaveCount(1);
  await expect(page.locator(".dex-overlay__chapter-title").last()).toContainText("16/16");
  await card.scrollIntoViewIfNeeded();
  await noOverflow(page, "Dex");
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
  expect(saved.schemaVersion).toBe(2);
  expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(ID);
  expect(errors).toEqual([]);
});
