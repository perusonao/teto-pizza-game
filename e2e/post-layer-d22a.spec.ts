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
