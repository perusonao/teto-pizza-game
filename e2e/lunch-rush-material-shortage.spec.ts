import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, playFullMargheritaRound, tapDoughPercent } from "./gestures";

/**
 * Issue #212 (H-R / OD-2): Lunch Rush material-shortage orders in a real browser, at 390x844 and
 * 360x800 (Chromium and WebKit projects). A short order shows 「材料が足りません」, the missing
 * materials and 「この注文をスキップ」 (never 「ピザを作る！」); a skip draws a cookable order straight
 * into PREPARE while the mission clock keeps running; the skipped recipe never comes back in the
 * same run; with nothing cookable HOME keeps Lunch Rush closed and a running run ends into its
 * RESULT. See docs/reports/TETO_LUNCH-RUSH_MATERIAL-SHORTAGE-SKIP_Fresh-Revalidation.md §8.
 */

const SAVE_KEY = "teto-pizza-save-v1";

function save(dex: readonly string[], owned: readonly string[], inventory: Record<string, number>) {
  return {
    schemaVersion: 2,
    dex: dex.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 120,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...owned],
    missionBest: {},
    inventory,
  };
}

/** margherita + bismarck discovered, egg owned at 0: the first order is always the short bismarck
 *  (avoidRepeat excludes the initial margherita round), and margherita is the only cookable one. */
const SHORT_BISMARCK = save(["margherita", "bismarck"], ["egg"], { egg: 0 });

/**
 * Seeds the save on a script-free same-origin document, then opens the app (the Layout Contract's
 * WebKit-safe pattern: no init script, no evaluate + reload on the app itself). The Dex pill is
 * asserted so a seed that did not load can never pass unnoticed.
 */
