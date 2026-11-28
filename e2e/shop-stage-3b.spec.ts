import { LEGACY_PROGRESSION_QUERY } from "./support/legacyProgression";
import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, completeEmptyFinishIfOffered, cutThreeLines, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { RECIPES } from "../src/data/recipes";
import { MENU_CATALOG } from "../src/data/menuCatalog";

/**
 * B案 Phase 3b (Issue #901, Owner 2026-11-27), on the dev server under `?progression=shop`:
 * 1. a stage-2 recipe made (an exact match) before stage 2 opens is identified (判明): RESULT says the shop is not ready for it yet
 *    and when it joins the menu; the Dex shows it as 判明 with 「小さな店でメニュー入り」, HOME / the Dex do not count it;
 * 2. a served order crossing 40 promotes the owner and the banner lists what opened (the new recipes, the materials, and the
 *    identified recipe that joined the menu with its bonus) -- paid once (the save records it; a reload pays nothing);
 * 3. legacy still discovers it as before.
 *
 * `HV_VIDEO=1` records the Human Verification video, `HV_SCREENSHOT_DIR=<dir>` writes the screenshots; `HV_BEFORE=1` only captures
 * (for the `main` "before" screenshots, where the Phase 3b UI does not exist).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const MEAT = ["bacon", "ham", "pepperoni", "sausage"];
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const STRICT = !process.env.HV_BEFORE;

/** Every other recipe these materials make is already in the Dex, so 「メニュー開発」 goes straight to Free Cooking (no research to choose). */
const OTHERS = RECIPES.filter(
  (r) => r.id !== "meat-lovers" && r.requiredIngredients.every((x) => [...STARTERS, ...MEAT].includes(x.ingredientId)),
).map((r) => r.id);
const stageOf = (id: string) => MENU_CATALOG.find((e) => e.recipeId === id)?.chapter ?? null;
/** On the menu at reputation 39: the adopted stage-1 recipes in the Dex. */
const MENU_AT_39 = OTHERS.filter((id) => stageOf(id) === 1).length;
/** Stage 2's recipes not in the Dex once meat-lovers joined (what the banner counts). */
const NEW_AT_40 = MENU_CATALOG.filter((e) => e.chapter === 2 && e.recipeId !== "meat-lovers" && !OTHERS.includes(e.recipeId)).length;
const save = (reputation: number) => ({
  schemaVersion: 2,
  dex: OTHERS.map((recipeId) => ({ recipeId, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 })),
  pitzBalance: 0,
  ownedIngredientIds: [...STARTERS, ...MEAT],
  missionBest: {},
  // Exactly one meat-lovers' worth: afterwards only margherita is cookable, so the next service order is margherita.
  inventory: { bacon: 2, ham: 1, pepperoni: 1, sausage: 2 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: [...MEAT],
  shopProgress: { reputation, grantedMenuRecipeIds: [] },
});

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}
async function open(page: Page, query: string, json: object) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(json)] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
}
const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function place(page: Page, picks: [RegExp, number][], startSpot: number) {
  let spot = startSpot;
  for (const [name, count] of picks) {
    await (await chipOnTrayOrPin(page, name)).click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  return spot;
}

async function finishAfterBake(page: Page) {
  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
  await completeEmptyFinishIfOffered(page);
  await page.waitForSelector(".result-panel");
}

/** Free Cooking from HOME (「メニュー開発」 / legacy 「レシピ発見」): meat-lovers (tomato sauce, mozzarella x2, bacon x2, ham, pepperoni, sausage x2). */
async function cookMeatLoversFreely(page: Page) {
  await page.locator(".cta-button--free-cook").first().click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await (await chipOnTrayOrPin(page, /トマトソース/)).click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  let spot = await place(page, [[/モッツァレラ/, 2]], 0);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  spot = await place(page, [[/ベーコン/, 2], [/ハム/, 1], [/ペパロニ/, 1], [/ソーセージ/, 2]], spot);
  await hold(page, 1200);
  // Free Cooking judges the bake on the generic window (58-78).
  await bakeToTarget(page, { start: 60, end: 76 });
  await finishAfterBake(page);
}

/** The FREE Mito order for margherita, from HOME. */
async function serveMargheritaOrder(page: Page) {
  await page.getByRole("button", { name: /注文を受ける/ }).click();
  await expect(page.locator(".dialogue-area")).toBeVisible();
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  for (const [x, y] of [[40, 50], [60, 50], [50, 30]] as const) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 60);
  await tapDoughPercent(page, 58, 42);
  await bakeToTarget(page, { start: 60, end: 80 });
  await finishAfterBake(page);
}

async function home(page: Page) {
  await page.getByRole("button", { name: /ホーム/ }).first().click();
  await page.waitForSelector(".home-screen");
}

async function openDexAt(page: Page, recipeNameJa: string) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
  await page.waitForSelector(".dex-overlay");
  const card = page.locator(".dex-overlay__chapter .dex-card").filter({ hasText: recipeNameJa });
  await card.scrollIntoViewIfNeeded();
  return card;
}

