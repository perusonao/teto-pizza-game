import { expect, test, type Page } from "@playwright/test";

/**
 * Cooking Steps 2.0 CS-4a (Owner Decision: T3 compact chips). Real-browser layout of the production
 * `MakingStepTabs` at the project's viewport (390x844 / 360x800, Chromium locally, WebKit in CI).
 *
 * The 7-tab strip exists on a FIXTURE only (e2e/harness/cs4-tabs.html): no Production recipe has a
 * FINISH step and `MAX_VISIBLE_COOKING_TABS` stays 6 (cookingProfiles.tabGate.test.ts). The 6-tab case
 * pins that a strip within today's ceiling keeps showing 「✓ 短縮ラベル」 on its completed tabs.
 */

const HARNESS = "e2e/harness/cs4-tabs.html";
const FULL = "DOUGH,SAUCE,CHEESE,TOPPING";

interface TabInfo {
  name: string;
  isBake: boolean;
  state: string;
  left: number;
  right: number;
  width: number;
  textShown: boolean;
  clipped: boolean;
  text: string;
}

async function open(page: Page, pre: string, post: string, step: string, phase: string) {
  await page.goto(`${HARNESS}?pre=${pre}&post=${post}&step=${step}&phase=${phase}`);
  await expect(page.locator(".making-step-tabs")).toBeVisible();
}

async function readTabs(page: Page): Promise<TabInfo[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".making-step-tabs > *")].map((tab) => {
      const inner = tab.querySelector<HTMLElement>(".making-step-tab__inner")!;
      const text = tab.querySelector<HTMLElement>(".making-step-tab__text")!;
      const r = tab.getBoundingClientRect();
      const cls = tab.className;
      return {
        name: tab.getAttribute("aria-label") ?? "焼く",
        isBake: cls.includes("making-step-tab--bake"),
        state: ["active", "next", "completed", "locked"].find((s) => cls.includes(`making-step-tab--${s}`)) ?? "plain",
        left: r.left,
        right: r.right,
        width: r.width,
        textShown: getComputedStyle(text).display !== "none",
        clipped: inner.scrollWidth > inner.clientWidth + 1,
        text: (inner.textContent ?? "").trim(),
      };
    }),
  );
}

async function expectStripFits(page: Page, count: number) {
  const vw = page.viewportSize()!.width;
  const tabs = await readTabs(page);
  expect(tabs).toHaveLength(count);
  const strip = (await page.locator(".making-step-tabs").boundingBox())!;
  expect(strip.x).toBeGreaterThanOrEqual(0);
  expect(strip.x + strip.width).toBeLessThanOrEqual(vw + 1);
  let prevRight = 0;
  for (const t of tabs) {
    expect(t.left, `${t.name} must not overlap the previous tab`).toBeGreaterThanOrEqual(prevRight - 1);
    expect(t.right, `${t.name} must stay inside the viewport`).toBeLessThanOrEqual(vw + 1);
    prevRight = t.right;
  }
  const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(doc.sw, "no horizontal page scroll").toBeLessThanOrEqual(doc.iw);
  return tabs;
}

