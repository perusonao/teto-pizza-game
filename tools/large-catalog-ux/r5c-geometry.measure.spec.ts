import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { INGREDIENTS } from "../../src/data/ingredients";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";

/**
 * LC-R5-c Fresh Audit geometry harness (measurement only; manual, NOT part of CI or `npm run test:e2e`):
 *   npx playwright test -c tools/large-catalog-ux/playwright.r5c-geometry.config.ts
 *
 * Measures the CURRENT (R5-b, main) pantry sheet at the four Owner viewports, normal and with a SIMULATED soft
 * keyboard (Chromium cannot show one: `window.visualViewport` is replaced by a stand-in whose height is
 * innerHeight - K, the same technique as e2e/large-catalog-pantry-search.spec.ts), and then the list budget left
 * for each selected / pinned UI candidate of the audit. Candidates are PROTOTYPED by injecting plain DOM nodes
 * of the candidate's height into the live sheet (no production file is changed and nothing here ships); the
 * production CSS then lays them out, so the list height and the fully visible tile rows are real layout.
 *
 * Output: docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R5c_GEOMETRY.json (numbers only).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x664", width: 390, height: 664 },
  { id: "360x640", width: 360, height: 640 },
] as const;
/** 338 = the shrink measured on a real iPhone in the R5-b Discovery (714 -> 376); 300 / 380 = sensitivity. */
const KEYBOARDS = [300, 338, 380] as const;

type Candidate = {
  id: string;
  /** Extra fixed rows inserted before the list (px heights; the sheet's 8px gap applies to each). */
  rows: number[];
  /** Hide the category subtitle line (its label moves into the title). */
  hideSubtitle?: boolean;
  /** Hide the ShelfChips slot (keyboard-only candidates). */
  hideChips?: boolean;
  /** Put a 44x44 control into the header (header-integrated candidates). */
  headerButton?: boolean;
};

const CANDIDATES: Candidate[] = [
  { id: "current (no pin UI)", rows: [] },
  { id: "A fixed strip 44", rows: [44] },
  { id: "B compact summary 32", rows: [32] },
  { id: "B' compact summary 24", rows: [24] },
  { id: "C header-integrated (0 rows)", rows: [], headerButton: true },
  { id: "E1 strip replaces subtitle (44)", rows: [44], hideSubtitle: true },
  { id: "E2 compact 32 replaces subtitle", rows: [32], hideSubtitle: true },
  { id: "E3 pin chip inside ShelfChips row (0 rows)", rows: [] },
  { id: "K1 keyboard: hide subtitle only", rows: [], hideSubtitle: true },
  { id: "K2 keyboard: hide chips", rows: [], hideChips: true },
  { id: "K3 keyboard: strip 44 + hide subtitle + hide chips", rows: [44], hideSubtitle: true, hideChips: true },
  { id: "K4 keyboard: compact 32 + hide subtitle", rows: [32], hideSubtitle: true },
  { id: "K5 keyboard: compact 24 + hide subtitle", rows: [24], hideSubtitle: true },
];

const FAKE_VV = () => {
  class FakeViewport extends EventTarget {
    get width() { return window.innerWidth; }
    get height() { return (window as unknown as { __vvH?: number }).__vvH ?? window.innerHeight; }
    get offsetTop() { return 0; }
    get pageTop() { return 0; }
    get scale() { return 1; }
  }
  const vv = new FakeViewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  (window as unknown as { __setVv: (h: number | null) => void }).__setVv = (h) => {
    (window as unknown as { __vvH?: number }).__vvH = h ?? undefined;
    vv.dispatchEvent(new Event("resize"));
  };
};

async function toTopping(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  const save = {
    schemaVersion: 2,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: INGREDIENTS.map((i) => i.id),
    missionBest: {},
    inventory: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])),
    starterGrantClaimedRecipeIds: [],
  };
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /レシピ発見/ }).click();
  await page.waitForSelector(".pizza-stage");
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
  await page.waitForSelector(".ingredient-chip");
}

async function applyCandidate(page: Page, c: Candidate | null) {
  await page.evaluate((cand) => {
    document.querySelectorAll("[data-r5c-probe]").forEach((n) => n.remove());
    const sheet = document.querySelector<HTMLElement>(".pantry-sheet")!;
    const sub = document.querySelector<HTMLElement>(".pantry-sheet__subtitle");
    const chips = document.querySelector<HTMLElement>(".pantry-sheet__shelves");
    if (sub) sub.style.display = cand?.hideSubtitle ? "none" : "";
    if (chips) chips.style.display = cand?.hideChips ? "none" : "";
    if (!cand) return;
    const list = sheet.querySelector(".pantry-sheet__list")!;
    for (const h of cand.rows) {
      const probe = document.createElement("div");
      probe.setAttribute("data-r5c-probe", "row");
      probe.style.cssText = `flex:none;height:${h}px;background:rgba(192,138,62,.25);border-radius:8px`;
      sheet.insertBefore(probe, list);
    }
    if (cand.headerButton) {
      const header = sheet.querySelector(".pantry-sheet__header")!;
      const b = document.createElement("div");
      b.setAttribute("data-r5c-probe", "header");
      b.style.cssText = "flex:none;width:44px;height:44px;border-radius:999px;background:rgba(192,138,62,.25)";
      header.insertBefore(b, header.lastElementChild);
    }
  }, c);
}

