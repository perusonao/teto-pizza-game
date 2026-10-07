import { expectResearchLead } from "./support/hintNote";
import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { startTargetlessFreeCook } from "./support/startFreeCook";
import { materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Discovery 3.0 #346 S4: the Research Recipe player loop around RESULT, played for real on the Dex 25 ladder save with
 * the non-credit calabresa closed (pesto-pollo is the single Research Entry):
 *   Dex card -> 研究する -> a trial that matches nothing -> Research ORIGINAL RESULT -> 📓 試作ノート -> back
 *   -> 💡 ヒント (the Research Target is the subject; a bought rung adds knowledge) -> another trial -> もう一度試す
 *   -> the same Research Target is still the subject.
 * Chromium 390×844 and 360×800 (the two iphone projects). Each state: no horizontal overflow, every CTA inside the
 * viewport, no oracle wording, no hidden recipe identity in the DOM.
 * HV_SCREENSHOT_DIR (optional) writes the Human Verification screenshots.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];

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
  // Research Board (S4): a saved disclosed-NEGATIVE row, shown as ✗ above the attempt log.
  researchExclusions: { "pesto-pollo": ["egg"] },
};

// Wording the Research RESULT / Notebook must never use (recipe-attributed correctness, counts, distance, near/far).
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

test("Research loop: ORIGINAL result -> Notebook -> Hint -> retry keeps the same Research Target", async ({ page }) => {
  test.setTimeout(420_000);
  await open(page);

  // Dex -> the single Research Entry -> 研究する
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
  await expectResearchLead(page, "？？？ピザ");
  await cookOriginalFromPrepare(page);

  // A. Research ORIGINAL result
  const result = page.locator(".result-panel--original");
  await expect(result).toBeVisible();
  await expect(result).toContainText("🧪 オリジナルピザ");
  await expect(result).toContainText("まだ新しいレシピは見つかっていません");
  await expect(result).toContainText("研究中 ？？？ピザ");
  expect(await result.innerText()).not.toMatch(ORACLE);
  await expectNoOverflow(page, "research ORIGINAL result");
  await expectNoUndiscoveredIdentity(page, discovered, "research ORIGINAL result");
  const retryCta = result.getByRole("button", { name: "もう一度試す" });
  const notebookCta = result.getByRole("button", { name: /試作ノート/ });
  const hintCta = result.getByRole("button", { name: /ヒント/ });
  for (const [name, cta] of [["retry", retryCta], ["notebook", notebookCta], ["hint", hintCta]] as const) {
    await expect(cta, name).toBeVisible();
    await expectInViewport(page, cta, `CTA ${name}`);
  }
  await shot(page, "01-research-original-result");

  // B. Trial Notebook: the player's own history only
  await notebookCta.click();
  const notebook = page.locator("[data-trial-notebook]");
  await expect(notebook).toBeVisible();
  await expect(notebook.locator("[data-trial-research]")).toContainText("いまの研究対象");
  await expect(notebook.locator("[data-trial-research]")).toContainText("？？？ピザ");
  // Research Board (S4): saved facts of the current target only, above the session attempt log
  const board = notebook.locator("[data-research-board]");
  await expect(board).toBeVisible();
  await expect(board).toContainText("これまでの試作で確定して、保存された情報");
  await expect(board.locator("[data-research-board-known]")).toContainText("チキン");
  await expect(board.locator("[data-research-board-excluded]")).toContainText("たまご");
  await expect(board.locator("[data-research-board-unsure]")).toHaveCount(0);
  expect(await board.innerText()).not.toMatch(/No\.|候補|残り|回目|テクニック|試作 #/);
  const boardBox = (await board.boundingBox())!;
  const firstEntryBox = (await notebook.locator("[data-trial-entry]").first().boundingBox())!;
  expect(boardBox.y + boardBox.height, "Board sits above the attempt log").toBeLessThanOrEqual(firstEntryBox.y);
  await expect(notebook.locator("[data-trial-entry]")).toHaveCount(1);
  await expect(notebook.locator("[data-trial-entry]")).toContainText("チキン");
  await expect(notebook.locator("[data-trial-entry]")).toContainText("トマトソース");
  expect(await notebook.innerText()).not.toMatch(ORACLE);
  await expectNoOverflow(page, "notebook");
  await expectNoUndiscoveredIdentity(page, discovered, "notebook");
  await shot(page, "02-notebook");
  await notebook.getByRole("button", { name: /結果にもどる/ }).click();
  await expect(notebook).toHaveCount(0);
  await expect(result).toBeVisible();

  // C. Hint from RESULT: a fresh round whose sheet is about the Research Target; a bought rung adds knowledge
  await hintCta.click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
  await expectNoOverflow(page, "hint sheet");
  await expectNoUndiscoveredIdentity(page, discovered, "hint sheet");
  await shot(page, "03-hint-from-result");
  await dialog.locator(".hint-sheet__h5-next .hint-sheet__next").click();
  await expect(dialog.locator(".hint-sheet__fact-line, .hint-sheet__chip").first()).toBeVisible();
  await expectNoUndiscoveredIdentity(page, discovered, "after purchase");
  const facts = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").discoveryHintFacts ?? {}, SAVE_KEY);
  expect(Object.keys(facts).length).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "閉じる" }).click();

  // The round the Hint opened is still the Research Target's; another trial, then 「もう一度試す」
  await expectResearchLead(page, "？？？ピザ");
  await cookOriginalFromPrepare(page);
  await expect(page.locator(".result-panel--original")).toContainText("研究中 ？？？ピザ");
  await expect(page.locator(".result-panel--original")).toContainText("まだ新しいレシピは見つかっていません");
  await page.locator(".result-panel--original").getByRole("button", { name: "もう一度試す" }).click();
  await page.waitForSelector(".pizza-stage");
  await expectResearchLead(page, "？？？ピザ");
  await expectNoOverflow(page, "retry");
  await expectNoUndiscoveredIdentity(page, discovered, "retry");
  await shot(page, "04-retry-same-target");

  // J. reload: the Hint knowledge stays, the entry is re-derived, the Research Target is not restored
  await page.reload();
  await page.waitForSelector(".app-frame");
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
  expect(JSON.stringify(after)).not.toMatch(/researchTarget/);
  expect(Object.keys(after.discoveryHintFacts ?? {}).length).toBeGreaterThan(0);
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await expect(page.locator(".dex-overlay__research .dex-research-card")).toHaveCount(1);
  await page.getByRole("button", { name: "閉じる" }).click();
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toHaveCount(0);
});
