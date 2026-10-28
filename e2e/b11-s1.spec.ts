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
 * B11 S1 representative E2E (PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): boscaiola, porcini-pizza and pescatore played end to end at 390x844 and 360x800.
 *  - boscaiola: porcini (the step's only material; the key recipe) -> olive-oil (the existing PAINT_TEMPORARY gesture) -> mozzarella -> porcini + sausage.
 *  - porcini-pizza: NO_SAUCE (the SAUCE step is skipped with no sauce painted); its Research label carries the cohort letter A (shared unlock material porcini).
 *  - pescatore: mussel (the step's only material) -> tomato-sauce only (the olive-oil of the source ingredient set is omitted: Owner decision, option A) -> shrimp / clam / mussel / garlic / parsley.
 * Counts, the generic 58-78 bake window, colours, glyphs, names and the SVG shapes are provisional. Step numbers are DERIVED from the ladder, never hard-coded.
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
  /** Shop rows of the step: [ingredient id, nameJa, shot slug]. */
  materials: readonly [string, string, string][];
  /** The Research Entry label: only the unlock material (and the cohort letter, where the cohort has two members) is named. */
  label: string;
  /** null = NO_SAUCE: no sauce is painted (the SAUCE step is skipped). */
  sauce: RegExp | null;
  cheese: [RegExp, number][];
  toppings: [RegExp, number][];
}
const CASES: readonly Case[] = [
  {
    id: "boscaiola",
    nameJa: "ボスカイオーラ",
    materials: [["porcini", "ポルチーニ", "b11-porcini"]],
    label: "？？？ピザ B（ポルチーニ）",
    sauce: /オリーブオイル/,
    cheese: [[/モッツァレラ/, 2]],
    toppings: [[/ポルチーニ/, 3], [/ソーセージ/, 3]],
  },
  {
    id: "porcini-pizza",
    nameJa: "ポルチーニ茸のピザ",
    materials: [["porcini", "ポルチーニ", "b11-porcini"]],
    label: "？？？ピザ A（ポルチーニ）",
    sauce: null,
    cheese: [[/モッツァレラ/, 3]],
    toppings: [[/ポルチーニ/, 3], [/にんにく/, 1], [/パセリ/, 1]],
  },
  {
    id: "pescatore",
    nameJa: "ペスカトーレ",
    materials: [["mussel", "ムール貝", "b11-mussel"]],
    label: "？？？ピザ（ムール貝）",
    sauce: /トマトソース/,
    cheese: [[/モッツァレラ/, 2]],
    toppings: [[/エビ/, 2], [/あさり/, 1], [/ムール貝/, 1], [/にんにく/, 1], [/パセリ/, 1]],
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

test.describe("B11 S1 (boscaiola / porcini-pizza / pescatore, played end to end)", () => {
  test.setTimeout(300_000);

  for (const c of CASES) {
    test(`${c.id}: Shop NEW -> purchase -> Research (no leak) -> ${c.sauce ? "paint" : "skip the sauce"}, cheese, toppings -> NEW DISCOVERY -> Dex`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && !new URL(m.location().url || "http://x/").pathname.endsWith("/favicon.ico") && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      const project = testInfo.project.name;
      const step = DISCOVERY_LADDER.steps.findIndex((s) => s.ingredientIds.includes(c.materials[0][0])) + 1;
      // This save has played everything but the target; it owns every material before the target's step.
      const discovered = ALL_IDS.filter((id) => id !== c.id);
      await open(page, saveJson(discovered, materialsUpTo(step - 1)));
      await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
      await hold(page);

      // 1. Shop: the step's material is NEW (T4: 120 Pitz, no star gate).
      await page.getByRole("button", { name: /ショップ/ }).click();
      await page.waitForSelector(".shop-overlay__panel");
      for (const [id, nameJa, shot] of c.materials) {
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
      }
      await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
      await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

      // 2. Dex -> the single Research Entry: only the unlock material (and the cohort letter) is named.
      await page.getByRole("button", { name: /ピザ図鑑/ }).click();
      await page.waitForSelector(".dex-overlay");
      await expect(page.locator(".dex-overlay__research")).toContainText(c.label);
      await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
      await noOverflow(page, "Dex Research Entry");
      await capture(page, `b11-${c.id}-research-entry`, project);
      await hold(page, 2000);
      await page.locator(".dex-overlay__research").getByRole("button", { name: new RegExp(`^${c.label}を研究する$`) }).click();
      await expectResearchLead(page, "？？？ピザ");
      await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");

      // 3. Cooking: [SAUCE (the existing PAINT gesture),] CHEESE, TOPPING.
      await page.waitForSelector(".pizza-stage");
      await completeDoughStep(page);
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      if (c.sauce) {
        await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
        await (await chipOnTrayOrPin(page, c.sauce)).click();
        await capture(page, `b11-${c.id}-tray-sauce`, project);
        await paintSauceRing(page, 25, 16);
        await hold(page, 2200);
        await capture(page, `b11-${c.id}-sauce-painted`, project);
        await noOverflow(page, "sauce painted");
        await bar(page).getByRole("button", { name: /次へ/ }).click();
      } else {
        // NO_SAUCE: a Research round still offers the SAUCE step (the player does not know the recipe); choosing no sauce is how the recipe is made.
        await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
        await capture(page, `b11-${c.id}-no-sauce-step`, project);
        await bar(page).getByRole("button", { name: /次へ/ }).click();
      }
      await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
      let spot = await place(page, c.cheese, 0);
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
      await capture(page, `b11-${c.id}-tray-topping`, project);
      spot = await place(page, c.toppings, spot);
      await capture(page, `b11-${c.id}-topped`, project);
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
      await capture(page, `b11-${c.id}-new-recipe`, project);
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
      await capture(page, `b11-${c.id}-dex`, project);
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
      expect(saved.schemaVersion).toBe(2);
      expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(c.id);
      expect(errors).toEqual([]);
    });
  }
});
