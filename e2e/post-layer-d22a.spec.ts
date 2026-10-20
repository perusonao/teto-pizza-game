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
