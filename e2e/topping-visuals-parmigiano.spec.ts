import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Topping Visuals 2.0 PR-1 / Issue #825 SPRINKLE Pilot: the parmigiano the player places is drawn as a sprinkle of thin shaved flakes -- broad flakes, long ribbons, crumbs (placed-only SVG, one tap = one piece), while the
 * tray chip -- the selection representation -- stays exactly the existing CSS plate. Real-browser (Chromium + WebKit, 390x844 and 360x800); the visual
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

test.describe("Topping Visuals 2.0 / #825: parmigiano sprinkle", () => {
  test("one tap = one piece drawn as a sprinkle; pieces differ; chip stays the plate; Undo; survives bake -> RESULT; stays on the dough", async ({ page }) => {
    test.setTimeout(120_000);
    await startWithParmigiano(page);

    // Selection representation (tray chip) is unchanged: the existing CSS plate, no SVG, no glyph modifier.
    const chip = page.getByRole("button", { name: /パルミジャーノ/ }).first();
    await expect(chip).toBeVisible();
    await expect(chip.locator(".pizza-cheese.pizza-cheese--parmigiano")).toHaveCount(1);
    await expect(chip.locator(".pizza-cheese--glyph")).toHaveCount(0);
    await expect(chip.locator("svg")).toHaveCount(0);

    await chip.click();
    const pieces = page.locator(".pizza-topping--parmigiano");
    const undo = page.getByRole("button", { name: "1つ戻す" });
    // three taps, the way the Owner placed them on the iPhone
    await tapDoughPercent(page, 50, 30);
    await tapDoughPercent(page, 28, 62);
    await tapDoughPercent(page, 72, 62);
    await page.waitForTimeout(900);

    // One tap = one piece (no second record per tap), each drawn as a sprinkle of many shavings.
    await expect(pieces).toHaveCount(3);
    const signatures = await pieces.evaluateAll((els) =>
      els.map((el) => ({ shavings: el.querySelectorAll("g[data-shaving]").length, markup: el.querySelector("svg")?.innerHTML ?? "" })),
    );
    for (const s of signatures) expect(s.shavings).toBeGreaterThanOrEqual(11);
    // The three sprinkles are not the same stamp.
    expect(new Set(signatures.map((s) => s.markup)).size).toBe(3);
    // A wide placed box (not the old 28px glyph).
    const box = await pieces.first().locator("svg").boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(40);
    await expect(page.locator(".pizza-topping--parmigiano .pizza-cheese--glyph")).toHaveCount(3);
    // The tray chip is still the plate after placing.
    await expect(page.getByRole("button", { name: /パルミジャーノ/ }).first().locator("svg")).toHaveCount(0);

    // Undo takes back exactly one piece (the existing contract); the freed slot can be used again.
    await undo.click();
    await expect(pieces).toHaveCount(2);
    await chip.click();
    await tapDoughPercent(page, 72, 62);
    await page.waitForTimeout(900);
    await expect(pieces).toHaveCount(3);
    const placedMarkup = await pieces.evaluateAll((els) => els.map((el) => el.querySelector("svg")?.innerHTML ?? ""));

    // Every sprinkle's shavings stay on the dough (inside its circle, with the crust band allowed).
    const outside = await page.evaluate(() => {
      const dough = document.querySelector(".pizza-stage")?.getBoundingClientRect();
      if (!dough) return -1;
      const cx = dough.left + dough.width / 2;
      const cy = dough.top + dough.height / 2;
      const radius = Math.min(dough.width, dough.height) / 2;
      let bad = 0;
      for (const shaving of document.querySelectorAll(".pizza-topping--parmigiano g[data-shaving]")) {
        const r = shaving.getBoundingClientRect();
        const dx = r.left + r.width / 2 - cx;
        const dy = r.top + r.height / 2 - cy;
        if (Math.hypot(dx, dy) > radius) bad += 1;
      }
      return bad;
    });
    expect(outside).toBe(0);

    await page.getByRole("button", { name: /次へ/ }).click();
    await bakeToTarget(page, FREE_COOK_BAKE_TARGET);
    await page.waitForSelector(".result-panel");

    // Baked / RESULT: the same sprinkles (same ids -> same layouts), still inside the bake-styled cheese wrapper, no horizontal overflow.
    await expect(pieces).toHaveCount(3);
    const baked = await pieces.evaluateAll((els) => els.map((el) => el.querySelector("svg")?.innerHTML ?? ""));
    expect(baked).toEqual(placedMarkup);
    const wrapperStyle = await page.locator(".pizza-topping--parmigiano .pizza-cheese--glyph").first().evaluate((el) => (el as HTMLElement).getAttribute("style") ?? "");
    expect(wrapperStyle).toContain("--bake-melt-scale");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
  test("taps at the rim: every shaving centre stays on the dough, in the placed view and in RESULT", async ({ page }) => {
    test.setTimeout(120_000);
    await startWithParmigiano(page);
    await page.getByRole("button", { name: /パルミジャーノ/ }).first().click();
    for (const [x, y] of [[50, 8], [90, 50], [20, 20], [50, 92]]) await tapDoughPercent(page, x, y);
    await page.waitForTimeout(900);
    const pieces = page.locator(".pizza-topping--parmigiano");
    await expect(pieces).toHaveCount(4);
    const outsideDough = () =>
      page.evaluate(() => {
        const dough = document.querySelector(".pizza-stage")?.getBoundingClientRect();
        if (!dough) return -1;
        const cx = dough.left + dough.width / 2;
        const cy = dough.top + dough.height / 2;
        const radius = Math.min(dough.width, dough.height) * 0.48; // DOUGH_RADIUS 48% of the stage box
        let bad = 0;
        for (const shaving of document.querySelectorAll(".pizza-topping--parmigiano g[data-shaving]")) {
          const r = shaving.getBoundingClientRect();
          if (Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) > radius) bad += 1;
        }
        return bad;
      });
    expect(await outsideDough()).toBe(0);
    const placed = await pieces.evaluateAll((els) => els.map((el) => el.querySelector("svg")?.innerHTML ?? ""));
    await page.getByRole("button", { name: /次へ/ }).click();
    await bakeToTarget(page, FREE_COOK_BAKE_TARGET);
    await page.waitForSelector(".result-panel");
    await expect(pieces).toHaveCount(4);
    expect(await outsideDough()).toBe(0);
    expect(await pieces.evaluateAll((els) => els.map((el) => el.querySelector("svg")?.innerHTML ?? ""))).toEqual(placed);
  });
});
