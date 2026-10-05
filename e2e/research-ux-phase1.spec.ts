import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Research UX Phase 1 (P1-a / b / c / e): PREPARE guidance + direct 試作ノート entry, Hint sheet label, Research RESULT note.
 * Dex 25 ladder save with calabresa closed (pesto-pollo = the single Research Entry). Chromium 390x844 and 360x800.
 * Measured at PREPARE: the research card, the guidance, 試作ノート, ヒント and 焼く！ all fit inside the viewport, the pizza
 * is not shrunk below its width-driven size, and there is no horizontal overflow.
 * HV_SCREENSHOT_DIR (optional) writes the Human Verification screenshots.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);

const discovered = [...keysBefore(25), "brazilian-calabresa", "aussie"];
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

const ORACLE = /一致しません|不一致|正解|不正解|✕|足りない|間違|残り|あと[0-9０-９]|おしい|かなり近|別の組み合わせ|新しく入荷|[0-9０-９]+\s*[/／]\s*[0-9０-９]+|[0-9０-９]+\s*[%％]/;
const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function open(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
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
  for (let i = 0; i < 6 && !(await chip.isVisible()); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
  }
  await chip.click();
}

/** Dough -> tomato sauce -> no cheese -> a lone chicken pair -> bake: a pizza no recipe has. Ends on its RESULT. */
async function cookOriginalFromPrepare(page: Page) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // no cheese
  await pickChip(page, /チキン/);
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}


const PREPARE_GUIDANCE = "材料を足して試そう。焼くと使った材料の○×がわかるよ";
const NOTEBOOK_GUIDANCE = "試作ノートを見て、次に試す材料を考えよう";

async function startResearch(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
  await expect(page.getByTestId("research-context")).toBeVisible();
}

async function expectPrepareFits(page: Page, where: string, expectedGuidance: string) {
  await page.waitForSelector(".pizza-stage");
  const card = page.getByTestId("research-context");
  await expect(card).toContainText("🔎 研究中 ？？？ピザ");
  await expect(page.getByTestId("research-guidance")).toHaveText(expectedGuidance);
  const vp = page.viewportSize()!;
  for (const [name, loc] of [
    ["card", card],
    ["guidance", page.getByTestId("research-guidance")],
    ["notebook CTA", page.getByTestId("research-notebook-entry")],
    ["hint CTA", bar(page).getByRole("button", { name: "ヒント" })],
    ["bake/next CTA", bar(page).locator(".cta-button--bake")],
  ] as const) {
    await expectInViewport(page, loc, `${where} ${name}`);
  }
  const cardBox = (await card.boundingBox())!;
  const nb = (await page.getByTestId("research-notebook-entry").boundingBox())!;
  expect(nb.height, `${where}: notebook touch target`).toBeGreaterThanOrEqual(44);
  const dough = (await page.locator(".pizza-dough").first().boundingBox())!;
  const expected = Math.min(0.76 * vp.width, 290, vp.height - 439);
  console.log(`[measure ${test.info().project.name}] ${where}: card h=${Math.round(cardBox.height)} dough=${Math.round(dough.width)} expected>=${Math.round(expected)}`);
  expect(dough.width, `${where}: pizza not shrunk`).toBeGreaterThanOrEqual(expected - 2);
  await expectNoOverflow(page, where);
  await expectNoUndiscoveredIdentity(page, discovered, where);
}

