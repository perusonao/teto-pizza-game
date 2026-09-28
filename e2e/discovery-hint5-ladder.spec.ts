import { test, expect, type Page } from "@playwright/test";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Discovery Hint 5.0 (Issue #292), H5-3: the linear ladder sheet on mobile (390×844 and 360×800 via
 * the two iphone projects).
 *
 * **Flag.** The flag is OFF by default in every build. These tests turn it on through the DEV-only
 * opt-in (`localStorage["teto.dev.hint5Ladder"] = "1"` before load; src/logic/discovery/hint5Flag.ts).
 * Without the opt-in the old sheet must still render (flag-OFF parity).
 *
 * **Target: meat-lovers.** It has 3 sub-toppings, all 🥩 肉系, so the LAST one is still classified
 * (AC-1).
 *
 * **Checked at every state:**
 * - no horizontal overflow;
 * - the sheet and its CTA inside the viewport, and the CTA and 閉じる at least 44 px tall;
 * - no clipped hint line or label;
 * - no undiscovered recipe identity in the DOM.
 *
 * `HINT5_SCREENSHOTS=1` also writes the Human Verification screenshots to
 * docs/reports/screenshots/hint-5-ladder/.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const OPT_IN_KEY = "teto.dev.hint5Ladder";
const SEED_DOCUMENT = "icons/icon-16.png";
/** The shipped W1 Discovery Ladder: [target, materials its step unlocks]. */
const LADDER = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]], ["pizza-portuguesa", ["onion"]], ["fugazza", ["olive-oil"]],
  ["marinara", ["garlic"]],
] as const;
/** meat-lovers (ladder step 8) is the main target. */
const DEX = LADDER.slice(0, 8).map(([id]) => id as string);

/** The ladder played up to (not including) `target`, whose materials are owned and stocked: the
 *  DISCOVERABLE hint target is `target`. */
