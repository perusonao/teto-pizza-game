import { expect, test, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../../src/data/discoveryLadder";
import { INGREDIENTS, ingredientsByCategory } from "../../src/data/ingredients";
import { FAMILY_DISPLAY } from "../../src/data/familyDisplay";
import { CHIP_ROW_FADE_PX } from "../../src/logic/chipRowAlign";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../gestures";
import { startTargetlessFreeCook } from "./startFreeCook";

/**
 * Shared by the family filter specs (Issue #399): the saves, the boots, and the measures of the family row. The row is
 * either `expanded` (its own full-width row above the tray, the pager and 食材庫 in the utility row below) or `compact`
 * (inside the utility row, the one-row layout a short visible height keeps); `rowState().mode` says which.
 */
export const SAVE_KEY = "teto-pizza-save-v1";
export const TOPPING_IDS = ingredientsByCategory("topping").map((i) => i.id);
export const LONGEST_LABEL = FAMILY_DISPLAY.other.labelJa; // 「ちょっと変わった材料」, the longest chip (about 144px)


export const base = (owned: readonly string[]) => ({
  schemaVersion: 2,
  dex: [] as unknown[],
  pitzBalance: 0,
  ownedIngredientIds: owned,
  missionBest: {},
  inventory: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])),
  starterGrantClaimedRecipeIds: [] as string[],
});
export const HAND_ON_OWNED = INGREDIENTS.map((i) => i.id); // owned >= 13: the production Hand is active
export const HAND_OFF_OWNED = ["tomato-sauce", "mozzarella", ...TOPPING_IDS.slice(0, 9)]; // 11 owned: no hand, still > 6 toppings
/** 11 owned = no Hand: every one of the 7 families present (so the longest chip 「ちょっと変わった材料」 is in the row). */
export const ALL_FAMILIES_OWNED = ["tomato-sauce", "mozzarella", "sausage", "anchovy", "mushroom", "pineapple", "basil", "capers", "egg", "onion", "bacon"];
/** 11 owned = no Hand: 8 vegetables + 1 meat, so a FAMILY (野菜・きのこ系) itself pages (2 pages) next to a one-page family. */
export const PAGING_FAMILY_OWNED = ["tomato-sauce", "mozzarella", "mushroom", "cherry-tomato", "onion", "black-olive", "corn", "eggplant", "fresh-tomato", "potato", "sausage"];

export async function openWith(page: Page, width: number, height: number, save: object) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

export async function bootFree(page: Page, width: number, height: number, owned: readonly string[]) {
  await openWith(page, width, height, base(owned));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
}

/** Research: a save whose only open Research Entry is researched from the Dex (the same entry the Discovery specs use),
 *  with every ingredient owned so the 具材 tray pages and carries the family row. */
export async function bootResearch(page: Page, width: number, height: number) {
  const step = 25;
  const keys = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId), "brazilian-calabresa"];
  const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);
  await openWith(page, width, height, {
    ...base([...new Set([...HAND_ON_OWNED])]),
    dex: keys.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  });
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  const section = page.locator(".dex-overlay__research");
  await section.scrollIntoViewIfNeeded();
  await section.getByRole("button", { name: /を研究する/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context"), "Owner decision: no Research card above the pizza").toHaveCount(0);
  await completeDoughStep(page);
}

export const dough = (page: Page) => page.locator(".pizza-dough").first().boundingBox();

export async function toTopping(page: Page) {
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
}

export const familyRow = (page: Page) => page.getByRole("group", { name: "具材の絞り込み" });
export const pagerLabel = (page: Page) => page.locator(".ingredient-page-nav__label");

export interface RowState {
  vw: number;
  rowLeft: number;
  rowRight: number;
  rowWidth: number;
  rowHeight: number;
  navHeight: number;
  scrollLeft: number;
  scrollWidth: number;
  moreStart: string | undefined;
  moreEnd: string | undefined;
  fadeStart: number;
  fadeEnd: number;
  mask: string;
  pagerDisplay: string;
  pagerShown: boolean;
  mode: "expanded" | "compact";
  chip: { name: string; left: number; right: number; width: number; height: number } | null;
}

export async function rowState(page: Page): Promise<RowState> {
  return familyRow(page).evaluate((row) => {
    const rb = row.getBoundingClientRect();
    const nav = row.parentElement!;
    const pager = document.querySelector(".ingredient-page-nav__pager")!; // below the tray (expanded) or in the row (compact)
    const chip = row.querySelector<HTMLElement>('[aria-pressed="true"]');
    const cb = chip?.getBoundingClientRect();
    const cs = getComputedStyle(row);
    return {
      vw: window.innerWidth,
      rowLeft: rb.left,
      rowRight: rb.right,
      rowWidth: rb.width,
      rowHeight: rb.height,
      navHeight: nav.getBoundingClientRect().height,
      scrollLeft: row.scrollLeft,
      scrollWidth: row.scrollWidth,
      moreStart: (row as HTMLElement).dataset.moreStart,
      moreEnd: (row as HTMLElement).dataset.moreEnd,
      fadeStart: parseFloat(cs.getPropertyValue("--fade-start")) || 0,
      fadeEnd: parseFloat(cs.getPropertyValue("--fade-end")) || 0,
      mask: cs.maskImage || cs.webkitMaskImage || "none",
      pagerDisplay: getComputedStyle(pager).display,
      pagerShown: getComputedStyle(pager).display !== "none" && getComputedStyle(pager).visibility !== "hidden",
      mode: document.querySelector(".tray-family-row") ? ("expanded" as const) : ("compact" as const),
      chip: chip && cb ? { name: chip.textContent ?? "", left: cb.left, right: cb.right, width: cb.width, height: cb.height } : null,
    };
  });
}

/** Waits for a (smooth) programmatic scroll to come to rest: two reads 150ms apart agree. */
export async function settle(page: Page) {
  let prev = -1;
  for (let i = 0; i < 30; i += 1) {
    const now = await familyRow(page).evaluate((r) => r.scrollLeft);
    if (now === prev) return;
    prev = now;
    await page.waitForTimeout(150);
  }
}

export async function expectNoPageOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth, sh: document.documentElement.scrollHeight, vh: window.innerHeight }));
  expect(m.sw, `${where}: horizontal page overflow`).toBeLessThanOrEqual(m.vw);
  expect(m.sh, `${where}: page scrolls vertically`).toBeLessThanOrEqual(m.vh + 1);
}

