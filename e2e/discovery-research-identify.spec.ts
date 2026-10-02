import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Issue #356 (Discovery 3.1) Slice 2: Correct Ingredient Identification, played for real on the Dex 25 ladder save with the
 * non-credit calabresa closed (pesto-pollo = pesto + mozzarella + fresh tomato + chicken is the single Research Entry,
 * chicken is its unlock fact).
 *   Dex card -> 研究する -> selector -> picker -> pick ジェノベーゼソース -> a pizza with it (+ chicken) -> RESULT
 *   「✓ ジェノベーゼソースを使う」 -> もう一度試す (selection cleared, the knowledge is on the research card) -> pick たまご
 *   (not in the recipe) -> RESULT 「たまごは特定できませんでした」 (nothing saved) -> reload (the positive stays, no selection).
 * Chromium 390×844 and 360×800. HV_SCREENSHOT_DIR (optional) writes the Human Verification screenshots.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);
const discovered = [...keysBefore(25), "brazilian-calabresa"];
const materials = materialsUpTo(25);
const SAVE = {
  schemaVersion: 2,
  dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
  missionBest: {},
  inventory: Object.fromEntries(materials.map((m) => [m, 30])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: materials,
};
const ORACLE = /一致しません|不一致|正解|不正解|✕|足りない|間違|残り|あと[0-9０-９]|おしい|かなり近|別の組み合わせ|新しく入荷|含まれていません|[0-9０-９]+\s*[/／]\s*[0-9０-９]+|[0-9０-９]+\s*[%％]/;
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function open(page: Page, flagOff = false) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value, off]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    if (off) localStorage.setItem("teto.dev.researchIdentify", "0");
  }, [SAVE_KEY, JSON.stringify(SAVE), flagOff ? "1" : ""] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

async function expectNoOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
}

