import { test as base, expect, type Page } from "@playwright/test";
import {
  completeDoughStep,
  cutThreeLines,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  tapDoughPercent,
} from "./gestures";
import { COOKING_SLOTS, LayoutContract, measureLayout, type SlotSelectors, type StateLabel } from "./support/layoutContract";
import { compareStable, evaluateInvariants, type InvariantId } from "./support/layoutInvariants";
import { PROFILES, readViewport, SAFE_AREA_INSET } from "./support/layoutProfiles";

/**
 * Progression 2.0 W1 I5b-5 Layout Contract (LC-0..LC-5).
 *
 * Authority: I5b-5 Verification Design `d4f96d0` §3 (profiles), §5 (L-A..L-O), §6 (screens and
 * the minimal LC matrix), §12 (evidence); I5b-5 Preflight §2-§8 (one flow per test, profiles
 * cycled at each state, BAKE cycled with the clock paused, mount at the short profile for
 * LC-1 / LC-3). Runs in the `layout-chromium` project (all 7 profiles, CDP safe-area override)
 * and in each WebKit project (the N and S profiles of its own width); the `iphone-*` Chromium
 * projects ignore this file (playwright.config.ts).
 *
 * Every state's invariants are `expect.soft` (all profiles are always measured); a hard error
 * (a missing button, a failed self-check) still stops the test. `layout-evidence.json` is
 * attached to every test, pass or fail.
 */

const test = base.extend<{ lc: LayoutContract }>({
  lc: async ({ page, browserName }, provide, testInfo) => {
    const lc = await LayoutContract.start(page, testInfo, browserName);
    try {
      await provide(lc);
    } finally {
      await lc.finish();
    }
  },
});

const SAVE_KEY = "teto-pizza-save-v1";
const ALL_MATERIALS = [
  "egg", "bacon", "mushroom", "eggplant", "parmigiano", "pepperoni", "sausage", "ham", "corn", "pineapple",
  "black-olive", "oregano", "onion", "olive-oil", "garlic", "anchovy", "tuna", "pesto", "cherry-tomato", "clam",
  "fresh-tomato", "potato", "rosemary", "capers", "fontina", "gorgonzola",
];
const ALL_RECIPES = [
  "margherita", "marinara", "quattro-formaggi", "genovese", "bismarck", "funghi", "fugazza", "salsiccia",
  "pepperoni", "napoletana", "tonno-e-cipolla", "pizza-bianca", "breakfast-pizza", "capricciosa", "meat-lovers",
  "melanzane-pizza", "parmigiana-pizza", "bambino", "hawaiian", "pizza-portuguesa", "pesto-tonno",
  "new-haven-apizza", "pesto-caprese", "pesto-patate", "puttanesca-pizza",
];
// FREE_COOK_BAKE_TARGET (src/data/freeCook.ts) and the recipes' own bakeTarget (src/data/recipes.ts).
const FREE_BAKE = { start: 58, end: 78 };
const PORTUGUESA_BAKE = { start: 58, end: 78 };
const NEW_HAVEN_BAKE = { start: 62, end: 82 };
// GUIDE_FADE_END_S (src/logic/bakeGuideFade.ts) = 7.2 s, plus a margin.
const AFTER_GUIDE_FADE_MS = 7_300;

/** Every material owned (99 each); `discovered` recipes in the Dex. */
function makeSave(discovered: readonly string[]) {
  return {
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...ALL_MATERIALS],
    missionBest: {},
    inventory: Object.fromEntries(ALL_MATERIALS.map((m) => [m, 99])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: ALL_MATERIALS,
  };
}

/** A real Dex 1 save: margherita discovered, starter materials only. */
const DEX1_SAVE = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
  pitzBalance: 150,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  missionBest: {},
};

/** A same-origin static file that runs no app code (an image document has no scripts). */
const SEED_DOCUMENT = "icons/icon-16.png";

