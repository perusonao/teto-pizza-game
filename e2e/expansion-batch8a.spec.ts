import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Batch 8a representative E2E: three non-credit, zero-material recipes (no new ingredient, no new step, NO_SAUCE), each played end to end through the
 * normal Research flow -> NEW DISCOVERY -> Dex:
 *  - chilean-napolitana (key step 20, fresh-tomato): shares the tomato cohort with pesto-caprese -> the two Research entries read A / B (before Batch 8a: one bare entry);
 *  - spanish-chorizo-pizza (step 28, bell-pepper): its own cohort, bare label;
 *  - frango-catupiry (step 44, catupiry): shares the cohort with brazilian-catupiry-corn-pizza -> A / B.
 * Only the starting save is seeded (every other recipe found, every material owned and stocked); no recipe identity may reach the DOM before a discovery.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ALL_IDS = RECIPES.map((r) => r.id as string);
const LAST_STEP = DISCOVERY_LADDER.steps.length;
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
// Free Cooking judges the bake on the generic window (58-78); the recipes' own window is 56-76: the needle goes in their intersection.
const BAKE = { start: 58, end: 76 };

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

/** The chip whose NAME is exactly `name` (「トマト」 must not match チェリートマト / トマトソース), paged through the All-Owned Tray. */
async function chipNamed(page: Page, name: string) {
  const chip = page.locator(".ingredient-chip").filter({ has: page.locator(".ingredient-chip__name", { hasText: new RegExp(`^${name}$`) }) }).first();
  const next = page.getByRole("button", { name: "次のページ" });
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 8 && (await prev.isVisible().catch(() => false)) && (await prev.isEnabled().catch(() => false)); i += 1) await prev.click();
  for (let i = 0; i < 8 && !(await chip.isVisible()); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await expect(chip).toBeVisible();
  return chip;
}
async function place(page: Page, picks: [string, number][], startSpot: number) {
  let spot = startSpot;
  for (const [name, count] of picks) {
    await (await chipNamed(page, name)).click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  return spot;
}

async function researchCards(page: Page, discovered: readonly string[], project: string, shot: string) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
  await noOverflow(page, "Dex Research Entry");
  await capture(page, `${shot}-research-entry`, project);
  return page.locator(".dex-overlay__research").getByRole("button", { name: /を研究する$/ });
}
async function startResearch(page: Page, labelPattern: RegExp, discovered: readonly string[]) {
  await page.locator(".dex-overlay__research").getByRole("button", { name: labelPattern }).click();
  await expectResearchLead(page, "？？？ピザ");
  await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // NO_SAUCE: the player simply skips the sauce step
  await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
}
async function expectDiscovery(page: Page, nameJa: string, id: string, project: string, shot: string) {
  await page.waitForSelector(".result-panel");
  const discovery = page.locator(".result-panel--discovery");
  await expect(discovery).toBeVisible();
  await expect(discovery).toContainText(nameJa);
  await noOverflow(page, "NEW RECIPE");
  await capture(page, `${shot}-new-recipe`, project);
  await hold(page, 2500);
  await page.getByRole("button", { name: /ホーム/ }).first().click();
  await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
  await page.waitForSelector(".dex-overlay");
  await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
  const card = page.locator(".dex-card").filter({ hasText: nameJa });
  await expect(card).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  await noOverflow(page, "Dex");
  await capture(page, `${shot}-dex`, project);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
  expect(saved.schemaVersion).toBe(2);
  expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(id);
}

