import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Expansion Wave 2 (vongole / pesto-vegetariana / ratatouille-pizza; parsley at ladder step 27, bell-pepper + zucchini at
 * step 28), played for real on both iPhone widths.
 *
 * Saves: each scenario starts from the credited recipes found up to the previous step (and the non-credit calabresa), every
 * earlier material owned and stocked, 999 Pitz. The newest step is reached, so its materials are entitled but not bought.
 * Every game state below is reached by real operations (Shop purchase, Pantry pin, Research, trials, Hint purchases); only
 * the starting save is seeded.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);

const saveJson = (step: number, bought: readonly string[] = []) => {
  const discovered = [...keysBefore(step), "brazilian-calabresa"];
  const owned = [...materialsUpTo(step - 1), ...bought];
  return JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, bought.includes(m) ? 0 : 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materialsUpTo(step),
  });
};

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];

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

interface Cook {
  sauce: RegExp;
  cheese?: [RegExp, number][];
  toppings: [RegExp, number][];
  bake: { start: number; end: number };
}
/** PREPARE already open: dough -> sauce -> (cheese | none) -> toppings (count each) -> bake -> RESULT. */
async function cookPrepared(page: Page, { sauce, cheese, toppings, bake }: Cook) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: sauce }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  let spot = 0;
  if (cheese) {
    for (const [name, count] of cheese) {
      await page.locator(".ingredient-chip").filter({ hasText: name }).first().click();
      for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
    }
  }
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // CHEESE step (empty when the recipe has no cheese)
  for (const [name, count] of toppings) {
    const chip = await chipOnTrayOrPin(page, name);
    await chip.click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  await bakeToTarget(page, bake);
  await page.waitForSelector(".result-panel");
}

/** Shop: the material row is NEW with its glyph, T3 first pack 100 Pitz / 20 pieces, then bought. */
async function buyInShop(page: Page, project: string, id: string, glyph: string, nameJa: string, shot: string) {
  const row = page.locator(`.shop-item[data-ingredient-id="${id}"]`);
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-shop-state", "NEW");
  await expect(row).toContainText(nameJa);
  await expect(row).toContainText(glyph);
  await expect(row).toContainText("10ピザ分（20個）");
  await expect(row).toContainText(/初回 .*100 Pitz/);
  await row.scrollIntoViewIfNeeded();
  await noOverflow(page, `shop NEW ${id}`);
  await capture(page, `${shot}-new`, project);
  await hold(page, 2200);
  await row.locator(".shop-item__buy-button").click();
  await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
  await expect(row).toContainText("在庫 20");
}

