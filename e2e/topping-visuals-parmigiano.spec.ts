import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Topping Visuals 2.0 PR-1 (Issue #824, Pilot 1): the parmigiano the player places is drawn as a pile of shavings (placed-only SVG), while the tray
 * chip -- the selection representation -- stays exactly the existing CSS plate. Real-browser (Chromium + WebKit, 390x844 and 360x800); the visual
 * judgement (does it read as shavings, is it distinct from ricotta-salata / truffle / mozzarella) is the Owner's iPhone HV, not this spec's.
 * Free Cooking with a throwaway in-memory-ish save (localStorage of this browser context only) that owns mozzarella, tomato sauce and parmigiano.
 */
const FREE_COOK_BAKE_TARGET = { start: 58, end: 78 };

async function startWithParmigiano(page: Page) {
  const owned = ["mozzarella", "basil", "tomato-sauce", "parmigiano"];
  const inventory = Object.fromEntries(owned.map((id) => [id, 99]));
  await page.addInitScript(
    (raw) => localStorage.setItem("teto-pizza-save-v1", JSON.stringify(raw)),
    { schemaVersion: 2, dex: [], pitzBalance: 500, ownedIngredientIds: owned, missionBest: {}, inventory, starterGrantClaimedRecipeIds: [] },
  );
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
}

test.describe("Topping Visuals 2.0 PR-1: parmigiano placed drawing", () => {
  test("chip stays the CSS plate; the placed piece is the shavings SVG, visible, and survives bake -> RESULT", async ({ page }) => {
    test.setTimeout(90_000);
    await startWithParmigiano(page);

    // Selection representation (tray chip) is unchanged: the existing CSS plate, no SVG, no glyph modifier.
    const chip = page.getByRole("button", { name: /パルミジャーノ/ }).first();
    await expect(chip).toBeVisible();
    await expect(chip.locator(".pizza-cheese.pizza-cheese--parmigiano")).toHaveCount(1);
    await expect(chip.locator(".pizza-cheese--glyph")).toHaveCount(0);
    await expect(chip.locator("svg")).toHaveCount(0);

    await chip.click();
    await tapDoughPercent(page, 50, 30);
    await tapDoughPercent(page, 50, 68);

    // Placed: the shavings drawing inside the existing .pizza-cheese wrapper, with a legible footprint (not a hairline plate).
    const placed = page.locator('.pizza-topping--parmigiano svg[data-ingredient-visual="parmigiano-shavings"]');
    await expect(placed.first()).toBeVisible();
    expect(await placed.count()).toBe(2);
    const box = await placed.first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(18);
    expect(box!.height).toBeGreaterThanOrEqual(18);
    await expect(page.locator(".pizza-topping--parmigiano .pizza-cheese--glyph")).toHaveCount(2);

    // The tray chip is still the plate after placing.
    await expect(page.getByRole("button", { name: /パルミジャーノ/ }).first().locator("svg")).toHaveCount(0);

    await page.getByRole("button", { name: /次へ/ }).click();
    await bakeToTarget(page, FREE_COOK_BAKE_TARGET);
    await page.waitForSelector(".result-panel");

    // Baked / RESULT: still the shavings, still inside the bake-styled cheese wrapper (the existing melt scale + filter apply to it), no horizontal overflow.
    const baked = page.locator('.pizza-topping--parmigiano svg[data-ingredient-visual="parmigiano-shavings"]');
    await expect(baked.first()).toBeVisible();
    const wrapperStyle = await page.locator(".pizza-topping--parmigiano .pizza-cheese--glyph").first().evaluate((el) => (el as HTMLElement).getAttribute("style") ?? "");
    expect(wrapperStyle).toContain("--bake-melt-scale");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