test("Research UX Phase 1: PREPARE guidance / notebook / hint label -> RESULT note -> notebook -> retry", async ({ page }) => {
  test.setTimeout(420_000);
  await open(page);
  await startResearch(page);
  await expectPrepareFits(page, "PREPARE (valid target)", PREPARE_GUIDANCE);
  expect(await page.getByTestId("research-context").innerText()).not.toMatch(ORACLE);
  await shot(page, "p1-01-prepare");

  // P1-c: the PREPARE notebook entry (read-only, session notebook; empty on the first attempt), focus returns
  const entry = page.getByTestId("research-notebook-entry");
  await entry.click();
  const notebook = page.locator("[data-trial-notebook]");
  await expect(notebook).toBeVisible();
  await expect(notebook.locator("[data-trial-research]")).toContainText("？？？ピザ");
  await expect(notebook.locator("[data-trial-notebook-empty]")).toBeVisible();
  await expectNoOverflow(page, "PREPARE notebook");
  await shot(page, "p1-02-prepare-notebook");
  // PR #390 Codex P2 (real Chromium inert): Tab / Shift+Tab never leave the sheet and Enter cannot act on the screen behind it
  const outside = () => page.evaluate(() => !document.activeElement?.closest("[data-trial-notebook]") && document.activeElement !== document.body);
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Shift+Tab");
    expect(await outside(), `Shift+Tab #${i + 1} stayed in the notebook`).toBe(false);
    await page.keyboard.press("Tab");
    expect(await outside(), `Tab #${i + 1} stayed in the notebook`).toBe(false);
  }
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter"); // would be やり直す / 次へ / ヒント if reachable
  await expect(notebook).toBeVisible();
  await expect(page.getByRole("dialog", { name: /ヒント/ })).toHaveCount(0);
  await notebook.getByRole("button", { name: /もどる/ }).click();
  await expect(notebook).toHaveCount(0);
  await expect(entry).toBeFocused();
  await expect(page.locator("[inert]")).toHaveCount(0);
  await expect(bar(page).getByRole("button", { name: "ヒント" })).toBeEnabled(); // controls work again

  // P1-b: the Hint sheet names the Research Target
  await bar(page).getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog.locator("[data-hint-research]")).toContainText("🔎 研究中 ？？？ピザ");
  await expectNoOverflow(page, "hint sheet");
  await expectNoUndiscoveredIdentity(page, discovered, "hint sheet");
  await shot(page, "p1-03-hint-label");
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByTestId("research-context")).toBeVisible();

  // P1-e: RESULT note
  await cookOriginalFromPrepare(page);
  const result = page.locator(".result-panel--original");
  await expect(result).toContainText("試作結果とノートを見て、次に試す材料を考えてみよう。");
  await expect(result).not.toContainText("図鑑のピザと同じ組み合わせ");
  expect(await result.innerText()).not.toMatch(ORACLE);
  await expectNoOverflow(page, "RESULT");
  await shot(page, "p1-04-result");

  // the entry now has one attempt; retry keeps the target and the PREPARE entry shows it
  await result.getByRole("button", { name: "もう一度試す" }).click();
  await expectPrepareFits(page, "PREPARE (retry)", PREPARE_GUIDANCE);
  await page.getByTestId("research-notebook-entry").click();
  await expect(page.locator("[data-trial-entry]")).toHaveCount(1);
  await page.locator("[data-trial-notebook]").getByRole("button", { name: /もどる/ }).click();
});

test("Research UX Phase 1: last-stock retry has no ○× promise; targetless FREE is unchanged", async ({ page }) => {
  test.setTimeout(420_000);
  await open(page);
  await page.evaluate(([key]) => {
    const save = JSON.parse(localStorage.getItem(key)!);
    save.inventory.chicken = 1;
    localStorage.setItem(key, JSON.stringify(save));
  }, [SAVE_KEY] as const);
  await page.reload();
  await page.waitForSelector(".app-frame");
  await startResearch(page);
  await expectPrepareFits(page, "PREPARE before the last stock", PREPARE_GUIDANCE);
  await cookOriginalFromPrepare(page); // uses the one chicken
  await expect(page.locator(".result-panel--original")).toContainText("試作結果とノートを見て");
  await page.locator(".result-panel--original").getByRole("button", { name: "もう一度試す" }).click();
  await expectPrepareFits(page, "PREPARE retry after the last stock", NOTEBOOK_GUIDANCE);
  expect(await page.getByTestId("research-context").innerText()).not.toMatch(/○|×/);
  await shot(page, "p1-05-last-stock-retry");

  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toHaveCount(0);
  await expect(page.getByTestId("research-guidance")).toHaveCount(0);
  await expect(page.getByTestId("research-notebook-entry")).toHaveCount(0);
  await expectNoOverflow(page, "targetless FREE");
});
