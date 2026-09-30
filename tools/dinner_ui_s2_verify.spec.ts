import { expect, test, type Page } from "@playwright/test";
import { cookDinnerPizza, DM_A, dinnerSave, nextDinnerPizza, openDinnerDetail, openWithSave } from "./support/dinner";
import { completeDoughStep, cutThreeLines, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * S-UI-2 verification (read-only tool; not part of the suite). Copy to e2e/ of a checkout and run
 *   DUI_OUT=<dir> npx playwright test e2e/dinner_ui_s2_verify.spec.ts --project=iphone-390x844
 * on both the baseline (origin/main) and the change, then compare <dir>/<w>x<h>.json:
 *   - dough diameter ([data-pizza-drop-target] width, the Layout Contract LC-S measure) in PREPARE,
 *     BAKE and CUT, and the bar height;
 *   - every chip: 🔍 / ✓ / name / thumbnail boxes and whether any two overlap;
 *   - all 25 recipe names in a chip: fully shown, and in at most 2 lines;
 *   - no horizontal page overflow.
 */

const OUT = process.env.DUI_OUT ?? "dui-verify";
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

const dough = (page: Page) =>
  page.evaluate(() => {
    const d = document.querySelector('[data-pizza-drop-target="true"]')?.getBoundingClientRect();
    const b = document.querySelector(".dinner-bar")?.getBoundingClientRect();
    return { dough: d ? Math.round(d.width * 10) / 10 : null, bar: b ? Math.round(b.height * 10) / 10 : null };
  });

async function chips(page: Page) {
  return page.evaluate((names) => {
    type Box = { l: number; t: number; r: number; b: number };
    const box = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    };
    // Ink box of a text element (the glyphs, not the line box), via a Range.
    const ink = (el: Element | null): Box | null => {
      if (!el || !el.firstChild) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    };
    const overlap = (a: Box | null, b: Box | null) =>
      !!a && !!b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
    const perChip = [...document.querySelectorAll(".dinner-chip")].map((chip) => {
      const lens = ink(chip.querySelector(".dinner-chip__lens"));
      const check = box(chip.querySelector(".dinner-chip__check"));
      const name = ink(chip.querySelector(".dinner-chip__name"));
      const thumb = box(chip.querySelector(".reference-thumbnail"));
      const chipBox = box(chip);
      return {
        label: chip.getAttribute("aria-label"),
        hasLens: !!lens,
        hasCheck: !!check,
        thumbPx: thumb ? Math.round(thumb.r - thumb.l) : null,
        lensOverName: overlap(lens, name),
        lensOverCheck: overlap(lens, check),
        checkOverName: overlap(check, name),
        nameOverThumb: overlap(name, thumb),
        lensOverThumb: overlap(lens, thumb),
        lensInsideChip: !!lens && !!chipBox && lens.l >= chipBox.l - 0.5 && lens.t >= chipBox.t - 0.5,
        // The chip list scrolls sideways (overflow-x: auto), which also clips vertically: the 🔍
        // must sit inside the list's box to be fully visible.
        lensClipped: (() => {
          const list = box(chip.closest(".dinner-bar__targets"));
          return !lens || !list || lens.t < list.t - 0.5 || lens.l < list.l - 0.5 || lens.b > list.b + 0.5;
        })(),
        lensTopVsChip: lens && chipBox ? Math.round((lens.t - chipBox.t) * 10) / 10 : null,
      };
    });
    const nameEl = document.querySelector<HTMLElement>(".dinner-chip__name");
    const fits: { name: string; full: boolean; lines: number }[] = [];
    if (nameEl) {
      const before = nameEl.textContent;
      const lh = parseFloat(getComputedStyle(nameEl).lineHeight);
      for (const n of names) {
        nameEl.textContent = n;
        const range = document.createRange();
        range.selectNodeContents(nameEl);
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        fits.push({ name: n, full: nameEl.scrollHeight <= nameEl.clientHeight + 1 && nameEl.scrollWidth <= nameEl.clientWidth + 1, lines: Math.max(lines, Math.round(nameEl.clientHeight / lh)) });
      }
      nameEl.textContent = before;
    }
    return {
      perChip,
      nameFontPx: nameEl ? getComputedStyle(nameEl).fontSize : null,
      namesFull: fits.filter((f) => f.full).length,
      maxLines: Math.max(...fits.map((f) => f.lines)),
      notFull: fits.filter((f) => !f.full).map((f) => f.name),
      pageScrollX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, NAMES);
}

async function prepareMargherita(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 55);
  await tapDoughPercent(page, 55, 45);
}

for (const vp of VIEWPORTS) {
  test(`${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(vp);
    const tag = `${vp.width}x${vp.height}`;
    await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=900&dinnerMinStars=1");
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await expect(page.getByTestId("dinner-target-row")).toBeVisible();
    const out: Record<string, unknown> = { viewport: vp, prepare: await dough(page), chipsFresh: await chips(page) };
    await page.locator(".dinner-bar").screenshot({ path: `${OUT}/${tag}-row.png` });
    // A 見本 tap: the popover opens and nothing is selected.
    await page.getByTestId("dinner-chip-breakfast-pizza").click();
    const popover = page.getByRole("dialog", { name: /ブレックファストピザの見本/ });
    await expect(popover).toBeVisible();
    await page.screenshot({ path: `${OUT}/${tag}-popover.png` });
    await popover.getByRole("button", { name: /閉じる/ }).click();
    // One target done, so ✓ shows next to 🔍.
    await cookDinnerPizza(page, "funghi");
    await nextDinnerPizza(page);
    out.chipsDone = await chips(page);
    await page.locator(".dinner-bar").screenshot({ path: `${OUT}/${tag}-row-done.png` });
    await page.screenshot({ path: `${OUT}/${tag}-prepare.png` });
    // BAKE and CUT diameters on a margherita (in band).
    await prepareMargherita(page);
    await enterBakePaused(page);
    out.bake = await dough(page);
    await landNeedleAndTakeOut(page, { start: 70, end: 70 });
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    out.cut = await dough(page);
    await page.screenshot({ path: `${OUT}/${tag}-cut.png` });
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await expect(page.getByTestId("dinner-attempt-result")).toBeVisible();
    const fs = await import("node:fs");
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(out, null, 2));
  });
}
