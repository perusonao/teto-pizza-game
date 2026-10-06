import { expectResearchLead } from "./support/hintNote";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";

/**
 * Research 2.0 Phase 4 (OD-R3-1..3): a bake-FAILED Research trial on the Dex 25 ladder save (pesto-pollo is the single
 * Research Entry) still discloses ○×, records a Notebook entry and reaches the Research Board. Chromium, both iphone projects.
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
  await expectResearchLead(page, "？？？ピザ");
}

/** Dough -> tomato sauce -> no cheese -> each topping placed once -> bake. Ends on RESULT. */
async function cook(page: Page, toppings: RegExp[], bake = FREE_BAKE) {
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
  await bakeToTarget(page, bake);
  await page.waitForSelector(".result-panel");
}


async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

const RAW_BAKE = { start: 3, end: 15 };

test("bake-FAILED Research trial: RESULT shows ○×, the Notebook records it and the Board keeps the ×", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await startResearch(page);
  await cook(page, [/ナス/], RAW_BAKE);
  const failed = page.locator(".result-panel--failed");
  await expect(failed).toBeVisible();
  const panel = page.getByTestId("research-rows");
  await expect(panel).toBeVisible();
  const chips = (await panel.locator("li").allTextContents()).map((t) => t.replace(/\s+/g, ""));
  expect(chips).toContain("トマトソース×");
  expect(chips).toContain("ナス×");
  const text = await failed.innerText();
  expect(text).toContain("+0 Pitz");
  expect(text).not.toMatch(/No\.|候補|残り|個中|テクニック|NEW PIZZA/);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, "horizontal overflow").toBeLessThanOrEqual(m.vw);
  const cta = failed.getByRole("button", { name: "もう一度試す" });
  await cta.scrollIntoViewIfNeeded();
  const box = (await cta.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await shot(page, "failed-result");
  await failed.getByRole("button", { name: /試作ノート/ }).click();
  const entry = page.locator("[data-trial-entry]");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("ナス×");
  const board = page.locator("[data-research-board]");
  await expect(board).toBeVisible();
  await expect(board.locator("[data-research-board-known]")).toContainText("チキン");
  await expect(board.locator("[data-research-board-excluded]")).toContainText("ナス");
  await expect(board.locator("[data-research-board-excluded]")).toContainText("トマトソース");
  expect(await board.innerText()).not.toMatch(/No\.|候補|残り|回目|テクニック|試作 #/);
  await shot(page, "failed-notebook-board");
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").researchExclusions, SAVE_KEY);
  expect(saved["pesto-pollo"]).toEqual(expect.arrayContaining(["tomato-sauce", "eggplant"]));
});
