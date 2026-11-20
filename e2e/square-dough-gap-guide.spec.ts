import { expect, test, type Page } from "@playwright/test";
import { startFreshMargherita } from "./gestures";

/**
 * Square Dough UX (#536, AB-min; docs/design/TETO_SQUARE-DOUGH_UX-CLARITY_FRESH-AUDIT-DESIGN.md): the Owner's iPhone HV stuck state -- four corner pulls reach
 * 4/4 corners while STEP 1 (coverage 95 %) is open -- must say so ("すき間をうめよう"), tint the bare cells, point into the gaps, and not look finished.
 * Both authority viewports (the project sets it). Judgement, thresholds and layout are unchanged: asserted below. HV_SHOT_DIR (optional) writes screenshots.
 */
const BALL = "?pan=square";
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

const layer = (page: Page) => page.getByTestId("square-dough-layer");
const attr = async (page: Page, name: string) => (await layer(page).getAttribute(name)) ?? "";
const num = async (page: Page, name: string) => Number(await attr(page, name));
const nextButton = (page: Page) => page.getByRole("button", { name: /次へ/ });

async function start(page: Page, query = BALL) {
  await startFreshMargherita(page, query);
  await page.waitForSelector('[data-testid="square-dough-layer"]');
}
async function at(page: Page, xPercent: number, yPercent: number) {
  const box = (await layer(page).boundingBox())!;
  return { x: box.x + (box.width * xPercent) / 100, y: box.y + (box.height * yPercent) / 100 };
}
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
/** The four pulls the screen asks for: from the centre to each corner mark (the exact stuck state measured in the audit). */
async function fourCornerPulls(page: Page) {
  for (const [x, y] of [[11, 11], [89, 11], [89, 89], [11, 89]] as const) await dragThrough(page, [[50, 50], [x, y]]);
}
async function metrics(page: Page) {
  return page.evaluate(() => {
    const r = (sel: string) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { top: Math.round(b.top * 10) / 10, height: Math.round(b.height * 10) / 10, width: Math.round(b.width * 10) / 10 };
    };
    const next = [...document.querySelectorAll("button")].find((b) => /次へ/.test(b.textContent ?? ""))?.getBoundingClientRect();
    return {
      steps: r('[data-testid="square-dough-steps"]'),
      goal: r('[data-testid="square-dough-goal"]'),
      gauge: r('[data-testid="square-dough-gauge"]'),
      nextLine: r('[data-testid="square-dough-next"]'),
      layer: r('[data-testid="square-dough-layer"]'),
      nextBottom: next ? Math.round(next.bottom * 10) / 10 : null,
      scroll: { sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight },
    };
  });
}

