import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Discovery 3.0 No.27 Vertical Slice (pesto-pollo + chicken), played for real on both iPhone widths.
 *
 * Save: the 25 credited W1 recipes + the non-credit calabresa found (Case B), every W1 material owned and
 * stocked, 999 Pitz. Step 25 is reached, so `chicken` is entitled but not bought. Pool = pesto-pollo only.
 *
 * Shop: chicken is NEW (T3 first pack 100 Pitz) -> purchase. Hint: key-free sheet. FREE: a trial without
 * chicken is recorded in the Trial Notebook, the retry with chicken shows "＋ チキン" in the diff and
 * discovers NEW RECIPE (ペストポッロピザ). Dex: No.27 in 第3章 (11 slots), schema v2 unchanged.
 *
 * Optional output: HV_SCREENSHOT_DIR.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 50, end: 70 };
const W1: [string, string[]][] = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]], ["pizza-portuguesa", ["onion"]], ["fugazza", ["olive-oil"]],
  ["marinara", ["garlic"]], ["napoletana", ["anchovy"]], ["tonno-e-cipolla", ["tuna"]], ["pesto-tonno", ["pesto"]],
  ["genovese", ["cherry-tomato"]], ["new-haven-apizza", ["clam"]], ["pesto-caprese", ["fresh-tomato"]],
  ["pesto-patate", ["potato"]], ["pizza-bianca", ["rosemary"]], ["puttanesca-pizza", ["capers"]],
  ["quattro-formaggi", ["fontina", "gorgonzola"]],
];
const DISCOVERED = [...W1.map(([id]) => id), "brazilian-calabresa"];
const materials = W1.flatMap(([, m]) => m);
const SAVE = {
  schemaVersion: 2,
  dex: DISCOVERED.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};

const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hintSheet = (page: Page) => page.getByRole("dialog", { name: /^💡 ヒント/ });
const notebook = (page: Page) => page.getByRole("dialog", { name: /試作ノート/ });

