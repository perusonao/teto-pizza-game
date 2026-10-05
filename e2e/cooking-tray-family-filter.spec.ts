import { expect, test, type Page } from "@playwright/test";
import { INGREDIENTS, ingredientsByCategory } from "../src/data/ingredients";
import { ingredientShelf } from "../src/data/ingredientShelf";
import { runOnlyOnWidth } from "./support/projectGuard";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Cooking Tray family filter (Issue #396): on the normal 具材 step the family chips sit right above the tray (no 食材庫
 * needed). Real-Chromium facts: visible on arrival, the pizza keeps its size across steps, filtering = population ->
 * HAND/pin -> family -> pagination, page resets, pins survive, sauce / cheese have no row, and the Pantry still works.
 */
const SAVE_KEY = "teto-pizza-save-v1";
const TOPPING_IDS = ingredientsByCategory("topping").map((i) => i.id);
const SHOT_DIR = "docs/reports/screenshots/cooking-tray-family-filter";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

function saveWith(owned: readonly string[]) {
  return JSON.stringify({
    schemaVersion: 2,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: owned,
    missionBest: {},
    inventory: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])),
    starterGrantClaimedRecipeIds: [],
  });
}

const HAND_ON_OWNED = INGREDIENTS.map((i) => i.id); // owned >= 13: the production Hand is active
const HAND_OFF_OWNED = ["tomato-sauce", "mozzarella", ...TOPPING_IDS.slice(0, 9)]; // 11 owned: no hand, still > 6 toppings

async function boot(page: Page, width: number, height: number, owned: readonly string[]) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, saveWith(owned)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
}

const dough = (page: Page) => page.locator(".pizza-dough").first().boundingBox();

/** DOUGH done -> SAUCE (measure) -> CHEESE -> TOPPING. Returns the dough box on the SAUCE step. */
async function toTopping(page: Page) {
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  const sauceDough = await dough(page);
  await expect(page.getByRole("group", { name: "具材の絞り込み" })).toHaveCount(0); // sauce: never
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await expect(page.getByRole("group", { name: "具材の絞り込み" })).toHaveCount(0); // cheese: never
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
  return sauceDough;
}

const familyRow = (page: Page) => page.getByRole("group", { name: "具材の絞り込み" });
const chipIds = async (page: Page) =>
  page.locator(".ingredient-chip").evaluateAll((els) => els.map((e) => e.querySelector(".ingredient-chip__name")?.textContent ?? ""));
const nameToFamily = (name: string) => {
  const ing = ingredientsByCategory("topping").find((i) => i.nameJa === name);
  return ing ? ingredientShelf(ing.id) : null;
};

for (const vp of VIEWPORTS) {
  for (const hand of ["HAND on", "HAND off"] as const) {
    test(`tray family filter ${vp.width}x${vp.height} ${hand}`, async ({ page }, testInfo) => {
      runOnlyOnWidth(testInfo, vp.width);
      await boot(page, vp.width, vp.height, hand === "HAND on" ? HAND_ON_OWNED : HAND_OFF_OWNED);
      const sauceDough = await toTopping(page);

      // Visible on arrival, inside the viewport, bar still on screen, page does not scroll, pizza keeps its size.
      const row = familyRow(page);
      await expect(row).toBeVisible();
      const rowBox = (await row.boundingBox())!;
      expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(vp.height);
      const toppingDough = (await dough(page))!;
      expect(Math.abs(toppingDough.height - sauceDough!.height)).toBeLessThanOrEqual(1);
      const bar = (await page.locator(".prepare-bake-bar").boundingBox())!;
      expect(bar.y + bar.height).toBeLessThanOrEqual(vp.height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
      testInfo.annotations.push({ type: "measure", description: `${hand} dough ${Math.round(toppingDough.width)}px, family row ${Math.round(rowBox.height)}px high, bar bottom ${Math.round(bar.y + bar.height)}/${vp.height}` });
      await page.screenshot({ path: `${SHOT_DIR}/after-${vp.width}x${vp.height}-${hand.replace(" ", "-").toLowerCase()}-topping-arrival.png` });

      // Filter to the first real family chip: the tray holds only that family, page 1.
      const chips = row.getByRole("button");
      const labels = await chips.allTextContents();
      expect(labels[0]).toBe("すべて");
      expect(labels.length).toBeGreaterThanOrEqual(3);
      const before = await chipIds(page);
      await row.getByRole("button", { name: `${labels[1]}の具材だけ表示` }).click();
      const filtered = await chipIds(page);
      expect(filtered.length).toBeGreaterThan(0);
      const fams = new Set(filtered.map(nameToFamily));
      expect(fams.size).toBe(1);
      await expect(row.getByRole("button", { name: `${labels[1]}の具材だけ表示` })).toHaveAttribute("aria-pressed", "true");
      expect(filtered.length).toBeLessThanOrEqual(6);
      await page.screenshot({ path: `${SHOT_DIR}/after-${vp.width}x${vp.height}-${hand.replace(" ", "-").toLowerCase()}-filtered.png` });

      // Placing still works from a filtered tray, then すべて restores the original first page.
      await page.locator(".ingredient-chip").first().click();
      await tapDoughPercent(page, 50, 50);
      await row.getByRole("button", { name: "全ての具材を表示" }).click();
      expect(await chipIds(page)).toEqual(before);
    });
  }

  test(`tray family filter: page reset + pin kept + Pantry unchanged ${vp.width}x${vp.height}`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, vp.width);
    await boot(page, vp.width, vp.height, HAND_ON_OWNED);
    await toTopping(page);
    const row = familyRow(page);
    const labels = await row.getByRole("button").allTextContents();

    // Pin one ingredient in the Pantry (HAND active), close, then filter.
    await page.getByRole("button", { name: /食材庫/ }).click();
    await page.waitForSelector(".pantry-sheet");
    await expect(page.getByRole("group", { name: "具材の分類" })).toBeVisible(); // #392 Pantry family row unchanged
    const pinnable = page.locator(".pantry-tile__toggle[aria-pressed=false]").first();
    const pinnedName = ((await pinnable.textContent()) ?? "").trim();
    await pinnable.click();
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.waitForSelector(".pantry-sheet", { state: "detached" });

    // Page 2 -> filter -> page 1.
    const next = page.getByRole("button", { name: "次のページ" });
    if (await next.isEnabled().catch(() => false)) {
      await next.click();
      await expect(page.locator(".ingredient-page-nav__label")).toContainText("2 /");
    }
    await row.getByRole("button", { name: `${labels[1]}の具材だけ表示` }).click();
    await expect(page.locator(".ingredient-page-nav__label")).toContainText("1 /");

    // The pin and the hand are untouched by the filter.
    await row.getByRole("button", { name: "全ての具材を表示" }).click();
    await page.getByRole("button", { name: /食材庫/ }).click();
    await page.waitForSelector(".pantry-sheet");
    const pins = page.locator(".pantry-sheet__pins");
    await expect(pins).toContainText(pinnedName.slice(0, 2));
    await page.getByRole("button", { name: "閉じる" }).click();
  });
}
