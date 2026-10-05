import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * TQ-1D / NO_SAUCE Production Activation: Aussie (オージーピザ, the first recipe made without a sauce) and the
 * Technique 「ソースなし」, played for real on both iPhone widths.
 *
 * Saves: ladder step 12 (onion owned and stocked), pizza-portuguesa and brazilian-calabresa already found, so Aussie is
 * the one Research Entry; 13 credited recipes are found, which opens the no-sauce affordance. Every state below is reached
 * by real operations (Dex, Research, cooking gestures, Pizza Select); only the starting save is seeded.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);

/** Aussie is the lone entry: the onion step's other two recipes are found. */
const FOUND = [...keysBefore(12), "pizza-portuguesa", "brazilian-calabresa"];

const saveJson = (found: readonly string[] = FOUND, ledger: readonly string[] = []) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: found.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...materialsUpTo(12)],
    missionBest: {},
    inventory: Object.fromEntries(materialsUpTo(12).map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materialsUpTo(12),
    discoveredTechniqueIds: [...ledger],
  });

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const FREE_BAKE = { start: 58, end: 78 };
const NAME = "ソースなし";
const AUSSIE = "オージーピザ";

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
const savedLedger = (page: Page) =>
  page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").discoveredTechniqueIds ?? []) as string[], SAVE_KEY);

interface Cook {
  /** Optional sauce chip (omitted = the SAUCE step is simply confirmed with nothing on the dough). */
  sauce?: RegExp;
  cheese?: [RegExp, number][];
  toppings: [RegExp, number][];
}
/** PREPARE already open: dough -> sauce (skipped) -> cheese -> toppings -> bake (inside the Free Cooking window) -> RESULT. */
async function cookPrepared(page: Page, { sauce, cheese, toppings }: Cook) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  expect(sauce, "these scenarios never use a sauce").toBeUndefined();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // the SAUCE step, left empty
  let spot = 0;
  for (const [name, count] of cheese ?? []) {
    await page.locator(".ingredient-chip").filter({ hasText: name }).first().click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // CHEESE step
  for (const [name, count] of toppings) {
    const chip = await chipOnTrayOrPin(page, name);
    await chip.click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}
const EXACT_AUSSIE: Cook = { cheese: [[/モッツァレラ/, 2]], toppings: [[/ベーコン/, 2], [/たまご/, 1], [/たまねぎ/, 2]] };
const NOT_AUSSIE: Cook = { cheese: [[/モッツァレラ/, 2]], toppings: [[/たまご/, 1]] };

/** The RESULT text with the technique stage taken out: the technique's name may appear only there. */
const withoutTechniqueBlock = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector(".result-panel");
    if (!root) return "";
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-technique-reveal]").forEach((e) => e.remove());
    return clone.textContent ?? "";
  });

/** Dex -> the anonymous Research card -> its research CTA. */
async function researchTheEntry(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: "？？？ピザを研究する" }).click();
  await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
}

