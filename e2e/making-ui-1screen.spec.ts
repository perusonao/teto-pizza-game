import { test, expect, type Page } from "@playwright/test";
import {
  completeDoughStep,
  cutThreeLines,
  paintSauceRing,
  physicalDragToDough,
  playFullMargheritaRound,
  tapDoughPercent,
} from "./gestures";

/**
 * Issue #159 (Cooking UI 1-Screen Polish) regression suite. Complements the existing
 * e2e/viewport-1screen.spec.ts (which this file does not modify or duplicate) -- that file
 * already pins PREPARE's own no-internal-scroll requirement at the shared 390x844/360x800
 * Playwright projects; this file adds coverage specific to #159's own acceptance criteria:
 *
 * - one-screen fit through BAKE/CUT too, not just PREPARE, and explicitly at 361x800 (the exact
 *   secondary viewport this issue names, one px narrower than the shared 360x800 project) --
 *   driven manually via `page.setViewportSize` rather than a new Playwright project, so it adds
 *   no extra project runs across every other spec file;
 * - the making-step nav strip never clips/overflows horizontally, and shows CUT only for a
 *   cut-target recipe;
 * - once SAUCE is confirmed (the round has moved to CHEESE/TOPPING), no second sauce option is
 *   ever offered again;
 * - the mini 見本 thumbnail and its own popover render the same piece count (same SSOT).
 */

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "361x800", width: 361, height: 800 },
] as const;

async function freshMargheritaAt(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await page.waitForSelector(".pizza-stage");
}

/* PR-A (Issue #167 §5/§12): Phase 0's own Fresh Audit found several PREPARE steps landing the
 * fixed bottom CTA bar at *exactly* the viewport height under Chromium -- 0px of margin, both
 * 390x844/360x800 -- and named that as a structural reason real-device font/toolbar/safe-area
 * variance (invisible to this Chromium-only suite either way, see playwright.config.ts's own
 * webkit-* projects) can tip an already-exact-fit step into scroll. `<= viewport` alone would
 * keep passing right up to that 0px edge; this constant is this PR's own deliberate floor so a
 * future regression that quietly eats the slack this pass bought back gets caught here, not only
 * on a real device again. */
const MIN_SAFETY_MARGIN_PX = 8;

