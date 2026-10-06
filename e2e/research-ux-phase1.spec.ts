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
  await page.waitForSelector(".pizza-stage");
  // Owner decision (#401 HV): no Research card above the pizza; the context leads the Hint sheet.
  await expect(page.getByTestId("research-context")).toHaveCount(0);
}

/** PREPARE of a Research round: the screen fits, the pizza is not shrunk, and the Hint sheet leads with the research context. */
async function expectPrepareFits(page: Page, where: string, expectedGuidance: string) {
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toHaveCount(0);
  const vp = page.viewportSize()!;
  for (const [name, loc] of [
    ["hint CTA", bar(page).getByRole("button", { name: "ヒント" })],
    ["bake/next CTA", bar(page).locator(".cta-button--bake")],
  ] as const) {
    await expectInViewport(page, loc, `${where} ${name}`);
  }
  const dough = (await page.locator(".pizza-dough").first().boundingBox())!;
  const expected = Math.min(0.76 * vp.width, 290, vp.height - 439);
  console.log(`[measure ${test.info().project.name}] ${where}: dough=${Math.round(dough.width)} expected>=${Math.round(expected)}`);
  expect(dough.width, `${where}: pizza not shrunk`).toBeGreaterThanOrEqual(expected - 2);
  await expectNoOverflow(page, where);
  await expectNoUndiscoveredIdentity(page, discovered, where);

  await bar(page).getByRole("button", { name: "ヒント" }).click();
  const sheet = page.getByRole("dialog", { name: /ヒント/ });
  await expect(sheet.locator("[data-hint-research]")).toContainText("🔎 研究中 ？？？ピザ");
  await expect(sheet.locator("[data-hint-research-details]")).toContainText(expectedGuidance);
  const entry = sheet.getByRole("button", { name: /試作ノートを見る/ });
  await expectInViewport(page, sheet.locator("[data-hint-research]"), `${where} research lead`);
  await expectInViewport(page, entry, `${where} notebook entry`);
  expect((await entry.boundingBox())!.height, `${where}: notebook touch target`).toBeGreaterThanOrEqual(44);
  await expectNoOverflow(page, `${where} hint`);
  await expectNoUndiscoveredIdentity(page, discovered, `${where} hint`);
  await sheet.getByRole("button", { name: "閉じる" }).click();
  await expect(sheet).toHaveCount(0);
}

test("Research UX Phase 1: PREPARE guidance / notebook / hint label -> RESULT note -> notebook -> retry", async ({ page }) => {
  test.setTimeout(420_000);
  await open(page);
  await startResearch(page);
  await expectPrepareFits(page, "PREPARE (valid target)", PREPARE_GUIDANCE);
  await shot(page, "p1-01-prepare");

  // The Hint sheet leads with the research context (label, what is known, the fixed ○× sentence) and no oracle
  await bar(page).getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog.locator("[data-hint-research]")).toContainText("🔎 研究中 ？？？ピザ");
  expect(await dialog.locator("[data-hint-research], [data-hint-research-details]").allInnerTexts().then((t) => t.join(" "))).not.toMatch(ORACLE);
  await expectNoOverflow(page, "hint sheet");
  await shot(page, "p1-03-hint-label");

  // P1-c: the 試作ノート entry of the sheet (read-only, session notebook; empty on the first attempt), focus returns to it
  const entry = dialog.getByRole("button", { name: /試作ノートを見る/ });
  await entry.click();
  const notebook = page.locator("[data-trial-notebook]");
  await expect(notebook).toBeVisible();
  await expect(notebook.locator("[data-trial-research]")).toContainText("？？？ピザ");
  await expect(notebook.locator("[data-trial-notebook-empty]")).toBeVisible();
  await expectNoOverflow(page, "PREPARE notebook");
  await shot(page, "p1-02-prepare-notebook");
  // PR #390 Codex P2, as far as the Hint sheet path goes: while the notebook is open the Hint sheet under it is inert, so Tab /
  // Shift+Tab can never land in the sheet behind it, and the notebook itself keeps the focus on first open.
  await expect(page.locator(".hint-sheet[inert]")).toHaveCount(1);
  const inSheetBehind = () => page.evaluate(() => !!document.activeElement?.closest(".hint-sheet"));
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Shift+Tab");
    expect(await inSheetBehind(), `Shift+Tab #${i + 1} never lands in the inert Hint sheet`).toBe(false);
    await page.keyboard.press("Tab");
    expect(await inSheetBehind(), `Tab #${i + 1} never lands in the inert Hint sheet`).toBe(false);
  }
  await expect(notebook).toBeVisible();
  await expect(dialog).toHaveCount(1);
  await notebook.getByRole("button", { name: /もどる/ }).click();
  await expect(notebook).toHaveCount(0);
  await expect(entry).toBeFocused();
  await expect(page.locator(".hint-sheet[inert]")).toHaveCount(0); // the sheet works again
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(bar(page).getByRole("button", { name: "ヒント" })).toBeEnabled(); // controls work again
  await expect(page.getByTestId("research-context")).toHaveCount(0);

  // P1-e: RESULT note
  await cookOriginalFromPrepare(page);
  const result = page.locator(".result-panel--original");
  await expect(result).toContainText("試作結果とノートを見て、次に試す材料を考えてみよう。");
  await expect(result).not.toContainText("図鑑のピザと同じ組み合わせ");
  expect(await result.innerText()).not.toMatch(ORACLE);
  await expectNoOverflow(page, "RESULT");
  await shot(page, "p1-04-result");

  // the entry now has one attempt; retry keeps the target and the Hint sheet's notebook shows it
  await result.getByRole("button", { name: "もう一度試す" }).click();
  await expectPrepareFits(page, "PREPARE (retry)", PREPARE_GUIDANCE);
  await bar(page).getByRole("button", { name: "ヒント" }).click();
  await page.getByRole("dialog", { name: /ヒント/ }).getByRole("button", { name: /試作ノートを見る/ }).click();
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
  await bar(page).getByRole("button", { name: "ヒント" }).click();
  expect(await page.locator("[data-hint-research]").innerText()).not.toMatch(/○|×/);
  await page.getByRole("dialog", { name: /ヒント/ }).getByRole("button", { name: "閉じる" }).click();
  await shot(page, "p1-05-last-stock-retry");

  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toHaveCount(0);
  await bar(page).getByRole("button", { name: "ヒント" }).click();
  await expect(page.locator("[data-hint-research], [data-hint-research-details]")).toHaveCount(0); // a targetless round has no research block
  await page.getByRole("dialog", { name: /ヒント/ }).getByRole("button", { name: "閉じる" }).click();
  await expectNoOverflow(page, "targetless FREE");
});
