import { test, expect, type Page } from "@playwright/test";

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
 * FINISH F-3 (#597): the CUT drawing (guide, preview line, knife, committed grooves) is drawn above the post pieces under every bake
 * state. Measured as the pixels the cut drawing changes inside the post pieces' boxes (cut drawing shown vs hidden, same page, same frame).
 */
const HIDE_CUT = `.pizza-cut-layer,.pizza-cut-tool-layer{visibility:hidden!important}`;
const STILL_CSS = `.pizza-cut-guide-lines{opacity:1!important} .pizza-cut-flash{display:none!important} *{animation:none!important;transition:none!important}`;

async function changedPixels(page: Page, boxes: { x: number; y: number; width: number; height: number }[]) {
  const shown = await page.screenshot();
  const style = await page.addStyleTag({ content: HIDE_CUT });
  const hidden = await page.screenshot();
  await style.evaluate((e) => e.remove());
  return page.evaluate(
    async ([a, b, rects]) => {
      const load = async (s: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${s}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d")!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height);
      };
      const A = await load(a as string);
      const B = await load(b as string);
      let n = 0;
      for (const r of rects as { x: number; y: number; width: number; height: number }[]) {
        for (let y = Math.max(0, Math.floor(r.y)); y < Math.ceil(r.y + r.height); y += 1) {
          for (let x = Math.max(0, Math.floor(r.x)); x < Math.ceil(r.x + r.width); x += 1) {
            const i = (y * A.width + x) * 4;
            if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 12) n += 1;
          }
        }
      }
      return n;
    },
    [shown.toString("base64"), hidden.toString("base64"), boxes] as const,
  );
}

const postBoxes = (page: Page) => page.$$eval('[data-topping-stage="post"]', (els) => els.map((e) => e.getBoundingClientRect().toJSON()));

async function dragPartial(page: Page, upTo = 0.2) {
  const d = (await page.locator(".pizza-dough").first().boundingBox())!;
  const cx = d.x + d.width / 2;
  const cy = d.y + d.height / 2;
  const r = d.width / 2;
  await page.mouse.move(cx - r, cy - 2);
  await page.mouse.down();
  await page.mouse.move(cx + r * upTo, cy - 2, { steps: 10 });
  return { cx, cy, r };
}

