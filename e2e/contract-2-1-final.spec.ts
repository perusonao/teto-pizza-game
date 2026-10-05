import { test, expect, type Locator, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";

/**
 * Anti-Oracle Contract 2.1 S6: final mobile verification at 390x844 and 360x800 (the two iphone projects), on the
 * Dex 25 ladder save (pesto-pollo = the single Research Entry; members: pesto, mozzarella, fresh tomato, chicken;
 * the unlock fact is chicken). Real gameplay only. Evidence screenshots: HV_SCREENSHOT_DIR.
 */
const SAVE_KEY = "teto-pizza-save-v1";
const OPT_OUT_KEY = "teto.dev.researchIdentify";
const FREE_BAKE = { start: 58, end: 78 };
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materials = DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds as readonly string[]);
const discovered = [...keysBefore(25), "brazilian-calabresa", "aussie"];
const SPOTS: ReadonlyArray<readonly [number, number]> = [[38, 42], [50, 38], [62, 42], [42, 56], [58, 56], [50, 66], [34, 52], [66, 52]];

interface SaveOpts {
  facts?: string[];
  stock?: Record<string, number>;
}
const saveJson = ({ facts, stock }: SaveOpts = {}) =>
  JSON.stringify({
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
    missionBest: {},
    inventory: { ...Object.fromEntries(materials.map((m) => [m, 30])), ...(stock ?? {}) },
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    ...(facts ? { discoveryHintFacts: { "pesto-pollo": facts } } : {}),
  });
const bar = (page: Page) => page.locator(".prepare-bake-bar");
const result = (page: Page) => page.locator(".result-panel--original");

async function open(page: Page, opts: SaveOpts & { flagOff?: boolean } = {}) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value, optKey, off]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
    if (off) localStorage.setItem(optKey, "0");
  }, [SAVE_KEY, saveJson(opts), OPT_OUT_KEY, !!opts.flagOff] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function pickChip(page: Page, name: RegExp) {
  const chip = await chipOnTrayOrPin(page, name);
  await chip.click();
}

async function startResearch(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（[^（）]+）を研究する$/ }).click();
  await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
}

interface Cook {
  sauce?: RegExp;
  cheeses?: RegExp[];
  toppings?: RegExp[];
}
/** Dough -> sauce -> cheeses -> toppings -> bake (PREPARE already open). Ends on RESULT. */
async function cookPrepared(page: Page, { sauce = /トマトソース/, cheeses = [], toppings = [] }: Cook) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.locator(".ingredient-chip").filter({ hasText: sauce }).first().click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  let i = 0;
  for (const c of cheeses) {
    await pickChip(page, c);
    await tapDoughPercent(page, ...SPOTS[i++ % SPOTS.length]);
  }
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  for (const t of toppings) {
    await pickChip(page, t);
    await tapDoughPercent(page, ...SPOTS[i++ % SPOTS.length]);
  }
  await bakeToTarget(page, FREE_BAKE);
  await page.waitForSelector(".result-panel");
}

const TOMATO = /^トマト×/;
const chipsOf = async (page: Page) =>
  (await page.getByTestId("research-rows").locator("li").allTextContents()).map((t) => t.replace(/\s+/g, ""));
const usedItem = (page: Page, text: string | RegExp) => result(page).getByRole("list", { name: "使った材料" }).getByRole("listitem").filter({ hasText: text });

const FORBIDDEN = /一致しません|不一致|正解|不正解|完全一致|構成が|個中|全部で|あと[0-9０-９]|残り|おしい|近い|遠い|類似|距離|候補|ソースなし|チーズなし|ソースは使わない|チーズは使わない|[0-9０-９]+\s*[/／]\s*[0-9０-９]+|[0-9０-９]+\s*[%％]/;

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

