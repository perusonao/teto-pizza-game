import { expect, test, type Page } from "@playwright/test";
import { startFreshMargherita } from "./gestures";

/**
 * Square dough push-stretch PROTOTYPE (Preview / DEV, `?squareModel=stretch`; Owner direction after PR #581's iPhone HV FAIL). Both authority viewports
 * (the project sets it). The current model is what runs without the flag: asserted too. HV_SHOT_DIR (optional) writes screenshots.
 * The "player" is src/logic/pan/squareStretchPlayer.ts loaded in the page (dev server): it plans each operation from the dough on screen.
 */
const BASE = "?pan=square&squareModel=stretch";
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}
const layer = (page: Page) => page.getByTestId("square-dough-layer");
const attr = async (page: Page, name: string) => (await layer(page).getAttribute(name)) ?? "";
const num = async (page: Page, name: string) => Number(await attr(page, name));
const thickness = async (page: Page) => (await attr(page, "data-thickness")).split(",").map(Number);
const massOf = (t: number[]) => t.reduce((s, v) => s + v, 0);
/** data-thickness prints 3 decimals (196 cells), so a conserved total reads within ~0.1. */
const expectConserved = (now: number[], before: number[]) => expect(Math.abs(massOf(now) - massOf(before))).toBeLessThan(0.1);
const nextButton = (page: Page) => page.getByRole("button", { name: /次へ/ });

async function start(page: Page, query: string) {
  await startFreshMargherita(page, query);
  await page.waitForSelector('[data-testid="square-dough-layer"]');
}
async function at(page: Page, x: number, y: number) {
  const box = (await layer(page).boundingBox())!;
  return { x: box.x + (box.width * x) / 100, y: box.y + (box.height * y) / 100 };
}
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await at(page, ...from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const b = await at(page, ...to);
  await page.mouse.move(b.x, b.y, { steps: 14 });
  await page.mouse.up();
}
async function hold(page: Page, p: [number, number], ms = 900) {
  const a = await at(page, ...p);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
/** The player's next operation, planned in the page from the thickness on screen (null = nothing helps / done). */
async function plan(page: Page, kind: "spread" | "even", t: number[]) {
  return page.evaluate(
    async ({ kind, t }) => {
      const player = await import(/* @vite-ignore */ "/teto-pizza-game/src/logic/pan/squareStretchPlayer.ts");
      if (kind === "spread") return player.nextSpreadStroke({ thickness: t });
      const next = player.nextEvenOp({ thickness: t });
      return next ? next.op : null;
    },
    { kind, t },
  );
}
async function metrics(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    };
    const next = [...document.querySelectorAll("button")].find((b) => /次へ/.test(b.textContent ?? ""))?.getBoundingClientRect();
    return {
      layer: box('[data-testid="square-dough-layer"]'),
      steps: box('[data-testid="square-dough-steps"]'),
      gauge: box('[data-testid="square-dough-gauge"]'),
      nextLine: box('[data-testid="square-dough-next"]'),
      nextBottom: next ? next.bottom : null,
      iw: window.innerWidth,
      ih: window.innerHeight,
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
    };
  });
}
async function expectFits(page: Page, label: string) {
  const m = await metrics(page);
  expect(m.sw, `${label}: no horizontal scroll`).toBeLessThanOrEqual(m.iw);
  expect(m.sh, `${label}: no vertical scroll`).toBeLessThanOrEqual(m.ih);
  for (const key of ["layer", "steps", "gauge", "nextLine"] as const) {
    const b = m[key]!;
    expect(b.left, `${label}: ${key} left`).toBeGreaterThanOrEqual(0);
    expect(b.right, `${label}: ${key} right`).toBeLessThanOrEqual(m.iw);
    expect(b.bottom, `${label}: ${key} bottom`).toBeLessThanOrEqual(m.ih);
  }
  expect(m.nextBottom, `${label}: 「次へ」 inside the screen`).toBeLessThanOrEqual(m.ih);
}

test("flag off: the current model is what runs (current labels, no prototype marks)", async ({ page }) => {
  await start(page, "?pan=square");
  await expect(page.getByTestId("square-dough-step-1")).toContainText("四隅まで伸ばす");
  await expect(page.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "coverage");
  await expect(page.getByTestId("square-dough-gauge-goal")).toContainText("目標 95%");
  await expect(page.getByTestId("square-stretch-marks")).toHaveCount(0);
});

