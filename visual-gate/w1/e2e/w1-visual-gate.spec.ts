import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../../../e2e/gestures";
import { W1_GATE_SAVE_KEY, w1GateSeedSave } from "../candidates";

/**
 * W1 Ingredient Visual Preview Gate (preview-only). Drives real Free Cooking rounds in the real
 * game with the 7 W1 candidate rows injected (visual-gate/w1/inject.ts) and records tray / raw /
 * baked / RESULT evidence per scenario, plus the QA board. Assertions are layout/regression
 * checks only (1-screen, no horizontal overflow, RESULT reachable, identity kept); the visual
 * verdicts themselves are recorded in the Visual Gate report, never asserted here as PASS.
 */

const FREE_COOK_BAKE_TARGET = { start: 58, end: 78 };
const BAKE_NEEDLE_SPEED_PCT_PER_S = 55;
const SHOTS = process.env.W1_GATE_SCREENSHOTS === "1";
/** Human-speed holds for the Human Verification video (W1_GATE_VIDEO=1); 0 otherwise. */
const HOLD_MS = process.env.W1_GATE_VIDEO === "1" ? 1800 : 0;
const SHOT_ROOT = fileURLToPath(
  new URL("../../../docs/reports/screenshots/w1-ingredient-visual-gate-2/", import.meta.url),
);

const W1_IDS = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"];

interface Placement {
  name: string;
  at: ReadonlyArray<readonly [number, number]>;
}

interface Scenario {
  key: string;
  clam?: "oyster" | "dedicated";
  owned: string[];
  sauce: string;
  cheese: { name: string; at: ReadonlyArray<readonly [number, number]> } | null;
  toppings: Placement[];
}

const MOZZ_AT = [
  [38, 38],
  [62, 62],
  [62, 38],
  [38, 62],
] as const;

const SCENARIOS: Scenario[] = [
  {
    key: "tomato",
    owned: ["cherry-tomato", "fresh-tomato"],
    sauce: "トマトソース",
    cheese: { name: "モッツァレラ", at: MOZZ_AT },
    toppings: [
      { name: "トマト", at: [[30, 30], [30, 50], [30, 70]] },
      { name: "チェリートマト", at: [[70, 30], [70, 50], [70, 70]] },
      { name: "バジル", at: [[50, 24], [50, 76]] },
    ],
  },
  {
    key: "capers",
    owned: ["capers", "black-olive", "pepperoni", "garlic", "anchovy"],
    sauce: "トマトソース",
    cheese: null,
    toppings: [
      { name: "ケッパー", at: [[30, 35], [50, 30], [70, 35]] },
      { name: "ブラックオリーブ", at: [[30, 55], [50, 50], [70, 55]] },
      { name: "ペパロニ", at: [[35, 73], [65, 73]] },
      { name: "にんにく", at: [[50, 70]] },
    ],
  },
  {
    key: "eggplant",
    owned: ["eggplant"],
    sauce: "トマトソース",
    cheese: { name: "モッツァレラ", at: [[62, 38], [62, 62]] },
    toppings: [
      // left column on bare sauce, right column on/near the mozzarella pieces
      { name: "ナス", at: [[30, 32], [30, 52], [30, 72], [62, 38], [62, 62]] },
      { name: "バジル", at: [[48, 26], [48, 76]] },
    ],
  },
  {
    key: "clam-a-oyster",
    clam: "oyster",
    owned: ["clam", "olive-oil", "parmigiano", "garlic", "mushroom"],
    sauce: "オリーブオイル",
    cheese: { name: "パルミジャーノ", at: MOZZ_AT },
    toppings: [
      { name: "あさり", at: [[30, 30], [50, 25], [70, 30], [28, 55]] },
      { name: "にんにく", at: [[72, 55], [50, 75]] },
      { name: "マッシュルーム", at: [[50, 50]] },
    ],
  },
  {
    key: "clam-b-dedicated",
    clam: "dedicated",
    owned: ["clam", "olive-oil", "parmigiano", "garlic", "mushroom"],
    sauce: "オリーブオイル",
    cheese: { name: "パルミジャーノ", at: MOZZ_AT },
    toppings: [
      { name: "あさり", at: [[30, 30], [50, 25], [70, 30], [28, 55]] },
      { name: "にんにく", at: [[72, 55], [50, 75]] },
      { name: "マッシュルーム", at: [[50, 50]] },
    ],
  },
  {
    key: "yellow",
    owned: ["corn", "pineapple", "potato", "egg", "ham"],
    sauce: "トマトソース",
    cheese: { name: "モッツァレラ", at: MOZZ_AT },
    toppings: [
      { name: "コーン", at: [[28, 35], [28, 60]] },
      { name: "パイナップル", at: [[50, 26], [50, 50]] },
      { name: "じゃがいも", at: [[72, 35], [72, 60]] },
      { name: "たまご", at: [[50, 74]] },
      { name: "ハム", at: [[35, 76]] },
    ],
  },
  {
    // Every candidate + every comparator owned at once: 3-page topping tray.
    key: "full-tray",
    owned: [
      ...W1_IDS,
      "garlic",
      "cherry-tomato",
      "egg",
      "mushroom",
      "pepperoni",
      "ham",
      "black-olive",
    ],
    sauce: "トマトソース",
    cheese: { name: "モッツァレラ", at: [[50, 50]] },
    toppings: [
      { name: "ケッパー", at: [[30, 30]] },
      { name: "あさり", at: [[50, 24]] },
      { name: "コーン", at: [[70, 30]] },
      { name: "ナス", at: [[28, 52]] },
      { name: "トマト", at: [[72, 52]] },
      { name: "パイナップル", at: [[35, 72]] },
      { name: "じゃがいも", at: [[65, 72]] },
    ],
  },
  {
    // Crowded pizza: every look-alike pair on one pizza, 22 pieces.
    key: "busy",
    owned: [...W1_IDS, "cherry-tomato", "black-olive", "pepperoni", "garlic", "ham"],
    sauce: "トマトソース",
    cheese: { name: "モッツァレラ", at: [[40, 40], [60, 60], [60, 40], [40, 60]] },
    toppings: [
      { name: "トマト", at: [[26, 30], [74, 70]] },
      { name: "チェリートマト", at: [[74, 30], [26, 70]] },
      { name: "ケッパー", at: [[38, 22], [62, 78]] },
      { name: "ブラックオリーブ", at: [[62, 22], [38, 78]] },
      { name: "ペパロニ", at: [[22, 50], [78, 50]] },
      { name: "あさり", at: [[50, 18]] },
      { name: "にんにく", at: [[50, 82]] },
      { name: "ナス", at: [[50, 50]] },
      { name: "コーン", at: [[33, 50]] },
      { name: "パイナップル", at: [[67, 50]] },
      { name: "じゃがいも", at: [[50, 34]] },
      { name: "ハム", at: [[50, 66]] },
    ],
  },
];

