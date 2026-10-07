import { expectResearchLead } from "./support/hintNote";
import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { materialsUpTo, CATALOG_COUNTS } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Expansion Slice 1 (pesto-gamberi + shrimp, appended ladder step 26), played for real on both iPhone widths.
 *
 * Save: the 26 credited recipes (W1 + pesto-pollo) and the non-credit calabresa found, every material up to step 25 owned and
 * stocked, 999 Pitz. Step 26 is reached, so `shrimp` is entitled but not bought; pesto-gamberi is the single Research Entry.
 * Every game state below is reached by real operations (Shop purchase, Pantry pin, Research, trials, Hint purchases); only the
 * starting save is seeded.
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 50, end: 70 };
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];

const DISCOVERED = [...keysBefore(27), "brazilian-calabresa", "aussie"].filter((id) => id !== "pesto-gamberi");
const OWNED_BEFORE = materialsUpTo(25);
const UNLOCKED = materialsUpTo(26);

const saveJson = (opts: { shrimpOwnedStock?: number } = {}) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: DISCOVERED.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...OWNED_BEFORE, ...(opts.shrimpOwnedStock !== undefined ? ["shrimp"] : [])],
    missionBest: {},
    inventory: { ...Object.fromEntries(OWNED_BEFORE.map((m) => [m, 30])), ...(opts.shrimpOwnedStock !== undefined ? { shrimp: opts.shrimpOwnedStock } : {}) },
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: UNLOCKED,
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