test.describe("B案 Phase 3b: a recipe waits for its stage (shop model)", () => {
  test.setTimeout(240_000);

  test("identified before stage 2 -> 判明 in the Dex -> an order crosses 40 -> it joins the menu with its bonus, once", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await open(page, "?progression=shop", save(39));
    await expect(page.getByTestId("home-reputation")).toContainText("評判 39");
    await capture(page, "01-home-shop-rep39");

    // 1. Free Cooking: an exact match for meat-lovers (stage 2) at reputation 39.
    await cookMeatLoversFreely(page);
    const identified = page.getByTestId("result-identified");
    if (STRICT) {
      await expect(identified).toContainText("ミートラヴァーズのレシピが判明した！");
      await expect(identified).toContainText("小さな店になったらメニューに載せよう！");
      await expect(page.locator(".result-panel--discovery")).toHaveCount(0);
      await expect(page.locator(".result-panel")).not.toContainText("保留");
      await noOverflow(page, "RESULT identified");
      const s = await saved(page);
      expect(s.shopProgress.reputation).toBe(39);
      expect(s.shopProgress.awaitingMenuRecipeIds).toEqual(["meat-lovers"]);
      expect(s.dex.map((e: { recipeId: string }) => e.recipeId)).toContain("meat-lovers");
    }
    await capture(page, "02-result-identified");
    await hold(page, 3000);

    // 2. The Dex: 判明, 「小さな店でメニュー入り」, not counted.
    await home(page);
    if (STRICT) await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${MENU_AT_39}/60`));
    const card = await openDexAt(page, "ミートラヴァーズ");
    if (STRICT) {
      await expect(card).toContainText("判明");
      await expect(card).toContainText("小さな店でメニュー入り");
      await expect(page.locator(".dex-overlay__progress-count")).toContainText(`開発 ${MENU_AT_39} / 60`);
      await noOverflow(page, "Dex identified");
    }
    await capture(page, "03-dex-identified");
    if (STRICT) {
      // PR #915 play check: at 39 stage 2's heading says what opens it.
      const stage2 = page.locator(".dex-overlay__chapter").nth(1).locator(".dex-overlay__chapter-title");
      await expect(stage2).toContainText("🔒 一人前（評判40）で解放");
      await stage2.scrollIntoViewIfNeeded();
      await noOverflow(page, "Dex stage 2 heading");
      await capture(page, "08-dex-stage-unlock-label");
    }
    await hold(page, 2500);
    await page.locator(".dex-overlay__header").getByRole("button", { name: "閉じる" }).click();

    // 3. A served order crosses 40: the promotion lists what opened, and meat-lovers joins the menu (+50 Pitz, +3).
    const pitzBefore = (await saved(page)).pitzBalance as number;
    await serveMargheritaOrder(page);
    if (STRICT) {
      await expect(page.getByTestId("result-rank-up")).toContainText("一人前（小さな店）に昇格しました！");
      const list = page.getByTestId("result-stage-opening");
      await expect(list).toContainText(`新しいメニューを開発できるようになった：${NEW_AT_40}品`);
      await expect(list).toContainText("新しい材料が入荷：");
      await expect(list).toContainText("アンチョビ");
      await expect(list).toContainText("メニューに追加：ミートラヴァーズ");
      await expect(list).toContainText("メニュー開発ボーナス +50 Pitz・評判 +3");
      await noOverflow(page, "RESULT stage opening");
      const s = await saved(page);
      expect(s.shopProgress.menuEntryPaidRecipeIds).toEqual(["meat-lovers"]);
      expect(s.shopProgress.reputation).toBeGreaterThanOrEqual(43);
      expect(s.pitzBalance).toBeGreaterThanOrEqual(pitzBefore + 50);
    }
    if (await page.getByTestId("result-reputation").count()) await page.getByTestId("result-reputation").scrollIntoViewIfNeeded();
    await capture(page, "04-result-stage-opening");
    await hold(page, 3500);

    // 4. HOME / the Dex: on the menu now; a reload pays nothing more.
    await home(page);
    if (STRICT) await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${MENU_AT_39 + 1}/60`));
    const after = await openDexAt(page, "ミートラヴァーズ");
    if (STRICT) {
      await expect(after).not.toContainText("判明");
      await expect(page.locator(".dex-overlay__progress-count")).toContainText(`開発 ${MENU_AT_39 + 1} / 60`);
    }
    await capture(page, "05-dex-on-menu");
    await hold(page, 2000);
    if (STRICT) {
      const before = await saved(page);
      await page.reload();
      await page.waitForSelector(".app-frame");
      const again = await saved(page);
      expect(again.pitzBalance).toBe(before.pitzBalance);
      expect(again.shopProgress.reputation).toBe(before.shopProgress.reputation);
      expect(again.shopProgress.menuEntryPaidRecipeIds).toEqual(["meat-lovers"]);
    }
    expect(errors).toEqual([]);
  });

  test("stage 4 opens: 8 developable now, 4 waiting for materials (reputation 275) -- Owner 2026-11-27", async ({ page }) => {
    await open(page, "?progression=shop", {
      schemaVersion: 2,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
      pitzBalance: 0,
      ownedIngredientIds: STARTERS,
      missionBest: {},
      shopProgress: { reputation: 209, grantedMenuRecipeIds: [] },
    });
    await serveMargheritaOrder(page);
    await expect(page.getByTestId("result-rank-up")).toContainText("達人（有名店）に昇格しました！");
    await expect(page.getByTestId("result-stage-opening")).toContainText(
      "新しいメニューを開発できるようになった：8品／あと4品は材料の入荷待ち（評判275で入荷）",
    );
    await noOverflow(page, "RESULT stage 4");
    await page.getByTestId("result-reputation").scrollIntoViewIfNeeded();
    await capture(page, "07-result-stage4-split");
    await hold(page, 3500);
  });

  test("legacy: the same pizza is a discovery, as before", async ({ page }) => {
    await open(page, LEGACY_PROGRESSION_QUERY, save(0));
    await cookMeatLoversFreely(page);
    await expect(page.locator(".result-panel--discovery")).toContainText("ミートラヴァーズ");
    await expect(page.getByTestId("result-identified")).toHaveCount(0);
    await expect(page.getByTestId("result-reputation")).toHaveCount(0);
    await capture(page, "06-result-legacy");
    await hold(page, 3000);
  });
});