test.describe("CS-4a: 7-tab fixture strip (DOUGH/SAUCE/CHEESE/TOPPING + 焼く + 仕上げ + カット)", () => {
  const WALK: [step: string, phase: string][] = [
    ["DOUGH", "PREPARE"],
    ["SAUCE", "PREPARE"],
    ["CHEESE", "PREPARE"],
    ["TOPPING", "PREPARE"],
    ["FINISH", "POST_BAKE"],
    ["CUT", "POST_BAKE"],
  ];

  for (const [step, phase] of WALK) {
    test(`fits the viewport with no ellipsis on active/next/locked labels (${phase}:${step})`, async ({ page }) => {
      await open(page, FULL, "FINISH,CUT", step, phase);
      const tabs = await expectStripFits(page, 7);
      for (const t of tabs) {
        if (t.state === "active" || t.state === "next" || t.state === "locked") {
          expect(t.clipped, `${t.name} (${t.state}) label must not be clipped`).toBe(false);
          expect(t.textShown).toBe(true);
        }
        if (t.state === "completed") {
          // either 「✓ 短縮ラベル」 fully shown, or 「✓」 alone -- never a half-clipped label
          if (t.textShown) expect(t.clipped, `${t.name} completed label must not be clipped`).toBe(false);
          expect(t.text.startsWith("✓")).toBe(true);
        }
        expect(t.width, `${t.name} stays wide enough to read`).toBeGreaterThanOrEqual(30);
      }
      // the active step always keeps its full label
      const active = tabs.find((t) => t.state === "active")!;
      expect(active.textShown).toBe(true);
    });
  }

  test("walking the whole strip by tapping only the next tab never needs a scroll or a multi-step jump", async ({ page }) => {
    await open(page, FULL, "FINISH,CUT", "DOUGH", "PREPARE");
    for (const next of ["ソース", "チーズ", "具材"]) {
      const enabled = page.getByRole("tab").and(page.locator(":not([disabled])"));
      await expect(enabled).toHaveCount(1);
      await expect(enabled).toHaveAccessibleName(next);
      const box = (await enabled.boundingBox())!;
      expect(box.width, "the tappable next tab is at least 44px wide").toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(40);
      await enabled.click();
      await expectStripFits(page, 7);
    }
    await expect(page.getByTestId("state")).toHaveText("PREPARE:TOPPING");
    await expect(page.getByRole("tab").and(page.locator(":not([disabled])"))).toHaveCount(0);
    // BAKE is never a tap target
    await page.locator(".making-step-tab--bake").click({ force: true });
    await expect(page.getByTestId("state")).toHaveText("PREPARE:TOPPING");
    await page.getByTestId("to-bake").click();
    await expectStripFits(page, 7);
    await page.getByTestId("to-post").click();
    await expect(page.getByRole("tab", { name: "仕上げ" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "カット" }).click();
    await expect(page.getByTestId("state")).toHaveText("POST_BAKE:CUT");
    await expectStripFits(page, 7);
  });

  test("every tab keeps its formal accessible name even when its visible label is compacted", async ({ page }) => {
    await open(page, FULL, "FINISH,CUT", "FINISH", "POST_BAKE");
    for (const name of ["生地", "ソース", "チーズ", "具材", "仕上げ", "カット"]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
  });
});

test.describe("CS-4a: strips within today's 6-tab ceiling keep their completed labels", () => {
  test("6 tabs (full recipe + カット): completed tabs still read 「✓ 短縮ラベル」, nothing clipped", async ({ page }) => {
    await open(page, FULL, "CUT", "CUT", "POST_BAKE");
    const tabs = await expectStripFits(page, 6);
    for (const t of tabs.filter((x) => x.state === "completed" && !x.isBake)) {
      expect(t.textShown, `${t.name} keeps its label with 6 tabs`).toBe(true);
      expect(t.clipped).toBe(false);
      expect(t.text).toBe(`✓ ${t.name}`);
    }
    // the completed BAKE indicator also keeps 「✓ 焼く」 within today's ceiling (as before CS-4a)
    const bake = tabs.find((t) => t.isBake)!;
    expect(bake.textShown, "completed 焼く keeps its label with 6 tabs").toBe(true);
    expect(bake.clipped).toBe(false);
    expect(bake.text).toBe("✓ 焼く");
    const active = tabs.find((t) => t.state === "active")!;
    expect(active.name).toBe("カット");
    expect(active.clipped).toBe(false);
  });

  test("4 tabs (no CUT): unchanged reading, all labels visible", async ({ page }) => {
    await open(page, "DOUGH,SAUCE,TOPPING", "", "TOPPING", "PREPARE");
    const tabs = await expectStripFits(page, 4);
    expect(tabs.every((t) => t.textShown && !t.clipped)).toBe(true);
  });
});

test.describe("CS-4a: long formal labels (unshipped FOLD / EDGE_FILL) on fixtures", () => {
  /** The label the player actually sees on the active / next tab: the visible one of the formal text and its short fallback. */
  async function visibleLabel(page: Page, name: string) {
    return page.evaluate((n) => {
      const tab = [...document.querySelectorAll<HTMLElement>(".making-step-tabs [role=tab]")].find(
        (t) => t.getAttribute("aria-label") === n,
      )!;
      const inner = tab.querySelector<HTMLElement>(".making-step-tab__inner")!;
      const shown = [...inner.querySelectorAll<HTMLElement>(".making-step-tab__text, .making-step-tab__alt")].filter(
        (el) => getComputedStyle(el).display !== "none",
      );
      return { text: shown.map((e) => e.textContent).join(""), clipped: inner.scrollWidth > inner.clientWidth + 1 };
    }, name);
  }

  for (const [pre, post, step, phase, shape] of [
    ["DOUGH,SAUCE,FOLD,TOPPING", "", "FOLD", "PREPARE", "5 tabs, FOLD active"],
    ["DOUGH,SAUCE,FOLD,TOPPING", "", "SAUCE", "PREPARE", "5 tabs, FOLD next"],
    ["DOUGH,SAUCE,CHEESE,FOLD", "FINISH,CUT", "FOLD", "PREPARE", "7 tabs, FOLD active"],
    ["DOUGH,SAUCE,CHEESE,FOLD", "FINISH,CUT", "CHEESE", "PREPARE", "7 tabs, FOLD next"],
    ["DOUGH,SAUCE,CHEESE,EDGE_FILL", "FINISH,CUT", "EDGE_FILL", "PREPARE", "7 tabs, EDGE_FILL active"],
    ["DOUGH,SAUCE,CHEESE,EDGE_FILL", "FINISH,CUT", "CHEESE", "PREPARE", "7 tabs, EDGE_FILL next"],
  ] as const) {
    test(`never ellipsizes the active / next label (${shape})`, async ({ page }) => {
      await open(page, pre, post, step, phase);
      const tabs = await expectStripFits(page, pre.split(",").length + post.split(",").filter(Boolean).length + 1);
      const formal = pre.includes("EDGE_FILL") ? "ふちづめ" : "折りたたみ";
      const label = await visibleLabel(page, formal);
      expect(label.clipped, `${formal} (${label.text}) must not be clipped`).toBe(false);
      expect(["折りたたみ", "折る", "ふちづめ", "ふち"]).toContain(label.text);
      // everything else on the strip still reads without ellipsis
      for (const t of tabs.filter((x) => x.state !== "completed" && !x.isBake)) expect(t.clipped, t.name).toBe(false);
    });
  }
});