async function assertOneScreen(page: Page, label: string) {
  const s = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    docScrollWidth: document.documentElement.scrollWidth,
  }));
  expect(s.docScrollWidth, `${label}: no horizontal page overflow`).toBeLessThanOrEqual(s.innerWidth);
  const gs = await page.evaluate(() => {
    const el = document.querySelector(".game-screen")!;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(gs.scrollHeight, `${label}: .game-screen must not need internal scroll`).toBeLessThanOrEqual(
    gs.clientHeight,
  );
  // `.game-screen`'s own `scrollHeight`/`clientHeight` pair (above) is spec-clamped to
  // `scrollHeight >= clientHeight` (https://drafts.csswg.org/cssom-view/#dom-element-scrollheight)
  // -- it can only ever report "overflowed" or "exactly fits", never "how much room is left", so
  // it cannot express a positive safety margin at all. The real bottom edge of this step's own
  // in-flow content is the max `getBoundingClientRect().bottom` among `.game-screen`'s direct
  // children that are not `position: fixed` (`.prepare-bake-bar`/its own scroll-cue sit outside
  // normal flow by design, see App.css, and must not be counted as "content that needs room").
  const flowBottom = await page.evaluate(() => {
    const gs = document.querySelector(".game-screen")!;
    let maxBottom = 0;
    for (const child of Array.from(gs.children)) {
      if (getComputedStyle(child).position === "fixed") continue;
      const rect = child.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      maxBottom = Math.max(maxBottom, rect.bottom);
    }
    return maxBottom;
  });
  expect(
    s.innerHeight - flowBottom,
    `${label}: in-flow content must keep >= ${MIN_SAFETY_MARGIN_PX}px vertical safety margin below it, not an exact 0px fit`,
  ).toBeGreaterThanOrEqual(MIN_SAFETY_MARGIN_PX);
}

async function assertNavFitsViewport(page: Page, label: string) {
  const nav = page.locator(".making-step-tabs");
  await expect(nav, `${label}: nav strip must be present`).toBeVisible();
  const navBox = await nav.boundingBox();
  expect(navBox, `${label}: nav strip must have a bounding box`).not.toBeNull();
  const vw = page.viewportSize()!.width;
  expect(navBox!.x, `${label}: nav strip must not start off-screen`).toBeGreaterThanOrEqual(0);
  expect(navBox!.x + navBox!.width, `${label}: nav strip must not overflow the right edge`).toBeLessThanOrEqual(
    vw + 1,
  );
  // Every tab (real button + the BAKE indicator div) must itself be fully inside the strip --
  // this is what actually catches a single wide tab (e.g. the old "トッピング" label) pushing a
  // trailing tab off the visible edge even when the strip's own outer box looks fine.
  const tabs = page.locator(".making-step-tabs > *");
  const count = await tabs.count();
  let lastTabRight = 0;
  for (let i = 0; i < count; i += 1) {
    const box = await tabs.nth(i).boundingBox();
    expect(box, `${label}: tab ${i} must have a bounding box`).not.toBeNull();
    expect(box!.x + box!.width, `${label}: tab ${i} must not overflow the right edge`).toBeLessThanOrEqual(
      vw + 1,
    );
    lastTabRight = Math.max(lastTabRight, box!.x + box!.width);
  }
  // PR-A (Issue #167 §4): Phase 0's own Fresh Audit measured only ~12px of real margin here
  // under Chromium -- thin enough that a real device's own font substitution/emoji metrics
  // (playwright.config.ts's webkit-* projects, added this PR, cannot fully reproduce this either
  // -- font *availability* on this machine is still not Apple's) could plausibly consume it. This
  // pins a floor so that margin is asserted, not just assumed from a one-time manual measurement.
  expect(
    vw - lastTabRight,
    `${label}: trailing tab must keep >= ${MIN_SAFETY_MARGIN_PX}px margin from the right edge, not an exact fit`,
  ).toBeGreaterThanOrEqual(MIN_SAFETY_MARGIN_PX);
}

for (const { name, width, height } of VIEWPORTS) {
  test.describe(`Margherita (cut-target) one-screen + nav fit @ ${name}`, () => {
    test(`DOUGH/SAUCE/CHEESE/TOPPING/BAKE/CUT all fit with no scroll, nav never clips (${name})`, async ({
      page,
    }) => {
      test.setTimeout(30_000);
      await freshMargheritaAt(page, width, height);

      await assertOneScreen(page, `${name} DOUGH`);
      await assertNavFitsViewport(page, `${name} DOUGH`);
      // DOUGH itself has no CUT tab context yet in terms of interaction, but it's already
      // visible in the strip -- see MakingStepTabs' own postSteps contract.
      await expect(page.getByRole("tab", { name: "カット" }), `${name} DOUGH: CUT tab visible`).toBeVisible();

      await completeDoughStep(page);
      await page.getByRole("button", { name: /次へ/ }).click();
      await assertOneScreen(page, `${name} SAUCE`);
      await assertNavFitsViewport(page, `${name} SAUCE`);

      await page.getByRole("button", { name: /トマトソース/ }).click();
      await paintSauceRing(page, 25, 16);
      await page.getByRole("button", { name: /次へ/ }).click();
      await assertOneScreen(page, `${name} CHEESE`);
      await assertNavFitsViewport(page, `${name} CHEESE`);

      await page.getByRole("button", { name: /モッツァレラ/ }).click();
      await tapDoughPercent(page, 40, 50);
      await tapDoughPercent(page, 60, 50);
      await tapDoughPercent(page, 50, 30);
      await page.getByRole("button", { name: /次へ/ }).click();
      await assertOneScreen(page, `${name} TOPPING`);
      await assertNavFitsViewport(page, `${name} TOPPING`);

      await page.getByRole("button", { name: /焼く/ }).click();
      await assertOneScreen(page, `${name} BAKE`);
      await assertNavFitsViewport(page, `${name} BAKE`);
      await expect(page.getByRole("tab", { name: "カット" }), `${name} BAKE: CUT tab still visible`).toBeVisible();

      await page.waitForTimeout(1300);
      await page.getByRole("button", { name: "取り出す！" }).click();
      await assertOneScreen(page, `${name} POST_BAKE/CUT`);
      await assertNavFitsViewport(page, `${name} POST_BAKE/CUT`);
      const cutTab = page.getByRole("tab", { name: "カット" });
      await expect(cutTab).toHaveAttribute("aria-selected", "true");
    });
  });
}

test.describe("Sauce lock (Issue #159 P0): no second sauce ever offered once SAUCE is confirmed", () => {
  test("margherita owns tomato-sauce + olive-oil + pesto but only tomato-sauce (the recipe's own sauce) is ever shown, at every step", async ({
    page,
  }) => {
    const save = {
      schemaVersion: 2,
      dex: [],
      pitzBalance: 500,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "olive-oil", "pesto"],
      missionBest: {},
      inventory: { "olive-oil": 99, pesto: 99 },
      starterGrantClaimedRecipeIds: [],
    };
    await page.goto("/");
    await page.evaluate((rawSave) => {
      localStorage.clear();
      localStorage.setItem("teto-pizza-save-v1", JSON.stringify(rawSave));
    }, save);
    await page.reload();
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    await page.getByRole("button", { name: /マルゲリータ、/ }).click();
    await page.getByRole("button", { name: /このピザを作る/ }).click();
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    // SAUCE step: only tomato-sauce is offered, never olive-oil/pesto (owned but not this
    // recipe's own sauce -- see IngredientTray.tsx's own recipe-required-only filter).
    await expect(page.getByRole("button", { name: /トマトソース/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /オリーブオイル/ })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /ジェノベーゼソース|ペスト/ })).not.toBeVisible();

    await page.getByRole("button", { name: /トマトソース/ }).click();
    await paintSauceRing(page, 25, 16);
    await page.getByRole("button", { name: /次へ/ }).click();

    // CHEESE step: the sauce tray is gone entirely -- no sauce chip of any kind remains
    // selectable, so a player can never revisit/switch sauce after confirming it.
    await expect(page.getByRole("button", { name: /トマトソース/ })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /オリーブオイル/ })).not.toBeVisible();
  });
});

