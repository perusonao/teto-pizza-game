import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { PROFILES, ProfileDriver } from "./support/layoutProfiles";
import { runOnlyOnWidth } from "./support/projectGuard";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Discovery 3.0 PR-1 (OD-D3-20 / OD-D3-23): the oracle neutralization, played for real (dough -> sauce -> cheese -> toppings -> bake)
 * on a Dex 3 ladder save where funghi (tomato sauce, mozzarella, mushroom) is the one DISCOVERABLE recipe.
 *
 * S1 reproduced a free "the combination is right" signal in exactly this situation: the exact funghi set with a thin sauce got the
 * 「図鑑のピザまであと少し」 lead, NO near/far row and NO Trial Notebook record, while any other combination got the ordinary lead, a
 * near/far row and a 「試作#n」 notice on a retry. Here the exact combination and a different combination that uses the same
 * ingredient family of the key ingredient, both with the same thin sauce, must be indistinguishable on the RESULT card (apart from the
 * list of the player's own ingredients), and both must be recorded.
 *
 * Optional output: HV_SCREENSHOT_DIR (one RESULT screenshot per card). Runs once per engine (the *-390x844 project).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const SAVE = {
  schemaVersion: 2,
  dex: ["margherita", "bismarck", "breakfast-pizza"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg", "bacon", "mushroom"],
  missionBest: {},
  inventory: { egg: 30, bacon: 30, mushroom: 30 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: ["egg", "bacon", "mushroom"],
};

type Pieces = { dab: boolean; cheese: [RegExp, number][]; toppings: [RegExp, number][] };
const MOZ = /モッツァレラ/;
const MUSH = /マッシュルーム/;
const BASIL = /バジル/;
const EGG = /たまご/;
const BACON = /ベーコン/;
/** the exact funghi set; the sauce is a single dab. */
const EXACT_THIN: Pieces = { dab: true, cheese: [[MOZ, 2]], toppings: [[MUSH, 3]] };
/** a different, far combination that also uses the mushroom; the same single dab. */
const OTHER_THIN: Pieces = { dab: true, cheese: [], toppings: [[MUSH, 1], [BASIL, 1], [EGG, 2], [BACON, 2]] };
/** the exact funghi set with a full sauce: a real discovery (unchanged). */
const EXACT_GOOD: Pieces = { dab: false, cheese: [[MOZ, 2]], toppings: [[MUSH, 3]] };
const OTHER_GOOD: Pieces = { dab: false, cheese: [], toppings: [[MUSH, 1], [BASIL, 1], [EGG, 2], [BACON, 2]] };

const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function openWithSave(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    localStorage.setItem("teto.dev.hint5Ladder", "0");
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/3\/32/);
}

async function place(page: Page, name: RegExp, spots: [number, number][]) {
  await page.locator(".ingredient-chip").filter({ hasText: name }).first().click();
  for (const [x, y] of spots) await tapDoughPercent(page, x, y);
}

async function cook(page: Page, p: Pieces, from: "HOME" | "RESULT") {
  if (from === "HOME") await startTargetlessFreeCook(page);
  else await page.getByRole("button", { name: /もう一度試す/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  if (p.dab) await tapDoughPercent(page, 50, 50);
  else await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  const spots: [number, number][] = [[40, 50], [60, 50], [50, 32], [50, 66], [34, 38], [66, 62]];
  let s = 0;
  for (const [name, n] of p.cheese) await place(page, name, spots.slice(s, (s += n)));
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  for (const [name, n] of p.toppings) {
    await place(page, name, spots.slice(s % 6, (s % 6) + n));
    s += n;
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

/** What a recipe check could use: everything on the card except the player's own ingredient list. */
async function card(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector(".result-panel")!.cloneNode(true) as HTMLElement;
    panel.querySelector(".original-pizza__ingredients")?.remove();
    const text = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? null;
    return {
      html: panel.outerHTML,
      lead: text(".original-pizza__lead"),
      nearFar: text(".result-near-miss__text"),
      advice: text(".original-pizza__advice"),
      notice: text(".original-pizza__trial-notice"),
      hintCta: !!document.querySelector(".result-near-miss__cta"),
    };
  });
}

async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

test.describe("Discovery 3.0 PR-1: the INCOMPLETE_MATCH oracle is closed", () => {
  test.beforeEach(() => runOnlyOnWidth(test.info(), 390));
  test.setTimeout(240_000);

  test("exact + thin sauce and other + thin sauce are indistinguishable (lead, near/far row, advice, notice, DOM), both recorded", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);

    await openWithSave(page);
    await cook(page, EXACT_THIN, "HOME");
    const exact1 = await card(page);
    await capture(page, "exact-thin-first");
    await cook(page, EXACT_THIN, "RESULT");
    const exact2 = await card(page);
    await capture(page, "exact-thin-retry");

    await openWithSave(page);
    await cook(page, OTHER_THIN, "HOME");
    const other1 = await card(page);
    await capture(page, "other-thin-first");
    await cook(page, OTHER_THIN, "RESULT");
    const other2 = await card(page);
    await capture(page, "other-thin-retry");

    // 1. the lead is the ordinary one; the old wording is gone
    expect(exact1.lead).toBe("まだ新しいレシピは見つかっていません");
    expect(exact1.lead).toBe(other1.lead);
    // 2. neither has a near/far row
    expect(exact1.nearFar).toBeNull(); // #346 S0: no near/far row on a Recipe Discovery ORIGINAL
    expect(exact1.nearFar).toBe(other1.nearFar);
    // 3. both are recorded: a first attempt shows no notice, the retry shows its stable number
    expect(exact1.notice).toBeNull();
    expect(other1.notice).toBeNull();
    expect(exact2.notice).toBe("📓 前にも同じ材料の組み合わせで作ったよ（試作#1）");
    expect(other2.notice).toBe(exact2.notice);
    // 4. the recipe-independent advice is the same, and a static line
    expect(exact1.advice).toBe("ソースが少なめかも。もう少し広く塗ってみよう。");
    expect(other1.advice).toBe(exact1.advice);
    // 5. nothing else on the card tells them apart
    expect(exact1.html).toBe(other1.html);
    expect(exact2.html).toBe(other2.html);
    expect(exact1.hintCta).toBe(true);
    expect(other1.hintCta).toBe(true);
  });

  test("with a good sauce: the exact combination still discovers (unchanged), another combination has no advice", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page);
    await cook(page, EXACT_GOOD, "HOME");
    await expect(page.locator(".result-panel--discovery")).toBeVisible();
    await capture(page, "exact-good-discovery");

    await openWithSave(page);
    await cook(page, OTHER_GOOD, "HOME");
    await expect(page.locator(".result-panel--original")).toBeVisible();
    await expect(page.locator(".original-pizza__advice")).toHaveCount(0);
    await capture(page, "other-good-no-advice");
  });
});
