import { test, expect } from "@playwright/test";
import {
  playFullMargheritaRound,
  startFreshMargherita,
  playFullCapricciosaRound,
  startCapricciosaUnlocked,
  startLunchRushMission,
  playFullMarinaraRound,
  startMarinaraUnlocked,
} from "./gestures";

/**
 * Gameplay UX PR-D: RESULT 1-Screen 2.0 (Issue #180, umbrella #176) -- see the Fresh Audit's §6
 * "Audit D -- RESULT 1-Screen" (docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md) and
 * the Result Report for this PR. Scope: the primary CTA row (`.result-panel__actions`) is now
 * `position: fixed` (same contract as every MAKING-phase `.prepare-bake-bar`), and RESULT's
 * first-view content (compact pizza hero, heading, stars/total, one-line CUT summary, one-line
 * Pitz summary) fits the first viewport with zero `.game-screen` overflow by default -- detail
 * breakdowns move into native `<details>`, no information deleted.
 *
 * These scenarios follow the task prompt's own lettering (Scenario A-E); some of this ground is
 * also covered incidentally by `viewport-1screen.spec.ts`'s own updated FREE RESULT describe
 * block -- this file is the dedicated, scenario-complete coverage for this PR specifically.
 */

async function gameScreenOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.querySelector(".game-screen")!;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflow: el.scrollHeight - el.clientHeight };
  });
}

async function docScrollState(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    docScrollHeight: document.documentElement.scrollHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
  }));
}

test.describe("Scenario A: FREE / Margherita / CUT -- first-view Tier 1 content, no scroll", () => {
  test("完成ピザ/★/total/CUT summary/Pitz/primary CTA all sit inside the first viewport", async ({ page }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await page.waitForTimeout(200);

    const vh = page.viewportSize()!.height;

    // Zero .game-screen overflow with details default-closed -- the actual "1-screen" claim.
    const overflow = await gameScreenOverflow(page);
    expect(overflow.overflow, "RESULT's default (details-closed) view must not overflow").toBeLessThanOrEqual(0);

    async function withinFirstView(selector: string, label: string) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box, `${label} (${selector}) must be present`).not.toBeNull();
      expect(box!.y, `${label} must not start above the viewport`).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, `${label} must fit within the first viewport`).toBeLessThanOrEqual(vh + 1);
    }

    await withinFirstView(".pizza-dough", "完成ピザ");
    await withinFirstView(".result-panel__stars", "★評価");
    await withinFirstView(".result-panel__score", "総合点");
    await withinFirstView(".cut-evaluation-summary__summary", "CUT summary");
    await withinFirstView(".pitz-credit-summary__headline", "獲得Pitz");
    await withinFirstView(".result-panel__actions", "primary CTA");

    const cta = page.getByRole("button", { name: "もう一度つくる" });
    await expect(cta).toBeVisible();
  });
});

test.describe("Scenario B: 360x800 -- heavy RESULT (Capricciosa, CUT + max toppings)", () => {
  test("CTA usable, no horizontal overflow, summary visible, details open/close normal", async ({ page }) => {
    test.setTimeout(60_000);
    await startCapricciosaUnlocked(page);
    await playFullCapricciosaRound(page);
    await page.waitForTimeout(200);

    const doc = await docScrollState(page);
    expect(doc.docScrollWidth, "no horizontal overflow at 360x800").toBeLessThanOrEqual(doc.innerWidth);
    expect(doc.docScrollHeight, "page itself must never scroll").toBeLessThanOrEqual(doc.innerHeight);

    // Primary CTA usable (visible + clickable) without any scroll.
    const cta = page.getByRole("button", { name: "もう一度つくる" });
    await expect(cta).toBeVisible();
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(doc.innerHeight + 1);

    // Important summary (stars/total/CUT/Pitz headline) all visible.
    await expect(page.locator(".result-panel__stars")).toBeVisible();
    await expect(page.locator(".result-panel__score")).toBeVisible();
    await expect(page.locator(".cut-evaluation-summary__summary")).toBeVisible();
    await expect(page.locator(".pitz-credit-summary__headline")).toBeVisible();

    // Details open/close works normally -- a real tap toggles the native <details>.
    const cutDetails = page.locator(".cut-evaluation-summary");
    await expect(cutDetails).not.toHaveAttribute("open", "");
    await page.locator(".cut-evaluation-summary__summary").click();
    await expect(cutDetails).toHaveAttribute("open", "");
    await page.locator(".cut-evaluation-summary__summary").click();
    await expect(cutDetails).not.toHaveAttribute("open", "");
  });
});

