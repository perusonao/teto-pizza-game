import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, squeezeDoughPath, squeezeDoughStroke, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Expansion Batch 13 representative E2E (Issue #708; PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): potato-mayo-pizza played end to end at 390x844 and 360x800.
 *  - NO_SAUCE for this one row (the SAUCE step is skipped with no sauce painted); its unlock material is `mayo` (a topping, ordinary step 65, family spice, drawn by its own SVG); a single-member Research cohort, so the label carries no letter.
 * Counts and the generic 58-78 bake window are provisional. Step numbers are DERIVED from the ladder, never hard-coded.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ALL_IDS = RECIPES.map((r) => r.id as string);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];

interface Case {
  id: string;
  nameJa: string;
  /** Shop rows of the step: [ingredient id, nameJa, shot slug]. */
  materials: readonly [string, string, string][];
  /** The Research Entry label: only the unlock material (and the cohort letter, where the cohort has two members) is named. */
  label: string;
  /** null = NO_SAUCE: no sauce is painted (the SAUCE step is skipped). */
  sauce: RegExp | null;
  cheese: [RegExp, number][];
  /** A third element "stroke" places each piece with ONE stroke across the dough (squeezable mayo, Owner 案A) instead of a tap. */
  toppings: [RegExp, number, "stroke"?][];
}
const CASES: readonly Case[] = [
  {
    id: "potato-mayo-pizza",
    nameJa: "じゃがマヨピザ",
    materials: [["mayo", "マヨネーズ", "b13-mayo"]],
    label: "？？？ピザ（マヨネーズ）",
    sauce: null,
    cheese: [[/モッツァレラ/, 2]],
    toppings: [[/じゃがいも/, 2], [/ベーコン/, 1], [/コーン/, 1], [/マヨネーズ/, 2, "stroke"]],
  },
];

const saveJson = (discovered: readonly string[], owned: readonly string[]) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    // The step's materials are deliberately NOT listed: load-time entitlement (the ladder) must grant them.
    unlockedForShopIngredientIds: [...owned],
  });

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
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
async function open(page: Page, json: string) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, json] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}
/** Two wavy strokes of a squeezed bead, in the clear lanes between the ring slots (each about 40% of the dough wide, under the 60% cap). */
const STROKES: [number, number][][] = [
  [[32, 36], [40, 31], [48, 37], [56, 31], [64, 37], [70, 33]],
  [[30, 70], [38, 65], [46, 71], [54, 65], [62, 71], [68, 67]],
];
async function place(page: Page, picks: [RegExp, number, "stroke"?][], startSpot: number) {
  let spot = startSpot;
  for (const [name, count, mode] of picks) {
    await (await chipOnTrayOrPin(page, name)).click();
    for (let i = 0; i < count; i += 1) {
      if (mode === "stroke") await squeezeDoughPath(page, STROKES[i % STROKES.length]);
      else await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
    }
  }
  return spot;
}