async function expectInViewport(page: Page, locator: ReturnType<Page["locator"]>, where: string) {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x, `${where}: left`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${where}: right`).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height, `${where}: bottom`).toBeLessThanOrEqual(vp.height);
}

async function pickChip(page: Page, name: RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name }).first();
  const next = page.getByRole("button", { name: "次のページ" });
  const prev = page.getByRole("button", { name: "前のページ" });
  // the tray keeps its last page between picks: start from the first page
  for (let i = 0; i < 6 && (await prev.isEnabled().catch(() => false)); i += 1) await prev.click();
  for (let i = 0; i < 6 && !(await chip.isVisible()); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await chip.click();
}

async function startResearch(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: "？？？ピザを研究する" }).click();
  await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
}

async function pickTestIngredient(page: Page, name: string) {
  await page.getByTestId("research-test-button").click();
  const picker = page.getByTestId("research-test-picker");
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: new RegExp(name) }).first().click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByTestId("research-test-button")).toContainText(`今回の調査: ${name}`);
}

/** dough -> sauce (`sauce` chip) -> no cheese -> toppings (each tapped on the dough) -> bake. Ends on its RESULT. */
async function cook(page: Page, sauce: RegExp, toppings: { chip: RegExp; at: [number, number] }[]) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: sauce }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // no cheese
  for (const t of toppings) {
    await pickChip(page, t.chip);
    await tapDoughPercent(page, t.at[0], t.at[1]);
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

/** From an already-started BAKE (the clock was installed before 焼く！): pause virtual time, land the needle, take out. */
async function finishBake(page: Page) {
  await page.waitForSelector(".bake-gauge__needle");
  for (const buffer of [150, 500, 1500]) {
    try {
      await page.clock.pauseAt(Date.now() + buffer);
      break;
    } catch (error) {
      if (!String(error).includes("to the past")) throw error;
    }
  }
  await landNeedleAndTakeOut(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

const savedFacts = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").discoveryHintFacts ?? {}, SAVE_KEY);

test("PREPARE budget: the selector adds no row and no page overflow (flag ON vs the opt-out baseline)", async ({ page }) => {
  await open(page, true);
  await startResearch(page);
  await expect(page.getByTestId("research-test-button")).toHaveCount(0);
  const base = await page.evaluate(() => ({
    stage: document.querySelector(".pizza-stage")!.getBoundingClientRect().height,
    card: document.querySelector("[data-testid='research-context']")!.getBoundingClientRect().height,
  }));
  await open(page);
  await startResearch(page);
  await expect(page.getByTestId("research-test-button")).toBeVisible();
  const on = await page.evaluate(() => ({
    stage: document.querySelector(".pizza-stage")!.getBoundingClientRect().height,
    card: document.querySelector("[data-testid='research-context']")!.getBoundingClientRect().height,
  }));
  test.info().annotations.push({ type: "budget", description: JSON.stringify({ base, on }) });
  expect(on.card - base.card, "research card growth").toBeLessThanOrEqual(8);
  expect(base.stage - on.stage, "pizza stage shrink").toBeLessThanOrEqual(8);
  await expectNoOverflow(page, "PREPARE with selector");
  await expectInViewport(page, page.getByTestId("research-test-button"), "selector");
  await shot(page, "01-prepare-selector");
});

test("Research identification loop: pick -> trial -> RESULT -> positive knowledge -> retry (selection reset) -> negative -> reload", async ({ page }) => {
  test.setTimeout(480_000);
  await open(page);
  await startResearch(page);
  await expect(page.getByTestId("research-test-button")).toContainText("今回の調査をえらぶ");

  // Picker: owned ingredients only; the unlock fact is already known so it is not offered; nothing is highlighted.
  await page.getByTestId("research-test-button").click();
  const picker = page.getByTestId("research-test-picker");
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("button", { name: /チキン/ })).toHaveCount(0);
  await expect(picker.getByRole("button", { name: /ジェノベーゼソース/ })).toHaveCount(1);
  await expect(picker.locator(".pantry-tile__toggle[aria-pressed='true']")).toHaveCount(0);
  expect(await picker.innerText()).not.toMatch(ORACLE);
  await expectNoOverflow(page, "picker");
  await expectNoUndiscoveredIdentity(page, discovered, "picker");
  await expectInViewport(page, picker.getByRole("button", { name: "閉じる" }), "picker close");
  await shot(page, "02-picker");
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);

  // Attempt 1: declare ジェノベーゼソース, then use it (with the chicken) -> POSITIVE.
  await pickTestIngredient(page, "ジェノベーゼソース");
  await expectNoOverflow(page, "PREPARE with selection");
  await shot(page, "03-prepare-selected");
  await cook(page, /ジェノベーゼ/, [
    { chip: /チキン/, at: [40, 50] },
    { chip: /チキン/, at: [60, 50] },
  ]);
  const result = page.locator(".result-panel--original");
  await expect(result).toContainText("🧪 オリジナルピザ");
  await expect(result.locator("[data-ingredient-test]")).toContainText("✓ ジェノベーゼソースを使う");
  expect(await result.innerText()).not.toMatch(ORACLE);
  await expectNoOverflow(page, "positive RESULT");
  await expectNoUndiscoveredIdentity(page, discovered, "positive RESULT");
  for (const name of [/もう一度試す/, /試作ノート/, /ヒント/]) await expectInViewport(page, result.getByRole("button", { name }), `CTA ${name}`);
  await shot(page, "04-result-positive");
  expect(Object.values(await savedFacts(page)).flat()).toContain("ing:pesto");

  // Retry: the Research Target stays, the selection does not; the knowledge is on the research card.
  await result.getByRole("button", { name: "もう一度試す" }).click();
  await page.waitForSelector(".pizza-stage");
  const card = page.getByTestId("research-context");
  await expect(card).toContainText("？？？ピザ");
  await expect(card).toContainText("✓ ジェノベーゼソースを使う");
  await expect(page.getByTestId("research-test-button")).toContainText("今回の調査をえらぶ");
  // already-known ingredients are no longer offered
  await page.getByTestId("research-test-button").click();
  await expect(page.getByTestId("research-test-picker").getByRole("button", { name: /ジェノベーゼソース/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await shot(page, "05-retry-reset-knowledge");

  // Attempt 2: declare たまご (not in the recipe), use it -> NOT_IDENTIFIED, nothing is saved.
  const factsBefore = JSON.stringify(await savedFacts(page));
  await pickTestIngredient(page, "たまご");
  await cook(page, /トマトソース/, [
    { chip: /チキン/, at: [40, 50] },
    { chip: /たまご/, at: [60, 50] },
  ]);
  const second = page.locator(".result-panel--original");
  await expect(second.locator("[data-ingredient-test]")).toContainText("たまごは特定できませんでした");
  expect(await second.innerText()).not.toMatch(ORACLE);
  await expectNoOverflow(page, "negative RESULT");
  await expectNoUndiscoveredIdentity(page, discovered, "negative RESULT");
  await shot(page, "06-result-not-identified");
  expect(JSON.stringify(await savedFacts(page))).toBe(factsBefore);
  expect(JSON.stringify(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))).not.toMatch(/researchTest|lastIngredientTest|たまご/);

  // Reload: the positive stays, the selection is not restored.
  await page.reload();
  await page.waitForSelector(".app-frame");
  expect(Object.values(await savedFacts(page)).flat()).toContain("ing:pesto");
  await startResearch(page);
  await expect(page.getByTestId("research-context")).toContainText("✓ ジェノベーゼソースを使う");
  await expect(page.getByTestId("research-test-button")).toContainText("今回の調査をえらぶ");
});

test("a targetless Recipe Discovery round has no selector", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /レシピ発見/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-test-button")).toHaveCount(0);
  await expect(page.getByTestId("research-context")).toHaveCount(0);
});

/** #358: PREPARE metrics of the research card + the stage (annotation only; the pass/fail budget is asserted below). */
const measure = (page: Page) =>
  page.evaluate(() => {
    const r = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
    const card = r("[data-testid='research-context']") ?? r(".order-card");
    const stage = r(".pizza-stage")!;
    return { cardH: Math.round(card?.height ?? 0), stageTop: Math.round(stage.top), stageH: Math.round(stage.height), bottomBar: Math.round(r(".prepare-bake-bar")?.top ?? 0) };
  });

test("#358: selection is editable until the first step confirm, then a read-only status; RESET keeps it; BAKE keeps the research context", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await startResearch(page);
  const dough = await measure(page);
  test.info().annotations.push({ type: "dough-metrics", description: JSON.stringify(dough) });
  const card = page.getByTestId("research-context");
  await expect(card).toContainText("わかっていること");
  await expect(page.getByTestId("research-step-instruction")).toBeVisible();
  await expectNoOverflow(page, "DOUGH research card");
  await shot(page, "10-dough-editable");

  await pickTestIngredient(page, "たまご");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // first CONFIRM_MAKING_STEP -> LOCKED
  await expect(page.getByTestId("research-test-button")).toHaveCount(0);
  const status = page.getByTestId("research-test-status");
  await expect(status).toHaveText("🔬 調査中：たまご");
  expect(await status.evaluate((el) => el.tagName)).toBe("SPAN");
  await expect(card).toContainText("？？？ピザ");
  await expect(card).toContainText("✓ チキンを使う");
  expect(await card.innerText()).not.toMatch(ORACLE);
  const sauce = await measure(page);
  test.info().annotations.push({ type: "sauce-metrics", description: JSON.stringify(sauce) });
  await expectNoOverflow(page, "SAUCE locked");
  await expectInViewport(page, status, "status");
  await shot(page, "11-sauce-locked-status");

  // RESET_PIZZA: same attempt -> the step returns to the first one but the selection AND the lock stay.
  await bar(page).getByRole("button", { name: "やり直す" }).click();
  await expect(page.getByTestId("research-test-status")).toHaveText("🔬 調査中：たまご");
  await expect(page.getByTestId("research-test-button")).toHaveCount(0);
  await shot(page, "12-after-reset-still-locked");

  // Cook without the declared ingredient: 焼く！ asks first.
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await pickChip(page, /チキン/);
  await tapDoughPercent(page, 40, 50);
  await bar(page).getByRole("button", { name: /焼く/ }).click();
  const confirm = page.getByTestId("bake-unused-confirm");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("たまごをまだ使っていません");
  await expect(confirm).toContainText("このまま焼くと、今回の食材調査は行われません");
  expect(await confirm.innerText()).not.toMatch(ORACLE);
  await expectInViewport(page, confirm.getByRole("button", { name: "戻って追加する" }), "confirm back");
  await expectInViewport(page, confirm.getByRole("button", { name: "このまま焼く" }), "confirm bake");
  await expectNoOverflow(page, "bake confirm");
  await shot(page, "13-bake-confirm");

  // 戻って追加する: still PREPARE; add the egg; now 焼く！ goes straight to BAKE.
  await confirm.getByRole("button", { name: "戻って追加する" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.locator(".pizza-stage")).toBeVisible();
  await expect(page.getByTestId("research-test-status")).toBeVisible();
  await pickChip(page, /たまご/);
  await tapDoughPercent(page, 60, 50);
  await page.clock.install();
  await bar(page).getByRole("button", { name: /焼く/ }).click();
  await expect(confirm).toHaveCount(0);
  await page.waitForSelector(".order-card--bake");
  const bake = page.locator(".order-card--bake");
  await expect(bake).toContainText("🔎 研究中　？？？ピザ");
  await expect(bake).toContainText("🔬 調査中：たまご");
  await expectNoOverflow(page, "BAKE research context");
  await shot(page, "14-bake-research-context");
  await finishBake(page);
  await expect(page.locator(".result-panel [data-ingredient-test]")).toContainText("たまごは特定できませんでした");

  // Retry: the selection and the lock are gone, the selector is back.
  await page.locator(".result-panel").getByRole("button", { name: "もう一度試す" }).click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-test-button")).toContainText("今回の調査をえらぶ");
  await expect(page.getByTestId("research-test-status")).toHaveCount(0);
});

test("#358: baking without the declared ingredient is allowed (このまま焼く) and the RESULT says it was not checked", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await startResearch(page);
  await pickTestIngredient(page, "たまご");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await pickChip(page, /チキン/);
  await tapDoughPercent(page, 40, 50);
  await page.clock.install();
  await bar(page).getByRole("button", { name: /焼く/ }).click();
  await page.getByTestId("bake-unused-confirm").getByRole("button", { name: "このまま焼く" }).click();
  await page.waitForSelector(".order-card--bake");
  await finishBake(page);
  await expect(page.locator(".result-panel [data-ingredient-test]")).toContainText("たまごは今回の試作に入っていなかったので、調べていません");
  expect(await page.locator(".result-panel").innerText()).not.toMatch(ORACLE);
  expect(Object.values(await savedFacts(page)).flat().filter((f) => f.includes("egg"))).toEqual([]);
  await shot(page, "15-result-not-used");
});
