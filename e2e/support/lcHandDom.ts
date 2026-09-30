import type { Page } from "@playwright/test";
import { INGREDIENTS } from "../../src/data/ingredients";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../gestures";

/**
 * LC-R6-b: the FREE Cooking tray / pantry DOM snapshots that define "Hand OFF". The production build's snapshots
 * are committed (docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6b_PRODUCTION-DOM-GOLDEN.json), taken on main `6abddc7`
 * (R5-e baseline) BEFORE any R6-b source change, and must stay byte-identical.
 */
const SAVE_KEY = "teto-pizza-save-v1";
const PREVIEW_SAVE_KEY = "teto-pizza-preview-save-v1";
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const TOPPING_IDS = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const NON_TOPPING_IDS = INGREDIENTS.filter((i) => i.category !== "topping").map((i) => i.id);

/** 22 toppings = the current full catalog (more than either hand candidate); 6 = well under both. */
export const TOPPING_COUNTS = { free22: TOPPING_IDS.length, free6: 6 } as const;

export function saveWithToppings(count: number) {
  const owned = count === TOPPING_IDS.length ? ALL_IDS : [...NON_TOPPING_IDS, ...TOPPING_IDS.slice(0, count)];
  return {
    schemaVersion: 2,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: owned,
    missionBest: {},
    inventory: Object.fromEntries(owned.map((id) => [id, 9])),
    starterGrantClaimedRecipeIds: [],
  };
}

/** Stable text of a subtree: generated React ids and the wall-clock-dependent bits removed. */
export async function normalizedHtml(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return el.outerHTML.replace(/(?:_r_|:r)[0-9a-z]+(?:_|:)/g, "ID").replace(/\s+/g, " ").trim();
  }, selector);
}

/** `decoys`: extra storage entries and a query string that a (forbidden) runtime switch might read. */
export interface Decoys {
  query: string;
  local: Record<string, string>;
  session: Record<string, string>;
}

export async function openFree(page: Page, url: string, saveKey: string, save: unknown, decoys?: Decoys) {
  await page.goto(`${url}icons/icon-16.png`);
  await page.evaluate(([k, v, local, session]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(k, v);
    for (const [dk, dv] of Object.entries(local)) localStorage.setItem(dk, dv);
    for (const [dk, dv] of Object.entries(session)) sessionStorage.setItem(dk, dv);
  }, [saveKey, JSON.stringify(save), decoys?.local ?? {}, decoys?.session ?? {}] as const);
  await page.goto(`${url}${decoys?.query ?? ""}`);
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await page.waitForSelector(".pizza-stage");
}

export async function toSauce(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
}

export async function toCheese(page: Page) {
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
}

export async function toTopping(page: Page) {
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
}

export const PREVIEW_KEY = PREVIEW_SAVE_KEY;
export const PRODUCTION_KEY = SAVE_KEY;

const DOCK = ".prepare-dock";

/** Every snapshot is the dock (tray + pager + bake bar) or the pantry sheet, in a fixed order. */
export async function captureFreeSnapshots(page: Page, url: string, saveKey: string, decoys?: Decoys): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const [name, count] of Object.entries(TOPPING_COUNTS)) {
    await openFree(page, url, saveKey, saveWithToppings(count), decoys);
    await toSauce(page);
    out[`${name}.sauce`] = await normalizedHtml(page, DOCK);
    await toCheese(page);
    out[`${name}.cheese`] = await normalizedHtml(page, DOCK);
    await toTopping(page);
    for (let p = 1; p <= 4; p++) {
      out[`${name}.topping.page${p}`] = await normalizedHtml(page, DOCK);
      const next = page.getByRole("button", { name: "次のページ" });
      if ((await next.count()) === 0 || (await next.isDisabled())) break;
      await next.click();
    }
    const entry = page.getByRole("button", { name: /食材庫/ });
    out[`${name}.topping.pantryEntry`] = String(await entry.count());
    if ((await entry.count()) > 0) {
      await entry.click();
      await page.waitForSelector(".pantry-sheet");
      out[`${name}.topping.pantry`] = await normalizedHtml(page, ".pantry-sheet");
      await page.keyboard.press("Escape");
      await page.waitForSelector(".pantry-sheet", { state: "detached" });
      out[`${name}.topping.afterPantry`] = await normalizedHtml(page, DOCK);
    }
  }
  return out;
}