function save(facts: Record<string, string[]> = {}, target = "meat-lovers", pitzBalance = 999) {
  const index = LADDER.findIndex(([id]) => id === target);
  const materials = LADDER.slice(1, index + 1).flatMap(([, m]) => m as readonly string[]);
  return {
    schemaVersion: 2,
    dex: LADDER.slice(0, index).map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
    missionBest: {},
    inventory: Object.fromEntries(materials.map((m) => [m, 10])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: facts,
  };
}
const dexOf = (target: string) => LADDER.slice(0, LADDER.findIndex(([id]) => id === target)).map(([id]) => id as string);

async function openSheet(page: Page, s: object, optIn: boolean) {
  await page.goto(SEED_DOCUMENT);
  await page.evaluate(
    ([key, value, optKey, on]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
      if (on) localStorage.setItem(optKey, "1");
    },
    [SAVE_KEY, JSON.stringify(s), OPT_IN_KEY, optIn] as const,
  );
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

const nextTitle = (page: Page) => page.locator(".hint-sheet__h5-next .hint-sheet__card-title");
const cta = (page: Page) => page.locator(".hint-sheet__h5-next .hint-sheet__next");

/** Mobile layout contract for the ladder sheet. */
async function expectLayout(page: Page, where: string) {
  const m = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    // Every text-bearing element of the sheet: no clipped content (scrollWidth > clientWidth).
    const clipped = [...document.querySelectorAll<HTMLElement>(".hint-sheet .hint-sheet__card-title, .hint-sheet .hint-sheet__row, .hint-sheet .hint-sheet__fact-line, .hint-sheet .hint-sheet__chip, .hint-sheet .hint-sheet__next, .hint-sheet .hint-sheet__wallet, .hint-sheet .hint-sheet__outcome, .hint-sheet .hint-sheet__guidance")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.className}: ${el.textContent}`);
    return {
      vw,
      vh,
      scrollWidth: document.documentElement.scrollWidth,
      sheet: rect(".hint-sheet"),
      cta: rect(".hint-sheet__h5-next .hint-sheet__next"),
      close: rect(".hint-sheet__close"),
      clipped,
    };
  });
  expect(m.scrollWidth, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
  expect(m.sheet!.left, where).toBeGreaterThanOrEqual(0);
  expect(m.sheet!.right, where).toBeLessThanOrEqual(m.vw + 0.5);
  expect(m.sheet!.bottom, where).toBeLessThanOrEqual(m.vh + 0.5);
  expect(m.close!.height, `${where}: 閉じる`).toBeGreaterThanOrEqual(44);
  if (m.cta) {
    expect(m.cta.height, `${where}: CTA height`).toBeGreaterThanOrEqual(44);
    expect(m.cta.bottom, `${where}: CTA cut off`).toBeLessThanOrEqual(m.vh + 0.5);
    expect(m.cta.top, where).toBeGreaterThanOrEqual(0);
  }
  expect(m.clipped, `${where}: clipped text`).toEqual([]);
}

async function shot(page: Page, name: string) {
  if (process.env.HINT5_SCREENSHOTS !== "1") return;
  const project = test.info().project.name.replace("iphone-", "");
  await page.screenshot({ path: `docs/reports/screenshots/hint-5-ladder/${project}-${name}.png` });
}

async function ask(page: Page) {
  await expect(cta(page)).not.toHaveAttribute("aria-disabled", "true");
  await cta(page).click();
}

test.describe("Hint 5.0 ladder sheet (H5-3, DEV opt-in)", () => {

  test("flag OFF (no opt-in): the existing sheet renders unchanged", async ({ page }) => {
    const dialog = await openSheet(page, save(), false);
    await expect(dialog).not.toHaveAttribute("data-hint-ladder", "hint5");
    await expect(dialog.getByRole("button", { name: "ヒントをもらう" })).toBeVisible();
    await shot(page, "00-before-flag-off");
  });

  test("buys the whole meat-lovers ladder: one next rung at a time, normal prices, the last sub-topping still classified", async ({ page }) => {
    const dialog = await openSheet(page, save(), true);
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    await expectLayout(page, "initial");
    await shot(page, "01-initial");
    const expected = [
      ["ヒント1: ソース", "10 Pitz"],
      ["ヒント2: チーズ", "10 Pitz"],
      ["ヒント3: キートッピング", "10 Pitz"],
      ["ヒント4: 構成（材料の数）", "5 Pitz"],
      ["ヒント5: サブトッピング①の分類", "5 Pitz"],
      ["ヒント6: サブトッピング②の分類", "5 Pitz"],
      ["ヒント7: サブトッピング③の分類", "5 Pitz"],
    ];
    let balance = 999;
    for (const [label, price] of expected) {
      await expect(nextTitle(page)).toContainText(label);
      await expect(cta(page)).toHaveText(`たずねる ${price}`);
      // Nothing about later rungs is on screen before this purchase.
      const later = expected.slice(expected.findIndex(([l]) => l === label) + 1).map(([l]) => l.split(":")[0]);
      for (const l of later) await expect(dialog).not.toContainText(`${l}:`);
      await expectLayout(page, label);
      // No SUB_CLASS entry before STRUCTURE has been bought (the sub-topping count is paid information).
      if (!label.startsWith("ヒント5") && !label.startsWith("ヒント6") && !label.startsWith("ヒント7")) {
        await expect(dialog.locator('[data-hint5-rung="SUB_CLASS"]')).toHaveCount(0);
      }
      await ask(page);
      balance -= Number(price.split(" ")[0]);
      await expect(dialog.locator(".hint-sheet__footer--h5 .hint-sheet__wallet").last()).toContainText(`所持 ${balance} Pitz`);
      if (label.startsWith("ヒント4")) await shot(page, "02-after-structure");
    }
    expect(balance).toBe(999 - 50); // 10 + 10 + 10 + 5 + 5 + 5 + 5
    const classes = dialog.locator('[data-hint5-rung="SUB_CLASS"]');
    await expect(classes).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) await expect(classes.nth(i)).toContainText("肉系");
    await expect(dialog).toContainText("ここまでのヒントで、推理してみよう！");
    for (const sub of ["ベーコン", "ペパロニ", "ソーセージ"]) await expect(dialog).not.toContainText(sub);
    await expect(cta(page)).toHaveCount(0);
    // Nothing the board shows is repeated in 「以前のヒント」 (a fresh save has no archive at all).
    await expect(dialog.locator(".hint-sheet__legacy")).toHaveCount(0);
    await expectLayout(page, "complete");
    await dialog.locator(".hint-sheet__board").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await shot(page, "03-complete-last-sub-classified");
    await expectNoUndiscoveredIdentity(page, DEX, "hint5 ladder complete");
    // Reload: nothing is resold, and the bought board is back.
    await page.reload();
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /フリークッキング/ }).first().click();
    await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
    await expect(page.locator('[data-hint5-rung="SUB_CLASS"]')).toHaveCount(3);
    await expect(cta(page)).toHaveCount(0);
  });

  test("M3 legacy save: the same first offer as a fresh save; 「もう知っていた」 only after the request, at 0 Pitz", async ({ page }) => {
    const dialog = await openSheet(page, save({ "meat-lovers": ["ing:tomato-sauce", "ing:mozzarella"] }), true);
    await expect(nextTitle(page)).toContainText("ヒント1: ソース");
    await expect(cta(page)).toHaveText("たずねる 10 Pitz");
    await expect(dialog).not.toContainText("もう知っていた");
    await expect(dialog.locator(".hint-sheet__legacy")).toContainText("トマトソース");
    await shot(page, "04-legacy-before-request");
    await ask(page);
    await expect(dialog).toContainText("このヒントはもう知っていたよ！");
    await expect(dialog.locator(".hint-sheet__footer--h5 .hint-sheet__wallet").last()).toContainText("所持 999 Pitz");
    await expect(nextTitle(page)).toContainText("ヒント2: チーズ");
    await expect(cta(page)).toHaveText("たずねる 10 Pitz");
    await expectLayout(page, "already known");
    await shot(page, "05-legacy-already-known");
    await expectNoUndiscoveredIdentity(page, DEX, "hint5 ladder legacy");
  });

  test("M3 PARTIAL (parmigiana: mozzarella known, parmigiano not) -> normal price and the whole cheese rung; NONE (sauce) -> normal price", async ({ page }) => {
    const dialog = await openSheet(page, save({ "parmigiana-pizza": ["ing:mozzarella"] }, "parmigiana-pizza"), true);
    const wallet = dialog.locator(".hint-sheet__footer--h5 .hint-sheet__wallet").last();
    // NONE known: the sauce costs 10.
    await expect(nextTitle(page)).toContainText("ヒント1: ソース");
    await ask(page);
    await expect(wallet).toContainText("所持 989 Pitz");
    await expect(dialog).not.toContainText("もう知っていた");
    // PARTIAL known: the cheese rung still costs 10 and discloses both cheeses.
    await expect(nextTitle(page)).toContainText("ヒント2: チーズ");
    await expect(cta(page)).toHaveText("たずねる 10 Pitz");
    await ask(page);
    await expect(wallet).toContainText("所持 979 Pitz");
    const cheese = dialog.locator('[data-hint5-rung="CHEESE"]');
    await expect(cheese).toContainText("モッツァレラ");
    await expect(cheese).toContainText("パルミジャーノ");
    await expect(dialog).not.toContainText("もう知っていた");
    await expectLayout(page, "partial");
    await shot(page, "06-partial-cheese-rung");
    await expectNoUndiscoveredIdentity(page, dexOf("parmigiana-pizza"), "hint5 partial");
  });

  test("a single-candidate family (breakfast-pizza: egg = the only 'other') is shown as its classification label, never the name", async ({ page }) => {
    const dialog = await openSheet(page, save({}, "breakfast-pizza"), true);
    for (let i = 0; i < 5; i += 1) await ask(page);
    const row = dialog.locator('[data-hint5-rung="SUB_CLASS"]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("ちょっと変わった材料");
    await expect(dialog).not.toContainText("たまご");
    await expect(cta(page)).toHaveCount(0);
    await expectLayout(page, "single candidate");
    await dialog.locator(".hint-sheet__board").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await shot(page, "07-single-candidate-class");
    await expectNoUndiscoveredIdentity(page, dexOf("breakfast-pizza"), "hint5 single candidate");
  });

  test("RESERVED_EMPTY_RUNG (marinara has no cheese): offered like any rung; a request changes nothing and says nothing (P4 / P4b not pre-empted)", async ({ page }) => {
    const dialog = await openSheet(page, save({}, "marinara"), true);
    await ask(page); // the sauce
    const wallet = dialog.locator(".hint-sheet__footer--h5 .hint-sheet__wallet").last();
    await expect(wallet).toContainText("所持 989 Pitz");
    await expect(nextTitle(page)).toContainText("ヒント2: チーズ");
    await expect(cta(page)).toHaveText("たずねる 10 Pitz");
    const before = await dialog.innerHTML();
    await ask(page);
    await page.waitForTimeout(700);
    await expect(wallet).toContainText("所持 989 Pitz");
    await expect(nextTitle(page)).toContainText("ヒント2: チーズ");
    for (const word of ["チーズは使わない", "チーズなし", "ソースなし", "もう知っていた"]) await expect(dialog).not.toContainText(word);
    expect((await dialog.innerHTML()).replace(/ aria-disabled="true"/g, "")).toBe(before.replace(/ aria-disabled="true"/g, ""));
    // A name the ladder already shows is not repeated in 「以前のヒント」.
    await expect(dialog.locator(".hint-sheet__legacy")).toHaveCount(0);
    await expectLayout(page, "reserved");
  });
});
