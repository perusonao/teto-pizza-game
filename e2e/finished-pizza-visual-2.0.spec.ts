import { test, expect, type Page } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  cutThreeLines,
  paintSauceRing,
  playFullCapricciosaRound,
  startCapricciosaUnlocked,
  startFreshMargherita,
  startLunchRushMission,
  tapDoughPercent,
} from "./gestures";

/**
 * Gameplay UX PR-E: Finished Pizza Visual 2.0 (Issue #186, umbrella #176). See the Fresh Audit's
 * §7 "Audit E -- Finished Pizza Visual 2.0" (docs/reports/
 * TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md) and this PR's own Result Report. Scope: replace
 * the accidental cheese-filter reuse on non-cheese toppings (../src/logic/bakeVisual.ts's old
 * `cheeseVisualFrame` applied to every topping) with a deliberate, continuous, per-category
 * curve (`toppingVisualFrame`) -- toppings roast visibly, green herbs (`bakeRoastResistant`)
 * roast far more gently so they stay identifiable, cheese keeps its existing melt/toast/char
 * curve unchanged. No scoring/bakeTarget/timing/recipe-gameplay change.
 *
 * Scenarios follow the task prompt's own lettering (A-E). Real-browser only (jsdom/vitest never
 * lays out real filter/color pixels) -- runs under both the Chromium and WebKit Playwright
 * projects, both viewports (playwright.config.ts).
 */

const BAKE_TARGET = {
  margherita: { start: 60, end: 80 },
  capricciosa: { start: 58, end: 78 },
} as const;

async function toppingFilter(page: Page, ingredientId: string) {
  return page
    .locator(`.pizza-topping--${ingredientId} .ingredient-piece-visual__emoji`)
    .first()
    .evaluate((el) => (el as HTMLElement).style.filter);
}

async function cheeseFilter(page: Page) {
  return page.locator(".pizza-cheese").first().evaluate((el) => (el as HTMLElement).style.filter);
}

function sepiaOf(filter: string): number {
  return Number(filter.match(/sepia\(([\d.]+)\)/)?.[1] ?? "0");
}

function brightnessOf(filter: string): number {
  return Number(filter.match(/brightness\(([\d.]+)\)/)?.[1] ?? "1");
}

test.describe("Scenario A: 390x844 Margherita IDEAL -> CUT -> RESULT", () => {
  test("crust/cheese/basil visibly baked, CUT visible, RESULT continuity, Timing Transparency/CTA intact", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);

    // Read the topping filter at the very end of BAKE (before CUT/RESULT), then again once
    // RESULT is reached -- must be byte-identical (BAKE -> RESULT continuity, task section 11).
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
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);

    await bakeToTarget(page, BAKE_TARGET.margherita);
    const basilFilterAtBakeEnd = await toppingFilter(page, "basil");
    expect(basilFilterAtBakeEnd, "basil must have a bake-derived filter once baked").toContain("brightness(");
    expect(basilFilterAtBakeEnd, "basil's own drop-shadow must survive the roast filter merge").toContain(
      "drop-shadow(",
    );

    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    await page.getByRole("button", { name: /切り終わる/ }).click();

    await expect(page.locator(".result-panel")).toBeVisible();

    // RESULT continuity: identical bake state, so identical filter as the BAKE-end reading above.
    const basilFilterAtResult = await toppingFilter(page, "basil");
    expect(basilFilterAtResult, "topping bake styling must not change between BAKE and RESULT").toBe(
      basilFilterAtBakeEnd,
    );

    // Crust: continuous dough-shape background is present and non-empty (baked, not raw pale).
    const doughBackground = await page.locator(".pizza-dough-shape").evaluate((el) => (el as HTMLElement).style.background);
    expect(doughBackground).not.toBe("");

    // Cheese: keeps its own dedicated melt/toast/char curve, distinct from the topping curve.
    const cheese = await cheeseFilter(page);
    expect(cheese).toContain("brightness(");
    expect(cheese).not.toBe(basilFilterAtResult);

    // CUT visibility persists into RESULT.
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    await expect(page.locator(".cut-evaluation-summary")).toBeVisible();

    // RESULT 1-Screen 2.0 (PR #181) / Timing Transparency (PR #185) regressions.
    await expect(page.locator(".result-panel__actions")).toBeVisible();
    await expect(page.getByRole("button", { name: "もう一度つくる" })).toBeVisible();
    await expect(page.locator(".cooking-timing-summary").first()).toBeVisible();
  });
});

