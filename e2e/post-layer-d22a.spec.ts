import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";

const sharp = createRequire(import.meta.url)("sharp");

/**
 * FINISH D2-2a (Issue #518, option b): a post-bake piece lives in `.pizza-post-layer`, outside `.pizza-dough` (whose bake
 * `filter` tints every descendant). Checked on real pixels through the DEV-only bench (`?dev=postlayer`, src/dev/PostLayerBench.tsx):
 * the post pieces' pixels are identical at raw / perfect / burnt / no bake, they sit where they sat inside the dough, and a tap on a
 * piece reaches the dough. Under both viewport projects (390x844 / 360x800); jsdom has neither layout nor filters.
 */

const BENCH = "./?dev=postlayer";

async function open(page: Page, query: string) {
  await page.goto(`${BENCH}&${query}`);
  await page.waitForSelector(".pizza-dough");
  await page.waitForTimeout(500);
}

/** the post pieces alone: dough face, pre-bake pieces, bake overlays and motion removed, so only the layer's own pixels remain */
async function isolatedPostPixels(page: Page, bake: string) {
  await open(page, `bake=${bake}`);
  await page.addStyleTag({
    content: `.pizza-dough{background:none!important;border-color:transparent!important;box-shadow:none!important}
      .pizza-dough-shape,.pizza-dough-square,.pizza-bake-overlay,.pizza-char-spots,.pizza-smoke-wrap,.pizza-perfect-glow,.pizza-sauce-heatmap{display:none!important}
      .pizza-topping:not([data-topping-stage="post"]){display:none!important}
      *{animation:none!important;transition:none!important} html,body,main,.app-frame{background:#fff!important}`,
  });
  await page.waitForTimeout(300);
  const box = await page.locator(".pizza-dough").boundingBox();
  return page.screenshot({ clip: box! });
}

test.describe("FINISH D2-2a: post-bake layer (#518)", () => {
  test("post pieces are not tinted by raw / perfect / burnt (pixels equal the no-bake render)", async ({ page }) => {
    const reference = await isolatedPostPixels(page, "none");
    for (const bake of ["raw", "perfect", "burnt"]) {
      const pixels = await isolatedPostPixels(page, bake);
      expect(Buffer.compare(pixels, reference), `bake=${bake}`).toBe(0);
    }
  });

  test("the post layer is outside the filtered dough, covers its box, and takes no pointer events", async ({ page }) => {
    for (const bake of ["raw", "perfect", "burnt"]) {
      await open(page, `bake=${bake}`);
      const info = await page.evaluate(() => {
        const dough = document.querySelector(".pizza-dough") as HTMLElement;
        const layer = document.querySelector(".pizza-post-layer") as HTMLElement;
        const rect = (e: Element) => e.getBoundingClientRect().toJSON();
        return {
          inside: dough.contains(layer),
          doughFilter: getComputedStyle(dough).filter,
          layerFilter: getComputedStyle(layer).filter,
          pointer: getComputedStyle(layer).pointerEvents,
          dough: rect(dough),
          layer: rect(layer),
          pieceInDough: dough.querySelectorAll('[data-topping-stage="post"]').length,
        };
      });
      expect(info.inside).toBe(false);
      expect(info.pieceInDough).toBe(0);
      expect(info.doughFilter).not.toBe("none"); // the bake filter is still on the dough
      expect(info.layerFilter).toBe("none");
      expect(info.pointer).toBe("none");
      for (const k of ["x", "y", "width", "height"] as const) expect(info.layer[k]).toBeCloseTo(info.dough[k], 1);
    }
  });

  test("coordinates: a piece is at its left/top percentage of the dough's padding box", async ({ page }) => {
    await open(page, "bake=burnt");
    const placed = await page.evaluate(() => {
      const dough = document.querySelector(".pizza-dough") as HTMLElement;
      const border = parseFloat(getComputedStyle(dough).borderTopWidth);
      const d = dough.getBoundingClientRect();
      return [...document.querySelectorAll('[data-topping-stage="post"]')].map((el) => {
        const e = el as HTMLElement;
        const r = e.getBoundingClientRect();
        const px = (parseFloat(e.style.left) / 100) * (d.width - 2 * border) + d.x + border;
        const py = (parseFloat(e.style.top) / 100) * (d.height - 2 * border) + d.y + border;
        return { dx: r.x + r.width / 2 - px, dy: r.y + r.height / 2 - py };
      });
    });
    expect(placed.length).toBe(3);
    for (const p of placed) {
      expect(Math.abs(p.dx)).toBeLessThan(1.5);
      expect(Math.abs(p.dy)).toBeLessThan(1.5);
    }
  });

  test("tap-through: a tap on a post piece reaches the dough at that point", async ({ page }) => {
    await open(page, "bake=perfect");
    const box = await page.locator('[data-topping-stage="post"]').first().boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)!.classList.contains("pizza-dough"), [cx, cy])).toBe(true);
    await page.mouse.click(cx, cy);
    await expect(page.getByTestId("bench-taps")).toHaveText(/^1:/);
  });

  test("a pizza without post pieces has no layer and the stage keeps its flex row", async ({ page }) => {
    await open(page, "bake=perfect&post=0");
    await expect(page.locator(".pizza-post-layer")).toHaveCount(0);
    expect(await page.locator(".pizza-stage").evaluate((e) => getComputedStyle(e).display)).toBe("flex");
  });
});

