import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * New Sauces Phase B-1 representative E2E (sichuan-eggplant-pizza: doubanjiang + green-onion, ONE ordinary ladder step; Owner GO 2026-10-23). The newest step played end to end: Shop NEW for both materials,
 * purchase, the single Research Entry (the label names only the cohort key, green-onion, the last material of the step; no identity leak), SAUCE painted with the existing PAINT gesture (the dark red-brown `#8a2b1c` is
 * PROVISIONAL until the Owner HV, so the painted dough is captured), CHEESE, TOPPING (eggplant 3 / garlic 1 / green-onion 2), NEW DISCOVERY and the Dex. The original PIZZA DB page was NOT confirmed: the green onion
 * before the bake, the doubanjiang as a painted sauce and the eggplant not pre-cooked are PROVISIONAL assumptions (OD-B9-17). The step number is DERIVED from the ladder length, never hard-coded.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ID = "sichuan-eggplant-pizza";
// E5: the late recipe (ikura) and its step sit AFTER every ordinary one, so "the newest step / the tail" is meant among the ordinary ones.
const LAST_STEP = DISCOVERY_LADDER.steps.findIndex((s) => s.keyRecipeId === ID) + 1; // this recipe's own step (doubanjiang + green-onion), derived from the ladder (Expansion Batch 10 PR-1 appends five ordinary steps after it)
const ALL_IDS = RECIPES.map((r) => r.id as string); // (the late recipe is discovered too: this save has played everything but sichuan)
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];

const saveJson = (discovered: readonly string[], owned: readonly string[]) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    // The new step's materials are deliberately NOT listed: load-time entitlement (the ladder) must grant them.
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
async function open(page: Page, json: string) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, json] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}
async function place(page: Page, picks: [RegExp, number][], startSpot: number) {
  let spot = startSpot;
  for (const [name, count] of picks) {
    await (await chipOnTrayOrPin(page, name)).click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  return spot;
}

test.describe("New Sauces Phase B-1 (representative: sichuan-eggplant-pizza; doubanjiang + green-onion)", () => {
  test.setTimeout(300_000);

  test("Shop NEW sauce + topping -> purchase -> Research (no leak) -> paint doubanjiang, cheese, eggplant / garlic / green onion -> NEW DISCOVERY -> Dex", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const discovered = ALL_IDS.filter((id) => id !== ID);
    await open(page, saveJson(discovered, materialsUpTo(LAST_STEP - 1)));
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
    await hold(page);

    // 1. Shop: both materials of the newest step are NEW (T4: 120 Pitz each, no star gate). doubanjiang k=1 -> 10 uses; green-onion k=2 -> 20 pieces.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    for (const [id, nameJa, pack, shot] of [
      ["doubanjiang", "豆板醤", "10ピザ分", "b1-doubanjiang"],
      ["green-onion", "青ねぎ", "10ピザ分（20個）", "b1-green-onion"],
    ] as const) {
      const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toHaveCount(1);
      await expect(row).toHaveAttribute("data-shop-state", "NEW");
      await expect(row).toContainText(nameJa);
      await expect(row).toContainText(pack);
      await expect(row).toContainText(/初回 .*120 Pitz/);
      if (id === "green-onion") {
        await expect(row.locator('svg[data-ingredient-visual="green-onion-slices"]')).toHaveCount(1);
        await expect(row.locator(".shop-item__emoji")).toHaveText(""); // the dedicated art only; the unique text fallback is never shown
      }
      await noOverflow(page, `shop NEW ${id}`);
      await capture(page, `${shot}-new`, project);
      await hold(page, 2000);
      await row.locator(".shop-item__buy-button").click();
      await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
    }
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the single Research Entry: only the cohort key (green-onion, the last material of the step) is named.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay__research")).toContainText("？？？ピザ（青ねぎ）");
    await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
    await noOverflow(page, "Dex Research Entry");
    await capture(page, "b1-research-entry", project);
    await hold(page, 2000);
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（青ねぎ）を研究する$/ }).click();
    await expectResearchLead(page, "？？？ピザ");
    await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");

    // 3. Cooking: SAUCE (the existing PAINT gesture), CHEESE (mozzarella 2), TOPPING (eggplant 3 / garlic 1 / green-onion 2).
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await page.locator(".ingredient-chip").filter({ hasText: /豆板醤/ }).first().click();
    await capture(page, "b1-tray-sauce", project);
    await paintSauceRing(page, 25, 16);
    await hold(page, 2200);
    await capture(page, "b1-sauce-painted", project);
    await noOverflow(page, "sauce painted");
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    let spot = await place(page, [[/モッツァレラ/, 2]], 0);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await expect((await chipOnTrayOrPin(page, /青ねぎ/)).locator('svg[data-ingredient-visual="green-onion-slices"]')).toHaveCount(1);
    await capture(page, "b1-tray-topping", project);
    spot = await place(page, [[/ナス/, 3], [/にんにく/, 1], [/青ねぎ/, 2]], spot);
    await capture(page, "b1-topped", project);
    await hold(page, 2000);
    // Free Cooking judges the bake on the generic window (58-78), which is also the recipe's own window: aim inside both.
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");

    // 4. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("四川風ナスピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "b1-new-recipe", project);
    await hold(page, 3000);

    // 5. Dex: complete; chapter 4 (the last chapter) is complete; schema v2 unchanged.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "四川風ナスピザ" });
    await expect(card).toHaveCount(1);
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: `第${CATALOG_COUNTS.chapterSizes.length}章` })).toContainText(`${last}/${last}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "b1-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(ID);
    expect(errors).toEqual([]);
  });

  test("a save that had every earlier chapter-4 recipe keeps them all: the chapter is one short until the recipe is made", async ({ page }) => {
    const discovered = ALL_IDS.filter((id) => id !== ID);
    await open(page, saveJson(discovered, materialsUpTo(LAST_STEP - 1)));
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: "第4章" })).toContainText(`${last - 1}/${last}`);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.dex).toHaveLength(discovered.length); // opening the Dex rewrote nothing
  });
});