test.describe("TQ-1D: Aussie and the Technique 「ソースなし」", () => {
  test.setTimeout(480_000);

  test("usage path: the Dex shows only 「？？？」 + riddle; a sauce-free pizza reveals the technique; then Aussie itself is discovered; the Dex names it", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    await open(page, saveJson());
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/14\/32/);
    await hold(page);

    // 1. Dex before: the technique is undiscovered but its affordance is open -> 「？？？」 + the fixed riddle, never the name.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    const section = page.locator("[data-dex-techniques]");
    await expect(section).toBeVisible();
    const locked = section.locator('[data-technique-state="RIDDLE"]');
    await expect(locked).toHaveCount(1);
    await expect(locked).toContainText("？？？");
    await expect(locked).toContainText("いつもの“ぬるもの”がなくても…？");
    await expect(page.locator(".dex-overlay")).not.toContainText(NAME);
    await expect(page.locator(".dex-overlay")).not.toContainText(AUSSIE);
    await expect(page.locator(".dex-overlay__research .dex-research-card")).toHaveCount(1); // Aussie: anonymous like any entry
    await expectNoUndiscoveredIdentity(page, FOUND, "Dex before the technique");
    await noOverflow(page, "Dex before");
    await section.scrollIntoViewIfNeeded();
    await capture(page, "tq1d-01-dex-riddle", project);
    await hold(page, 2500);

    // 2. Research the entry; a sauce-free pizza that is NOT Aussie: ORIGINAL + the technique stage; the rows have no sauce row.
    await page.locator(".dex-overlay__research").getByRole("button", { name: "？？？ピザを研究する" }).click();
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
    await cookPrepared(page, NOT_AUSSIE);
    const original = page.locator(".result-panel--original");
    await expect(original).toBeVisible();
    const reveal = page.locator("[data-technique-reveal]");
    await expect(reveal).toHaveCount(1);
    await expect(reveal).toContainText("新しい調理法を発見！");
    await expect(reveal).toContainText(`「${NAME}」`);
    const rows = page.getByTestId("research-rows");
    await expect(rows).toBeVisible();
    const chips = (await rows.locator("li").allTextContents()).map((t) => t.replace(/\s+/g, ""));
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) expect(c, `row ${c}`).not.toMatch(/ソース|なし|不要/); // no sauce row, no absence wording in any row
    expect(await rows.locator("h4, h3, [data-research-category]").allTextContents().then((t) => t.join("|"))).not.toMatch(/ソース/);
    await expectNoUndiscoveredIdentity(page, FOUND, "technique reveal RESULT");
    await noOverflow(page, "technique reveal RESULT");
    await capture(page, "tq1d-02-result-technique-original", project);
    await hold(page, 3000);
    expect(await savedLedger(page)).toEqual(["no-sauce"]);

    // 3. The Notebook's feedback line never states an absence.
    await original.getByRole("button", { name: /試作ノート/ }).click();
    const notebook = page.locator("[data-trial-notebook]");
    await expect(notebook).toBeVisible();
    const feedback = await notebook.locator("[data-trial-entry]").first().innerText();
    expect(feedback).not.toMatch(/ソースなし|ソース不要|ソース：なし/);
    await expectNoUndiscoveredIdentity(page, FOUND, "Notebook");
    await capture(page, "tq1d-03-notebook", project);
    await hold(page, 2000);
    await notebook.getByRole("button", { name: /結果にもどる/ }).click();

    // 4. The exact Aussie: a NEW recipe, the technique is already known (no second reveal), and no sauce row on the result.
    await original.getByRole("button", { name: /もう一度試す/ }).click();
    await cookPrepared(page, EXACT_AUSSIE);
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText(AUSSIE);
    await expect(page.locator("[data-technique-reveal]")).toHaveCount(0);
    const barLabels = await page.locator(".score-bar__label").allTextContents();
    expect(barLabels).toEqual(["具材", "配置", "焼き"]); // no ソース row, no zero-point sauce row
    expect(await withoutTechniqueBlock(page)).not.toMatch(/ソース\s*[：:]?\s*なし|ソース不要/);
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "tq1d-04-result-new-recipe-aussie", project);
    await hold(page, 3000);

    // 5. Dex after: the technique's name, and Aussie's card (Chapter 2 No.11) with no sauce among its ingredients.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    const known = page.locator('[data-dex-techniques] [data-technique-state="DISCOVERED"]');
    await expect(known).toHaveCount(1);
    await expect(known).toContainText(NAME);
    await expect(page.locator("[data-dex-techniques]")).not.toContainText("いつもの“ぬるもの”がなくても");
    const card = page.locator(".dex-card").filter({ hasText: AUSSIE });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("No.11");
    await expect(card.locator(".dex-card__ingredient")).toHaveCount(4);
    await expect(card.locator(".dex-card__ingredient").filter({ hasText: /ソース|オイル/ })).toHaveCount(0);
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: "第2章" })).toContainText("/11"); // chapter 2 now has 11 slots
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex after");
    await capture(page, "tq1d-05-dex-technique-and-aussie", project);
    await hold(page, 3000);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain("aussie");
    expect(errors).toEqual([]);
  });

  test("recipe path: discovering Aussie first reveals the technique BEFORE the recipe, once; no 「ソース：なし」 row anywhere", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    await open(page, saveJson());
    await researchTheEntry(page);
    await cookPrepared(page, EXACT_AUSSIE);
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText(AUSSIE);
    const reveal = page.locator("[data-technique-reveal]");
    await expect(reveal).toHaveCount(1);
    await expect(reveal).toContainText(`「${NAME}」`);
    // ① Technique, then ② Recipe: the technique block comes first in the document.
    const order = await page.evaluate(() => {
      const t = document.querySelector("[data-technique-reveal]");
      const r = document.querySelector(".discovered-banner--new-pizza");
      return t && r ? Boolean(t.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
    });
    expect(order).toBe(true);
    expect(await page.locator(".score-bar__label").allTextContents()).toEqual(["具材", "配置", "焼き"]);
    // The name appears only inside the technique stage; nowhere else on the result (no row, no line).
    expect(await withoutTechniqueBlock(page)).not.toMatch(/ソース\s*[：:]?\s*なし|ソース不要/);
    await noOverflow(page, "technique then recipe");
    await capture(page, "tq1d-06-result-technique-then-recipe", project);
    await hold(page, 3000);
    expect(await savedLedger(page)).toEqual(["no-sauce"]);
    expect(errors).toEqual([]);
  });

  test("before the affordance (11 credited recipes): no technique section, and a sauce-free pizza reveals nothing", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    // The seven first W1 key recipes: far from the onion step, so Aussie is not a Research Entry and the affordance is closed.
    const early = keysBefore(7);
    await open(page, JSON.stringify({
      schemaVersion: 2,
      dex: early.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 999,
      ownedIngredientIds: [...STARTERS, ...materialsUpTo(6)],
      missionBest: {},
      inventory: Object.fromEntries(materialsUpTo(6).map((m) => [m, 30])),
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: materialsUpTo(7),
      discoveredTechniqueIds: [],
    }));
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator("[data-dex-techniques]")).toHaveCount(0);
    await expect(page.locator(".dex-overlay")).not.toContainText(/調理法|ソースなし/);
    await capture(page, "tq1d-07-dex-before-affordance", project);
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.getByRole("button", { name: /レシピ発見/ }).first().click();
    await page.waitForSelector(".pizza-stage");
    await cookPrepared(page, { cheese: [[/モッツァレラ/, 2]], toppings: [] });
    await expect(page.locator(".result-panel")).toBeVisible();
    await expect(page.locator("[data-technique-reveal]")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(/ソースなし|調理法/);
    expect(await savedLedger(page)).toEqual([]);
    await capture(page, "tq1d-08-result-no-technique-yet", project);
    expect(errors).toEqual([]);
  });

  test("guided Aussie (after discovery): no SAUCE step and a Reference preview without any sauce", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    await open(page, saveJson([...FOUND, "aussie"], ["no-sauce"]));
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await page.getByRole("button", { name: new RegExp(`${AUSSIE}、`) }).click();
    await capture(page, "tq1d-09-pizza-select-aussie", project);
    await page.getByRole("button", { name: /このピザを作る/ }).click();
    await page.waitForSelector(".pizza-stage");
    // Steps derive from the recipe's own categories: DOUGH -> CHEESE -> TOPPING (no ソース tab, no SAUCE step).
    await expect(page.getByRole("tab", { name: "生地" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "チーズ" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "具材" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "ソース" })).toHaveCount(0);
    // The Reference popover: pieces only, no sauce caption / bars / heatmap.
    await page.locator(".mini-reference").first().click();
    const preview = page.locator(".reference-preview, .reference-preview__popover, [role=dialog]").first();
    await expect(page.locator(".reference-mini-pizza")).toBeVisible();
    await expect(page.locator(".reference-mini-pizza__sauce")).toHaveCount(0);
    await expect(page.locator(".reference-preview__bar-row")).toHaveCount(0);
    expect(await page.locator(".reference-preview__caption").innerText()).not.toMatch(/ソース|塗/);
    void preview;
    await noOverflow(page, "guided Aussie");
    await capture(page, "tq1d-10-guided-aussie-reference", project);
    expect(errors).toEqual([]);
  });
});
