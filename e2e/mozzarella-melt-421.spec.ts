import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  completeDoughStep,
  cutThreeLines,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
} from "./gestures";

/**
 * Issue #421 (Finished Pizza Appetite Appeal, Pilot): the baked mozzarella must look different from the raw one in
 * SHAPE (outline, spread, ring, local browning), not only in size / tint. Real Chromium at 390x844 and 360x800.
 *
 * The needle is stepped with the faked clock and the stage is captured at fixed needle positions; margherita's
 * `bakeTarget` is { start: 60, end: 80 } (centre 70 = heat 1), so 0 = raw, 56 = melting, 70 = properly baked,
 * 80 = deep brown, 98 = overbaked. Set MELT_SHOTS_DIR to also write the screenshots (the before/after comparison).
 */

const SHOTS_DIR = process.env.MELT_SHOTS_DIR;
// iPhone-like density so the 28 px mozzarella is judged at the resolution the Owner sees it at.
test.use({ deviceScaleFactor: 3 });
// Real WebKit at DPR 3 is slower than Chromium (a full RESULT page capture alone can take seconds); the default 30 s was not enough.
test.setTimeout(120_000);

const BAKE_STAGES: ReadonlyArray<{ name: string; needle: number }> = [
  { name: "1-raw", needle: 0 },
  { name: "2-melting", needle: 56 },
  { name: "3-baked", needle: 70 },
  { name: "4-deep", needle: 80 },
  { name: "5-overbaked", needle: 98 },
];

async function shot(page: Page, name: string) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const size = page.viewportSize()!;
  await page.locator(".pizza-stage").screenshot({ path: `${SHOTS_DIR}/${name}-${size.width}x${size.height}.png` });
}

async function shotPage(page: Page, name: string) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const size = page.viewportSize()!;
  await page.screenshot({ path: `${SHOTS_DIR}/${name}-${size.width}x${size.height}.png` });
}

async function flushReactCommit(page: Page) {
  for (let i = 0; i < 2; i += 1) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            channel.port1.close();
            resolve();
          };
          channel.port2.postMessage(null);
        }),
    );
  }
}

async function needlePosition(page: Page): Promise<number> {
  await flushReactCommit(page);
  return page.locator(".bake-gauge__needle").evaluate((el) => Number.parseFloat((el as HTMLElement).style.left) || 0);
}

async function placeEverythingUpToBake(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
}

/** The mozzarella's own computed look, to assert the shape really changes (not only the colour). */
async function mozzarellaLook(page: Page) {
  return page.locator(".pizza-cheese--mozzarella").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      radius: cs.borderTopLeftRadius,
      boxShadow: cs.boxShadow,
      transform: cs.transform,
      melt: (el as HTMLElement).style.getPropertyValue("--bake-melt"),
    };
  });
}


/** Computed outline and blotch centre of every mozzarella piece (A4: the pieces of one pizza must not be the same disc). */
async function allMozzarellaTransforms(page: Page) {
  return page.locator(".pizza-cheese--mozzarella").evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
}

async function allMozzarellaOutlines(page: Page) {
  return page.locator(".pizza-cheese--mozzarella").evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      return { radius: `${cs.borderTopLeftRadius}|${cs.borderTopRightRadius}|${cs.borderBottomRightRadius}|${cs.borderBottomLeftRadius}`, bodyAt: (el as HTMLElement).style.getPropertyValue("--bake-cheese-body-at") };
    }),
  );
}

/** Attaches a small close-up of all the mozzarella pieces to the test report (so a CI WebKit run leaves visible evidence). */
async function attachCloseup(page: Page, name: string) {
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".pizza-cheese--mozzarella")];
    if (els.length === 0) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const el of els) {
      const x = el.getBoundingClientRect();
      l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    }
    const pad = 30;
    return { x: Math.max(0, l - pad), y: Math.max(0, t - pad), width: r - l + 2 * pad, height: b - t + 2 * pad };
  });
  if (!box) return;
  const size = page.viewportSize()!;
  await test.info().attach(`${name}-${size.width}x${size.height}.png`, { body: await page.screenshot({ clip: box, scale: "css" }), contentType: "image/png" });
}

type Rgb = { r: number; g: number; b: number };

/**
 * Mean colour of the darkest ~4% of the pixels of the first mozzarella, as painted by the cheese ALONE.
 * `.pizza-bake-overlay--char` / `.pizza-char-spots` are later-painted siblings that cover the cheese, so a plain locator
 * screenshot would sample them instead (Codex P2): they are hidden for the capture and restored afterwards.
 * `spots`: "as-is" keeps the real blotches, "off" makes every `--bake-cheese-spot*` colour transparent, "grey" keeps the
 * same alpha but paints them neutral grey (the regression a brown-channel assertion has to catch).
 */
