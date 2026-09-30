import { expect, type Page } from "@playwright/test";
import { completeDoughStep, cutThreeLines, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "../gestures";

/**
 * Dinner Mission DM-3 (Issue #242, ported from PR #243) / DM-3R-2 (Issue #250) E2E support: seeded
 * saves and a real-gesture cook of a pizza on the recipe-free Dinner round (dough -> sauce ->
 * cheese -> toppings -> bake -> CUT when the detected recipe has one), driven through the same
 * controls a player uses. Nothing is declared: the composition alone decides what it is.
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

interface PizzaSpec {
  cheese: Piece[];
  toppings: Piece[];
  bake: { start: number; end: number };
  /** The detected recipe has a CUT step (every CUT-eligible recipe); an unmatched pizza has none. */
  cut: boolean;
}

export const PIZZAS: Record<string, PizzaSpec> = {
  margherita: { cheese: [{ chip: /モッツァレラ/, count: 3 }], toppings: [{ chip: /バジル/, count: 2 }], bake: { start: 60, end: 80 }, cut: true },
  bismarck: { cheese: [{ chip: /モッツァレラ/, count: 3 }], toppings: [{ chip: /たまご/, count: 1 }], bake: { start: 55, end: 75 }, cut: true },
  "breakfast-pizza": {
    cheese: [{ chip: /モッツァレラ/, count: 2 }],
    toppings: [{ chip: /たまご/, count: 1 }, { chip: /ベーコン/, count: 3 }],
    bake: { start: 56, end: 76 },
    cut: true,
  },
  funghi: { cheese: [{ chip: /モッツァレラ/, count: 2 }], toppings: [{ chip: /マッシュルーム/, count: 3 }], bake: { start: 58, end: 78 }, cut: true },
  marinara: {
    cheese: [],
    toppings: [{ chip: /にんにく/, count: 3 }, { chip: /オレガノ/, count: 2 }],
    bake: { start: 60, end: 80 },
    cut: true,
  },
  hawaiian: {
    cheese: [{ chip: /モッツァレラ/, count: 2 }],
    toppings: [{ chip: /ハム/, count: 2 }, { chip: /パイナップル/, count: 3 }],
    bake: { start: 58, end: 78 },
    cut: true,
  },
  /** funghi + one egg: matches no recipe (ORIGINAL), generic window, no CUT. */
  "funghi-egg": {
    cheese: [{ chip: /モッツァレラ/, count: 2 }],
    toppings: [{ chip: /マッシュルーム/, count: 3 }, { chip: /たまご/, count: 1 }],
    bake: { start: 58, end: 78 },
    cut: false,
  },
};

export interface CookOptions {
  /** Extra pieces per chip name (over-placement). */
  extra?: { chip: RegExp; count: number };
  /** Take the pizza out far below its window (raw -> INVALID_PIZZA). */
  underbake?: boolean;
  /** Take the pizza out far above its window (burnt -> INVALID_PIZZA). */
  overbake?: boolean;
  /** Human Verification recordings: hold this many ms after each step (0 in tests). */
  pauseMs?: number;
  /** Called on the DOUGH step and after the toppings (e.g. to capture screenshots). */
  onStep?: (step: "dough" | "sauce" | "cheese" | "toppings" | "bake" | "cut") => Promise<void>;
}

/**
 * On a recipe-free Dinner PREPARE round: cook `pizza` with real gestures and land on its result.
 * The CUT step is fixed at START_BAKE from the composition (Stage A). Issue #256: a raw / burnt
 * pizza (Completion Gate UNDERBAKED / OVERBAKED) skips it and gets its INVALID_PIZZA result at
 * 取り出す, so CUT is only expected for an in-band bake.
 */
export async function cookDinnerPizza(page: Page, pizza: keyof typeof PIZZAS, options: CookOptions = {}) {
  const spec = PIZZAS[pizza];
  const hold = () => (options.pauseMs ? page.waitForTimeout(options.pauseMs) : Promise.resolve());
  spotCursor = 0;
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("dinner-target-row")).toBeVisible();
  await hold();
  await options.onStep?.("dough");
  await completeDoughStep(page);
  await next(page);
  await selectChip(page, /トマトソース/);
  await paintSauceRing(page, 25, 16);
  await hold();
  await options.onStep?.("sauce");
  await next(page);
  for (const p of spec.cheese) await place(page, p.chip, p.count);
  await hold();
  await options.onStep?.("cheese");
  await next(page);
  for (const p of spec.toppings) {
    const extra = options.extra && p.chip.source === options.extra.chip.source ? options.extra.count : 0;
    await place(page, p.chip, p.count + extra);
  }
  await hold();
  await options.onStep?.("toppings");
  await enterBakePaused(page);
  await options.onStep?.("bake");
  const window = options.underbake ? { start: 2, end: 4 } : options.overbake ? { start: 97, end: 99 } : spec.bake;
  await landNeedleAndTakeOut(page, window);
  if (spec.cut && !options.underbake && !options.overbake) {
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await hold();
    await options.onStep?.("cut");
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
}

/** Result -> the next recipe-free round. */
export async function nextDinnerPizza(page: Page) {
  await page.getByRole("button", { name: /次のピザを作る/ }).click();
  await expect(page.getByTestId("dinner-target-row")).toBeVisible();
}
