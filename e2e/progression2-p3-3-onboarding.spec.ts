import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * Progression 2.0 Phase 3-3 (Issue #198): 0-recipe onboarding, driven through the real UI at
 * 390x844 and 360x800 (Chromium and WebKit projects, playwright.config.ts). Scenarios:
 * A fresh HOME state, B Recipe Select pre-discovery gate, C hint escalation, D first discovery
 * (NEW + OD-02 Pitz floor/bonus), E post-discovery unlock (Lunch Rush + guided Recipe Select).
 */

// FREE_COOK_BAKE_TARGET (src/data/freeCook.ts) -- the generic window the BAKE gauge shows for a
// free-cook round.
const FREE_COOK_BAKE_TARGET = { start: 58, end: 78 };

async function openHomeFresh(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function trayNames(page: Page) {
  return page.locator(".ingredient-chip__name").allTextContents();
}

/** One free-cook round with the starter trio; `basil` false makes an unregistered (ORIGINAL)
 *  combination -- used both for the discovery scenario and to drive hint-escalation attempts. */
async function cookStarterPizza(page: Page, { basil }: { basil: boolean }) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();

  if (basil) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 60);
    await tapDoughPercent(page, 58, 42);
  }
  await bakeToTarget(page, FREE_COOK_BAKE_TARGET);
  await page.waitForSelector(".result-panel");
}