function viewportKey(page: Page) {
  const size = page.viewportSize()!;
  return `${size.width}x${size.height}`;
}

async function shot(page: Page, testInfo: { project: { name: string } }, name: string) {
  if (HOLD_MS) await page.waitForTimeout(HOLD_MS);
  if (!SHOTS || !testInfo.project.name.startsWith("chromium")) return;
  const dir = `${SHOT_ROOT}${viewportKey(page)}/`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}${name}.png` });
}

async function expectOneScreen(page: Page, label: string) {
  const state = await page.evaluate(() => {
    const el = document.querySelector(".game-screen")!;
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(state.docScrollWidth, `${label}: no horizontal overflow`).toBeLessThanOrEqual(state.innerWidth);
  expect(state.scrollHeight, `${label}: .game-screen must not need scroll`).toBeLessThanOrEqual(state.clientHeight);
  const bar = await page.locator(".prepare-bake-bar").boundingBox();
  expect(bar!.y + bar!.height, `${label}: bottom bar stays on-screen`).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}

/** Exact-name chip lookup (so "トマト" never matches "チェリートマト"/"トマトソース"), paging the
 *  tray forward until the chip is on the visible page. */
async function selectChip(page: Page, name: string) {
  const chip = page.locator(".ingredient-chip").filter({
    has: page.locator(".ingredient-chip__name", { hasText: new RegExp(`^${name}$`) }),
  });
  for (let i = 0; i < 4 && (await chip.count()) === 0; i += 1) {
    const next = page.getByRole("button", { name: "次のページ" });
    if ((await next.count()) === 0 || (await next.isDisabled())) break;
    await next.click();
  }
  await expect(chip, `chip ${name}`).toHaveCount(1);
  await chip.click();
}

async function gotoTrayFirstPage(page: Page) {
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 4 && (await prev.count()) > 0 && !(await prev.isDisabled()); i += 1) await prev.click();
}

async function pieceCounts(page: Page) {
  return page.evaluate(() => {
    const counts: Record<string, number> = {};
    for (const el of document.querySelectorAll(".pizza-topping")) {
      const id = [...el.classList].find((c) => c.startsWith("pizza-topping--"))!.slice("pizza-topping--".length);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  });
}

/** Dedicated visuals are drawn per id, never per glyph: fresh-tomato -> slice, cherry-tomato
 *  stays 🍅 text; capers -> bud cluster; clam -> asari only on the B page. */
async function expectDedicatedVisuals(page: Page, scenario: Scenario, counts: Record<string, number>) {
  const stage = page.locator(".pizza-stage");
  const n = (visual: string) => stage.locator(`[data-w1-visual="${visual}"]`).count();
  expect(await n("tomato-slice"), "fresh-tomato slice pieces").toBe(counts["fresh-tomato"] ?? 0);
  expect(await n("caper-cluster"), "caper cluster pieces").toBe(counts.capers ?? 0);
  expect(await n("asari-valve"), "asari pieces").toBe(scenario.clam === "dedicated" ? (counts.clam ?? 0) : 0);
  const cherryTexts = await stage.locator(".pizza-topping--cherry-tomato").allTextContents();
  expect(cherryTexts.every((text) => text === "\u{1F345}"), "cherry-tomato stays 🍅").toBe(true);
  const freshTexts = await stage.locator(".pizza-topping--fresh-tomato").allTextContents();
  expect(freshTexts.every((text) => text === ""), "fresh-tomato draws no 🍅 text").toBe(true);
}

for (const scenario of SCENARIOS) {
  test(`W1 gate in-game: ${scenario.key}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      ([key, raw]) => localStorage.setItem(key, JSON.stringify(raw)),
      [W1_GATE_SAVE_KEY, w1GateSeedSave(scenario.owned)] as const,
    );
    await page.goto(scenario.clam ? `./game.html?clam=${scenario.clam}` : "./game.html");
    await page.waitForSelector(".app-frame");
    await expect(page.getByTestId("w1-preview-ribbon")).toBeVisible();
    await page.getByRole("button", { name: /フリークッキング/ }).click();
    await page.waitForSelector(".pizza-stage");

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    await selectChip(page, scenario.sauce);
    await paintSauceRing(page, 25, 16);
    await page.getByRole("button", { name: /次へ/ }).click();

    if (scenario.cheese) {
      await selectChip(page, scenario.cheese.name);
      for (const [x, y] of scenario.cheese.at) await tapDoughPercent(page, x, y);
    }
    await page.getByRole("button", { name: /次へ/ }).click();

    // TOPPING: tray before any placement (page 1).
    await expectOneScreen(page, `${scenario.key} TOPPING tray`);
    await shot(page, testInfo, `${scenario.key}-1-tray`);
    if (scenario.key === "full-tray") {
      await expect(page.locator(".ingredient-page-nav")).toBeVisible();
      for (let p = 2; p <= 3; p += 1) {
        await page.getByRole("button", { name: "次のページ" }).click();
        await expectOneScreen(page, `full-tray page ${p}`);
        await shot(page, testInfo, `${scenario.key}-1-tray-page${p}`);
      }
      await gotoTrayFirstPage(page);
    }

    for (const topping of scenario.toppings) {
      await selectChip(page, topping.name);
      for (const [x, y] of topping.at) await tapDoughPercent(page, x, y);
      await gotoTrayFirstPage(page);
    }
    // Let every topping-land animation finish before capturing.
    await page.waitForTimeout(400);
    await expectOneScreen(page, `${scenario.key} TOPPING placed`);
    await shot(page, testInfo, `${scenario.key}-2-raw`);
    await page.locator(".pizza-stage").screenshot(
      SHOTS && testInfo.project.name.startsWith("chromium")
        ? { path: `${SHOT_ROOT}${viewportKey(page)}/${scenario.key}-2-raw-stage.png` }
        : {},
    );

    // Identity: every candidate piece keeps its own id on the pizza (fresh-tomato is never
    // turned into cherry-tomato, clam stays clam whatever its glyph).
    const counts = await pieceCounts(page);
    if (scenario.key === "tomato") {
      expect(counts["fresh-tomato"]).toBe(3);
      expect(counts["cherry-tomato"]).toBe(3);
    }
    if (scenario.key.startsWith("clam")) expect(counts.clam).toBe(4);
    await expectDedicatedVisuals(page, scenario, counts);
    if (scenario.key === "full-tray") for (const id of W1_IDS) expect(counts[id], id).toBe(1);

    // BAKE: pause the virtual clock with the needle at the free-cook target center and capture
    // the in-oven roast tint (heat = 1.0), then take it out.
    const center = (FREE_COOK_BAKE_TARGET.start + FREE_COOK_BAKE_TARGET.end) / 2;
    await page.clock.install();
    await page.getByRole("button", { name: /焼く/ }).click();
    await page.waitForSelector(".bake-gauge__needle");
    await page.clock.pauseAt(Date.now() + 150);
    const needle = page.locator(".bake-gauge__needle");
    const position = await needle.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left) || 0);
    const remainingMs = Math.max(0, Math.round(((center - position) / BAKE_NEEDLE_SPEED_PCT_PER_S) * 1000));
    if (remainingMs > 0) await page.clock.runFor(remainingMs);
    // Virtual clock stays paused (needle frozen at the center); a short *real* wait lets the
    // 0.3s CSS filter transition settle before capturing.
    await page.waitForTimeout(600);
    const frozenAt = await needle.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left));
    expect(frozenAt, "needle inside the free-cook bake window").toBeGreaterThan(FREE_COOK_BAKE_TARGET.start);
    expect(frozenAt).toBeLessThan(FREE_COOK_BAKE_TARGET.end);
    await shot(page, testInfo, `${scenario.key}-3-baked`);
    if (SHOTS && testInfo.project.name.startsWith("chromium")) {
      await page.locator(".pizza-stage").screenshot({ path: `${SHOT_ROOT}${viewportKey(page)}/${scenario.key}-3-baked-stage.png` });
    }
    await page.getByRole("button", { name: "取り出す！" }).click();
    await page.clock.resume();

    if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
      await page.getByRole("button", { name: /切り終わる/ }).click();
    }
    await page.waitForSelector(".result-panel", { timeout: 20_000 });
    const resultOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(resultOverflow, "RESULT: no horizontal overflow").toBeLessThanOrEqual(0);
    await expect(page.locator(".result-panel")).not.toContainText("焦げ");
    await shot(page, testInfo, `${scenario.key}-4-result`);

    // No W1 candidate-only pizza is a registered recipe in this preview -> ORIGINAL, never a
    // discovery of an existing recipe (cherry-tomato recipes are not matched by fresh-tomato).
    await expect(page.locator(".discovered-banner--new-pizza")).toHaveCount(0);
    // RESULT ingredient list draws the same dedicated visual (never the old 🍅 / 🟢 text).
    const usedList = page.getByRole("list", { name: "使った材料" });
    if (counts["fresh-tomato"]) await expect(usedList.locator('[data-w1-visual="tomato-slice"]')).toHaveCount(1);
    if (counts.capers) await expect(usedList.locator('[data-w1-visual="caper-cluster"]')).toHaveCount(1);
    // Save isolation: the gate only ever writes its own key, never production's / the PR preview's.
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain(W1_GATE_SAVE_KEY);
    expect(keys).not.toContain("teto-pizza-save-v1");
    expect(keys).not.toContain("teto-pizza-preview-save-v1");
    expect(errors, "no page errors").toEqual([]);
  });
}

