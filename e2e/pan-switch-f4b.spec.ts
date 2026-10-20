import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { base, SAVE_KEY } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Square Dough F4-b (#538): the DOUGH step's ○/□ switch in the real game. No catalog recipe requires the tray yet, so Production never
 * opens the switch; `?panSwitch=open` (Preview / DEV only) stands in for the derived affordance. Runs on both authority viewports.
 * HV_SHOT_DIR (optional) writes the before/after screenshots.
 */
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

/** Boots the starter-trio save with `query` on the URL (the shared `openWith` takes none). */
async function open(page: Page, query: string, dex: unknown[] = []) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify({ ...base(["tomato-sauce", "mozzarella", "basil"]), dex })] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
}

async function freeCookDough(page: Page, query: string) {
  await open(page, query);
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
}

const sw = (page: Page) => page.getByTestId("pan-switch");
const round = (page: Page) => page.getByRole("radio", { name: "丸い生地" });
const square = (page: Page) => page.getByRole("radio", { name: "四角い生地" });
const next = (page: Page) => page.getByRole("button", { name: /次へ/ });

async function noOverflow(page: Page) {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
  }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.sh).toBeLessThanOrEqual(m.ih);
}

test.describe("F4-b ○/□ switch", () => {
  test("Production-like (affordance closed): no switch in Free Cooking DOUGH", async ({ page }) => {
    await freeCookDough(page, "");
    await expect(sw(page)).toHaveCount(0);
    await shot(page, "before-closed");
  });

  test("open: two 44px targets inside the viewport, clear of the pizza and 次へ, no scroll", async ({ page }) => {
    await freeCookDough(page, "?panSwitch=open");
    await expect(sw(page)).toBeVisible();
    for (const r of [round(page), square(page)]) {
      const b = (await r.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    const s = (await sw(page).boundingBox())!;
    const stage = (await page.locator(".pizza-stage").boundingBox())!;
    const n = (await next(page).boundingBox())!;
    expect(s.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
    expect(s.y + s.height).toBeLessThanOrEqual(n.y + 1);
    await noOverflow(page);
    await shot(page, "after-round");
  });

  test("□ shows the square sheet; ○ again restores the round dough as it was (nothing lost)", async ({ page }) => {
    await freeCookDough(page, "?panSwitch=open");
    await completeDoughStep(page);
    await expect(next(page)).toBeEnabled();
    await square(page).click();
    await expect(square(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("square-dough-layer")).toBeVisible();
    await expect(next(page)).toBeDisabled(); // STEP 1 of the square dough: not finished yet
    await noOverflow(page);
    await shot(page, "after-square");
    await round(page).click();
    await expect(round(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("square-dough-layer")).toHaveCount(0);
    await expect(next(page)).toBeEnabled(); // the stretched round dough survived the round trip
  });

  test("「次へ」 settles the shape: no switch in later steps", async ({ page }) => {
    await freeCookDough(page, "?panSwitch=open");
    await completeDoughStep(page);
    await next(page).click();
    await expect(sw(page)).toHaveCount(0);
  });

  test("a guided round never shows it", async ({ page }) => {
    await open(page, "?panSwitch=open", [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }]);
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await page.getByRole("button", { name: /マルゲリータ、/ }).click();
    await page.getByRole("button", { name: /このピザを作る/ }).click();
    await page.waitForSelector(".pizza-stage");
    await expect(sw(page)).toHaveCount(0);
  });

  test("□ runs #558's square dough end to end: STEP 1 -> STEP 2 -> 次へ moves on and the shape is settled", async ({ page }) => {
    test.setTimeout(120_000);
    await freeCookDough(page, "?panSwitch=open");
    await square(page).click();
    const layer = page.getByTestId("square-dough-layer");
    await expect(layer).toBeVisible();
    await expect(layer).toHaveAttribute("data-step", "1");
    const attr = async (name: string) => (await layer.getAttribute(name)) ?? "";
    const at = async (x: number, y: number) => {
      const b = (await layer.boundingBox())!;
      return { x: b.x + (b.width * x) / 100, y: b.y + (b.height * y) / 100 };
    };
    const drag = async (pts: [number, number][]) => {
      const f = await at(...pts[0]);
      await page.mouse.move(f.x, f.y);
      await page.mouse.down();
      for (const p of pts.slice(1)) {
        const q = await at(...p);
        await page.mouse.move(q.x, q.y, { steps: 6 });
      }
      await page.mouse.up();
    };
    const rows = [14, 26, 38, 50, 62, 74, 86];
    for (let i = 0; i < rows.length; i++) await drag(i % 2 === 0 ? [[10, rows[i]], [50, rows[i]], [90, rows[i]]] : [[90, rows[i]], [50, rows[i]], [10, rows[i]]]);
    for (const [x, y] of [[10, 10], [90, 10], [90, 90], [10, 90]]) await drag([[50, 50], [x, y]]);
    for (let k = 0; k < 8 && (await attr("data-step")) !== "2"; k++) await drag([[12, 12 + k * 10], [88, 12 + k * 10]]);
    expect(await attr("data-step")).toBe("2");
    for (let k = 0; k < 60 && (await attr("data-complete")) !== "true"; k++) {
      const idx = await layer.evaluate((el) => {
        const v = (el.getAttribute("data-thickness") ?? "").split(",").map(Number);
        let best = 0;
        for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i;
        return best;
      });
      const q = await at(((idx % 16) + 0.5) * (100 / 16), (Math.floor(idx / 16) + 0.5) * (100 / 16));
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.waitForTimeout(k % 3 === 0 ? 700 : 30);
      await page.mouse.up();
    }
    expect(await attr("data-complete")).toBe("true");
    // Both choices stay open until 次へ, and the finished square dough survives a round trip.
    await round(page).click();
    await expect(layer).toHaveCount(0);
    await square(page).click();
    await expect(layer).toHaveAttribute("data-complete", "true");
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect(layer).toHaveCount(0);
    await expect(sw(page)).toHaveCount(0); // settled: no switch in SAUCE
    await expect(page.getByRole("button", { name: /トマトソース/ })).toBeVisible();
  });
});
