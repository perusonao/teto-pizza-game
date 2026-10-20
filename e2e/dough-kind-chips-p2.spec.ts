import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { base, SAVE_KEY } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Dough Kind P2 (#577): the DOUGH step's dough-kind chips in the real game. No catalog recipe requires the dough technique (P3 is on HOLD),
 * so Production never opens them; `?doughSwitch=open` (Preview / DEV only) stands in for the derived affordance. Runs on both authority
 * viewports. HV_SHOT_DIR (optional) writes the before/after screenshots.
 *
 * Labels (Owner, 2026-10-20): 「ふつうの生地」「ほかの生地」 -- the same string on screen and in the aria-label. Once the technique is in the player's
 * ledger the second chip reads 「ピンサ生地」, selected or not; selecting alone never shows the name.
 */
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

async function open(page: Page, query: string, save: object = {}) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify({ ...base(["tomato-sauce", "mozzarella", "basil"]), ...save })] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
}

async function freeCookDough(page: Page, query: string, save: object = {}) {
  await open(page, query, save);
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
}

const group = (page: Page) => page.getByTestId("dough-kind-switch");
const plain = (page: Page) => page.getByRole("radio", { name: "ふつうの生地" });
const other = (page: Page) => page.getByRole("radio", { name: "ほかの生地" });
const panSwitch = (page: Page) => page.getByTestId("pan-switch");
const next = (page: Page) => page.getByRole("button", { name: /次へ/ });

async function noOverflow(page: Page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.sh).toBeLessThanOrEqual(m.ih);
}
const boxes = async (page: Page) => ({
  stage: (await page.locator(".pizza-stage").boundingBox())!,
  next: (await next(page).boundingBox())!,
});

test.describe("P2 dough-kind chips", () => {
  test("Production-like (affordance closed): no chips in Free Cooking DOUGH", async ({ page }) => {
    await freeCookDough(page, "");
    await expect(group(page)).toHaveCount(0);
    await shot(page, "before-closed");
  });

  test("open: two 44px chips with text labels = aria-labels, inside the viewport, clear of the pizza and 次へ; the layout above does not move", async ({ page }) => {
    await freeCookDough(page, "");
    const closed = await boxes(page);
    await freeCookDough(page, "?doughSwitch=open");
    await expect(group(page)).toBeVisible();
    await expect(group(page)).toHaveAttribute("aria-label", "生地の種類");
    for (const [chip, text] of [[plain(page), "ふつうの生地"], [other(page), "ほかの生地"]] as const) {
      await expect(chip).toHaveText(text);
      const b = (await chip.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    const open = await boxes(page);
    expect(open.stage).toEqual(closed.stage); // the pizza does not move
    expect(open.next).toEqual(closed.next);
    const g = (await group(page).boundingBox())!;
    expect(g.y).toBeGreaterThanOrEqual(open.stage.y + open.stage.height - 1);
    expect(g.y + g.height).toBeLessThanOrEqual(open.next.y + 1);
    await noOverflow(page);
    await expect(plain(page)).toHaveAttribute("aria-checked", "true");
    await shot(page, "after-open-plain");
  });

  test("choosing the other chip marks it, shows no formal name, and choosing the plain chip restores it", async ({ page }) => {
    await freeCookDough(page, "?doughSwitch=open");
    await other(page).click();
    await expect(other(page)).toHaveAttribute("aria-checked", "true");
    await expect(plain(page)).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("body")).not.toContainText("ピンサ");
    expect(await page.content()).not.toMatch(/pinsa|romana|multigrain|ferment/i);
    await shot(page, "after-open-other-selected");
    await plain(page).click();
    await expect(plain(page)).toHaveAttribute("aria-checked", "true");
  });

  test("technique discovered: the second chip reads 「ピンサ生地」 (text and aria-label) whether or not it is selected", async ({ page }) => {
    await freeCookDough(page, "?doughSwitch=open", { discoveredTechniqueIds: ["dough-pinsa-romana"] });
    const named = page.getByRole("radio", { name: "ピンサ生地" });
    await expect(named).toHaveText("ピンサ生地");
    await expect(page.getByRole("radio", { name: "ほかの生地" })).toHaveCount(0);
    await expect(named).toHaveAttribute("aria-checked", "false");
    await shot(page, "after-discovered-unselected");
    await named.click();
    await expect(named).toHaveAttribute("aria-checked", "true");
    await expect(named).toHaveText("ピンサ生地");
    await noOverflow(page);
    await shot(page, "after-discovered-selected");
    // the raw technique id / dough value never reach the DOM
    expect(await page.content()).not.toMatch(/dough-pinsa-romana|romana|multigrain|ferment/i);
  });

  test("with the ○/□ switch also open: two separate radiogroups sharing one row, no overlap, nothing overflows, the pizza does not move", async ({ page }) => {
    await freeCookDough(page, "");
    const closed = await boxes(page);
    await freeCookDough(page, "?doughSwitch=open&panSwitch=open");
    await expect(panSwitch(page)).toBeVisible();
    await expect(group(page)).toBeVisible();
    const p = (await panSwitch(page).boundingBox())!;
    const g = (await group(page).boundingBox())!;
    expect(p.x + p.width).toBeLessThanOrEqual(g.x + 1); // side by side on one row: the dock keeps its height
    expect(Math.abs(p.y - g.y)).toBeLessThanOrEqual(8);
    for (const r of await page.getByRole("radio").all()) {
      const b = (await r.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    const open = await boxes(page);
    expect(open.stage).toEqual(closed.stage);
    expect(g.y + g.height).toBeLessThanOrEqual(open.next.y + 1);
    await noOverflow(page);
    await shot(page, "after-both-open");
  });

  test("the dough choice and the ○/□ choice are independent: switching the pan keeps the dough chip, and switching the dough keeps the pan", async ({ page }) => {
    test.setTimeout(90_000);
    await freeCookDough(page, "?doughSwitch=open&panSwitch=open");
    await other(page).click();
    await page.getByRole("radio", { name: "四角い生地" }).click();
    await expect(page.getByRole("radio", { name: "四角い生地" })).toHaveAttribute("aria-checked", "true");
    await expect(other(page)).toHaveAttribute("aria-checked", "true");
    await noOverflow(page);
    await shot(page, "after-both-square-other");
    await page.getByRole("radio", { name: "丸い生地" }).click();
    await expect(other(page)).toHaveAttribute("aria-checked", "true");
    await plain(page).click();
    await expect(page.getByRole("radio", { name: "丸い生地" })).toHaveAttribute("aria-checked", "true");
    await expect(plain(page)).toHaveAttribute("aria-checked", "true");
  });

  test("「次へ」 settles it: no chips in later steps; a guided round never shows them", async ({ page }) => {
    test.setTimeout(90_000);
    await freeCookDough(page, "?doughSwitch=open");
    await other(page).click();
    await completeDoughStep(page);
    await next(page).click();
    await expect(group(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /トマトソース/ })).toBeVisible();

    await open(page, "?doughSwitch=open", { dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }] });
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await page.getByRole("button", { name: /マルゲリータ、/ }).click();
    await page.getByRole("button", { name: /このピザを作る/ }).click();
    await page.waitForSelector(".pizza-stage");
    await expect(group(page)).toHaveCount(0);
  });
});
