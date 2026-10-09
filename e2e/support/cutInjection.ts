import { expect, type Page } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
} from "../gestures";

/**
 * #427 / #426: shared CUT coordinate-injection helpers. A stroke is dragged along an exact line given in dough units
 * (one dough unit = box.width / 100 px: ~3 px at 390, ~2.8 px at 360). Used by e2e/cut-regions-427.spec.ts (dev server) and
 * tools/cut-preview-hv (a real Preview build with the URL query).
 */

const MARGHERITA_BAKE = { start: 60, end: 80 };

export interface ReachOptions {
  /** A Preview build keeps its save under its own key; seed that one (and open the page with `query`). */
  previewSaveKey?: string;
  query?: string;
}

async function startMargherita(page: Page, options: ReachOptions) {
  if (!options.previewSaveKey) {
    await startFreshMargherita(page);
    return;
  }
  const key = options.previewSaveKey;
  await page.addInitScript((k) => {
    localStorage.setItem(
      k,
      JSON.stringify({
        schemaVersion: 1,
        dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
        pitzBalance: 0,
        ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
        missionBest: {},
      }),
    );
  }, key);
  await page.goto(`./${options.query ?? ""}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
}

export async function reachCut(page: Page, options: ReachOptions = {}) {
  await startMargherita(page, options);
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
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
  await bakeToTarget(page, MARGHERITA_BAKE);
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
}

export interface Stroke {
  /** Direction of the drag, degrees. */
  angle: number;
  /** Sideways shift of the line from the centre, dough units. */
  offset?: number;
  /** Stop this many dough units short of the far rim (a groove once it is more than the crust width, 6). */
  stopShort?: number;
}

/** Drags one straight stroke along the exact line `angle` / `offset` (dough units), from the near rim to the far one. */
export async function drag(page: Page, { angle, offset = 0, stopShort = 0 }: Stroke) {
  const box = (await page.locator(".pizza-dough").first().boundingBox())!;
  const k = box.width / 100;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const a = (angle * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  const ox = cx + nx * offset * k;
  const oy = cy + ny * offset * k;
  const reach = Math.sqrt(46 * 46 - offset * offset); // 46 u: just inside the rim, like the shared cut helper
  const from = { x: ox - ux * reach * k, y: oy - uy * reach * k };
  const to = { x: ox + ux * (reach - stopShort) * k, y: oy + uy * (reach - stopShort) * k };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

export async function cutAndConfirm(page: Page, strokes: Stroke[], options: ReachOptions = {}) {
  await reachCut(page, options);
  for (const stroke of strokes) await drag(page, stroke);
  await expect(page.locator(".pizza-cut-mark")).toHaveCount(strokes.length);
  await page.getByRole("button", { name: /切り終わる/ }).click();
  await expect(page.locator(".result-panel")).toBeVisible();
}

export const drawn = (page: Page) => page.locator(".pizza-pieces").first().getAttribute("data-piece-count");
/** textContent, not innerText: the line sits inside a closed <details>. */
export const counted = async (page: Page) => (await page.locator(".cut-evaluation-summary__slices").first().textContent()) ?? "";
export const triangle = (d: number): Stroke[] => [{ angle: 0 }, { angle: 60 }, { angle: 120, offset: d }];

