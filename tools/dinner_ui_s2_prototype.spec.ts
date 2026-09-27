import { expect, test, type Page } from "@playwright/test";
import { DM_A, dinnerSave, openDinnerDetail, openWithSave } from "./support/dinner";

/**
 * Dinner UI S-UI-2 Implementation Gate: prototype measurement of the target-row variants
 * (read-only tool; not part of the suite, and not a CSS change -- each variant is a <style> tag
 * injected into the running page, then removed). Copy to e2e/ of a main checkout (51e0923 or later):
 *   DUI_OUT=<dir> npx playwright test e2e/dinner_ui_s2_prototype.spec.ts --project=iphone-390x844
 * Per viewport and variant it records the bar height, chip size, thumbnail, the dough's visible
 * diameter (the Layout Contract LC-S measure: the [data-pizza-drop-target] width) and how many of
 * the 25 recipe names fit the chip without truncation, plus a screenshot.
 */

const OUT = process.env.DUI_OUT ?? "dui-s2";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 390, height: 664 },
  { width: 360, height: 800 },
  { width: 360, height: 640 },
];
const NAMES = [
  "ニューヘイブンアピッツァ", "ピッツァ・ポルトゲーザ", "クアトロ フォルマッジ", "ペストカプレーゼピザ",
  "ブレックファストピザ", "トンノ・エ・チポッラ", "ペストパターテピザ", "ピッツァ・ビアンカ", "パルミジャーナピザ",
  "メランザーネピザ", "ミートラヴァーズ", "ペストトンノピザ", "ハワイアンピザ", "カプリチョーザ", "マルゲリータ",
  "プッタネスカ", "ジェノベーゼ", "サルシッチャ", "マリナーラ", "ビスマルク", "バンビーノ", "ペパロニ", "フガッサ",
  "フンギ", "ナポリ",
];
const TWO_LINE = `.dinner-chip__name{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.1;overflow:hidden;text-overflow:ellipsis;text-align:center}`;
const VARIANTS: Record<string, string> = {
  "V0-current": "",
  "V1-2line-10px": TWO_LINE,
  "V2-2line-9px-thumb26": `${TWO_LINE}.dinner-chip__name{font-size:9px}.dinner-chip{padding:2px}.dinner-chip__thumb .reference-thumbnail{width:26px;height:26px;--piece-scale:0.14}`,
  "V3-2line-9px-thumb24": `${TWO_LINE}.dinner-chip__name{font-size:9px}.dinner-chip{padding:2px}.dinner-chip__thumb .reference-thumbnail{width:24px;height:24px;--piece-scale:0.13}`,
  "A1-magnifier-badge": `.dinner-chip__thumb::after{content:"🔍";position:absolute;right:-7px;bottom:-5px;font-size:11px;line-height:1}`,
  "A1b-magnifier-top-left": `.dinner-chip__thumb::before{content:"🔍";position:absolute;left:-8px;top:-4px;font-size:10px;line-height:1;z-index:1}`,
  "A2-flat-outline": `.dinner-chip{background:transparent;border:1.5px dashed rgba(255,248,234,.7);color:#fff9ec}.dinner-chip--done{background:rgba(227,241,221,.18)}`,
  "A3-row-label": `.dinner-bar__targets::before{content:"見本";writing-mode:vertical-rl;font-size:10px;font-weight:800;color:#d9d2ff;align-self:center;flex:0 0 auto}`,
  "V4-2line-9px-thumb20": `${TWO_LINE}.dinner-chip__name{font-size:9px;line-height:1.05}.dinner-chip{padding:2px}.dinner-chip__thumb .reference-thumbnail{width:20px;height:20px;--piece-scale:0.11}`,
  // Hybrid: 2 lines (V3) only where the stage is capped (height > 700px); short heights keep today's row.
  "V5-hybrid-V3-tall-only": `@media (min-height:701px){${TWO_LINE}.dinner-chip__name{font-size:9px}.dinner-chip{padding:2px}.dinner-chip__thumb .reference-thumbnail{width:24px;height:24px;--piece-scale:0.13}}`,
  // V6: V3 above the existing 700px breakpoint, V4 at or below it (the row's own @media split).
  "V6-V3-tall+V4-short": `${TWO_LINE}.dinner-chip__name{font-size:9px}.dinner-chip{padding:2px}.dinner-chip__thumb .reference-thumbnail{width:24px;height:24px;--piece-scale:0.13}@media (max-height:700px){.dinner-chip__name{line-height:1.05}.dinner-chip__thumb .reference-thumbnail{width:20px;height:20px;--piece-scale:0.11}}`,
  "V2+A1": "",
  "V6+A1": "",
  "V6+A1b": "",
};
VARIANTS["V2+A1"] = VARIANTS["V2-2line-9px-thumb26"] + VARIANTS["A1-magnifier-badge"];
VARIANTS["V6+A1"] = VARIANTS["V6-V3-tall+V4-short"] + VARIANTS["A1-magnifier-badge"];
VARIANTS["V6+A1b"] = VARIANTS["V6-V3-tall+V4-short"] + VARIANTS["A1b-magnifier-top-left"];