async function capture(page: Page, name: string, projectName: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${projectName}.png` });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

/** Selects a tray chip, paging the tray (the free-cook tray has several pages). */
async function pickChip(page: Page, name: RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name }).first();
  const prev = page.getByRole("button", { name: "前のページ" });
  const next = page.getByRole("button", { name: "次のページ" });
  // The sauce / cheese trays have no pager, so never wait on a pager button that is not there.
  const enabled = async (b: ReturnType<Page["getByRole"]>) => (await b.count()) > 0 && (await b.isEnabled());
  for (let i = 0; i < 8 && (await enabled(prev)); i += 1) await prev.click();
  for (let i = 0; i < 8 && !(await chip.isVisible()); i += 1) {
    if (!(await enabled(next))) break;
    await next.click();
  }
  await chip.click();
}

/** One FREE round: pesto, mozzarella x2, tomato x2, chicken x`chicken` (+ oregano x`oregano` as an extra, making an ORIGINAL). */
async function cookPestoPollo(page: Page, opts: { chicken: number; oregano?: number; from: "HOME" | "RESULT" }) {
  if (opts.from === "HOME") await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  else await page.getByRole("button", { name: /もう一度じゆうに作る/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await pickChip(page, /ジェノベーゼ|ペスト/);
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  let spot = 0;
  await pickChip(page, /モッツァレラ/);
  for (let i = 0; i < 2; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await pickChip(page, /(?<!チェリー)トマト(?!ソース)/);
  for (let i = 0; i < 2; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  if (opts.chicken > 0) {
    await pickChip(page, /チキン/);
    for (let i = 0; i < opts.chicken; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  if (opts.oregano) {
    await pickChip(page, /オレガノ/);
    for (let i = 0; i < opts.oregano; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

test.describe("Discovery 3.0 No.27: pesto-pollo + chicken", () => {
  test.setTimeout(300_000);

  test("Shop(chicken NEW -> buy) -> Hint(key-free) -> FREE trial -> Notebook diff -> NEW RECIPE -> Dex No.27", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;

    await page.goto("icons/icon-16.png");
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
      localStorage.setItem("teto.dev.hint5Ladder", "0");
    }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/26\/27/);

    // Shop: step 25 reached, chicken is NEW and not bought yet.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const chicken = page.locator('.shop-item[data-ingredient-id="chicken"]');
    await expect(chicken).toHaveCount(1);
    await expect(chicken).toHaveAttribute("data-shop-state", "NEW");
    await expect(chicken).toContainText("チキン");
    await expect(chicken).toContainText("10ピザ分（30個）");
    await expect(chicken).toContainText(/初回 .*100 Pitz/);
    await noOverflow(page);
    await chicken.scrollIntoViewIfNeeded();
    await capture(page, "no27-shop-chicken-new", project);
    await chicken.locator(".shop-item__buy-button").click();
    await expect(chicken).not.toHaveAttribute("data-shop-state", "NEW");
    await expect(chicken).toContainText("在庫 30");
    await capture(page, "no27-shop-chicken-bought", project);
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // FREE: Hint at the topping step is the key-free sheet for the lone candidate (no recipe name / count).
    await page.getByRole("button", { name: /フリークッキング/ }).first().click();
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await pickChip(page, /ジェノベーゼ|ペスト/);
    await paintSauceRing(page, 25, 16);
    await page.getByRole("button", { name: "ヒント", exact: true }).click();
    const sheet = hintSheet(page);
    await expect(sheet).toBeVisible();
    await expect(sheet).not.toHaveAttribute("data-hint-kind", "OPEN_POOL");
    const text = await sheet.innerText();
    expect(text).not.toContain("ペストポッロ");
    expect(text).not.toMatch(/候補|距離|似て|近い|遠い|[0-9０-９]+\s*(種類|件)/);
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "key-free Hint sheet");
    await noOverflow(page);
    await capture(page, "no27-hint-key-free", project);
    await sheet.getByRole("button", { name: "閉じる" }).click();
    // leave this round: back to Home through the existing exit, then play the real trial from Home.
    await page.reload();
    await page.waitForSelector(".app-frame");

    // Trial without chicken (incomplete): recorded, says nothing about the hidden recipe.
    await cookPestoPollo(page, { chicken: 0, from: "HOME" });
    await expect(page.locator(".result-panel--discovery")).toHaveCount(0);
    await expect(page.locator(".result-panel--original")).toBeVisible();
    await capture(page, "no27-trial-without-chicken", project);

    // Retry with chicken: NEW RECIPE DISCOVERED.
    await cookPestoPollo(page, { chicken: 3, from: "RESULT" });
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ペストポッロピザ");
    await noOverflow(page);
    await capture(page, "no27-new-recipe-discovered", project);

    // Dex: No.27, chapter 3 now 11 slots, 27 total; schema unchanged.
    await page.getByRole("button", { name: /図鑑を見る/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(/27\s*\/\s*27/);
    const card = page.locator(".dex-card").filter({ hasText: "ペストポッロピザ" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("No.11"); // chapter-relative slot 11 of 第3章
    await expect(page.locator(".dex-overlay__chapter-title").last()).toContainText("11/11");
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page);
    await capture(page, "no27-dex-no27", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain("pesto-pollo");
    expect(errors).toEqual([]);
  });

  test("Notebook: a retry adding chicken shows the player's own diff (＋ チキン), nothing about any recipe", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await page.goto("icons/icon-16.png");
    const save = {
      ...SAVE,
      ownedIngredientIds: [...SAVE.ownedIngredientIds, "chicken"],
      inventory: { ...SAVE.inventory, chicken: 30 },
      unlockedForShopIngredientIds: [...materials, "chicken"],
    };
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
      localStorage.setItem("teto.dev.hint5Ladder", "0");
    }, [SAVE_KEY, JSON.stringify(save)] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    // Two own ORIGINAL tries (an extra oregano keeps both off the recipe's identity): without, then with chicken.
    await cookPestoPollo(page, { chicken: 0, oregano: 1, from: "HOME" });
    await expect(page.locator(".result-panel--original")).toBeVisible();
    await cookPestoPollo(page, { chicken: 2, oregano: 1, from: "RESULT" });
    await expect(page.locator(".result-panel--discovery")).toHaveCount(0);
    await expect(page.locator(".result-panel--original")).toBeVisible();
    await page.getByRole("button", { name: /フリークッキング|もう一度じゆうに作る/ }).first().click();
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await pickChip(page, /ジェノベーゼ|ペスト/);
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: "ヒント", exact: true }).click();
    await hintSheet(page).getByRole("button", { name: /試作ノート/ }).click();
    const nb = notebook(page);
    await expect(nb).toBeVisible();
    await expect(nb.locator("[data-trial-diff]").first()).toContainText("＋ チキン");
    const nbText = await nb.innerText();
    expect(nbText).not.toMatch(/ペストポッロ|候補|距離|近い|遠い/);
    await noOverflow(page);
    await capture(page, "no27-notebook-chicken-diff", project);
  });
});
