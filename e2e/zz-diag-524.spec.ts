import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { base, bootResearch, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * DIAGNOSTIC ONLY (#524 Owner HV FAIL, round 2). The Owner's recording: the tomato's red vanishes right after the OLIVE OIL ingredient card is
 * selected (nothing painted yet). Compares tomato painted / oil card just selected (0, 150, 1000 ms) / oil painted: canvas data, the DOM stack at the
 * tomato's point (elementsFromPoint), CSS state of every layer in the dough, and a full-viewport screenshot sample. Prints; asserts nothing.
 */
type Rgb = number[];

async function paintAt(page: Page, x0: number, x1: number, y: number) {
  const b = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const a = { x: b.x + x0 * b.width, y: b.y + y * b.height };
  const z = { x: b.x + x1 * b.width, y: a.y };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) {
    await page.mouse.move(a.x + ((z.x - a.x) * i) / 16, a.y);
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
}

async function snap(page: Page, scenario: string, stage: string, img = false) {
  const dough = page.locator(".pizza-dough").first();
  const box = (await dough.boundingBox())!;
  const pt = { x: box.x + 0.35 * box.width, y: box.y + 0.4 * box.height };
  const png = await page.screenshot(); // the WHOLE viewport
  const out = await page.evaluate(
    async ({ data, pt }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const k = img.width / window.innerWidth;
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = Array.from(ctx.getImageData(Math.round(pt.x * k), Math.round(pt.y * k), 1, 1).data.slice(0, 3));
      const s = document.createElement("canvas");
      s.width = 195;
      s.height = Math.round((195 * img.height) / img.width);
      s.getContext("2d")!.drawImage(img, 0, 0, s.width, s.height);
      const brief = (el: Element) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          el: `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 70)}`,
          box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
          disp: cs.display,
          vis: cs.visibility,
          op: cs.opacity,
          filter: cs.filter === "none" ? "none" : cs.filter.slice(0, 36),
          blend: cs.mixBlendMode,
          z: cs.zIndex,
        };
      };
      const stack = document.elementsFromPoint(pt.x, pt.y).slice(0, 14).map(brief);
      const doughEl = document.querySelector(".pizza-dough")!;
      const layers = Array.from(doughEl.querySelectorAll("canvas, .pizza-sauce-layer, .pizza-sauce-oil-sheen")).map((el) => {
        const b = brief(el);
        if (el instanceof HTMLCanvasElement) {
          const d = el.getContext("2d")!.getImageData(0, 0, el.width, el.height).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
          return { ...b, opaquePx: n };
        }
        return b;
      });
      return { px, jpeg: s.toDataURL("image/jpeg", 0.55), stack, layers, anims: document.getAnimations().length, dpr: window.devicePixelRatio };
    },
    { data: png.toString("base64"), pt },
  );
  console.log(`DUMP ${scenario} ${stage} ${JSON.stringify({ tomatoPx: out.px, anims: out.anims, dpr: out.dpr, layers: out.layers, stack: out.stack })}`);
  if (img) console.log(`IMG ${scenario} ${stage} ${out.jpeg}`);
  return out.px as Rgb;
}

async function scenario(page: Page, name: string, mode: "free" | "research", tap: boolean) {
  // Preview builds save under their own key: mirror the seeded save so a Preview-mode server finds it.
  await page.addInitScript(() => {
    const v = localStorage.getItem("teto-pizza-save-v1");
    if (v && !localStorage.getItem("teto-pizza-preview-save-v1")) localStorage.setItem("teto-pizza-preview-save-v1", v);
  });
  if (mode === "free") {
    await openWith(page, 390, 844, base(["tomato-sauce", "pesto", "olive-oil", "mozzarella", "basil"]));
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
  } else {
    await bootResearch(page, 390, 844);
  }
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await page.waitForTimeout(500);
  await paintAt(page, 0.2, 0.5, 0.4);
  const s1 = await snap(page, name, "1-tomato", true);
  const chip = page.getByRole("button", { name: /オリーブオイル/ });
  if (tap) await chip.tap();
  else await chip.click();
  const s2a = await snap(page, name, "2a-oil-selected+0ms");
  await page.waitForTimeout(150);
  const s2b = await snap(page, name, "2b-oil-selected+150ms");
  await page.waitForTimeout(1000);
  const s2c = await snap(page, name, "2c-oil-selected+1150ms", true);
  await paintAt(page, 0.55, 0.8, 0.65);
  const s3 = await snap(page, name, "3-oil-painted", true);
  console.log(`VERDICT ${name} tomatoPx tomato=${s1} sel0=${s2a} sel150=${s2b} sel1150=${s2c} painted=${s3}`);
  expect(true).toBe(true);
}

test("free / mouse click", async ({ page }) => scenario(page, "free-click", "free", false));
test("research / mouse click", async ({ page }) => scenario(page, "research-click", "research", false));
test.describe("touch (DPR 3, hasTouch)", () => {
  test.use({ deviceScaleFactor: 3, isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  test("free / tap", async ({ page }) => scenario(page, "free-tap", "free", true));
  test("research / tap", async ({ page }) => scenario(page, "research-tap", "research", true));
});