test.describe("Expansion Batch 13 (potato-mayo-pizza, played end to end)", () => {
  test.setTimeout(300_000);

  for (const c of CASES) {
    test(`${c.id}: Shop NEW -> purchase -> Research (no leak) -> ${c.sauce ? "paint" : "skip the sauce"}, cheese, toppings -> NEW DISCOVERY -> Dex`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && !new URL(m.location().url || "http://x/").pathname.endsWith("/favicon.ico") && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      const project = testInfo.project.name;
      const step = DISCOVERY_LADDER.steps.findIndex((s) => s.ingredientIds.includes(c.materials[0][0])) + 1;
      // This save has played everything but the target; it owns every material before the target's step.
      const discovered = ALL_IDS.filter((id) => id !== c.id);
      await open(page, saveJson(discovered, materialsUpTo(step - 1)));
      await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
      await hold(page);

      // 1. Shop: the step's material is NEW (T4: 120 Pitz, no star gate).
      await page.getByRole("button", { name: /ショップ/ }).click();
      await page.waitForSelector(".shop-overlay__panel");
      for (const [id, nameJa, shot] of c.materials) {
        const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toHaveCount(1);
        await expect(row).toHaveAttribute("data-shop-state", "NEW");
        await expect(row).toContainText(nameJa);
        await expect(row).toContainText(/ピザ分/);
        await expect(row).toContainText(/初回 .*120 Pitz/);
        await noOverflow(page, `shop NEW ${id}`);
        await capture(page, `${shot}-new`, project);
        await hold(page, 2000);
        await row.locator(".shop-item__buy-button").click();
        await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
      }
      await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
      await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

      // 2. Dex -> the single Research Entry: only the unlock material (and the cohort letter) is named.
      await page.getByRole("button", { name: /ピザ図鑑/ }).click();
      await page.waitForSelector(".dex-overlay");
      await expect(page.locator(".dex-overlay__research")).toContainText(c.label);
      await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
      await noOverflow(page, "Dex Research Entry");
      await capture(page, `b13-${c.id}-research-entry`, project);
      await hold(page, 2000);
      await page.locator(".dex-overlay__research").getByRole("button", { name: new RegExp(`^${c.label}を研究する$`) }).click();
      await expectResearchLead(page, "？？？ピザ");
      await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");

      // 3. Cooking: [SAUCE (the existing PAINT gesture),] CHEESE, TOPPING.
      await page.waitForSelector(".pizza-stage");
      await completeDoughStep(page);
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      if (c.sauce) {
        await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
        await (await chipOnTrayOrPin(page, c.sauce)).click();
        await capture(page, `b13-${c.id}-tray-sauce`, project);
        await paintSauceRing(page, 25, 16);
        await hold(page, 2200);
        await capture(page, `b13-${c.id}-sauce-painted`, project);
        await noOverflow(page, "sauce painted");
        await bar(page).getByRole("button", { name: /次へ/ }).click();
      } else {
        // NO_SAUCE: a Research round still offers the SAUCE step (the player does not know the recipe); choosing no sauce is how the recipe is made.
        await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
        await capture(page, `b13-${c.id}-no-sauce-step`, project);
        await bar(page).getByRole("button", { name: /次へ/ }).click();
      }
      await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
      let spot = await place(page, c.cheese, 0);
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
      await capture(page, `b13-${c.id}-tray-topping`, project);
      // Owner 案A, measured on the real layout: (1) the committed line sits where the finger drew it (no jump at release, even near the rim), (2) one stroke
      // is capped at 60% of the dough's diameter, (3) 1つ戻す takes back exactly the last stroke / the tap's droplet.
      await (await chipOnTrayOrPin(page, /マヨネーズ/)).click();
      const doughBox = (await page.locator('[data-pizza-drop-target="true"]').boundingBox())!;
      const screenOf = (px: number, py: number) => ({ x: doughBox.x + (px / 100) * doughBox.width, y: doughBox.y + (py / 100) * doughBox.height });
      await squeezeDoughStroke(page, [14, 46], [60, 46]);
      const line = page.locator("svg.pizza-squeeze-trail").first();
      await expect(line).toHaveCount(1);
      const geometry = await line.evaluate((svg) => {
        const box = svg.getBoundingClientRect();
        const pts = svg.querySelector("path")!.getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        return { left: box.left, top: box.top, width: box.width, height: box.height, pts };
      });
      const first = { x: geometry.left + (geometry.pts[0] / 100) * geometry.width, y: geometry.top + (geometry.pts[1] / 100) * geometry.height };
      const want = screenOf(14, 46);
      expect(Math.abs(first.x - want.x), `${project}: line start vs finger (x)`).toBeLessThan(1.5);
      expect(Math.abs(first.y - want.y), `${project}: line start vs finger (y)`).toBeLessThan(1.5);
      await page.getByRole("button", { name: "1つ戻す" }).click();
      await expect(page.locator("svg.pizza-squeeze-trail")).toHaveCount(0);
      await squeezeDoughStroke(page, [6, 50], [94, 50], 40); // far longer than the cap
      const capped = await page.locator("svg.pizza-squeeze-trail").first().evaluate((svg) => {
        const box = svg.getBoundingClientRect();
        const pts = svg.querySelector("path")!.getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        let len = 0;
        for (let i = 2; i < pts.length; i += 2) len += Math.hypot(((pts[i] - pts[i - 2]) / 100) * box.width, ((pts[i + 1] - pts[i - 1]) / 100) * box.height);
        return len;
      });
      const ratio = capped / doughBox.width;
      console.log(`[mayo cap] ${project}: dough ${doughBox.width.toFixed(1)}px, one stroke max ${capped.toFixed(1)}px (${(ratio * 100).toFixed(1)}% of the dough box; the cap is 60% of the 96% dough diameter = 57.6%)`);
      expect(ratio).toBeGreaterThan(0.57);
      expect(ratio).toBeLessThan(0.585);
      await capture(page, `b13-${c.id}-mayo-cap`, project);
      await hold(page, 1500);
      await page.getByRole("button", { name: "1つ戻す" }).click();
      await expect(page.locator("svg.pizza-squeeze-trail")).toHaveCount(0);
      await tapDoughPercent(page, 50, 50); // a tap = the single droplet, no line
      await expect(page.locator('.pizza-dough [data-ingredient-visual="mayo-drop"]')).toHaveCount(1);
      await expect(page.locator("svg.pizza-squeeze-trail")).toHaveCount(0);
      await capture(page, `b13-${c.id}-mayo-drop`, project);
      await hold(page, 1500);
      await page.getByRole("button", { name: "1つ戻す" }).click();
      await expect(page.locator(".pizza-topping--mayo")).toHaveCount(0);
      spot = await place(page, c.toppings, spot);
      // Owner 案A: each mayo = ONE stroke = ONE piece, drawn as a line (not a droplet); the strokes are inside the dough and the page does not scroll sideways.
      await expect(page.locator(".pizza-squeeze-trail")).toHaveCount(2);
      await expect(page.locator(".pizza-topping--mayo")).toHaveCount(2);
      await capture(page, `b13-${c.id}-topped`, project);
      await noOverflow(page, "topped");
      await hold(page, 2000);
      // Free Cooking judges the bake on the generic window (58-78), which is also the recipe's own window: aim inside both.
      await bakeToTarget(page, { start: 60, end: 76 });
      await page.waitForSelector(".result-panel");

      // 4. NEW DISCOVERY.
      const discovery = page.locator(".result-panel--discovery");
      await expect(discovery).toBeVisible();
      await expect(discovery).toContainText(c.nameJa);
      await noOverflow(page, "NEW RECIPE");
      await capture(page, `b13-${c.id}-new-recipe`, project);
      await hold(page, 3000);

      // 5. Dex: complete; schema v2 unchanged.
      await page.getByRole("button", { name: /ホーム/ }).first().click();
      await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
      await page.waitForSelector(".dex-overlay");
      await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
      const card = page.locator(".dex-card").filter({ hasText: c.nameJa });
      await expect(card).toHaveCount(1);
      await card.scrollIntoViewIfNeeded();
      await noOverflow(page, "Dex");
      await capture(page, `b13-${c.id}-dex`, project);
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
      expect(saved.schemaVersion).toBe(2);
      expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(c.id);
      expect(errors).toEqual([]);
    });
  }
});
