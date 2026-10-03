import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * #353: 2+ registered Research Entries, no Research Target, Hint facts already bought on one entry.
 * targetless Free Cook (#373: Pizza Select's レシピ発見へ; HOME's researches) -> ヒント must not pick a recipe for the player (CHOOSE_RESEARCH); the way to the Dex's anonymous
 * Research cards works; choosing one there starts its research and shows its Hint. Chromium 390×844 / 360×800.
 * HV_SCREENSHOT_DIR (optional) writes the Human Verification screenshots.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const STEP = 12; // pizza-portuguesa + brazilian-calabresa are both entries
const keysBefore = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < STEP).map((s) => s.keyRecipeId)];
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= STEP).flatMap((s) => s.ingredientIds as readonly string[]);

const json = {
  schemaVersion: 2,
  dex: keysBefore.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 10])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
  // A Hint already bought on one entry (the legacy sticky trigger).
  discoveryHintFacts: { "pizza-portuguesa": ["ing:tomato-sauce", "h5:sauce"] },
};

async function open(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(json)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function expectNoOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
}

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

test("targetless + 2 entries + bought facts: the sheet asks to choose; the Dex choice then shows that entry's Hint", async ({ page }) => {
  await open(page);
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toHaveCount(0);
  const hintButton = page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" });
  await hintButton.click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog).toBeVisible();
  await shot(page, "after-01-choose-sheet");
  await expect(dialog).toHaveAttribute("data-hint-kind", "CHOOSE_RESEARCH");
  await expect(dialog).not.toHaveAttribute("data-hint-ladder", "hint5");
  await expect(dialog.locator(".hint-sheet__next")).toHaveCount(0);
  const choose = dialog.getByRole("button", { name: /研究するピザを選ぶ/ });
  await expect(choose).toBeVisible();
  const box = await choose.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.y + box!.height, "choose CTA inside the viewport").toBeLessThanOrEqual(vp.height);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
  await expectNoOverflow(page, "choose sheet");
  await expectNoUndiscoveredIdentity(page, keysBefore, "CHOOSE_RESEARCH sheet");
  expect(await dialog.innerText()).not.toMatch(/\d/);

  await choose.click();
  await page.waitForSelector(".dex-overlay");
  const section = page.locator(".dex-overlay__research");
  await expect(section.locator(".dex-research-card")).toHaveCount(2);
  await section.scrollIntoViewIfNeeded();
  await expectNoOverflow(page, "dex research cards");
  await shot(page, "after-02-dex-research-cards");

  await section.getByRole("button", { name: "？？？ピザ ①を研究する" }).click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toBeVisible();
  await hintButton.click();
  const picked = page.getByRole("dialog", { name: /ヒント/ });
  await expect(picked).toHaveAttribute("data-hint-kind", "SELECTABLE");
  await expect(picked).toHaveAttribute("data-hint-ladder", "hint5");
  await expectNoOverflow(page, "picked hint");
  await expectNoUndiscoveredIdentity(page, keysBefore, "picked Hint sheet");
  await shot(page, "after-03-chosen-hint");
});
