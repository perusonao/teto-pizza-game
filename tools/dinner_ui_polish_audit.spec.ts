import { expect, test, type Page } from "@playwright/test";
import { cookDinnerPizza, DM_A, dinnerSave, nextDinnerPizza, openDinnerDetail, openWithSave } from "./support/dinner";

/**
 * Dinner UI Polish Fresh Audit (read-only measurement tool; not part of the suite).
 * Needs e2e/support/dinner.ts, which exists only from PR #252 (head d11858a) on. Run it from such a
 * checkout: copy this file to e2e/zz-dinner-ui-polish-audit.spec.ts, then
 *   AUDIT_OUT=<dir> npx playwright test e2e/zz-dinner-ui-polish-audit.spec.ts --project=iphone-390x844
 * (the project only supplies the browser; each describe sets its own viewport). Not part of the
 * suite: tools/ is outside playwright.config.ts's testDir.
 * Report: docs/reports/TETO_CUT-FAILED-BAKE-256_DINNER-UI-POLISH_Fresh-Audit.md
 * Each viewport writes <dir>/<w>x<h>.json plus screenshots. Nothing in the app is changed; the
 * long-name probes only overwrite text in the rendered DOM to see whether it would fit.
 */

const OUT = process.env.AUDIT_OUT ?? "audit-out";
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 390, height: 664 },
  { width: 360, height: 640 },
];
// Every recipe name in src/data/recipes.ts (25), longest first.
const NAMES = [
  "ニューヘイブンアピッツァ", "ピッツァ・ポルトゲーザ", "クアトロ フォルマッジ", "ペストカプレーゼピザ",
  "ブレックファストピザ", "トンノ・エ・チポッラ", "ペストパターテピザ", "ピッツァ・ビアンカ", "パルミジャーナピザ",
  "メランザーネピザ", "ミートラヴァーズ", "ペストトンノピザ", "ハワイアンピザ", "カプリチョーザ", "マルゲリータ",
  "プッタネスカ", "ジェノベーゼ", "サルシッチャ", "マリナーラ", "ビスマルク", "バンビーノ", "ペパロニ", "フガッサ",
  "フンギ", "ナポリ",
];

type Rect = { x: number; y: number; w: number; h: number };

async function rectOf(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
  }, selector);
}

/** Chip geometry, and how many characters of each name are visible before the ellipsis. */
async function measureChips(page: Page) {
  return page.evaluate((names) => {
    const chips = [...document.querySelectorAll<HTMLElement>(".dinner-chip")];
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 };
    };
    const canvas = document.createElement("canvas").getContext("2d")!;
    const fit = (span: HTMLElement, text: string) => {
      const cs = getComputedStyle(span);
      canvas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const avail = span.clientWidth;
      if (canvas.measureText(text).width <= avail) return { full: true, visible: text };
      const ell = canvas.measureText("…").width;
      let n = 0;
      while (n < text.length && canvas.measureText(text.slice(0, n + 1)).width + ell <= avail) n++;
      return { full: false, visible: `${text.slice(0, n)}…` };
    };
    const first = chips[0]?.querySelector<HTMLElement>(".dinner-chip__name");
    return {
      chips: chips.map((chip) => {
        const name = chip.querySelector<HTMLElement>(".dinner-chip__name")!;
        return {
          label: chip.getAttribute("aria-label"),
          chip: r(chip),
          thumb: r(chip.querySelector(".reference-thumbnail")),
          nameFontPx: getComputedStyle(name).fontSize,
          nameAvailPx: name.clientWidth,
          nameTruncated: name.scrollWidth > name.clientWidth,
          nameShown: fit(name, name.textContent ?? ""),
        };
      }),
      // Would every recipe name fit a chip of this width? (future missions: DM-B and beyond)
      allNamesAtThisChipWidth: first ? names.map((n) => ({ name: n, ...fit(first, n) })) : [],
    };
  }, NAMES);
}

