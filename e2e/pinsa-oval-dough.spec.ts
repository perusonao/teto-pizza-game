import { expect, test, type Page } from "@playwright/test";
import { landNeedleAndTakeOut, enterBakePaused, paintSauceRing, tapDoughPercent } from "./gestures";
import { base, SAVE_KEY } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Pinsa Romana (#577): the oval dough. The Pinsa dough is drawn as a 3 : 2 oval in EVERY step (DOUGH, SAUCE, CHEESE, TOPPING, BAKE, FINISH, RESULT) while every rule stays the
 * round pizza's own (one circular dough-percent space drawn in a wider-than-tall box). `?doughSwitch=open` (Preview / DEV) stands in for the derived affordance, so this runs
 * against the gate as shipped. Round and square pizzas must not change. Runs on both authority viewports (390x844, 360x800). HV_SHOT_DIR (optional) writes the screenshots.
 */
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}
const ASPECT = 1.5;

async function freeCook(page: Page, query: string) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(base(["tomato-sauce", "mozzarella", "basil"]))] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
}
const other = (page: Page) => page.getByRole("radio", { name: "ほかの生地" });
const plain = (page: Page) => page.getByRole("radio", { name: "ふつうの生地" });
const dough = (page: Page) => page.locator(".pizza-dough").first();
const box = async (page: Page) => (await dough(page).boundingBox())!;
const next = (page: Page) => page.getByRole("button", { name: /次へ/ });

async function expectOval(page: Page, label: string) {
  const b = await box(page);
  expect(b.width / b.height, `${label}: width / height`).toBeGreaterThan(ASPECT - 0.02);
  expect(b.width / b.height, `${label}: width / height`).toBeLessThan(ASPECT + 0.02);
  const vp = page.viewportSize()!;
  expect(b.x, label).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width, label).toBeLessThanOrEqual(vp.width);
  expect(b.y, label).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height, label).toBeLessThanOrEqual(vp.height);
  await expect(dough(page), label).toHaveClass(/pizza-dough--oval/);
}
async function noOverflow(page: Page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
}
/** Stretches the dough out to its rim along the OVAL: eight taps at 46% of the box's own half-width / half-height. */
async function stretchOval(page: Page) {
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    await tapDoughPercent(page, 50 + Math.cos(a) * 46, 50 + Math.sin(a) * 46);
  }
}
const pieces = (page: Page) => page.locator(".pizza-dough .pizza-topping");

