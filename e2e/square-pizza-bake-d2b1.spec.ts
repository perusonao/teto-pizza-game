import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep, enterBakePaused, landNeedleAndTakeOut, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * Square-Pan Dough D2-b1 (#537, Epic #532): the bake overlays of a square pan -- the sheen / char layers, the char spots and the one-shot perfect-bake glow --
 * on the real page, with the Preview switch `?pan=square&squareStart=lumpy` (no catalog recipe uses the tray yet, so Production never reaches this).
 * The viewport comes from the project (390x844 / 360x800). Read off the screen's own pixels AFTER the dough's CSS filter (the #519 lesson): the same
 * frame is shot with the overlays shown and hidden, so the only difference is the overlays' own contribution. HV_SHOT_DIR (optional) writes screenshots.
 */
const QUERY = "?pan=square&squareStart=lumpy";
const SHOT_DIR = process.env.HV_SHOT_DIR;

async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

/** real time, not the faked page clock (CSS transitions / animations run on the real one) */
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rectOf = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, selector);

function expectRect(actual: { x: number; y: number; w: number; h: number }, expected: { x: number; y: number; w: number; h: number }, tolerance = 1.5) {
  for (const key of ["x", "y", "w", "h"] as const) expect(Math.abs(actual[key] - expected[key]), key).toBeLessThanOrEqual(tolerance);
}

/** RGB of the screen at dough-percent points (of the dough's border box), decoded from a real screenshot */
async function screenPixels(page: Page, points: ReadonlyArray<readonly [number, number]>) {
  const d = await rectOf(page, ".pizza-dough");
  const png = await page.screenshot({ clip: { x: d.x, y: d.y, width: d.w, height: d.h } });
  return page.evaluate(
    async ([b64, pts, w, h]) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const sx = bitmap.width / (w as number);
      const sy = bitmap.height / (h as number);
      return (pts as Array<[number, number]>).map(([px, py]) => {
        const data = ctx.getImageData(Math.round(((px / 100) * (w as number)) * sx), Math.round(((py / 100) * (h as number)) * sy), 1, 1).data;
        return [data[0], data[1], data[2]];
      });
    },
    [png.toString("base64"), points.map((p) => [p[0], p[1]]), d.w, d.h] as const,
  );
}

const distance = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

async function setOverlaysVisible(page: Page, visible: boolean) {
  await page.evaluate((show) => {
    let style = document.getElementById("d2b1-hide") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "d2b1-hide";
      document.head.appendChild(style);
    }
    style.textContent = show ? "" : ".pizza-bake-overlay, .pizza-char-spots { visibility: hidden !important; }";
  }, visible);
  await settle(120);
}

/** a fresh square round up to the BAKE step (sauce, cheese, no toppings), the clock paused right after BAKE mounted */
async function squareRoundToBake(page: Page) {
  await startFreshMargherita(page, QUERY);
  await page.waitForSelector('[data-testid="square-dough-layer"]');
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  for (const [x, y] of [[9, 9], [91, 9], [91, 91], [9, 91], [50, 50]]) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await enterBakePaused(page);
}