async function facts(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el || el.getClientRects().length === 0) return null;
      const b = el.getBoundingClientRect();
      return { y: +b.y.toFixed(1), h: +b.height.toFixed(1), b: +b.bottom.toFixed(1) };
    };
    const sheet = document.querySelector<HTMLElement>(".pantry-sheet")!;
    const list = document.querySelector<HTMLElement>(".pantry-sheet__list")!;
    const l = list.getBoundingClientRect();
    const vvH = (window as unknown as { __vvH?: number }).__vvH ?? window.innerHeight;
    const tiles = [...document.querySelectorAll(".pantry-tile")].map((t) => t.getBoundingClientRect());
    const visibleBottom = Math.min(l.bottom, vvH);
    const full = new Set<number>();
    for (const b of tiles) if (b.top >= l.top - 0.5 && b.bottom <= visibleBottom + 0.5) full.add(Math.round(b.top));
    const cs = getComputedStyle(sheet);
    const probes = [...document.querySelectorAll("[data-r5c-probe='row']")].map((p) => +p.getBoundingClientRect().height.toFixed(1));
    return {
      innerH: window.innerHeight,
      vvH,
      fit: sheet.classList.contains("pantry-sheet--fit"),
      sheet: r(sheet),
      padTop: parseFloat(cs.paddingTop),
      padBottom: parseFloat(cs.paddingBottom),
      gap: parseFloat(cs.rowGap || cs.gap),
      header: r(document.querySelector(".pantry-sheet__header")),
      subtitle: r(document.querySelector(".pantry-sheet__subtitle")),
      search: r(document.querySelector(".pantry-sheet__search")),
      chips: r(document.querySelector(".pantry-sheet__shelves")),
      probes,
      list: r(list),
      listVisibleH: +Math.max(0, visibleBottom - l.top).toFixed(1),
      tileH: tiles.length ? +tiles[0].height.toFixed(1) : null,
      rowPitch: tiles.length > 3 ? +(tiles[3].top - tiles[0].top).toFixed(1) : null,
      fullRows: full.size,
      safeTopMargin: +sheet.getBoundingClientRect().y.toFixed(1),
      bottomGapToVv: +(vvH - sheet.getBoundingClientRect().bottom).toFixed(1),
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1 || window.scrollY > 0,
    };
  });
}

test("LC-R5-c geometry: current pantry + candidate budgets at four viewports, normal and keyboard", async ({ page }) => {
  test.setTimeout(600_000);
  await page.addInitScript(FAKE_VV);
  const out: Record<string, unknown> = { generatedBy: "tools/large-catalog-ux/r5c-geometry.measure.spec.ts", keyboardsPx: KEYBOARDS, viewports: {} };
  for (const vp of VIEWPORTS) {
    await toTopping(page, vp.width, vp.height);
    await page.getByRole("button", { name: /食材庫/ }).click();
    await page.waitForSelector(".pantry-sheet__search-input");
    const perVp: Record<string, unknown> = {};
    // normal (keyboard down, field not focused)
    const normal: Record<string, unknown> = {};
    for (const c of CANDIDATES) {
      await applyCandidate(page, c);
      normal[c.id] = await facts(page);
    }
    await applyCandidate(page, null);
    perVp.normal = normal;
    // keyboard (field focused, visual viewport shrunk by K)
    await page.locator(".pantry-sheet__search-input").focus();
    for (const k of KEYBOARDS) {
      await page.evaluate((h) => (window as unknown as { __setVv: (h: number) => void }).__setVv(h), vp.height - k);
      await page.waitForFunction(() => document.querySelector(".pantry-sheet")?.classList.contains("pantry-sheet--fit"));
      await page.waitForTimeout(80);
      const kb: Record<string, unknown> = {};
      for (const c of CANDIDATES) {
        await applyCandidate(page, c);
        await page.waitForTimeout(20);
        kb[c.id] = await facts(page);
      }
      await applyCandidate(page, null);
      perVp[`keyboard${k}`] = kb;
    }
    await page.evaluate(() => (window as unknown as { __setVv: (h: number | null) => void }).__setVv(null));
    (out.viewports as Record<string, unknown>)[vp.id] = perVp;
    await page.keyboard.press("Escape");
  }
  const file = join(process.cwd(), "docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R5c_GEOMETRY.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
});
