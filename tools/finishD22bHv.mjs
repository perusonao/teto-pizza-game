#!/usr/bin/env node
/**
 * FINISH D2-2b verification driver (dev/test only). Drives e2e/harness/finish-hv.html -- the real PizzaStage in the real cooking
 * skeleton -- on a running Vite dev server and writes screenshots + facts.json:
 *
 *   node tools/finishD22bHv.mjs <baseUrl e.g. http://localhost:5183/teto-pizza-game/> <tag> <outDir>
 *
 * Run it against the build under test and against a worktree of the build to compare with (same harness files copied in); the
 * facts of the two are compared by hand / by tools/finishD22bHvCompare.mjs. Nothing here touches the app, a save or a deploy.
 */
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "node:fs";

const [base, tag, outDir] = process.argv.slice(2);
if (!base || !tag || !outDir) throw new Error("usage: finishD22bHv.mjs <baseUrl> <tag> <outDir>");
fs.mkdirSync(outDir, { recursive: true });
const sharp = createRequire(import.meta.url)("sharp");
const URL_ = (q) => `${base}e2e/harness/finish-hv.html?${q}`;
const VIEWPORTS = [[390, 844], [360, 800]];
const BAKES = ["none", "raw", "perfect", "burnt"];
const ISOLATE = `.pizza-dough{background:none!important;border-color:transparent!important;box-shadow:none!important}
  .pizza-dough-shape,.pizza-dough-square,.pizza-bake-overlay,.pizza-char-spots,.pizza-smoke-wrap,.pizza-perfect-glow,.pizza-sauce-heatmap,.pizza-cut-layer,.sauce-target-guide,.dough-target-guide,.pizza-piece-body>*:not(.pizza-topping):not(.pizza-topping-half){display:none!important}
  .pizza-topping:not([data-topping-stage="post"]),.pizza-topping-half:not([data-topping-stage="post"]){display:none!important}
  *{animation:none!important;transition:none!important} html,body,.app-frame{background:#fff!important}`;

async function open(page, q, settle = 700) {
  await page.goto(URL_(q));
  await page.waitForSelector(".pizza-dough");
  await page.waitForTimeout(settle);
}
const doughBox = (page) => page.locator(".pizza-dough").first().boundingBox();