test.describe("Scenario B: topping-heavy recipe (Capricciosa) IDEAL -- multiple toppings, identity preserved", () => {
  test("cheese/mushroom/oregano(herb)/ham/black-olive all stay visually distinct, no blanket muddy filter", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startCapricciosaUnlocked(page);
    await playFullCapricciosaRound(page);
    await expect(page.locator(".result-panel")).toBeVisible();

    const [mushroom, oregano, ham, blackOlive, cheese] = await Promise.all([
      toppingFilter(page, "mushroom"),
      toppingFilter(page, "oregano"),
      toppingFilter(page, "ham"),
      toppingFilter(page, "black-olive"),
      cheeseFilter(page),
    ]);

    // Every non-cheese topping actually has its own dedicated (non-empty) roast filter -- not
    // just left over from a shared default.
    for (const filter of [mushroom, oregano, ham, blackOlive]) {
      expect(filter).toContain("brightness(");
      expect(filter).toContain("drop-shadow(");
    }

    // Not a blanket identical filter across every topping -- oregano (a green herb,
    // `bakeRoastResistant`) must roast visibly more gently than the plain toppings around it.
    expect(sepiaOf(oregano)).toBeLessThan(sepiaOf(mushroom));
    expect(sepiaOf(oregano)).toBeLessThan(sepiaOf(ham));
    expect(sepiaOf(oregano)).toBeLessThan(sepiaOf(blackOlive));
    expect(brightnessOf(oregano)).toBeGreaterThan(brightnessOf(mushroom));

    // Cheese keeps its own distinct curve from every topping's.
    expect(cheese).not.toBe(mushroom);
    expect(cheese).not.toBe(oregano);

    // Every placed piece is still individually visible (identity preserved, not collapsed into
    // one indistinguishable mass).
    await expect(page.locator(".pizza-cheese")).toHaveCount(2);
    await expect(page.locator(".pizza-topping--mushroom")).toHaveCount(2);
    await expect(page.locator(".pizza-topping--oregano")).toHaveCount(1);
    await expect(page.locator(".pizza-topping--ham")).toHaveCount(1);
    await expect(page.locator(".pizza-topping--black-olive")).toHaveCount(2);
  });
});

test.describe("Scenario C: Margherita OVERBAKED -- visible difference from IDEAL, localized darkening", () => {
  test("toppings/crust roast further than IDEAL, darkening stays on the pizza only, CUT still visible", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);

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
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);

    // Clearly later than IDEAL (target center 70) but still inside the Completion Gate's own
    // BAKE_ACCEPTABLE_MARGIN_RATIO (0.5 -- margherita's own {60,80} span=20 => margin=10, so 89
    // stays PASS/servable) -- an overbaked-but-still-real pizza, not a FAILED round.
    await bakeToTarget(page, { start: 88, end: 90 });
    const overbakedBasilAtBake = await toppingFilter(page, "basil");

    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await expect(page.locator(".result-panel")).toBeVisible();
    const overbakedBasil = await toppingFilter(page, "basil");
    expect(overbakedBasil, "overbaked roast must persist through CUT into RESULT").toBe(overbakedBasilAtBake);

    // Darkening is local to the pizza element, not a page-wide filter/overlay.
    const bodyFilter = await page.evaluate(() => getComputedStyle(document.body).filter);
    expect(bodyFilter === "none" || bodyFilter === "").toBe(true);

    // UI (CTA/header) unaffected, CUT still visible at RESULT.
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "もう一度つくる" })).toBeVisible();

    // Compare against a fresh IDEAL round's own basil filter (Scenario A's own target center) --
    // done last, on a fresh round, so it can't disturb the overbaked round's own CUT/RESULT state
    // asserted above.
    await startFreshMargherita(page);
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
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
    await bakeToTarget(page, BAKE_TARGET.margherita);
    const idealBasil = await toppingFilter(page, "basil");

    expect(sepiaOf(overbakedBasil), "overbaked must roast further than ideal").toBeGreaterThan(sepiaOf(idealBasil));
    expect(brightnessOf(overbakedBasil)).toBeLessThan(brightnessOf(idealBasil));
  });
});

test.describe("Scenario D: 360x800 heavy recipe (Capricciosa) -> RESULT -- visual + 1-screen contract", () => {
  test("finished pizza visual renders correctly, no clipping/horizontal overflow, CTA + timing intact", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startCapricciosaUnlocked(page);
    await playFullCapricciosaRound(page);
    await expect(page.locator(".result-panel")).toBeVisible();

    const doc = await page.evaluate(() => ({
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(doc.docScrollWidth, "no horizontal overflow").toBeLessThanOrEqual(doc.innerWidth);

    const mushroomFilter = await toppingFilter(page, "mushroom");
    expect(mushroomFilter).toContain("drop-shadow(");

    await expect(page.getByRole("button", { name: "もう一度つくる" })).toBeVisible();
    await expect(page.locator(".cooking-timing-summary").first()).toBeVisible();
  });
});

test.describe("Scenario E: Lunch Rush regression", () => {
  test("pizza rendering/MissionHud/RESULT unaffected by the new topping roast model", async ({ page }) => {
    test.setTimeout(60_000);
    // A fresh save (startLunchRushMission clears localStorage) owns/unlocks only margherita --
    // the same "only unlockCondition-free recipe" fact startFreshMargherita's own doc comment
    // relies on -- so Lunch Rush's order picker can only ever draw margherita here too.
    await startLunchRushMission(page, 180);
    await expect(page.locator(".mission-hud__timer")).toBeVisible();

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
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);

    await bakeToTarget(page, BAKE_TARGET.margherita);
    const missionBasilFilter = await toppingFilter(page, "basil");
    expect(missionBasilFilter).toContain("drop-shadow(");

    if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
      await cutThreeLines(page);
      await page.getByRole("button", { name: /切り終わる/ }).click();
    }

    await expect(page.locator(".mission-serve-panel")).toBeVisible();
    await expect(page.locator(".mission-serve-panel--failed")).toHaveCount(0);
    await expect(page.locator(".mission-hud__timer")).toBeVisible();
  });
});
