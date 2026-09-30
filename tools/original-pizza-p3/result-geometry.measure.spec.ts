import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { PROFILES, ProfileDriver, readViewport, type ProfileId } from "../../e2e/support/layoutProfiles";

/**
 * P3-3 Fresh Audit: measures the ORIGINAL RESULT at the four required viewports (plus the three safe-area
 * profiles) and predicts what a duplicate notice and a Notebook entry CTA would cost. Output JSON to
 * $P3_OUT, screenshots to $P3_SHOTS (never committed by this harness).
 *
 * Stand-ins (no app change): the notice is a `<p class="result-near-miss__text">` (the app's own secondary-line
 * style) holding the Owner's example copy, wrapped in a `.result-near-miss` row; the entry CTA is a
 * `<button class="result-near-miss__cta">` (36px pill, the existing hint CTA's own style) and, separately, a
 * 44px-min-height variant.
 */
const OUT = process.env.P3_OUT ?? resolve("docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-3_ResultGeometry.json");
const SHOTS = process.env.P3_SHOTS ?? resolve(process.env.TMPDIR ?? "/tmp", "p3-3-result-shots");
const SAVE_KEY = "teto-pizza-save-v1";
const FREE_BAKE = { start: 58, end: 78 };
const DEX3_SAVE = {
  schemaVersion: 2,
  dex: ["margherita", "bismarck", "breakfast-pizza"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg", "bacon", "mushroom"],
  missionBest: {},
  inventory: { egg: 30, bacon: 30, mushroom: 30 },
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: ["egg", "bacon", "mushroom"],
};
const NOTICE = "\u{1F4D3} 前にも同じ材料の組み合わせで作ったよ（試作#4）";
const ENTRY = "\u{1F4D3} 試作ノート";

async function openWithSave(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    localStorage.setItem("teto.dev.hint5Ladder", "0");
  }, [SAVE_KEY, JSON.stringify(DEX3_SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

const bar = (page: Page) => page.locator(".prepare-bake-bar");
async function place(page: Page, name: RegExp, spots: [number, number][]) {
  await page.locator(".ingredient-chip").filter({ hasText: name }).first().click();
  for (const [x, y] of spots) await tapDoughPercent(page, x, y);
}
async function cookFree(page: Page, pieces: { cheese: [RegExp, number][]; toppings: [RegExp, number][]; sauceDab?: boolean }) {
  await page.getByRole("button", { name: /フリークッキング/ }).first().click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: /トマトソース/ }).first().click();
  if (pieces.sauceDab) await tapDoughPercent(page, 50, 50);
  else await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  const spots: [number, number][] = [[40, 50], [60, 50], [50, 32], [50, 66], [34, 38], [66, 62]];
  let s = 0;
  for (const [name, n] of pieces.cheese) await place(page, name, spots.slice(s, (s += n)));
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  for (const [name, n] of pieces.toppings) {
    await place(page, name, spots.slice(s % 6, (s % 6) + n));
    s += n;
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

/** Everything a layout decision needs, in CSS px, at the current viewport. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
    const panel = document.querySelector(".result-panel")!;
    const actions = r(document.querySelector(".result-panel__actions"))!;
    const primary = r(document.querySelector(".result-panel__actions .cta-button--primary"))!;
    const kids = [...panel.children].filter((c) => !c.classList.contains("result-panel__actions"));
    const lastContent = kids.length ? kids[kids.length - 1].getBoundingClientRect() : null;
    const near = r(document.querySelector(".result-near-miss"));
    const hint = r(document.querySelector(".result-near-miss__cta"));
    const scrollOwner = (() => {
      const candidates: Element[] = [document.scrollingElement as Element, document.querySelector(".app-frame")!, document.querySelector(".game-screen"), document.querySelector("main")].filter(Boolean) as Element[];
      return candidates.filter((el) => el.scrollHeight > el.clientHeight + 1).map((el) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}:${el.scrollHeight}/${el.clientHeight}`);
    })();
    return {
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      panelTop: Math.round(panel.getBoundingClientRect().top),
      panelHeight: Math.round(panel.getBoundingClientRect().height),
      barTop: Math.round(actions.top),
      primaryBottom: Math.round(primary.bottom),
      lastContentBottom: lastContent ? Math.round(lastContent.bottom) : null,
      /** > 0: the last content sits above the fixed bar without scrolling; < 0: it is behind the bar until scrolled. */
      clearanceAboveBar: lastContent ? Math.round(actions.top - lastContent.bottom) : null,
      nearMissRow: near ? { height: Math.round(near.height), width: Math.round(near.width) } : null,
      hintCta: hint ? { height: Math.round(hint.height), width: Math.round(hint.width) } : null,
      scrollable: scrollOwner,
    };
  });
}