test.describe("Scenario C: details expanded -- score/CUT/reward detail all present, CTA stays intact", () => {
  test("opening every <details> reveals score/CUT/Pitz breakdowns, none lost; scrollable; CTA unaffected", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await page.waitForTimeout(200);

    // Score breakdown detail. Gameplay UX PR-C added its own "具材" (TOPPING) row inside the
    // Timing Detail table (`.cooking-timing-summary`), so these queries are now scoped to
    // `.result-panel__details` specifically to stay unambiguous.
    await page.locator(".result-panel__details-summary").click();
    const scoreDetails = page.locator(".result-panel__details");
    await expect(scoreDetails).toHaveAttribute("open", "");
    await expect(scoreDetails.getByText("具材")).toBeVisible();
    await expect(scoreDetails.getByText("配置")).toBeVisible();
    await expect(page.locator(".score-bar__label", { hasText: "焼き" })).toBeVisible();
    await expect(scoreDetails.getByText("ソース")).toBeVisible();

    // CUT detail.
    await page.locator(".cut-evaluation-summary__summary").click();
    await expect(page.locator(".cut-evaluation-summary")).toHaveAttribute("open", "");
    await expect(page.getByText("均等さ")).toBeVisible();
    await expect(page.getByText("中心")).toBeVisible();
    await expect(page.getByText("切り分け")).toBeVisible();

    // Pitz reward detail.
    await page.locator(".pitz-credit-summary__breakdown-summary").click();
    await expect(page.locator(".pitz-credit-summary__breakdown")).toHaveAttribute("open", "");
    await expect(page.getByText("基本報酬")).toBeVisible();
    await expect(page.getByText("出来栄え倍率")).toBeVisible();
    await expect(page.getByText("所持Pitz")).toBeVisible();

    // Now over-height (real content, not a bug) -- scrollable, page itself never scrolls.
    const overflow = await gameScreenOverflow(page);
    expect(overflow.overflow).toBeGreaterThan(0);
    const doc = await docScrollState(page);
    expect(doc.docScrollHeight).toBeLessThanOrEqual(doc.innerHeight);

    // CTA row remains fixed/functional -- scroll .game-screen fully, confirm the CTA never moves
    // and stays clickable.
    const ctaBefore = await page.locator(".result-panel__actions").boundingBox();
    await page.evaluate(() => {
      const el = document.querySelector(".game-screen")!;
      el.scrollTo(0, el.scrollHeight);
    });
    await page.waitForTimeout(100);
    const ctaAfter = await page.locator(".result-panel__actions").boundingBox();
    expect(Math.round(ctaAfter!.y)).toBe(Math.round(ctaBefore!.y));

    const onBackButton = page.getByRole("button", { name: "別のピザを作る" });
    await expect(onBackButton).toBeVisible();
    await onBackButton.click();
    await expect(page.locator(".pizza-select-screen")).toBeVisible();
  });
});

test.describe("Scenario D: Lunch Rush RESULT regression (PR #175 fields unaffected)", () => {
  test("挑戦数/成功/失敗/成功率/score/Pitz/HOME all present, RESULT 1-Screen 2.0 changes did not touch Lunch Rush", async ({
    page,
  }) => {
    await startLunchRushMission(page, 1);
    await page.waitForSelector(".mission-overlay__panel", { timeout: 8000 });

    // Lunch Rush RESULT is architecturally separate (MissionResultOverlay), never touched by
    // this PR's ResultPanel/.pizza-stage--result changes -- confirm its own fields still render.
    await expect(page.getByText(/挑戦/)).toBeVisible();
    await expect(page.getByText(/成功/).first()).toBeVisible();
    await expect(page.getByText(/成功率/)).toBeVisible();
    await expect(page.getByRole("button", { name: /ホームへ/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "もう一度" })).toBeVisible();

    // No .pizza-stage--result / .result-panel leakage into the Mission overlay.
    expect(await page.locator(".mission-overlay .pizza-stage--result").count()).toBe(0);
  });
});

test.describe("Scenario E: Dynamic Steps regression (PR #179) through RESULT 1-Screen 2.0", () => {
  test("Marinara (no CHEESE step) -> BAKE -> CUT -> RESULT 1-Screen, no overflow", async ({ page }) => {
    test.setTimeout(60_000);
    await startMarinaraUnlocked(page);
    await playFullMarinaraRound(page);
    await page.waitForTimeout(200);

    await expect(page.locator(".pizza-stage--result")).toBeVisible();
    const overflow = await gameScreenOverflow(page);
    expect(overflow.overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("button", { name: "もう一度つくる" })).toBeVisible();
  });

  // quattro-formaggi (the repo's own no-TOPMING-step fixture, PR #179) already has dedicated
  // PREPARE-level tray-overflow coverage (viewport-1screen.spec.ts's own "quattro-formaggi heavy
  // inventory" test) and a generic dynamic-step-aware Lunch Rush walkthrough
  // (dynamic-cooking-steps.spec.ts Scenario D) -- Marinara above is this file's own full-round,
  // real-UI-gesture regression through RESULT 1-Screen specifically, satisfying the task's own
  // "Marinaraまたはquattro-formaggi" either/or requirement without duplicating hand-rolled
  // gesture code neither `gestures.ts` nor any existing spec already exposes as a helper.
});
