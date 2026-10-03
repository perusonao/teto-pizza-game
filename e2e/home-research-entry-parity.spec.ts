import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Issue #373: HOME 「レシピ発見」 follows the cookable Research Entries (OD-RB-1 update), so it researches like the Dex's
 * 「このピザを研究する」 does.
 *   0 cookable entries -> the targetless Free Cook (no research context, no membership panel)
 *   1 cookable entry   -> that entry is the Research Target (研究中 + 今回の試作結果 + Notebook line)
 *   2+                 -> the Dex's anonymous Research cards open; the system picks nothing
 * and the same Target + the same ingredients end in the same research state from either door (parity).
 * Chromium 390×844 and 360×800 (the two iphone projects).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);
const materials = materialsUpTo(25);

function saveWith(discovered: string[]) {
  return {
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
    missionBest: {},
    inventory: Object.fromEntries(materials.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
  };
}
// The Dex 25 ladder save with calabresa closed: pesto-pollo is the single Research Entry (as discovery-research-result.spec).
const ONE_ENTRY = saveWith([...keysBefore(25), "brazilian-calabresa"]);
// Calabresa left undiscovered as well: two cookable Research Entries.
const TWO_ENTRIES = saveWith(keysBefore(25));
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function open(page: Page, save: object | null) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    if (value) localStorage.setItem(key, value);
  }, [SAVE_KEY, save ? JSON.stringify(save) : ""] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
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

/** Dough -> tomato sauce -> mozzarella -> a chicken pair -> bake: a pizza no recipe has. Ends on its RESULT. */
async function cookOriginal(page: Page) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await pickChip(page, /モッツァレラ/);
  await tapDoughPercent(page, 50, 50);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await pickChip(page, /チキン/);
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

const norm = (t: string | null) => (t ?? "").replace(/\s+/g, "");

async function researchSnapshotAfterAttempt(page: Page) {
  const context = norm(await page.getByTestId("research-context").textContent());
  await cookOriginal(page);
  const result = page.locator(".result-panel--original");
  await expect(result).toContainText("研究中 ？？？ピザ");
  const rows = norm(await page.getByTestId("research-rows").innerText());
  await result.getByRole("button", { name: /試作ノート/ }).click();
  const notebook = page.locator("[data-trial-notebook]");
  await expect(notebook).toBeVisible();
  return { context, rows, notebook: norm(await notebook.innerText()) };
}

test.describe("HOME レシピ発見 follows the cookable Research Entries (#373)", () => {
  test("0 entries: HOME starts the targetless Free Cook (no research context, no membership panel)", async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, null);
    await page.getByRole("button", { name: /レシピ発見/ }).click();
    await page.waitForSelector(".pizza-stage");
    await expect(page.locator(".dex-overlay")).toHaveCount(0);
    await expect(page.getByTestId("research-context")).toHaveCount(0);
    await expect(page.locator(".order-card--free-cook")).toContainText("レシピ発見の試作");
  });

  test("2+ entries: HOME opens the Dex's Research cards, picks nothing, and starts research only after the player picks", async ({ page }) => {
    test.setTimeout(420_000);
    await open(page, TWO_ENTRIES);
    await page.getByRole("button", { name: /レシピ発見/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".pizza-stage")).toHaveCount(0); // no round started for the player
    const cards = page.locator(".dex-overlay__research .dex-research-card");
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
    await expectNoUndiscoveredIdentity(page, [...keysBefore(25)], "HOME -> Dex Research cards");
    await cards.nth(1).getByRole("button", { name: /を研究する/ }).click();
    await expect(page.locator(".dex-overlay")).toHaveCount(0);
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ ②");
    await cookOriginal(page);
    await expect(page.locator(".result-panel--original")).toContainText("研究中 ？？？ピザ ②");
    await expect(page.getByTestId("research-rows")).toBeVisible();
  });

  test("1 entry: HOME starts that entry as the Research Target and ends in the same research state as the Dex door", async ({ page }) => {
    test.setTimeout(600_000);
    // HOME door
    await open(page, ONE_ENTRY);
    await page.getByRole("button", { name: /レシピ発見/ }).click();
    await page.waitForSelector(".pizza-stage");
    await expect(page.locator(".dex-overlay")).toHaveCount(0);
    await expect(page.getByTestId("research-context")).toContainText("研究中");
    const home = await researchSnapshotAfterAttempt(page);
    expect(home.rows).toMatch(/[○×]/);

    // Dex door (same save, same ingredients)
    await open(page, ONE_ENTRY);
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.locator(".dex-overlay__research").getByRole("button", { name: "？？？ピザを研究する" }).click();
    await page.waitForSelector(".pizza-stage");
    const dex = await researchSnapshotAfterAttempt(page);

    expect(home).toEqual(dex);
  });
});
