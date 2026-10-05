import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";

/**
 * Anti-Oracle Contract 2.1 S5: the RESULT 「今回の試作結果」 panel, played for real on the Dex 25 ladder save
 * (pesto-pollo is the single Research Entry; its unlock fact, chicken, is already known). Chromium, both iphone
 * projects: normal chips, topping over-cap, known exclusion, Notebook line, and the flag-OFF baseline (dev opt-out).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const OPT_OUT_KEY = "teto.dev.researchIdentify";
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds as readonly string[]);
const discovered = [...keysBefore(25), "brazilian-calabresa", "aussie"];
const SAVE = {
  schemaVersion: 2,
  dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function open(page: Page, flagOff = false) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value, optKey, off]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    if (off) localStorage.setItem(optKey, "0");
  }, [SAVE_KEY, JSON.stringify(SAVE), OPT_OUT_KEY, flagOff] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function pickChip(page: Page, name: RegExp) {
  const chip = await chipOnTrayOrPin(page, name);
  await chip.click();
}

async function startResearch(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
  await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
}

/** Dough -> tomato sauce -> no cheese -> each topping placed once -> bake. Ends on RESULT. */
async function cook(page: Page, toppings: RegExp[]) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  let i = 0;
  for (const t of toppings) {
    await pickChip(page, t);
    await tapDoughPercent(page, 38 + (i % 3) * 12, 40 + Math.floor(i / 3) * 16);
    i += 1;
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

async function expectLayout(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
  const vp = page.viewportSize()!;
  for (const name of ["もう一度試す"]) {
    const cta = page.locator(".result-panel--original").getByRole("button", { name });
    await cta.scrollIntoViewIfNeeded();
    const box = (await cta.boundingBox())!;
    expect(box.x + box.width, `${where}: ${name} right`).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height, `${where}: ${name} bottom`).toBeLessThanOrEqual(vp.height);
    expect(box.height, `${where}: ${name} height`).toBeGreaterThanOrEqual(40);
  }
}

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

test("normal result: chips for the unknown ingredients only (the known unlock fact is not a chip); Notebook keeps the same rows", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await startResearch(page);
  await cook(page, [/チキン/, /ナス/, /^トマト×/]);
  const panel = page.getByTestId("research-rows");
  await expect(panel).toBeVisible();
  const text = await panel.innerText();
  const chips = (await panel.locator("li").allTextContents()).map((t) => t.replace(/\s+/g, ""));
  expect(chips).toContain("トマトソース×");
  expect(chips).toContain("トマト○"); // fresh tomato is a member of the researched pizza
  expect(chips).toContain("ナス×");
  expect(text).not.toContain("チキン"); // known (unlock fact): neither a chip nor counted
  expect(text).not.toMatch(/なし|個中|全部|あと|残り|正解|おしい/);
  await expect(page.locator(".result-panel--original").getByRole("list", { name: "使った材料" })).toContainText("チキン"); // the used-ingredients list is a separate fact and keeps the known one
  // S5.1: ✓ (known before) only in the used list; the newly-judged トマト / ナス get none
  const usedList = page.locator(".result-panel--original").getByRole("list", { name: "使った材料" });
  await expect(usedList.getByRole("listitem").filter({ hasText: "チキン" })).toContainText("✓");
  await expect(usedList.getByRole("listitem").filter({ hasText: "ナス" })).not.toContainText("✓");
  await expect(usedList.getByRole("listitem").filter({ hasText: /^.?\s?トマト$/ })).not.toContainText("✓");
  await expectLayout(page, "normal");
  await shot(page, "rows-normal");
  await page.locator(".result-panel--original").getByRole("button", { name: /試作ノート/ }).click();
  const entry = page.locator("[data-trial-entry]");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("トマト○");
  await expect(entry).toContainText("ナス×");
});

test("over-cap: 4 unknown toppings show the K=3 explanation and no topping chips", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await startResearch(page);
  await cook(page, [/ナス/, /パイナップル/, /じゃがいも/, /^トマト×/]);
  const panel = page.getByTestId("research-rows");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("トッピングは一度に3種類まで調べられるよ");
  await expect(panel.locator('[data-research-category="topping"] li')).toHaveCount(0);
  await expect(panel.locator('[data-research-category="sauce"]')).toBeVisible();
  await expectLayout(page, "over-cap");
  await shot(page, "rows-overcap");
});

test("flag OFF (dev opt-out) is the baseline: no panel", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, true);
  await startResearch(page);
  await cook(page, [/ナス/]);
  await expect(page.getByTestId("research-rows")).toHaveCount(0);
  await expectLayout(page, "flag off");
});
