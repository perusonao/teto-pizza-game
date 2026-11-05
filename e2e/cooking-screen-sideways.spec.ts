import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Issue #764 (from PR #759, Owner decision PR #759 comment 6663668627): in WebKit 360×800 the cooking screen
 * `.game-screen--cooking` was measured `scrollWidth 386 > clientWidth 360` (scrollLeft 26) at the SAUCE step, so the whole
 * cooking screen, CTA bar included, could slide sideways. This spec walks a Free Cooking round through every step with an
 * ordinary sauce (tomato) and with the two sauces Batch 18 paints (curry-ketchup, fromage-blanc-sauce) and asserts at each
 * step that the cooking screen cannot scroll sideways. A failure names the elements that stick out (deepest first), so the
 * culprit is identified from the run itself rather than guessed.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (human-paced video).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const OWNED = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]).filter((id) => !STARTERS.includes(id));
const SAVE = JSON.stringify({
  schemaVersion: 2,
  dex: RECIPES.map((r) => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: [...STARTERS, ...OWNED],
  missionBest: {},
  inventory: Object.fromEntries(OWNED.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: OWNED,
});

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });
const hold = (page: Page, ms = 1200) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${name}-${test.info().project.name}.png` });
}

/** The cooking screen's sideways overflow, and the elements that stick out past its right edge (deepest first). */
async function measure(page: Page) {
  return page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>(".game-screen");
    if (!screen) return null;
    const box = screen.getBoundingClientRect();
    const limit = box.left + screen.clientWidth + 1;
    const depth = (el: Element) => {
      let d = 0;
      for (let e: Element | null = el; e && e !== screen; e = e.parentElement) d += 1;
      return d;
    };
    const offenders = [...screen.querySelectorAll<HTMLElement>("*")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      // Undo the screen's own scroll so a scrolled screen still reports what sticks out.
      .filter(({ r }) => r.width > 0 && r.right + screen.scrollLeft > limit)
      .map(({ el, r }) => {
        const cs = getComputedStyle(el);
        return {
          depth: depth(el),
          el: `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 3).join(".")}`,
          text: (el.textContent ?? "").trim().slice(0, 16),
          left: Math.round(r.left + screen.scrollLeft),
          right: Math.round(r.right + screen.scrollLeft),
          width: Math.round(r.width),
          minWidth: cs.minWidth,
          flex: cs.flex,
          whiteSpace: cs.whiteSpace,
          position: cs.position,
          transform: cs.transform === "none" ? "" : cs.transform,
        };
      })
      .sort((a, b) => b.depth - a.depth)
      .slice(0, 12);
    return {
      scrollWidth: screen.scrollWidth,
      clientWidth: screen.clientWidth,
      scrollLeft: screen.scrollLeft,
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders,
    };
  });
}

async function expectNoSideways(page: Page, where: string) {
  // A running step animation is not a layout state: measure once it settles.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), undefined, { timeout: 5_000 }).catch(() => undefined);
  const m = await measure(page);
  expect(m, `${where}: no .game-screen`).not.toBeNull();
  const detail = `${where}: scrollWidth ${m!.scrollWidth} / clientWidth ${m!.clientWidth} / scrollLeft ${m!.scrollLeft}; sticking out: ${JSON.stringify(m!.offenders)}`;
  test.info().annotations.push({ type: "measure", description: detail });
  expect(m!.docOverflow, `${detail} (page)`).toBeLessThanOrEqual(0);
  expect(m!.scrollWidth - m!.clientWidth, detail).toBeLessThanOrEqual(1);
  expect(m!.scrollLeft, detail).toBe(0);
}

const SAUCES: readonly [string, RegExp][] = [
  ["tomato", /トマトソース/],
  ["curry-ketchup", /カレーケチャップ/],
  ["fromage-blanc", /フロマージュブラン/],
];

for (const [slug, sauce] of SAUCES) {
  test(`Issue #764: the cooking screen never scrolls sideways (dough -> ${slug} sauce -> cheese -> topping -> bake)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("icons/icon-16.png");
    await page.evaluate(([k, v]) => {
      localStorage.clear();
      localStorage.setItem(k, v);
    }, [SAVE_KEY, SAVE] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await expectNoSideways(page, "dough (start)");
    await completeDoughStep(page);
    await expectNoSideways(page, "dough (done)");
    await hold(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await expectNoSideways(page, "sauce (arrival)");
    await (await chipOnTrayOrPin(page, sauce)).click();
    await expectNoSideways(page, `sauce (${slug} picked)`);
    await paintSauceRing(page, 25, 16);
    await expectNoSideways(page, `sauce (${slug} painted)`);
    await shot(page, `sideways-${slug}-sauce`);
    await hold(page, 1800);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    await (await chipOnTrayOrPin(page, /モッツァレラ/)).click();
    await tapDoughPercent(page, 50, 30);
    await tapDoughPercent(page, 50, 70);
    await expectNoSideways(page, "cheese");
    await hold(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    await expectNoSideways(page, "topping (arrival)");
    await (await chipOnTrayOrPin(page, /バジル/)).click();
    await tapDoughPercent(page, 35, 45);
    await tapDoughPercent(page, 65, 55);
    await expectNoSideways(page, "topping (placed)");
    await shot(page, `sideways-${slug}-topping`);
    await hold(page, 1500);
    await page.getByRole("button", { name: /焼く/ }).click();
    await page.waitForSelector(".bake-gauge__needle");
    await expectNoSideways(page, "bake");
    await shot(page, `sideways-${slug}-bake`);
    await hold(page, 1500);
  });
}
