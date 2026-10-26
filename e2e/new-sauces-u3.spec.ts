import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { CATALOG_COUNTS, materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * New Sauces Phase B U3 representative E2E (Issue #578; the late catalog: tahini + pomegranate -> eggplant-tahini-pizza). The tahini PAINT before the bake, the eggplant (no pre-cooking) and the parsley placed before
 * the bake, the pomegranate scattered AFTER the bake and every count are GAMEPLAY ASSUMPTIONS (the original page was not confirmed). The tahini colour `#a58a63` is PROVISIONAL until the Owner HV on a real device,
 * so the painted dough is captured. The late materials played end to end: Shop NEW (T4, 120 Pitz) and purchase of both, the single Research Entry (the label names only the cohort key; no identity leak), the SAUCE
 * step painted with the existing PAINT gesture, eggplant 3 + parsley 1 (no CHEESE step: the recipe has no cheese), the bake, the pomegranate x2 placed in FINISH (its own aril art), NEW DISCOVERY and the Dex.
 * The save does not list the new step's materials: the ladder (the late step) grants them on load.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ID = "eggplant-tahini-pizza";
const LAST_STEP = CATALOG_COUNTS.ladderSteps; // the tahini / pomegranate late step is the last one; derived, never authored
const ALL_IDS = RECIPES.map((r) => r.id as string);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63]]; // eggplant 3, parsley 1, pomegranate 2 (the reference slots)

const saveJson = (discovered: readonly string[], owned: readonly string[]) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    // The new step's material is deliberately NOT listed: load-time entitlement (the ladder) must grant it.
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

test.describe("New Sauces Phase B U3 (representative: the late step; tahini + pomegranate -> eggplant-tahini-pizza)", () => {
  test.setTimeout(300_000);

  test("Shop NEW sauce + pomegranate -> purchase -> Research (no leak) -> paint the tahini, eggplant, parsley -> bake -> pomegranate in FINISH -> NEW DISCOVERY -> Dex", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const discovered = ALL_IDS.filter((id) => id !== ID);
    await page.goto("icons/icon-16.png");
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [SAVE_KEY, saveJson(discovered, materialsUpTo(LAST_STEP - 1))] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
    await hold(page);

    // 1. Shop: both late materials are NEW (T4: 120 Pitz; the sauce is a spread, k = 1 -> one pack is 10 uses; the pomegranate is two pieces per pizza).
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const row = page.locator('.shop-item[data-ingredient-id="tahini"]');
    const pomRow = page.locator('.shop-item[data-ingredient-id="pomegranate"]');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("data-shop-state", "NEW");
    await expect(row).toContainText("タヒニ");
    await expect(row).toContainText("10ピザ分");
    await expect(row).toContainText(/初回 .*120 Pitz/);
    await expect(pomRow).toHaveAttribute("data-shop-state", "NEW");
    await expect(pomRow).toContainText("ザクロ");
    await noOverflow(page, "shop NEW");
    await capture(page, "new-sauces-u3-shop-new", project);
    await hold(page, 2200);
    await row.locator(".shop-item__buy-button").click();
    await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
    await pomRow.scrollIntoViewIfNeeded();
    await pomRow.locator(".shop-item__buy-button").click();
    await expect(pomRow).not.toHaveAttribute("data-shop-state", "NEW");
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the single Research Entry: only the cohort key (the sauce) is named.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay__research")).toContainText("？？？ピザ（ザクロ）");
    await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
    await noOverflow(page, "Dex Research Entry");
    await capture(page, "new-sauces-u3-research-entry", project);
    await hold(page, 2000);
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（ザクロ）を研究する$/ }).click();
    await expectResearchLead(page, "？？？ピザ");
    await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");

    // 3. Cooking: paint the new sauce (the existing PAINT gesture), eggplant 3 + parsley 1 (TOPPING; CHEESE skipped).
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await (await chipOnTrayOrPin(page, /タヒニ/)).click(); // the sauce tray is paged (6 per page): the eighth sauce is on page 2
    await capture(page, "new-sauces-u3-tray-sauce", project);
    await paintSauceRing(page, 25, 16);
    await hold(page, 2200);
    await capture(page, "new-sauces-u3-sauce-painted", project);
    await noOverflow(page, "sauce painted");
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible(); // Free Cooking always offers CHEESE; this recipe has none, so it is skipped
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await (await chipOnTrayOrPin(page, /ナス/)).click();
    for (let i = 0; i < 3; i += 1) await tapDoughPercent(page, ...SPOTS[i]);
    await (await chipOnTrayOrPin(page, /パセリ/)).click();
    await tapDoughPercent(page, ...SPOTS[3]);
    await capture(page, "new-sauces-u3-topped", project);
    await hold(page, 2000);

    // 4. Bake inside the generic Free Cooking window (58-78, also the recipe's own), then 仕上げ: the pomegranate is placed AFTER the bake.
    await bakeToTarget(page, { start: 60, end: 76 }, { finish: false });
    await expect(page.getByTestId("finish-dock")).toBeVisible();
    await expect(page.getByRole("tab", { name: "仕上げ" })).toHaveAttribute("aria-current", /.+/);
    await capture(page, "new-sauces-u3-finish", project);
    await hold(page, 1800);
    await (await chipOnTrayOrPin(page, /ザクロ/)).click(); // the FINISH tray lists every owned scatter topping, paged
    await tapDoughPercent(page, ...SPOTS[4]);
    await tapDoughPercent(page, ...SPOTS[5]);
    await expect(page.getByTestId("finish-undo")).toBeEnabled();
    await noOverflow(page, "finish pomegranate placed");
    await capture(page, "new-sauces-u3-finish-pomegranate", project);
    await hold(page, 2200);
    await page.getByTestId("finish-complete").click();
    await page.waitForSelector(".result-panel");

    // 5. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ナスとタヒニのピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "new-sauces-u3-new-recipe", project);
    await hold(page, 3000);

    // 6. Dex: complete; chapter 4 is now full; schema v2 unchanged.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "ナスとタヒニのピザ" });
    await expect(card).toHaveCount(1);
    const last = CATALOG_COUNTS.chapterSizes.at(-1)!;
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: `第${CATALOG_COUNTS.chapterSizes.length}章` })).toContainText(`${last}/${last}`);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "new-sauces-u3-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(ID);
    expect(saved.unlockedForShopIngredientIds).toEqual(expect.arrayContaining(["tahini", "pomegranate"]));
    expect(errors).toEqual([]);
  });

  test("a never-launched save at the ladder step it shipped at (no roe, yuzu-kosho, miso-sauce, white-sesame, tahini or pomegranate in its ledger) is granted all six on the first launch, and opening the Shop rewrites nothing", async ({ page }) => {
    const discovered = ALL_IDS.filter((id) => id !== ID);
    const LATE = ["salmon-roe", "yuzu-kosho", "miso-sauce", "white-sesame", "tahini", "pomegranate"];
    const withoutLate = materialsUpTo(LAST_STEP).filter((m) => !LATE.includes(m));
    await page.goto("icons/icon-16.png");
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [SAVE_KEY, saveJson(discovered, withoutLate)] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    for (const id of LATE) {
      const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
      await row.scrollIntoViewIfNeeded();
      await expect(row, id).toHaveAttribute("data-shop-state", "NEW");
    }
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.dex).toHaveLength(discovered.length); // nothing was lost or rewritten
  });
});
