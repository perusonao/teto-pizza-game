import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { PROFILES, ProfileDriver, readViewport, type Profile } from "./support/layoutProfiles";
import { runOnlyOnWidth } from "./support/projectGuard";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";

/**
 * Original Pizza Recovery P3-3b: the RESULT duplicate notice, played for real (dough -> sauce -> cheese -> toppings ->
 * bake, twice) on a Dex 3 ladder save, where funghi (tomato sauce, mozzarella, mushroom) is the one DISCOVERABLE recipe.
 *
 * The first attempt shows no notice; 「もう一度じゆうに作る」 and the same combination shows
 * 「📓 前にも同じ材料の組み合わせで作ったよ（試作#1）」 under the P2 line. Each state is measured at the Layout Contract
 * profiles (390x844, 360x800, the short 390x664 / 360x640 and, on Chromium, the three safe-area profiles):
 * no horizontal overflow, both CTAs fully on screen above the bottom inset, >= 44px, not overlapping; the notice inside
 * the viewport, in order (P2 row, notice, note), reachable above the fixed action bar; and the fixed bar itself at the
 * exact same position with and without the notice. Runs once per engine (the *-390x844 project).
 *
 * Optional outputs: HV_SCREENSHOT_DIR (screenshots of both states at the four viewports) and P3B_GEOMETRY_OUT (JSON).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const DEX3_SAVE = {
  schemaVersion: 2,
  dex: ["margherita", "bismarck", "breakfast-pizza"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg", "bacon", "mushroom"],
  missionBest: {},
  inventory: { egg: 30, bacon: 30, mushroom: 30 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: ["egg", "bacon", "mushroom"],
};
const UNDISCOVERED = ["フンギ", "メランザーネピザ", "パルミジャーナピザ"];
const NOTICE = ".original-pizza__trial-notice";
const NOTICE_TEXT = (n: number) => `📓 前にも同じ材料の組み合わせで作ったよ（試作#${n}）`;

type Pieces = { cheese: [RegExp, number][]; toppings: [RegExp, number][]; sauceDab?: boolean };
const ADD_ONE: Pieces = { cheese: [[/モッツァレラ/, 3]], toppings: [] };
const FAR: Pieces = { cheese: [], toppings: [[/バジル/, 1], [/たまご/, 2], [/ベーコン/, 2]] };
const INCOMPLETE: Pieces = { cheese: [[/モッツァレラ/, 2]], toppings: [[/マッシュルーム/, 3]], sauceDab: true };

async function openWithSave(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    localStorage.setItem("teto.dev.hint5Ladder", "0");
  }, [SAVE_KEY, JSON.stringify(DEX3_SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(/3\/27/);
}

const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function place(page: Page, name: RegExp, spots: [number, number][]) {
  await page.locator(".ingredient-chip").filter({ hasText: name }).first().click();
  for (const [x, y] of spots) await tapDoughPercent(page, x, y);
}

/** One Free Cooking round (started from HOME, or from the RESULT's retry CTA) baked on target, to its RESULT. */
async function cookFree(page: Page, pieces: Pieces, from: "HOME" | "RESULT") {
  if (from === "HOME") await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  else await page.getByRole("button", { name: /もう一度じゆうに作る/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  if (pieces.sauceDab) await tapDoughPercent(page, 50, 50);
  else await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  const spots: [number, number][] = [[40, 50], [60, 50], [50, 32], [50, 66], [34, 38], [66, 62]];
  let s = 0;
  for (const [name, n] of pieces.cheese) await place(page, name, spots.slice(s, (s += n)));
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  for (const [name, n] of pieces.toppings) {
    await place(page, name, spots.slice(s % 6, (s % 6) + n));
    s += n;
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

function profilesFor(browserName: string): Profile[] {
  const all = Object.values(PROFILES);
  return browserName === "chromium" ? all : all.filter((p) => !p.inset);
}
const FOUR = ["N390", "N360", "S390", "S360"] as const;

interface Metrics {
  scrollWidth: number;
  noticeCount: number;
  liveRegionsInNotice: number;
  notice: { left: number; right: number; top: number; bottom: number; height: number } | null;
  p2Bottom: number | null;
  noteTop: number | null;
  primary: { top: number; bottom: number; height: number };
  secondary: { top: number; bottom: number; height: number };
  bar: { top: number; bottom: number };
  reachable: { noticeBottom: number | null; noteBottom: number; barTop: number };
  scroll: { clientHeight: number; scrollHeight: number };
}

async function measure(page: Page): Promise<Metrics> {
  return page.evaluate((selector) => {
    const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
    const notice = document.querySelector(selector);
    const note = document.querySelector(".original-pizza__note")!;
    const p2 = document.querySelector(".result-near-miss");
    const actions = document.querySelector(".result-panel__actions")!;
    const primary = r(document.querySelector(".result-panel__actions .cta-button--primary"))!;
    const secondary = r(document.querySelector(".result-panel__actions .cta-button--secondary"))!;
    // The RESULT scrolls inside `.game-screen` (overflow auto) while the action bar is fixed: scroll to the very end,
    // measure what is reachable above the bar, then restore.
    let scroller: HTMLElement = document.scrollingElement as HTMLElement;
    for (let el = note.parentElement; el; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > 0) {
        scroller = el;
        break;
      }
    }
    const before = scroller.scrollTop;
    scroller.scrollTop = scroller.scrollHeight;
    const barRect = actions.getBoundingClientRect();
    const reachable = {
      noticeBottom: notice ? notice.getBoundingClientRect().bottom : null,
      noteBottom: note.getBoundingClientRect().bottom,
      barTop: barRect.top,
    };
    scroller.scrollTop = before;
    const n = r(notice);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      noticeCount: document.querySelectorAll(selector).length,
      liveRegionsInNotice: notice ? (notice.hasAttribute("aria-live") ? 1 : 0) + (notice.closest("[aria-live]") ? 1 : 0) : 0,
      notice: n ? { left: n.left, right: n.right, top: n.top, bottom: n.bottom, height: n.height } : null,
      p2Bottom: p2 ? p2.getBoundingClientRect().bottom : null,
      noteTop: note.getBoundingClientRect().top,
      primary: { top: primary.top, bottom: primary.bottom, height: primary.height },
      secondary: { top: secondary.top, bottom: secondary.bottom, height: secondary.height },
      bar: { top: barRect.top, bottom: barRect.bottom },
      reachable,
      scroll: { clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight },
    };
  }, NOTICE);
}

async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

/** Measures one RESULT state at every profile; returns the per-profile metrics and (optionally) screenshots the four viewports. */
async function checkState(
  page: Page,
  driver: ProfileDriver,
  browserName: string,
  label: string,
  expectedNotice: number | null,
  shot: string,
): Promise<Record<string, Metrics>> {
  const out: Record<string, Metrics> = {};
  for (const profile of profilesFor(browserName)) {
    await driver.apply(profile);
    const vp = await readViewport(page);
    const m = await measure(page);
    out[profile.id] = m;
    const where = `${label} @${profile.id}`;
    expect.soft(m.scrollWidth, `${where}: horizontal overflow`).toBeLessThanOrEqual(vp.innerWidth);
    for (const [name, b] of [["primary", m.primary], ["secondary", m.secondary]] as const) {
      expect.soft(b.top, `${where}: ${name} CTA on screen`).toBeGreaterThanOrEqual(0);
      expect.soft(b.bottom, `${where}: ${name} CTA above the bottom inset`).toBeLessThanOrEqual(vp.innerHeight - vp.sab + 0.5);
      expect.soft(b.height, `${where}: ${name} CTA tap target`).toBeGreaterThanOrEqual(44);
    }
    expect.soft(m.primary.bottom, `${where}: CTAs do not overlap`).toBeLessThanOrEqual(m.secondary.top + 0.5);
    expect.soft(m.noticeCount, `${where}: notice count`).toBe(expectedNotice === null ? 0 : 1);
    if (expectedNotice !== null && m.notice) {
      expect.soft(m.notice.left, `${where}: notice inside the viewport (left)`).toBeGreaterThanOrEqual(0);
      expect.soft(m.notice.right, `${where}: notice inside the viewport (right)`).toBeLessThanOrEqual(vp.innerWidth);
      expect.soft(m.notice.height, `${where}: notice has a box`).toBeGreaterThan(0);
      expect.soft(m.liveRegionsInNotice, `${where}: no live region on or around the notice`).toBe(0);
      expect.soft(m.notice.top, `${where}: order P2 row -> notice`).toBeGreaterThanOrEqual((m.p2Bottom ?? 0) - 0.5);
      expect.soft(m.noteTop ?? 0, `${where}: order notice -> note`).toBeGreaterThanOrEqual(m.notice.bottom - 0.5);
      expect.soft(m.reachable.noticeBottom ?? 0, `${where}: notice reachable above the fixed action bar`).toBeLessThanOrEqual(m.reachable.barTop + 0.5);
    }
    expect.soft(m.reachable.noteBottom, `${where}: content end reachable above the fixed action bar`).toBeLessThanOrEqual(m.reachable.barTop + 0.5);
    if ((FOUR as readonly string[]).includes(profile.id)) await capture(page, `${shot}-${profile.id}`);
  }
  await driver.apply(PROFILES.N390);
  const text = (await page.locator(".result-panel").textContent()) ?? "";
  for (const name of UNDISCOVERED) expect(text, `${label}: ${name}`).not.toContain(name);
  expect(text, `${label}: no retry count`).not.toMatch(/×|\d+回/);
  await expectNoUndiscoveredIdentity(page, DEX3_SAVE.dex.map((d) => d.recipeId), label);
  return out;
}

const evidence: Record<string, unknown> = {};

test.describe("Original Pizza Recovery P3-3b: RESULT duplicate notice", () => {
  test.beforeEach(() => runOnlyOnWidth(test.info(), 390));

  for (const [name, pieces, p2, shot] of [
    ["ADD_ONE (P2 near-miss line)", ADD_ONE, /別の組み合わせも試してみよう/, "add-one"],
    ["FAR (generic P2 line, a different height)", FAR, /別の組み合わせも試してみよう/, "far"],
  ] as const) {
    test(`${name}: first attempt has no notice, the identical retry shows 「試作#1」; geometry holds with and without`, async ({ page, browserName }) => {
      const driver = await ProfileDriver.create(page, browserName);
      await driver.apply(PROFILES.N390);
      await openWithSave(page);

      await cookFree(page, pieces, "HOME");
      await expect(page.locator(".result-panel--original")).toBeVisible();
      await expect(page.locator(".result-near-miss__text")).toHaveText(p2);
      await expect(page.locator(NOTICE)).toHaveCount(0);
      const without = await checkState(page, driver, browserName, `${shot} NEW`, null, `${shot}-1-no-notice`);

      await cookFree(page, pieces, "RESULT");
      await expect(page.locator(".result-panel--original")).toBeVisible();
      await expect(page.locator(".result-near-miss__text")).toHaveText(p2); // the P2 line is unchanged by the notice
      await expect(page.locator(NOTICE)).toHaveText(NOTICE_TEXT(1));
      await expect(page.locator(NOTICE)).toHaveCount(1);
      const withN = await checkState(page, driver, browserName, `${shot} DUPLICATE`, 1, `${shot}-2-duplicate-notice`);

      // The fixed action bar does not move: the notice is content, the bar is never pushed out.
      for (const id of Object.keys(without)) {
        expect.soft(withN[id].bar.top, `${shot} @${id}: action bar top with vs without the notice`).toBeCloseTo(without[id].bar.top, 0);
        expect.soft(withN[id].primary.top, `${shot} @${id}: primary CTA top with vs without`).toBeCloseTo(without[id].primary.top, 0);
      }
      evidence[shot] = { without, with: withN };

      // A third identical attempt keeps the same stable number.
      await cookFree(page, pieces, "RESULT");
      await expect(page.locator(NOTICE)).toHaveText(NOTICE_TEXT(1));
    });
  }

  test("a different combination after a recorded one shows no notice (NEW #2), and an INCOMPLETE_MATCH is recorded like any original (OD-D3-23)", async ({ page, browserName }) => {
    const driver = await ProfileDriver.create(page, browserName);
    await driver.apply(PROFILES.N390);
    await openWithSave(page);
    await cookFree(page, ADD_ONE, "HOME");
    await cookFree(page, FAR, "RESULT");
    await expect(page.locator(NOTICE)).toHaveCount(0); // a different fingerprint is a new attempt
    await cookFree(page, INCOMPLETE, "RESULT");
    // Discovery 3.0 PR-1: the old 「図鑑のピザまであと少し」 lead is gone -- an INCOMPLETE_MATCH reads as any original.
    await expect(page.locator(".original-pizza__lead")).toHaveText("図鑑にはまだ載っていないピザ！");
    await expect(page.locator(NOTICE)).toHaveCount(0); // its first attempt (#3) is new, like any other
    await checkState(page, driver, browserName, "INCOMPLETE_MATCH", null, "incomplete-first-attempt");
    await cookFree(page, INCOMPLETE, "RESULT"); // ... and it is recorded: the retry shows its stable number
    await expect(page.locator(NOTICE)).toHaveText(NOTICE_TEXT(3));
    await cookFree(page, ADD_ONE, "RESULT"); // the very first combination again: still its stable #1
    await expect(page.locator(NOTICE)).toHaveText(NOTICE_TEXT(1));
  });

  test("a reload starts a new session: the same combination is a first attempt again (no notice)", async ({ page }) => {
    await openWithSave(page);
    await cookFree(page, ADD_ONE, "HOME");
    await cookFree(page, ADD_ONE, "RESULT");
    await expect(page.locator(NOTICE)).toHaveText(NOTICE_TEXT(1));
    await page.reload();
    await page.waitForSelector(".app-frame");
    await cookFree(page, ADD_ONE, "HOME");
    await expect(page.locator(NOTICE)).toHaveCount(0);
  });

  test.afterAll(() => {
    const out = process.env.P3B_GEOMETRY_OUT;
    if (out && Object.keys(evidence).length) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify({ spec: "e2e/original-result-duplicate-notice.spec.ts", evidence }, null, 1)}\n`);
    }
  });
});
