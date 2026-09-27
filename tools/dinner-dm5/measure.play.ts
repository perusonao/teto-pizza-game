import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getReferencePizza } from "../../src/data/referencePizza";
import { completeDoughStep, cutThreeLines, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { dinnerSave, openDinnerDetail, openWithSave } from "../../e2e/support/dinner";

/**
 * Dinner Mission DM-4 / DM-5 Fresh Audit — measurement harness (docs/data/tools only).
 *
 * NOT part of any test suite: it lives outside `e2e/` and outside Vitest's `src/**` include, and
 * only runs through ./playwright.measure.config.ts against a checkout of PR #252's head (DM-3R-2),
 * where the recipe-free Dinner round exists. It changes nothing; it cooks every DM-A / DM-B target
 * once per variant with real gestures and records:
 *   - the ★ the DM-3R-1 result detection gives (S = 1, so every composition-correct pizza passes
 *     and the panel shows its ★),
 *   - an operation count per step (taps, drags, chip selects, tray page flips, CTA presses),
 *   - the automation wall time per step (the UI floor: render / transition latency, no human).
 * The BAKE needle runs on virtual time (page.clock), so its duration is derived analytically from
 * `BakeOverlay`'s SPEED instead (55 %/s): the needle starts at 0, so reaching window centre c takes
 * c / 55 s at the fastest.
 *
 * Variants:
 *   - CARELESS: the E2E "hand" spots (e2e/support/dinner.ts SPOTS) — correct composition, positions
 *     ignoring the reference. Models a fast player who only counts pieces.
 *   - REFERENCE: every piece on the recipe's reference position (src/data/referencePizza.ts).
 *     Models a careful player who copies the 見本.
 *   - Bake at the window centre (BAKE_CENTER) or 1 point inside its early edge (BAKE_EDGE).
 */

/** JSON Lines, one record per cooked pizza. */
const OUT = process.env.DM5_OUT ?? "dm5-measure.jsonl";

const CHIP: Record<string, RegExp> = {
  mozzarella: /モッツァレラ/,
  basil: /バジル/,
  egg: /たまご/,
  bacon: /ベーコン/,
  mushroom: /マッシュルーム/,
  eggplant: /ナス/,
  parmigiano: /パルミジャーノ/,
};
const CHEESE = new Set(["mozzarella", "parmigiano"]);

interface Target {
  recipeId: string;
  mission: RegExp;
  /** minCount composition, in placement order (cheese first). */
  pieces: { ingredientId: string; count: number }[];
  bake: { start: number; end: number };
}

const TARGETS: Target[] = [
  { recipeId: "margherita", mission: /ディナーミッション 1/, pieces: [{ ingredientId: "mozzarella", count: 3 }, { ingredientId: "basil", count: 2 }], bake: { start: 60, end: 80 } },
  { recipeId: "bismarck", mission: /ディナーミッション 1/, pieces: [{ ingredientId: "mozzarella", count: 3 }, { ingredientId: "egg", count: 1 }], bake: { start: 55, end: 75 } },
  { recipeId: "breakfast-pizza", mission: /ディナーミッション 1/, pieces: [{ ingredientId: "mozzarella", count: 2 }, { ingredientId: "egg", count: 1 }, { ingredientId: "bacon", count: 3 }], bake: { start: 56, end: 76 } },
  { recipeId: "funghi", mission: /ディナーミッション 1/, pieces: [{ ingredientId: "mozzarella", count: 2 }, { ingredientId: "mushroom", count: 3 }], bake: { start: 58, end: 78 } },
  { recipeId: "melanzane-pizza", mission: /ディナーミッション 2/, pieces: [{ ingredientId: "mozzarella", count: 2 }, { ingredientId: "eggplant", count: 3 }, { ingredientId: "basil", count: 2 }], bake: { start: 58, end: 78 } },
  { recipeId: "parmigiana-pizza", mission: /ディナーミッション 2/, pieces: [{ ingredientId: "mozzarella", count: 2 }, { ingredientId: "parmigiano", count: 2 }, { ingredientId: "eggplant", count: 3 }, { ingredientId: "basil", count: 2 }], bake: { start: 58, end: 78 } },
];

/** Real hold time of a SPIRAL sauce stroke (env DM5_SPIRAL_MS, default 2600 ms). */
const SPIRAL_HOLD_MS = Number(process.env.DM5_SPIRAL_MS ?? 2600);

const ALL = ["margherita", "bismarck", "breakfast-pizza", "funghi", "melanzane-pizza", "parmigiana-pizza"];

const SPOTS: [number, number][] = [
  [35, 35], [65, 35], [50, 50], [35, 65], [65, 65], [50, 28], [28, 50], [72, 50], [50, 72],
];

interface Ops {
  taps: number;
  drags: number;
  chipSelects: number;
  pageFlips: number;
  ctas: number;
}

async function selectChip(page: Page, name: RegExp, ops: Ops) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name });
  // Sweep forward to the last page, then backward: a player looks one way, then the other.
  let direction: "次のページ" | "前のページ" = "次のページ";
  for (let i = 0; i < 24 && !(await chip.count()); i += 1) {
    const pager = page.getByRole("button", { name: direction });
    if (!(await pager.count())) break;
    if (!(await pager.isEnabled())) {
      direction = direction === "次のページ" ? "前のページ" : "次のページ";
      continue;
    }
    await pager.click();
    ops.pageFlips += 1;
  }
  await chip.first().click();
  ops.chipSelects += 1;
}

type SauceMode = "TAPS" | "SPIRAL";

