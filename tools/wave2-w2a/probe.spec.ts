import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { completeDoughStep, enterBakePaused, landNeedleAndTakeOut, paintSauceRing } from "../../e2e/gestures";

/**
 * Wave 2 W2-A Authoring Gate -- prototype / measurement only (see playwright.probe.config.ts).
 *
 * 1. White-sauce visibility: a fromage-blanc sauce is injected with several colour candidates
 *    (and, for some, a prototype CSS treatment added with addStyleTag), painted with the real
 *    gesture on the real dough, and compared pixel-by-pixel with the same dough before painting.
 *    Tomato / pesto / olive-oil (shipped, Human-Feel accepted) are the baselines.
 * 2. Tray after W2-A: all 29 runtime + 8 W2-A ingredients owned; Free Cooking and Dinner TOPPING
 *    trays are measured (pages, taps to the first new ingredient, stage/dough size, overflow).
 * No src file is changed; everything injected lives only in this browser session.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_JSON = join(ROOT, "docs/reports/data/TETO_WAVE2_W2A_UI-PROBE.json");
const SHOT_DIR = join(ROOT, "docs/reports/screenshots/wave2-w2a-authoring");
const SAVE_KEY = "teto-pizza-save-v1";

const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x664", width: 390, height: 664 },
  { id: "360x640", width: 360, height: 640 },
];

const RUNTIME_FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato",
  "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];

/** Prototype rows for the 8 W2-A ingredients. Names = catalog v2 / PR #255; emoji and colours are
 *  PROTOTYPE PLACEHOLDERS for measurement, not authored art. */
const W2A_TOPPINGS = [
  { id: "prosciutto-crudo", nameJa: "生ハム", color: "#d98b8b", emoji: "\u{1F953}" },
  { id: "arugula", nameJa: "ルッコラ", color: "#4f7f2f", emoji: "\u{1F96C}" },
  { id: "shrimp", nameJa: "エビ", color: "#f08a5d", emoji: "\u{1F990}" },
  { id: "chicken", nameJa: "チキン", color: "#d9a066", emoji: "\u{1F357}" },
  { id: "parsley", nameJa: "パセリ", color: "#3f7d33", emoji: "\u{1F33F}" },
  { id: "bell-pepper", nameJa: "パプリカ", color: "#e0452b", emoji: "\u{1FAD1}" },
  { id: "zucchini", nameJa: "ズッキーニ", color: "#5b8c3a", emoji: "\u{1F952}" },
];
const W2A_IDS = ["fromage-blanc-sauce", ...W2A_TOPPINGS.map((t) => t.id)];

interface WhiteCandidate {
  id: string;
  color: string;
  css?: string;
  note: string;
}
const WHITE_CANDIDATES: WhiteCandidate[] = [
  { id: "W0-plain", color: "#f4efe4", note: "realistic fromage blanc, generic PAINT treatment only" },
  { id: "W1-bright", color: "#fffdf7", note: "brighter white, generic treatment" },
  { id: "W2-cool-tint", color: "#eef1f4", note: "slightly cool (blue-grey) base tint, generic treatment" },
  {
    id: "W3-outline",
    color: "#f7f3ea",
    css: "blur(3px) contrast(1.15) drop-shadow(0 0 1.5px rgba(120, 86, 44, 0.75)) drop-shadow(0 0 3px rgba(120, 86, 44, 0.35))",
    note: "near-white + warm outline (drop-shadow), olive-oil style CSS modifier",
  },
  {
    id: "W4-outline-opaque",
    color: "#fbf8f1",
    css: "blur(2px) contrast(1.35) brightness(1.04) drop-shadow(0 0 1px rgba(110, 78, 40, 0.9)) drop-shadow(0 1px 2px rgba(110, 78, 40, 0.45))",
    note: "brighter, more opaque core + stronger outline (texture substitute)",
  },
];

function ingredientRow(id: string, category: string, nameJa: string, color: string, emoji: string, placement: string) {
  return `{ id: ${JSON.stringify(id)}, category: ${JSON.stringify(category)}, nameJa: ${JSON.stringify(nameJa)}, color: ${JSON.stringify(color)}, emoji: ${JSON.stringify(emoji)}, placement: ${JSON.stringify(placement)}, unlockCondition: { minTotalStars: 0 } }`;
}

/** Rewrites the dev server's ingredients module so INGREDIENTS also holds the W2-A rows. */
async function injectIngredients(page: Page, opts: { sauceColor: string; order: "append" | "prepend" }) {
  await page.route("**/src/data/ingredients.ts*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const rows = [
      ingredientRow("fromage-blanc-sauce", "sauce", "フロマージュブラン", opts.sauceColor, "\u{1F95B}", "spread"),
      ...W2A_TOPPINGS.map((t) => ingredientRow(t.id, "topping", t.nameJa, t.color, t.emoji, "scatter")),
    ];
    const op = opts.order === "append" ? "push" : "unshift";
    await route.fulfill({ response, body: `${body}\nINGREDIENTS.${op}(${rows.join(",\n")});\n` });
  });
}