test.describe("D2-b1 square pan: bake overlays", () => {
  test("char overlay and char spots take the pan's box and corner: they reach the four corners and stop at the pan's edge (screen pixels)", async ({ page }) => {
    test.setTimeout(90_000);
    await squareRoundToBake(page);
    await page.clock.runFor(3300); // the one-way needle holds at 100: charred
    await settle(700); // the dough's 0.4s filter / overlay transitions
    await shot(page, "bake-char");

    const dough = await rectOf(page, ".pizza-dough");
    for (const selector of [".pizza-bake-overlay--sheen", ".pizza-bake-overlay--char", ".pizza-char-spots"]) {
      expectRect(await rectOf(page, selector), dough); // the pan's box (the border box), not the padding box
      const style = await page.locator(selector).evaluate((el) => ({ clip: getComputedStyle(el).clipPath, radius: getComputedStyle(el).borderTopLeftRadius }));
      expect(style.clip, selector).toContain("inset(6%");
      expect(style.radius, selector).toBe("0px"); // no disc
    }

    const corners: Array<[number, number]> = [[8, 8], [92, 8], [92, 92], [8, 92]];
    const outside: Array<[number, number]> = [[2.5, 2.5], [97.5, 2.5], [97.5, 97.5], [2.5, 97.5], [2.5, 50], [97.5, 50], [50, 97.5]];
    await setOverlaysVisible(page, true);
    const withOverlays = await screenPixels(page, [...corners, ...outside]);
    await setOverlaysVisible(page, false);
    const without = await screenPixels(page, [...corners, ...outside]);
    await setOverlaysVisible(page, true);

    corners.forEach((c, i) => expect(distance(withOverlays[i], without[i]), `corner ${c} is baked`).toBeGreaterThan(30));
    outside.forEach((c, i) => expect(distance(withOverlays[corners.length + i], without[corners.length + i]), `${c} (off the pan) is untouched`).toBeLessThanOrEqual(6));
  });

  test("perfect bake: the glow is a rounded square around the pan at RESULT, the pan keeps its square at the RESULT scale", async ({ page }) => {
    test.setTimeout(90_000);
    await squareRoundToBake(page);
    await page.clock.runFor(1200);
    await landNeedleAndTakeOut(page, { start: 60, end: 80 });
    await expect(page.locator(".pizza-stage--result")).toBeVisible();
    await expect(page.getByRole("button", { name: /切り終わる/ })).toHaveCount(0); // CUT stays off for a square pan

    const glow = page.locator(".pizza-perfect-glow");
    await expect(glow).toHaveCount(1);
    const glowStyle = await glow.evaluate((el) => ({ clip: getComputedStyle(el).clipPath, radius: getComputedStyle(el).borderTopLeftRadius }));
    expect(glowStyle.clip).toContain("inset(3%");
    expect(glowStyle.radius).toBe("0px");
    await shot(page, "result-perfect");

    const dough = await rectOf(page, ".pizza-dough");
    expect(Math.abs(dough.w - dough.h)).toBeLessThanOrEqual(1);
    const viewport = page.viewportSize()!;
    expect(Math.abs(dough.w - Math.min(0.58 * viewport.width, 196)), "the RESULT scale is the round pizza's").toBeLessThanOrEqual(1.5);
    expectRect(await rectOf(page, ".pizza-dough-square"), dough);
    const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(sw.sw).toBeLessThanOrEqual(sw.iw);
  });

  test("a round pizza keeps its disc overlays (regression)", async ({ page }) => {
    test.setTimeout(90_000);
    await startFreshMargherita(page);
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /トマトソース/ }).click();
    await tapDoughPercent(page, 50, 50);
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 50, 30);
    await page.getByRole("button", { name: /次へ/ }).click();
    await enterBakePaused(page);
    await page.clock.runFor(3300);
    await settle(500);
    await expect(page.locator(".pizza-dough")).not.toHaveClass(/pizza-dough--square-pan/);
    const dough = await page.locator(".pizza-dough").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, border: parseFloat(getComputedStyle(el).borderTopWidth) };
    });
    for (const selector of [".pizza-bake-overlay--sheen", ".pizza-bake-overlay--char", ".pizza-char-spots"]) {
      const r = await rectOf(page, selector);
      expectRect(r, { x: dough.x + dough.border, y: dough.y + dough.border, w: dough.w - 2 * dough.border, h: dough.h - 2 * dough.border });
      const style = await page.locator(selector).evaluate((el) => ({ clip: getComputedStyle(el).clipPath, radius: getComputedStyle(el).borderTopLeftRadius }));
      expect(style.clip, selector).toBe("none");
      expect(style.radius, selector).toBe("50%");
    }
    await shot(page, "round-bake-char");
  });
});
