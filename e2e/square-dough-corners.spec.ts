import { expect, test, type Page } from "@playwright/test";
import { startFreshMargherita } from "./gestures";

/**
 * #536 C square dough: STEP 1 「四隅まで伸ばす」 (the drag pulls the dough out of the small ball to the four corners) ->
 * STEP 2 「厚みを整える」 (tap / long press even it out) -> finished -> 「次へ」 fixes the shape. `?pan=square` is the production start
 * (a small ball); `&squareStart=lumpy` is the Preview sheet that already opens at STEP 2. Mouse input runs in every browser project
 * (Playwright's WebKit has no touch drag); the real-touch drag is registered for Chromium (CDP), as the held-finger spec is.
 */
const BALL = "?pan=square";
const LUMPY = "?pan=square&squareStart=lumpy";

const layer = (page: Page) => page.getByTestId("square-dough-layer");
const attr = async (page: Page, name: string) => (await layer(page).getAttribute(name)) ?? "";
const num = async (page: Page, name: string) => Number(await attr(page, name));
const nextButton = (page: Page) => page.getByRole("button", { name: /次へ/ });

async function start(page: Page, query: string) {
  await startFreshMargherita(page, query);
  await page.waitForSelector('[data-testid="square-dough-layer"]');
}
async function at(page: Page, xPercent: number, yPercent: number) {
  const box = (await layer(page).boundingBox())!;
  return { x: box.x + (box.width * xPercent) / 100, y: box.y + (box.height * yPercent) / 100 };
}
/** One mouse drag through dough-percent points. */
async function dragThrough(page: Page, points: [number, number][]) {
  const first = await at(page, ...points[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of points.slice(1)) {
    const q = await at(page, ...p);
    await page.mouse.move(q.x, q.y, { steps: 6 });
  }
  await page.mouse.up();
}
/** The thickest cell, judged from what is drawn (the darkest fill). */
async function darkestCell(page: Page): Promise<{ x: number; y: number }> {
  const idx = await layer(page).evaluate((el) => {
    let best = -1;
    let bestSum = Infinity;
    for (const r of el.querySelectorAll("rect[data-dough-cell]")) {
      const m = r.getAttribute("fill")!.match(/\d+/g)!.map(Number);
      const sum = m[0] + m[1] + m[2];
      if (sum < bestSum) {
        bestSum = sum;
        best = Number(r.getAttribute("data-dough-cell"));
      }
    }
    return best;
  });
  return { x: ((idx % 16) + 0.5) * (100 / 16), y: (Math.floor(idx / 16) + 0.5) * (100 / 16) };
}

test.describe("#536 C: STEP 1 (the production start, a small ball)", () => {
  test("opens at STEP 1 with four unreached corners, drag hints, the coverage goal and 次へ unavailable", async ({ page }) => {
    await start(page, BALL);
    expect(await attr(page, "data-step")).toBe("1");
    expect(await attr(page, "data-corners")).toBe("0");
    await expect(page.getByTestId("square-dough-step-1")).toHaveAttribute("data-state", "now");
    await expect(page.getByTestId("square-dough-step-2")).toHaveAttribute("data-state", "next");
    await expect(page.getByTestId("square-dough-goal")).toContainText("四隅 0/4");
    await expect(page.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "coverage");
    await expect(page.getByTestId("square-dough-gauge-goal")).toContainText("目標 95%");
    await expect(page.locator('[data-testid="square-corner-marks"] [data-reached="false"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="square-drag-hints"] > g')).toHaveCount(4);
    await expect(nextButton(page)).toBeDisabled();
  });

  test("dragging toward a corner pulls the dough there: the trail shows while the finger is down, the corner turns reached, the dough stays after the lift", async ({ page }) => {
    await start(page, BALL);
    const coverage0 = await num(page, "data-coverage");
    const a = await at(page, 50, 50);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (const [x, y] of [[62, 38], [74, 26], [86, 14], [90, 10]]) {
      const q = await at(page, x, y);
      await page.mouse.move(q.x, q.y, { steps: 5 });
    }
    await expect(page.getByTestId("square-drag-trail")).toBeVisible();
    expect(await attr(page, "data-dragging")).toBe("true");
    await expect(page.getByTestId("square-drag-hints")).toHaveCount(0); // the hints give way to the live trail
    await page.mouse.up();
    await expect(page.getByTestId("square-drag-trail")).toHaveCount(0);
    expect(await num(page, "data-coverage")).toBeGreaterThan(coverage0);
    expect(Number(await attr(page, "data-corners"))).toBeGreaterThanOrEqual(1);
    await expect(page.locator('[data-testid="square-corner-marks"] [data-corner="ne"]')).toHaveAttribute("data-reached", "true");
    await expect(page.getByTestId("square-dough-gauge-note")).toHaveText(/^\+\d+\.\d$/); // the real change of the coverage
    const kept = await num(page, "data-coverage");
    await page.waitForTimeout(500);
    expect(await num(page, "data-coverage")).toBe(kept);
    await expect(nextButton(page)).toBeDisabled(); // one corner is not the finish
  });

  test("a tap on the ball (no drag) changes nothing and is not mistaken for a drag; a drag does not also tap", async ({ page }) => {
    await start(page, BALL);
    const c0 = await num(page, "data-coverage");
    const p = await at(page, 50, 50);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 3, p.y + 2); // a trembling finger, inside the slop
    await page.mouse.up();
    expect(await num(page, "data-coverage")).toBe(c0);
    expect(await attr(page, "data-dragging")).toBe("false");
  });
});