function save(discovered: readonly string[]) {
  const finite = [...RUNTIME_FINITE, ...W2A_IDS];
  return {
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 })),
    pitzBalance: 999,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...finite],
    missionBest: {},
    inventory: Object.fromEntries(finite.map((id) => [id, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: finite,
  };
}

async function openWith(page: Page, data: unknown, query = "") {
  await page.goto("icons/icon-16.png");
  await page.evaluate(
    ([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    },
    [SAVE_KEY, JSON.stringify(data)] as const,
  );
  await page.goto(`./${query}`);
  await page.waitForSelector(".app-frame");
}

const next = (page: Page) => page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ }).click();

async function selectChip(page: Page, name: RegExp): Promise<number> {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name });
  let taps = 0;
  for (let i = 0; i < 12 && !(await chip.count()); i += 1) {
    await page.getByRole("button", { name: "次のページ" }).click();
    taps += 1;
  }
  await chip.first().click();
  return taps;
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const r = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
    };
    const doc = document.scrollingElement!;
    const game = document.querySelector<HTMLElement>(".game-screen");
    const label = document.querySelector(".ingredient-page-nav__label")?.textContent?.trim() ?? null;
    return {
      stage: r(".pizza-stage"),
      dough: r('[data-pizza-drop-target="true"]'),
      tray: r(".ingredient-tray"),
      pager: r(".ingredient-page-nav"),
      bakeBar: r(".prepare-bake-bar"),
      pagerLabel: label,
      chipsOnPage: document.querySelectorAll(".ingredient-chip").length,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      documentScrolls: doc.scrollHeight > doc.clientHeight + 1,
      gameScreenScrolls: game ? game.scrollHeight > game.clientHeight + 1 : null,
    };
  });
}

/** Mean CIE76 dE (and share of pixels with dE > 10) between two PNGs, inside a centred disc. */
async function colourDelta(page: Page, before: Buffer, after: Buffer, radiusFraction = 0.28) {
  return page.evaluate(
    async ([a, b, rf]) => {
      const load = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
      };
      const lab = (r: number, g: number, bl: number) => {
        const f = (v: number) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        const [R, G, B] = [f(r), f(g), f(bl)];
        const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
        const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
        const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
        const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
        return [116 * g2(y) - 16, 500 * (g2(x) - g2(y)), 200 * (g2(y) - g2(z)), y] as const;
      };
      const A = await load(a as string);
      const B = await load(b as string);
      const w = Math.min(A.width, B.width);
      const h = Math.min(A.height, B.height);
      const cx = w / 2;
      const cy = h / 2;
      const rad = (rf as number) * w;
      let n = 0;
      let sum = 0;
      let visible = 0;
      let yA = 0;
      let yB = 0;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
          const i = (y * A.width + x) * 4;
          const j = (y * B.width + x) * 4;
          const la = lab(A.data[i], A.data[i + 1], A.data[i + 2]);
          const lb = lab(B.data[j], B.data[j + 1], B.data[j + 2]);
          const d = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
          sum += d;
          if (d > 10) visible += 1;
          yA += la[3];
          yB += lb[3];
          n += 1;
        }
      }
      const lumA = yA / n;
      const lumB = yB / n;
      const contrast = (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
      return {
        meanDeltaE: Math.round((sum / n) * 10) / 10,
        shareDeltaEOver10: Math.round((visible / n) * 1000) / 1000,
        luminanceContrast: Math.round(contrast * 100) / 100,
      };
    },
    [before.toString("base64"), after.toString("base64"), radiusFraction] as const,
  );
}

async function shot(page: Page, name: string, locatorSel?: string) {
  mkdirSync(SHOT_DIR, { recursive: true });
  const path = join(SHOT_DIR, `${name}.png`);
  if (locatorSel) await page.locator(locatorSel).first().screenshot({ path });
  else await page.screenshot({ path });
}

const results: Record<string, unknown> = { whiteSauce: {}, tray: {} };

interface SauceCase {
  id: string;
  chip: RegExp;
  color: string;
  css?: string;
  note: string;
  baseline: boolean;
}
const SAUCE_CASES: SauceCase[] = [
  { id: "B-tomato", chip: /トマトソース/, color: "#f4efe4", note: "shipped baseline", baseline: true },
  { id: "B-pesto", chip: /ジェノベーゼ/, color: "#f4efe4", note: "shipped baseline", baseline: true },
  { id: "B-olive-oil", chip: /オリーブオイル/, color: "#f4efe4", note: "shipped baseline (needed PR #45 / #159 fixes)", baseline: true },
  ...WHITE_CANDIDATES.map((c) => ({ ...c, chip: /フロマージュブラン/, baseline: false })),
];