/**
 * Seeds the save and opens the app, deterministically:
 * 1. navigate to a script-free same-origin document -- leaving the app here runs its page-hide
 *    save, which is harmless because the seed is written after it;
 * 2. write the seed on that document (nothing on it can save over it);
 * 3. navigate to the app, which reads the seed on start.
 * No init script is registered: several `page.addInitScript` scripts run in an undefined order
 * (PR #230 review), and an `evaluate` + `reload` on the app itself lets WebKit's page-hide save
 * overwrite the seed (CI run 36221989353). The Dex pill is asserted so a seed that did not load
 * can never pass unnoticed.
 */
async function openWithSave(page: Page, save: { dex: unknown[] } | null, query = "") {
  await page.goto(SEED_DOCUMENT);
  await page.evaluate(
    ([key, value]) => {
      localStorage.clear();
      if (value) localStorage.setItem(key, value);
    },
    [SAVE_KEY, save ? JSON.stringify(save) : null] as const,
  );
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill"), "seeded save loaded").toHaveText(new RegExp(`${save ? save.dex.length : 0}/25`));
}

const bar = (page: Page) => page.locator(".prepare-bake-bar");
async function next(page: Page) {
  await bar(page).getByRole("button", { name: /次へ/ }).click();
}

/** Selects a chip wherever it is in the paged tray (pages forward, wrapping to page 1 once). */
async function selectChip(page: Page, name: RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name });
  for (let i = 0; i < 12 && !(await chip.count()); i += 1) {
    const nextPage = page.getByRole("button", { name: "次のページ" });
    if ((await nextPage.count()) && (await nextPage.isEnabled())) await nextPage.click();
    else await page.getByRole("button", { name: "前のページ" }).click();
  }
  await chip.first().click();
}

async function place(page: Page, name: RegExp, spots: [number, number][]) {
  await selectChip(page, name);
  for (const [x, y] of spots) await tapDoughPercent(page, x, y);
}

async function goToTrayPage(page: Page, target: "first" | "last") {
  const label = target === "first" ? "前のページ" : "次のページ";
  for (let i = 0; i < 8; i += 1) {
    const b = page.getByRole("button", { name: label });
    if (!(await b.count()) || !(await b.isEnabled())) return;
    await b.click();
  }
}

async function trayPageLabel(page: Page) {
  const label = page.locator(".ingredient-page-nav:not(.ingredient-page-nav--placeholder) .ingredient-page-nav__label");
  return (await label.count()) ? ((await label.textContent()) ?? "").replace(/\s+/g, "") : "1/1";
}

const PREPARE_CHECKS: InvariantId[] = ["L-A", "L-D", "L-E", "L-I", "L-J", "L-K", "L-M", "L-N"];
const TRAY_CHECKS: InvariantId[] = ["L-A", "L-B", "L-C", "L-D", "L-E", "L-I", "L-J", "L-K", "L-M", "L-N"];
const BAKE_CHECKS: InvariantId[] = ["L-F", "L-D", "L-E", "L-I", "L-J", "L-K", "L-N"];
const CUT_CHECKS: InvariantId[] = ["L-A", "L-D", "L-E", "L-I", "L-J", "L-K", "L-N"];
const withHud = (ids: InvariantId[]): InvariantId[] => [...ids, "L-G"];

