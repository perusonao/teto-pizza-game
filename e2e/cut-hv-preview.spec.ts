import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * CUT-S2 Owner HV page (Issue #288, src/preview/CutHvPage.tsx): real-browser check at 390x844 and
 * 360x800 that the Preview-only page opens only on `?cuthv=1`, takes real pointer cuts, shows both
 * CutQuality values plus the current cutScore, fits the screen, records the 11-trial procedure and
 * survives a reload. (Runs against the dev server, where `import.meta.env.DEV` enables the page; the
 * production exclusion is pinned by src/preview/cutHvIsolation.gate.test.ts.)
 */
const SHOTS = "docs/reports/screenshots/cut-s2-hv";

async function cut(page: Page, angles: number[], wobblePx = 0) {
  const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
  if (!box) throw new Error("no dough");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.44;
  for (const deg of angles) {
    const a = (deg * Math.PI) / 180;
    await page.mouse.move(cx - Math.cos(a) * r + wobblePx, cy - Math.sin(a) * r);
    await page.mouse.down();
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r + wobblePx, { steps: 10 });
    await page.mouse.up();
  }
}

async function noOverflow(page: Page) {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
  }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  return m;
}

test.describe("CUT HV Preview page", () => {
  test("without ?cuthv=1 the normal app opens; other values stay closed", async ({ page }) => {
    for (const q of ["", "?cuthv=0", "?cuthv=true"]) {
      await page.goto(`/${q}`);
      await page.waitForSelector(".app-frame");
      await expect(page.getByTestId("cut-hv-page")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /ピザを作る/ })).toBeVisible();
    }
  });

  test("full procedure: 11 trials, both Q values, fits the screen, survives reload", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const vp = page.viewportSize()!;
    const tag = `${vp.width}x${vp.height}`;
    mkdirSync(SHOTS, { recursive: true });
    await page.goto("/?cuthv=1");
    await expect(page.getByTestId("cut-hv-page")).toBeVisible();
    await expect(page.getByTestId("cut-hv-instruction")).toContainText("丁寧");
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeDisabled();

    await cut(page, [0, 60, 120]);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    const cutting = await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/${tag}-cutting.png` });
    await page.getByRole("button", { name: /切り終わる/ }).click();

    await expect(page.getByTestId("cut-hv-metrics")).toBeVisible();
    const q06 = Number(await page.getByTestId("q06").innerText());
    const q04 = Number(await page.getByTestId("q04").innerText());
    expect(q06).toBeGreaterThan(0.9);
    expect(q04).toBeLessThanOrEqual(q06);
    await expect(page.getByTestId("cut-score")).toHaveText(/^\d+$/);
    for (const label of ["center", "validity", "count", "uniformity", "現行 cutScore"]) {
      await expect(page.getByTestId("cut-hv-metrics")).toContainText(label);
    }
    const rating = await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/${tag}-rating.png` });
    // Report the scroll height so a too-tall panel shows up in the log instead of hiding.
    testInfo.annotations.push({ type: "layout", description: `${tag}: cutting scrollH=${cutting.sh}/${cutting.ih}, rating scrollH=${rating.sh}/${rating.ih}` });
    expect(cutting.sh).toBeLessThanOrEqual(cutting.ih);
    expect(rating.sh).toBeLessThanOrEqual(rating.ih);

    // Every rating button is tappable (inside the viewport, >= 44px tall).
    for (const name of ["丁寧", "普通", "雑"]) {
      const b = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(b && b.y + b.height <= vp.height && b.height >= 44).toBeTruthy();
    }
    await page.getByRole("button", { name: "丁寧", exact: true }).click();
    await expect(page.getByTestId("cut-hv-instruction")).toContainText("丁寧");
    await expect(page.locator(".pizza-cut-line")).toHaveCount(0);

    // Reload keeps the recorded trial (Preview-only key) and resumes at trial 2.
    await page.reload();
    await expect(page.getByTestId("cut-hv-page")).toContainText("2 / 11");

    for (let i = 1; i < 11; i++) {
      await cut(page, [0, 60, 120], i > 7 ? 14 : i > 2 ? 4 : 0);
      await page.getByRole("button", { name: /切り終わる/ }).click();
      await page.getByRole("button", { name: "普通", exact: true }).click();
    }
    await expect(page.getByTestId("cut-hv-final")).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/${tag}-final.png`, fullPage: true });
    const text = await page.getByLabel("結果テキスト").inputValue();
    expect(text.split("\n")).toHaveLength(13);
    expect(text).toContain(`${vp.width}x${vp.height}`);

    // The game save is never touched by this page.
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((k) => k.startsWith("teto-pizza-save"))).toEqual([]);
    expect(keys).toContain("teto-pizza-preview-cuthv-v1");
  });
});