/** The core claim: the selected chip is whole inside the scroller's visible window AND its text is clear of the fades. */
export async function expectSelectedClear(page: Page, where: string) {
  await settle(page);
  const s = await rowState(page);
  expect(s.chip, `${where}: a chip is selected`).not.toBeNull();
  const c = s.chip!;
  expect(c.left, `${where} (${c.name}): left edge inside the scroller`).toBeGreaterThanOrEqual(s.rowLeft - 0.5);
  expect(c.right, `${where} (${c.name}): right edge inside the scroller`).toBeLessThanOrEqual(s.rowRight + 0.5);
  expect(c.left - s.rowLeft, `${where} (${c.name}): clear of the start fade`).toBeGreaterThanOrEqual(s.fadeStart - 0.5);
  expect(s.rowRight - c.right, `${where} (${c.name}): clear of the end fade`).toBeGreaterThanOrEqual(s.fadeEnd - 0.5);
  // The fades are honest: a side says "more" exactly when chips are hidden there.
  expect(s.moreStart, `${where}: start affordance`).toBe(String(s.scrollLeft > 2));
  expect(s.moreEnd, `${where}: end affordance`).toBe(String(s.scrollLeft + s.rowWidth < s.scrollWidth - 2));
  expect(s.fadeStart <= CHIP_ROW_FADE_PX && s.fadeEnd <= CHIP_ROW_FADE_PX).toBe(true);
  if (s.moreStart === "true" || s.moreEnd === "true") expect(s.mask, `${where}: the fade is drawn`).toContain("gradient");
  return s;
}

export const labelsOf = (page: Page) => familyRow(page).getByRole("button").allTextContents();

export async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

/** Every family chip in turn (and back to すべて): the selected chip is whole and clear; then the pager state is coherent. */
export async function walkAllFamilies(page: Page, where: string) {
  const row = familyRow(page);
  const labels = await labelsOf(page);
  expect(labels[0]).toBe("すべて");
  expect(labels.length).toBeGreaterThanOrEqual(3);
  await expectSelectedClear(page, `${where} / initial`);
  const widths = new Map<string, number>();
  for (const label of [...labels.slice(1), "すべて"]) {
    await row.getByRole("button", { name: label === "すべて" ? "全ての具材を表示" : `${label}の具材だけ表示` }).click();
    const s = await expectSelectedClear(page, `${where} / ${label}`);
    widths.set(label, s.rowWidth);
    // pager coherence: it is visible exactly when the list pages (an idle pager is hidden: collapsed in the compact
    // row, an inert placeholder in the utility row below the tray).
    const paging = (await pagerLabel(page).count()) > 0 && (await page.locator(".ingredient-page-nav__pager:not([aria-hidden])").count()) > 0;
    expect(s.pagerShown, `${where} / ${label}: pager visible only when the list pages`).toBe(paging);
    await expectNoPageOverflow(page, `${where} / ${label}`);
  }
  return { labels, widths };
}