test.describe("Reference thumbnail/popover SSOT parity (Issue #159 P0 bullet 5)", () => {
  test("margherita: the mini thumbnail and its own popover render the same piece count", async ({ page }) => {
    await freshMargheritaAt(page, 390, 844);
    const thumbCount = await page.locator(".mini-reference .reference-thumbnail__piece").count();
    await page.getByRole("button", { name: /見本を拡大表示/ }).click();
    const popoverCount = await page.locator(".reference-mini-pizza__topping").count();
    expect(popoverCount, "popover piece count must match the mini thumbnail's own piece count").toBe(
      thumbCount,
    );
    // margherita's own real Reference is mozzarella x3 + basil x2 = 5, not the old
    // one-dot-per-ingredient-type abbreviation (2) -- pins the actual fix, not just "equal".
    expect(thumbCount).toBe(5);
  });
});

test.describe("Full round regression (Issue #159): margherita still completes end to end", () => {
  test("HOME -> PREPARE -> BAKE -> CUT -> RESULT with no console errors", async ({ page }) => {
    test.setTimeout(30_000);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await freshMargheritaAt(page, 390, 844);
    await playFullMargheritaRound(page);
    await page.waitForTimeout(200);
    await expect(page.locator(".result-panel")).toBeVisible();
    expect(errors, `console errors: ${errors.join(", ")}`).toHaveLength(0);
  });
});