test.describe("#536 C: STEP 1 -> STEP 2 -> finished -> 次へ", () => {
  test("pull to the four corners, cover the pan, even it out, then 次へ fixes the shape and the round moves on", async ({ page }) => {
    test.setTimeout(120_000);
    await start(page, BALL);
    const moves: string[] = [];
    // Serpentine strokes over the whole pan (a finger painting the sheet out), then the four corners.
    const rows = [14, 26, 38, 50, 62, 74, 86];
    for (let i = 0; i < rows.length; i++) {
      const y = rows[i];
      await dragThrough(page, i % 2 === 0 ? [[10, y], [50, y], [90, y]] : [[90, y], [50, y], [10, y]]);
      moves.push(`row${y}:cov=${await attr(page, "data-coverage")}`);
    }
    for (const [x, y] of [[10, 10], [90, 10], [90, 90], [10, 90]]) await dragThrough(page, [[50, 50], [x, y]]);
    expect(Number(await attr(page, "data-corners")), moves.join(" ")).toBe(4);
    // STEP 1 is done when all four corners AND 95 % of the pan are covered; sweep once more until the screen says so.
    for (let k = 0; k < 8 && (await attr(page, "data-step")) !== "2"; k++) {
      await dragThrough(page, [[12, 12 + k * 10], [88, 12 + k * 10]]);
    }
    expect(await attr(page, "data-step"), `coverage ${await attr(page, "data-coverage")}`).toBe("2");
    await expect(page.getByTestId("square-dough-step-1")).toHaveAttribute("data-state", "done");
    await expect(page.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "evenness");
    await expect(page.getByTestId("square-dough-gauge-goal")).toContainText("目標 60%");
    await expect(page.getByTestId("dough-size-status")).toContainText("メイン：タップ＝おす");
    // STEP 2: tap / long-press / drag all still work. Even the dough out with taps on the thickest place.
    for (let k = 0; k < 60 && (await attr(page, "data-complete")) !== "true"; k++) {
      const p = await darkestCell(page);
      const q = await at(page, p.x, p.y);
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.waitForTimeout(k % 3 === 0 ? 700 : 30); // a hold now and then, otherwise a tap
      await page.mouse.up();
    }
    expect(await attr(page, "data-complete"), `evenness ${await attr(page, "data-evenness")}`).toBe("true");
    expect(await attr(page, "data-step")).toBe("2"); // finishing never sends the player back
    await expect(nextButton(page)).toBeEnabled();
    await expect(page.getByTestId("square-dough-goal")).toContainText("できあがり");
    // Re-editing stays possible until 次へ: one more tap is accepted (the layer still takes input) and 次へ follows the dough.
    const t = await at(page, 50, 50);
    await page.mouse.click(t.x, t.y);
    expect(await attr(page, "data-step")).toBe("2");
    expect(["true", "false"]).toContain(await attr(page, "data-complete"));
    if ((await attr(page, "data-complete")) === "true") {
      await nextButton(page).click();
      await expect(layer(page)).toHaveCount(0); // DOUGH is confirmed: the layer is gone, the round moved on to SAUCE
      await expect(page.getByTestId("square-dough-steps")).toHaveCount(0);
    }
  });
});

