import { expect, test, type Page } from "@playwright/test";
import { startFreshMargherita } from "./gestures";

/**
 * #535 B2 visual feedback (Owner iPhone HV: the change was too faint to see). Real touch input, real clock. The smoothness gauge must
 * equal the real evenness, the change note must be truthful, the highlight must mark exactly the cells whose colour changed, and
 * the gauge must fit the phone layouts.
 */
test.use({ hasTouch: true });

const QUERY = "?pan=square&squareStart=lumpy";
const layer = (page: Page) => page.getByTestId("square-dough-layer");
const gauge = (page: Page) => page.getByTestId("square-dough-gauge");

async function at(page: Page, xPercent: number, yPercent: number) {
  const box = (await layer(page).boundingBox())!;
  return { x: box.x + (box.width * xPercent) / 100, y: box.y + (box.height * yPercent) / 100 };
}
async function start(page: Page) {
  await startFreshMargherita(page, QUERY);
  await page.waitForSelector('[data-testid="square-dough-layer"]');
}
/** index -> fill of every drawn cell */
function fills(page: Page): Promise<Record<string, string>> {
  return layer(page).evaluate((el) => {
    const out: Record<string, string> = {};
    for (const r of el.querySelectorAll("rect[data-dough-cell]")) out[r.getAttribute("data-dough-cell")!] = r.getAttribute("fill")!;
    return out;
  });
}

test.describe("#535 B2 square dough: visual feedback", () => {
  test("the gauge shows the real evenness and a truthful change after a tap", async ({ page }) => {
    await start(page);
    const evenness = async () => Number(await layer(page).getAttribute("data-evenness"));
    await expect(gauge(page)).toBeVisible();
    const value = page.getByTestId("square-dough-gauge-value");
    const before = await evenness();
    await expect(value).toHaveText(`${(before * 100).toFixed(1)}%`);
    const p = await at(page, 58, 48);
    await page.touchscreen.tap(p.x, p.y);
    const after = await evenness();
    expect(after).toBeGreaterThan(before);
    await expect(value).toHaveText(`${(after * 100).toFixed(1)}%`);
    const note = page.getByTestId("square-dough-gauge-note");
    await expect(note).toHaveText(/^\+\d+\.\d$/);
    const shown = Number((await note.textContent())!.replace("+", ""));
    expect(Math.abs(shown - (after - before) * 100)).toBeLessThan(0.06);
  });

  test("a press outside the pan changes nothing and the gauge says so (no fake progress)", async ({ page }) => {
    await start(page);
    const evenness = async () => Number(await layer(page).getAttribute("data-evenness"));
    const before = await evenness();
    const beforeFills = await fills(page);
    const box = (await layer(page).boundingBox())!;
    await page.touchscreen.tap(box.x + 2, box.y + 2); // a corner of the layer, far outside the 88%-wide pan's cells
    expect(await evenness()).toBe(before);
    expect(await fills(page)).toEqual(beforeFills);
    await expect(page.getByTestId("square-dough-gauge-value")).toHaveText(`${(before * 100).toFixed(1)}%`);
    // Either no note at all or an explicit 変化なし is truthful; a "+x.x" tick is the one thing it must never show.
    await expect(page.getByTestId("square-dough-gauge-note")).not.toHaveText(/\+\d/);
  });

  test("the highlight marks exactly the cells that changed, shows after release and fades away", async ({ page }) => {
    await start(page);
    const beforeFills = await fills(page);
    const p = await at(page, 58, 48);
    await page.touchscreen.tap(p.x, p.y);
    const marked = page.locator('[data-testid="square-dough-changed"] rect');
    await expect(marked.first()).toBeVisible();
    const afterFills = await fills(page);
    const markedIds = new Set(await marked.evaluateAll((els) => els.map((e) => e.getAttribute("data-cell")!)));
    expect(markedIds.size).toBeGreaterThan(0);
    for (const [id, fill] of Object.entries(afterFills)) {
      if (!markedIds.has(id)) expect(fill, `unmarked cell ${id} must keep its colour`).toBe(beforeFills[id]);
    }
    for (const id of markedIds) expect(afterFills[id], `marked cell ${id} must have changed colour`).not.toBe(beforeFills[id]);
    await expect(page.getByTestId("square-dough-changed")).toHaveCount(0, { timeout: 2000 });
  });

  test("the visible colour change of a tap is clearly noticeable", async ({ page }) => {
    await start(page);
    const beforeFills = await fills(page);
    const p = await at(page, 58, 48);
    await page.touchscreen.tap(p.x, p.y);
    const afterFills = await fills(page);
    const dist = (a: string, b: string) => {
      const n = (s: string) => s.match(/\d+/g)!.map(Number);
      const [x, y] = [n(a), n(b)];
      return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
    };
    const biggest = Math.max(...Object.keys(afterFills).map((id) => dist(afterFills[id], beforeFills[id])));
    expect(biggest, "the most-changed cell shifts by a clearly visible RGB distance").toBeGreaterThanOrEqual(12);
  });

  test("the gauge fits the viewport without scrolling and does not cover the CTA", async ({ page }) => {
    await start(page);
    const box = (await gauge(page).boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight)).toBe(true);
    const next = await page.getByRole("button", { name: /次へ/ }).boundingBox();
    if (next) {
      const overlap = box.x < next.x + next.width && next.x < box.x + box.width && box.y < next.y + next.height && next.y < box.y + box.height;
      expect(overlap, "gauge must not overlap 次へ").toBe(false);
    }
  });
});