async function measure(page: Page) {
  return page.evaluate((names) => {
    const rect = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10, bottom: Math.round(b.bottom) };
    };
    const chip = document.querySelector<HTMLElement>(".dinner-chip");
    const name = chip?.querySelector<HTMLElement>(".dinner-chip__name");
    const fits: { name: string; fits: boolean }[] = [];
    if (name) {
      const before = name.textContent;
      for (const n of names) {
        name.textContent = n;
        fits.push({ name: n, fits: name.scrollHeight <= name.clientHeight + 1 && name.scrollWidth <= name.clientWidth + 1 });
      }
      name.textContent = before;
    }
    const truncatedNow = [...document.querySelectorAll<HTMLElement>(".dinner-chip__name")].filter(
      (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
    ).length;
    return {
      bar: rect(".dinner-bar"),
      chip: rect(".dinner-chip"),
      thumb: rect(".dinner-chip .reference-thumbnail"),
      nameFontPx: name ? getComputedStyle(name).fontSize : null,
      dough: rect('[data-pizza-drop-target="true"]'),
      dmaTruncated: truncatedNow,
      namesFitting: fits.filter((f) => f.fits).length,
      namesNotFitting: fits.filter((f) => !f.fits).map((f) => f.name),
      pageScrollX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, NAMES);
}

for (const vp of VIEWPORTS) {
  test(`${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(vp);
    await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=900&dinnerMinStars=3");
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await expect(page.getByTestId("dinner-target-row")).toBeVisible();
    const results: Record<string, unknown> = {};
    for (const [id, css] of Object.entries(VARIANTS)) {
      await page.evaluate((c) => {
        document.getElementById("dui-proto")?.remove();
        if (!c) return;
        const s = document.createElement("style");
        s.id = "dui-proto";
        s.textContent = c;
        document.head.appendChild(s);
      }, css);
      await page.waitForTimeout(150);
      results[id] = await measure(page);
      await page.locator(".dinner-bar").screenshot({ path: `${OUT}/${vp.width}x${vp.height}-${id}.png` });
    }
    // BAKE: the bar stays on screen, so the BAKE dough (OD-R8: BAKE / CUT sizes unchanged) is re-measured.
    await page.evaluate(() => document.getElementById("dui-proto")?.remove());
    await page.getByRole("button", { name: /生地/ }).first().isVisible();
    const { completeDoughStep } = await import("./gestures");
    await completeDoughStep(page);
    while (await page.getByRole("button", { name: /次へ/ }).count()) await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /焼く/ }).click();
    await page.waitForSelector(".bake-gauge__needle");
    const bake: Record<string, unknown> = {};
    for (const id of ["V0-current", "V2-2line-9px-thumb26", "V3-2line-9px-thumb24", "V4-2line-9px-thumb20", "V5-hybrid-V3-tall-only", "V6-V3-tall+V4-short", "V6+A1", "V6+A1b"]) {
      await page.evaluate((c) => {
        document.getElementById("dui-proto")?.remove();
        if (!c) return;
        const st = document.createElement("style");
        st.id = "dui-proto";
        st.textContent = c;
        document.head.appendChild(st);
      }, VARIANTS[id]);
      await page.waitForTimeout(150);
      bake[id] = await page.evaluate(() => {
        const d = document.querySelector('[data-pizza-drop-target="true"]')?.getBoundingClientRect();
        const b = document.querySelector(".dinner-bar")?.getBoundingClientRect();
        return { dough: d ? Math.round(d.width * 10) / 10 : null, bar: b ? Math.round(b.height * 10) / 10 : null };
      });
    }
    results.BAKE = bake;
    const fs = await import("node:fs");
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(`${OUT}/${vp.width}x${vp.height}.json`, JSON.stringify({ viewport: vp, results }, null, 2));
  });
}
