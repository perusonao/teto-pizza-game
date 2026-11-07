// FOLD+SEAL Lab (Issue #773 T6-F2) Chromium check, DEV only. Starts the Vite dev server itself, drives foldseal-lab.html with REAL touch events (CDP
// Input.dispatchTouchEvent) at 390x844 and 360x800, asserts the layout / state-machine / contact-guard behaviour and writes screenshots + results.json.
// Usage: [CHROMIUM_PATH=/path/to/chrome] node tools/foldSealLabChromium.mjs [outDir]     (default docs/reports/screenshots/fold-seal-f2)
// This is Chromium emulation, NOT iPhone Safari: it proves nothing about a real finger, WebKit or iOS gestures.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.resolve(process.argv[2] ?? path.join(root, "docs/reports/screenshots/fold-seal-f2"));
mkdirSync(out, { recursive: true });

const server = await createServer({ root, logLevel: "error", server: { host: "127.0.0.1", port: 0, strictPort: false } });
await server.listen();
const port = server.httpServer.address().port;
const url = `http://127.0.0.1:${port}/teto-pizza-game/foldseal-lab.html`;

// CHROMIUM_PATH: use a pre-installed Chromium when the pinned Playwright browser build is not installed (no `playwright install` is run).
// (the next button uses aria-disabled, not disabled, so a click always reaches the guard; `force` skips Playwright's actionability wait on aria-disabled)
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = { url, date: new Date().toISOString(), note: "Chromium emulation only (not iPhone Safari / WebKit)", viewports: {} };
let failed = 0;

