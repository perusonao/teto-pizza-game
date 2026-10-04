import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { completeDoughStep, paintSauceRing } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Discovery 3.0 IP-1: OPEN_POOL -> Notebook / Pantry navigation, played for real on both iPhone widths.
 *
 * Dex 12 (pool 2: portuguesa + calabresa): Hint (OPEN_POOL) -> 試作ノート -> back -> 食材庫 -> search / shelf chips -> 閉じる
 * -> FREE cooking screen, same step. At the DOUGH step the Hint shows the pantry as copy only (no pantry exists there).
 * Nothing about the hidden recipes (name / count / ingredients) reaches the DOM, nothing overflows or clips, no console error.
 *
 * Optional output: HV_SCREENSHOT_DIR.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const LADDER12: [string, string[]][] = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]],
];
const materials12 = [...LADDER12.flatMap(([, m]) => m), "onion"];
const DEX12_SAVE = {
  schemaVersion: 2,
  dex: LADDER12.map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials12],
  missionBest: {},
  inventory: Object.fromEntries(materials12.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials12,
};
const DISCOVERED_12 = LADDER12.map(([id]) => id);

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hintButton = (page: Page) => page.getByRole("button", { name: "ヒント", exact: true });
const hintSheet = (page: Page) => page.getByRole("dialog", { name: /^💡 ヒント/ });
const notebook = (page: Page) => page.getByRole("dialog", { name: /試作ノート/ });
const pantry = (page: Page) => page.getByRole("dialog", { name: /食材庫/ });

async function capture(page: Page, name: string, projectName: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${projectName}.png` });
}

async function startDex12Free(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(DEX12_SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/12\/31/);
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
}

/** Visible, inside the viewport, horizontally and vertically, and not overflowing the document. */
async function expectInsideViewport(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test.describe("Discovery 3.0 IP-1 (OPEN_POOL -> 試作ノート / 食材庫)", () => {
  test.setTimeout(180_000);

  test("Hint(OPEN_POOL) -> Notebook -> back -> Pantry (search / shelf chips) -> back to FREE; DOUGH shows copy only", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await startDex12Free(page);

    // DOUGH: the sheet explains the pantry as copy only -- a pantry button here would open nothing.
    await hintButton(page).click();
    await expect(hintSheet(page)).toHaveAttribute("data-hint-kind", "CHOOSE_RESEARCH");
    await expect(hintSheet(page).getByRole("button", { name: /食材庫/ })).toHaveCount(0);
    await expect(hintSheet(page)).toContainText("食材庫");
    await expectInsideViewport(page, hintSheet(page));
    await capture(page, "ip1-dough-copy-only", testInfo.project.name);
    await hintSheet(page).getByRole("button", { name: "閉じる" }).click();

    // Walk to the topping step (tray + pantry entry).
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /トマトソース/ }).first().click();
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await page.waitForSelector(".ingredient-chip");

    // Hint -> OPEN_POOL with both next actions.
    await hintButton(page).click();
    const sheet = hintSheet(page);
    await expect(sheet).toHaveAttribute("data-hint-kind", "CHOOSE_RESEARCH");
    await expect(sheet).toContainText("研究するピザを選ぼう");
    await expect(sheet.getByRole("button", { name: /試作ノートを見る/ })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "🧺 食材庫で材料を探す" })).toBeVisible();
    await expectInsideViewport(page, sheet);
    await expectInsideViewport(page, sheet.getByRole("button", { name: "🧺 食材庫で材料を探す" }));
    await expectNoUndiscoveredIdentity(page, DISCOVERED_12, "OPEN_POOL action UI");
    expect(await sheet.innerText()).not.toMatch(/[0-9０-９]+\s*(種類|個|件)|候補|%|％/);
    await capture(page, "ip1-open-pool", testInfo.project.name);

    // Notebook and back (focus returns to the entry; the sheet is still OPEN_POOL).
    await sheet.getByRole("button", { name: /試作ノートを見る/ }).click();
    await expect(notebook(page)).toBeVisible();
    await expectInsideViewport(page, notebook(page));
    await capture(page, "ip1-notebook", testInfo.project.name);
    await notebook(page).getByRole("button", { name: /ヒントにもどる/ }).click();
    await expect(notebook(page)).toHaveCount(0);
    await expect(sheet).toBeVisible();

    // Pantry: the existing sheet, current category, nothing preselected.
    await sheet.getByRole("button", { name: "🧺 食材庫で材料を探す" }).click();
    await expect(hintSheet(page)).toHaveCount(0);
    const p = pantry(page);
    await expect(p).toBeVisible();
    await expectInsideViewport(page, p);
    await expect(p.locator('.shelf-chips [aria-pressed="true"]')).toHaveText(/すべて/);
    await expect(p.getByRole("button", { name: "閉じる" })).toBeFocused();
    await capture(page, "ip1-pantry", testInfo.project.name);

    const rows = p.locator(".pantry-sheet__list li");
    const total = await rows.count();
    expect(total).toBeGreaterThan(6);
    // shelf chips filter the list; 「すべて」 restores it
    const chips = p.locator(".shelf-chips button");
    expect(await chips.count()).toBeGreaterThan(1);
    await chips.nth(1).click();
    expect(await rows.count()).toBeLessThanOrEqual(total);
    await chips.first().click();
    expect(await rows.count()).toBe(total);
    // search narrows
    await p.getByRole("searchbox").fill("たまご");
    const found = await rows.count();
    expect(found).toBeGreaterThan(0);
    expect(found).toBeLessThan(total);
    await expectInsideViewport(page, p);
    await capture(page, "ip1-pantry-search", testInfo.project.name);

    // Back: the FREE topping step, hint closed, tray intact.
    await p.getByRole("button", { name: "閉じる" }).click();
    await expect(pantry(page)).toHaveCount(0);
    await expect(hintSheet(page)).toHaveCount(0);
    await expect(page.locator(".pantry-entry")).toBeFocused();
    await expect(page.locator(".ingredient-chip").first()).toBeVisible();
    await expect(bar(page).getByRole("button", { name: /焼く/ })).toBeVisible();
    await expectInsideViewport(page, bar(page));
    await capture(page, "ip1-back-to-free", testInfo.project.name);

    // Not saved: schema v2, no notebook.
    const raw = await page.evaluate((key) => localStorage.getItem(key) ?? "", SAVE_KEY);
    expect(JSON.parse(raw).schemaVersion).toBe(2);
    expect(errors).toEqual([]);
  });
});