/** The Hint 5.0 sheet, opened from RESULT: key-free (no KEY_TOPPING rung), paged to its end. */
async function openHint(page: Page, result: ReturnType<Page["locator"]>) {
  await result.getByRole("button", { name: /ヒント/ }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
  await hold(page, 1500);
  for (let i = 0; i < 7; i += 1) {
    const next = dialog.locator(".hint-sheet__h5-next .hint-sheet__next");
    if (!(await next.count())) break;
    await next.click();
    await hold(page, 700);
  }
  await expect(dialog.locator('[data-hint5-rung="KEY_TOPPING"], [data-hint5-next="KEY_TOPPING"]')).toHaveCount(0);
  return dialog;
}

test.describe("Expansion Wave 2", () => {
  test.setTimeout(480_000);

  test("step 27: Shop NEW parsley -> purchase -> Research vongole -> RESULT -> Notebook -> Hint5 (olive-oil SAUCE rung) -> discovery -> Dex No.13", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const DISCOVERED = [...keysBefore(27), "brazilian-calabresa"];
    await open(page, saveJson(27));
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/28\/31/);
    await hold(page);

    // 1. Shop: parsley ☘️ is NEW, then bought (finite T3 material, 20 pieces).
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    await buyInShop(page, project, "parsley", "☘️", "パセリ", "exp2-shop-parsley");
    await capture(page, "exp2-shop-parsley-bought", project);
    await hold(page, 2200);
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex -> the one Research Entry -> Research Target.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay__research .dex-research-card")).toHaveCount(1);
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Dex Research Entry");
    await capture(page, "exp2-research-entry-vongole", project);
    await hold(page, 2000);
    await page.locator(".dex-overlay__research").getByRole("button", { name: "？？？ピザを研究する" }).click();
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");

    // 3. A real trial: olive-oil + parsley + clam + eggplant (an eggplant is not part of vongole).
    await cookPrepared(page, {
      sauce: /オリーブオイル/,
      toppings: [[/パセリ/, 1], [/あさり/, 1], [/ナス/, 1]],
      bake: { start: 62, end: 82 },
    });
    // The parsley piece is a green herb: its roast tint is the gentle (bakeRoastResistant) curve, softer than the clam's.
    const sepiaOf = (cls: string) =>
      page.evaluate((c) => {
        const el = document.querySelector<HTMLElement>(`.pizza-topping--${c} [style*="filter"]`);
        const m = el?.style.filter.match(/sepia\(([0-9.]+)\)/);
        return m ? Number(m[1]) : null;
      }, cls);
    const parsleySepia = await sepiaOf("parsley");
    const clamSepia = await sepiaOf("clam");
    if (parsleySepia !== null && clamSepia !== null) expect(parsleySepia).toBeLessThanOrEqual(clamSepia);
    const result = page.locator(".result-panel--original");
    await expect(result).toBeVisible();
    const rows = page.getByTestId("research-rows");
    await expect(rows).toBeVisible();
    const chips = (await rows.locator("li").allTextContents()).map((t) => t.replace(/\s+/g, ""));
    expect(chips.some((c) => /ナス×$/.test(c)), `chips ${JSON.stringify(chips)}`).toBe(true);
    expect(chips.some((c) => /あさり○$/.test(c)), `chips ${JSON.stringify(chips)}`).toBe(true);
    expect(chips.some((c) => /オリーブオイル.*○$/.test(c)), `chips ${JSON.stringify(chips)}`).toBe(true);
    await expect(result.getByRole("list", { name: "使った材料" }).getByRole("listitem").filter({ hasText: "パセリ" })).toContainText("✓");
    const resultText = await page.locator("body").innerText();
    expect(resultText).not.toMatch(/チーズなし|ソースなし|ヴォンゴレ|一致しません|不一致|正解|あと[0-9０-９]|残り|おしい|近い|遠い|類似|距離|候補/);
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Research RESULT");
    await noOverflow(page, "research RESULT");
    await capture(page, "exp2-vongole-result-research-mark", project);
    await hold(page, 3000);

    // 4. Trial Notebook.
    await result.getByRole("button", { name: /試作ノート/ }).click();
    const notebook = page.locator("[data-trial-notebook]");
    await expect(notebook).toBeVisible();
    await expect(notebook.locator("[data-trial-entry]")).toHaveCount(1);
    await expect(notebook.locator("[data-trial-entry]")).toContainText("パセリ");
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Notebook");
    await noOverflow(page, "notebook");
    await capture(page, "exp2-vongole-notebook", project);
    await hold(page, 2000);
    await notebook.getByRole("button", { name: /結果にもどる/ }).click();

    // 5. Hint 5.0: key-free; the SAUCE rung shows vongole's own olive-oil sauce slot (no "no-sauce" wording).
    const dialog = await openHint(page, result);
    const sauceRung = dialog.locator('[data-hint5-rung="SAUCE"]');
    await expect(sauceRung).toContainText("オリーブオイル");
    const dialogText = await dialog.innerText();
    expect(dialogText).not.toMatch(/ヴォンゴレ|候補|距離|似て|近い|遠い|チーズなし|ソースなし/);
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Hint sheet");
    await noOverflow(page, "hint sheet");
    await capture(page, "exp2-vongole-hint5-sauce-rung", project);
    await hold(page, 3000);
    await dialog.getByRole("button", { name: "閉じる" }).click();

    // 6. The exact recipe: olive-oil 1, clam 3, garlic 2, parsley 2, no cheese -> NEW RECIPE.
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
    await cookPrepared(page, {
      sauce: /オリーブオイル/,
      toppings: [[/あさり/, 3], [/にんにく/, 2], [/パセリ/, 2]],
      bake: { start: 62, end: 82 },
    });
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ヴォンゴレピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "exp2-vongole-new-recipe-discovered", project);
    await hold(page, 3000);

    // 7. Dex: Chapter 3 No.13; schema v2 unchanged.
    await page.getByRole("button", { name: /図鑑を見る/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(/29\s*\/\s*31/);
    const card = page.locator(".dex-card").filter({ hasText: "ヴォンゴレピザ" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("No.13");
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "exp2-dex-no13", project);
    await hold(page, 3000);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain("vongole");
    expect(errors).toEqual([]);
  });

  test("step 28: bell-pepper + zucchini NEW together -> purchase -> Research Entry pool 2 -> target -> RESULT -> Notebook -> Hint -> discovery -> remaining target -> discovery", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const found = [...keysBefore(28), "brazilian-calabresa"];
    await open(page, saveJson(28));
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/29\/31/);
    await hold(page);

    // 1. Shop: both materials are NEW at once, then bought.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    await buyInShop(page, project, "bell-pepper", "🫑", "パプリカ", "exp2-shop-bell-pepper");
    await buyInShop(page, project, "zucchini", "🥒", "ズッキーニ", "exp2-shop-zucchini");
    await capture(page, "exp2-shop-step28-bought", project);
    await hold(page, 2200);
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Dex: Research Entry pool 2 -- two anonymous cards, no count, no identity, no aggregate card.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator("[data-dex-aggregated]")).toHaveCount(0);
    const research = page.locator(".dex-overlay__research");
    await expect(research.locator(".dex-research-card")).toHaveCount(2);
    await expect(research).not.toContainText(/[0-9]/);
    await expectNoUndiscoveredIdentity(page, found, "Dex Research Entries (pool 2)");
    await noOverflow(page, "Dex pool 2");
    await research.scrollIntoViewIfNeeded();
    await capture(page, "exp2-pool2-research-cards", project);
    await hold(page, 2200);

    // 3. Target selection: the player picks one anonymous card.
    await research.getByRole("button", { name: "？？？ピザを研究する" }).first().click();
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");

    // 4. A real trial (pesto + eggplant + zucchini + bell-pepper; no cheese, no oregano -- identifies neither recipe).
    const veg: Cook = {
      sauce: /ジェノベーゼ|ペスト/,
      toppings: [[/ナス/, 2], [/ズッキーニ/, 2], [/パプリカ/, 2]],
      bake: { start: 50, end: 70 },
    };
    await cookPrepared(page, veg);
    const result = page.locator(".result-panel--original");
    await expect(result).toBeVisible();
    const rows = page.getByTestId("research-rows");
    await expect(rows).toBeVisible();
    const resultText = await page.locator("body").innerText();
    expect(resultText).not.toMatch(/チーズなし|ソースなし|ペストベジタリアーナ|ラタトゥイユ|一致しません|不一致|正解|あと[0-9０-９]|残り|おしい|近い|遠い|類似|距離|候補/);
    await expectNoUndiscoveredIdentity(page, found, "Research RESULT");
    await noOverflow(page, "research RESULT");
    await capture(page, "exp2-pool2-result-research-mark", project);
    await hold(page, 3000);

    // 5. Trial Notebook.
    await result.getByRole("button", { name: /試作ノート/ }).click();
    const notebook = page.locator("[data-trial-notebook]");
    await expect(notebook).toBeVisible();
    await expect(notebook.locator("[data-trial-entry]")).toHaveCount(1);
    await expectNoUndiscoveredIdentity(page, found, "Notebook");
    await noOverflow(page, "notebook");
    await capture(page, "exp2-pool2-notebook", project);
    await hold(page, 2000);
    await notebook.getByRole("button", { name: /結果にもどる/ }).click();

    // 6. Hint 5.0 for the selected target: key-free, names no recipe (Contract 2.1 privacy).
    const dialog = await openHint(page, result);
    const dialogText = await dialog.innerText();
    expect(dialogText).not.toMatch(/ペストベジタリアーナ|ラタトゥイユ|候補|距離|似て|近い|遠い|チーズなし|ソースなし/);
    await expectNoUndiscoveredIdentity(page, found, "Hint sheet");
    await noOverflow(page, "hint sheet");
    await capture(page, "exp2-pool2-hint5", project);
    await hold(page, 3000);
    await dialog.getByRole("button", { name: "閉じる" }).click();

    // 7. Discover pesto-vegetariana (pesto 1, mozzarella 2, eggplant 2, zucchini 2, bell-pepper 2).
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
    await cookPrepared(page, { ...veg, cheese: [[/モッツァレラ/, 2]], toppings: veg.toppings });
    const first = page.locator(".result-panel--discovery");
    await expect(first).toBeVisible();
    await expect(first).toContainText("ペストベジタリアーナピザ");
    await noOverflow(page, "NEW RECIPE (pesto-vegetariana)");
    await capture(page, "exp2-pool2-new-recipe-pesto-vegetariana", project);
    await hold(page, 3000);

    // 8. The remaining target (ratatouille-pizza) is still a Research Entry: research it and discover it.
    await page.getByRole("button", { name: /次のピザを研究する|図鑑を見る/ }).first().click();
    if (!(await page.locator(".dex-overlay").count())) await page.waitForSelector(".dex-overlay");
    const remaining = page.locator(".dex-overlay__research");
    await expect(remaining.locator(".dex-research-card")).toHaveCount(1);
    await remaining.getByRole("button", { name: "？？？ピザを研究する" }).click();
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
    await cookPrepared(page, {
      sauce: /トマトソース/,
      toppings: [[/ナス/, 2], [/ズッキーニ/, 2], [/パプリカ/, 2], [/オレガノ/, 1]],
      bake: { start: 58, end: 78 },
    });
    const second = page.locator(".result-panel--discovery");
    await expect(second).toBeVisible();
    await expect(second).toContainText("ラタトゥイユピザ");
    await noOverflow(page, "NEW RECIPE (ratatouille-pizza)");
    await capture(page, "exp2-pool2-new-recipe-ratatouille", project);
    await hold(page, 3000);

    // 9. Dex: Chapter 3 No.14 / No.15, 31 / 31; schema v2 unchanged.
    await page.getByRole("button", { name: /図鑑を見る/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(/31\s*\/\s*31/);
    for (const [name, no] of [["ペストベジタリアーナピザ", "No.14"], ["ラタトゥイユピザ", "No.15"]]) {
      const card = page.locator(".dex-card").filter({ hasText: name });
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(no);
    }
    await expect(page.locator(".dex-overlay__chapter-title").last()).toContainText("15/15");
    await page.locator(".dex-card").filter({ hasText: "ラタトゥイユピザ" }).scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "exp2-dex-no14-15", project);
    await hold(page, 3000);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toEqual(expect.arrayContaining(["pesto-vegetariana", "ratatouille-pizza"]));
    expect(errors).toEqual([]);
  });

  test("#378: parsley owned with stock 0 -> stock-blocked Research card -> Shop (在庫なし) -> refill -> Research resumes", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await open(page, saveJson(27, ["parsley"]));
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    const section = page.locator(".dex-overlay__research");
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator(".dex-card__research-stock-notice")).toHaveText("研究を続けるには材料の補充が必要");
    await expect(section.getByRole("button", { name: /研究する/ })).toHaveCount(0);
    const text = (await section.textContent()) ?? "";
    expect(text).not.toMatch(/ヴォンゴレ|あさり|オリーブ|No\.|あと|残り|不足|種類|\d/);
    await noOverflow(page, "Dex stock-blocked");
    await capture(page, "exp2-378-dex-stock-blocked", project);
    await hold(page, 2500);

    await section.getByRole("button", { name: /ショップで補充する/ }).click();
    const shop = page.locator(".shop-overlay__panel");
    await expect(shop).toBeVisible();
    const row = shop.locator('[data-ingredient-id="parsley"]');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toContainText("在庫なし");
    await noOverflow(page, "Shop zero stock");
    await capture(page, "exp2-378-shop-zero-stock", project);
    await hold(page, 2500);
    await row.getByRole("button", { name: "補充する" }).click();
    await expect(row).not.toContainText("在庫なし");
    await shop.getByRole("button", { name: "閉じる" }).click();
    await expect(shop).toHaveCount(0);
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("button", { name: /を研究する/ })).toBeVisible();
    await expect(section.locator(".dex-card__research-stock-notice")).toHaveCount(0);
    await capture(page, "exp2-378-research-resumed", project);
  });
});