async function darkestCheeseColor(page: Page, spots: "as-is" | "off" | "grey"): Promise<Rgb> {
  const cheese = page.locator(".pizza-cheese--mozzarella").first();
  const restore = await page.evaluate((mode) => {
    const el = document.querySelector(".pizza-cheese--mozzarella") as HTMLElement;
    const hidden = [...document.querySelectorAll<HTMLElement>(".pizza-bake-overlay--char, .pizza-char-spots")].map((n) => [n, n.style.visibility] as const);
    for (const [n] of hidden) n.style.visibility = "hidden";
    const saved: Array<[string, string]> = [];
    if (mode !== "as-is") {
      for (let i = 0; i < el.style.length; i += 1) {
        const name = el.style[i];
        if (!name.startsWith("--bake-cheese-spot")) continue; // only the colours; positions / radii (--bake-cheese-spN-*) stay
        const value = el.style.getPropertyValue(name);
        saved.push([name, value]);
        const alpha = /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(value)?.[1] ?? "1";
        el.style.setProperty(name, mode === "off" ? "rgba(0, 0, 0, 0)" : `rgba(96, 96, 96, ${alpha})`);
      }
    }
    (window as unknown as { __restoreMelt: () => void }).__restoreMelt = () => {
      for (const [n, v] of hidden) n.style.visibility = v;
      for (const [name, value] of saved) el.style.setProperty(name, value);
    };
    return saved.length;
  }, spots);
  if (spots !== "as-is") expect(restore, "spot colour variables found on the mozzarella").toBeGreaterThan(0);
  await page.waitForTimeout(350); // the cheese's own 0.3 s background transition (real time, clock is faked)
  const png = await cheese.screenshot();
  await page.evaluate(() => (window as unknown as { __restoreMelt: () => void }).__restoreMelt());
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const px: Array<[number, number, number, number]> = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue; // transparent corners of the rounded box
      // Only the cheese's own face: the inner 80% ellipse of the box. The corners of the box hold the sauce / the outer lobes behind
      // the rounded shape (M1 made those darker than the blotches, so "darkest 4% of the whole box" no longer meant "blotches").
      const cx = (i / 4) % img.width;
      const cy = Math.floor(i / 4 / img.width);
      if (Math.hypot((cx + 0.5) / img.width - 0.5, (cy + 0.5) / img.height - 0.5) > 0.4) continue; // 0.4 = 80% of the half-width
      px.push([data[i], data[i + 1], data[i + 2], 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]]);
    }
    px.sort((a, b) => a[3] - b[3]);
    const n = Math.max(3, Math.floor(px.length * 0.04));
    const dark = px.slice(0, n);
    const mean = (k: 0 | 1 | 2) => dark.reduce((sum, p) => sum + p[k], 0) / dark.length;
    return { r: mean(0), g: mean(1), b: mean(2) };
  }, png.toString("base64"));
}

const luma = (c: Rgb) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
/** Red-over-blue warmth relative to brightness: ~0 for grey, larger for brown. */
const warmth = (c: Rgb) => (c.r - c.b) / Math.max(1, luma(c));
/** Dark and BROWN (red > green > blue with a clear red-blue gap), not grey (r ~ g ~ b). */
const isBrownBlotch = (c: Rgb) => c.r < 110 && c.r - c.b >= 14 && c.r > c.g && c.g > c.b;