/**
 * FINISH F-1 (#592): in roomy (CUT / BAKE) the post-layer stage is a grid, which used to stop the dough's flex-shrink -- the dough
 * grew from 358 x 358.8 to 358.8 x 358.8 (390x844) and 328 x 331.2 to 331.2 x 331.2 (360x800) the moment a post-bake piece appeared.
 * Measured in the real cooking skeleton (e2e/harness/finish-hv.html: header / tabs / order-card / stage / dock with the heights measured in
 * the running game), compact (TOPPING) and roomy (CUT), with and without post pieces, on a round pan and on the square pan.
 */
const HARNESS = "./e2e/harness/finish-hv.html";

async function rects(page: Page, query: string) {
  await page.goto(`${HARNESS}?${query}`);
  await page.waitForSelector(".pizza-dough");
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const r = (e: Element | null) => (e ? ((b) => [b.x, b.y, b.width, b.height])(e.getBoundingClientRect()) : null);
    return { dough: r(document.querySelector(".pizza-dough"))!, layer: r(document.querySelector(".pizza-post-layer")), display: getComputedStyle(document.querySelector(".pizza-stage")!).display };
  });
}

test.describe("FINISH F-1: the dough keeps its box when a post-bake piece appears (#592)", () => {
  for (const step of ["TOPPING", "CUT"]) {
    for (const pan of ["", "&pan=square"]) {
      test(`${step}${pan ? " (square pan)" : ""}: dough rect with post pieces equals the one without; the layer equals the dough`, async ({ page }) => {
        const without = await rects(page, `step=${step}&bake=burnt&post=0${pan}`);
        const withPost = await rects(page, `step=${step}&bake=burnt&post=1${pan}`);
        expect(without.layer).toBeNull();
        expect(without.display).toBe("flex");
        expect(withPost.display).toBe("grid");
        withPost.dough.forEach((v, i) => expect(v, `dough[${i}]`).toBeCloseTo(without.dough[i], 1));
        withPost.layer!.forEach((v, i) => expect(v, `layer[${i}]`).toBeCloseTo(withPost.dough[i], 1));
      });
    }
  }

  test("roomy: the dough is no wider than the stage's content box (it shrinks like a flex item, it does not overflow)", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=burnt&post=1`);
    await page.waitForSelector(".pizza-dough");
    const { doughW, contentW } = await page.evaluate(() => {
      const stage = document.querySelector(".pizza-stage")!;
      const cs = getComputedStyle(stage);
      return {
        doughW: document.querySelector(".pizza-dough")!.getBoundingClientRect().width,
        contentW: stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      };
    });
    expect(doughW).toBeLessThanOrEqual(contentW + 0.05);
  });
});

/**
 * FINISH F-2 (#594): a cut pizza keeps its post-bake pieces in the layer, in a copy of the cut geometry (clip chain + 1.5px offset), with no
 * filter. Real cuts (rim-to-rim drags) on the real-sized cooking skeleton, 0..3 lines, with extra post pieces ON the guide lines so some are sliced.
 */
const ISOLATE_CSS = `.pizza-dough{background:none!important;border-color:transparent!important;box-shadow:none!important}
  .pizza-dough-shape,.pizza-dough-square,.pizza-bake-overlay,.pizza-char-spots,.pizza-smoke-wrap,.pizza-perfect-glow,.pizza-sauce-heatmap,.pizza-cut-layer,.sauce-target-guide,.dough-target-guide,.pizza-piece-body>*:not(.pizza-topping):not(.pizza-topping-half){display:none!important}
  .pizza-topping:not([data-topping-stage="post"]),.pizza-topping-half:not([data-topping-stage="post"]){display:none!important}
  *{animation:none!important;transition:none!important} html,body,.app-frame{background:#fff!important}`;
const CUT_ANGLES = [0, 60, 120];

async function cutLines(page: Page, count: number) {
  for (let i = 0; i < count; i += 1) {
    const b = (await page.locator(".pizza-dough").first().boundingBox())!;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const r = Math.min(b.width, b.height) / 2;
    const a = (CUT_ANGLES[i] * Math.PI) / 180;
    await page.mouse.move(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
    await page.mouse.down();
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
}

/** the post pieces alone with `cuts` real cut lines, once per bake state (the harness switches the bake in place: the cut stays) */
async function cutPostPixels(page: Page, cuts: number) {
  await page.goto(`${HARNESS}?step=CUT&bake=none&post=1&onguide=1`);
  await page.waitForSelector(".pizza-dough");
  await page.waitForTimeout(400);
  await cutLines(page, cuts);
  await page.addStyleTag({ content: ISOLATE_CSS });
  const shots: Record<string, Buffer> = {};
  for (const bake of ["none", "raw", "perfect", "burnt"]) {
    await page.evaluate((b) => (window as unknown as { __hv: { setBake: (v: string) => void } }).__hv.setBake(b), bake);
    await page.waitForTimeout(250);
    shots[bake] = await page.screenshot({ clip: (await page.locator(".pizza-dough").first().boundingBox())! });
  }
  return shots;
}

test.describe("FINISH F-2: post-bake pieces on a cut pizza (#594)", () => {
  test("raw / perfect / burnt x 0..3 cuts: the post pieces' pixels equal the no-bake render at the same cut count", async ({ page }) => {
    test.setTimeout(120_000);
    for (let cuts = 0; cuts <= 3; cuts += 1) {
      const shots = await cutPostPixels(page, cuts);
      for (const bake of ["raw", "perfect", "burnt"]) {
        expect(Buffer.compare(shots[bake], shots.none), `bake=${bake} cuts=${cuts}`).toBe(0);
      }
    }
  });

  test("the layer holds the pieces outside the filtered dough; no ancestor of a post piece up to the stage has a filter", async ({ page }) => {
    for (const cuts of [1, 3]) {
      await page.goto(`${HARNESS}?step=CUT&bake=burnt&post=1&onguide=1`);
      await page.waitForSelector(".pizza-dough");
      await cutLines(page, cuts);
      const info = await page.evaluate(() => {
        const dough = document.querySelector(".pizza-dough")!;
        const post = document.querySelector('[data-topping-stage="post"]')!;
        const filters: string[] = [];
        for (let e: Element | null = post; e && !e.classList.contains("pizza-stage"); e = e.parentElement) {
          if (getComputedStyle(e).filter !== "none") filters.push(e.className.toString());
        }
        return { inDough: dough.contains(post), filters, doughFilter: getComputedStyle(dough).filter, pieces: document.querySelectorAll(".pizza-post-layer .pizza-piece").length };
      });
      expect(info.inDough).toBe(false);
      expect(info.filters).toEqual([]);
      expect(info.doughFilter).not.toBe("none"); // the bake filter is still on the dough
      expect(info.pieces).toBeGreaterThan(0);
    }
  });

  test("coordinates: every post piece is where its (offset) piece puts it, to 0.5px, with 1 / 2 / 3 cuts", async ({ page }) => {
    for (const cuts of [1, 2, 3]) {
      await page.goto(`${HARNESS}?step=CUT&bake=burnt&post=1&onguide=1`);
      await page.waitForSelector(".pizza-dough");
      await cutLines(page, cuts);
      const { maxErr, count, offset } = await page.evaluate(() => {
        const dough = document.querySelector(".pizza-dough")!;
        const d = dough.getBoundingClientRect();
        const border = parseFloat(getComputedStyle(dough).borderTopWidth);
        let maxErr = 0;
        let offset = 0;
        const els = [...document.querySelectorAll('.pizza-post-layer [data-topping-stage="post"]')] as HTMLElement[];
        for (const el of els) {
          const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec((el.closest(".pizza-piece") as HTMLElement | null)?.style.transform ?? "");
          const tx = m ? Number(m[1]) : 0;
          const ty = m ? Number(m[2]) : 0;
          if (tx || ty) offset += 1;
          const r = el.getBoundingClientRect();
          const ex = (parseFloat(el.style.left) / 100) * (d.width - 2 * border) + d.x + border + tx;
          const ey = (parseFloat(el.style.top) / 100) * (d.height - 2 * border) + d.y + border + ty;
          maxErr = Math.max(maxErr, Math.abs(r.x + r.width / 2 - ex), Math.abs(r.y + r.height / 2 - ey));
        }
        return { maxErr, count: els.length, offset };
      });
      expect(count).toBeGreaterThan(0);
      expect(offset, "the 1.5px piece offset is in play").toBeGreaterThan(0);
      expect(maxErr).toBeLessThanOrEqual(0.5);
    }
  });

  test("tap-through: a cut pizza's post piece takes no taps, and the next cut still goes through", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=perfect&post=1&onguide=1`);
    await page.waitForSelector(".pizza-dough");
    await cutLines(page, 1);
    const box = (await page.locator('.pizza-post-layer [data-topping-stage="post"]').first().boundingBox())!;
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".pizza-post-layer") !== null, [box.x + box.width / 2, box.y + box.height / 2]);
    expect(hit).toBe(false);
    const readout = () => page.locator(".cut-progress-readout").textContent();
    expect(await readout()).toContain("1");
    // a second line from the second angle (index 1), drawn after the first
    const b = (await page.locator(".pizza-dough").first().boundingBox())!;
    const a = (CUT_ANGLES[1] * Math.PI) / 180;
    const r = Math.min(b.width, b.height) / 2;
    await page.mouse.move(b.x + b.width / 2 - Math.cos(a) * r, b.y + b.height / 2 - Math.sin(a) * r);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + Math.cos(a) * r, b.y + b.height / 2 + Math.sin(a) * r, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    expect(await readout()).toContain("2");
  });
});

/**
 * FINISH F-3 (#597): with post-bake pieces the CUT drawing (guide / centre marker, drag preview + knife, partial-cut groove, the one-shot flash)
 * is rendered in `.pizza-post-layer` after the pieces, so it paints IN FRONT of them. Real pixels in the real cooking skeleton, `onguide=1`
 * (post pieces on the 0 / 60 / 120 degree guide lines and the centre). Before F-3 only bake=none was in front (the dough has no stacking
 * context then); raw / perfect / burnt had the cut drawing UNDER the post pieces (a third of the visible pixels).
 */
const HIDE_CUT_CSS = ".pizza-cut-layer,.pizza-cut-tool-layer{visibility:hidden!important}";
const POST_ONLY_CSS = `${HIDE_CUT_CSS} .pizza-dough{visibility:hidden!important} *{animation:none!important;transition:none!important}
  html,body,.app-frame,.game-screen{background:#fff!important} .app-header,.making-step-tabs,.order-card,.cut-progress-readout,.action-row{visibility:hidden!important}`;

async function dragAlong(page: Page, deg: number, from: number, to: number, opts: { release?: boolean; steps?: number } = {}) {
  const b = (await page.locator(".pizza-dough").first().boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const r = Math.min(b.width, b.height) / 2;
  const a = (deg * Math.PI) / 180;
  await page.mouse.move(cx + Math.cos(a) * r * from, cy + Math.sin(a) * r * from);
  await page.mouse.down();
  await page.mouse.move(cx + Math.cos(a) * r * to, cy + Math.sin(a) * r * to, { steps: opts.steps ?? 8 });
  if (opts.release !== false) await page.mouse.up();
}

/** pixels the CUT drawing changes that lie on a post piece (post pieces alone, on white, as the mask) */
async function cutPixelsOnPost(page: Page) {
  const d = (await page.locator(".pizza-dough").first().boundingBox())!;
  const clip = { x: d.x - 24, y: d.y - 24, width: d.width + 48, height: d.height + 48 };
  const raw = (png: Buffer) => sharp(png).removeAlpha().raw().toBuffer() as Promise<Buffer>;
  const withCut = await raw(await page.screenshot({ clip }));
  const hide = await page.addStyleTag({ content: HIDE_CUT_CSS });
  const noCut = await raw(await page.screenshot({ clip }));
  const only = await page.addStyleTag({ content: POST_ONLY_CSS });
  const mask = await raw(await page.screenshot({ clip }));
  await only.evaluate((e) => e.remove());
  await hide.evaluate((e) => e.remove());
  let onPost = 0;
  for (let i = 0; i < withCut.length; i += 3) {
    const diff = Math.abs(withCut[i] - noCut[i]) + Math.abs(withCut[i + 1] - noCut[i + 1]) + Math.abs(withCut[i + 2] - noCut[i + 2]);
    if (diff > 60 && !(mask[i] > 250 && mask[i + 1] > 250 && mask[i + 2] > 250)) onPost += 1;
  }
  return onPost;
}

async function openCut(page: Page, bake: string, extra = "") {
  await page.goto(`${HARNESS}?step=CUT&bake=${bake}&post=1&onguide=1${extra}`);
  await page.waitForSelector(".pizza-dough");
  await page.waitForTimeout(450);
  await page.addStyleTag({ content: "*{animation-play-state:paused!important}" }); // the newest cut's flash stays at its first frame
}

const F3_SCENARIOS: Record<string, (page: Page) => Promise<void>> = {
  guide: async () => {},
  previewAndKnife: async (page) => dragAlong(page, 60, -0.95, 0.2, { release: false }),
  partialGroove: async (page) => dragAlong(page, 120, -0.5, 0.5),
  throughFlash: async (page) => dragAlong(page, 60, -1.05, 1.05),
};

test.describe("FINISH F-3: the CUT drawing is in front of post-bake pieces (#597)", () => {
  test("guide / preview + knife / partial groove / flash: as visible on post pieces at raw / perfect / burnt as at bake=none", async ({ page }) => {
    test.setTimeout(240_000);
    for (const [name, run] of Object.entries(F3_SCENARIOS)) {
      const seen: Record<string, number> = {};
      for (const bake of ["none", "raw", "perfect", "burnt"]) {
        await openCut(page, bake);
        await run(page);
        seen[bake] = await cutPixelsOnPost(page);
        await page.mouse.up();
      }
      expect(seen.none, `${name}: something of the cut drawing is on a post piece`).toBeGreaterThan(40);
      for (const bake of ["raw", "perfect", "burnt"]) {
        // bake=none was already in front (no filter on the dough, so no stacking context): the others must now be in the same range (a dark
        // burnt crust shows a little fewer pixels), not a third or less of it as when they were under the pieces (guide 0.08-0.29, groove 0.1-0.23)
        expect(seen[bake], `${name} ${bake}: ${JSON.stringify(seen)}`).toBeGreaterThanOrEqual(seen.none * 0.6);
      }
    }
  });

  test("DOM / box: the cut layer and the knife layer are in the post layer, after the pieces, boxes = the dough's; the capture zone stays in the dough", async ({ page }) => {
    for (const bake of ["raw", "burnt"]) {
      await openCut(page, bake);
      await dragAlong(page, 60, -1.05, 1.05);
      const info = await page.evaluate(() => {
        const dough = document.querySelector(".pizza-dough") as HTMLElement;
        const layer = document.querySelector(".pizza-post-layer") as HTMLElement;
        const r = (e: Element) => ((b) => [b.x, b.y, b.width, b.height])(e.getBoundingClientRect());
        const kids = [...layer.children].map((c) => c.getAttribute("class"));
        return {
          cutInDough: dough.querySelectorAll(".pizza-cut-layer, .pizza-cut-tool-layer").length,
          hitZoneInDough: dough.querySelectorAll(".pizza-cut-hit-zone").length,
          kids,
          dough: r(dough),
          cut: r(layer.querySelector(".pizza-cut-layer")!),
          tool: r(layer.querySelector(".pizza-cut-tool-layer")!),
          pe: [...layer.querySelectorAll(".pizza-cut-layer, .pizza-cut-tool-layer, .pizza-cut-cutter-icon")].map((e) => getComputedStyle(e).pointerEvents),
        };
      });
      expect(info.cutInDough).toBe(0);
      expect(info.hitZoneInDough).toBe(1);
      expect(info.kids.slice(-2)).toEqual(["pizza-cut-layer", "pizza-cut-tool-layer"]);
      info.cut.forEach((v, i) => expect(v, `cut[${i}]`).toBeCloseTo(info.dough[i], 1));
      info.tool.forEach((v, i) => expect(v, `tool[${i}]`).toBeCloseTo(info.dough[i], 1));
      expect(info.pe.every((p) => p === "none")).toBe(true);
    }
  });

  test("the drawing sits where the cut is: the preview line's end and the knife tip follow the finger, and the committed groove ends where the stroke ended", async ({ page }) => {
    await openCut(page, "perfect");
    const b = (await page.locator(".pizza-dough").first().boundingBox())!;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const r = Math.min(b.width, b.height) / 2;
    await page.mouse.move(cx - r * 0.4, cy);
    await page.mouse.down();
    await page.mouse.move(cx + r * 0.3, cy, { steps: 6 });
    const tip = await page.evaluate(() => {
      const icon = document.querySelector(".pizza-post-layer .pizza-cut-cutter-icon") as HTMLElement;
      const rr = icon.getBoundingClientRect();
      const preview = document.querySelector(".pizza-post-layer .pizza-cut-preview-line") as SVGElement;
      return { x: rr.x, y: rr.y, previewOpacity: getComputedStyle(preview).opacity };
    });
    expect(tip.previewOpacity).toBe("1");
    expect(Math.abs(tip.x - (cx + r * 0.3))).toBeLessThan(1.5);
    expect(Math.abs(tip.y - cy)).toBeLessThan(1.5);
    await page.mouse.up();
    const groove = await page.evaluate(() => (document.querySelector(".pizza-post-layer .pizza-cut-mark--partial polyline.pizza-cut-line") as SVGPolylineElement).getBoundingClientRect().toJSON());
    expect(Math.abs(groove.x + groove.width - (cx + r * 0.3))).toBeLessThan(3); // the groove's end (stroke cap incl.)
  });

  test("continuity: a partial cut and a drag move no post piece; a through cut moves each whole piece only by its 1.5px separation", async ({ page }) => {
    await openCut(page, "burnt");
    const centres = () =>
      page.evaluate(() =>
        Object.fromEntries(
          [...document.querySelectorAll('.pizza-post-layer .pizza-topping[data-topping-stage="post"]')].map((el) => {
            const r = el.getBoundingClientRect();
            const m = new DOMMatrix(getComputedStyle(el.closest(".pizza-piece") ?? document.body).transform);
            return [(el as HTMLElement).dataset.toppingId!, { x: r.x + r.width / 2, y: r.y + r.height / 2, tx: m.e, ty: m.f }];
          }),
        ),
      );
    const idle = await centres();
    await dragAlong(page, 60, -0.95, 0.2, { release: false });
    const dragging = await centres();
    for (const id of Object.keys(idle)) expect(Math.hypot(dragging[id].x - idle[id].x, dragging[id].y - idle[id].y), `${id} while dragging`).toBeLessThan(0.05);
    await page.mouse.up();
    const partial = await centres();
    // the drag released inside the pizza (0.2 R) = a partial cut: a groove, no parting
    for (const id of Object.keys(idle)) expect(Math.hypot(partial[id].x - idle[id].x, partial[id].y - idle[id].y), `${id} after a partial cut`).toBeLessThan(0.05);
    await page.reload();
    await page.waitForSelector(".pizza-dough");
    await page.waitForTimeout(450);
    const before = await centres();
    await dragAlong(page, 60, -1.05, 1.05);
    await page.waitForTimeout(300);
    const after = await centres();
    for (const id of Object.keys(before)) {
      const moved = Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y);
      expect(moved, `${id} moved ${moved.toFixed(2)}px by the through cut`).toBeLessThan(1.6);
      expect(Math.abs(after[id].x - (before[id].x + after[id].tx)), id).toBeLessThan(0.5);
      expect(Math.abs(after[id].y - (before[id].y + after[id].ty)), id).toBeLessThan(0.5);
    }
  });

  test("F-2 unchanged: post pixels equal the no-bake render at 0..3 cuts with the CUT drawing hidden; taps and consecutive drags go through", async ({ page }) => {
    test.setTimeout(120_000);
    const POST = `${ISOLATE_CSS} ${HIDE_CUT_CSS}`;
    for (const cuts of [0, 3]) {
      await page.goto(`${HARNESS}?step=CUT&bake=none&post=1&onguide=1`);
      await page.waitForSelector(".pizza-dough");
      await page.waitForTimeout(400);
      await cutLines(page, cuts);
      await page.addStyleTag({ content: POST });
      const shots: Record<string, Buffer> = {};
      for (const bake of ["none", "raw", "perfect", "burnt"]) {
        await page.evaluate((b) => (window as unknown as { __hv: { setBake: (v: string) => void } }).__hv.setBake(b), bake);
        await page.waitForTimeout(250);
        shots[bake] = await page.screenshot({ clip: (await page.locator(".pizza-dough").first().boundingBox())! });
      }
      for (const bake of ["raw", "perfect", "burnt"]) expect(Buffer.compare(shots[bake], shots.none), `bake=${bake} cuts=${cuts}`).toBe(0);
    }
    // consecutive drags, no pause between them, the first starting on a post piece: all three register
    await openCut(page, "raw");
    for (const deg of [0, 60, 120]) await dragAlong(page, deg, -1.05, 1.05, { steps: 4 });
    expect((await page.locator(".cut-progress-readout").textContent())!).toContain("3");
    const box = (await page.locator('.pizza-post-layer [data-topping-stage="post"]').first().boundingBox())!;
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".pizza-post-layer") !== null, [box.x + box.width / 2, box.y + box.height / 2])).toBe(false);
  });

  test("RESULT with committed cuts: the cuts are in the post layer in front of the post pieces; no knife", async ({ page }) => {
    for (const bake of ["raw", "burnt"]) {
      await page.goto(`${HARNESS}?step=RESULT&cuts=3&bake=${bake}&post=1&onguide=1`);
      await page.waitForSelector(".pizza-dough");
      await page.waitForTimeout(450);
      const info = await page.evaluate(() => {
        const dough = document.querySelector(".pizza-dough")!;
        const layer = document.querySelector(".pizza-post-layer")!;
        return {
          cutInDough: dough.querySelectorAll(".pizza-cut-layer").length,
          marks: layer.querySelectorAll(".pizza-cut-mark").length,
          knife: layer.querySelectorAll(".pizza-cut-tool-layer").length,
          pieces: layer.querySelectorAll(".pizza-post-layer__pieces .pizza-piece").length,
          after: layer.lastElementChild!.getAttribute("class"),
        };
      });
      expect(info.cutInDough).toBe(0);
      expect(info.marks).toBe(3);
      expect(info.knife).toBe(0);
      expect(info.pieces).toBeGreaterThan(0);
      expect(info.after).toBe("pizza-cut-layer");
    }
  });

  test("no post pieces: nothing moves (the cut layer and the knife stay in the dough, the stage keeps its flex row)", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=burnt&post=0`);
    await page.waitForSelector(".pizza-dough");
    const info = await page.evaluate(() => {
      const dough = document.querySelector(".pizza-dough")!;
      return {
        layer: document.querySelectorAll(".pizza-post-layer").length,
        cut: dough.querySelectorAll(":scope > .pizza-cut-layer").length,
        tool: dough.querySelectorAll(":scope > .pizza-cut-tool-layer").length,
        display: getComputedStyle(document.querySelector(".pizza-stage")!).display,
      };
    });
    expect(info).toEqual({ layer: 0, cut: 1, tool: 1, display: "flex" });
  });

  test("square pan + post pieces: the CUT drawing is in the layer, in the dough's box, in front of the pieces", async ({ page }) => {
    await openCut(page, "burnt", "&pan=square");
    await dragAlong(page, 60, -1.05, 1.05);
    const info = await page.evaluate(() => {
      const dough = document.querySelector(".pizza-dough")!;
      const layer = document.querySelector(".pizza-post-layer")!;
      const r = (e: Element) => ((b) => [b.x, b.y, b.width, b.height])(e.getBoundingClientRect());
      return { cutInDough: dough.querySelectorAll(".pizza-cut-layer").length, cut: r(layer.querySelector(".pizza-cut-layer")!), dough: r(dough), last: layer.lastElementChild!.getAttribute("class") };
    });
    expect(info.cutInDough).toBe(0);
    info.cut.forEach((v, i) => expect(v, `cut[${i}]`).toBeCloseTo(info.dough[i], 1));
    expect(info.last).toBe("pizza-cut-tool-layer");
  });
});
