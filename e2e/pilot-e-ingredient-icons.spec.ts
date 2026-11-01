import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Ingredient Icons 2.0 Pilot E representative E2E (Issue #715, Style Lock v2 §11): green-pepper / bell-pepper / pineapple are drawn by their dedicated SVG on the tray chip, the placed piece and the RESULT list,
 * the chip keeps the size of an unchanged chip (chicken, which keeps its emoji), the glyph stays inside its chip, and nothing scrolls sideways at 390x844 and 360x800.
 * The cooking round is the existing Research round of jamaican-jerk-chicken-pizza (its Research Entry is the same as in b12.spec.ts); the player may place any owned topping, so bell-pepper is placed too.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots + measure-<project>.json), HV_VIDEO=1 (Playwright video, 390x844 project only).
 * PILOT_E_BEFORE=1 runs the same flow on a build WITHOUT Pilot E (measurement / screenshots only, no SVG assertions) to capture the "before" side.
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const TARGET = "jamaican-jerk-chicken-pizza";
const ALL_IDS = RECIPES.map((r) => r.id as string);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52], [34, 40], [62, 50]];
const BEFORE = Boolean(process.env.PILOT_E_BEFORE);
const ART = [
  { id: "green-pepper", name: /ピーマン/, visual: "green-pepper-strips" },
  { id: "bell-pepper", name: /パプリカ/, visual: "bell-pepper-quarter" },
  { id: "pineapple", name: /パイナップル/, visual: "pineapple-wedges" },
] as const;

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
async function capture(page: Page, name: string, project: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${project}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

test.describe("Pilot E ingredient icons (green-pepper / bell-pepper / pineapple)", () => {
  test.setTimeout(120_000);

  test("tray chip, placed piece and RESULT draw the dedicated art; chip size and tap area are unchanged; no horizontal scroll", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && !new URL(m.location().url || "http://x/").pathname.endsWith("/favicon.ico") && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const step = DISCOVERY_LADDER.steps.findIndex((s) => s.ingredientIds.includes("green-pepper")) + 1;
    const discovered = ALL_IDS.filter((id) => id !== TARGET);
    const owned = materialsUpTo(step);
    await page.goto("icons/icon-16.png");
    await page.evaluate(([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, [SAVE_KEY, JSON.stringify({
      schemaVersion: 2,
      dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 999,
      ownedIngredientIds: [...STARTERS, ...owned],
      missionBest: {},
      inventory: Object.fromEntries(owned.map((m) => [m, 30])),
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: [...owned],
    })] as const);
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));

    // Dex -> the Research Entry of the one undiscovered recipe -> a free Research round.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await page.locator(".dex-overlay__research").getByRole("button", { name: /を研究する$/ }).click();
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click(); // DOUGH -> SAUCE
    await bar(page).getByRole("button", { name: /次へ/ }).click(); // SAUCE (none, NO_SAUCE is allowed) -> CHEESE
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    await (await chipOnTrayOrPin(page, /モッツァレラ/)).click(); // CHEESE: the Research round still asks for one
    for (const [x, y] of [SPOTS[0], SPOTS[4]]) await tapDoughPercent(page, x, y);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();

    // 1. Tray chips: the three draw their art; their box is the box of the unchanged chicken chip; the glyph stays inside the chip.
    const chicken = await chipOnTrayOrPin(page, /チキン/);
    const base = (await chicken.boundingBox())!;
    const measure: Record<string, unknown> = { project, viewport: page.viewportSize(), chicken: base };
    for (const a of ART) {
      const chip = await chipOnTrayOrPin(page, a.name);
      const box = (await chip.boundingBox())!;
      const glyph = chip.locator(`svg.ingredient-glyph--${a.visual}`);
      if (!BEFORE) {
        await expect(glyph).toHaveCount(1);
        await expect(glyph).toHaveAttribute("data-ingredient-visual", a.visual);
      }
      const gbox = BEFORE ? null : await glyph.boundingBox();
      measure[a.id] = { chip: box, glyph: gbox };
      expect(Math.abs(box.height - base.height), `${a.id}: chip height vs chicken`).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - base.width), `${a.id}: chip width vs chicken`).toBeLessThanOrEqual(1);
      expect(box.height, `${a.id}: tap area height`).toBeGreaterThanOrEqual(44);
      if (gbox) {
        expect(gbox.x, `${a.id}: glyph left inside chip`).toBeGreaterThanOrEqual(box.x - 1);
        expect(gbox.x + gbox.width, `${a.id}: glyph right inside chip`).toBeLessThanOrEqual(box.x + box.width + 1);
        expect(gbox.y, `${a.id}: glyph top inside chip`).toBeGreaterThanOrEqual(box.y - 1);
        expect(gbox.y + gbox.height, `${a.id}: glyph bottom inside chip`).toBeLessThanOrEqual(box.y + box.height + 1);
      }
    }
    await noOverflow(page, "tray");
    await capture(page, "pilot-e-tray", project);

    // 2. Placed pieces: one of each (plus chicken for scale) draw their art on the dough.
    let spot = 1;
    for (const a of ART) {
      await (await chipOnTrayOrPin(page, a.name)).click();
      for (let i = 0; i < 2; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
    }
    await (await chipOnTrayOrPin(page, /チキン/)).click();
    for (let i = 0; i < 2; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
    if (!BEFORE) for (const a of ART) await expect(page.locator(`.pizza-stage svg.ingredient-glyph--${a.visual}`)).toHaveCount(2);
    await noOverflow(page, "topped");
    await capture(page, "pilot-e-topped", project);

    // 3. Bake and RESULT: the pieces survive the bake filter and the RESULT list draws the art.
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");
    if (!BEFORE) for (const a of ART) await expect(page.locator(`.result-panel svg.ingredient-glyph--${a.visual}`).first()).toBeVisible();
    await noOverflow(page, "RESULT");
    await capture(page, "pilot-e-result", project);

    const dir = process.env.HV_SCREENSHOT_DIR;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/measure-${BEFORE ? "before" : "after"}-${project}.json`, JSON.stringify(measure, null, 1));
    }
    expect(errors).toEqual([]);
  });
});
