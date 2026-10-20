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
 * FINISH F-2 (#594): after a cut the post pieces stay in `.pizza-post-layer`, in a pieces-shaped copy (same clip chain and separation as
 * `.pizza-pieces`, no relief filter). Real pixels in the real cooking skeleton (CUT, roomy), cuts drawn with the mouse like a player.
 */
async function cutThrough(page: Page, angleDeg: number, offset = 0) {
  const b = (await page.locator(".pizza-dough").first().boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const r = Math.min(b.width, b.height) / 2;
  const a = (angleDeg * Math.PI) / 180;
  const ox = -Math.sin(a) * offset;
  const oy = Math.cos(a) * offset;
  const dx = Math.cos(a) * r;
  const dy = Math.sin(a) * r;
  await page.mouse.move(cx + ox - dx, cy + oy - dy);
  await page.mouse.down();
  await page.mouse.move(cx + ox + dx, cy + oy + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}
/** the post layer's own pixels: the dough (and so its pieces, overlays and the cut layer) hidden for the shot only, so the next cut can still be drawn */
async function isolatedLayerShot(page: Page) {
  const tag = await page.addStyleTag({ content: `.pizza-dough{visibility:hidden!important} *{animation:none!important;transition:none!important} html,body,.app-frame,.game-screen{background:#fff!important}` });
  const png = await page.locator(".pizza-post-layer").screenshot({ animations: "disabled" });
  await tag.evaluate((e) => e.remove());
  return png;
}
const CUT_ANGLES = [0, 60, 120];
const cutCount = (page: Page) => page.locator(".cut-progress-readout, [data-testid='hv-taps']").first().textContent();


test.describe("FINISH F-2: post pieces after a cut (#594)", () => {
  test("raw / perfect / burnt x 0..3 cuts: the post pieces' pixels do not depend on the bake, and match the uncut colours", async ({ page }) => {
    const mean = async (png: Buffer) => {
      const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let n = 0, r = 0, g = 0, b = 0;
      for (let i = 0; i < data.length; i += 3) {
        if (data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250) continue;
        n++; r += data[i]; g += data[i + 1]; b += data[i + 2];
      }
      return { n, rgb: [r / n, g / n, b / n] };
    };
    let uncutMean: { n: number; rgb: number[] } | null = null;
    await page.goto(`${HARNESS}?step=CUT&bake=none&post=1&onguide=1`);
    await page.waitForSelector(".pizza-dough");
    await page.waitForTimeout(500);
    for (let cuts = 0; cuts <= 3; cuts++) {
      if (cuts > 0) await cutThrough(page, CUT_ANGLES[cuts - 1]);
      expect(await page.locator(".pizza-pieces").count()).toBe(cuts === 0 ? 0 : 1);
      const shots: Record<string, Buffer> = {};
      for (const bake of ["none", "raw", "perfect", "burnt"] as const) {
        await page.evaluate((b) => window.__hv.setBake(b), bake);
        await page.waitForTimeout(250);
        shots[bake] = await isolatedLayerShot(page);
      }
      for (const bake of ["raw", "perfect", "burnt"]) {
        expect(Buffer.compare(shots[bake], shots.none), `cuts=${cuts} bake=${bake}`).toBe(0);
      }
      const m = await mean(shots.none);
      if (cuts === 0) uncutMean = m;
      else {
        // a cut only nudges the pieces 1.5px apart (the seams add anti-aliased edge pixels, hence the small tolerance): the colours of
        // the post pieces stay those of the uncut layer. The bug this guards moved the mean by 14-15 (B +13.7 raw, R -15.2 burnt)
        m.rgb.forEach((v, i) => expect(Math.abs(v - uncutMean!.rgb[i]), `cuts=${cuts} channel ${i}`).toBeLessThan(4));
        expect(Math.abs(m.n - uncutMean!.n) / uncutMean!.n, `cuts=${cuts} pixel count`).toBeLessThan(0.03);
      }
    }
  });

  test("the layer is outside the dough, carries no filter anywhere, takes no pointer events, and the dough keeps its box", async ({ page }) => {
    const before = await rects(page, "step=CUT&bake=burnt&post=1&onguide=1");
    await cutThrough(page, 0);
    await cutThrough(page, 60);
    const info = await page.evaluate(() => {
      const dough = document.querySelector(".pizza-dough") as HTMLElement;
      const layer = document.querySelector(".pizza-post-layer") as HTMLElement;
      const r = (e: Element) => ((b) => [b.x, b.y, b.width, b.height])(e.getBoundingClientRect());
      // the structure the cut copy adds (layer, copy, pieces, clips, bodies); an ingredient's own drawing keeps its own look
      const filtered = [layer, ...layer.querySelectorAll(".pizza-post-pieces, .pizza-piece, .pizza-piece-clip, .pizza-piece-body")].filter((e) => getComputedStyle(e).filter !== "none").length;
      const pe = [layer, ...layer.querySelectorAll("*")].filter((e) => getComputedStyle(e).pointerEvents !== "none").length;
      return {
        inside: dough.contains(layer),
        postInDough: dough.querySelectorAll('[data-topping-stage="post"]').length,
        doughFilter: getComputedStyle(dough).filter,
        piecesFilter: getComputedStyle(dough.querySelector(".pizza-pieces")!).filter,
        filtered,
        pe,
        dough: r(dough),
        layer: r(layer),
        copy: r(layer.querySelector(".pizza-post-pieces")!),
      };
    });
    expect(info.inside).toBe(false);
    expect(info.postInDough).toBe(0);
    expect(info.doughFilter).not.toBe("none"); // bake filter still on the dough
    expect(info.piecesFilter).not.toBe("none"); // relief still on the dough's pieces
    expect(info.filtered).toBe(0); // ... and nowhere in the post layer
    expect(info.pe).toBe(0);
    info.layer.forEach((v, i) => expect(v, `layer[${i}]`).toBeCloseTo(info.dough[i], 1));
    info.copy.forEach((v, i) => expect(v, `copy[${i}]`).toBeCloseTo(info.dough[i], 1));
    info.dough.forEach((v, i) => expect(v, `dough[${i}] (F-1 box)`).toBeCloseTo(before.dough[i], 1)); // cutting does not resize the dough
  });

  test("coordinates and continuity: a whole post piece sits at its left/top percentage plus only its piece's 1.5px separation, before and after each cut", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=perfect&post=1&onguide=1`);
    await page.waitForSelector(".pizza-dough");
    await page.waitForTimeout(500);
    const centres = () =>
      page.evaluate(() => {
        const dough = document.querySelector(".pizza-dough") as HTMLElement;
        const border = parseFloat(getComputedStyle(dough).borderTopWidth);
        const d = dough.getBoundingClientRect();
        return [...document.querySelectorAll('.pizza-topping[data-topping-stage="post"]')].map((el) => {
          const e = el as HTMLElement;
          const r = e.getBoundingClientRect();
          const px = (parseFloat(e.style.left) / 100) * (d.width - 2 * border) + d.x + border;
          const py = (parseFloat(e.style.top) / 100) * (d.height - 2 * border) + d.y + border;
          const t = e.closest(".pizza-piece") ? new DOMMatrix(getComputedStyle(e.closest(".pizza-piece")!).transform) : new DOMMatrix();
          return { id: e.dataset.toppingId!, cx: r.x + r.width / 2, cy: r.y + r.height / 2, px, py, tx: t.e, ty: t.f };
        });
      });
    const uncut = await centres();
    expect(uncut.length).toBe(6);
    for (const p of uncut) {
      expect(Math.abs(p.cx - p.px)).toBeLessThan(0.5);
      expect(Math.abs(p.cy - p.py)).toBeLessThan(0.5);
    }
    for (let i = 0; i < 3; i++) {
      await cutThrough(page, CUT_ANGLES[i]);
      const cut = await centres();
      const wholes = cut.filter((c) => uncut.some((u) => u.id === c.id));
      expect(wholes.length).toBe(uncut.length); // every piece is whole in exactly one piece
      for (const c of wholes) {
        const u = uncut.find((x) => x.id === c.id)!;
        // position error to the nominal point + the piece's own translate
        expect(Math.abs(c.cx - (c.px + c.tx)), `${c.id} x after cut ${i + 1}`).toBeLessThan(0.5);
        expect(Math.abs(c.cy - (c.py + c.ty)), `${c.id} y after cut ${i + 1}`).toBeLessThan(0.5);
        // continuity: it moved by that translate only (<= 1.5px), not a jump
        expect(Math.hypot(c.cx - u.cx, c.cy - u.cy), `${c.id} jump after cut ${i + 1}`).toBeLessThan(1.6);
      }
    }
    // pieces on a guide line show a sliced part in the neighbour
    expect(await page.locator('.pizza-post-layer .pizza-topping-half[data-topping-stage="post"]').count()).toBeGreaterThan(0);
  });

  test("taps pass through post pieces after a cut, and cutting still works over them", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=perfect&post=1&onguide=1`);
    await page.waitForSelector(".pizza-dough");
    await page.waitForTimeout(500);
    await cutThrough(page, 0);
    expect((await cutCount(page))!.trim()).toBe("1 本");
    const box = (await page.locator('.pizza-post-layer .pizza-topping[data-topping-stage="post"]').first().boundingBox())!;
    const hit = await page.evaluate(([x, y]) => {
      const e = document.elementFromPoint(x, y)!;
      return { inLayer: Boolean(e.closest(".pizza-post-layer")), cls: e.className.toString() };
    }, [box.x + box.width / 2, box.y + box.height / 2]);
    expect(hit.inLayer, hit.cls).toBe(false);
    // a second cut dragged across a post piece is registered
    await cutThrough(page, 60);
    expect((await cutCount(page))!.trim()).toBe("2 本");
  });

  test("square pan + post pieces + cut: observed (layer = dough, no filter in the layer, colours independent of the bake)", async ({ page }) => {
    await page.goto(`${HARNESS}?step=CUT&bake=none&post=1&pan=square`);
    await page.waitForSelector(".pizza-dough");
    await page.waitForTimeout(500);
    await cutThrough(page, 0);
    const shots: Buffer[] = [];
    for (const bake of ["none", "raw", "perfect", "burnt"] as const) {
      await page.evaluate((b) => window.__hv.setBake(b), bake);
      await page.waitForTimeout(250);
      shots.push(await isolatedLayerShot(page));
    }
    for (const s of shots.slice(1)) expect(Buffer.compare(s, shots[0])).toBe(0);
    const info = await page.evaluate(() => {
      const layer = document.querySelector(".pizza-post-layer")!;
      const dough = document.querySelector(".pizza-dough")!;
      return { filtered: [layer, ...layer.querySelectorAll(".pizza-post-pieces, .pizza-piece, .pizza-piece-clip, .pizza-piece-body")].filter((e) => getComputedStyle(e).filter !== "none").length, same: JSON.stringify(layer.getBoundingClientRect()) === JSON.stringify(dough.getBoundingClientRect()) };
    });
    expect(info.filtered).toBe(0);
    expect(info.same).toBe(true);
  });
});