/** mean RGB of the non-white pixels of a PNG buffer, and how many there are */
async function meanColour(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250) continue;
    n++; r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  return { px: n, rgb: n ? [r / n, g / n, b / n].map((v) => +v.toFixed(2)) : null, total: info.width * info.height };
}
async function isolatedPost(page, q) {
  await open(page, q);
  await page.addStyleTag({ content: ISOLATE });
  await page.waitForTimeout(300);
  const box = await doughBox(page);
  const png = await page.screenshot({ clip: box });
  return { png, ...(await meanColour(png)) };
}
async function cutThrough(page, angleDeg) {
  const b = await doughBox(page);
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = Math.min(b.width, b.height) / 2;
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
  await page.mouse.move(cx - dx, cy - dy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

const facts = { tag, viewports: {} };
const browser = await chromium.launch();
for (const [w, h] of VIEWPORTS) {
  const vp = `${w}x${h}`;
  const F = (facts.viewports[vp] = {});
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const shot = (name, clip) => page.screenshot({ path: `${outDir}/${tag}-${vp}-${name}.png`, ...(clip ? { clip } : {}) });

  // A. post pieces at every bake state (TOPPING): normal shots + isolated post-only pixels
  F.A = {};
  const ref = await isolatedPost(page, "step=TOPPING&bake=none&post=1");
  for (const bake of BAKES) {
    await open(page, `step=TOPPING&bake=${bake}&post=1`);
    await shot(`A-${bake}`, await doughBox(page));
    const iso = await isolatedPost(page, `step=TOPPING&bake=${bake}&post=1`);
    F.A[bake] = { sameAsNoBake: Buffer.compare(iso.png, ref.png) === 0, postMeanRgb: iso.rgb, postPixels: iso.px };
  }

  // B. CUT before any line: where the cut layer (guide lines / centre marker) and a post piece overlap, which one is on top?
  //    "covered" = pixels the cut layer changes that are also pixels of a post piece (a piece on top hides the cut layer there).
  await open(page, "step=CUT&bake=perfect&post=1&onguide=1");
  await shot("B-cut-precut");
  const normal = await page.screenshot();
  await page.addStyleTag({ content: ".pizza-cut-layer{visibility:hidden!important}" });
  await page.waitForTimeout(200);
  const noCutLayer = await page.screenshot();
  await open(page, "step=CUT&bake=perfect&post=1&onguide=1");
  await page.addStyleTag({ content: ISOLATE });
  await page.waitForTimeout(300);
  const postOnly = await page.screenshot();
  const raw3 = async (png) => (await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
  const [N, C, P] = await Promise.all([raw3(normal), raw3(noCutLayer), raw3(postOnly)]);
  let cutPx = 0, overlap = 0;
  for (let i = 0; i < N.data.length; i += 3) {
    const cutDiffers = N.data[i] !== C.data[i] || N.data[i + 1] !== C.data[i + 1] || N.data[i + 2] !== C.data[i + 2];
    const pieceHere = !(P.data[i] > 250 && P.data[i + 1] > 250 && P.data[i + 2] > 250);
    if (cutDiffers) cutPx++;
    if (cutDiffers && pieceHere) overlap++;
  }
  F.B = { cutLayerChangedPixels: cutPx, cutPixelsOnPostPiece: overlap };
  F.B.order = await page.evaluate(() => {
    const dough = document.querySelector(".pizza-dough");
    const post = document.querySelector('[data-topping-stage="post"]');
    const cut = document.querySelector(".pizza-cut-layer");
    return { postInsideDough: dough.contains(post), cutLayerInsideDough: dough.contains(cut), postFollowsCutLayer: Boolean(cut.compareDocumentPosition(post) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });

  // C. after a rim-to-rim cut: where do the post pieces live and are they filtered again?
  F.C = {};
  for (const bake of ["raw", "perfect", "burnt"]) {
    const before = await isolatedPost(page, `step=CUT&bake=${bake}&post=1`);
    await open(page, `step=CUT&bake=${bake}&post=1`);
    await cutThrough(page, 0);
    await shot(`C-cut-${bake}`, await doughBox(page));
    const where = await page.evaluate(() => {
      const el = document.querySelector('[data-topping-stage="post"]');
      const chain = [];
      for (let e = el.parentElement; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.filter !== "none") chain.push({ cls: e.className.toString().slice(0, 60), filter: cs.filter.slice(0, 90) });
        if (e.classList.contains("pizza-stage")) break;
      }
      return { insideDough: Boolean(el.closest(".pizza-dough")), insidePieceBody: Boolean(el.closest(".pizza-piece-body")), layerPresent: Boolean(document.querySelector(".pizza-post-layer")), filteredAncestors: chain };
    });
    await page.addStyleTag({ content: ISOLATE });
    await page.waitForTimeout(300);
    const after = await meanColour(await page.screenshot({ clip: await doughBox(page) }));
    F.C[bake] = { ...where, postMeanRgbBeforeCut: before.rgb, postMeanRgbAfterCut: after.rgb };
  }

  // D. geometry on the real-sized cooking skeleton: compact (TOPPING) and roomy (CUT), post layer on / off
  F.D = {};
  for (const step of ["TOPPING", "CUT"]) {
    const off = await (async () => { await open(page, `step=${step}&bake=burnt&post=0`); return doughBox(page); })();
    await open(page, `step=${step}&bake=burnt&post=1`);
    const on = await doughBox(page);
    const geo = await page.evaluate(() => {
      const dough = document.querySelector(".pizza-dough");
      const layer = document.querySelector(".pizza-post-layer");
      const border = parseFloat(getComputedStyle(dough).borderTopWidth);
      const d = dough.getBoundingClientRect();
      const l = (layer ?? dough).getBoundingClientRect(); // a build without the layer (before #588): compare against the dough itself
      return {
        layer: [l.x, l.y, l.width, l.height], dough: [d.x, d.y, d.width, d.height], border,
        pieces: [...document.querySelectorAll('[data-topping-stage="post"]')].map((e) => {
          const r = e.getBoundingClientRect();
          return { id: e.getAttribute("data-topping-id"), dx: r.x + r.width / 2 - (parseFloat(e.style.left) / 100 * (d.width - 2 * border) + d.x + border), dy: r.y + r.height / 2 - (parseFloat(e.style.top) / 100 * (d.height - 2 * border) + d.y + border) };
        }),
      };
    });
    const first = await page.locator('[data-topping-stage="post"]').first().boundingBox();
    const cx = first.x + first.width / 2, cy = first.y + first.height / 2;
    const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className?.toString() ?? "", [cx, cy]);
    let tapped = null;
    if (step === "TOPPING") {
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(150);
      tapped = await page.getByTestId("hv-taps").textContent();
    }
    F.D[step] = {
      doughNoPost: off && [off.x, off.y, off.width, off.height].map((v) => +v.toFixed(2)),
      doughWithPost: [on.x, on.y, on.width, on.height].map((v) => +v.toFixed(2)),
      doughSizeShiftPx: +(on.width - off.width).toFixed(2),
      layerEqualsDough: geo.layer.every((v, i) => Math.abs(v - geo.dough[i]) < 0.6),
      maxPieceOffsetPx: +Math.max(...geo.pieces.map((p) => Math.max(Math.abs(p.dx), Math.abs(p.dy)))).toFixed(2),
      elementAtPiece: top.slice(0, 60), tapped,
    };
  }
  await page.close();
}
facts.regression = {};
for (const [w, h] of VIEWPORTS) {
  const vp = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const shot = (name) => page.screenshot({ path: `${outDir}/${tag}-${vp}-${name}.png` });
  // E. regression shots (no post): every bake state, normal CUT with 0 and 3 lines, square pan
  for (const bake of BAKES) { await open(page, `step=TOPPING&bake=${bake}&post=0`); await shot(`E-nopost-${bake}`); }
  await open(page, "step=CUT&bake=perfect&post=0"); await shot("E-cut-0lines");
  for (const a of [0, 60, 120]) await cutThrough(page, a);
  await shot("E-cut-3lines");
  for (const bake of ["none", "burnt"]) { await open(page, `step=TOPPING&bake=${bake}&post=0&pan=square`); await shot(`E-square-nopost-${bake}`); }
  await open(page, "step=CUT&bake=perfect&post=0&pan=square"); await shot("E-square-cut-nopost");
  // square pan with post pieces (observation, no baseline)
  await open(page, "step=TOPPING&bake=burnt&post=1&pan=square"); await shot("E-square-post-burnt");
  facts.regression[vp] = await page.evaluate(() => {
    const d = document.querySelector(".pizza-dough").getBoundingClientRect();
    const l = document.querySelector(".pizza-post-layer")?.getBoundingClientRect();
    const sq = document.querySelector(".pizza-dough-square")?.getBoundingClientRect();
    return { square: Boolean(document.querySelector(".pizza-dough--square-pan")), dough: [d.x, d.y, d.width, d.height].map((v) => +v.toFixed(1)), layer: l && [l.x, l.y, l.width, l.height].map((v) => +v.toFixed(1)), squareSheet: sq && [sq.x, sq.y, sq.width, sq.height].map((v) => +v.toFixed(1)) };
  });
  await page.close();
}
await browser.close();
fs.writeFileSync(`${outDir}/${tag}-facts.json`, JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts, null, 1));