test.describe("#535 B2 square dough: STEP 1/2 guide", () => {
  test("names the two steps, the goal, the operation, the target and what comes next", async ({ page }) => {
    await start(page);
    await expect(page.getByTestId("square-dough-step-1")).toContainText("STEP 1");
    await expect(page.getByTestId("square-dough-step-1")).toContainText("生地を平らにする");
    await expect(page.getByTestId("square-dough-step-2")).toContainText("四隅まで伸ばす");
    await expect(page.getByTestId("square-dough-goal")).toContainText("盛り上がった濃いところを押して、平らにしよう");
    await expect(page.getByTestId("dough-size-status")).toContainText("タップ＝おす");
    await expect(page.getByTestId("dough-size-status")).toContainText("長おし＝広くならす");
    await expect(page.getByTestId("square-dough-gauge-goal")).toContainText("目標 80%");
    await expect(page.getByTestId("square-dough-next")).toContainText("つぎは「四隅まで伸ばす」");
    await expect(page.getByTestId("order-card-hint")).toContainText("生地を平らにして、四隅まで伸ばそう");
    // the goal is not met on the lumpy start, and the gauge says so
    await expect(gauge(page)).toHaveAttribute("data-reached", "false");
  });

  test("the whole guide fits the viewport in order, without overlap, scroll, or moving the pan", async ({ page }) => {
    await start(page);
    const vp = page.viewportSize()!;
    const ids = ["square-dough-steps", "dough-size-status", "square-dough-gauge", "square-dough-next"];
    const boxes = [];
    for (const id of ids) boxes.push((await page.getByTestId(id).boundingBox())!);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
      expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].y, `${ids[i]} sits below ${ids[i - 1]}`).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height - 0.5);
    const pan = (await layer(page).boundingBox())!;
    expect(boxes[0].y, "the guide is under the pan").toBeGreaterThanOrEqual(pan.y + pan.height);
    // the single-line texts are not cut off (ellipsis would hide words)
    for (const id of ["square-dough-goal", "dough-size-status", "square-dough-next"]) {
      const clipped = await page.getByTestId(id).evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, `${id} must show all of its text`).toBe(false);
    }
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight)).toBe(true);
    const next = await page.getByRole("button", { name: /次へ/ }).boundingBox();
    if (next) expect(boxes[3].y + boxes[3].height).toBeLessThanOrEqual(next.y + 0.5);
    // a tap changes the gauge but not the layout
    const p = await at(page, 58, 48);
    await page.touchscreen.tap(p.x, p.y);
    const pan2 = (await layer(page).boundingBox())!;
    expect(pan2).toEqual(pan);
  });
});

test.describe("#535 B2 round pizza is unaffected", () => {
  test("no square layer or gauge on the round pizza dough step", async ({ page }) => {
    await startFreshMargherita(page, "");
    await expect(page.getByTestId("square-dough-layer")).toHaveCount(0);
    await expect(page.getByTestId("square-dough-gauge")).toHaveCount(0);
    await expect(page.getByTestId("square-dough-steps")).toHaveCount(0);
    await expect(page.getByTestId("square-dough-next")).toHaveCount(0);
    await expect(page.getByTestId("order-card-hint")).toContainText("生地を伸ばしたり縮めたりして形を整えよう");
  });
});
