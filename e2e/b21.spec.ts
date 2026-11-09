import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { CATALOG_COUNTS, materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Expansion Batch 21 representative E2E (Issue #780, B21 / RB-01; the late catalog: cheddar + lettuce + tortilla-chips -> taco-pizza, okonomiyaki-sauce + cabbage + bonito-flakes -> okonomiyaki-style-pizza). Both recipes played end to end:
 * the sauce painted (existing PAINT), the pieces placed before the bake, the bake, the POST_BAKE garnishes placed in FINISH, NEW DISCOVERY. The 10-11 pieces use the RT-01 multi-ring Reference.
 * Counts, names, colours and the emoji pieces (no dedicated SVG yet) are PROVISIONAL / GAMEPLAY ASSUMPTIONS (the original pizzadb.jp was not confirmed); judged on the screenshots.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const STEP_TACO = DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes("cheddar"))!.step; // 79, derived
const STEP_OKONOMIYAKI = DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes("okonomiyaki-sauce"))!.step; // 80, derived
const ALL_IDS = RECIPES.map((r) => r.id as string);
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
    unlockedForShopIngredientIds: [...owned],
  });

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const isRootFaviconProbe = (url: string) => new URL(url).pathname === "/favicon.ico";
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

interface Plan {
  id: string;
  name: string;
  tag: string;
  step: number;
  sauce: RegExp;
  cheese: { chip: RegExp; n: number } | null;
  pre: { chip: RegExp; n: number }[];
  post: { chip: RegExp; n: number }[];
  researchKey: string;
}

const TOMATO = /(?<!チェリー)トマト(?!ソース)/;
const PLANS: Plan[] = [
  { id: "taco-pizza", name: "タコピザ", tag: "b21-taco", step: STEP_TACO, sauce: /トマトソース/, cheese: { chip: /チェダー/, n: 2 }, pre: [{ chip: /牛肉/, n: 3 }, { chip: TOMATO, n: 2 }], post: [{ chip: /レタス/, n: 2 }, { chip: /トルティーヤ/, n: 2 }], researchKey: "トルティーヤチップス" },
  { id: "okonomiyaki-style-pizza", name: "お好み焼き風ピザ", tag: "b21-okonomiyaki", step: STEP_OKONOMIYAKI, sauce: /お好み焼きソース/, cheese: null, pre: [{ chip: /キャベツ/, n: 3 }, { chip: /豚肉/, n: 3 }, { chip: /マヨ/, n: 1 }, { chip: /かつお節/, n: 2 }], post: [{ chip: /のり/, n: 1 }], researchKey: "かつお節" },
];

test.describe("Expansion Batch 21 (representative: taco-pizza and okonomiyaki-style-pizza, played end to end)", () => {
  test.setTimeout(300_000);

  for (const plan of PLANS) {
    test(`${plan.id}: paint the new sauce, place the pieces, bake, place the garnishes in FINISH -> NEW DISCOVERY -> Dex`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && !isRootFaviconProbe(m.location().url) && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      const project = testInfo.project.name;
      const discovered = ALL_IDS.filter((id) => id !== plan.id);
      await page.goto("icons/icon-16.png");
      await page.evaluate(([key, value]) => {
        localStorage.clear();
        localStorage.setItem(key, value);
      }, [SAVE_KEY, saveJson(discovered, materialsUpTo(plan.step))] as const);
      await page.goto("/");
      await page.waitForSelector(".app-frame");
      await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
      await hold(page);

      // Dex -> the single Research Entry for the recipe (only the cohort key is named).
      await page.getByRole("button", { name: /ピザ図鑑/ }).click();
      await page.waitForSelector(".dex-overlay");
      await page.locator(".dex-overlay__research").getByRole("button", { name: new RegExp(`^？？？ピザ（${plan.researchKey}）を研究する$`) }).click();
      await page.waitForSelector(".pizza-stage");
      await completeDoughStep(page);
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
      await (await chipOnTrayOrPin(page, plan.sauce)).click();
      await capture(page, `${plan.tag}-tray-sauce`, project);
      await paintSauceRing(page, 25, 16);
      await hold(page, 2200);
      await capture(page, `${plan.tag}-sauce-painted`, project);
      await noOverflow(page, "sauce painted");
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      let k = 0;
      // The CHEESE tab is always there; a recipe without cheese (okonomiyaki) simply moves on without placing any.
      await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
      if (plan.cheese) {
        await (await chipOnTrayOrPin(page, plan.cheese.chip)).click();
        for (let i = 0; i < plan.cheese.n; i += 1) await tapDoughPercent(page, ...SPOTS[k++ % SPOTS.length]);
      }
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
      for (const { chip, n } of plan.pre) {
        await (await chipOnTrayOrPin(page, chip)).click();
        for (let i = 0; i < n; i += 1) await tapDoughPercent(page, ...SPOTS[k++ % SPOTS.length]);
      }
      await capture(page, `${plan.tag}-topped`, project);
      await hold(page, 2000);

      await bakeToTarget(page, { start: 60, end: 76 }, { finish: false });
      await expect(page.getByTestId("finish-dock")).toBeVisible();
      await capture(page, `${plan.tag}-finish`, project);
      await hold(page, 1800);
      for (const { chip, n } of plan.post) {
        await (await chipOnTrayOrPin(page, chip)).click();
        for (let i = 0; i < n; i += 1) await tapDoughPercent(page, ...SPOTS[k++ % SPOTS.length]);
      }
      await expect(page.getByTestId("finish-undo")).toBeEnabled();
      await noOverflow(page, "finish garnish placed");
      await capture(page, `${plan.tag}-finish-garnish`, project);
      await hold(page, 2200);
      await page.getByTestId("finish-complete").click();
      await page.waitForSelector(".result-panel");

      const discovery = page.locator(".result-panel--discovery");
      await expect(discovery).toBeVisible();
      await expect(discovery).toContainText(plan.name);
      await noOverflow(page, "NEW RECIPE");
      await capture(page, `${plan.tag}-new-recipe`, project);
      await hold(page, 3000);

      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
      expect(saved.schemaVersion).toBe(2);
      expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(plan.id);
      expect(errors).toEqual([]);
    });
  }

  test("a never-launched save at the ladder step it shipped at (none of the six B21 materials in its ledger) is granted all six on the first launch, and opening the Shop rewrites nothing", async ({ page }) => {
    const discovered = ALL_IDS.filter((id) => id !== "taco-pizza" && id !== "okonomiyaki-style-pizza");
    const NEW = ["cheddar", "lettuce", "tortilla-chips", "okonomiyaki-sauce", "cabbage", "bonito-flakes"];
    const withoutNew = materialsUpTo(STEP_OKONOMIYAKI).filter((m) => !NEW.includes(m));
    await page.goto("icons/icon-16.png");
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [SAVE_KEY, saveJson(discovered, withoutNew)] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    for (const id of NEW) {
      const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
      await row.scrollIntoViewIfNeeded();
      await expect(row, id).toHaveAttribute("data-shop-state", "NEW");
    }
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.dex).toHaveLength(discovered.length);
  });
});