test.describe("Mozzarella melt Pilot (#421)", () => {
  test("raw -> melting -> baked -> deep -> overbaked: the cheese changes shape, spread and browning", async ({ page }) => {
    await startFreshMargherita(page);
    await placeEverythingUpToBake(page);
    await enterBakePaused(page);

    const looks: Record<string, Awaited<ReturnType<typeof mozzarellaLook>>> = {};
    let outlines: Awaited<ReturnType<typeof allMozzarellaOutlines>> = [];
    let rawTransforms: string[] = [];
    const positions: Record<string, number> = {};
    for (const { name, needle } of BAKE_STAGES) {
      let position = await needlePosition(page);
      // Walk up to the stage's needle position in small closed-loop steps (independent of the gauge's speed / direction, e.g.
      // #419's 7 s one-way gauge) and VERIFY it: a before/after pair is only comparable at the same heat.
      for (let step = 0; step < 600 && needle - position > 1.5; step += 1) {
        await page.clock.runFor(40);
        position = await needlePosition(page);
      }
      positions[name] = Math.round(position * 10) / 10;
      if (needle === 0) expect(position, `${name} needle`).toBeLessThanOrEqual(28); // raw = before the melt starts (heat 0.5 = needle 35)
      else expect(Math.abs(position - needle), `${name} needle ${position}`).toBeLessThanOrEqual(3);
      await page.waitForTimeout(350); // the cheese's own 0.3 s transform/filter transition (real time, clock is faked)
      await flushReactCommit(page);
      looks[name] = await mozzarellaLook(page);
      if (name === "3-baked") outlines = await allMozzarellaOutlines(page);
      // The raw cheese must not move when BAKE starts: before the melt every piece has the very same (uniform) transform.
      if (name === "1-raw") rawTransforms = await allMozzarellaTransforms(page);
      await shot(page, `bake-${name}`);
      await attachCloseup(page, `bake-${name}`);
    }

    // Overbaked, the cheese ALONE (char overlays hidden): the blotches are dark and BROWN as painted, they are what darkens it
    // (with vs without), and the same check rejects grey blotches (negative control: a grey regression must fail it).
    const withSpots = await darkestCheeseColor(page, "as-is");
    const withoutSpots = await darkestCheeseColor(page, "off");
    const greySpots = await darkestCheeseColor(page, "grey");
    const seen = JSON.stringify({ withSpots, withoutSpots, greySpots, warmth: [warmth(withSpots), warmth(greySpots)] });
    expect(isBrownBlotch(withSpots), seen).toBe(true);
    // The only difference between the two captures is the blotch colours, so any real darkening means they paint. Sampled on the cheese's
    // own face (M1: inner 80% ellipse), Chromium measures ~56 here (it was 12-13 on the whole box, WebKit 10.8, before the face mask), so a
    // floor of 20 is well under it and still far above "no blotches" (~0).
    expect(luma(withoutSpots) - luma(withSpots), seen).toBeGreaterThanOrEqual(20);
    // The overbaked cheese filter warms everything, so even grey blotches come out brownish in absolute terms; what tells brown
    // from grey is how much of the red-over-blue warmth survives at the same darkness (measured on the cheese's face, M1: brown ~0.58, grey ~0.12).
    expect(warmth(withSpots) - warmth(greySpots), seen).toBeGreaterThanOrEqual(0.2);
    expect(warmth(withSpots), seen).toBeGreaterThanOrEqual(0.45);
    expect(warmth(greySpots), seen).toBeLessThan(0.3);
    if (SHOTS_DIR) writeFileSync(`${SHOTS_DIR}/needle-positions-${page.viewportSize()!.width}.json`, JSON.stringify(positions, null, 2));
    // Raw cheese is the unchanged raw look: melt variable at 0 and the original outline.
    expect(Number(looks["1-raw"].melt)).toBeLessThan(0.05);
    // Properly baked: fully melted, and the outline / shadow / transform really differ from raw.
    expect(Number(looks["3-baked"].melt)).toBeGreaterThan(0.95);
    expect(looks["3-baked"].radius).not.toBe(looks["1-raw"].radius);
    expect(looks["3-baked"].boxShadow).not.toBe(looks["1-raw"].boxShadow);
    expect(looks["3-baked"].transform).not.toBe(looks["1-raw"].transform);
    // Motion prototype: no blurred spread layers any more: drop, ring, bleed, pool, inset = 5 layers (computed style, engine-independent),
    // and none of them is the old lobe (every non-inset layer is <= 4 px blur).
    const layers = looks["3-baked"].boxShadow.replace(/rgba?\([^)]*\)/g, "C").split(",").map((l) => l.trim());
    expect(layers, `box-shadow layers ${looks["3-baked"].boxShadow}`).toHaveLength(5);
    expect(rawTransforms).toHaveLength(3);
    expect(new Set(rawTransforms).size, `raw transforms ${JSON.stringify(rawTransforms)}`).toBe(1);
    // A4: the three pieces get their own (deterministic) outline and browning, not one disc copied three times.
    expect(outlines).toHaveLength(3);
    expect(new Set(outlines.map((o) => o.radius)).size).toBe(3);
    expect(new Set(outlines.map((o) => o.bodyAt)).size).toBe(3);
    // Not just a uniform scale: the matrix is anisotropic once melted.
    const m = /matrix\(([^,]+),[^,]+,[^,]+,([^,]+),/.exec(looks["3-baked"].transform);
    expect(m).not.toBeNull();
    expect(Math.abs(Number(m![1]) - Number(m![2]))).toBeGreaterThan(0.03);
  });

  test("CUT and RESULT keep the baked look in the pieces, and the layout fits the viewport", async ({ page }) => {
    await startFreshMargherita(page);
    await placeEverythingUpToBake(page);
    await enterBakePaused(page);
    await landNeedleAndTakeOut(page, { start: 60, end: 80 });
    await page.waitForSelector(".pizza-stage");

    await shot(page, "cut-0-before-cut");
    await cutThreeLines(page);
    await expect(page.locator(".pizza-pieces")).toHaveCount(1);
    await shot(page, "cut-1-pieces");
    await attachCloseup(page, "cut-1-pieces");
    const cutLook = await mozzarellaLook(page);
    expect(Number(cutLook.melt)).toBeGreaterThan(0.85); // the pieces carry the baked cheese, not the raw one (the needle lands anywhere in 60-80, heat >= 0.857, melt >= 0.89)

    await page.getByRole("button", { name: /切り終わる/ }).click();
    await page.waitForSelector(".pizza-stage");
    await shotPage(page, "result-page");
    await shot(page, "result-stage");
    await attachCloseup(page, "result-stage");
    await test.info().attach(`result-page-${page.viewportSize()!.width}x${page.viewportSize()!.height}.png`, { body: await page.screenshot({ scale: "css" }), contentType: "image/png" });
    const resultLook = await mozzarellaLook(page);
    expect(Number(resultLook.melt)).toBeGreaterThan(0.85);

    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
  });
});
