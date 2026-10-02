import { test, expect, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { RECIPES } from "../src/data/recipes";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Discovery 3.0 #346 S3: Research Entry -> 「このピザを研究する」 -> Free Cooking research context -> Hint.
 * Chromium 390×844 / 360×800 (the two iphone projects). Checked at each state: no horizontal overflow,
 * the research context and the Hint CTA inside the viewport, no hidden recipe identity in the DOM.
 * HV_SCREENSHOT_DIR (optional) writes the Human Verification screenshots.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);

function save(step: number, extraDiscovered: readonly string[] = [], facts: Record<string, string[]> = {}) {
  const materials = materialsUpTo(step);
  const discovered = [...keysBefore(step), ...extraDiscovered];
  return {
    discovered,
    json: {
      schemaVersion: 2,
      dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 999,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
      missionBest: {},
      inventory: Object.fromEntries(materials.map((m) => [m, 10])),
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: materials,
      discoveryHintFacts: facts,
    },
  };
}

async function open(page: Page, s: object) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, JSON.stringify(s)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function openDex(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
}

async function expectNoOverflow(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
}

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

test("A. single entry (pesto-pollo): select -> research context -> Hint opens on it and buys a rung", async ({ page }) => {
  const { discovered, json } = save(25, ["brazilian-calabresa"]);
  await open(page, json);
  await openDex(page);
  const section = page.locator(".dex-overlay__research");
  await expect(section.locator(".dex-research-card")).toHaveCount(1);
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator(".dex-research-card h3")).toHaveText("？？？ピザ");
  await expect(section).toContainText("✓ チキンを使う");
  await expectNoOverflow(page, "dex");
  await shot(page, "01-dex-research-card");
  await section.getByRole("button", { name: "？？？ピザを研究する" }).click();

  // cooking: research context replaces the free-cook order card
  await page.waitForSelector(".pizza-stage");
  const ctx = page.getByTestId("research-context");
  await expect(ctx).toBeVisible();
  await expect(ctx).toContainText("🔎 研究中");
  await expect(ctx).toContainText("？？？ピザ");
  await expect(ctx).toContainText("✓ チキン");
  await expect(ctx).not.toContainText(/全部で|残り|あと|No\./);
  await expectNoOverflow(page, "cooking");
  await expectNoUndiscoveredIdentity(page, discovered, "cooking context");
  const box = await ctx.boundingBox();
  const vh = page.viewportSize()!.height;
  expect(box!.y + box!.height).toBeLessThanOrEqual(vh);
  await shot(page, "02-cooking-research-context");

  // Hint: the explicit Research Target is the subject (a pool of one here, and the ladder opens)
  await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
  await expectNoOverflow(page, "hint sheet");
  await expectNoUndiscoveredIdentity(page, discovered, "hint sheet");
  await shot(page, "03-hint-sheet");
  await dialog.locator(".hint-sheet__h5-next .hint-sheet__next").click();
  await expect(dialog.locator(".hint-sheet__fact-line, .hint-sheet__chip").first()).toBeVisible();
  await expectNoUndiscoveredIdentity(page, discovered, "after purchase");
});

test("B. Step 12 multiple: pick ② -> only it is the Hint subject, the other stays anonymous", async ({ page }) => {
  const { discovered, json } = save(12);
  await open(page, json);
  await openDex(page);
  const section = page.locator(".dex-overlay__research");
  await section.scrollIntoViewIfNeeded();
  const titles = await section.locator(".dex-research-card h3").allTextContents();
  expect(titles.slice(0, 2)).toEqual(["？？？ピザ ①", "？？？ピザ ②"]);
  const ctas = section.locator("button");
  await expect(ctas).toHaveCount(titles.length);
  // no hidden name / id in the section DOM or its aria labels
  const html = await section.evaluate((e) => e.outerHTML);
  for (const r of RECIPES.filter((x) => !discovered.includes(x.id))) {
    expect(html).not.toContain(r.nameJa);
    expect(html).not.toContain(`"${r.id}"`);
  }
  await expectNoOverflow(page, "dex multi");
  await shot(page, "04-dex-multi");
  await section.getByRole("button", { name: "？？？ピザ ②を研究する" }).click();
  await page.waitForSelector(".pizza-stage");
  const ctx = page.getByTestId("research-context");
  await expect(ctx).toContainText("？？？ピザ ②");
  await expect(ctx).not.toContainText("？？？ピザ ①");
  await expectNoOverflow(page, "cooking multi");
  await shot(page, "05-cooking-multi");
  await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
  await expectNoUndiscoveredIdentity(page, discovered, "hint sheet multi");
  await expectNoOverflow(page, "hint multi");
  await shot(page, "06-hint-multi");
});

test("D. no Research Target: plain Free Cooking keeps the OPEN_POOL hint (no ladder, no research context)", async ({ page }) => {
  const { json } = save(12);
  await open(page, json);
  await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("research-context")).toHaveCount(0);
  await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveAttribute("data-hint-ladder", "hint5");
});

test("E. a bought rung survives a reload and shows on the research card (discoveryHintFacts only)", async ({ page }) => {
  const { json } = save(25, ["brazilian-calabresa"]);
  await open(page, json);
  await openDex(page);
  await page.locator(".dex-overlay__research").getByRole("button", { name: "？？？ピザを研究する" }).click();
  await page.waitForSelector(".pizza-stage");
  await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await dialog.locator(".hint-sheet__h5-next .hint-sheet__next").click(); // SAUCE
  await page.reload();
  await page.waitForSelector(".app-frame");
  await openDex(page);
  const card = page.locator(".dex-overlay__research .dex-research-card");
  await expect(card).toContainText("✓ チキンを使う");
  await expect(card).toContainText("✓ ジェノベーゼソースを使う");
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
  expect(JSON.stringify(stored)).not.toMatch(/researchTarget/);
});
