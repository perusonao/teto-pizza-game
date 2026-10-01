import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { completeDoughStep } from "./gestures";
import { PROFILES, ProfileDriver, readViewport, type Profile } from "./support/layoutProfiles";
import { runOnlyOnWidth } from "./support/projectGuard";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Discovery Hint 2.0 (Issue #229, 229-B): the Free Cooking hint bottom sheet on mobile.
 *
 * For each state (sheet closed / H1 / H3 / longest H4 / the empty states) and each profile
 * (390×844, 360×800, the short 390×664 / 360×640 and, on Chromium, the three safe-area profiles), checks:
 * no horizontal overflow, the sheet inside the viewport (DH4-2C / OD-DH4-2-7: a near-full-screen sheet
 * below the top safe area, which supersedes the 45dvh cap of OD-H3-4-7), its CTA visible above
 * the bottom safe-area inset, and the cooking screen underneath (stage, tabs, tray pager, bake
 * bar) at exactly the same place as with the sheet closed. Closing returns focus to 「ヒント」.
 *
 * Discovery Hint 3.0 (Issue #238, H3-3): from Dex 1 the sheet is the Selectable one (H0, one
 * fact, the longest legacy + all facts + guidance content); Dex 0 Margherita keeps the free flow.
 *
 * The profiles are forced per state, so this runs once per engine (the *-390x844 project).
 * The final Layout Contract matrix for the sheet is 229-E.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const SEED_DOCUMENT = "icons/icon-16.png";
const LADDER = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
  ["capricciosa", ["black-olive", "oregano"]], ["pizza-portuguesa", ["onion"]], ["fugazza", ["olive-oil"]],
  ["marinara", ["garlic"]], ["napoletana", ["anchovy"]], ["tonno-e-cipolla", ["tuna"]], ["pesto-tonno", ["pesto"]],
  ["genovese", ["cherry-tomato"]], ["new-haven-apizza", ["clam"]], ["pesto-caprese", ["fresh-tomato"]],
  ["pesto-patate", ["potato"]], ["pizza-bianca", ["rosemary"]], ["puttanesca-pizza", ["capers"]],
  ["quattro-formaggi", ["fontina", "gorgonzola"]],
] as const;

/** Discovery 3.0 PR-4a: production recipes that never advance the ladder (`ladderCredit: false`). The ladder's own recipes
 *  are not the whole population once one exists, so "every ladder recipe discovered" is not "complete": a COMPLETE seed also
 *  discovers these. Empty for the 25 recipes that existed before PR-4 (the seed is then unchanged). */
const NON_CREDIT: readonly string[] = RECIPES.filter((r) => (r as { ladderCredit?: false }).ladderCredit === false).map((r) => r.id as string);

/** The ladder played to `count` discoveries; the materials of steps <= count owned with `stock`
 *  (the newest step's with `newestStock`, or not owned at all when `newestOwned` is false). */
function ladderSave(
  count: number,
  opts: { newestOwned?: boolean; newestStock?: number; pitz?: number; purchases?: Record<string, number>; complete?: boolean } = {},
) {
  const materials = LADDER.slice(1, count + 1).flatMap(([, m]) => m);
  const newest = count >= 1 && count < LADDER.length ? LADDER[count][1] : [];
  const owned = materials.filter((m) => opts.newestOwned !== false || !(newest as readonly string[]).includes(m));
  return {
    schemaVersion: 2,
    dex: [...LADDER.slice(0, count).map(([recipeId]) => recipeId as string), ...(opts.complete ? NON_CREDIT : [])].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: opts.pitz ?? 999,
    ...(opts.purchases ? { discoveryHintPurchases: opts.purchases } : {}),
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, (newest as readonly string[]).includes(m) ? (opts.newestStock ?? 10) : 10])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
  };
}

const DEX11 = LADDER.slice(0, 11).map(([id]) => id);