/** Overflow, reachability and (relative) overlap of the RESULT: scrolls the whole result and checks every position. */
async function layout(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
  const vp = page.viewportSize()!;
  const panel = page.getByTestId("research-rows");
  // chips never clip: each chip lies inside the panel horizontally
  if (await panel.count()) {
    const pb = (await panel.boundingBox())!;
    for (const li of await panel.locator("li").all()) {
      const b = (await li.boundingBox())!;
      expect(b.x, `${where}: chip left`).toBeGreaterThanOrEqual(pb.x - 0.5);
      expect(b.x + b.width, `${where}: chip right`).toBeLessThanOrEqual(pb.x + pb.width + 0.5);
    }
    expect(pb.x, `${where}: panel left`).toBeGreaterThanOrEqual(0);
    expect(pb.x + pb.width, `${where}: panel right`).toBeLessThanOrEqual(vp.width);
    const note = panel.locator(".research-rows__note");
    if (await note.count()) {
      const nb = (await note.boundingBox())!;
      expect(nb.x + nb.width, `${where}: note right`).toBeLessThanOrEqual(pb.x + pb.width + 0.5);
      expect(await note.evaluate((n) => n.scrollWidth <= n.clientWidth + 1), `${where}: note clipped`).toBe(true);
    }
  }
  const ctas: Locator[] = [
    result(page).getByRole("button", { name: "もう一度試す" }),
    result(page).getByRole("button", { name: /試作ノート/ }),
    result(page).getByRole("button", { name: "レシピを選んで作る" }),
  ];
  for (const cta of ctas) {
    await cta.scrollIntoViewIfNeeded();
    const b = (await cta.boundingBox())!;
    expect(b.x, `${where}: cta left`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `${where}: cta right`).toBeLessThanOrEqual(vp.width);
    expect(b.y + b.height, `${where}: cta bottom`).toBeLessThanOrEqual(vp.height);
    expect(b.height, `${where}: cta height`).toBeGreaterThanOrEqual(36);
  }
  // relative overlap at the end of the page: no CTA rectangle intersects the panel or the used list
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const rects: { name: string; r: { x: number; y: number; width: number; height: number } }[] = [];
  for (const [name, loc] of [["panel", panel], ["used", result(page).getByRole("list", { name: "使った材料" })]] as const) {
    if (await loc.count()) {
      await loc.scrollIntoViewIfNeeded();
      const r = await loc.boundingBox();
      if (r) rects.push({ name, r });
    }
  }
  for (const cta of ctas) {
    await cta.scrollIntoViewIfNeeded();
    const c = (await cta.boundingBox())!;
    // re-measure content after the scroll the CTA needed
    for (const [name, loc] of [["panel", panel], ["used", result(page).getByRole("list", { name: "使った材料" })]] as const) {
      if (!(await loc.count())) continue;
      const r = await loc.boundingBox();
      if (!r) continue;
      const overlap = r.x < c.x + c.width && r.x + r.width > c.x && r.y < c.y + c.height && r.y + r.height > c.y;
      expect(overlap, `${where}: ${name} overlaps a CTA`).toBe(false);
    }
  }
  void rects;
  // terminal content (the last paragraph of the card) must be reachable above the fixed action bar at the end of the page
  // scroll the real scroller (the nearest scrollable ancestor of the card, else the window) to its very end
  await page.evaluate(() => {
    let el: HTMLElement | null = document.querySelector(".result-panel--original");
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  const note = result(page).locator(".original-pizza__note");
  if (await note.count()) {
    const nb = (await note.boundingBox())!;
    const tops: number[] = [];
    for (const cta of ctas) tops.push((await cta.boundingBox())!.y);
    expect(nb.y + nb.height, `${where}: last paragraph hidden behind the action bar (note bottom ${nb.y + nb.height} vs first CTA top ${Math.min(...tops)})`).toBeLessThanOrEqual(Math.min(...tops) + 1);
  }
}

async function scanPrivacy(page: Page, where: string) {
  const html = await page.locator("body").innerText();
  const aria = await page.evaluate(() => [...document.querySelectorAll("[aria-label]")].map((n) => n.getAttribute("aria-label")).join(" "));
  expect(html + " " + aria, `${where}: forbidden wording`).not.toMatch(FORBIDDEN);
  for (const hidden of ["pesto-pollo", "ペスト・ポッロ", "ポッロ"]) expect(html + aria, `${where}: hidden identity`).not.toContain(hidden);
}

async function openNotebook(page: Page) {
  await result(page).getByRole("button", { name: /試作ノート/ }).click();
  const nb = page.locator("[data-trial-notebook]");
  await expect(nb).toBeVisible();
  return nb;
}
const closeNotebook = async (page: Page) => {
  await page.locator("[data-trial-notebook]").getByRole("button", { name: /結果にもどる/ }).click();
  await expect(page.locator("[data-trial-notebook]")).toHaveCount(0);
};

test.describe("Contract 2.1 final (mobile)", () => {
  test.setTimeout(300_000);

  test("A. typical: ○ / × / ✓, used list, CTAs, Notebook, privacy, aria", async ({ page }) => {
    await open(page, { facts: ["ing:fresh-tomato"] }); // tomato known before this attempt (plus the unlock fact chicken)
    await startResearch(page);
    await cookPrepared(page, { cheeses: [/モッツァレラ/], toppings: [/チキン/, /ナス/, TOMATO] });
    expect(await chipsOf(page)).toEqual(["トマトソース×", "モッツァレラ○", "ナス×"]);
    await expect(usedItem(page, "チキン")).toContainText("✓");
    await expect(usedItem(page, "チキン")).toHaveAttribute("aria-label", "チキン、すでにわかっている材料");
    await expect(usedItem(page, /^\s*.?\s*トマト\s*✓/)).toHaveCount(1); // known tomato
    await expect(usedItem(page, "ナス")).not.toContainText("✓");
    await expect(usedItem(page, "モッツァレラ")).not.toContainText("✓"); // ○ now, never also ✓
    await expect(page.getByTestId("research-rows").getByLabel("モッツァレラ、研究中ピザの材料")).toBeVisible();
    await expect(page.getByTestId("research-rows").getByLabel("ナス、研究中ピザの材料ではない")).toBeVisible();
    await expect(page.getByTestId("research-rows")).not.toContainText("チキン");
    await layout(page, "A typical");
    await scanPrivacy(page, "A");
    await shot(page, "s6-typical");
    const nb = await openNotebook(page);
    const entry = nb.locator("[data-trial-entry]");
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("モッツァレラ○");
    await expect(entry).toContainText("ナス×");
    await expect(entry).not.toContainText("チキン（"); // only the label carries the unlock name
    const text = await entry.innerText();
    expect(text).not.toContain("トマト○");
    expect(text).not.toContain("トマト×");
    await scanPrivacy(page, "A notebook");
    await shot(page, "s6-notebook");
    await closeNotebook(page);
  });

  test("B. real gameplay maximum: sauce 1 + every owned cheese + 3 toppings (8 chips)", async ({ page }) => {
    await open(page);
    await startResearch(page);
    await cookPrepared(page, {
      cheeses: [/モッツァレラ/, /ゴルゴンゾーラ/, /パルミジャーノ/, /フォンティーナ/],
      toppings: [/ナス/, /パイナップル/, /じゃがいも/],
    });
    const chips = await chipsOf(page);
    expect(chips).toHaveLength(8);
    expect(chips.filter((c) => c.endsWith("×")).length + chips.filter((c) => c.endsWith("○")).length).toBe(8);
    await expect(page.getByTestId("research-rows").locator('[data-research-category="sauce"] li')).toHaveCount(1); // 1 sauce in Production
    await layout(page, "B max");
    await scanPrivacy(page, "B");
    await shot(page, "s6-max-rows");
    const nb = await openNotebook(page);
    expect((await nb.locator("[data-trial-entry]").innerText()).length).toBeLessThanOrEqual(260); // the stored line itself is <= 200
    await closeNotebook(page);
  });

  test("C. topping over-cap: exact explanation, no topping chips, sauce / cheese stay, Notebook has no hidden toppings", async ({ page }) => {
    await open(page);
    await startResearch(page);
    await cookPrepared(page, { cheeses: [/モッツァレラ/], toppings: [/ナス/, /パイナップル/, /じゃがいも/, TOMATO] });
    const panel = page.getByTestId("research-rows");
    await expect(panel).toContainText("トッピングは一度に3種類まで調べられるよ");
    await expect(panel.locator('[data-research-category="topping"] li')).toHaveCount(0);
    expect(await chipsOf(page)).toEqual(["トマトソース×", "モッツァレラ○"]);
    await layout(page, "C over-cap");
    await scanPrivacy(page, "C");
    await shot(page, "s6-overcap");
    const nb = await openNotebook(page);
    const text = await nb.locator("[data-trial-entry]").innerText();
    // the entry lists the player's own combination; no judgment of a hidden (over-cap) topping may be recorded
    expect(text).not.toMatch(/(ナス|パイナップル|じゃがいも|トマト)[○×]/);
    expect(text).toContain("モッツァレラ○");
    await closeNotebook(page);
  });

  test("D. all-known attempt: no panel, ✓ on the used list, Notebook feedback null", async ({ page }) => {
    await open(page, { facts: ["ing:fresh-tomato", "ing:pesto"] });
    await startResearch(page);
    await cookPrepared(page, { sauce: /ジェノベーゼ|ペスト/, toppings: [/チキン/, TOMATO] });
    await expect(page.getByTestId("research-rows")).toHaveCount(0);
    for (const n of ["チキン", "トマト", "ジェノベーゼ"]) await expect(usedItem(page, n)).toContainText("✓");
    await layout(page, "D all-known");
    await shot(page, "s6-all-known");
    const nb = await openNotebook(page);
    const entry = nb.locator("[data-trial-entry]");
    await expect(entry).toHaveCount(1);
    expect(await entry.innerText()).not.toMatch(/[○×]/);
    await closeNotebook(page);
  });

  test("E. Hint bought before cooking: that ingredient is not judged, shows ✓, and is not in the Notebook", async ({ page }) => {
    await open(page);
    await startResearch(page);
    await bar(page).getByRole("button", { name: "ヒント" }).click();
    const dialog = page.getByRole("dialog", { name: /ヒント/ });
    await dialog.locator(".hint-sheet__h5-next .hint-sheet__next").click(); // SAUCE rung -> the sauce becomes known
    await expect(dialog.locator(".hint-sheet__fact-line, .hint-sheet__chip").first()).toBeVisible();
    await dialog.getByRole("button", { name: "閉じる" }).click();
    await cookPrepared(page, { sauce: /ジェノベーゼ|ペスト/, toppings: [/ナス/] });
    expect(await chipsOf(page)).toEqual(["ナス×"]);
    await expect(usedItem(page, "ジェノベーゼ")).toContainText("✓");
    await expect(usedItem(page, "ジェノベーゼ")).toHaveAttribute("aria-label", "ジェノベーゼソース、すでにわかっている材料");
    const nb = await openNotebook(page);
    const text = await nb.locator("[data-trial-entry]").innerText();
    expect(text).toContain("ナス×");
    expect(text).not.toContain("ジェノベーゼソース○");
    await closeNotebook(page);
  });

  test("F. retry: this attempt's ○ is ✓ next time, and the Notebook keeps only the latest line", async ({ page }) => {
    await open(page);
    await startResearch(page);
    await cookPrepared(page, { toppings: [/ナス/, TOMATO] });
    expect(await chipsOf(page)).toEqual(["トマトソース×", "ナス×", "トマト○"]);
    await expect(usedItem(page, /トマト$/).last()).not.toContainText("✓");
    await result(page).getByRole("button", { name: "もう一度試す" }).click();
    await expect(page.getByTestId("research-context")).toContainText("？？？ピザ");
    await cookPrepared(page, { toppings: [/ナス/, TOMATO] }); // the very same combination
    expect(await chipsOf(page)).toEqual(["トマトソース×", "ナス×"]);
    await expect(page.getByTestId("research-rows")).not.toContainText("トマト○");
    await expect(usedItem(page, /トマト\s*✓/)).toHaveCount(1);
    await layout(page, "F retry");
    const nb = await openNotebook(page);
    await expect(nb.locator("[data-trial-entry]")).toHaveCount(1); // same combination = one entry, latest feedback
    const text = await nb.locator("[data-trial-entry]").innerText();
    expect(text).not.toContain("トマト○");
    expect(text).toContain("ナス×");
    await closeNotebook(page);
  });

  test("G. last stock: the result, the stored fact and the Notebook line survive the attempt that used it up", async ({ page }) => {
    await open(page, { stock: { "fresh-tomato": 1 } });
    await startResearch(page);
    await cookPrepared(page, { toppings: [TOMATO] });
    expect(await chipsOf(page)).toContain("トマト○");
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.discoveryHintFacts["pesto-pollo"]).toContain("ing:fresh-tomato");
    expect(saved.inventory["fresh-tomato"]).toBe(0);
    expect(JSON.stringify(saved)).not.toMatch(/lastResearchRows|RESEARCH_ROWS|toppingOverCap/);
    const nb = await openNotebook(page);
    await expect(nb.locator("[data-trial-entry]")).toContainText("トマト○");
    await closeNotebook(page);
  });

  test("H. NEW PIZZA boundary: reproducing the pizza gives the discovery result with no research panel", async ({ page }) => {
    await open(page);
    await startResearch(page);
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await pickChip(page, /ジェノベーゼ|ペスト/);
    await paintSauceRing(page, 25, 16);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    let s = 0;
    await pickChip(page, /モッツァレラ/);
    for (let i = 0; i < 2; i += 1) await tapDoughPercent(page, ...SPOTS[s++]);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await pickChip(page, /(?<!チェリー)トマト(?!ソース)/);
    for (let i = 0; i < 2; i += 1) await tapDoughPercent(page, ...SPOTS[s++]);
    await pickChip(page, /チキン/);
    for (let i = 0; i < 3; i += 1) await tapDoughPercent(page, ...SPOTS[s++]);
    await bakeToTarget(page, { start: 50, end: 70 }); // this recipe's own bake band
    await expect(page.locator(".result-panel--discovery")).toBeVisible();
    await expect(page.getByTestId("research-rows")).toHaveCount(0);
    await expect(result(page)).toHaveCount(0); // not the Research ORIGINAL card
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
    expect(m.sw).toBeLessThanOrEqual(m.vw);
    await shot(page, "s6-new-pizza");
  });

  test("I. flag OFF: no panel and no ✓ semantics, facts untouched", async ({ page }) => {
    await open(page, { flagOff: true, facts: ["ing:fresh-tomato"] });
    await startResearch(page);
    await cookPrepared(page, { toppings: [/チキン/, /ナス/, TOMATO] });
    await expect(page.getByTestId("research-rows")).toHaveCount(0);
    await expect(result(page).locator("[data-known-mark]")).toHaveCount(0);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.discoveryHintFacts["pesto-pollo"]).toEqual(["ing:fresh-tomato"]);
  });
});