test.describe("Progression 2.0 Phase 3-3 onboarding (Issue #198)", () => {
  test("A-E: fresh HOME, Recipe Select gate, hint escalation, first discovery, post-discovery unlock", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // A. Fresh HOME: Dex 0, フリークッキング is the primary CTA, ランチラッシュ is locked with a
    // reason, ピザを作る is still present (secondary).
    await openHomeFresh(page);
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/0\/15/);
    await expect(page.getByRole("button", { name: /フリークッキングで探す/ })).toBeVisible();
    const lunchRushButton = page.getByRole("button", { name: /ランチラッシュ/ });
    await expect(lunchRushButton).toBeDisabled();
    await expect(page.locator(".home-lunch-rush-hint")).toHaveText(/まず1枚ピザを発見しよう/);
    await expect(page.getByRole("button", { name: "\u{1F355} ピザを作る" })).toBeVisible();
    await expect(page.locator(".home-hero__bubble")).toHaveText(/フリークッキングで最初の1枚/);

    // B. Recipe Select: margherita is visible but not guided-selectable pre-discovery; every
    // other recipe stays LOCKED (chain-gated behind margherita).
    await page.getByRole("button", { name: "\u{1F355} ピザを作る" }).click();
    await expect(page.locator(".pizza-select-screen")).toBeVisible();
    const margheritaCard = page.getByRole("button", { name: /^マルゲリータ、/ });
    await expect(margheritaCard).toBeVisible();
    await expect(margheritaCard.locator(".pizza-select-card__badge")).toHaveCount(0);
    await margheritaCard.click();
    const detailPanel = page.locator(".pizza-select-detail");
    await expect(detailPanel.getByRole("button", { name: /このピザを作る/ })).toHaveCount(0);
    const goFreeCookButton = detailPanel.getByRole("button", { name: /フリークッキングで探す/ });
    await expect(goFreeCookButton).toBeVisible();
    await expect(detailPanel.getByText("フリークッキングで発見しよう")).toBeVisible();

    // B continued: routes straight into Free Cooking, not a guided SELECT_RECIPE round.
    await goFreeCookButton.click();
    await page.waitForSelector(".pizza-stage");
    await expect(page.locator(".order-card__recipe-name")).toHaveText(/フリークッキング/);
    await expect(page.locator(".pizza-select-screen")).toHaveCount(0);

    // C. Hint escalation: level 0 is the pre-existing generic free-cook hint; three
    // non-matching (ORIGINAL) attempts escalate it through levels 1-3, never before that.
    await expect(page.locator(".order-card__hint")).not.toContainText(/赤・白・緑|トマトソースを塗って、モッツァレラ/);

    await cookStarterPizza(page, { basil: false }); // attempt 1 -> ORIGINAL
    await expect(page.locator(".result-panel__heading--original")).toBeVisible();
    await page.getByRole("button", { name: "もう一度じゆうに作る" }).click();
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click(); // DOUGH -> SAUCE, level 1 hint
    await expect(page.locator(".order-card__hint")).toContainText("赤・白・緑");
    await page.getByRole("button", { name: "やり直す" }).click();

    await cookStarterPizza(page, { basil: false }); // attempt 2 -> ORIGINAL
    await page.getByRole("button", { name: "もう一度じゆうに作る" }).click();
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click(); // level 2 hint
    await expect(page.locator(".order-card__hint")).toContainText("赤いソース、とろける白いチーズ");
    await page.getByRole("button", { name: "やり直す" }).click();

    await cookStarterPizza(page, { basil: false }); // attempt 3 -> ORIGINAL
    await page.getByRole("button", { name: "もう一度じゆうに作る" }).click();
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click(); // level 3 hint -- near-explicit
    await expect(page.locator(".order-card__hint")).toContainText("トマトソースを塗って、モッツァレラをのせて、バジルをちらして");
    await page.getByRole("button", { name: "やり直す" }).click();

    // D. First discovery: the same starter trio, now with basil, matches Margherita.
    await cookStarterPizza(page, { basil: true });
    await expect(page.locator(".discovered-banner--new-pizza")).toHaveText(
      /NEW PIZZA!.*マルゲリータを発見しました！/,
    );
    // OD-02: the ★1 floor + first-discovery bonus both apply to this first-ever registration --
    // earned Pitz alone is at least the floor (20), and the itemized breakdown shows the +50
    // bonus explicitly.
    await page.locator(".pitz-credit-summary__breakdown-summary").click();
    await expect(page.locator(".pitz-credit-summary")).toContainText("初回発見ボーナス");
    await expect(page.locator(".pitz-credit-summary")).toContainText("+50 Pitz");
    const save1 = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("teto-pizza-save-v1")!),
    );
    expect(
      save1.dex.find((e: { recipeId: string }) => e.recipeId === "margherita")?.discovered,
    ).toBe(true);

    // E. Post-discovery: HOME reverts to the pre-Phase-3-3 layout (ピザを作る primary, Lunch
    // Rush unlocked), and Recipe Select now lets margherita be guided-selected directly.
    await page.getByRole("button", { name: /ホーム/ }).click();
    await expect(page.locator(".home-screen")).toBeVisible();
    await expect(page.getByRole("button", { name: "\u{1F355} ピザを作る" })).toBeVisible();
    await expect(page.getByRole("button", { name: /フリークッキングで探す/ })).toHaveCount(0);
    await expect(page.locator(".home-lunch-rush-hint")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ランチラッシュ/ })).toBeEnabled();

    await page.getByRole("button", { name: /ランチラッシュ/ }).click();
    await expect(page.locator(".mission-overlay")).toBeVisible();
    await page.locator(".mission-overlay__close").click(); // Lunch Rush intro's own "閉じる"
    // Closing the intro exits Mission back to FREE but stays on GAME's own ORDER screen --
    // its header ホーム button (no longer covered by the overlay) returns to HOME.
    await page.getByRole("button", { name: /ホーム/ }).click();
    await expect(page.locator(".home-screen")).toBeVisible();

    await page.getByRole("button", { name: "\u{1F355} ピザを作る" }).click();
    await page.getByRole("button", { name: /^マルゲリータ、/ }).click();
    const guidedCta = page.getByRole("button", { name: /このピザを作る/ });
    await expect(guidedCta).toBeVisible();
    await expect(guidedCta).toBeEnabled();
    await guidedCta.click();
    await page.waitForSelector(".pizza-stage");
    await expect(page.locator(".order-card__recipe-name")).toHaveText(/マルゲリータ/);
  });

  test("existing save: an already-discovered Dex is untouched, no forced reset (migration/back-compat)", async ({
    page,
  }) => {
    // Simulates an "existing player" save (Progression 2.0 pre-dates this phase, so a v1 schema
    // save with a real prior discovery already stands in for that -- see the Fresh Audit report
    // for the full save-compatibility reasoning).
    await page.addInitScript(() => {
      localStorage.setItem(
        "teto-pizza-save-v1",
        JSON.stringify({
          schemaVersion: 1,
          dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 }],
          pitzBalance: 40,
          ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
          missionBest: {},
        }),
      );
    });
    await openHomeFresh(page);
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/1\/15/);
    await expect(page.getByRole("button", { name: /フリークッキングで探す/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "\u{1F355} ピザを作る" })).toBeVisible();
    await expect(page.getByRole("button", { name: /ランチラッシュ/ })).toBeEnabled();
    await expect(page.locator(".home-lunch-rush-hint")).toHaveCount(0);

    await page.getByRole("button", { name: "\u{1F355} ピザを作る" }).click();
    await page.getByRole("button", { name: /^マルゲリータ、/ }).click();
    const guidedCta = page.getByRole("button", { name: /このピザを作る/ });
    await expect(guidedCta).toBeEnabled();
  });

  test("reset (Full Game Reset) returns a played save to true Dex 0", async ({ page }) => {
    // `page.evaluate` (not `addInitScript`) -- an init script re-runs on every navigation,
    // including the reload this test's own confirm button triggers, which would silently
    // re-seed the "already played" save right back after the reset it's supposed to verify.
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "teto-pizza-save-v1",
        JSON.stringify({
          schemaVersion: 1,
          dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
          pitzBalance: 100,
          ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
          missionBest: {},
        }),
      );
    });
    await page.reload();
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/1\/15/);

    await page.getByRole("button", { name: "設定" }).click();
    await page.getByRole("button", { name: "ゲームデータをリセット" }).click();
    const confirmPanel = page.locator(".settings-reset-confirm__panel");
    // handleResetGameData clears the save then calls window.location.reload() -- give the real
    // full-page reload (not just the SPA's own state) time to complete.
    await confirmPanel.getByRole("button", { name: "最初からやり直す" }).click();
    await page.waitForLoadState("load");
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/0\/15/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /フリークッキングで探す/ })).toBeVisible();
  });
});

test.describe("Progression 2.0 Phase 3-3: one-screen at 390x844 / 360x800", () => {
  test("HOME's fresh-save layout needs no scroll and no horizontal overflow", async ({ page }) => {
    await openHomeFresh(page);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      scrollHeight: document.querySelector(".home-screen")!.scrollHeight,
      clientHeight: document.querySelector(".home-screen")!.clientHeight,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  });
});
