import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Research 2.0 Phase 1 (Stable Research Identity, D+ Cohort Letter): the Dex / PREPARE / Hint / RESULT / Notebook all read
 * one label, `？？？ピザ B（たまねぎ）` for same-unlock siblings and `？？？ピザ（チキン）` for a single cohort, and a sibling's
 * discovery never moves a letter. Production data only: ladder step 12 = A Aussie / B Brazilian Calabresa / C Pizza
 * Portuguesa (unlock = たまねぎ), step 28 = A Ratatouille / B Pesto Vegetariana (unlock = ズッキーニ). Chromium 390x844 and 360x800.
 * HV_SCREENSHOT_DIR (optional) writes the Human Verification screenshots.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);
const bar = (page: Page) => page.locator(".prepare-bake-bar");

const LABELS = {
  A: "？？？ピザ A（たまねぎ）",
  B: "？？？ピザ B（たまねぎ）",
  C: "？？？ピザ C（たまねぎ）",
  vegA: "？？？ピザ A（ズッキーニ）",
  vegB: "？？？ピザ B（ズッキーニ）",
} as const;

function save(step: number, extraDiscovered: readonly string[]) {
  const materials = materialsUpTo(step);
  const discovered = [...keysBefore(step), ...extraDiscovered];
  return {
    discovered,
    json: JSON.stringify({
      schemaVersion: 2,
      dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 999,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
      missionBest: {},
      inventory: Object.fromEntries(materials.map((m) => [m, 30])),
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: materials,
    }),
  };
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

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

async function expectNoOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
}

async function openDex(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  const section = page.locator(".dex-overlay__research");
  await section.scrollIntoViewIfNeeded();
  return section;
}

const titlesOf = (section: ReturnType<Page["locator"]>) => section.locator(".dex-research-card h3").allTextContents();

/** The research cards' labels fit the card (no clipped or overflowing label) at the current width. */
async function expectLabelsFit(section: ReturnType<Page["locator"]>, where: string) {
  const fits = await section.locator(".dex-research-card").evaluateAll((cards) =>
    cards.map((c) => {
      const h = c.querySelector("h3") as HTMLElement;
      const hb = h.getBoundingClientRect();
      const cb = c.getBoundingClientRect();
      return { fitsCard: hb.right <= cb.right + 0.5 && hb.left >= cb.left - 0.5, noClip: h.scrollWidth <= h.clientWidth + 1 };
    }),
  );
  for (const f of fits) expect(f, `${where}: label fits its card`).toEqual({ fitsCard: true, noClip: true });
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

/** Dough -> tomato sauce -> no cheese -> a lone ham pair -> bake: a pizza no recipe has. Ends on its RESULT. */
async function cookOriginalFromPrepare(page: Page) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bar(page).getByRole("button", { name: /次へ/ }).click(); // no cheese
  await pickChip(page, /ハム/);
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

test("step 12: A / B / C in the Dex; B's PREPARE, Hint, RESULT and Notebook all say B; reload keeps A / B / C", async ({ page }) => {
  test.setTimeout(300_000);
  const { discovered, json } = save(12, []);
  await open(page, json);
  let section = await openDex(page);
  expect(await titlesOf(section)).toEqual([LABELS.A, LABELS.B, LABELS.C]);
  await expect(section.locator("button")).toHaveCount(3);
  for (const key of ["A", "B", "C"] as const) {
    await expect(section.getByRole("button", { name: `${LABELS[key]}を研究する` })).toBeVisible();
  }
  await expectLabelsFit(section, "dex step 12");
  await expectNoOverflow(page, "dex step 12");
  await expectNoUndiscoveredIdentity(page, discovered, "dex step 12");
  await shot(page, "r2-01-dex-step12-abc");

  // reload re-derives the same labels from the save alone
  await page.reload();
  await page.waitForSelector(".app-frame");
  section = await openDex(page);
  expect(await titlesOf(section)).toEqual([LABELS.A, LABELS.B, LABELS.C]);

  // pick B
  await section.getByRole("button", { name: `${LABELS.B}を研究する` }).click();
  await page.waitForSelector(".pizza-stage");
  const ctx = page.getByTestId("research-context");
  await expect(ctx).toContainText(`🔎 研究中 ${LABELS.B}`);
  await expect(ctx).not.toContainText(LABELS.A);
  await expect(ctx).not.toContainText(LABELS.C);
  const nameBox = await ctx.locator(".order-card__recipe-name--research").evaluate((e) => ({ clip: e.scrollWidth - e.clientWidth, right: e.getBoundingClientRect().right, vw: window.innerWidth }));
  // the label never breaks inside a part (「たまねぎ」 stays whole): every part is a single line at both widths
  const partLines = await ctx.locator(".research-label__part").evaluateAll((parts) =>
    // a one-line box is at most ~1.8 font sizes tall (normal line height is ~1.2-1.5)
    parts.map((p) => p.getBoundingClientRect().height <= parseFloat(getComputedStyle(p).fontSize) * 1.8),
  );
  expect(partLines.length).toBeGreaterThanOrEqual(2);
  for (const oneLine of partLines) expect(oneLine, "label part is one line").toBe(true);
  expect(nameBox.clip, "PREPARE label is not clipped").toBeLessThanOrEqual(1);
  expect(nameBox.right, "PREPARE label inside the viewport").toBeLessThanOrEqual(nameBox.vw);
  await expectNoOverflow(page, "PREPARE B");
  await expectNoUndiscoveredIdentity(page, discovered, "PREPARE B");
  await shot(page, "r2-02-prepare-b");

  // Hint sheet
  await bar(page).getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog.locator("[data-hint-research]")).toContainText(`🔎 研究中 ${LABELS.B}`);
  await expectNoOverflow(page, "hint B");
  await expectNoUndiscoveredIdentity(page, discovered, "hint B");
  await shot(page, "r2-03-hint-b");
  await dialog.getByRole("button", { name: "閉じる" }).click();

  // an original trial: RESULT and Notebook
  await cookOriginalFromPrepare(page);
  const result = page.locator(".result-panel--original");
  await expect(result).toContainText(`研究中 ${LABELS.B}`);
  await expect(page.getByTestId("research-rows")).toBeVisible();
  await expectNoOverflow(page, "RESULT B");
  await expectNoUndiscoveredIdentity(page, discovered, "RESULT B");
  await shot(page, "r2-04-result-b");
  await result.getByRole("button", { name: /試作ノート/ }).click();
  const notebook = page.locator("[data-trial-notebook]");
  await expect(notebook.locator("[data-trial-research]")).toContainText(LABELS.B);
  await expect(notebook.locator("[data-trial-entry]")).toHaveCount(1);
  await expect(notebook.locator(".trial-notebook__feedback")).toContainText(LABELS.B);
  await expectNoOverflow(page, "notebook B");
  await expectNoUndiscoveredIdentity(page, discovered, "notebook B");
  await shot(page, "r2-05-notebook-b");
});

