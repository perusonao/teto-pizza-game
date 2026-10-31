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
 * Expansion Batch 12 representative E2E (Issue #707; PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): supreme-pizza and pizza-alla-norma played end to end at 390x844 and 360x800 (Free Cooking's Research round).
 *  - supreme-pizza: no new material (non-credit, no Shop row); its Research label shares the bell-pepper cohort with spanish-chorizo-pizza (A); tomato-sauce PAINT, no cheese-category ingredient, six toppings.
 *  - pizza-alla-norma: ricotta-salata (the step's only material; a cheese drawn by its own SVG) -> tomato-sauce -> ricotta-salata -> eggplant + basil.
 * Counts, the generic 58-78 bake window, colours, names and the SVG shape are provisional. Step numbers are DERIVED from the ladder, never hard-coded.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ALL_IDS = RECIPES.map((r) => r.id as string);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];

interface Case {
  id: string;
  nameJa: string;
  /** The ladder material whose step the save has not reached (Shop NEW row), or null when the recipe adds no material. */
  newMaterial: readonly [string, string, string] | null;
  /** The ladder material whose step bounds what the save owns. */
  boundMaterial: string;
  /** The Research Entry label: only the unlock material (and the cohort letter, where the cohort has two members) is named. */
  label: string;
  sauce: RegExp;
  cheese: [RegExp, number][];
  toppings: [RegExp, number][];
}
const CASES: readonly Case[] = [
  {
    id: "supreme-pizza",
    nameJa: "スプリームピッツァ",
    newMaterial: null,
    boundMaterial: "bell-pepper",
    label: "？？？ピザ A（パプリカ）",
    sauce: /トマトソース/,
    cheese: [],
    toppings: [[/ペパロニ/, 2], [/ソーセージ/, 2], [/マッシュルーム/, 1], [/たまねぎ/, 1], [/パプリカ/, 1], [/ブラックオリーブ/, 1]],
  },
  {
    id: "pizza-alla-norma",
    nameJa: "ピッツァ・アッラ・ノルマ",
    newMaterial: ["ricotta-salata", "リコッタサラータ", "b12-ricotta-salata"],
    boundMaterial: "ricotta-salata",
    label: "？？？ピザ（リコッタサラータ）",
    sauce: /トマトソース/,
    cheese: [[/リコッタサラータ/, 3]],
    toppings: [[/ナス/, 3], [/バジル/, 2]],
  },
];

const saveJson = (discovered: readonly string[], owned: readonly string[]) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    // The step's materials are deliberately NOT listed: load-time entitlement (the ladder) must grant them.
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

test.describe("Expansion Batch 12 (supreme-pizza / pizza-alla-norma, played end to end)", () => {
  test.setTimeout(300_000);

  for (const c of CASES) {
    test(`${c.id}: ${c.newMaterial ? "Shop NEW -> purchase" : "no Shop row"} -> Research (no leak) -> paint, cheese, toppings -> NEW DISCOVERY -> Dex`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && !new URL(m.location().url || "http://x/").pathname.endsWith("/favicon.ico") && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      const project = testInfo.project.name;
      const step = DISCOVERY_LADDER.steps.findIndex((s) => s.ingredientIds.includes(c.boundMaterial)) + 1;
      // This save has played everything but the target; it owns every material before the target's step.
      const discovered = ALL_IDS.filter((id) => id !== c.id);
      // A non-credit recipe adds no step: the save owns everything up to and including the step of its last-unlocking material.
      await open(page, saveJson(discovered, materialsUpTo(c.newMaterial ? step - 1 : step)));
      await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
      await hold(page);

      // 1. Shop: the step's material is NEW (T4: 120 Pitz, no star gate). supreme-pizza adds none: its materials are all owned, so there is nothing new to buy.
      await page.getByRole("button", { name: /ショップ/ }).click();
      await page.waitForSelector(".shop-overlay__panel");
      if (c.newMaterial) {
        const [id, nameJa, shot] = c.newMaterial;
        const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toHaveCount(1);
        await expect(row).toHaveAttribute("data-shop-state", "NEW");
        await expect(row).toContainText(nameJa);
        await expect(row).toContainText(/ピザ分/);
        await expect(row).toContainText(/初回 .*120 Pitz/);
        await noOverflow(page, `shop NEW ${id}`);
        await capture(page, `${shot}-new`, project);
        await hold(page, 2000);
        await row.locator(".shop-item__buy-button").click();
        await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
      } else {
        // (Other NEW rows may show: this save has played every other recipe, so the ladder has granted every later material. None belongs to supreme-pizza.)
        await expect(page.locator('.shop-item[data-ingredient-id="bell-pepper"][data-shop-state="NEW"]')).toHaveCount(0);
        await noOverflow(page, "shop (no NEW row)");
        await capture(page, `b12-${c.id}-shop-no-new`, project);
        await hold(page, 2000);
      }
      await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
      await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

      // 2. Dex -> the single Research Entry: only the unlock material (and the cohort letter) is named.
      await page.getByRole("button", { name: /ピザ図鑑/ }).click();
      await page.waitForSelector(".dex-overlay");
      await expect(page.locator(".dex-overlay__research")).toContainText(c.label);
      await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
      await noOverflow(page, "Dex Research Entry");
      await capture(page, `b12-${c.id}-research-entry`, project);
      await hold(page, 2000);
      await page.locator(".dex-overlay__research").getByRole("button", { name: new RegExp(`^${c.label}を研究する$`) }).click();
      await expectResearchLead(page, "？？？ピザ");
      await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");

      // 3. Cooking: SAUCE (the existing PAINT gesture), [CHEESE,] TOPPING.
      await page.waitForSelector(".pizza-stage");
      await completeDoughStep(page);
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
      await (await chipOnTrayOrPin(page, c.sauce)).click();
      await capture(page, `b12-${c.id}-tray-sauce`, project);
      await paintSauceRing(page, 25, 16);
      await hold(page, 2200);
      await capture(page, `b12-${c.id}-sauce-painted`, project);
      await noOverflow(page, "sauce painted");
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      // A Research round shows the CHEESE step whether or not the recipe has a cheese (the player does not know the recipe): supreme-pizza places none.
      await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
      if (c.cheese.length > 0) await capture(page, `b12-${c.id}-tray-cheese`, project);
      let spot = await place(page, c.cheese, 0);
      if (c.cheese.length > 0) {
        await capture(page, `b12-${c.id}-cheese-placed`, project);
        await hold(page, 1800);
      }
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
      await capture(page, `b12-${c.id}-tray-topping`, project);
      spot = await place(page, c.toppings, spot);
      await capture(page, `b12-${c.id}-topped`, project);
      await noOverflow(page, "topped");
      await hold(page, 2000);
      // Free Cooking judges the bake on the generic window (58-78), which is also the recipe's own window: aim inside both.
      await bakeToTarget(page, { start: 60, end: 76 });
      await page.waitForSelector(".result-panel");

      // 4. NEW DISCOVERY.
      const discovery = page.locator(".result-panel--discovery");
      await expect(discovery).toBeVisible();
      await expect(discovery).toContainText(c.nameJa);
      await noOverflow(page, "NEW RECIPE");
      await capture(page, `b12-${c.id}-new-recipe`, project);
      await hold(page, 3000);

      // 5. Dex: complete; schema v2 unchanged.
      await page.getByRole("button", { name: /ホーム/ }).first().click();
      await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
      await page.waitForSelector(".dex-overlay");
      await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
      const card = page.locator(".dex-card").filter({ hasText: c.nameJa });
      await expect(card).toHaveCount(1);
      await card.scrollIntoViewIfNeeded();
      await noOverflow(page, "Dex");
      await capture(page, `b12-${c.id}-dex`, project);
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
      expect(saved.schemaVersion).toBe(2);
      expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(c.id);
      expect(errors).toEqual([]);
    });
  }
});