/**
 * SPIRAL: one held stroke from the centre outwards (radius 4 -> 40 % of the dough box) lasting
 * `holdMs` of real time. The dispenser adds 0.02 per 50 ms held (src/logic/sauceQuantity.ts), so
 * the ~0.92 reference quantity needs >= 2.3 s of hold; TAPS (the E2E ring of 16 instant taps)
 * deposits far less.
 */
async function paintSauceSpiral(page: Page, holdMs: number) {
  const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
  if (!box) throw new Error("Pizza dough missing");
  const at = (turn: number, r: number) => ({
    x: box.x + box.width * (0.5 + (r / 100) * Math.cos(turn * Math.PI * 2)),
    y: box.y + box.height * (0.5 + (r / 100) * Math.sin(turn * Math.PI * 2)),
  });
  const steps = 60;
  const start = at(0, 4);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    const f = i / steps;
    const p = at(f * 3.5, 4 + 36 * f);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(holdMs / steps);
  }
  await page.mouse.up();
}

async function cook(page: Page, t: Target, variant: "CARELESS" | "REFERENCE", bakeMode: "CENTER" | "EDGE", sauceMode: SauceMode = "TAPS") {
  const ops: Ops = { taps: 0, drags: 0, chipSelects: 0, pageFlips: 0, ctas: 0 };
  const ms: Record<string, number> = {};
  const ref = getReferencePizza(t.recipeId);
  let spot = 0;
  const positionsFor = (ingredientId: string, count: number): [number, number][] => {
    if (variant === "REFERENCE") {
      const group = ref?.pieceGroups.find((g) => g.ingredientId === ingredientId);
      if (group) return group.positions.slice(0, Math.max(count, group.positions.length)).map((p) => [p.x, p.y]);
    }
    return Array.from({ length: count }, () => SPOTS[spot++ % SPOTS.length]);
  };
  const next = async () => {
    await page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ }).click();
    ops.ctas += 1;
  };
  const placed: Record<string, number> = {};
  const place = async (ingredientId: string, count: number) => {
    await selectChip(page, CHIP[ingredientId], ops);
    for (const [x, y] of positionsFor(ingredientId, count)) {
      await tapDoughPercent(page, x, y);
      ops.taps += 1;
      placed[ingredientId] = (placed[ingredientId] ?? 0) + 1;
    }
  };

  await page.waitForSelector(".pizza-stage");
  let t0 = Date.now();
  await completeDoughStep(page);
  ops.taps += 8;
  await next();
  ms.dough = Date.now() - t0;
  t0 = Date.now();
  await selectChip(page, /トマトソース/, ops);
  if (sauceMode === "SPIRAL") {
    await paintSauceSpiral(page, SPIRAL_HOLD_MS);
    ops.drags += 1;
  } else {
    await paintSauceRing(page, 25, 16);
    ops.taps += 16;
  }
  await next();
  ms.sauce = Date.now() - t0;
  t0 = Date.now();
  for (const p of t.pieces.filter((p) => CHEESE.has(p.ingredientId))) await place(p.ingredientId, p.count);
  await next();
  ms.cheese = Date.now() - t0;
  t0 = Date.now();
  for (const p of t.pieces.filter((p) => !CHEESE.has(p.ingredientId))) await place(p.ingredientId, p.count);
  ms.topping = Date.now() - t0;
  t0 = Date.now();
  await enterBakePaused(page);
  ops.ctas += 1;
  const window = bakeMode === "CENTER" ? t.bake : { start: t.bake.start + 1, end: t.bake.start + 1 };
  await landNeedleAndTakeOut(page, window);
  ops.taps += 1;
  ms.bakeAutomation = Date.now() - t0;
  t0 = Date.now();
  const cutButton = page.getByRole("button", { name: /切り終わる/ });
  await expect(cutButton).toBeVisible();
  await cutThreeLines(page);
  ops.drags += 3;
  await cutButton.click();
  ops.ctas += 1;
  const result = page.getByTestId("dinner-attempt-result");
  await expect(result).toBeVisible();
  ms.cut = Date.now() - t0;
  const category = await result.getAttribute("data-category");
  const text = (await result.innerText()).replace(/\s+/g, " ");
  const stars = Number(/★(\d)/.exec(text)?.[1] ?? NaN);
  const bakeNeedleMs = Math.round((((window.start + window.end) / 2) / 55) * 1000);
  return { recipeId: t.recipeId, variant, bakeMode, sauceMode, spiralHoldMs: sauceMode === "SPIRAL" ? SPIRAL_HOLD_MS : null, category, stars, text, ops, placed, ms, bakeNeedleMs };
}

const SAUCE_MODES = (process.env.DM5_SAUCE ?? "TAPS").split(",") as SauceMode[];

for (const sauceMode of SAUCE_MODES) {
  for (const variant of ["CARELESS", "REFERENCE"] as const) {
    for (const bakeMode of ["CENTER", "EDGE"] as const) {
      for (const t of TARGETS) {
        test(`${t.recipeId} ${variant} bake=${bakeMode} sauce=${sauceMode}`, async ({ page }, info) => {
          test.setTimeout(120_000);
          await openWithSave(page, dinnerSave(ALL), "?dinnerDuration=900&dinnerMinStars=1");
          await openDinnerDetail(page, t.mission);
          await page.getByRole("button", { name: /スタート/ }).click();
          await expect(page.getByTestId("dinner-target-row")).toBeVisible();
          const r = await cook(page, t, variant, bakeMode, sauceMode);
          mkdirSync(dirname(OUT), { recursive: true });
          appendFileSync(OUT, `${JSON.stringify({ project: info.project.name, ...r })}\n`);
        });
      }
    }
  }
}
