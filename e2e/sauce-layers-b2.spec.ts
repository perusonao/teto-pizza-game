import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Sauce B2 (layered painting) in the real browser, at 390x844 and 360x800 (the viewport comes from the project): each sauce kind is
 * its own heatmap layer, first laid at the bottom; what was painted before a switch keeps its colour and its place; the pizza's
 * box (and so every touch coordinate) is the same with and without the extra layers. The numbers are read from the canvases' own
 * pixels. Screenshots (HV_SHOT_DIR) are for the Owner's review of the overlap.
 */
const OWNED = ["tomato-sauce", "pesto", "olive-oil", "mozzarella", "basil"];
const SHOT_DIR = process.env.B2_SHOT_DIR;

async function startSauceStep(page: Page) {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(OWNED));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
}

async function doughBox(page: Page) {
  const box = await page.locator(".pizza-dough--interactive").boundingBox();
  if (!box) throw new Error("dough has no box");
  return box;
}

/**
 * A stroke whose measurement must not depend on the runner's speed. Sauce is dispensed against WALL-CLOCK ticks (SAUCE_TICK_MS, 50 ms each, 50 per
 * bottle), while this driver sleeps between pointer moves; on a slow runner each move + sleep takes longer than nominal, so a fixed number of steps
 * stretches the stroke, spreads the same deposit over a longer real time, and can drain the bottle before the finger reaches the end. Three explicit
 * conditions replace "N steps of ms/N, then a fixed pause":
 *  - `wallClockPath`: the finger's position follows the real time since pointer-down (progress = elapsed / ms), so the deposit per unit of path is the
 *    nominal one however slow each move is, and the stroke's end is reached at about `ms` of real time on any runner.
 *  - `fillEnd` (needs `kind`): keep the finger down at the stroke's end until that sauce's layer is saturated at the end point (alpha >= 90% of 255; the
 *    layers are drawn live while the finger is down). The end of the stroke is then filled whatever the frame rate was, and the bottle is spent no
 *    further than that needs (the pizza-wide cap is shared by every sauce, so draining the bottle would starve the next stroke).
 *  - `settle`: after the finger lifts, wait until the heatmap canvases stop changing (3 equal reads, 100 ms apart) instead of a fixed 150 ms pause, so a
 *    measurement never reads a stroke that is not committed yet. With `kind`, the layer of that sauce must also exist first (a pizza's first sauce is
 *    drawn on the single legacy canvas; the per-kind layers only exist once a second sauce was painted).
 * Known limit: a driver stall long enough to drain the bottle before the finger reaches the end cannot be recovered; `fillEnd` then fails with
 * "the end of the pesto stroke never filled" (the cause) instead of a misleading alpha mismatch later. Thresholds, expectations and timeouts of the
 * assertions are not touched.
 */
interface PaintOptions {
  wallClockPath?: boolean;
  fillEnd?: boolean;
  settle?: boolean;
  kind?: string;
}

/** What the heatmap canvases hold: how many there are and how many pixels are painted in all of them. */
async function heatmapFingerprint(page: Page): Promise<string> {
  return page.locator("canvas.pizza-sauce-heatmap").evaluateAll((els) => {
    let painted = 0;
    for (const el of els) {
      const c = el as HTMLCanvasElement;
      const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      for (let i = 3; i < data.length; i += 4) if (data[i] >= 24) painted += 1;
    }
    return `${els.length}:${painted}`;
  });
}

/** Selects a sauce and waits until the switch is applied (the chip reads pressed), so the next stroke is never painted with the previous sauce. */
async function selectSauce(page: Page, name: RegExp) {
  const chip = page.getByRole("button", { name });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
}

/** One sauce layer's own alpha at a point (percent coordinates of the dough box); 0 while that layer does not exist. */
async function layerAlphaAt(page: Page, kind: string, xPercent: number, yPercent: number): Promise<number> {
  return page.evaluate(
    ([k, fx, fy]) => {
      const canvas = document.querySelector<HTMLCanvasElement>(`canvas.pizza-sauce-heatmap--kind-${k}`);
      if (!canvas) return 0;
      return canvas.getContext("2d")!.getImageData(Math.round((Number(fx) / 100) * (canvas.width - 1)), Math.round((Number(fy) / 100) * (canvas.height - 1)), 1, 1).data[3];
    },
    [kind, xPercent, yPercent] as const,
  );
}