test.describe("I5b-5 Layout Contract", () => {
  test("LC-0 harness self-check: viewport and safe-area override reach the page", async ({ page, lc }) => {
    await openWithSave(page, null);
    for (const profile of lc.profiles) {
      // `apply` throws when innerWidth/innerHeight or env(safe-area-inset-*) do not match.
      const applied = await lc.apply(profile);
      expect(applied.innerWidth, `LC-0 innerWidth @${profile.id}`).toBe(profile.width);
      expect(applied.innerHeight, `LC-0 innerHeight @${profile.id}`).toBe(profile.height);
      expect(Math.round(applied.vv.height), `LC-0 visualViewport.height @${profile.id}`).toBe(profile.height);
      const want = profile.inset ?? { top: 0, bottom: 0 };
      expect([applied.sat, applied.sab], `LC-0 env(safe-area-inset) @${profile.id}`).toEqual([want.top, want.bottom]);
    }
    if (lc.driver.engine === "chromium") {
      // Inset profiles really are in the set, and the override is cleared again on N/S (it
      // survives resizes and navigations, so a leak would silently pollute N/S results).
      expect(lc.profiles.filter((p) => p.inset).map((p) => p.id)).toEqual(["P390i", "E390i", "E360i"]);
      await lc.apply(PROFILES.E360i);
      await page.reload();
      await page.waitForSelector(".app-frame");
      const afterNav = await readViewport(page);
      expect([afterNav.sat, afterNav.sab], "LC-0 override persists across navigation").toEqual([SAFE_AREA_INSET.top, SAFE_AREA_INSET.bottom]);
      await lc.apply(PROFILES.N390);
      const cleared = await readViewport(page);
      expect([cleared.sat, cleared.sab], "LC-0 override cleared on N390").toEqual([0, 0]);
    } else {
      expect(lc.profiles.some((p) => p.inset), "LC-0 WebKit cycles no inset profile").toBe(false);
    }
  });

  test("LC-1 FREE: 22 toppings, pager, hint, BAKE (start / after fade), Discovery Result", async ({ page, lc }) => {
    test.setTimeout(240_000);
    const mount = lc.mountProfile("short");
    // Every recipe but margherita discovered: the round below discovers it (Discovery Result).
    await openWithSave(page, makeSave(ALL_RECIPES.filter((r) => r !== "margherita")));
    await lc.apply(mount);
    await page.getByRole("button", { name: /^🎨 フリークッキング/ }).click();
    await page.waitForSelector(".pizza-stage");
    const cp = (state: StateLabel, ids: InvariantId[], slots: SlotSelectors = COOKING_SLOTS.prepare) =>
      lc.checkpoint(state, ids, slots, mount);

    await cp({ label: "FREE DOUGH", meta: { mode: "FREE", step: "DOUGH" } }, PREPARE_CHECKS);
    await completeDoughStep(page);
    await next(page);
    await selectChip(page, /トマトソース/);
    await paintSauceRing(page, 25, 16);
    await cp({ label: "FREE SAUCE", meta: { mode: "FREE", step: "SAUCE" } }, PREPARE_CHECKS);
    await next(page);
    await place(page, /モッツァレラ/, [[40, 50], [60, 50], [50, 30]]);
    await cp({ label: "FREE CHEESE", meta: { mode: "FREE", step: "CHEESE" } }, PREPARE_CHECKS);
    await next(page);

    await place(page, /バジル/, [[45, 60], [58, 42]]);
    await goToTrayPage(page, "first");
    const pages = await trayPageLabel(page);
    expect(pages, "22 toppings need more than one tray page").not.toBe("1/1");
    await cp({ label: `FREE TOPPING p${pages}`, meta: { mode: "FREE", step: "TOPPING", page: pages } }, TRAY_CHECKS);
    // Discovery Hint 2.0 (#229 229-B): in Free Cooking 「ヒント」 opens the hint bottom sheet (a
    // modal over the screen) instead of rewriting the order-card line, so the tray pages are
    // cycled after closing it; the sheet's own mobile checks are e2e/discovery-hint-sheet.spec.ts.
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    const hintSheet = page.getByRole("dialog", { name: /ヒント/ });
    await expect(hintSheet).toBeVisible();
    await hintSheet.getByRole("button", { name: "閉じる" }).click();
    await expect(hintSheet).toHaveCount(0);
    await cp({ label: `FREE TOPPING p${pages} hint=closed`, meta: { hintSheet: "closed" } }, TRAY_CHECKS);
    await page.getByRole("button", { name: "次のページ" }).click();
    await cp({ label: `FREE TOPPING p${await trayPageLabel(page)} hint=closed`, meta: { hintSheet: "closed" } }, TRAY_CHECKS);
    await goToTrayPage(page, "last");
    await cp({ label: `FREE TOPPING p${await trayPageLabel(page)} (last) hint=closed`, meta: { hintSheet: "closed" } }, TRAY_CHECKS);

    await enterBakePaused(page);
    await cp({ label: "FREE BAKE start", meta: { phase: "BAKE", guide: "visible" } }, BAKE_CHECKS);
    await page.clock.runFor(AFTER_GUIDE_FADE_MS);
    await cp({ label: "FREE BAKE after guide fade", meta: { phase: "BAKE", guide: "faded" } }, BAKE_CHECKS);
    await landNeedleAndTakeOut(page, FREE_BAKE);

    if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
      await cp({ label: "FREE CUT", meta: { phase: "POST_BAKE", step: "CUT" } }, CUT_CHECKS);
      await cutThreeLines(page);
      await page.getByRole("button", { name: /切り終わる/ }).click();
    }
    await page.waitForSelector(".result-panel--discovery");
    await expect(page.locator(".discovered-banner__name")).toHaveText("マルゲリータ");
    await cp({ label: "FREE Discovery RESULT", meta: { phase: "RESULT", discovery: "margherita" } }, ["L-A", "L-D", "L-L"], {
      ...COOKING_SLOTS.result,
      names: { name: ".discovered-banner__name", card: ".result-panel" },
    });
    // 「📖 図鑑を見る」 on the Dex-registration row is reachable too.
    await cp({ label: "FREE Discovery RESULT (図鑑を見る)", meta: { phase: "RESULT" } }, ["L-A"], {
      primary: ".dex-registration-row button",
      ctaBar: ".result-panel__actions",
    });
  });

  test("LC-2 guided high-piece (Portuguesa): TOPPING, BAKE, CUT, RESULT from N390 shrinking", async ({ page, lc }) => {
    test.setTimeout(180_000);
    const mount = lc.mountProfile("nominal");
    await openWithSave(page, makeSave(ALL_RECIPES));
    await lc.apply(mount);
    await page.getByRole("button", { name: /ピザを作る/ }).first().click();
    await page.getByRole("button", { name: /^ピッツァ・ポルトゲーザ、/ }).click();
    await page.getByRole("button", { name: /このピザを作る/ }).click();
    await page.waitForSelector(".pizza-stage");
    const cp = (state: StateLabel, ids: InvariantId[], slots: SlotSelectors = COOKING_SLOTS.prepare) =>
      lc.checkpoint(state, ids, slots, mount);

    await completeDoughStep(page);
    await next(page);
    await selectChip(page, /トマトソース/);
    await paintSauceRing(page, 25, 16);
    await next(page);
    await place(page, /モッツァレラ/, [[40, 50], [60, 50]]);
    await next(page);
    await place(page, /ハム/, [[30, 40], [70, 40], [50, 70]]);
    await place(page, /たまご/, [[50, 50]]);
    await place(page, /たまねぎ/, [[35, 60], [65, 60]]);
    await place(page, /ブラックオリーブ/, [[40, 30], [60, 30]]);
    await cp({ label: "guided Portuguesa TOPPING (10 pieces)", meta: { mode: "GUIDED", recipeId: "pizza-portuguesa", step: "TOPPING" } }, TRAY_CHECKS);

    await enterBakePaused(page);
    await cp({ label: "guided Portuguesa BAKE start", meta: { phase: "BAKE" } }, BAKE_CHECKS);
    await landNeedleAndTakeOut(page, PORTUGUESA_BAKE);
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cp({ label: "guided Portuguesa CUT", meta: { phase: "POST_BAKE", step: "CUT" } }, CUT_CHECKS);
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await page.waitForSelector(".result-panel");
    await cp({ label: "guided Portuguesa RESULT", meta: { phase: "RESULT" } }, ["L-A", "L-D"], COOKING_SLOTS.result);
  });

  test("LC-2b New Haven: BAKE goes straight to RESULT (no CUT)", async ({ page, lc }) => {
    test.setTimeout(150_000);
    const mount = lc.mountProfile("nominal");
    await openWithSave(page, makeSave(ALL_RECIPES));
    await lc.apply(mount);
    await page.getByRole("button", { name: /ピザを作る/ }).first().click();
    await page.getByRole("button", { name: /^ニューヘイブンアピッツァ、/ }).click();
    await page.getByRole("button", { name: /このピザを作る/ }).click();
    await page.waitForSelector(".pizza-stage");
    await expect(page.locator(".making-step-tab").filter({ hasText: /カット/ })).toHaveCount(0);

    await completeDoughStep(page);
    await next(page);
    await selectChip(page, /オリーブオイル/);
    await paintSauceRing(page, 25, 16);
    await next(page);
    await place(page, /パルミジャーノ/, [[40, 50], [60, 50]]);
    await next(page);
    await place(page, /あさり/, [[30, 40], [70, 40], [50, 70]]);
    await place(page, /にんにく/, [[40, 60], [60, 30]]);
    await cp_(lc, mount, { label: "New Haven TOPPING", meta: { recipeId: "new-haven-apizza" } }, TRAY_CHECKS);

    await enterBakePaused(page);
    await cp_(lc, mount, { label: "New Haven BAKE start", meta: { phase: "BAKE" } }, BAKE_CHECKS);
    await page.clock.runFor(AFTER_GUIDE_FADE_MS);
    await cp_(lc, mount, { label: "New Haven BAKE after guide fade", meta: { phase: "BAKE" } }, BAKE_CHECKS);
    await landNeedleAndTakeOut(page, NEW_HAVEN_BAKE);
    await page.waitForSelector(".result-panel");
    await expect(page.getByRole("button", { name: /切り終わる/ })).toHaveCount(0);
    await expect(page.locator(".cut-evaluation-summary")).toHaveCount(0);
    await cp_(lc, mount, { label: "New Haven RESULT (no CUT)", meta: { phase: "RESULT" } }, ["L-A", "L-D"], COOKING_SLOTS.result);
  });

  test("LC-3 Lunch Rush: HUD with PREPARE, BAKE x2, CUT, serve, mission RESULT", async ({ page, lc }) => {
    test.setTimeout(240_000);
    const mount = lc.mountProfile("short");
    // Only Portuguesa discovered: every Lunch Rush order is Portuguesa (pool = discovered ∩
    // available), a high-piece recipe with a CUT step.
    await openWithSave(page, makeSave(["pizza-portuguesa"]), "?missionDuration=900");
    await lc.apply(mount);
    await page.getByRole("button", { name: /ランチラッシュ/ }).click();
    await page.getByRole("button", { name: "スタート" }).click();
    await page.getByRole("button", { name: "ピザを作る！" }).click();
    await page.waitForSelector(".pizza-stage");
    await expect(page.locator(".mission-hud")).toBeVisible();

    await completeDoughStep(page);
    await next(page);
    await selectChip(page, /トマトソース/);
    await paintSauceRing(page, 25, 16);
    await next(page);
    await place(page, /モッツァレラ/, [[40, 50], [60, 50]]);
    await next(page);
    await place(page, /ハム/, [[30, 40], [70, 40], [50, 70]]);
    await place(page, /たまご/, [[50, 50]]);
    await place(page, /たまねぎ/, [[35, 60], [65, 60]]);
    await place(page, /ブラックオリーブ/, [[40, 30], [60, 30]]);
    await cp_(lc, mount, { label: "LR PREPARE TOPPING", meta: { mode: "LUNCH_RUSH" } }, withHud(TRAY_CHECKS));

    await enterBakePaused(page);
    await cp_(lc, mount, { label: "LR BAKE start", meta: { phase: "BAKE" } }, withHud(BAKE_CHECKS));
    await page.clock.runFor(AFTER_GUIDE_FADE_MS);
    await cp_(lc, mount, { label: "LR BAKE after guide fade", meta: { phase: "BAKE" } }, withHud(BAKE_CHECKS));
    await landNeedleAndTakeOut(page, PORTUGUESA_BAKE);
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cp_(lc, mount, { label: "LR CUT", meta: { phase: "POST_BAKE" } }, withHud(CUT_CHECKS));
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await page.waitForSelector(".mission-serve-panel");
    await cp_(lc, mount, { label: "LR serve", meta: { phase: "RESULT", mission: "serve" } }, ["L-A", "L-D"], {
      primary: ".mission-serve-panel .cta-button--primary",
      ctaBar: ".mission-serve-panel",
    });
    await page.locator(".mission-serve-panel .cta-button--primary").click();
    // End the mission: the timer reads Date.now(), which the installed clock controls.
    await page.clock.fastForward(900_000);
    await page.waitForSelector(".mission-result__stats");
    await cp_(lc, mount, { label: "LR mission RESULT", meta: { mission: "result" } }, ["L-A", "L-D"], {
      primary: ".mission-result__stats ~ .action-row .cta-button--primary",
      ctaBar: ".mission-result__stats ~ .action-row",
    });
  });

  test("LC-3b Lunch Rush shortage ORDER (#212): 4 short materials, skip CTA, then the cookable order", async ({ page, lc }) => {
    test.setTimeout(120_000);
    const mount = lc.mountProfile("short");
    // margherita + quattro-formaggi discovered, its 4 finite materials owned at 0: the first order
    // is the short quattro-formaggi (avoidRepeat excludes the initial margherita round) -- the
    // widest shortage card in the W1 catalog.
    const qf = ["olive-oil", "gorgonzola", "parmigiano", "fontina"];
    await openWithSave(
      page,
      {
        schemaVersion: 2,
        dex: ["margherita", "quattro-formaggi"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
        pitzBalance: 150,
        ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...qf],
        missionBest: {},
        inventory: Object.fromEntries(qf.map((m) => [m, 0])),
      },
      "?missionDuration=900",
    );
    await lc.apply(mount);
    await page.getByRole("button", { name: /ランチラッシュ/ }).click();
    await page.getByRole("button", { name: "スタート" }).click();
    await expect(page.locator(".mission-shortage-panel__item")).toHaveCount(4);
    await cp_(lc, mount, { label: "LR shortage ORDER", meta: { mission: "shortage", shortages: 4 } }, ["L-A", "L-D", "L-E", "L-G"], {
      primary: ".mission-shortage-panel .cta-button--primary",
      ctaBar: ".mission-shortage-panel",
    });
    await page.getByRole("button", { name: "この注文をスキップ" }).click();
    await page.waitForSelector(".making-step-tabs");
    await cp_(lc, mount, { label: "LR after skip PREPARE", meta: { mode: "LUNCH_RUSH" } }, withHud(PREPARE_CHECKS));
  });

  test("LC-4 HOME: Dex 0 and Dex 1 on every profile (CTA shape, skeleton stable)", async ({ page, lc }) => {
    test.setTimeout(150_000);
    const slots: SlotSelectors = {
      primary: ".home-cta-row .cta-button--primary",
      homeCtas: ".home-cta-row .cta-button",
      headerControls: ".app-header button",
      bottomControls: ":not(*)",
    };
    const ids: InvariantId[] = ["L-A", "L-D", "L-H", "L-I", "L-M"];
    for (const profile of lc.profiles) {
      await lc.apply(profile);
      await openWithSave(page, null);
      const applied0 = await lc.apply(profile);
      const dex0 = await measureLayout(page, slots);
      const s0 = { label: "HOME Dex 0", meta: { dex: 0 } };
      await lc.recordExtra(s0, profile, applied0, dex0, evaluateInvariants(dex0, ids, { profileId: profile.id, state: s0.label }));
      if (profile.id === "N390" || profile.id === "E360i" || profile.id === "S360") await lc.attachShot(`home-dex0-${profile.id}.png`);

      await openWithSave(page, DEX1_SAVE);
      const applied1 = await lc.apply(profile);
      const dex1 = await measureLayout(page, slots);
      const s1 = { label: "HOME Dex 1", meta: { dex: 1 } };
      const ctx = { profileId: profile.id, state: s1.label };
      const results = evaluateInvariants(dex1, ids, ctx);
      // L-O: same 2+1 skeleton -- same number of CTA rows and every CTA slot (DOM order) at the
      // same top; the emphasis (primary) may move between slots, the slots may not.
      const rows = (m: typeof dex0) => new Set(m.homeCtas.map((c) => Math.round(c.rect.top))).size;
      results.push(compareStable("L-O", "HOME CTA rows", rows(dex0), rows(dex1), ctx));
      dex0.homeCtas.forEach((c, i) => {
        const after = dex1.homeCtas[i];
        if (after) results.push(compareStable("L-O", `HOME CTA[${i}] top`, c.rect.top, after.rect.top, ctx));
      });
      expect.soft(dex1.homeCtas.length, `L-O HOME CTA count @${profile.id}`).toBe(dex0.homeCtas.length);
      await lc.recordExtra(s1, profile, applied1, dex1, results);
      if (profile.id === "N390" || profile.id === "E360i" || profile.id === "S360") await lc.attachShot(`home-dex1-${profile.id}.png`);
    }
  });

  test("LC-5 Pizza Select (long names, detail CTA) and Shop (last row)", async ({ page, lc }) => {
    test.setTimeout(150_000);
    const mount = lc.mountProfile("nominal");
    await openWithSave(page, makeSave(ALL_RECIPES));
    await lc.apply(mount);
    await page.getByRole("button", { name: /ピザを作る/ }).first().click();
    await page.waitForSelector(".pizza-select-grid-card");
    await expect(page.locator(".pizza-select-grid-card")).toHaveCount(25);
    await lc.checkpoint({ label: "Pizza Select grid (25 cards)", meta: { screen: "PIZZA_SELECT" } }, ["L-D", "L-L"], {
      primary: ".pizza-select-grid-card",
      names: { name: ".pizza-select-grid-card .pizza-select-card__name", card: ".pizza-select-grid-card" },
    }, mount);

    await page.getByRole("button", { name: /^ニューヘイブンアピッツァ、/ }).click();
    await lc.checkpoint({ label: "Pizza Select detail (ニューヘイブンアピッツァ)", meta: { screen: "PIZZA_SELECT_DETAIL" } }, ["L-A", "L-D", "L-L"], {
      primary: ".pizza-select-cta",
      names: { name: ".pizza-select-detail .pizza-select-card__name", card: ".pizza-select-card" },
    }, mount);

    await page.getByRole("button", { name: /レシピ一覧に戻る/ }).click();
    await page.getByRole("button", { name: /ホーム/ }).click();
    await page.locator(".home-menu__card").filter({ hasText: "ショップ" }).click();
    await page.waitForSelector(".shop-overlay__list");
    // The Shop list scrolls inside `.dex-overlay__body` (its bottom padding includes the inset):
    // scroll it to its very end, then the last row's button must be fully reachable (L-A).
    const lastBuy = ".shop-overlay__list > :last-child .shop-item__buy button";
    await lc.checkpoint({ label: "Shop last row (list scrolled to end)", meta: { screen: "SHOP" } }, ["L-A", "L-D", "L-I"], {
      primary: lastBuy,
      header: ".dex-overlay__header",
      headerControls: ".dex-overlay__close",
      bottomControls: ":not(*)",
    }, mount, {
      beforeMeasure: async () => {
        await page.locator(".dex-overlay__body").evaluate((el) => el.scrollTo(0, el.scrollHeight));
      },
    });
  });
});

function cp_(lc: LayoutContract, mount: ReturnType<LayoutContract["mountProfile"]>, state: StateLabel, ids: InvariantId[], slots: SlotSelectors = COOKING_SLOTS.prepare) {
  return lc.checkpoint(state, ids, slots, mount);
}
