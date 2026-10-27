import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DISCOVERY_LADDER } from "../../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { chipOnTrayOrPin } from "../../e2e/support/handPick";

/**
 * Issue #676 pre-implementation Gate: is the hint sheet really available after a FAILED round in a targetless Free Cook
 * (production-reachable states, no test hook), and does the existing path (RETRY_SAME_RECIPE + SHOW_HINT, what
 * `handleRetryWithHint` dispatches) give the SAME sheet after FAILED as after ORIGINAL? Observation only.
 * Paths: (O1) ORIGINAL -> the existing RESULT 「💡 ヒントを見る」; (O2) ORIGINAL -> 「もう一度試す」 -> ヒント;
 *        (F2) FAILED  -> 「もう一度試す」 -> ヒント  (what C1 would do in one click).
 */
const OUT_DIR = process.env.OUT_DIR ?? "docs/reports/screenshots/discovery-failure-guidance";
const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const RAW_BAKE = { start: 3, end: 15 };
const base = { schemaVersion: 2, pitzBalance: 999, missionBest: {}, starterGrantClaimedRecipeIds: [] as string[] };
const dexOf = (ids: readonly string[]) => ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds as readonly string[]);
const keysBefore = DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId);
const step1 = DISCOVERY_LADDER.steps[0];
type Scenario = { id: string; save: object | null; research: boolean; topping: RegExp };
const SCENARIOS: Scenario[] = [
  { id: "fresh-save", save: null, research: false, topping: /バジル/ },
  { id: "shop-new", save: { ...base, dex: dexOf(["margherita"]), ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], inventory: { "tomato-sauce": 9, mozzarella: 9, basil: 9 }, unlockedForShopIngredientIds: [...step1.ingredientIds] }, research: false, topping: /バジル/ },
  { id: "research", save: { ...base, dex: dexOf(["margherita", ...keysBefore, "brazilian-calabresa", "aussie", "chilean-napolitana", "grandma-pizza"]), ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials], inventory: Object.fromEntries(materials.map((m) => [m, 30])), unlockedForShopIngredientIds: materials }, research: true, topping: /ナス/ },
];
const bar = (page: Page) => page.locator(".prepare-bake-bar");
async function open(page: Page, sc: Scenario) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, v); }, [SAVE_KEY, sc.save ? JSON.stringify(sc.save) : ""] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  if (sc.research) {
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
  } else {
    await page.getByRole("button", { name: /レシピ発見/ }).first().click();
  }
  await page.waitForSelector(".pizza-stage");
}
async function cook(page: Page, topping: RegExp, bake: { start: number; end: number }) {
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await (await chipOnTrayOrPin(page, topping)).click();
  await tapDoughPercent(page, 44, 44);
  await bakeToTarget(page, bake);
  await page.waitForSelector(".result-panel");
}
const sheet = (page: Page) =>
  page.evaluate(() => {
    const d = document.querySelector('[role="dialog"], .hint-sheet') as HTMLElement | null;
    return d ? d.innerText.split("\n").map((s) => s.trim()).filter(Boolean) : null;
  });
const panelKind = (page: Page) => page.evaluate(() => (document.querySelector(".result-panel") as HTMLElement | null)?.className ?? null);

test("retry path: sheet after ORIGINAL vs after FAILED (production-reachable, hook-free)", async ({ page }) => {
  test.setTimeout(300_000);
  mkdirSync(OUT_DIR, { recursive: true });
  const out: Record<string, unknown> = {};
  for (const sc of SCENARIOS) {
    const rec: Record<string, unknown> = {};
    // O1: ORIGINAL -> RESULT 「ヒントを見る」
    await open(page, sc);
    await cook(page, sc.topping, FREE_BAKE);
    rec.O1_panel = await panelKind(page);
    const hintBtn = page.getByRole("button", { name: /ヒントを見る/ });
    rec.O1_hasHintButtonOnResult = (await hintBtn.count()) > 0;
    if (rec.O1_hasHintButtonOnResult) {
      await hintBtn.first().click();
      await page.waitForTimeout(300);
      rec.O1_sheet = await sheet(page);
      await page.screenshot({ path: `${OUT_DIR}/retry-${sc.id}-O1-sheet.png` });
    }
    // O2: ORIGINAL -> もう一度試す -> ヒント
    await open(page, sc);
    await cook(page, sc.topping, FREE_BAKE);
    await page.getByRole("button", { name: "もう一度試す" }).click();
    await page.waitForSelector(".pizza-stage");
    await page.getByRole("button", { name: /^ヒント$/ }).first().click();
    await page.waitForTimeout(300);
    rec.O2_sheet = await sheet(page);
    // F2: FAILED -> もう一度試す -> ヒント
    await open(page, sc);
    await cook(page, sc.topping, RAW_BAKE);
    rec.F2_panel = await panelKind(page);
    rec.F2_hasHintButtonOnResult = (await page.getByRole("button", { name: /ヒントを見る/ }).count()) > 0;
    await page.getByRole("button", { name: "もう一度試す" }).click();
    await page.waitForSelector(".pizza-stage");
    await page.getByRole("button", { name: /^ヒント$/ }).first().click();
    await page.waitForTimeout(300);
    rec.F2_sheet = await sheet(page);
    await page.screenshot({ path: `${OUT_DIR}/retry-${sc.id}-F2-sheet.png` });
    const j = (x: unknown) => JSON.stringify(x);
    rec.O1_equals_O2 = rec.O1_sheet !== undefined ? j(rec.O1_sheet) === j(rec.O2_sheet) : null;
    rec.O2_equals_F2 = j(rec.O2_sheet) === j(rec.F2_sheet);
    rec.sheetAvailableAfterFailed = rec.F2_sheet !== null;
    out[sc.id] = rec;
  }
  writeFileSync(`${OUT_DIR}/retrypath-390x844.json`, JSON.stringify(out, null, 2));
});
