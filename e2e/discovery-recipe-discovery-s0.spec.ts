import { expectFreeNote, freeNoteText } from "./support/hintNote";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Discovery 3.0 #346 S0: player-facing 「レシピ発見」. HOME -> レシピ発見 (no Research Target) -> cooking -> ORIGINAL RESULT, on a
 * fresh save (lead CTA + supporting line) and on the Dex 25 ladder save. Chromium 390×844 and 360×800: no horizontal overflow,
 * every CTA inside the viewport, no 「フリー」 wording, no near/far / correctness wording, no hidden recipe identity.
 * HV_SCREENSHOT_DIR (optional) writes the Human Verification screenshots.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);

const discovered = [...keysBefore(25), "brazilian-calabresa", "aussie"];
const materials = materialsUpTo(25);
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

// Wording the Research RESULT / Notebook must never use (recipe-attributed correctness, counts, distance, near/far).
const ORACLE = /一致しません|不一致|正解|不正解|✕|足りない|間違|残り|あと[0-9０-９]|おしい|かなり近|別の組み合わせ|新しく入荷|[0-9０-９]+\s*[/／]\s*[0-9０-９]+|[0-9０-９]+\s*[%％]/;
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function open(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

async function expectNoOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
}

async function expectInViewport(page: Page, locator: ReturnType<Page["locator"]>, where: string) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x, `${where}: left`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${where}: right`).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height, `${where}: bottom`).toBeLessThanOrEqual(vp.height);
}

async function pickChip(page: Page, name: RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name }).first();
  const next = page.getByRole("button", { name: "次のページ" });
  for (let i = 0; i < 6 && !(await chip.isVisible()); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await chip.click();
}

/** Dough -> tomato sauce -> no cheese -> a lone chicken pair -> bake: a pizza no recipe has. Ends on its RESULT. */
async function cookOriginalFromPrepare(page: Page) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // no cheese
  await pickChip(page, /チキン/);
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}


const OLD_WORDING = /フリークッキング|フリープレイ|オリジナルピザ完成|おしい|あと少し|かなり近|別の組み合わせ/;

test("fresh HOME: レシピ発見 is the lead CTA with a short supporting line, no overflow", async ({ page }) => {
  await page.goto("icons/icon-16.png");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  const cta = page.getByRole("button", { name: /レシピ発見/ });
  await expect(cta).toBeVisible();
  await expect(cta).toContainText("持っている食材で、新しいレシピを発見しよう");
  await expectInViewport(page, cta, "HOME レシピ発見");
  await expectNoOverflow(page, "fresh HOME");
  expect(await page.locator("body").innerText()).not.toMatch(OLD_WORDING);
  await shot(page, "s0-01-home-fresh");
});

test("HOME -> レシピ発見 -> cooking -> ORIGINAL RESULT (no Research Target)", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const cta = page.getByRole("button", { name: /レシピ発見/ }).first();
  await expect(cta).toBeVisible();
  await expectNoOverflow(page, "HOME");
  expect(await page.locator("body").innerText()).not.toMatch(OLD_WORDING);
  await shot(page, "s0-02-home");
  await startTargetlessFreeCook(page); // #373: HOME 「レシピ発見」 researches when an entry is cookable; Pizza Select's is the targetless door
  await page.waitForSelector(".pizza-stage");
  await expectFreeNote(page); // no card above the pizza; the note is the Hint sheet's first block
  expect(await freeNoteText(page)).not.toMatch(OLD_WORDING);
  await expectNoOverflow(page, "cooking");
  await shot(page, "s0-03-cooking");
  await cookOriginalFromPrepare(page);

  const result = page.locator(".result-panel--original");
  await expect(result).toBeVisible();
  await expect(result).toContainText("🧪 オリジナルピザ");
  await expect(result).toContainText("まだ新しいレシピは見つかっていません");
  await expect(result.locator("[data-research-context]")).toHaveCount(0);
  await expect(page.locator(".result-near-miss__text")).toHaveCount(0);
  const text = await result.innerText();
  expect(text).not.toMatch(ORACLE);
  expect(text).not.toMatch(OLD_WORDING);
  await expectNoOverflow(page, "ORIGINAL RESULT");
  await expectNoUndiscoveredIdentity(page, discovered, "ORIGINAL RESULT");
  for (const name of ["もう一度試す", "レシピを選んで作る"]) {
    await expectInViewport(page, result.getByRole("button", { name }), `CTA ${name}`);
  }
  await shot(page, "s0-04-original-result");
});