/** Put `text` into `selector` and report its line count / overflow (the DOM is restored after). */
async function probeText(page: Page, selector: string, text: string) {
  return page.evaluate(
    ([sel, t]) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) return null;
      const before = el.textContent;
      el.textContent = t;
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const b = el.getBoundingClientRect();
      const out = {
        text: t,
        w: Math.round(b.width),
        h: Math.round(b.height),
        fontPx: cs.fontSize,
        lines: Math.round(b.height / lh),
        overflowX: el.scrollWidth > el.clientWidth,
        pageScrollX: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
      el.textContent = before;
      return out;
    },
    [selector, text] as const,
  );
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test("measure", async ({ page }, info) => {
      test.setTimeout(240_000);
      const tag = `${vp.width}x${vp.height}`;
      const shot = (name: string) => page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
      const data: Record<string, unknown> = { viewport: vp };

      // S=5: a hand-placed margherita lands on QUALITY_FAIL (★ below 5).
      await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=900&dinnerMinStars=5");
      await openDinnerDetail(page, /ディナーミッション 1/);
      await page.getByRole("button", { name: /スタート/ }).click();
      await expect(page.getByTestId("dinner-target-row")).toBeVisible();
      data.prepare = {
        bar: await rectOf(page, ".dinner-bar"),
        status: await rectOf(page, ".dinner-bar__status"),
        targets: await rectOf(page, ".dinner-bar__targets"),
        stage: await rectOf(page, ".pizza-stage"),
        ...(await measureChips(page)),
      };
      await shot("1-prepare-target-row");
      await page.getByTestId("dinner-chip-breakfast-pizza").click();
      await expect(page.getByRole("dialog", { name: /ブレックファストピザの見本/ })).toBeVisible();
      await shot("2-reference-popover");
      await page.getByRole("dialog", { name: /の見本/ }).getByRole("button", { name: /閉じる/ }).click();

      await cookDinnerPizza(page, "margherita");
      const panel = page.getByTestId("dinner-attempt-result");
      await expect(panel).toBeVisible();
      data.qualityFail = {
        category: await panel.getAttribute("data-category"),
        text: (await panel.innerText()).split("\n"),
        panel: await rectOf(page, "[data-testid=dinner-attempt-result]"),
        // A gap line of the kind F3 proposes, placed where the supporting line is.
        gapProbe: await probeText(page, ".dinner-attempt__line", "マルゲリータ ★4 → 合格まで あと★1"),
        longNameProbe: await probeText(page, ".dinner-attempt__line", "ニューヘイブンアピッツァ ★4（合格は★5以上）"),
      };
      await shot("3-quality-fail");

      // A fresh run with S=1: CLEAR in the order funghi, margherita, bismarck, breakfast.
      await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=900&dinnerMinStars=1");
      await openDinnerDetail(page, /ディナーミッション 1/);
      await page.getByRole("button", { name: /スタート/ }).click();
      const order = ["funghi", "margherita", "bismarck", "breakfast-pizza"] as const;
      for (const [i, p] of order.entries()) {
        await cookDinnerPizza(page, p);
        if (i < order.length - 1) {
          await expect(page.getByTestId("dinner-attempt-result")).toHaveAttribute("data-category", "TARGET_PASS");
          await nextDinnerPizza(page);
          if (i === 1) {
            data.prepareWithDone = await measureChips(page);
            await shot("4-target-row-2-done");
          }
        }
      }
      const overlay = page.getByRole("dialog", { name: "ディナーミッション結果" });
      await expect(overlay).toBeVisible();
      data.clear = {
        text: (await overlay.innerText()).split("\n"),
        panel: await rectOf(page, ".dinner-result"),
        title: await rectOf(page, ".dinner-result__title"),
        last: await probeText(page, "[data-testid=dinner-result-last]", (await page.getByTestId("dinner-result-last").textContent()) ?? ""),
        longestNameProbe: await probeText(page, "[data-testid=dinner-result-last]", "最後のピザ：ニューヘイブンアピッツァ完成！"),
        nonTargetProbe: await probeText(page, "[data-testid=dinner-result-last]", "最後のピザ：もう少し丁寧に作ろう"),
        jaTitleProbe: await probeText(page, ".dinner-result__title", "🎉 ディナー クリア！"),
      };
      await shot("5-clear");
      await info.attach(tag, { body: JSON.stringify(data, null, 2), contentType: "application/json" });
      const fs = await import("node:fs");
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(data, null, 2));
    });
  });
}
