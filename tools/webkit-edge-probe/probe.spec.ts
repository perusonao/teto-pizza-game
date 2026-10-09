import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
} from "../../e2e/gestures";

/**
 * Probe: two close cuts + one crossing cut, then RESULT. For each case: screenshots of the CUT step and the RESULT
 * pizza, DOM geometry, and "layer experiments" (the same RESULT pizza re-screenshotted with one suspect layer
 * disabled by an injected style) so the layer that clips the right edge can be named. Analysis is offline
 * (analyze.py reads PROBE_OUT). Nothing here changes product code.
 */
const OUT = process.env.PROBE_OUT ?? "probe-out";

type Cut = readonly [angleDeg: number, offset: number];
interface Case {
  readonly name: string;
  readonly stretch: number | null; // null = the usual completeDoughStep; a number = drag every direction out to that radius (dough units)
  readonly cuts: readonly Cut[];
}

/** signed offset of the line through (px,py) with direction angDeg, in dragLine's convention */
function offsetThrough(angDeg: number, px: number, py: number): number {
  const a = (angDeg * Math.PI) / 180;
  return (px - 50) * -Math.sin(a) + (py - 50) * Math.cos(a);
}

const CASES: readonly Case[] = [
  { name: "pairVertRight_cross", stretch: null, cuts: [[90, -26], [90, -27], [0, 5]] },
  { name: "pairVertRight_cross_stretch49", stretch: 49.4, cuts: [[90, -26], [90, -27], [0, 5]] },
  { name: "pairVertRightRim_cross_stretch49", stretch: 49.4, cuts: [[90, -44], [90, -45], [20, offsetThrough(20, 94, 60)]] },
  { name: "pairVertLeft_cross_stretch49", stretch: 49.4, cuts: [[90, 26], [90, 27], [0, 5]] },
  { name: "pairHoriz_cross_stretch49", stretch: 49.4, cuts: [[0, 20], [0, 21], [90, -10]] },
  { name: "pairDiag_cross", stretch: null, cuts: [[60, 15], [60, 16.2], [150, 0]] },
  { name: "control_three_through_center", stretch: null, cuts: [[0, 0], [60, 0], [120, 0]] },
  { name: "control_three_stretch49", stretch: 49.4, cuts: [[0, 0], [60, 0], [120, 0]] },
];

const DOUGH = ".pizza-dough";

async function toCutStep(page: Page, stretch: number | null) {
  await startFreshMargherita(page);
  if (stretch === null) {
    await completeDoughStep(page);
  } else {
    const box = await page.locator(DOUGH).boundingBox();
    if (!box) throw new Error("no dough box");
    const u = box.width / 100;
    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < 16; i += 1) {
        const ang = (i / 16) * Math.PI * 2;
        const at = (r: number) => ({ x: box.x + (50 + Math.cos(ang) * r) * u, y: box.y + (50 + Math.sin(ang) * r) * u });
        const from = at(30);
        const to = at(stretch);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 8 });
        await page.mouse.up();
      }
    }
  }
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
  await bakeToTarget(page, { start: 60, end: 80 });
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
}

/** A straight drag across the dough along angleDeg, shifted offset units sideways, from just outside the rim to just outside the rim. */
async function dragLine(page: Page, angleDeg: number, offset: number) {
  const box = await page.locator(DOUGH).boundingBox();
  if (!box) throw new Error("no dough box");
  const u = box.width / 100;
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const nx = -dy * offset;
  const ny = dx * offset;
  const reach = 49.4;
  const at = (t: number) => ({ x: box.x + (50 + nx + dx * t) * u, y: box.y + (50 + ny + dy * t) * u });
  const from = at(-reach);
  const to = at(reach);
  await expect
    .poll(() => page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".pizza-dough--interactive"), from))
    .toBe(true);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

/** Each experiment disables one suspect layer on the RESULT pizza; "asis" is the unmodified page. */
const EXPERIMENTS: ReadonlyArray<readonly [string, string]> = [
  ["asis", ""],
  ["no-filter", ".pizza-pieces{filter:none !important}"],
  // "filter-shadow-only" / "filter-url-only" are filled in at run time from the page's real `filter` value.
  ["no-clip-path", ".pizza-piece-clip{clip-path:none !important}"],
  ["no-piece-transform", ".pizza-piece{transform:none !important}"],
  ["overflow-visible", ".pizza-dough,.pizza-stage,.pizza-pieces,.app-frame,.game-screen{overflow:visible !important}"],
];

for (const c of CASES) {
  test(`probe ${c.name}`, async ({ page }, info) => {
    test.setTimeout(150_000);
    const dir = path.join(OUT, info.project.name, c.name);
    fs.mkdirSync(dir, { recursive: true });
    await toCutStep(page, c.stretch);
    await page.locator(DOUGH).first().screenshot({ path: path.join(dir, "00-cut-before.png") });
    for (const [ang, off] of c.cuts) await dragLine(page, ang, off);
    await expect(page.locator(".pizza-cut-mark")).toHaveCount(c.cuts.length);
    await page.mouse.move(2, 2);
    await page.locator(DOUGH).first().screenshot({ path: path.join(dir, "01-cut-after.png") });
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await expect(page.locator(".result-panel")).toBeVisible();
    await expect.poll(() => page.locator(".pizza-piece").count()).toBeGreaterThan(0);

    const geometry = await page.evaluate(() => {
      const r = (el: Element | null) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2), r: +(b.x + b.width).toFixed(2) };
      };
      const dough = document.querySelector(".pizza-dough");
      const pieces = document.querySelector(".pizza-pieces");
      const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
      return {
        dpr: window.devicePixelRatio,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        dough: r(dough),
        pieces: r(pieces),
        eachPiece: [...document.querySelectorAll(".pizza-piece")].map((p) => r(p)),
        eachBody: [...document.querySelectorAll(".pizza-piece-body")].map((p) => r(p)),
        piecesFilter: cs(pieces)?.filter ?? null,
        piecesOverflow: cs(pieces)?.overflow ?? null,
        doughOverflow: cs(dough)?.overflow ?? null,
        doughBorder: cs(dough)?.borderLeftWidth ?? null,
        clipPaths: [...document.querySelectorAll(".pizza-piece-clip")].slice(0, 4).map((el) => (el as HTMLElement).style.clipPath.slice(0, 160)),
        pieceCount: document.querySelectorAll(".pizza-piece").length,
        ua: navigator.userAgent,
      };
    });
    fs.writeFileSync(path.join(dir, "geometry.json"), JSON.stringify(geometry, null, 2));
    await page.screenshot({ path: path.join(dir, "02-result-fullpage.png") });

    const originalFilter = String(geometry.piecesFilter ?? "");
    const urlToken = originalFilter.match(/url\([^)]*\)/)?.[0] ?? "none";
    const shadowToken = originalFilter.replace(urlToken, "").trim() || "none";
    const experiments: ReadonlyArray<readonly [string, string]> = [
      ...EXPERIMENTS,
      ["filter-url-only", `.pizza-pieces{filter:${urlToken} !important}`],
      ["filter-shadow-only", `.pizza-pieces{filter:${shadowToken} !important}`],
    ];
    for (const [name, css] of experiments) {
      const handle = css ? await page.addStyleTag({ content: css }) : null;
      await page.waitForTimeout(150); // let the layer repaint before the screenshot (diagnostic only, not an assertion)
      await page.locator(DOUGH).first().screenshot({ path: path.join(dir, `10-result-${name}.png`) });
      await handle?.evaluate((el) => el.remove());
    }
  });
}