test.describe("#536 C: a cancelled gesture never takes an announced step back (Codex P2)", () => {
  test("a drag that reaches STEP 1's bar while the finger is still down does not open STEP 2 until it lifts; a blur (cancel) leaves STEP 1", async ({ page }) => {
    test.setTimeout(120_000);
    await start(page, BALL);
    for (const [x, y] of [[10, 10], [90, 10], [90, 90], [10, 90]]) await dragThrough(page, [[50, 50], [x, y]]);
    let tested = false;
    const rows = [14, 26, 38, 50, 62, 74, 86, 20, 32, 44, 56, 68, 80];
    for (let i = 0; i < rows.length && !tested; i++) {
      const y = rows[i];
      const points: [number, number][] = i % 2 === 0 ? [[10, y], [50, y], [90, y]] : [[90, y], [50, y], [10, y]];
      // a stroke with the finger kept down
      const first = await at(page, ...points[0]);
      await page.mouse.move(first.x, first.y);
      await page.mouse.down();
      for (const p of points.slice(1)) {
        const q = await at(page, ...p);
        await page.mouse.move(q.x, q.y, { steps: 6 });
      }
      const liveCoverage = await num(page, "data-coverage");
      const committedStep = await attr(page, "data-step");
      if (liveCoverage >= 0.95 && committedStep === "1") {
        // the live dough meets the bar, the announcement waits for the lift
        await expect(page.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "1");
        await expect(page.getByTestId("square-dough-step-2")).toHaveAttribute("data-state", "next");
        await page.evaluate(() => window.dispatchEvent(new Event("blur"))); // the gesture is thrown away
        await page.mouse.up();
        expect(await attr(page, "data-step")).toBe("1");
        await expect(page.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "1");
        expect(await num(page, "data-coverage")).toBeLessThan(0.95);
        // the same stroke, lifted: committed, STEP 2 opens
        await dragThrough(page, points);
        await expect(page.getByTestId("square-dough-steps")).toHaveAttribute("data-step", "2");
        tested = true;
      } else {
        await page.mouse.up();
      }
    }
    expect(tested, "a stroke that crosses the coverage bar was found").toBe(true);
  });
});

test.describe("#536 C: tap / long press vs drag (STEP 2 on the lumpy sheet)", () => {
  test("a tap with a trembling finger is a tap; a stroke is a drag and does not also tap (no double application)", async ({ page }) => {
    await start(page, LUMPY);
    expect(await attr(page, "data-step")).toBe("2");
    const e0 = await num(page, "data-evenness");
    const p = await at(page, 58, 48);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 4, p.y + 3);
    await page.mouse.up();
    const eTap = await num(page, "data-evenness");
    expect(eTap).toBeGreaterThan(e0); // tap with a tremble: still a tap
    // a deliberate stroke over the other lumps: a drag; the full sheet has nothing to pull out, and the tap at its start was reverted
    const q = await at(page, 30, 70);
    await page.mouse.move(q.x, q.y);
    await page.mouse.down();
    await page.mouse.move(q.x + 90, q.y, { steps: 8 });
    await page.mouse.up();
    expect(await num(page, "data-evenness")).toBe(eTap);
  });

  test("a hold keeps spreading while it is down and still works in STEP 2", async ({ page }) => {
    await start(page, LUMPY);
    const e0 = await num(page, "data-evenness");
    const p = await at(page, 30, 70);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await expect(layer(page)).toHaveAttribute("data-pressing", "hold");
    await page.mouse.up();
    expect(await num(page, "data-evenness")).toBeGreaterThan(e0);
  });
});