async function settleHeatmaps(page: Page, kind?: string) {
  if (kind) await expect(page.locator(`canvas.pizza-sauce-heatmap--kind-${kind}`).first()).toBeAttached({ timeout: 10_000 });
  let last = "";
  let equalReads = 0;
  await expect
    .poll(
      async () => {
        const now = await heatmapFingerprint(page);
        equalReads = now === last ? equalReads + 1 : 0;
        last = now;
        return equalReads;
      },
      { intervals: [100], timeout: 10_000, message: "the sauce layers never settled" },
    )
    .toBeGreaterThanOrEqual(3);
}

/** Holds the finger down at `from`, then drags to `to` over `ms`. Percent coordinates of the dough box. */
async function paint(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, ms: number, options: PaintOptions = {}) {
  const b = await doughBox(page);
  const at = (p: { x: number; y: number }) => ({ x: b.x + (p.x / 100) * b.width, y: b.y + (p.y / 100) * b.height });
  const a = at(from);
  const z = at(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const steps = 12;
  if (options.wallClockPath) {
    const startedAt = Date.now();
    for (;;) {
      const progress = Math.min(1, (Date.now() - startedAt) / ms);
      await page.mouse.move(a.x + (z.x - a.x) * progress, a.y + (z.y - a.y) * progress);
      if (progress >= 1) break;
      await page.waitForTimeout(ms / steps);
    }
  } else {
    for (let i = 1; i <= steps; i += 1) {
      await page.mouse.move(a.x + ((z.x - a.x) * i) / steps, a.y + ((z.y - a.y) * i) / steps);
      await page.waitForTimeout(ms / steps);
    }
  }
  if (options.fillEnd && options.kind) {
    const kind = options.kind;
    await expect
      .poll(() => layerAlphaAt(page, kind, to.x, to.y), { intervals: [100], timeout: 10_000, message: `the end of the ${kind} stroke never filled` })
      .toBeGreaterThanOrEqual(Math.round(0.9 * 255));
  }
  await page.mouse.up();
  await page.waitForTimeout(150);
  if (options.settle || options.kind) await settleHeatmaps(page, options.kind);
}

/** Alpha-weighted statistics of one heatmap canvas, in canvas pixels. */
async function layerStats(page: Page, kind: string) {
  return page.locator(`canvas.pizza-sauce-heatmap--kind-${kind}`).first().evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const { data, width, height } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    let n = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let minX = width;
    let maxX = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const a = data[(y * width + x) * 4 + 3];
        if (a < 24) continue;
        n += 1;
        r += data[(y * width + x) * 4];
        g += data[(y * width + x) * 4 + 1];
        b += data[(y * width + x) * 4 + 2];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    const alphaAt = (fx: number, fy: number) => data[(Math.round(fy * (height - 1)) * width + Math.round(fx * (width - 1))) * 4 + 3];
    return {
      painted: n,
      r: n ? r / n : 0,
      g: n ? g / n : 0,
      b: n ? b / n : 0,
      minX,
      maxX,
      width,
      alphaLeft: alphaAt(0.3, 0.5),
      alphaCentre: alphaAt(0.5, 0.5),
      alphaRight: alphaAt(0.72, 0.5),
    };
  });
}