test.describe("Pinsa oval dough", () => {
  test("the other dough is a 3:2 oval, the plain dough is the round pizza again, and choosing never moves the stage or the 次へ button", async ({ page }) => {
    await freeCook(page, "?doughSwitch=open");
    const roundBox = await box(page);
    expect(roundBox.width / roundBox.height).toBeGreaterThan(0.99);
    expect(roundBox.width / roundBox.height).toBeLessThan(1.01);
    await expect(dough(page)).not.toHaveClass(/pizza-dough--oval/);
    const stage = (await page.locator(".pizza-stage").boundingBox())!;
    const nextBox = (await next(page).boundingBox())!;
    await shot(page, "before-round");
    await other(page).click();
    await expectOval(page, "other dough");
    const ovalBox = await box(page);
    expect(Math.abs(ovalBox.width - roundBox.width)).toBeLessThanOrEqual(1); // the width is the round pizza's: only the height follows the ratio
    expect((await page.locator(".pizza-stage").boundingBox())!).toEqual(stage);
    expect((await next(page).boundingBox())!).toEqual(nextBox);
    await noOverflow(page);
    await shot(page, "after-oval-dough");
    await plain(page).click();
    await expect(dough(page)).not.toHaveClass(/pizza-dough--oval/);
    const back = await box(page);
    expect(Math.abs(back.height - roundBox.height)).toBeLessThanOrEqual(1);
  });

  test("a square tray stays square even with the other dough chosen (the oval never applies to the tray)", async ({ page }) => {
    await freeCook(page, "?doughSwitch=open&panSwitch=open");
    await other(page).click();
    await expect(dough(page)).toHaveClass(/pizza-dough--oval/);
    await page.getByRole("radio", { name: "四角い生地" }).click();
    await expect(dough(page)).toHaveClass(/pizza-dough--square-pan/);
    await expect(dough(page)).not.toHaveClass(/pizza-dough--oval/);
    const b = await box(page);
    expect(b.width / b.height).toBeGreaterThan(0.99);
    expect(b.width / b.height).toBeLessThan(1.01);
  });

  test("every step is drawn on the oval: DOUGH, SAUCE, CHEESE, TOPPING, BAKE, FINISH (the post layer is the same box) and the RESULT", async ({ page }) => {
    test.setTimeout(120_000);
    await freeCook(page, "?doughSwitch=open");
    await other(page).click();
    await expectOval(page, "DOUGH");
    await expect(page.locator(".dough-target-guide")).toHaveAttribute("preserveAspectRatio", "none");
    await stretchOval(page);
    await shot(page, "step-1-dough");
    await next(page).click();

    // SAUCE: the paint trail follows the oval and is clipped to it
    await page.getByRole("button", { name: /トマトソース/ }).click();
    await expectOval(page, "SAUCE");
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      await tapDoughPercent(page, 50 + Math.cos(a) * 30, 50 + Math.sin(a) * 30);
    }
    const trail = page.locator(".pizza-paint-trail");
    await expect(trail).toHaveAttribute("preserveAspectRatio", "none");
    expect(await trail.evaluate((el) => getComputedStyle(el).clipPath)).toMatch(/ellipse/);
    const d = await box(page);
    const heat = (await page.locator(".pizza-sauce-heatmap").first().boundingBox())!;
    expect(heat.width / heat.height).toBeGreaterThan(ASPECT - 0.1); // the sauce canvas fills the oval's own border box (plus the border) -- it is drawn in the same box
    expect(heat.x).toBeLessThanOrEqual(d.x + 1);
    await shot(page, "step-2-sauce");
    await next(page).click();

    // CHEESE: placement validity follows the oval -- on the drawn rim is placeable, outside the drawn oval (the box's corners) is not
    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await expectOval(page, "CHEESE");
    const before = await pieces(page).count();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      await tapDoughPercent(page, 50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40);
    }
    const afterRim = await pieces(page).count();
    expect(afterRim, "pieces placed inside the oval").toBeGreaterThan(before);
    // the hit region IS the drawn oval: the box's corners are not the dough, a point on the drawn rim (46% of the box's own half-axes) is
    const hits = await page.evaluate(() => {
      const el = document.querySelector(".pizza-dough") as HTMLElement;
      const r = el.getBoundingClientRect();
      const on = (x: number, y: number) => {
        const hit = document.elementFromPoint(r.left + (x / 100) * r.width, r.top + (y / 100) * r.height);
        return hit !== null && el.contains(hit);
      };
      return {
        corners: [on(4, 4), on(96, 4), on(4, 96), on(96, 96)],
        rim: [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => on(50 + Math.cos((deg * Math.PI) / 180) * 46, 50 + Math.sin((deg * Math.PI) / 180) * 46)),
      };
    });
    expect(hits.corners, "the corners of the box are not the dough").toEqual([false, false, false, false]);
    expect(hits.rim, "the drawn rim is the dough, at every angle").toEqual(Array(8).fill(true));
    await shot(page, "step-3-cheese");
    await next(page).click();

    // TOPPING
    await page.getByRole("button", { name: /バジル/ }).click();
    await expectOval(page, "TOPPING");
    await tapDoughPercent(page, 38, 52);
    await tapDoughPercent(page, 62, 48);
    await shot(page, "step-4-topping");

    // BAKE then FINISH: the post layer is exactly the dough's box and a late piece lands inside the oval
    await enterBakePaused(page);
    await expectOval(page, "BAKE");
    await shot(page, "step-5-bake");
    await landNeedleAndTakeOut(page, { start: 58, end: 78 }, { finish: false });
    await expect(page.getByTestId("finish-dock")).toBeVisible();
    await expectOval(page, "FINISH");
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 50, 50);
    const post = page.getByTestId("pizza-post-layer");
    await expect(post).toBeVisible();
    const pb = (await post.boundingBox())!;
    const db = await box(page);
    for (const k of ["x", "y", "width", "height"] as const) expect(Math.abs(pb[k] - db[k]), `post layer ${k}`).toBeLessThanOrEqual(1.5);
    await shot(page, "step-6-finish");
    await page.getByTestId("finish-complete").click();

    // RESULT
    await page.waitForSelector(".result-panel");
    const result = page.locator(".pizza-stage--result .pizza-dough");
    await expect(result).toHaveClass(/pizza-dough--oval/);
    const rb = (await result.boundingBox())!;
    expect(rb.width / rb.height).toBeGreaterThan(ASPECT - 0.02);
    expect(rb.width / rb.height).toBeLessThan(ASPECT + 0.02);
    await noOverflow(page);
    await shot(page, "step-7-result");
  });

  test("the round pizza is unchanged: no oval class, a square box, default SVG overlays", async ({ page }) => {
    await freeCook(page, "");
    await expect(dough(page)).not.toHaveClass(/pizza-dough--oval/);
    const b = await box(page);
    expect(b.width / b.height).toBeGreaterThan(0.99);
    expect(b.width / b.height).toBeLessThan(1.01);
    await expect(page.locator(".dough-target-guide")).not.toHaveAttribute("preserveAspectRatio", /./);
    await expect(page.locator(".pizza-paint-trail")).not.toHaveAttribute("preserveAspectRatio", /./);
    expect(await page.locator(".pizza-paint-trail").evaluate((el) => getComputedStyle(el).clipPath)).toMatch(/circle/);
  });

  test("the small oval thumbnails out-rank the contextual square sizes (見本 mini, Pizza Select cards)", async ({ page }) => {
    await freeCook(page, "");
    const ratios = await page.evaluate(() => {
      const out: Record<string, number> = {};
      for (const [key, parent, cls] of [
        ["mini", "mini-reference__thumb", "reference-thumbnail"],
        ["select-grid", "pizza-select-grid-card", "pizza-thumbnail"],
        ["select-card", "pizza-select-card", "pizza-thumbnail"],
      ] as const) {
        const host = document.createElement("div");
        host.className = parent;
        host.style.cssText = "position:fixed;left:0;top:0;display:flex";
        const el = document.createElement("div");
        el.className = `${cls} ${cls}--oval`;
        host.appendChild(el);
        document.body.appendChild(host);
        const r = el.getBoundingClientRect();
        out[key] = r.width / r.height;
        host.remove();
      }
      return out;
    });
    for (const v of Object.values(ratios)) expect(Math.abs(v - ASPECT)).toBeLessThan(0.05);
  });
});