test.describe("Batch 8a (non-credit, zero-material: chilean-napolitana / spanish-chorizo-pizza / frango-catupiry)", () => {
  test.setTimeout(300_000);
  const watch = (page: Page) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    return errors;
  };

  test("chilean-napolitana: with pesto-caprese also open the tomato cohort reads A / B; cook mozzarella 2 / tomato 3 / oregano 1 -> NEW DISCOVERY", async ({ page }, testInfo) => {
    const errors = watch(page);
    const project = testInfo.project.name;
    // Both open: two anonymous entries in the same cohort (before Batch 8a: pesto-caprese alone, a bare label).
    const both = ALL_IDS.filter((id) => id !== "chilean-napolitana" && id !== "pesto-caprese");
    await open(page, saveJson(both, materialsUpTo(LAST_STEP)));
    const cards = await researchCards(page, both, project, "batch8a-chilean-pair");
    await expect(cards).toHaveCount(2);
    const names = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    expect(names.map((n) => n.replace(/\s/g, "")).sort()).toEqual(["？？？ピザA（トマト）を研究する", "？？？ピザB（トマト）を研究する"]);

    // Cook the chilean one: only pesto-caprese stays open afterwards.
    const discovered = ALL_IDS.filter((id) => id !== "chilean-napolitana");
    await open(page, saveJson(discovered, materialsUpTo(LAST_STEP)));
    await researchCards(page, discovered, project, "batch8a-chilean");
    await startResearch(page, /？？？ピザ( [A-Z]+)?（トマト）を研究する$/, discovered);
    let spot = await place(page, [["モッツァレラ", 2]], 0);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await capture(page, "batch8a-chilean-tray", project);
    spot = await place(page, [["トマト", 3], ["オレガノ", 1]], spot);
    await bakeToTarget(page, BAKE);
    await expectDiscovery(page, "チリアン・ナポリターナ", "chilean-napolitana", project, "batch8a-chilean");
    expect(errors).toEqual([]);
  });

  test("spanish-chorizo-pizza: its own bell-pepper cohort (bare label); cook mozzarella 2 / sausage 3 / bell-pepper 2 / onion 1 -> NEW DISCOVERY", async ({ page }, testInfo) => {
    const errors = watch(page);
    const project = testInfo.project.name;
    const discovered = ALL_IDS.filter((id) => id !== "spanish-chorizo-pizza");
    await open(page, saveJson(discovered, materialsUpTo(LAST_STEP)));
    const cards = await researchCards(page, discovered, project, "batch8a-chorizo");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute("aria-label", "？？？ピザ（パプリカ）を研究する");
    await startResearch(page, /^？？？ピザ（パプリカ）を研究する$/, discovered);
    let spot = await place(page, [["モッツァレラ", 2]], 0);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await capture(page, "batch8a-chorizo-tray", project);
    spot = await place(page, [["ソーセージ", 3], ["パプリカ", 2], ["たまねぎ", 1]], spot);
    await bakeToTarget(page, BAKE);
    await expectDiscovery(page, "スパニッシュ・チョリソ", "spanish-chorizo-pizza", project, "batch8a-chorizo");
    expect(errors).toEqual([]);
  });

  test("frango-catupiry: with brazilian-catupiry-corn-pizza also open the catupiry cohort reads A / B; cook mozzarella 2 / chicken 3 / catupiry 2 / oregano 1 -> NEW DISCOVERY", async ({ page }, testInfo) => {
    const errors = watch(page);
    const project = testInfo.project.name;
    const both = ALL_IDS.filter((id) => id !== "frango-catupiry" && id !== "brazilian-catupiry-corn-pizza");
    await open(page, saveJson(both, materialsUpTo(LAST_STEP)));
    const cards = await researchCards(page, both, project, "batch8a-frango-pair");
    await expect(cards).toHaveCount(2);
    const names = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    expect(names.map((n) => n.replace(/\s/g, "")).sort()).toEqual(["？？？ピザA（カトゥピリ）を研究する", "？？？ピザB（カトゥピリ）を研究する"]);

    const discovered = ALL_IDS.filter((id) => id !== "frango-catupiry");
    await open(page, saveJson(discovered, materialsUpTo(LAST_STEP)));
    await researchCards(page, discovered, project, "batch8a-frango");
    await startResearch(page, /？？？ピザ( [A-Z]+)?（カトゥピリ）を研究する$/, discovered);
    let spot = await place(page, [["モッツァレラ", 2], ["カトゥピリ", 2]], 0); // catupiry is a cheese-category material
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await capture(page, "batch8a-frango-tray", project);
    spot = await place(page, [["チキン", 3], ["オレガノ", 1]], spot);
    await bakeToTarget(page, BAKE);
    await expectDiscovery(page, "フランゴ・カトゥピリ", "frango-catupiry", project, "batch8a-frango");
    expect(errors).toEqual([]);
  });
});