test("a second sauce is its own layer on top; the first keeps its colour and its place", async ({ page }) => {
  await startSauceStep(page);
  const before = await doughBox(page);

  // one sauce: exactly the single heatmap + its overflow canvas (the historical DOM)
  await paint(page, { x: 22, y: 50 }, { x: 52, y: 50 }, 1500);
  await expect(page.locator("canvas.pizza-sauce-heatmap")).toHaveCount(2); // heatmap + overflow markers
  await expect(page.locator("canvas[class*='--kind-']")).toHaveCount(0);
  const tomatoAlone = await page.locator("canvas.pizza-sauce-heatmap").first().evaluate((el) => (el as HTMLCanvasElement).toDataURL());

  await page.getByRole("button", { name: /ジェノベーゼ/ }).click();
  await paint(page, { x: 48, y: 50 }, { x: 78, y: 50 }, 1500);

  // two sauces: one heatmap and one overflow canvas per kind, the first laid at the bottom
  const kinds = await page.locator("canvas.pizza-sauce-heatmap").evaluateAll((els) =>
    els.map((el) => (el.className.match(/--kind-([a-z-]+)/) ?? [])[1]),
  );
  expect(kinds).toEqual(["tomato-sauce", "pesto", "tomato-sauce", "pesto"]); // heatmaps in layer order, then the markers

  const tomato = await layerStats(page, "tomato-sauce");
  const pesto = await layerStats(page, "pesto");
  expect(tomato.painted).toBeGreaterThan(200);
  expect(pesto.painted).toBeGreaterThan(200);
  // each layer is its own sauce's colour: tomato red, pesto green
  expect(tomato.r).toBeGreaterThan(tomato.g + 20);
  expect(pesto.g).toBeGreaterThan(pesto.r + 10);
  // positions kept: tomato was painted on the left, pesto on the right, and they overlap in the middle
  expect(tomato.alphaLeft).toBeGreaterThan(40);
  expect(tomato.alphaRight).toBeLessThan(24);
  expect(pesto.alphaRight).toBeGreaterThan(40);
  expect(pesto.alphaLeft).toBeLessThan(24);
  expect(tomato.alphaCentre).toBeGreaterThan(40);
  expect(pesto.alphaCentre).toBeGreaterThan(40);
  // the first layer is not repainted when the second sauce is laid
  const tomatoAfter = await page.locator("canvas.pizza-sauce-heatmap--kind-tomato-sauce").first().evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  expect(tomatoAfter).toBe(tomatoAlone);

  // layout: the pizza is exactly where it was, the page does not scroll sideways, nothing sits outside the viewport
  const after = await doughBox(page);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  const vw = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);

  if (SHOT_DIR) {
    const name = test.info().project.name;
    await page.screenshot({ path: `${SHOT_DIR}/${name}-two-sauces-alpha.png` });
    // comparison for the Owner only (not shipped): the same pizza with a multiply blend on the layers
    await page.addStyleTag({ content: "canvas.pizza-sauce-heatmap[class*='--kind-'] { mix-blend-mode: multiply; }" });
    await page.screenshot({ path: `${SHOT_DIR}/${name}-two-sauces-multiply.png` });
  }
});

test("switching back starts a new top layer (runs in the order laid); the layers follow the pizza to the next step", async ({ page }) => {
  await startSauceStep(page);
  await paint(page, { x: 25, y: 38 }, { x: 45, y: 38 }, 1000);
  await page.getByRole("button", { name: /ジェノベーゼ/ }).click();
  await paint(page, { x: 45, y: 55 }, { x: 70, y: 55 }, 1000);
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await paint(page, { x: 30, y: 70 }, { x: 60, y: 70 }, 1000);
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paint(page, { x: 25, y: 45 }, { x: 45, y: 45 }, 800); // back to tomato: a NEW top run (Owner Decision, PR #494), not folded into the bottom one

  const heatKinds = async () =>
    page.locator("canvas.pizza-sauce-heatmap").evaluateAll((els) => els.map((el) => (el.className.match(/--kind-([a-z-]+)/) ?? [])[1]));
  const runs = ["tomato-sauce", "pesto", "olive-oil", "tomato-sauce"];
  expect((await heatKinds()).slice(0, 4)).toEqual(runs);

  await page.getByRole("button", { name: /次へ/ }).click(); // SAUCE -> CHEESE
  expect((await heatKinds()).slice(0, 4)).toEqual(runs);
  expect(await page.locator(".pizza-sauce-oil-sheen").count()).toBe(0);
});

/** The composite colour at a point of the pizza, drawing the heatmap canvases in DOM (= paint) order. The CSS blur filter is not applied,
 *  which does not change which layer is on top where two overlap. Percent coordinates of the dough box. */
async function compositeAt(page: Page, xPercent: number, yPercent: number) {
  return page.evaluate(([fx, fy]) => {
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>("canvas.pizza-sauce-heatmap")].filter((c) => /--kind-/.test(c.className));
    const out = document.createElement("canvas");
    out.width = 200;
    out.height = 200;
    const ctx = out.getContext("2d")!;
    for (const c of canvases) ctx.drawImage(c, 0, 0);
    const [r, g, b, a] = ctx.getImageData(Math.round((fx / 100) * 199), Math.round((fy / 100) * 199), 1, 1).data;
    return { r, g, b, a };
  }, [xPercent, yPercent]);
}