test.describe("#536 C: layout and the screen edge", () => {
  test("the pan stays clear of the screen-edge swipe zones, the guide fits, nothing scrolls, 次へ is not covered", async ({ page }) => {
    await start(page, BALL);
    const vp = page.viewportSize()!;
    const pan = (await layer(page).boundingBox())!;
    expect(pan.x, "left edge swipe zone (iOS back gesture ~20px)").toBeGreaterThanOrEqual(40);
    expect(vp.width - (pan.x + pan.width), "right edge").toBeGreaterThanOrEqual(40);
    for (const id of ["square-dough-steps", "dough-size-status", "square-dough-gauge", "square-dough-next"]) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
      expect(b.y).toBeGreaterThanOrEqual(pan.y + pan.height);
    }
    for (const id of ["square-dough-goal", "dough-size-status", "square-dough-next"]) {
      expect(await page.getByTestId(id).evaluate((el) => el.scrollWidth > el.clientWidth + 1), `${id} shows all of its text`).toBe(false);
    }
    const next = await nextButton(page).boundingBox();
    const guideBottom = (await page.getByTestId("square-dough-next").boundingBox())!;
    if (next) expect(guideBottom.y + guideBottom.height).toBeLessThanOrEqual(next.y + 0.5);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight)).toBe(true);
    // the corner marks are inside the pan and inside the viewport
    for (const corner of ["nw", "ne", "se", "sw"]) {
      const m = (await page.locator(`[data-testid="square-corner-marks"] [data-corner="${corner}"] circle`).boundingBox())!;
      expect(m.x).toBeGreaterThanOrEqual(pan.x);
      expect(m.x + m.width).toBeLessThanOrEqual(pan.x + pan.width);
      expect(m.y).toBeGreaterThanOrEqual(pan.y);
      expect(m.y + m.height).toBeLessThanOrEqual(pan.y + pan.height);
    }
  });
});

test.describe("#536 C: a finger on Chromium (CDP touch)", () => {
  test.use({ hasTouch: true });
  test("a touch drag from the ball to a corner pulls the dough, never scrolls the page, and ends cleanly", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "capability gate, not a tolerance: a touch that stays down and moves needs CDP Input.dispatchTouchEvent (Chromium only)");
    await start(page, BALL);
    const cdp = await page.context().newCDPSession(page);
    const a = await at(page, 50, 50);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
    for (let k = 1; k <= 12; k++) {
      const q = await at(page, 50 + (41 * k) / 12, 50 - (41 * k) / 12);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: q.x, y: q.y }] });
      await page.waitForTimeout(16);
    }
    await expect(page.getByTestId("square-drag-trail")).toBeVisible();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByTestId("square-drag-trail")).toHaveCount(0);
    await expect(page.locator('[data-testid="square-corner-marks"] [data-corner="ne"]')).toHaveAttribute("data-reached", "true");
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
  });
});

test.describe("#536 C: the round pizza is untouched", () => {
  test("a round round has no corner marks, hints or STEP strip", async ({ page }) => {
    await startFreshMargherita(page, "");
    await expect(page.getByTestId("square-dough-layer")).toHaveCount(0);
    await expect(page.getByTestId("square-corner-marks")).toHaveCount(0);
    await expect(page.getByTestId("square-dough-steps")).toHaveCount(0);
  });
});