test.describe("FINISH F-3: the cut drawing is above the post pieces (#597)", () => {
  test("guide / preview line / committed groove paint over the post pieces at raw, perfect and burnt as they do with no bake", async ({ page }) => {
    const seen: Record<string, Record<string, number>> = {};
    for (const bake of ["none", "raw", "perfect", "burnt"]) {
      await page.goto(`${HARNESS}?step=CUT&bake=${bake}&post=1&onguide=1`);
      await page.waitForSelector(".pizza-dough");
      await page.waitForTimeout(400);
      await page.addStyleTag({ content: STILL_CSS });
      const boxes = await postBoxes(page);
      const guide = await changedPixels(page, boxes);
      // the preview line + knife alone (guide off), while the pointer is down
      await page.addStyleTag({ content: ".pizza-cut-guide-lines{display:none!important}" });
      await dragPartial(page);
      const preview = await changedPixels(page, boxes);
      await page.mouse.up();
      await page.waitForTimeout(300);
      const groove = await changedPixels(page, boxes);
      seen[bake] = { guide, preview, groove };
    }
    for (const bake of ["raw", "perfect", "burnt"]) {
      for (const what of ["guide", "preview", "groove"]) {
        // before F-3 a filtered dough kept ~1/3 of this (the layer hid the rest); no-bake already drew it on top
        expect(seen[bake][what], `${bake} ${what} ${JSON.stringify(seen)}`).toBeGreaterThan(seen.none[what] * 0.6);
      }
    }
    expect(seen.none.guide).toBeGreaterThan(100);
  });

  test("DOM: the cut drawing is in the post layer after the pieces, covers the dough's box to 0.5px, and takes no pointer events", async ({ page }) => {
    for (const cuts of [0, 2]) {
      await page.goto(`${HARNESS}?step=CUT&bake=burnt&post=1&onguide=1`);
      await page.waitForSelector(".pizza-dough");
      await cutLines(page, cuts);
      const info = await page.evaluate(() => {
        const dough = document.querySelector(".pizza-dough")!;
        const layer = document.querySelector(".pizza-post-layer")!;
        const cut = layer.querySelector(".pizza-cut-layer")!;
        const tool = layer.querySelector(".pizza-cut-tool-layer")!;
        const post = layer.querySelector('[data-topping-stage="post"]')!;
        const d = dough.getBoundingClientRect();
        const c = cut.getBoundingClientRect();
        return {
          inDough: dough.querySelector(".pizza-cut-layer, .pizza-cut-tool-layer") !== null,
          after: Boolean(post.compareDocumentPosition(cut) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(cut.compareDocumentPosition(tool) & Node.DOCUMENT_POSITION_FOLLOWING),
          err: Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y), Math.abs(c.width - d.width), Math.abs(c.height - d.height)),
          pe: [getComputedStyle(cut).pointerEvents, getComputedStyle(tool).pointerEvents],
          zone: layer.querySelector(".pizza-cut-hit-zone") !== null,
          filters: [cut, tool, layer].map((e) => getComputedStyle(e).filter),
        };
      });
      expect(info.inDough).toBe(false);
      expect(info.after).toBe(true);
      expect(info.err).toBeLessThanOrEqual(0.5);
      expect(info.pe).toEqual(["none", "none"]);
      expect(info.zone).toBe(false);
      expect(info.filters).toEqual(["none", "none", "none"]);
    }
  });

  test("consecutive drags: each reaches the dough through the drawing above it, the preview follows the pointer and clears on release", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=burnt&post=1&onguide=1`);
    await page.waitForSelector(".pizza-dough");
    const readout = () => page.locator(".cut-progress-readout").textContent();
    for (let i = 0; i < 3; i += 1) {
      const b = (await page.locator(".pizza-dough").first().boundingBox())!;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const r = Math.min(b.width, b.height) / 2;
      const a = (CUT_ANGLES[i] * Math.PI) / 180;
      await page.mouse.move(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
      await page.mouse.down();
      await page.mouse.move(cx, cy, { steps: 6 });
      const mid = await page.evaluate(() => {
        const p = document.querySelector(".pizza-post-layer .pizza-cut-preview-line") as SVGElement | null;
        const k = document.querySelector(".pizza-post-layer .pizza-cut-cutter-icon") as HTMLElement | null;
        return { preview: p?.style.opacity, points: p?.getAttribute("points") ?? "", knife: k?.style.opacity };
      });
      expect(mid.preview, `drag ${i}`).toBe("1");
      expect(mid.points.length).toBeGreaterThan(0);
      expect(mid.knife).toBe("1");
      await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      expect(await readout()).toContain(String(i + 1));
      const cleared = await page.evaluate(() => (document.querySelector(".pizza-post-layer .pizza-cut-preview-line") as SVGElement).style.opacity);
      expect(cleared).toBe("0");
    }
  });

  test("a committed groove stays over the post pieces after leaving CUT (RESULT-like: the cut drawing outlives the step)", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=perfect&post=1&onguide=1`);
    await page.waitForSelector(".pizza-dough");
    await dragPartial(page);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as unknown as { __hv: { setStep: (s: string) => void } }).__hv.setStep("TOPPING"));
    await page.waitForTimeout(500);
    await page.addStyleTag({ content: STILL_CSS });
    const info = await page.evaluate(() => ({
      grooves: document.querySelectorAll(".pizza-post-layer .pizza-cut-mark--partial").length,
      guide: document.querySelectorAll(".pizza-cut-guide-lines, .pizza-cut-tool-layer").length,
    }));
    expect(info).toEqual({ grooves: 1, guide: 0 });
    expect(await changedPixels(page, await postBoxes(page))).toBeGreaterThan(40);
  });

  test("square tray: the same layers, the same box, over the post pieces", async ({ page }) => {
    await page.goto(`${HARNESS}?step=TOPPING&bake=burnt&post=1&onguide=1&pan=square`);
    await page.waitForSelector(".pizza-dough");
    await page.getByRole("button", { name: "CUT へ", exact: true }).click();
    await page.waitForTimeout(500);
    await page.addStyleTag({ content: STILL_CSS });
    const info = await page.evaluate(() => {
      const d = document.querySelector(".pizza-dough")!.getBoundingClientRect();
      const c = document.querySelector(".pizza-post-layer .pizza-cut-layer")!.getBoundingClientRect();
      return { err: Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y), Math.abs(c.width - d.width), Math.abs(c.height - d.height)) };
    });
    expect(info.err).toBeLessThanOrEqual(0.5);
    expect(await changedPixels(page, await postBoxes(page))).toBeGreaterThan(40);
  });

  test("with no post piece the cut drawing stays in the dough (DOM unchanged)", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=burnt&post=0`);
    await page.waitForSelector(".pizza-dough");
    await cutLines(page, 1);
    const info = await page.evaluate(() => ({
      layer: document.querySelector(".pizza-post-layer") !== null,
      inDough: document.querySelector(".pizza-dough > .pizza-cut-layer") !== null && document.querySelector(".pizza-dough > .pizza-cut-tool-layer") !== null,
      front: document.querySelector(".pizza-cut-layer--front, .pizza-cut-tool-layer--front") !== null,
    }));
    expect(info).toEqual({ layer: false, inDough: true, front: false });
  });
});