test("what is painted after a switch shows over what was painted before it, whatever the kind (Owner Decision, PR #494)", async ({ page }) => {
  await startSauceStep(page);
  // tomato across the middle, then pesto across the same band: pesto (laid later) is on top where they overlap
  await paint(page, { x: 25, y: 50 }, { x: 70, y: 50 }, 1000);
  await page.getByRole("button", { name: /ジェノベーゼ/ }).click();
  await paint(page, { x: 25, y: 50 }, { x: 70, y: 50 }, 1000);
  const overlap = await compositeAt(page, 48, 50);
  expect(overlap.a).toBeGreaterThan(60);
  // pesto is on top: the overlap is still closer to pesto green (g - r = +30) than to tomato red (-130), though the dimmed overlap now lets
  // some tomato through (Owner Decision, PR #494: ~x0.7 opacity), so it is no longer plainly green
  expect(overlap.g - overlap.r).toBeGreaterThan(-52);

  // back to tomato over the very same band: the NEW tomato run is on top of the pesto, so the overlap turns red again
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paint(page, { x: 25, y: 50 }, { x: 70, y: 50 }, 600);
  const heatKinds = await page.locator("canvas.pizza-sauce-heatmap").evaluateAll((els) => els.map((el) => (el.className.match(/--kind-([a-z-]+)/) ?? [])[1]));
  expect(heatKinds.slice(0, 3)).toEqual(["tomato-sauce", "pesto", "tomato-sauce"]);
  const over = await compositeAt(page, 48, 50);
  expect(over.r).toBeGreaterThan(over.g);
});

/** Reads the composite colour (over a fixed dough colour) and the top layer's own alpha at a point, from the heatmap canvases in paint order.
 *  The canvases already hold the overlap-dimmed pixels (Owner Decision, PR #494), so this is what the browser stacks. */
async function stackAt(page: Page, xPercent: number, yPercent: number) {
  return page.evaluate(([fx, fy]) => {
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>("canvas.pizza-sauce-heatmap")].filter((c) => /--kind-/.test(c.className));
    const alphaOf = (c: HTMLCanvasElement) => c.getContext("2d")!.getImageData(Math.round((fx / 100) * 199), Math.round((fy / 100) * 199), 1, 1).data[3];
    const out = document.createElement("canvas");
    out.width = 200;
    out.height = 200;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "rgb(232,190,128)";
    ctx.fillRect(0, 0, 200, 200);
    for (const c of canvases) ctx.drawImage(c, 0, 0);
    const [r, g, b] = ctx.getImageData(Math.round((fx / 100) * 199), Math.round((fy / 100) * 199), 1, 1).data;
    return { r, g, b, alphas: canvases.map(alphaOf) };
  }, [xPercent, yPercent]);
}