for (const [w, h] of [[390, 844], [360, 800]]) {
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, detail });
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${w}x${h} ${name}${detail === undefined ? "" : ` (${JSON.stringify(detail)})`}`);
  };
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  const cdp = await context.newCDPSession(page);
  const shot = async (n, name) => page.screenshot({ path: path.join(out, `${w}x${h}-${String(n).padStart(2, "0")}-${name}.png`) });
  const stage = async () => page.getByTestId("fsl-stage").boundingBox();
  const pt = async (bx, by) => {
    const b = await stage();
    return { x: b.x + (bx / 100) * b.width, y: b.y + (by / 100) * b.height };
  };
  const touch = async (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id: p.id ?? id })) });
  const attr = async (n) => page.getByTestId("fsl-root").getAttribute(n);
  const phase = () => attr("data-phase");
  const sealed = async () => page.evaluate(() => document.querySelectorAll('[data-testid^="seam-bin-"][data-sealed="1"]').length);
  const seam = (phi) => [50 + 48 * Math.cos(Math.PI - phi), 50 + 48 * Math.sin(Math.PI - phi)];
  const load = async () => {
    await page.goto(url);
    await page.getByTestId("fsl-root").waitFor();
  };
  const fold = async () => {
    const a = await pt(50, 20);
    await touch("touchStart", [a]);
    for (const y of [30, 45, 60, 75, 82]) await touch("touchMove", [await pt(50, y)]);
    await touch("touchEnd", []);
  };

  await load();
  // 1. layout
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
  check("no horizontal scroll", m.sw <= m.iw, m);
  check("whole lab fits one screen (no vertical scroll)", m.sh <= m.ih, m);
  const boxes = await page.$$eval("button", (bs) => bs.map((b) => ({ t: b.textContent, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
  check("every button is at least 44x44 css px", boxes.every((b) => b.w >= 44 && b.h >= 44), boxes.filter((b) => b.w < 44 || b.h < 44));
  const sb = await stage();
  check("stage is square and inside the viewport", Math.abs(sb.width - sb.height) < 1 && sb.x >= 0 && sb.x + sb.width <= w && sb.y >= 0 && sb.y + sb.height <= h, sb);
  await shot(1, "initial");

  // 2. drag fold with real touch
  {
    const a = await pt(50, 20);
    await touch("touchStart", [a]);
    check("touch on the lid starts folding", (await phase()) === "folding");
    await touch("touchMove", [await pt(50, 50)]);
    const mid = Number(await attr("data-fold-angle"));
    check("finger on the fold line = ~90deg", Math.abs(mid - Math.PI / 2) < 0.1, mid);
    await shot(2, "folding-mid");
    await touch("touchMove", [await pt(50, 82)]);
    check("still folding until release", (await phase()) === "folding");
    await shot(3, "folding-full-held");
    check("contact is tracked while down", (await attr("data-contacts")) === "1");
    await touch("touchEnd", []);
    check("release past the threshold commits the fold", (await phase()) === "folded");
    check("contact released", (await attr("data-contacts")) === "0");
    await page.waitForTimeout(500);
    await shot(4, "folded");
  }

  // 3. seal by real strokes: partial, then full
  {
    const [x0, y0] = seam(0.1);
    await touch("touchStart", [await pt(x0, y0)]);
    check("touch on the seam starts sealing", (await phase()) === "sealing");
    for (let phi = 0.2; phi <= 1.3; phi += 0.1) await touch("touchMove", [await pt(...seam(phi))]);
    // contact guard while sealing: step is complete, a finger is down
    await page.getByTestId("btn-next").click({ force: true });
    check("next is blocked while the seal finger is down (sealing)", (await attr("data-advanced")) === "0");
    await touch("touchEnd", []);
    const part = await sealed();
    check("partial stroke seals some, not all, segments", part > 5 && part < 36, part);
    await shot(5, "seal-partial");
    const [x1, y1] = seam(1.6);
    await touch("touchStart", [await pt(x1, y1)]);
    await touch("touchEnd", []);
    const [x2, y2] = seam(0.02);
    await touch("touchStart", [await pt(x2, y2)]);
    for (let phi = 0.1; phi < Math.PI; phi += 0.06) await touch("touchMove", [await pt(...seam(Math.min(phi, Math.PI - 0.001)))]);
    await touch("touchEnd", []);
    check("a full stroke seals all 36 segments", (await sealed()) === 36, await sealed());
    await shot(6, "seal-full");
  }

  // 4. contact guard with a held finger on the stage while the (mouse) pointer clicks next
  {
    await load();
    await fold();
    check("folded again", (await phase()) === "folded");
    await touch("touchStart", [await pt(50, 50)]); // off-band: ignored by the machine, but a finger is in contact
    check("off-band touch leaves the phase `folded`", (await phase()) === "folded");
    check("...yet the contact is tracked", (await attr("data-contacts")) === "1");
    await page.getByTestId("btn-next").click({ force: true });
    check("next is blocked by contact, not by phase", (await attr("data-advanced")) === "0");
    await touch("touchEnd", []);
    await page.getByTestId("btn-next").click({ force: true });
    check("next works once nothing is in contact", (await attr("data-advanced")) === "1");
    await shot(7, "advanced-after-release");
  }

  // 5. short drag springs back; touchCancel
  {
    await load();
    await touch("touchStart", [await pt(50, 20)]);
    await touch("touchMove", [await pt(50, 40)]);
    await touch("touchEnd", []);
    check("short drag springs back to idle", (await phase()) === "idle" && Number(await attr("data-fold-angle")) === 0);
    await touch("touchStart", [await pt(50, 20)]);
    await touch("touchMove", [await pt(50, 70)]);
    await touch("touchCancel", []);
    check("touchcancel cancels the fold and releases contact", (await phase()) === "idle" && (await attr("data-contacts")) === "0");
  }

  // 6. buttons only
  {
    await load();
    await page.getByTestId("btn-fold").click();
    check("折る button folds", (await phase()) === "folded");
    for (let i = 0; i < 4; i += 1) await page.getByTestId("btn-seal").click();
    check("とじる x4 seals all 36 segments", (await sealed()) === 36);
    await page.waitForTimeout(500);
    await shot(8, "buttons-sealed");
    await page.getByTestId("btn-next").click({ force: true });
    check("next after the button path", (await attr("data-advanced")) === "1");
    await page.getByTestId("btn-upstream").click();
    check("前の工程を変える discards everything", (await phase()) === "idle" && (await sealed()) === 0 && (await attr("data-advanced")) === "0");
  }

  // 7. insufficient seal is visual only
  {
    await load();
    await fold();
    const [xa, ya] = seam(0.05);
    await touch("touchStart", [await pt(xa, ya)]);
    for (let phi = 0.1; phi <= 0.8; phi += 0.1) await touch("touchMove", [await pt(...seam(phi))]);
    await touch("touchEnd", []);
    const gaps = await page.evaluate(() => document.querySelectorAll('[data-testid^="seam-bin-"][data-gap="1"]').length);
    check("an unsealed run is drawn as a gap", gaps > 0, gaps);
    await page.getByTestId("btn-next").click({ force: true });
    check("insufficient seal never blocks the step", (await attr("data-advanced")) === "1");
    await shot(9, "seal-gap-visual");
  }

  // 8. reduced motion
  {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const d = await page.getByTestId("fsl-lid").evaluate((el) => getComputedStyle(el).transitionDuration);
    check("prefers-reduced-motion removes the lid transition", d === "0s", d);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }

  check("no page errors / console errors", errors.length === 0, errors);
  results.viewports[`${w}x${h}`] = { checks };
  await context.close();
}

await browser.close();
await server.close();
results.failed = failed;
writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
console.log(failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