async function openWithSave(page: Page, raw: { dex: unknown[] }, query = "") {
  await page.goto("icons/icon-16.png");
  await page.evaluate(
    ([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    },
    [SAVE_KEY, JSON.stringify(raw)] as const,
  );
  await page.goto(`./${query}`);
  await page.waitForSelector(".app-frame");
  await expect(page.locator(".app-header__dex-pill")).toHaveText(new RegExp(`${raw.dex.length}/25`));
}

async function startRun(page: Page) {
  await page.getByRole("button", { name: /ランチラッシュ/ }).click();
  await page.getByRole("button", { name: "スタート" }).click();
}

async function expectNoPageScroll(page: Page) {
  const s = await page.evaluate(() => ({
    vh: window.innerHeight,
    vw: window.innerWidth,
    sh: document.documentElement.scrollHeight,
    sw: document.documentElement.scrollWidth,
  }));
  expect(s.sh, "no vertical page scroll").toBeLessThanOrEqual(s.vh + 1);
  expect(s.sw, "no horizontal page scroll").toBeLessThanOrEqual(s.vw + 1);
}

async function expectInViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  const vh = await page.evaluate(() => window.innerHeight);
  expect(box, `${selector} rendered`).not.toBeNull();
  expect(box!.y, `${selector} top`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${selector} bottom inside the viewport`).toBeLessThanOrEqual(vh + 1);
}

/** `M:SS` from the HUD, in seconds. */
async function hudSeconds(page: Page) {
  const text = (await page.locator(".mission-hud").innerText()).match(/(\d+):(\d{2})/);
  if (!text) throw new Error("mission HUD timer missing");
  return Number(text[1]) * 60 + Number(text[2]);
}

test.describe("Lunch Rush material shortage (Issue #212)", () => {
  test("short order -> skip -> cookable PREPARE; the clock keeps running; the skipped recipe never returns", async ({ page }) => {
    test.setTimeout(120_000);
    await openWithSave(page, SHORT_BISMARCK, "?missionDuration=120");
    await startRun(page);

    // B: the shortage screen -- what is missing, and only the skip CTA.
    const panel = page.locator(".mission-shortage-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: /材料が足りません/ })).toBeVisible();
    await expect(panel.locator(".mission-shortage-panel__item")).toHaveText([/たまご\s*0\/1$/]);
    await expect(page.getByRole("button", { name: "ピザを作る！" })).toHaveCount(0);
    await expectInViewport(page, ".mission-shortage-panel .cta-button");
    await expectNoPageScroll(page);

    // J: time passes on the shortage screen and through the skip.
    const before = await hudSeconds(page);
    await page.waitForTimeout(2_200);
    await page.getByRole("button", { name: "この注文をスキップ" }).click();

    // F / "normal orders reach PREPARE": the next order is the cookable margherita, straight in.
    await expect(page.locator(".making-step-tabs")).toBeVisible();
    await expect(page.locator(".mission-shortage-panel")).toHaveCount(0);
    await expect(page.locator(".order-card")).toContainText("マルゲリータ");
    await expect(page.locator(".mission-hud__served")).toContainText("0"); // K: nothing served
    expect(await hudSeconds(page)).toBeLessThanOrEqual(before - 2);

    // One real serve, then the next order: bismarck is SOLD OUT, so it is margherita again,
    // straight into PREPARE (never the shortage screen).
    await playFullMargheritaRound(page);
    await expect(page.locator(".mission-serve-panel")).toBeVisible();
    await page.getByRole("button", { name: "次の注文へ" }).click();
    await expect(page.locator(".making-step-tabs")).toBeVisible();
    await expect(page.locator(".mission-shortage-panel")).toHaveCount(0);
    await expect(page.locator(".order-card")).toContainText("マルゲリータ");
    await expect(page.locator(".mission-hud__served")).toContainText("1");

    // L / I: the skip consumed nothing; the save never carries the run-local SOLD OUT set.
    const stored = await page.evaluate((key) => localStorage.getItem(key) ?? "", SAVE_KEY);
    expect(JSON.parse(stored).inventory.egg).toBe(0);
    expect(stored).not.toMatch(/soldOut|SoldOut/);
  });

  test("H: HOME keeps Lunch Rush closed while nothing discovered is cookable", async ({ page }) => {
    await openWithSave(page, save(["bismarck"], ["egg"], { egg: 0 }));
    const button = page.getByRole("button", { name: /ランチラッシュ/ });
    await expect(button).toBeDisabled();
    await expect(page.locator(".home-lunch-rush-hint--no-stock")).toHaveText(/材料不足でランチラッシュできません/);
    await expectNoPageScroll(page);
  });

  test("H: using the last cookable stock ends the run into RESULT; retry is blocked", async ({ page }) => {
    test.setTimeout(120_000);
    // bismarck (egg 1) is the only cookable recipe; genovese is short on two materials (C).
    await openWithSave(
      page,
      save(["bismarck", "genovese"], ["egg", "pesto", "cherry-tomato"], { egg: 1, pesto: 0, "cherry-tomato": 0 }),
      "?missionDuration=120",
    );
    await startRun(page);
    await expect(page.locator(".mission-shortage-panel__item")).toHaveText([/ジェノベーゼソース\s*0\/1$/, /チェリートマト\s*0\/3$/]);
    await expectInViewport(page, ".mission-shortage-panel .cta-button");
    await page.getByRole("button", { name: "この注文をスキップ" }).click();

    // bismarck with its only egg (no sauce: FAILED -- the egg is still used up).
    await expect(page.locator(".order-card")).toContainText("ビスマルク");
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click(); // -> SAUCE
    await page.getByRole("button", { name: /次へ/ }).click(); // -> CHEESE
    await page.getByRole("button", { name: /次へ/ }).click(); // -> TOPPING
    await page.getByRole("button", { name: /たまご/ }).click();
    await tapDoughPercent(page, 50, 50);
    await bakeToTarget(page, { start: 55, end: 75 });
    if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
      await cutThreeLines(page);
      await page.getByRole("button", { name: /切り終わる/ }).click();
    }
    await expect(page.locator(".mission-serve-panel")).toBeVisible();
    await page.getByRole("button", { name: "次の注文へ" }).click();

    await expect(page.locator(".mission-result__ended-early")).toHaveText("作れるピザがなくなったので終了しました");
    await expect(page.getByRole("button", { name: "もう一度" })).toBeDisabled();
    await expect(page.locator(".mission-result__retry-blocked")).toBeVisible();
    await expect(page.locator(".making-step-tabs")).toHaveCount(0); // never back into PREPARE
    await expectInViewport(page, ".mission-result__nav-row");
    await expectNoPageScroll(page);
  });
});