for (const vp of VIEWPORTS) {
  for (const c of SAUCE_CASES) {
    test(`white sauce ${c.id} @${vp.id}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await injectIngredients(page, { sauceColor: c.color, order: "append" });
      await openWith(page, save(["margherita"]));
      if (c.css) {
        await page.addStyleTag({ content: `.pizza-sauce-heatmap:not(.pizza-sauce-heatmap--oil) { filter: ${c.css}; }` });
      }
      await page.getByRole("button", { name: /フリークッキング/ }).first().click();
      await page.waitForSelector(".pizza-stage");
      await completeDoughStep(page);
      await next(page);
      const dough = '[data-pizza-drop-target="true"]';
      await page.waitForTimeout(300);
      const before = await page.locator(dough).screenshot();
      await selectChip(page, c.chip);
      for (const [radius, count] of [[8, 8], [18, 14], [28, 20], [34, 24]] as const) await paintSauceRing(page, radius, count);
      await page.waitForTimeout(400);
      const after = await page.locator(dough).screenshot();
      const prepare = await colourDelta(page, before, after);
      await shot(page, `sauce_${c.id}_prepare_${vp.id}`, dough);
      let result: unknown = null;
      if (vp.id === "390x844" || vp.id === "360x640") {
        // RESULT after a perfect Free-Cooking bake (generic window 60-80).
        await next(page);
        await next(page);
        await enterBakePaused(page);
        await landNeedleAndTakeOut(page, { start: 60, end: 80 });
        await page.waitForTimeout(1200);
        const resultDough = page.locator(".pizza-stage--result .pizza-dough, .pizza-dough").first();
        await resultDough.screenshot({ path: join(SHOT_DIR, `sauce_${c.id}_result_${vp.id}.png`) });
        result = { screenshot: `sauce_${c.id}_result_${vp.id}.png` };
      }
      (results.whiteSauce as Record<string, unknown>)[`${c.id}@${vp.id}`] = {
        candidate: c.id,
        viewport: vp.id,
        color: c.baseline ? null : c.color,
        css: c.css ?? null,
        note: c.note,
        baseline: c.baseline,
        prepare,
        result,
      };
    });
  }

  for (const mode of ["free", "dinner"] as const) {
    for (const order of ["append", "prepend"] as const) {
      test(`tray ${mode} ${order} @${vp.id}`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await injectIngredients(page, { sauceColor: "#f4efe4", order });
        if (mode === "free") {
          await openWith(page, save(["margherita", "bismarck", "breakfast-pizza", "funghi"]));
          await page.getByRole("button", { name: /フリークッキング/ }).first().click();
        } else {
          await openWith(page, save(["margherita", "bismarck", "breakfast-pizza", "funghi"]), "?dinnerDuration=900&dinnerMinStars=1");
          await page.getByRole("button", { name: /ディナーミッション/ }).click();
          await page.locator(".dinner-mission-card").first().click();
          await page.getByRole("button", { name: /スタート/ }).click();
          await page.getByTestId("dinner-target-row").waitFor();
        }
        await page.waitForSelector(".pizza-stage");
        await completeDoughStep(page);
        await next(page);
        const sauce = await layout(page);
        await next(page);
        await next(page);
        await page.waitForSelector(".ingredient-chip");
        const topping = await layout(page);
        await shot(page, `tray_${mode}_${order}_topping_${vp.id}`);
        const tapsToProsciutto = await selectChip(page, /生ハム/);
        const tapsToZucchiniFromThere = await selectChip(page, /ズッキーニ/);
        const afterPaging = await layout(page);
        await shot(page, `tray_${mode}_${order}_topping-new-page_${vp.id}`);
        (results.tray as Record<string, unknown>)[`${mode}/${order}@${vp.id}`] = {
          mode,
          order,
          viewport: vp.id,
          sauceStep: sauce,
          toppingStep: topping,
          tapsToFirstNewIngredient: tapsToProsciutto,
          tapsToLastNewIngredientAfterThat: tapsToZucchiniFromThere,
          afterPaging,
        };
      });
    }
  }
}

test.afterAll(() => {
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  const sortKeys = (o: Record<string, unknown>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  writeFileSync(
    OUT_JSON,
    `${JSON.stringify(
      {
        schema: "teto-wave2-w2a-ui-probe/1",
        generatedBy: "tools/wave2-w2a/probe.spec.ts (Chromium, dev server, injected prototype rows; no src change)",
        whiteSauce: sortKeys(results.whiteSauce as Record<string, unknown>),
        tray: sortKeys(results.tray as Record<string, unknown>),
      },
      null,
      1,
    )}\n`,
  );
});