async function inject(page: Page, kind: "notice" | "entry36" | "entry44" | "both44") {
  await page.evaluate(([k, notice, entry]) => {
    document.querySelectorAll("[data-p3-inject]").forEach((n) => n.remove());
    const row = document.querySelector(".result-near-miss");
    const panel = document.querySelector(".result-panel")!;
    const make = (tag: string, cls: string, text: string, minH?: number) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      el.setAttribute("data-p3-inject", "");
      if (minH) el.style.minHeight = `${minH}px`;
      return el;
    };
    const ensureRow = () => {
      if (row) return row;
      const fresh = document.createElement("div");
      fresh.className = "result-near-miss";
      fresh.setAttribute("data-p3-inject", "");
      panel.insertBefore(fresh, panel.querySelector(".original-pizza__note"));
      return fresh;
    };
    if (k === "notice" || k === "both44") {
      const n = document.createElement("div");
      n.className = "result-near-miss";
      n.setAttribute("data-p3-inject", "");
      n.appendChild(make("p", "result-near-miss__text", notice));
      (row ?? panel.querySelector(".original-pizza__note"))!.parentElement!.insertBefore(n, row ? row : panel.querySelector(".original-pizza__note"));
    }
    if (k === "entry36") ensureRow().appendChild(make("button", "result-near-miss__cta", entry));
    if (k === "entry44" || k === "both44") ensureRow().appendChild(make("button", "result-near-miss__cta", entry, 44));
  }, [kind, NOTICE, ENTRY] as const);
}

const CASES = [
  { id: "ADD_ONE", pieces: { cheese: [[/モッツァレラ/, 3]], toppings: [] }, note: "P2 line 1 (near-miss), hint CTA" },
  { id: "FAR", pieces: { cheese: [], toppings: [[/バジル/, 1], [/たまご/, 2], [/ベーコン/, 2]] }, note: "P2 FAR line (generic or key-unused), hint CTA" },
  { id: "INCOMPLETE_MATCH", pieces: { cheese: [[/モッツァレラ/, 2]], toppings: [[/マッシュルーム/, 3]], sauceDab: true }, note: "no P2 line; INCOMPLETE lead; hint CTA only" },
] as const;
const PROFILE_IDS: ProfileId[] = ["N390", "N360", "S390", "S360", "P390i", "E390i", "E360i"];

test("measure the ORIGINAL RESULT and the cost of a notice and an entry CTA", async ({ page, browserName }) => {
  mkdirSync(SHOTS, { recursive: true });
  const driver = await ProfileDriver.create(page, browserName);
  const rows: unknown[] = [];
  for (const c of CASES) {
    await driver.apply(PROFILES.N390);
    await openWithSave(page);
    await cookFree(page, c.pieces as never);
    console.log(c.id, await page.evaluate(() => document.querySelector(".result-panel")?.className + " | " + (document.querySelector(".result-near-miss__text")?.textContent ?? "(no line)")));
    for (const id of PROFILE_IDS) {
      const profile = PROFILES[id];
      await driver.apply(profile);
      const vp = await readViewport(page);
      await page.evaluate(() => document.querySelectorAll("[data-p3-inject]").forEach((n) => n.remove()));
      const base = await measure(page);
      const variants: Record<string, unknown> = {};
      for (const kind of ["notice", "entry36", "entry44", "both44"] as const) {
        await inject(page, kind);
        const m = await measure(page);
        variants[kind] = { ...m, deltaPanelHeight: m.panelHeight - base.panelHeight, deltaClearance: (m.clearanceAboveBar ?? 0) - (base.clearanceAboveBar ?? 0) };
        if (id === "N390" || id === "S360") await page.screenshot({ path: resolve(SHOTS, `${c.id}-${id}-${kind}.png`) });
      }
      await page.evaluate(() => document.querySelectorAll("[data-p3-inject]").forEach((n) => n.remove()));
      rows.push({ case: c.id, note: c.note, profile: id, width: profile.width, height: profile.height, safeAreaBottom: vp.sab, base, variants });
    }
  }
  writeFileSync(OUT, `${JSON.stringify({ tool: "tools/original-pizza-p3/result-geometry.measure.spec.ts", seed: "Dex-3 ladder save (funghi discoverable)", standIns: { notice: NOTICE, entry: ENTRY }, rows }, null, 2)}\n`);
});