test.describe("push-stretch prototype", () => {
  test("STEP 1: dough is pulled from where it is -- nothing from nowhere, the total is conserved, the dough stays in one piece", async ({ page }) => {
    test.setTimeout(90_000);
    await start(page, BASE);
    await expect(page.getByTestId("square-dough-step-1")).toContainText("生地をひろげる");
    await expect(page.getByTestId("square-dough-step-2")).toContainText("厚みを整える");
    const t0 = await thickness(page);
    await shot(page, "01-start");

    // a stroke that starts far from any dough lays nothing (the current model lays a film there)
    await drag(page, [14, 14], [20, 20]);
    expect(await thickness(page)).toEqual(t0);

    // grabbing the edge of the ball and pulling does stretch it
    await drag(page, [68, 50], [86, 50]);
    const grabbed = await thickness(page);
    expect(grabbed).not.toEqual(t0);
    expectConserved(grabbed, t0);

    // centre -> the four corners: the corners are reached by connected dough, STEP 1 is still open (coverage < goal)
    for (const [x, y] of [[11, 11], [89, 11], [89, 89], [11, 89]] as const) await drag(page, [50, 50], [x, y]);
    await shot(page, "02-four-corners-step1-open");
    expect(await attr(page, "data-corners")).toBe("4");
    expect(await attr(page, "data-step")).toBe("1");
    expect(await num(page, "data-coverage")).toBeLessThan(0.9);
    await expect(nextButton(page)).toBeDisabled();
    expectConserved(await thickness(page), t0);
    await expectFits(page, "STEP 1");
  });

  test("STEP 1 -> STEP 2 is a real hand-over: STEP 2 opens with work left, the thick / thin / fine cells are shown, and it completes in a handful of operations", async ({ page }) => {
    test.setTimeout(240_000);
    await start(page, `${BASE}&squareOk=75`);
    // STEP 1: a full zigzag, then whatever strokes the player plans into the remaining bare patches
    for (const y of [14, 26, 38, 50, 62, 74, 86].map((v, k) => [v, k] as const)) await drag(page, y[1] % 2 ? [86, y[0]] : [14, y[0]], y[1] % 2 ? [14, y[0]] : [86, y[0]]);
    for (let i = 0; i < 30 && (await attr(page, "data-step")) === "1"; i++) {
      const stroke = (await plan(page, "spread", await thickness(page))) as { from: { x: number; y: number }; to: { x: number; y: number } } | null;
      if (!stroke) break;
      await drag(page, [stroke.from.x, stroke.from.y], [stroke.to.x, stroke.to.y]);
    }
    expect(await attr(page, "data-step")).toBe("2");
    // STEP 2 is NOT already finished (the current model finishes it on arrival)
    expect(await attr(page, "data-complete")).toBe("false");
    await expect(nextButton(page)).toBeDisabled();
    await expect(page.getByTestId("square-dough-gauge")).toHaveAttribute("data-metric", "evenness");
    await expect(page.getByTestId("square-dough-gauge")).toContainText("ととのい度");
    await expect(page.getByTestId("square-dough-gauge-goal")).toContainText("目標 75%");
    await expect(page.getByTestId("square-dough-goal")).toContainText("赤い所は押して、青い所は厚い方から伸ばそう");
    const marks = page.getByTestId("square-stretch-marks");
    await expect(marks).toBeVisible();
    const thick = Number(await marks.getAttribute("data-thick"));
    const thin = Number(await marks.getAttribute("data-thin"));
    const ok = Number(await marks.getAttribute("data-ok"));
    expect(thick + thin).toBeGreaterThan(0);
    expect(ok).toBeGreaterThan(0); // the fine cells are left unmarked: three kinds, told apart
    await expect(page.locator('[data-testid="square-stretch-tint"] [data-kind="thick"]')).not.toHaveCount(0);
    await expect(page.locator('[data-testid="square-stretch-tint"] [data-kind="thin"]')).not.toHaveCount(0);
    expect(await page.locator('[data-testid="square-stretch-tint"] rect').count()).toBe(thick + thin);
    await shot(page, "03-step2-open-thick-thin-ok");
    await expectFits(page, "STEP 2");

    // STEP 2: the player's operations (hold = press, drag = stretch in) until 「次へ」 opens
    let ops = 0;
    for (; ops < 20 && (await attr(page, "data-complete")) !== "true"; ops++) {
      const op = (await plan(page, "even", await thickness(page))) as
        | { kind: "hold"; at: { x: number; y: number } }
        | { kind: "drag"; from: { x: number; y: number }; to: { x: number; y: number } }
        | null;
      if (!op) break;
      if (op.kind === "hold") await hold(page, [op.at.x, op.at.y]);
      else await drag(page, [op.from.x, op.from.y], [op.to.x, op.to.y]);
      if (ops === 3) await shot(page, "04-step2-midway");
    }
    test.info().annotations.push({ type: "step2-operations", description: String(ops) });
    expect(await attr(page, "data-complete")).toBe("true");
    expect(ops).toBeLessThanOrEqual(20);
    await expect(nextButton(page)).toBeEnabled();
    await expect(page.getByTestId("square-dough-goal")).toContainText("できあがり");
    await shot(page, "05-step2-complete");
    await expectFits(page, "complete");
  });
});