test("overlap: the top layer is dimmed only where it overlaps; 2 and 3 layers stay readable (Owner Decision, PR #494)", async ({ page }) => {
  await startSauceStep(page);
  // tomato across the left-centre band; pesto over the SAME band, extending to the right (so part of it overlaps nothing)
  await paint(page, { x: 25, y: 50 }, { x: 55, y: 50 }, 1100, { wallClockPath: true, settle: true });
  await selectSauce(page, /ジェノベーゼ/);
  await paint(page, { x: 25, y: 50 }, { x: 75, y: 50 }, 1500, { wallClockPath: true, kind: "pesto", fillEnd: true });

  const over = await stackAt(page, 38, 50); // pesto over tomato
  const clear = await stackAt(page, 70, 50); // pesto alone, beyond the tomato's soft edge
  // The part that overlaps nothing keeps its full opacity. Its alpha depends on how many ticks the held stroke end got (194-197 locally, 190 on a slow
  // WebKit runner), so it is judged against the dimmed overlap at the same row (a steady 166 = 0.7 x 237) instead of an absolute number: a layer that
  // was dimmed everywhere would sit at about that 166, an undimmed one is clearly above it.
  expect(clear.alphas[1]).toBeGreaterThan(over.alphas[1] * 1.1);
  expect(over.alphas[1]).toBeLessThan(over.alphas[0] * 0.8); // dimmed where it lies over the tomato (both saturate at ~0.93 without it)
  expect(over.alphas[1]).toBeGreaterThan(over.alphas[0] * 0.55); // ...by about x0.7, not wiped out
  // the tomato underneath now shows through. A plain stack of the two (the old look) composites to about (114,137,60) over this dough; with the
  // ~x0.7 top layer it is about (135,120,58): clearly redder and less green, still nearer the pesto than the tomato (201,68,52)
  expect(over.r).toBeGreaterThanOrEqual(125);
  expect(over.g).toBeLessThanOrEqual(130);
  expect(over.r).toBeLessThan(170);
  expect(over.alphas[0]).toBeGreaterThan(200); // and the bottom layer itself is untouched

  // a third sauce over the same area: both layers below stay visible through it
  await selectSauce(page, /オリーブオイル/);
  await paint(page, { x: 25, y: 50 }, { x: 55, y: 50 }, 1000, { wallClockPath: true, kind: "olive-oil" });
  const triple = await stackAt(page, 38, 50);
  expect(triple.alphas).toHaveLength(6); // 3 heatmap layers + their 3 (here empty) overflow-marker canvases
  expect(triple.alphas[2]).toBeLessThan(triple.alphas[0] * 0.8); // the oil on top is dimmed too (it overlaps two layers)
  expect(triple.alphas[1]).toBeLessThan(triple.alphas[0] * 0.8); // pesto stays dimmed over tomato
  expect(triple.alphas[0]).toBeGreaterThan(200); // bottom layer unchanged
  const heatKinds = await page.locator("canvas.pizza-sauce-heatmap").evaluateAll((els) => els.map((el) => (el.className.match(/--kind-([a-z-]+)/) ?? [])[1]));
  expect(heatKinds.slice(0, 3)).toEqual(["tomato-sauce", "pesto", "olive-oil"]);
});

test("a commit repaints only the run it touched: 12 alternating runs, the 13th and a top-run extension stay cheap (Codex P2, PR #494)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __draws: number };
    w.__draws = 0;
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof original>) {
      w.__draws += 1;
      return (original as (...a: unknown[]) => void).apply(this, args);
    } as typeof original;
  });
  await startSauceStep(page);
  const b = await doughBox(page);
  const kinds = [/トマトソース/, /ジェノベーゼ/];
  const strokeAt = async (i: number, holdMs: number) => {
    await page.mouse.move(b.x + b.width * (0.22 + ((i * 7) % 56) / 100), b.y + b.height * (0.3 + ((i * 3) % 40) / 100));
    await page.mouse.down();
    await page.waitForTimeout(holdMs);
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  const draws = () => page.evaluate(() => (window as unknown as { __draws: number }).__draws);
  await strokeAt(0, 62);
  for (let i = 1; i < 12; i += 1) {
    await page.getByRole("button", { name: kinds[i % 2] }).click();
    await strokeAt(i, 62);
  }
  expect(await page.locator("canvas.pizza-sauce-heatmap").count()).toBe(18); // 12 runs: the newest 8 have a heatmap and an overflow canvas each, the 4 older share one pair

  const beforeNewRun = await draws();
  await page.getByRole("button", { name: kinds[12 % 2] }).click();
  await strokeAt(12, 62);
  const newRun = (await draws()) - beforeNewRun;
  // Before the fix every one of the 12 earlier layers was redrawn on each commit (>= 15 draws here); now only the new top layer and the
  // shared group of older runs are (a pending-stroke tick or two plus the commit): a few draws, independent of the run count.
  expect(newRun).toBeLessThanOrEqual(5);

  const beforeExtend = await draws();
  await strokeAt(13, 400); // same sauce as the top run, no switch: it extends that run
  expect((await draws()) - beforeExtend).toBeLessThanOrEqual(14); // ~8 ticks of the one layer + its commit, never 13 layers x ticks
});

