import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * #524 Owner HV: the DEV / Preview-only sauce diagnostic button (src/devtools/SauceDiag.tsx). Runs against the dev server (import.meta.env.DEV is on there, so
 * no Preview env is needed). The production-bundle proof is src/preview/previewIsolation.gate.test.ts.
 */
const OWNED = ["tomato-sauce", "pesto", "olive-oil", "mozzarella", "basil"];

async function toSauce(page: Page) {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(OWNED));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
}

async function paint(page: Page, x0: number, x1: number, y: number) {
  const b = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const a = { x: b.x + x0 * b.width, y: b.y + y * b.height };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) {
    await page.mouse.move(a.x + (x1 - x0) * b.width * (i / 16), a.y);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
}

const pressDiag = (page: Page) => page.getByRole("button", { name: /ソース診断\(DEV\)$/ }).click();
const log = (page: Page) => page.getByTestId("sauce-diag-log");

/** Everything the diagnostic is supposed NOT to touch: canvas pixels, storage, cookie, the app's DOM outside the diagnostic's own box. */
async function pageState(page: Page) {
  return page.evaluate(() => {
    const px = Array.from(document.querySelectorAll(".pizza-dough canvas")).map((c) => {
      const cv = c as HTMLCanvasElement;
      const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
      return n;
    });
    const frame = document.querySelector(".app-frame")!.cloneNode(true) as HTMLElement;
    frame.querySelector(".sauce-diag")?.remove();
    return JSON.stringify({ px, ls: { ...localStorage }, ss: { ...sessionStorage }, ck: document.cookie, dom: frame.outerHTML });
  });
}

test("#524 diag: pressing 診断 shows the data and the canvases, and changes nothing in the page or the network", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await toSauce(page);
  await paint(page, 0.2, 0.5, 0.4);
  await expect(page.getByTestId("sauce-diag")).toBeVisible(); // present before any press
  await expect(log(page)).toBeHidden(); // empty log box takes no room
  const before = await pageState(page);
  page.on("request", (r) => requests.push(r.url()));
  await pressDiag(page);
  await expect(log(page)).toContainText("DATA ids=[tomato-] dep(n/amt) tomato-=");
  const first = (await log(page).textContent())!;
  expect(first).toMatch(/c0 1 px=[1-9]\d* v=v o=1 d=blo f=blur\(3px\)|c0 1 px=[1-9]\d* /);
  expect(await pageState(page), "page unchanged by the press").toBe(before);
  // the oil card: nothing on the pizza changes, and neither does the report's canvas / data side
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await pressDiag(page);
  const rows = ((await log(page).textContent()) ?? "").split("\n");
  const tomatoPx = (t: string) => /c0 1 px=(\d+)/.exec(t)?.[1];
  expect(tomatoPx(rows.join("\n"))).toBeDefined();
  const pxs = rows.filter((r) => r.startsWith(" c0 ")).map((r) => /px=(\d+)/.exec(r)![1]);
  expect(new Set(pxs).size, `tomato canvas px the same after the oil card is selected: ${pxs}`).toBe(1);
  // oil painted elsewhere: two kinds in the data side, two canvases with pixels on the screen side
  await paint(page, 0.55, 0.8, 0.65);
  await pressDiag(page);
  const last = ((await log(page).textContent()) ?? "").split("\n").slice(-5).join("\n");
  expect(last).toMatch(/DATA ids=\[tomato-,olive-o\] dep\(n\/amt\) tomato-=\d+\/[\d.]+ olive-o=\d+\/[\d.]+/);
  expect(last).toMatch(/ c0 tomato px=[1-9]\d* /);
  expect(last).toMatch(/ c1 olive-\* px=[1-9]\d* /);
  expect(requests, "no network request from the diagnostic").toEqual([]);
  expect(errors).toEqual([]);
});

test("#524 diag: a throwing getImageData is shown as ERR and the game keeps working", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await toSauce(page);
  await paint(page, 0.2, 0.5, 0.4);
  await page.evaluate(() => {
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new DOMException("boom", "SecurityError");
    };
  });
  await pressDiag(page);
  await expect(log(page)).toContainText("px=ERR:SecurityError");
  await expect(log(page)).toContainText("DATA ids=[tomato-]");
  await expect(page.getByRole("button", { name: /次へ/ })).toBeVisible();
  expect(errors).toEqual([]);
});

/** Boxes (x, y, w, h) of every visible interactive thing of the game, i.e. everything but the diagnostic itself. */
async function interactiveBoxes(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a[href], input, select, textarea, [role='button'], .pizza-dough--interactive"))
      .filter((el) => !el.closest(".sauce-diag") && !el.closest(".preview-badge"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { name: `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 30)} ${(el.textContent ?? "").trim().slice(0, 8)}`, x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(el).visibility !== "hidden" && r.width > 0 && r.height > 0 };
      })
      .filter((b) => b.vis),
  );
}
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("#524 diag: the button and a full log box overlap no control, nor the pizza (SAUCE step)", async ({ page }) => {
  await toSauce(page);
  await paint(page, 0.2, 0.5, 0.4);
  for (let i = 0; i < 6; i++) await pressDiag(page); // a full log box
  const diag = await page.evaluate(() => {
    const r = (s: string) => {
      const e = document.querySelector(s)!.getBoundingClientRect();
      return { x: e.x, y: e.y, w: e.width, h: e.height };
    };
    return { buttons: Array.from(document.querySelectorAll(".sauce-diag__btn")).map((e) => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }), log: r(".sauce-diag__log"), dough: r(".pizza-dough"), vw: window.innerWidth, vh: window.innerHeight };
  });
  const boxes = await interactiveBoxes(page);
  const clashes: string[] = [];
  for (const mine of [...diag.buttons, diag.log]) {
    expect(mine.x).toBeGreaterThanOrEqual(0);
    expect(mine.x + mine.w).toBeLessThanOrEqual(diag.vw + 0.5);
    expect(mine.y + mine.h).toBeLessThanOrEqual(diag.vh + 0.5);
    for (const b of boxes) if (overlaps(mine, b)) clashes.push(`${b.name} @${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)} vs ${Math.round(mine.x)},${Math.round(mine.y)} ${Math.round(mine.w)}x${Math.round(mine.h)}`);
  }
  expect(clashes, `no control under the diagnostic: ${clashes.join(" | ")}`).toEqual([]);
  expect(overlaps(diag.log, diag.dough), `the log box does not cover the pizza: log ${JSON.stringify(diag.log)} dough ${JSON.stringify(diag.dough)}`).toBe(false);
  const bar = diag.buttons[0];
  expect(overlaps(bar, diag.dough), "the buttons do not cover the pizza").toBe(false);
  console.log(`LAYOUT ${page.viewportSize()!.width}x${page.viewportSize()!.height} ${JSON.stringify(diag)}`);
});

test("#524 diag: also clear of the controls on the CHEESE and TOPPING steps", async ({ page }) => {
  await toSauce(page);
  await paint(page, 0.2, 0.5, 0.4);
  const report: string[] = [];
  for (const step of ["CHEESE", "TOPPING"]) {
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.waitForTimeout(400);
    for (let i = 0; i < 6; i++) await pressDiag(page);
    const mine = await page.evaluate(() => Array.from(document.querySelectorAll(".sauce-diag__btn, .sauce-diag__log")).map((e) => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }));
    const boxes = await interactiveBoxes(page);
    for (const m of mine) for (const b of boxes) if (overlaps(m, b)) report.push(`${step}: ${b.name} ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}`);
  }
  expect(report, report.join(" | ")).toEqual([]);
});