interface Cook {
  toppings: [RegExp, number][];
}
/** PREPARE already open: dough -> pesto -> no cheese -> toppings (count each) -> bake -> RESULT. */
async function cookPrepared(page: Page, { toppings }: Cook) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /ジェノベーゼ|ペスト/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // no cheese
  const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36]];
  let spot = 0;
  for (const [name, count] of toppings) {
    const chip = await chipOnTrayOrPin(page, name);
    await chip.click();
    for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

test.describe("Expansion Slice 1: pesto-gamberi + shrimp", () => {
  test.setTimeout(420_000);

  test("Shop -> Inventory -> Pantry pin -> Research Entry / Target -> RESULT ○/× -> Notebook -> Hint 5.0 -> exact recipe -> Dex", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    await open(page, saveJson());
    await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`28/${CATALOG_COUNTS.recipes}`));
    await hold(page);

    // 1. Shop: shrimp is NEW (T3: first pack 100 Pitz, 30 pieces), then bought.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const shrimp = page.locator('.shop-item[data-ingredient-id="shrimp"]');
    await expect(shrimp).toHaveCount(1);
    await expect(shrimp).toHaveAttribute("data-shop-state", "NEW");
    await expect(shrimp).toContainText("エビ");
    await expect(shrimp).toContainText("🦐");
    await expect(shrimp).toContainText("10ピザ分（30個）");
    await expect(shrimp).toContainText(/初回 .*100 Pitz/);
    await shrimp.scrollIntoViewIfNeeded();
    await noOverflow(page, "shop NEW");
    await capture(page, "exp1-shop-shrimp-new", project);
    await hold(page, 2200);
    await shrimp.locator(".shop-item__buy-button").click();
    await expect(shrimp).not.toHaveAttribute("data-shop-state", "NEW");
    await expect(shrimp).toContainText("在庫 30");
    await capture(page, "exp1-shop-shrimp-bought", project);
    await hold(page, 2200);
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);

    // 2. Inventory: shrimp is listed as an individual ingredient (🦐), seafood shelf.
    await page.getByRole("button", { name: /材料/ }).click();
    await page.waitForSelector(".inventory-overlay__panel");
    const invRow = page.locator(".inventory-overlay__panel").getByText("エビ").first();
    await invRow.scrollIntoViewIfNeeded();
    await expect(invRow).toBeVisible();
    await expect(page.locator(".inventory-overlay__panel")).toContainText("🦐");
    await noOverflow(page, "inventory");
    await capture(page, "exp1-inventory-shrimp", project);
    await hold(page, 2200);
    await page.locator(".inventory-overlay__panel").getByRole("button", { name: "閉じる" }).click();

    // 3. Dex -> Research Entry -> Research Target.
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay__research .dex-research-card")).toHaveCount(1);
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Dex Research Entry");
    await capture(page, "exp1-research-entry", project);
    await hold(page, 2000);
    await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
    await expectResearchLead(page, "？？？ピザ");

    // 4. A real trial: pesto + shrimp (HAND/pin via the Pantry when it is not in the 12-slot hand) + eggplant + tomato.
    await cookPrepared(page, { toppings: [[/エビ/, 1], [/ナス/, 1], [/(?<!チェリー)トマト(?!ソース)/, 1]] });
    const result = page.locator(".result-panel--original");
    await expect(result).toBeVisible();
    const rows = page.getByTestId("research-rows");
    await expect(rows).toBeVisible();
    const chips = (await rows.locator("li").allTextContents()).map((t) => t.replace(/\s+/g, ""));
    expect(chips.some((c) => /ナス×$/.test(c)), `chips ${JSON.stringify(chips)}`).toBe(true);
    expect(chips.some((c) => /トマト○$/.test(c)), `chips ${JSON.stringify(chips)}`).toBe(true);
    expect(chips.some((c) => /ジェノベーゼ.*○$/.test(c)), `chips ${JSON.stringify(chips)}`).toBe(true);
    // The unlock fact (shrimp) is carried as known (✓), never as a hidden-recipe ○/×; nothing says "no cheese".
    await expect(result.getByRole("list", { name: "使った材料" }).getByRole("listitem").filter({ hasText: "エビ" })).toContainText("✓");
    const resultText = await page.locator("body").innerText();
    expect(resultText).not.toMatch(/チーズなし|ソースなし|ペストガンベリ|一致しません|不一致|正解|あと[0-9０-９]|残り|おしい|近い|遠い|類似|距離|候補/);
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Research RESULT");
    await noOverflow(page, "research RESULT");
    await capture(page, "exp1-result-research-mark", project);
    await hold(page, 3000);

    // 5. Trial Notebook.
    await result.getByRole("button", { name: /試作ノート/ }).click();
    const notebook = page.locator("[data-trial-notebook]");
    await expect(notebook).toBeVisible();
    await expect(notebook.locator("[data-trial-entry]")).toHaveCount(1);
    await expect(notebook.locator("[data-trial-entry]")).toContainText("エビ");
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Notebook");
    await noOverflow(page, "notebook");
    await capture(page, "exp1-notebook", project);
    await hold(page, 2000);
    await notebook.getByRole("button", { name: /結果にもどる/ }).click();

    // 6. Hint 5.0: key-free (no KEY_TOPPING rung), seafood class = 🌊 魚介系 (never the shrimp glyph).
    await result.getByRole("button", { name: /ヒント/ }).click();
    const dialog = page.getByRole("dialog", { name: /ヒント/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    await hold(page, 1500);
    for (let i = 0; i < 6; i += 1) {
      const next = dialog.locator(".hint-sheet__h5-next .hint-sheet__next");
      if (!(await next.count())) break;
      await next.click();
      await hold(page, 700);
    }
    await expect(dialog.locator('[data-hint5-rung="KEY_TOPPING"], [data-hint5-next="KEY_TOPPING"]')).toHaveCount(0);
    const subClass = dialog.locator('[data-hint5-rung="SUB_CLASS"]');
    const subText = (await subClass.allTextContents()).join(" | ");
    expect(subText).toContain("🌊");
    expect(subText).toContain("魚介系");
    expect(subText).not.toContain("🦐");
    const dialogText = await dialog.innerText();
    expect(dialogText).not.toMatch(/ペストガンベリ|候補|距離|似て|近い|遠い|チーズなし|ソースなし/);
    await expectNoUndiscoveredIdentity(page, DISCOVERED, "Hint sheet");
    await noOverflow(page, "hint sheet");
    await capture(page, "exp1-hint5-seafood-class", project);
    await hold(page, 3000);
    await dialog.getByRole("button", { name: "閉じる" }).click();

    // 7. The exact recipe: pesto 1, tomato 2, garlic 2, shrimp 3, no cheese -> NEW RECIPE.
    await expectResearchLead(page, "？？？ピザ");
    await cookPrepared(page, {
      toppings: [[/(?<!チェリー)トマト(?!ソース)/, 2], [/にんにく/, 2], [/エビ/, 3]],
    });
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("ペストガンベリピザ");
    await noOverflow(page, "NEW RECIPE");
    await capture(page, "exp1-new-recipe-discovered", project);
    await hold(page, 3000);

    // 8. Dex: Chapter 3 No.12; schema v2 unchanged. (Expansion Wave 2: this discovery reaches step 27, so the RESULT
    // announces the new material (parsley) and its CTA is the Shop; the Dex is opened from HOME, as in the No.27 spec.)
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    await expect(page.locator(".dex-overlay")).toContainText(new RegExp(`29\\s*/\\s*${CATALOG_COUNTS.recipes}`));
    const card = page.locator(".dex-card").filter({ hasText: "ペストガンベリピザ" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("No.12");
    await expect(page.locator(".dex-overlay__chapter-title").filter({ hasText: "第3章" })).toContainText("12/16");
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "exp1-dex-no12", project);
    await hold(page, 3000);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain("pesto-gamberi");
    expect(errors).toEqual([]);
  });

  test("#378: shrimp owned with stock 0 -> stock-blocked Research card -> Shop (在庫なし) -> refill -> Research resumes", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await open(page, saveJson({ shrimpOwnedStock: 0 }));
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    const section = page.locator(".dex-overlay__research");
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator(".dex-card__research-stock-notice")).toHaveText("研究を続けるには材料の補充が必要");
    await expect(section.getByRole("button", { name: /研究する/ })).toHaveCount(0);
    const text = (await section.textContent()) ?? "";
    // The card carries only the player's own known fact (the shrimp they unlocked, as on every Research Entry) and the fixed
    // notice: no hidden recipe name, no required-ingredient list / count, no number, no remaining / shortage wording.
    expect(text).not.toMatch(/ペスト|ガンベリ|ジェノベーゼ|トマト|にんにく|ニンニク|No\.|あと|残り|不足|種類|\d/);
    expect(text).toContain("研究を続けるには材料の補充が必要");
    await noOverflow(page, "Dex stock-blocked");
    await capture(page, "exp1-378-dex-stock-blocked", project);
    await hold(page, 2500);

    await section.getByRole("button", { name: /ショップで補充する/ }).click();
    const shop = page.locator(".shop-overlay__panel");
    await expect(shop).toBeVisible();
    const row = shop.locator('[data-ingredient-id="shrimp"]');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toContainText("在庫なし");
    await expect(shop.locator('[data-stock-state="EMPTY"]')).toHaveCount(1);
    await noOverflow(page, "Shop zero stock");
    await capture(page, "exp1-378-shop-zero-stock", project);
    await hold(page, 2500);

    await row.getByRole("button", { name: "補充する" }).click();
    await expect(row).not.toContainText("在庫なし");
    await shop.getByRole("button", { name: "閉じる" }).click();
    await expect(shop).toHaveCount(0);
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("button", { name: /を研究する/ })).toBeVisible();
    await expect(section.locator(".dex-card__research-stock-notice")).toHaveCount(0);
    await capture(page, "exp1-378-research-resumed", project);
    await section.getByRole("button", { name: /を研究する/ }).click();
    await expectResearchLead(page, "？？？ピザ");
    await hold(page, 2000);
  });
});
