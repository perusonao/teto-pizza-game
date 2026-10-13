import { test, expect, type Page } from "@playwright/test";
import { completeDoughStep, cutThreeLines, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * #486 T1: the production opt-in of the Canvas mozzarella. OFF by default (M1), `?cheeseCanvas=1` turns it on (remembered in its own key),
 * `?cheeseCanvas=0` off again; a canvas the browser emptied shows M1 instead of an invisible cheese. Same Margherita round as the #421 specs
 * (3 mozzarella pieces), checked at BAKE, after CUT and at RESULT, at both viewports.
 */
const SAVE = JSON.stringify({ schemaVersion: 1, dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }], pitzBalance: 0, ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], missionBest: {} });

async function openRound(page: Page, query: string) {
  await page.addInitScript((save) => {
    if (!localStorage.getItem("teto-pizza-save-v1")) localStorage.setItem("teto-pizza-save-v1", save);
  }, SAVE);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  for (const [x, y] of [[45, 55], [55, 45]]) await tapDoughPercent(page, x, y);
  await page.waitForTimeout(600);
}

/** the bake with a paused clock and a closed-loop needle landing (a raw "click once the needle passes N" can overshoot on a loaded runner, which is a failed bake: CUT is skipped) */
async function bakeToResult(page: Page) {
  await enterBakePaused(page);
  await landNeedleAndTakeOut(page, { start: 69, end: 71 });
  await page.waitForTimeout(400); // the landing animation is real time
}

async function finishToResult(page: Page) {
  await cutThreeLines(page);
  await page.getByRole("button", { name: /切り終わる/ }).click();
  await expect(page.locator(".result-panel")).toBeVisible();
}

/** every cheese canvas on the page holds visible pixels (read back in the page) */
async function canvasesHavePixels(page: Page): Promise<{ count: number; allVisible: boolean }> {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>(".pizza-cheese-canvas")];
    const visible = canvases.every((c) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    });
    return { count: canvases.length, allVisible: visible };
  });
}

const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("#486 Canvas mozzarella production opt-in", () => {
  // each test plays a whole round (dough -> bake -> CUT -> RESULT); WebKit under CI load needs more than the 30 s default (webkit-390x844 shard 1 hit it at 29.7 s)
  test.describe.configure({ timeout: 120_000 });

  test("default: M1 only, no canvas, key unset", async ({ page }) => {
    await openRound(page, "");
    await bakeToResult(page);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-default-m1-baked.png` });
    expect((await canvasesHavePixels(page)).count).toBe(0);
    await finishToResult(page);
    expect(await page.locator(".pizza-cheese-canvas").count()).toBe(0);
    expect(await page.locator(".pizza-cheese--mozzarella, .pizza-cheese").count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => localStorage.getItem("teto-pizza-cheese-canvas"))).toBeNull();
  });

  test("?cheeseCanvas=1: canvases with real pixels at BAKE, after CUT and at RESULT; remembered; no overflow; ?cheeseCanvas=0 turns it off", async ({ page }) => {
    await openRound(page, "?cheeseCanvas=1");
    expect(await page.evaluate(() => localStorage.getItem("teto-pizza-cheese-canvas"))).toBe("1");
    await bakeToResult(page);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-optin-on-baked.png` });
    const baked = await canvasesHavePixels(page);
    expect(baked.count).toBe(3);
    expect(baked.allVisible).toBe(true);
    await cutThreeLines(page);
    const cut = await canvasesHavePixels(page);
    expect(cut.count).toBeGreaterThanOrEqual(3);
    expect(cut.allVisible).toBe(true);
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await expect(page.locator(".result-panel")).toBeVisible();
    const result = await canvasesHavePixels(page);
    expect(result.count).toBeGreaterThanOrEqual(3);
    expect(result.allVisible).toBe(true);
    expect(await noHorizontalOverflow(page)).toBe(true);
    // a discarded backing store (iOS) is caught: empty one canvas behind the game's back, then bring the page back -> it is redrawn
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas.pizza-cheese-canvas")!;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      window.dispatchEvent(new Event("pageshow"));
    });
    const afterReturn = await canvasesHavePixels(page);
    expect(afterReturn.count).toBeGreaterThanOrEqual(3);
    expect(afterReturn.allVisible).toBe(true);
    // evidence capture only (SHOT_DIR set by hand; skipped in CI): the RESULT stage with the opt-in on
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-optin-on-result.png` });
    // the save is untouched by the opt-in: the same document the test seeded (plus whatever the round itself saved) and the opt-in key is separate
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("cheese")))).toEqual(["teto-pizza-cheese-canvas"]);
    // remembered without the parameter, and switched off with =0
    await page.goto("/");
    await page.waitForSelector(".app-frame");
    expect(await page.evaluate(() => localStorage.getItem("teto-pizza-cheese-canvas"))).toBe("1");
    await page.goto("/?cheeseCanvas=0");
    expect(await page.evaluate(() => localStorage.getItem("teto-pizza-cheese-canvas"))).toBeNull();
  });

  test("a canvas the browser emptied (all-transparent read-back) shows M1, never an invisible cheese", async ({ page }) => {
    await page.addInitScript(() => {
      const real = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof real>) {
        const image = real.apply(this, args);
        if ((this.canvas as HTMLCanvasElement).classList.contains("pizza-cheese-canvas")) image.data.fill(0);
        return image;
      };
    });
    await openRound(page, "?cheeseCanvas=1");
    await bakeToResult(page);
    expect(await page.locator(".pizza-cheese-canvas").count()).toBe(0);
    expect(await page.locator(".pizza-cheese").count()).toBeGreaterThanOrEqual(3); // the M1 pieces took over
    await finishToResult(page);
    expect(await page.locator(".pizza-cheese-canvas").count()).toBe(0);
    expect(await page.locator(".pizza-cheese").count()).toBeGreaterThanOrEqual(3);
  });
});