test.describe("AB-min: 4/4 corners, STEP 1 still open", () => {
  test("is pinned: four corner pulls leave STEP 1 open and the screen says 「すき間をうめよう」, with the gaps tinted and pointed at", async ({ page }) => {
    test.setTimeout(90_000);
    await start(page);
    const targetGuides = await page.locator(".square-target-guide").count(); // the SAUCE guide is mounted in a square round already (#573); AB-min adds no copy of it
    const before = await metrics(page);
    await shot(page, "before-start");
    await fourCornerPulls(page);
    await shot(page, "after-four-corners");

    // the state itself (the judgement is unchanged: STEP 1, 4 corners, coverage below the bar, no way to 次へ)
    expect(await attr(page, "data-corners")).toBe("4");
    expect(await attr(page, "data-step")).toBe("1");
    expect(await num(page, "data-coverage")).toBeLessThan(0.95);
    expect(await attr(page, "data-complete")).toBe("false");
    await expect(nextButton(page)).toBeDisabled();
    await expect(page.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "coverage");
    await expect(page.getByTestId("square-dough-gauge-goal")).toContainText("目標 95%");
    await expect(page.getByTestId("square-dough-step-1")).toHaveAttribute("data-state", "now");
    await expect(page.getByTestId("square-dough-step-2")).toHaveAttribute("data-state", "next");

    // the words on the EXISTING goal line, with the real coverage
    const goal = page.getByTestId("square-dough-goal");
    await expect(goal).toContainText("すき間をうめよう");
    await expect(goal).toContainText(/ひろがり \d+\.\d%/);
    await expect(goal).not.toContainText("四隅");
    await expect(page.getByTestId("square-dough-next")).toContainText("天板いっぱい");

    // the picture: bare cells tinted, 1..3 arrows, the corner arrows gone, the ticks are NOT the solid "done" look
    const guide = page.getByTestId("square-gap-guide");
    await expect(guide).toBeVisible();
    expect(Number(await guide.getAttribute("data-bare"))).toBeGreaterThan(0);
    const arrows = Number(await guide.getAttribute("data-gaps"));
    expect(arrows).toBeGreaterThanOrEqual(1);
    expect(arrows).toBeLessThanOrEqual(3);
    await expect(page.getByTestId("square-gap-arrows").locator("> g")).toHaveCount(arrows);
    await expect(page.getByTestId("square-drag-hints")).toHaveCount(0);
    await expect(page.locator('[data-testid="square-corner-marks"] [data-reached="true"][data-pending="true"]')).toHaveCount(4);
    await expect(page.locator(".square-target-guide")).toHaveCount(targetGuides); // the SAUCE guide is not reused (no extra copy)
    await expect(page.locator(".square-gap-guide .square-target-guide, .square-target-guide .square-gap-guide")).toHaveCount(0);

    // no new row, nothing moved: every box of the dock is where it was, the goal is one line, nothing scrolls
    const after = await metrics(page);
    for (const key of ["steps", "goal", "gauge", "nextLine", "layer"] as const) expect(after[key], key).toEqual(before[key]);
    expect(after.nextBottom).toBe(before.nextBottom);
    expect(after.scroll).toEqual(before.scroll);
    expect(after.scroll.sw).toBeLessThanOrEqual(after.scroll.iw);
    expect(after.scroll.sh).toBeLessThanOrEqual(after.scroll.ih);
    // the arrows stay inside the pan's box (so inside the screen)
    const inside = await page.evaluate(() => {
      const l = document.querySelector('[data-testid="square-dough-layer"]')!.getBoundingClientRect();
      return [...document.querySelectorAll('[data-testid="square-gap-arrows"] line, [data-testid="square-gap-arrows"] circle')].every((el) => {
        const b = el.getBoundingClientRect();
        return b.left >= l.left - 1 && b.right <= l.right + 1 && b.top >= l.top - 1 && b.bottom <= l.bottom + 1 && b.left >= 0 && b.right <= window.innerWidth;
      });
    });
    expect(inside).toBe(true);
  });

  test("following the arrows finishes STEP 1: the guide shrinks as the sheet fills, then gives way to STEP 2 (ticks turn solid, no gap guide)", async ({ page }) => {
    test.setTimeout(120_000);
    await start(page);
    await fourCornerPulls(page);
    let coverage = await num(page, "data-coverage");
    expect(await attr(page, "data-step")).toBe("1");
    for (let i = 0; i < 14 && (await attr(page, "data-step")) === "1"; i++) {
      const [x1, y1, x2, y2] = await page.locator('[data-testid="square-gap-arrows"] line').first().evaluate((el) => ["x1", "y1", "x2", "y2"].map((a) => Number(el.getAttribute(a))));
      await dragThrough(page, [[x1, y1], [(x1 + x2) / 2, (y1 + y2) / 2], [x2, y2]]);
      const now = await num(page, "data-coverage");
      expect(now, `stroke ${i} keeps or grows the coverage`).toBeGreaterThanOrEqual(coverage);
      coverage = now;
    }
    expect(await attr(page, "data-step")).toBe("2");
    expect(coverage).toBeGreaterThanOrEqual(0.95);
    await expect(page.getByTestId("square-gap-guide")).toHaveCount(0);
    await expect(page.getByTestId("square-dough-goal")).not.toContainText("すき間");
    await expect(page.locator('[data-testid="square-corner-marks"] [data-pending="false"][data-reached="true"]')).toHaveCount(4);
    await expect(page.getByTestId("square-dough-step-1")).toHaveAttribute("data-state", "done");
    await shot(page, "after-step1-done");
  });

  test("the guide gives way to the live trail while the finger is down and returns after the lift", async ({ page }) => {
    await start(page);
    await fourCornerPulls(page);
    await expect(page.getByTestId("square-gap-guide")).toBeVisible();
    const a = await at(page, 50, 30);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    const b = await at(page, 60, 36);
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await expect(page.getByTestId("square-drag-trail")).toBeVisible();
    await expect(page.getByTestId("square-gap-guide")).toHaveCount(0);
    await page.mouse.up();
    await expect(page.getByTestId("square-gap-guide")).toBeVisible();
  });

  test("before the fourth corner nothing changes: the corner wording and the corner arrows stay", async ({ page }) => {
    await start(page);
    await dragThrough(page, [[50, 50], [89, 11]]);
    expect(await attr(page, "data-corners")).toBe("1");
    await expect(page.getByTestId("square-dough-goal")).toContainText("四隅 1/4");
    await expect(page.getByTestId("square-gap-guide")).toHaveCount(0);
    await expect(page.getByTestId("square-drag-hints").locator("> g")).toHaveCount(3);
  });
});

test("a round pizza's DOUGH step has no square layer and no gap guide (regression)", async ({ page }) => {
  await startFreshMargherita(page);
  await page.waitForSelector(".pizza-stage");
  await expect(page.getByTestId("square-dough-layer")).toHaveCount(0);
  await expect(page.getByTestId("square-gap-guide")).toHaveCount(0);
});
