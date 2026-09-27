import { expect, type Page } from "@playwright/test";
import { completeDoughStep, cutThreeLines, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "../gestures";

/**
 * Dinner Mission DM-3 (Issue #242) E2E support: seeded saves and a real-gesture cook of each
 * DM-A / DM-B target (dough -> sauce -> cheese -> toppings -> bake -> CUT), driven through the
 * same controls a player uses. Piece counts can be raised to over-place a material.
 */

export const SAVE_KEY = "teto-pizza-save-v1";

const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato", "egg",
  "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham", "black-olive",
  "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];

export const DM_A = ["margherita", "bismarck", "breakfast-pizza", "funghi"] as const;

export function dinnerSave(discovered: readonly string[], inventory: Record<string, number> = {}) {
  return {
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 500,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...FINITE],
    missionBest: {},
    inventory: { ...Object.fromEntries(FINITE.map((m) => [m, 30])), ...inventory },
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: FINITE,
  };
}

export async function openWithSave(page: Page, save: unknown, query = "") {
  await page.goto("icons/icon-16.png");
  await page.evaluate(
    ([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    },
    [SAVE_KEY, JSON.stringify(save)] as const,
  );
  await page.goto(`./${query}`);
  await page.waitForSelector(".app-frame");
}

export async function readSave(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), SAVE_KEY);
}

/** HOME -> Mission Select -> Detail of `title`. */
export async function openDinnerDetail(page: Page, title: RegExp) {
  await page.getByRole("button", { name: /ディナーミッション/ }).click();
  await page.locator(".dinner-mission-card", { hasText: title }).click();
  await expect(page.locator(".dinner-detail")).toBeVisible();
}

const bar = (page: Page) => page.locator(".prepare-bake-bar");
async function next(page: Page) {
  await bar(page).getByRole("button", { name: /次へ/ }).click();
}

async function selectChip(page: Page, name: RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name });
  for (let i = 0; i < 12 && !(await chip.count()); i += 1) {
    const nextPage = page.getByRole("button", { name: "次のページ" });
    if ((await nextPage.count()) && (await nextPage.isEnabled())) await nextPage.click();
    else await page.getByRole("button", { name: "前のページ" }).click();
  }
  await chip.first().click();
}

/** Spots at least MIN_TOPPING_DISTANCE apart, inside the dough. */
const SPOTS: [number, number][] = [
  [35, 35], [65, 35], [50, 50], [35, 65], [65, 65], [50, 28], [28, 50], [72, 50], [50, 72],
];
let spotCursor = 0;
async function place(page: Page, name: RegExp, count: number) {
  await selectChip(page, name);
  for (let i = 0; i < count; i += 1) {
    const [x, y] = SPOTS[spotCursor % SPOTS.length];
    spotCursor += 1;
    await tapDoughPercent(page, x, y);
  }
}

interface Piece {
  chip: RegExp;
  count: number;
}

const RECIPES: Record<string, { cheese: Piece[]; toppings: Piece[]; bake: { start: number; end: number } }> = {
  margherita: { cheese: [{ chip: /モッツァレラ/, count: 3 }], toppings: [{ chip: /バジル/, count: 2 }], bake: { start: 60, end: 80 } },
  bismarck: { cheese: [{ chip: /モッツァレラ/, count: 3 }], toppings: [{ chip: /たまご/, count: 1 }], bake: { start: 55, end: 75 } },
  "breakfast-pizza": {
    cheese: [{ chip: /モッツァレラ/, count: 2 }],
    toppings: [{ chip: /たまご/, count: 1 }, { chip: /ベーコン/, count: 3 }],
    bake: { start: 56, end: 76 },
  },
  funghi: { cheese: [{ chip: /モッツァレラ/, count: 2 }], toppings: [{ chip: /マッシュルーム/, count: 3 }], bake: { start: 58, end: 78 } },
};

export interface CookOptions {
  /** Extra pieces per chip name (over-placement). */
  extra?: { chip: RegExp; count: number };
  /** Take the pizza out far from its target so the Completion Gate fails (UNDERBAKED). */
  underbake?: boolean;
}

/** From the Target Board: select `recipeId`, cook it with real gestures, and land on its result. */
export async function cookDinnerTarget(page: Page, recipeId: string, nameJa: RegExp, options: CookOptions = {}) {
  const spec = RECIPES[recipeId];
  spotCursor = 0;
  await page.locator(".dinner-board__item", { hasText: nameJa }).click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("dinner-hud")).toBeVisible();
  await completeDoughStep(page);
  await next(page);
  await selectChip(page, /トマトソース/);
  await paintSauceRing(page, 25, 16);
  await next(page);
  for (const p of spec.cheese) await place(page, p.chip, p.count);
  await next(page);
  for (const p of spec.toppings) {
    const extra = options.extra && p.chip.source === options.extra.chip.source ? options.extra.count : 0;
    await place(page, p.chip, p.count + extra);
  }
  await enterBakePaused(page);
  await landNeedleAndTakeOut(page, options.underbake ? { start: 2, end: 4 } : spec.bake);
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
  await cutThreeLines(page);
  await page.getByRole("button", { name: /切り終わる/ }).click();
}