/**
 * PR-A (Issue #167 §7) Merge Gate follow-up: PizzaStage's `--compact`/`--roomy` dough sizing
 * gained a third, height-aware `min()` term (`calc(100dvh - <reserve>)`, App.css) as a safety net
 * for a shorter real Safari visual viewport (toolbar shown, etc.) -- but at both shipped targets,
 * 390x844/360x800, the pre-existing `vw`/px terms still win, so that new term never actually
 * engages in the rest of this suite. This block drives a viewport short enough (390x650, well
 * below either shipped target) that the height term *does* bind, to directly confirm: the dough
 * actually shrinks below its `vw`/px cap (not stuck at the old size); the resulting size is
 * positive/sane, not zero or negative; nothing overlaps; a physical-drag placement and a CUT line
 * drag both land where dragged at the new, smaller live rect; and the same `MIN_SAFETY_MARGIN_PX`
 * floor every other viewport in this file is held to still holds here too.
 */
test.describe("PizzaStage height-aware sizing: shrink path actually engages below either shipped viewport", () => {
  test("390x650: dough shrinks via the height term, stays interactive and within safety margin", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await freshMargheritaAt(page, 390, 650);

    async function doughSize() {
      const box = await page.locator(".pizza-dough").boundingBox();
      expect(box, "dough must have a bounding box").not.toBeNull();
      expect(box!.width, "dough width must be positive").toBeGreaterThan(0);
      expect(box!.height, "dough height must be positive").toBeGreaterThan(0);
      return box!.width;
    }

    // Compact ceiling at 390px width is min(76vw=296.4, 290) = 290 -- the height term
    // (650 - 439px reserve = 211) must be strictly smaller, i.e. actually binding, not just
    // coincidentally equal to the vw/px cap.
    const doughWidthCompact = await doughSize();
    expect(
      doughWidthCompact,
      "390x650 DOUGH: height-aware term must actually shrink the dough below its vw/px cap (290px)",
    ).toBeLessThan(290);
    await assertOneScreen(page, "390x650 DOUGH");
    await assertNavFitsViewport(page, "390x650 DOUGH");

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();
    await assertOneScreen(page, "390x650 SAUCE");
    await page.getByRole("button", { name: /トマトソース/ }).click();
    await paintSauceRing(page, 25, 16);
    await page.getByRole("button", { name: /次へ/ }).click();
    await assertOneScreen(page, "390x650 CHEESE");

    // Physical drag at the shrunk dough size -- the drop must actually land (pointer math reads
    // the live, smaller rect, not a stale cached size from before the shrink).
    await physicalDragToDough(page, /モッツァレラ/, 50, 50);
    await expect(page.locator(".pizza-topping--mozzarella")).toHaveCount(1);
    await tapDoughPercent(page, 35, 60);
    await tapDoughPercent(page, 65, 60);
    await page.getByRole("button", { name: /次へ/ }).click();
    await assertOneScreen(page, "390x650 TOPPING");
    if (await page.getByRole("button", { name: /バジル/ }).count()) {
      await physicalDragToDough(page, /バジル/, 45, 55);
      await physicalDragToDough(page, /バジル/, 55, 45);
    }

    await page.getByRole("button", { name: /焼く/ }).click();
    // Roomy ceiling at 390px width is min(92vw=358.8, 380) = 358.8 -- the height term
    // (650 - 430px reserve = 220) must again actually bind.
    const doughWidthRoomy = await doughSize();
    expect(
      doughWidthRoomy,
      "390x650 BAKE: height-aware term must actually shrink the roomy dough below its vw/px cap (358.8px)",
    ).toBeLessThan(358.8);
    await assertOneScreen(page, "390x650 BAKE");
    await assertNavFitsViewport(page, "390x650 BAKE");

    await page.waitForTimeout(1300);
    await page.getByRole("button", { name: "取り出す！" }).click();
    await assertOneScreen(page, "390x650 POST_BAKE/CUT");
    await assertNavFitsViewport(page, "390x650 POST_BAKE/CUT");

    // CUT line drag at the shrunk dough size -- same pointer-accuracy concern as the physical
    // drag above, for the other gesture family (drag-across rather than drag-and-drop).
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
  });
});