test("step 12 with B discovered: A and C stay A and C (also after a reload), and C researches as C", async ({ page }) => {
  const { discovered, json } = save(12, ["brazilian-calabresa"]);
  await open(page, json);
  let section = await openDex(page);
  expect(await titlesOf(section)).toEqual([LABELS.A, LABELS.C]);
  await expectLabelsFit(section, "dex B discovered");
  await expectNoOverflow(page, "dex B discovered");
  await expectNoUndiscoveredIdentity(page, discovered, "dex B discovered");
  await shot(page, "r2-06-dex-b-discovered-ac");
  await page.reload();
  await page.waitForSelector(".app-frame");
  section = await openDex(page);
  expect(await titlesOf(section)).toEqual([LABELS.A, LABELS.C]);
  await section.getByRole("button", { name: `${LABELS.C}を研究する` }).click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toContainText(`🔎 研究中 ${LABELS.C}`);
  await expectNoOverflow(page, "PREPARE C");
  await shot(page, "r2-07-prepare-c");
});

test("step 28: A (Ratatouille) / B (Pesto Vegetariana); with A discovered B stays B", async ({ page }) => {
  const closed = ["brazilian-calabresa", "aussie"];
  const both = save(28, closed);
  await open(page, both.json);
  let section = await openDex(page);
  expect(await titlesOf(section)).toEqual([LABELS.vegA, LABELS.vegB]);
  await expectLabelsFit(section, "dex step 28");
  await expectNoOverflow(page, "dex step 28");
  await expectNoUndiscoveredIdentity(page, both.discovered, "dex step 28");
  await shot(page, "r2-08-dex-step28-ab");

  const afterA = save(28, [...closed, "ratatouille-pizza"]);
  await open(page, afterA.json);
  section = await openDex(page);
  expect(await titlesOf(section)).toEqual([LABELS.vegB]);
  await shot(page, "r2-09-dex-step28-after-a");
  await section.getByRole("button", { name: `${LABELS.vegB}を研究する` }).click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toContainText(`🔎 研究中 ${LABELS.vegB}`);
  await expectNoOverflow(page, "PREPARE step 28 B");
  await shot(page, "r2-09b-prepare-step28-b");
});

test("a single cohort has no letter: the label is 「？？？ピザ（チキン）」, and no retired ①②③ appears anywhere", async ({ page }) => {
  const { discovered, json } = save(25, ["brazilian-calabresa", "aussie"]);
  await open(page, json);
  const section = await openDex(page);
  expect(await titlesOf(section)).toEqual(["？？？ピザ（チキン）"]);
  const html = await page.locator("body").innerText();
  expect(html).not.toMatch(/[①-⑳]/);
  await expectNoUndiscoveredIdentity(page, discovered, "dex single cohort");
  await shot(page, "r2-10-dex-single-cohort");
});