test("a long history that alternates olive oil and another sauce keeps the sauce canvases at a fixed budget, every run still drawn (Codex P2, PR #494)", async ({ page }) => {
  test.setTimeout(240000);
  await startSauceStep(page);
  const b = await doughBox(page);
  const kinds = [/トマトソース/, /オリーブオイル/];
  for (let i = 0; i < 40; i += 1) {
    if (i > 0) await page.getByRole("button", { name: kinds[i % 2] }).click();
    await page.mouse.move(b.x + b.width * (0.22 + ((i * 7) % 56) / 100), b.y + b.height * (0.3 + ((i * 3) % 40) / 100));
    await page.mouse.down();
    await page.waitForTimeout(62);
    await page.mouse.up();
    await page.waitForTimeout(40);
  }
  const total = await page.locator(".pizza-dough--interactive canvas.pizza-sauce-heatmap").count();
  expect(total).toBeLessThanOrEqual(24); // 8 own runs + at most 4 groups, a heatmap and an overflow canvas each
  expect(await page.locator(".pizza-dough--interactive canvas.pizza-sauce-heatmap--merged").count()).toBeGreaterThan(0);
  // every heatmap canvas that should show sauce does: no layer is blank
  const painted = await page.locator(".pizza-dough--interactive canvas.pizza-sauce-heatmap").evaluateAll((els) =>
    els.map((el) => {
      const c = el as HTMLCanvasElement;
      const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 24) n += 1;
      return { merged: c.className.includes("--merged"), n };
    }),
  );
  const heatmaps = painted.slice(0, painted.length / 2); // the first half are the heatmaps, the rest the overflow canvases
  expect(heatmaps.length).toBeGreaterThan(8);
  expect(heatmaps.every((h) => h.n > 0)).toBe(true);
});

test("canvas failure: a refused 2D context shows the layer as dots, and a throwing draw does not blank the app (Codex P2, PR #494)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __granted: number };
    w.__granted = 0;
    const original = HTMLCanvasElement.prototype.getContext;
    // a browser out of canvas memory: after 4 sauce canvases have a context, EVERY new canvas is refused -- the sauce canvases and any fresh
    // probe canvas alike (so support must have been probed before the exhaustion, at app start)
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (!this.dataset.granted) {
        if (w.__granted >= 4) return null;
        if (this.className.includes("pizza-sauce-heatmap")) {
          this.dataset.granted = "1";
          w.__granted += 1;
        }
      }
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    } as typeof original;
  });
  await startSauceStep(page);
  const b = await doughBox(page);
  const kinds = [/トマトソース/, /ジェノベーゼ/];
  for (let i = 0; i < 6; i += 1) {
    if (i > 0) await page.getByRole("button", { name: kinds[i % 2] }).click();
    await page.mouse.move(b.x + b.width * (0.25 + 0.08 * i), b.y + b.height * (0.4 + 0.03 * i));
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * (0.35 + 0.08 * i), b.y + b.height * (0.45 + 0.03 * i), { steps: 5 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
  await expect(page.locator(".pizza-stage")).toBeVisible(); // the app is up
  const fallbacks = page.locator(".pizza-dough--interactive [data-sauce-fallback]");
  expect(await fallbacks.count()).toBeGreaterThan(0); // the refused layers are shown, not blank
  expect(await fallbacks.first().locator("span").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: kinds[0] }).click(); // and the tray still works
});

test("canvas failure: a drawImage that throws is contained (no white screen)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __draws: number };
    w.__draws = 0;
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: Parameters<typeof original>) {
      w.__draws += 1;
      if (w.__draws > 3) throw new Error("simulated drawImage failure (canvas lost)");
      return (original as (...a: unknown[]) => void).apply(this, args);
    } as typeof original;
  });
  await startSauceStep(page);
  const b = await doughBox(page);
  const kinds = [/トマトソース/, /ジェノベーゼ/];
  for (let i = 0; i < 6; i += 1) {
    if (i > 0) await page.getByRole("button", { name: kinds[i % 2] }).click();
    await page.mouse.move(b.x + b.width * (0.25 + 0.08 * i), b.y + b.height * (0.4 + 0.03 * i));
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
  await expect(page.locator(".pizza-stage")).toBeVisible();
  await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
  expect(await page.locator(".pizza-dough--interactive [data-sauce-fallback]").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: kinds[0] }).click();
});