async function openWithSave(page: Page, save: { dex: unknown[] }) {
  await page.goto(SEED_DOCUMENT);
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    // Hint 5.0 is ON by default (H5-6); this suite covers the pre-Hint-5.0 sheet (the rollback path).
    localStorage.setItem("teto.dev.hint5Ladder", "0");
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${save.dex.length}/${RECIPES.length}`));
}

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const sheet = (page: Page) => page.getByRole("dialog", { name: /ヒント/ });

async function startFreeCookAtTopping(page: Page) {
  await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  for (let i = 0; i < 3; i += 1) {
    const nextButton = bar(page).getByRole("button", { name: /次へ/ });
    if (!(await nextButton.count())) break;
    await nextButton.click();
  }
}

const BACKGROUND = [".pizza-stage", ".making-step-tabs", ".ingredient-page-nav", ".prepare-bake-bar", ".order-card"];

async function backgroundRects(page: Page) {
  return page.evaluate((sels) => {
    const out: Record<string, number[] | null> = {};
    for (const sel of sels) {
      const el = document.querySelector(sel);
      const b = el?.getBoundingClientRect();
      out[sel] = b ? [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10) : null;
    }
    return out;
  }, BACKGROUND);
}

async function sheetMetrics(page: Page) {
  return page.evaluate(() => {
    const s = document.querySelector(".hint-sheet")!.getBoundingClientRect();
    // U3-C: the board's 「ヒントをもらう」 entry, or on the family panel its Pitz line (the last fixed row).
    const cta =
      document.querySelector(".hint-sheet__entry") ??
      document.querySelector(".hint-sheet__panel > .hint-sheet__wallet") ??
      document.querySelector(".hint-sheet__next") ??
      document.querySelector(".hint-sheet__done") ??
      document.querySelector(".hint-sheet__empty-body");
    const c = cta!.getBoundingClientRect();
    const close = document.querySelector(".hint-sheet__close")!.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      u3: document.querySelector(".hint-sheet")!.classList.contains("hint-sheet--u3"),
      sheet: { top: s.top, bottom: s.bottom, left: s.left, right: s.right, height: s.height },
      cta: { top: c.top, bottom: c.bottom },
      close: { top: close.top, bottom: close.bottom },
    };
  });
}

function profilesFor(browserName: string): Profile[] {
  // #229 Final Gate: the 7 Layout Contract profiles on Chromium; N and S at both widths on WebKit
  // (no safe-area override there).
  const all = Object.values(PROFILES);
  return browserName === "chromium" ? all : all.filter((p) => !p.inset);
}

/** Every profile: sheet geometry, and the background exactly where it is with the sheet closed. */
async function checkOpenState(page: Page, driver: ProfileDriver, browserName: string, label: string, closed: Map<string, unknown>) {
  for (const profile of profilesFor(browserName)) {
    await driver.apply(profile);
    const vp = await readViewport(page);
    const m = await sheetMetrics(page);
    const where = `${label} @${profile.id}`;
    expect.soft(m.scrollWidth, `${where}: horizontal overflow`).toBeLessThanOrEqual(vp.innerWidth);
    if (m.u3) {
      // DH4-2C (OD-DH4-2-7, audit §12): near-full-screen, up to the top safe area + 56px, so the app
      // header stays visible.
      expect.soft(m.sheet.top, `${where}: sheet below the top safe area + the app header`).toBeGreaterThanOrEqual(vp.sat + 56 - 0.5);
    } else {
      // The TARGET (Dex-0 onboarding) and empty sheets keep the 45dvh cap.
      expect.soft(m.sheet.height, `${where}: sheet <= 45dvh`).toBeLessThanOrEqual(vp.innerHeight * 0.45 + 1);
    }
    expect.soft(m.sheet.bottom, `${where}: sheet inside the viewport`).toBeLessThanOrEqual(vp.innerHeight + 0.5);
    expect.soft(m.sheet.left >= -0.5 && m.sheet.right <= vp.innerWidth + 0.5, `${where}: sheet width`).toBe(true);
    expect.soft(m.cta.bottom, `${where}: CTA above the bottom safe area`).toBeLessThanOrEqual(vp.innerHeight - vp.sab + 0.5);
    expect.soft(m.cta.top, `${where}: CTA inside the sheet`).toBeGreaterThanOrEqual(m.sheet.top);
    expect.soft(m.close.top, `${where}: 閉じる inside the sheet`).toBeGreaterThanOrEqual(m.sheet.top);
    expect.soft(await backgroundRects(page), `${where}: background unmoved`).toEqual(closed.get(profile.id));
    // H3-4 (OD-H3-4-7): in the Selectable sheet the category controls and the CTA stay reachable
    // (inside the sheet and the viewport, >= 44px tall), and a scrollable body shows its cue.
    const sel = await selectableMetrics(page);
    if (sel) {
      // Every control on the board (「ヒントをもらう」, 閉じる) is >= 44px and reachable.
      for (const pref of sel.prefs) {
        expect.soft(pref.height, `${where}: control >= 44px`).toBeGreaterThanOrEqual(44);
        expect.soft(pref.top >= m.sheet.top && pref.bottom <= vp.innerHeight - vp.sab + 0.5, `${where}: control reachable`).toBe(true);
      }
      // OD-DH4-2-7 capacity (audit §11/§12): the persistent footer is one CTA row + one Pitz line
      // (compact, <= 80px), and the 「わかっていること」 board keeps a readable height -- CAP-2 >= 150px
      // even at 360x640 + safe area, and CAP-3 never smaller than the footer + the bottom safe area.
      expect.soft(sel.footer, `${where}: compact footer`).toBeLessThanOrEqual(80);
      expect.soft(sel.client, `${where}: board visible height (CAP-2)`).toBeGreaterThanOrEqual(Math.min(150, sel.scroll));
      expect.soft(sel.client, `${where}: board >= footer + safe area (CAP-3)`).toBeGreaterThanOrEqual(Math.min(sel.footer + vp.sab, sel.scroll));
      await expect
        .poll(async () => {
          const now = await selectableMetrics(page);
          return !!now && now.scrollable === (now.cueBelow || now.cueAbove);
        }, { message: `${where}: scroll cue matches the body`, timeout: 2000 })
        .toBe(true);
    }
    // The transient family panel: every control >= 44px and inside the sheet's width; the cards area
    // sits between the panel head and the Pitz line, above the bottom safe area.
    const panel = await panelMetrics(page);
    if (panel) {
      for (const c of panel.controls) {
        expect.soft(c.height, `${where}: panel control >= 44px`).toBeGreaterThanOrEqual(44);
        expect.soft(c.left >= m.sheet.left - 0.5 && c.right <= m.sheet.right + 0.5, `${where}: panel control inside the sheet width`).toBe(true);
      }
      expect.soft(panel.back.top, `${where}: もどる inside the sheet`).toBeGreaterThanOrEqual(m.sheet.top);
      expect.soft(panel.cards.bottom, `${where}: cards above the bottom safe area`).toBeLessThanOrEqual(vp.innerHeight - vp.sab + 0.5);
      expect.soft(panel.cards.client, `${where}: cards area readable`).toBeGreaterThanOrEqual(Math.min(150, panel.cards.scroll));
      await expect
        .poll(async () => {
          const now = await panelMetrics(page);
          return !!now && now.scrollable === now.cue;
        }, { message: `${where}: panel scroll cue matches the cards`, timeout: 2000 })
        .toBe(true);
    }
  }
  await driver.apply(PROFILES.N390);
}

/** H3-4: the Selectable sheet's preference controls and body scroll cue (null for other sheets). */
async function selectableMetrics(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".hint-sheet__selectable");
    const wrap = document.querySelector(".hint-sheet__scroll");
    if (!body || !wrap) return null;
    const prefs = [...document.querySelectorAll(".hint-sheet__entry, .hint-sheet__close")].map((e) => {
      const b = e.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, height: b.height };
    });
    const footer = document.querySelector(".hint-sheet__footer")!.getBoundingClientRect().height;
    const scrollable = body.scrollHeight - body.clientHeight > 1;
    const cueBelow = wrap.classList.contains("hint-sheet__scroll--below");
    const cueAbove = wrap.classList.contains("hint-sheet__scroll--above");
    return { prefs, footer, scrollable, cueBelow, cueAbove, client: body.clientHeight, scroll: body.scrollHeight };
  });
}

/** DH4-2C: the 「ヒントをもらう」 family panel (null while the board shows). */
async function panelMetrics(page: Page) {
  return page.evaluate(() => {
    const cards = document.querySelector<HTMLElement>(".hint-sheet__cards");
    if (!cards) return null;
    const controls = [...document.querySelectorAll(".hint-sheet__panel button, .hint-sheet__pref")].map((e) => {
      const b = e.getBoundingClientRect();
      return { height: b.height, left: b.left, right: b.right };
    });
    const back = document.querySelector(".hint-sheet__back")!.getBoundingClientRect();
    const c = cards.getBoundingClientRect();
    const wrap = document.querySelector(".hint-sheet__cards-wrap")!;
    const scrollable = cards.scrollHeight - cards.clientHeight > 1;
    const cue = wrap.classList.contains("hint-sheet__scroll--below") || wrap.classList.contains("hint-sheet__scroll--above");
    return { controls, back: { top: back.top }, scrollable, cue, cards: { bottom: c.bottom, client: cards.clientHeight, scroll: cards.scrollHeight } };
  });
}

const entry = (page: Page) => sheet(page).getByRole("button", { name: "ヒントをもらう" });
const materialCta = (page: Page) => sheet(page).locator('.hint-sheet__card[data-hint-family="material"] .hint-sheet__next');

/** DH4-2C U3-C: open the family panel (from the board) and wait out the request latch. */
async function openPanel(page: Page) {
  if (await entry(page).count()) {
    // Right after an answer the request latch also covers 「ヒントをもらう」 (a double tap never reopens).
    await expect(entry(page)).not.toHaveAttribute("aria-disabled", "true");
    await entry(page).click();
  }
  await expect(sheet(page).locator(".hint-sheet__panel")).toBeVisible();
}

/** One 材料 request like a player: 「ヒントをもらう」 -> 「たずねる」. */
async function askMaterial(page: Page) {
  await openPanel(page);
  await expect(materialCta(page)).not.toHaveAttribute("aria-disabled", "true");
  await materialCta(page).click();
}

async function closedRects(page: Page, driver: ProfileDriver, browserName: string) {
  const out = new Map<string, unknown>();
  for (const profile of profilesFor(browserName)) {
    await driver.apply(profile);
    out.set(profile.id, await backgroundRects(page));
  }
  await driver.apply(PROFILES.N390);
  return out;
}

async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test.describe("Discovery Hint 2.0 sheet (229-B)", () => {
  test.beforeEach(() => runOnlyOnWidth(test.info(), 390));

  // Discovery Hint 3.0 (Issue #238, H3-3): from Dex 1 the sheet is the Selectable one. Same
  // geometry contract for its states: H0, one fact, and the longest content (a legacy Economy 1.0
  // save's 「以前のヒント」 line + every fact + the guidance line).
  test("target flow: closed -> H0 -> one fact -> longest (legacy + all facts + guidance), background never moves, close restores", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    // Dex 11 with the ladder's materials: capricciosa (6 ingredients) is today's target.
    await openWithSave(page, ladderSave(11));
    await startFreeCookAtTopping(page);
    const closed = await closedRects(page, driver, browserName);
    await capture(page, "01-closed-topping");

    const hint = bar(page).getByRole("button", { name: "ヒント" });
    await hint.click();
    await expect(sheet(page)).toHaveAttribute("data-hint-kind", "SELECTABLE");
    // U3-C (OD-DH4-2-8): only acquired facts -- the free key's row -- and no 「？」.
    await expect(sheet(page).locator(".hint-sheet__row")).toHaveCount(1);
    await expect(sheet(page)).not.toContainText("？");
    // OD-DH4-2-7: the board's footer is 「ヒントをもらう」 only -- no choices on the board.
    await expect(sheet(page).getByRole("radio")).toHaveCount(0);
    await expect(entry(page)).toBeFocused();
    await checkOpenState(page, driver, browserName, "H0", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "sheet H0");
    await capture(page, "02-h0");

    // The panel: 材料 / 構成 / 特徴 cards (on in every build since OD-DH4-PROD-1) + 4 材料 preferences.
    await openPanel(page);
    await expect(sheet(page).locator(".hint-sheet__card")).toHaveCount(3);
    await expect(sheet(page).getByRole("radio")).toHaveCount(4);
    await checkOpenState(page, driver, browserName, "panel", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "sheet panel");
    await capture(page, "02b-panel");

    await sheet(page).getByRole("radio", { name: "トッピング" }).check({ force: true });
    await materialCta(page).click();
    // An answer returns to the board with the new fact.
    await expect(sheet(page).locator(".hint-sheet__panel")).toHaveCount(0);
    await expect(sheet(page).locator(".hint-sheet__chip")).toHaveCount(2);
    await checkOpenState(page, driver, browserName, "one fact", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "sheet one fact");
    await capture(page, "03-one-fact");
    await sheet(page).getByRole("button", { name: "閉じる" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(hint).toBeFocused();
    expect(await backgroundRects(page)).toEqual(closed.get("N390"));

    // Longest: a legacy H3 buyer (the count line kept) who then buys every remaining fact.
    await openWithSave(page, ladderSave(11, { purchases: { capricciosa: 3 } }));
    await startFreeCookAtTopping(page);
    const closedLegacy = await closedRects(page, driver, browserName);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    await expect(sheet(page)).toContainText("以前のヒント");
    for (let i = 0; i < 6 && !(await sheet(page).locator(".hint-sheet__outcome").count()); i += 1) {
      await askMaterial(page);
    }
    await expect(sheet(page).locator(".hint-sheet__outcome")).toHaveText("材料ヒントはここまで（Pitzは使っていないよ）");
    await sheet(page).getByRole("button", { name: /もどる/ }).click();
    await expect(sheet(page).locator(".hint-sheet__guidance")).toHaveText("このピザは、今わかっているヒントを手がかりに考えてみよう！");
    await expect(sheet(page).locator(".hint-sheet__chip")).toHaveCount(5);
    await expect(sheet(page)).not.toContainText("カプリチョーザ");
    await expect(sheet(page)).not.toContainText("ブラックオリーブ");
    await checkOpenState(page, driver, browserName, "longest", closedLegacy);
    await expectNoUndiscoveredIdentity(page, DEX11, "sheet longest");
    await capture(page, "04-longest");

    // Background taps are blocked by the sheet's backdrop; closing restores everything.
    await sheet(page).getByRole("button", { name: "閉じる" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(bar(page).getByRole("button", { name: "ヒント" })).toBeFocused();
    expect(await backgroundRects(page)).toEqual(closedLegacy.get("N390"));
    await page.getByRole("button", { name: "次のページ" }).click();
    await capture(page, "05-closed-after");
  });

  // DH4 Production Enablement (OD-DH4-PROD-1): 構成 5 / 特徴 5 through the real sheet, then the board
  // with the 材料 / 構成 / 特徴 sections on the same geometry contract, and a reload that keeps them
  // without selling them again.
  test("DH4-PROD: 構成 + 特徴 at 5 Pitz each, board sections on every profile, reload keeps them", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page, ladderSave(11, { pitz: 100 }));
    await startFreeCookAtTopping(page);
    const closed = await closedRects(page, driver, browserName);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    await openPanel(page);
    const familyCta = (family: string) => sheet(page).locator(`.hint-sheet__card[data-hint-family="${family}"] .hint-sheet__next`);
    await expect(familyCta("structure")).toHaveText("たずねる 5 Pitz");
    await expect(familyCta("attribute")).toHaveText("たずねる 5 Pitz");
    await capture(page, "dh4prod-01-panel");

    await familyCta("structure").click();
    await expect(sheet(page).locator(".hint-sheet__panel")).toHaveCount(0);
    await expect(sheet(page).locator('[data-hint-section="structure"]')).toContainText("このピザは全部で6種類の材料を使うよ");
    await expect(sheet(page)).toContainText("所持 95 Pitz");
    await capture(page, "dh4prod-02-structure");

    await openPanel(page);
    await expect(familyCta("structure")).toHaveText("✓ もらいずみ");
    await expect(familyCta("attribute")).not.toHaveAttribute("aria-disabled", "true");
    await familyCta("attribute").click();
    // 特徴 charges only when it answers; an existence-only outcome is free and stays on the panel.
    const answered = sheet(page).locator('[data-hint-section="attribute"]');
    const nothingYet = sheet(page).getByText("今はまだ、大きな手がかりが見つからなかったよ", { exact: false });
    await expect(answered.or(nothingYet)).toBeVisible();
    const pitz = (await answered.count()) ? 90 : 95;
    await expect(sheet(page)).toContainText(`所持 ${pitz} Pitz`);
    if (await sheet(page).locator(".hint-sheet__panel").count()) await sheet(page).getByRole("button", { name: /もどる/ }).click();
    await checkOpenState(page, driver, browserName, "DH4-PROD board", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "DH4-PROD board");
    await capture(page, "dh4prod-03-board");
    await sheet(page).getByRole("button", { name: "閉じる" }).click();

    // Reload: the lines come back from the save; nothing is sold again.
    await page.reload();
    await page.waitForSelector(".app-frame");
    await startFreeCookAtTopping(page);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    await expect(sheet(page).locator('[data-hint-section="structure"]')).toContainText("このピザは全部で6種類の材料を使うよ");
    await expect(sheet(page)).toContainText(`所持 ${pitz} Pitz`);
    await openPanel(page);
    await expect(familyCta("structure")).toHaveText("✓ もらいずみ");
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.pitzBalance).toBe(pitz);
    expect(saved.discoveryHintFacts.capricciosa).toContain("meta:ingredient-total");
    expect(saved.schemaVersion).toBe(2);
    await expectNoUndiscoveredIdentity(page, DEX11, "DH4-PROD reload panel");
  });

  for (const [kind, save, text] of [
    ["SHOP_NEW", ladderSave(6, { newestOwned: false }), /ショップに入荷した材料/],
    ["REFILL", ladderSave(6, { newestStock: 0 }), /材料が足りない/],
    ["COMPLETE", ladderSave(25, { complete: true }), /図鑑コンプリート/],
  ] as const) {
    test(`empty state ${kind}`, async ({ page, browserName }) => {
      const driver = await ProfileDriver.create(page, browserName);
      await driver.apply(PROFILES.N390);
      await openWithSave(page, save);
      await startFreeCookAtTopping(page);
      const closed = await closedRects(page, driver, browserName);
      await bar(page).getByRole("button", { name: "ヒント" }).click();
      await expect(sheet(page)).toHaveAttribute("data-hint-kind", kind);
      await expect(sheet(page)).toContainText(text);
      await checkOpenState(page, driver, browserName, kind, closed);
      await expectNoUndiscoveredIdentity(page, save.dex.map((d) => d.recipeId), kind);
      await capture(page, `06-empty-${kind.toLowerCase()}`);
    });
  }

  // Discovery Hint Economy 1.0 (Issue #232, HE-3) / Discovery Hint 3.0 (Issue #238, H3-3): the
  // Selectable purchase CTA states, on the same geometry contract (every profile: inside the viewport, CTA
  // above the safe area, background unmoved).
  test("purchase CTA: price + balance, buy a fact, guidance, reload keeps facts, insufficient", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    // Dex 11 (capricciosa: 4 facts for sale, the 75 Pitz cap), 120 Pitz.
    await openWithSave(page, ladderSave(11, { pitz: 120 }));
    await startFreeCookAtTopping(page);
    const closed = await closedRects(page, driver, browserName);
    const hint = bar(page).getByRole("button", { name: "ヒント" });
    await hint.click();

    const cta = materialCta(page);
    await expect(sheet(page)).toContainText("所持 120 Pitz");
    await openPanel(page);
    await expect(cta).toHaveText("たずねる 5 Pitz");
    await checkOpenState(page, driver, browserName, "first CTA", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "first CTA");

    await cta.click();
    await expect(sheet(page).locator(".hint-sheet__chip")).toHaveCount(2);
    await expect(sheet(page)).toContainText("所持 115 Pitz");
    await openPanel(page);
    await expect(cta).toHaveText("たずねる 10 Pitz");
    for (const chips of [3, 4, 5]) {
      await askMaterial(page);
      await expect(sheet(page).locator(".hint-sheet__chip")).toHaveCount(chips);
    }
    await expect(page.locator(".app-header__pitz")).toContainText("45");
    // H3-4 (OD-H3-4-1): the cap is paid -- a request, enabled, never 「0 Pitz」.
    await openPanel(page);
    await expect(cta).toHaveText("たずねる 支払いずみ");
    await expect(cta).toBeEnabled();
    await checkOpenState(page, driver, browserName, "cap paid", closed);
    await capture(page, "07-cap-paid");
    // Nothing left to sell: nothing charged; only now the 材料 card stops (OD-H3-4-3), for this sheet.
    await expect(cta).not.toHaveAttribute("aria-disabled", "true");
    await cta.click();
    await expect(sheet(page).locator(".hint-sheet__outcome")).toHaveText("材料ヒントはここまで（Pitzは使っていないよ）");
    await expect(cta).toHaveCount(0);
    await expect(page.locator(".app-header__pitz")).toContainText("45");
    await checkOpenState(page, driver, browserName, "guidance (panel)", closed);
    await sheet(page).getByRole("button", { name: /もどる/ }).click();
    await expect(sheet(page).locator(".hint-sheet__guidance")).toBeVisible();
    await checkOpenState(page, driver, browserName, "all facts + guidance", closed);
    await expectNoUndiscoveredIdentity(page, DEX11, "all facts + guidance");
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.pitzBalance).toBe(45);
    expect(saved.discoveryHintPurchases ?? {}).toEqual({});
    expect([...saved.discoveryHintFacts.capricciosa].sort()).toEqual(["ing:ham", "ing:mozzarella", "ing:mushroom", "ing:tomato-sauce"]);

    // Reload: every bought fact is back, nothing is charged again, no guidance until asked.
    await page.reload();
    await page.waitForSelector(".app-frame");
    await startFreeCookAtTopping(page);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    await expect(sheet(page).locator(".hint-sheet__chip")).toHaveCount(5);
    await expect(sheet(page).locator(".hint-sheet__guidance")).toHaveCount(0);
    await expect(page.locator(".app-header__pitz")).toContainText("45");
    await sheet(page).getByRole("button", { name: "閉じる" }).click();

    // Insufficient: a legacy H3 buyer's next fact (40) with 25 Pitz -> disabled, calm. 構成 / 特徴 keep
    // their fixed 5 (OD-DH4-PROD-1, outside the 材料 ladder), so focus lands on the first open request.
    await openWithSave(page, ladderSave(11, { pitz: 25, purchases: { capricciosa: 3 } }));
    await startFreeCookAtTopping(page);
    const closedShort = await closedRects(page, driver, browserName);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    await expect(sheet(page)).toContainText("所持 25 Pitz");
    await openPanel(page);
    await expect(cta).toBeDisabled();
    await expect(cta).toHaveText("たずねる 40 Pitz");
    const structureCta = sheet(page).locator('.hint-sheet__card[data-hint-family="structure"] .hint-sheet__next');
    await expect(structureCta).toHaveText("たずねる 5 Pitz");
    await expect(structureCta).toBeFocused();
    await checkOpenState(page, driver, browserName, "insufficient", closedShort);
    await expectNoUndiscoveredIdentity(page, DEX11, "insufficient");
    await sheet(page).getByRole("button", { name: "閉じる" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(bar(page).getByRole("button", { name: "ヒント" })).toBeFocused();
  });

  test("Dex 0 Margherita onboarding: free, no price and no balance", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page, ladderSave(0, { pitz: 0 }));
    await startFreeCookAtTopping(page);
    const closed = await closedRects(page, driver, browserName);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    const cta = sheet(page).locator(".hint-sheet__next");
    for (let level = 1; level <= 4; level += 1) {
      await expect(cta).toHaveText("次のヒントを見る");
      await expect(sheet(page)).not.toContainText("Pitz");
      if (level === 1) await checkOpenState(page, driver, browserName, "onboarding", closed);
      await cta.click();
    }
    await expect(sheet(page).getByText(/ヒントはここまで/)).toBeVisible();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
    expect(saved.pitzBalance).toBe(0);
    expect(saved.discoveryHintPurchases ?? {}).toEqual({});
  });
});