test("W1 gate QA board", async ({ page }, testInfo) => {
  await page.goto("./board.html");
  await expect(page.getByTestId("section-clam")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "board: no horizontal overflow").toBeLessThanOrEqual(0);
  if (HOLD_MS) {
    for (const id of ["all", "tomato", "capers", "eggplant", "clam", "yellow"]) {
      await page.getByTestId(`section-${id}`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(HOLD_MS * 1.5);
    }
  }
  if (SHOTS && testInfo.project.name.startsWith("chromium")) {
    const dir = `${SHOT_ROOT}${viewportKey(page)}/`;
    mkdirSync(dir, { recursive: true });
    for (const id of ["all", "tomato", "capers", "eggplant", "clam", "yellow"]) {
      await page.getByTestId(`section-${id}`).screenshot({ path: `${dir}board-${id}.png` });
    }
  }
});

test("W1 gate Human Verification hub -> seeded game", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByTestId("w1-hub-sha")).toContainText(/source: [0-9a-f]{7,}/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "hub: no horizontal overflow").toBeLessThanOrEqual(0);
  await shot(page, testInfo, "hub");
  await page.getByRole("link", { name: /あさり B/ }).click();
  await page.waitForSelector(".app-frame");
  expect(new URL(page.url()).searchParams.get("seed"), "seed param dropped after seeding").toBeNull();
  await expect(page.getByTestId("w1-preview-ribbon")).toContainText("B: dedicated asari");
  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await completeDoughStep(page);
  for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: /次へ/ }).click();
  await expect(page.locator(".ingredient-page-nav")).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual(["teto-pizza-w1-visual-gate-save-v1"]);
});
