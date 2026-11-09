import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import {
  SPECK_E_BRIE_REFERENCE, BUFFALO_CHICKEN_REFERENCE, PIZZA_FINOCCHI_SALAD_REFERENCE, PIZZA_CAVOLO_CAROTE_REFERENCE, PIZZA_RADICCHIO_NOCI_REFERENCE, BLACK_TRUFFLE_PIZZA_REFERENCE, type ReferencePizza,
} from "../src/data/referencePizza";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { expectResearchLead } from "./support/hintNote";
import { CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Expansion Batch 22 representative E2E (Issue #780; PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): the six B22 recipes played end to end at 390x844 and 360x800. Ordinary: speck-e-brie (NO_SAUCE, brie) and buffalo-chicken
 * (buffalo-sauce painted BEFORE the bake). Late: pizza-finocchi-salad / pizza-cavolo-carote (olive-oil), pizza-radicchio-noci (olive-oil then balsamic-vinegar, two layers), black-truffle-pizza (NO_SAUCE), each with POST_BAKE pieces in FINISH.
 * Shop NEW -> purchase -> Dex Research entry (no identity leak) -> sauce layer(s) -> every pre-bake piece at the Reference's own slot (`assignReferenceSlots` via the REFERENCE data) -> bake -> POST_BAKE pieces in FINISH (late) -> NEW DISCOVERY -> Dex.
 * Dedicated SVGs (#797, via IngredientGlyph): the eight toppings / brie draw `brie-wedge` ... `truffle-shavings` on the tray chip AND on the pizza; buffalo-sauce and balsamic-vinegar have none and draw their emoji on the chip. Step numbers are DERIVED from the ladder.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ALL_IDS = RECIPES.map((r) => r.id as string);
const stepOf = (ingredientId: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(ingredientId))!.step;

const saveJson = (discovered: readonly string[], owned: readonly string[]) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: [...owned],
  });

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const isFaviconProbe = (url: string) => new URL(url || "http://x/").pathname.endsWith("/favicon.ico");
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
/** Places `chip` once per Reference position of `ingredientId` (dough percent, the Reference's own multi-ring slots). */
async function placeAtReference(page: Page, ref: ReferencePizza, ingredientId: string, chip: RegExp, project = "") {
  const group = ref.pieceGroups.find((g) => g.ingredientId === ingredientId)!;
  const chipEl = await chipOnTrayOrPin(page, chip);
  const visual = DEDICATED[ingredientId];
  const emoji = EMOJI_ONLY[ingredientId];
  const parts = process.env.HV_SCREENSHOT_DIR ? `${process.env.HV_SCREENSHOT_DIR}/compare-parts` : "";
  if (parts) mkdirSync(parts, { recursive: true });
  if (visual) await expect(chipEl.locator(`svg[data-ingredient-visual="${visual}"]`)).toHaveCount(1);
  if (emoji) {
    await expect(chipEl.locator("svg[data-ingredient-visual]")).toHaveCount(0);
    await expect(chipEl.locator(".ingredient-chip__emoji")).toContainText(emoji);
  }
  if (parts && (visual || emoji)) await chipEl.screenshot({ path: `${parts}/${ingredientId}-chip-${project}.png` });
  await chipEl.click();
  for (const p of group.positions) await tapDoughPercent(page, p.x, p.y);
  const stage = page.locator(".pizza-stage");
  if (visual) {
    await expect(stage.locator(`svg[data-ingredient-visual="${visual}"]`).first()).toBeVisible();
    if (parts) await stage.locator(`svg[data-ingredient-visual="${visual}"]`).first().screenshot({ path: `${parts}/${ingredientId}-piece-${project}.png` });
  }
  if (emoji) {
    const piece = stage.locator(".ingredient-piece-visual__emoji").filter({ hasText: emoji }).first();
    await expect(piece).toBeVisible();
    await expect(piece.locator("svg[data-ingredient-visual]")).toHaveCount(0);
    if (parts) await piece.screenshot({ path: `${parts}/${ingredientId}-piece-${project}.png` });
  }
  return group.positions.length;
}

interface Plan {
  id: string;
  name: string;
  tag: string;
  ref: ReferencePizza;
  materials: readonly [string, string][]; // [ingredient id, Japanese name]
  cohortKey: string;
  /** Sauce layers painted in order (none = NO_SAUCE); `emoji` = the chip shows this emoji (no dedicated art). */
  sauces: { chip: RegExp; emoji?: string; a?: number; b?: number }[];
  pre: { id: string; chip: RegExp; tab: "チーズ" | "具材" }[];
  post: { id: string; chip: RegExp }[];
}

/** Ingredients with a dedicated SVG (#797) and the ones that deliberately stay on their emoji (the sauces have no pieces on the pizza). */
const DEDICATED: Record<string, string> = {
  brie: "brie-wedge", fennel: "fennel-slices", orange: "orange-slices", carrot: "carrot-rounds", "red-cabbage": "red-cabbage-shreds",
  "sunflower-seeds": "sunflower-kernels", radicchio: "radicchio-leaf", truffle: "truffle-shavings",
};
const EMOJI_ONLY: Record<string, string> = {};

const PLANS: Plan[] = [
  {
    id: "speck-e-brie", name: "スペックエブリー", tag: "b22-speck", ref: SPECK_E_BRIE_REFERENCE,
    materials: [["brie", "ブリーチーズ"]], cohortKey: "ブリーチーズ", sauces: [],
    pre: [{ id: "brie", chip: /ブリー/, tab: "チーズ" }, { id: "mozzarella", chip: /モッツァレラ/, tab: "チーズ" }, { id: "prosciutto-crudo", chip: /生ハム/, tab: "具材" }, { id: "walnut", chip: /くるみ/, tab: "具材" }],
    post: [],
  },
  {
    id: "buffalo-chicken", name: "バッファローチキンピザ", tag: "b22-buffalo", ref: BUFFALO_CHICKEN_REFERENCE,
    materials: [["buffalo-sauce", "バッファローソース"]], cohortKey: "バッファローソース", sauces: [{ chip: /バッファローソース/, emoji: "\u{1F9AC}" }],
    pre: [{ id: "mozzarella", chip: /モッツァレラ/, tab: "チーズ" }, { id: "gorgonzola", chip: /ゴルゴンゾーラ/, tab: "チーズ" }, { id: "chicken", chip: /チキン/, tab: "具材" }],
    post: [],
  },
  {
    id: "pizza-finocchi-salad", name: "ピッツァ・コン・インサラータ・ディ・フィノッキ", tag: "b22-finocchi", ref: PIZZA_FINOCCHI_SALAD_REFERENCE,
    materials: [["fennel", "フェンネル"], ["orange", "オレンジ"]], cohortKey: "オレンジ", sauces: [{ chip: /オリーブオイル/ }],
    pre: [{ id: "mozzarella", chip: /モッツァレラ/, tab: "チーズ" }, { id: "black-olive", chip: /ブラックオリーブ/, tab: "具材" }, { id: "fennel", chip: /フェンネル/, tab: "具材" }, { id: "mint", chip: /ミント/, tab: "具材" }],
    post: [{ id: "orange", chip: /オレンジ/ }],
  },
  {
    id: "pizza-cavolo-carote", name: "ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ", tag: "b22-cavolo", ref: PIZZA_CAVOLO_CAROTE_REFERENCE,
    materials: [["carrot", "にんじん"], ["red-cabbage", "紫キャベツ"], ["sunflower-seeds", "ひまわりの種"]], cohortKey: "ひまわりの種", sauces: [{ chip: /オリーブオイル/ }],
    pre: [{ id: "mozzarella", chip: /モッツァレラ/, tab: "チーズ" }, { id: "carrot", chip: /にんじん/, tab: "具材" }, { id: "sunflower-seeds", chip: /ひまわりの種/, tab: "具材" }],
    post: [{ id: "lemon", chip: /レモン/ }, { id: "red-cabbage", chip: /紫キャベツ/ }],
  },
  {
    id: "pizza-radicchio-noci", name: "ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ", tag: "b22-radicchio", ref: PIZZA_RADICCHIO_NOCI_REFERENCE,
    materials: [["radicchio", "ラディッキオ"], ["balsamic-vinegar", "バルサミコ酢"]], cohortKey: "バルサミコ酢", sauces: [{ chip: /オリーブオイル/ }, { chip: /バルサミコ酢/, emoji: "\u{1F3FA}", a: 33, b: 10 }],
    pre: [{ id: "mozzarella", chip: /モッツァレラ/, tab: "チーズ" }, { id: "walnut", chip: /くるみ/, tab: "具材" }],
    post: [{ id: "radicchio", chip: /ラディッキオ/ }],
  },
  {
    id: "black-truffle-pizza", name: "黒トリュフピザ", tag: "b22-truffle", ref: BLACK_TRUFFLE_PIZZA_REFERENCE,
    materials: [["truffle", "トリュフ"]], cohortKey: "トリュフ", sauces: [],
    pre: [{ id: "mozzarella", chip: /モッツァレラ/, tab: "チーズ" }, { id: "parmigiano", chip: /パルミジャーノ/, tab: "チーズ" }],
    post: [{ id: "truffle", chip: /トリュフ/ }],
  },
];

test.describe("Expansion Batch 22 (six recipes, played end to end)", () => {
  test.setTimeout(300_000);

  for (const plan of PLANS) {
    test(`${plan.id}: Shop NEW -> purchase -> Research (no leak) -> sauce(s), pieces at the Reference slots, bake${plan.post.length ? ", FINISH garnish" : ""} -> NEW DISCOVERY -> Dex`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && !isFaviconProbe(m.location().url) && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      const project = testInfo.project.name;
      const step = stepOf(plan.materials[0][0]);
      const discovered = ALL_IDS.filter((id) => id !== plan.id);
      // Every material of every step before this one is owned, plus the rest of this recipe's own earlier-step materials; this step's materials are what the Shop offers as NEW.
      const own = DISCOVERY_LADDER.steps.find((s) => s.step === step)!.ingredientIds as readonly string[];
      const owned = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]).filter((id) => !own.includes(id));
      await open(page, saveJson(discovered, owned));
      await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${discovered.length}/${CATALOG_COUNTS.recipes}`));
      await hold(page);

      // 1. Shop: the step's materials are NEW; buy them.
      await page.getByRole("button", { name: /ショップ/ }).click();
      await page.waitForSelector(".shop-overlay__panel");
      for (const [id, nameJa] of plan.materials) {
        const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toHaveCount(1);
        await expect(row).toHaveAttribute("data-shop-state", "NEW");
        await expect(row).toContainText(nameJa);
        await noOverflow(page, `shop NEW ${id}`);
        await capture(page, `${plan.tag}-${id}-shop-new`, project);
        await hold(page, 2000);
        await row.locator(".shop-item__buy-button").click();
        await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
      }
      await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
      await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

      // 2. Dex -> Research entry (names only the cohort key; no undiscovered identity anywhere).
      await page.getByRole("button", { name: /ピザ図鑑/ }).click();
      await page.waitForSelector(".dex-overlay");
      await expect(page.locator(".dex-overlay__research")).toContainText(new RegExp(`？？？ピザ（${plan.cohortKey}）`));
      await expectNoUndiscoveredIdentity(page, discovered, "Dex Research Entry");
      await noOverflow(page, "Dex Research Entry");
      await capture(page, `${plan.tag}-research-entry`, project);
      await hold(page, 2000);
      await page.locator(".dex-overlay__research").getByRole("button", { name: new RegExp(`^？？？ピザ（${plan.cohortKey}）を研究する$`) }).click();
      await expectResearchLead(page, "？？？ピザ");
      await expectNoUndiscoveredIdentity(page, discovered, "Research PREPARE");

      // 3. Cooking: dough, then the sauce layer(s) (none for a NO_SAUCE recipe), then the pieces.
      await page.waitForSelector(".pizza-stage");
      await completeDoughStep(page);
      await bar(page).getByRole("button", { name: /次へ/ }).click();
      if (plan.sauces.length) {
        await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
        for (const [i, sauce] of plan.sauces.entries()) {
          const chip = await chipOnTrayOrPin(page, sauce.chip);
          if (sauce.emoji) {
            await expect(chip.locator("svg[data-ingredient-visual]")).toHaveCount(0);
            await expect(chip.locator(".ingredient-chip__emoji")).toContainText(sauce.emoji);
          }
          await chip.click();
          await capture(page, `${plan.tag}-tray-sauce${i}`, project);
          await paintSauceRing(page, sauce.a ?? 25, sauce.b ?? 16);
          await hold(page, 1600);
        }
        await capture(page, `${plan.tag}-sauce-painted`, project);
        await noOverflow(page, "sauce painted");
      }

      let capturedCheeseTray = false;
      let capturedToppingTray = false;
      for (const piece of plan.pre) {
        while (!(await page.getByRole("tab", { name: piece.tab, selected: true }).isVisible().catch(() => false))) {
          await bar(page).getByRole("button", { name: /次へ/ }).click();
        }
        if (piece.tab === "チーズ" && !capturedCheeseTray) {
          capturedCheeseTray = true;
          await expect(await chipOnTrayOrPin(page, piece.chip)).toBeVisible();
          await capture(page, `${plan.tag}-tray-cheese`, project);
        }
        if (piece.tab === "具材" && !capturedToppingTray) {
          capturedToppingTray = true;
          await expect(await chipOnTrayOrPin(page, piece.chip)).toBeVisible();
          await capture(page, `${plan.tag}-tray-topping`, project);
        }
        await placeAtReference(page, plan.ref, piece.id, piece.chip, project);
      }
      await noOverflow(page, "topped");
      await capture(page, `${plan.tag}-topped`, project);
      await hold(page, 2000);

      // 4. Bake (generic window 58-78 = the recipe's own); a late recipe then waits in FINISH for its POST_BAKE pieces.
      // A recipe whose last pre-bake piece is a cheese (black-truffle-pizza: its only topping is POST_BAKE) still has the empty 具材 step to pass before 焼く.
      for (let i = 0; i < 3 && !(await page.getByRole("button", { name: /焼く/ }).isVisible().catch(() => false)); i += 1) await bar(page).getByRole("button", { name: /次へ/ }).click();
      if (plan.post.length) {
        await bakeToTarget(page, { start: 60, end: 76 }, { finish: false });
        await expect(page.getByTestId("finish-dock")).toBeVisible();
        await capture(page, `${plan.tag}-finish`, project);
        await hold(page, 1800);
        for (const piece of plan.post) await placeAtReference(page, plan.ref, piece.id, piece.chip, project);
        await expect(page.getByTestId("finish-undo")).toBeEnabled();
        await noOverflow(page, "finish garnish placed");
        await capture(page, `${plan.tag}-finish-garnish`, project);
        await hold(page, 2200);
        await page.getByTestId("finish-complete").click();
      } else {
        await bakeToTarget(page, { start: 60, end: 76 });
      }
      await page.waitForSelector(".result-panel");

      // 5. NEW DISCOVERY.
      const discovery = page.locator(".result-panel--discovery");
      await expect(discovery).toBeVisible();
      await expect(discovery).toContainText(plan.name);
      await noOverflow(page, "NEW RECIPE");
      await capture(page, `${plan.tag}-new-recipe`, project);
      await hold(page, 3000);

      // 6. Dex: complete; schema v2 unchanged.
      await page.getByRole("button", { name: /ホーム/ }).first().click();
      await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
      await page.waitForSelector(".dex-overlay");
      await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`${CATALOG_COUNTS.recipes}\\s*/\\s*${CATALOG_COUNTS.recipes}`));
      const card = page.locator(".dex-card").filter({ hasText: plan.name });
      await expect(card).toHaveCount(1);
      await card.scrollIntoViewIfNeeded();
      await noOverflow(page, "Dex");
      await capture(page, `${plan.tag}-dex`, project);
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
      expect(saved.schemaVersion).toBe(2);
      expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(plan.id);
      expect(errors).toEqual([]);
    });
  }
});
