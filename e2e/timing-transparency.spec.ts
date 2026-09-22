import { test, expect } from "@playwright/test";
import {
  playFullCapricciosaRound,
  playFullMargheritaRound,
  playFullMarinaraRound,
  playFullQuattroFormaggiRound,
  startCapricciosaUnlocked,
  startFreshMargherita,
  startLunchRushMission,
  startMarinaraUnlocked,
  startQuattroFormaggiHeavyInventory,
} from "./gestures";

/**
 * Gameplay UX PR-C: Timing Transparency (Issue tracked under umbrella #176) -- see
 * docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit B/C and this PR's own Result
 * Report. Scope: `ResultPanel.tsx`'s new `.cooking-timing-summary` (a short always-visible
 * elapsed-time + 手際 headline, expandable into a native `<details>` per-step breakdown table),
 * fed by `../src/logic/cookingTimingDisplay.ts`'s `stepTimingRows` from data that already
 * existed (`cookingTiming.ts`'s `perStepElapsedMs`, `cookingProfiles.ts`'s per-recipe `steps`).
 *
 * These scenarios follow the task prompt's own lettering (Scenario A-E). Some of this ground is
 * also covered incidentally by `result-1screen-2.0.spec.ts` (RESULT 1-Screen 2.0's own overflow
 * budget, re-verified here to still hold with the Timing summary present) and
 * `dynamic-cooking-steps.spec.ts` (Marinara/Quattro-formaggi's own step-skip behavior during
 * PREPARE) -- this file is the dedicated, scenario-complete coverage for Timing Transparency
 * specifically, and does not re-derive ground those files already own.
 */

async function gameScreenOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.querySelector(".game-screen")!;
    return el.scrollHeight - el.clientHeight;
  });
}

test.describe("Scenario A: 390x844 Margherita full round -> RESULT", () => {
  test("Timing summary visible in the first viewport, zero overflow, CTA visible, details open and readable", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await page.waitForTimeout(200);

    // RESULT 1-Screen 2.0's own zero-overflow contract (PR #181) must still hold with the new
    // Timing summary present.
    expect(await gameScreenOverflow(page), "RESULT's default view must not overflow").toBeLessThanOrEqual(0);

    const vh = page.viewportSize()!.height;
    const timing = page.locator(".cooking-timing-summary");
    await expect(timing).toBeVisible();
    const box = await timing.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height, "Timing summary must fit within the first viewport").toBeLessThanOrEqual(vh + 1);
    await expect(timing).toContainText("調理時間");
    await expect(timing).toContainText("手際");

    const cta = page.getByRole("button", { name: "もう一度つくる" });
    await expect(cta).toBeVisible();

    // Open the Timing Detail -- margherita is a full-step, CUT-eligible recipe, so every step
    // (DOUGH/SAUCE/CHEESE/TOPPING/CUT) must have its own row.
    await timing.locator(".cooking-timing-summary__summary").click();
    await expect(timing).toHaveAttribute("open", "");
    await expect(timing).toContainText("生地");
    await expect(timing).toContainText("ソース");
    await expect(timing).toContainText("チーズ");
    await expect(timing).toContainText("具材");
    await expect(timing).toContainText("カット");
    // CUT time is measured but excluded from the 調理時間 total -- the disclaimer must be present.
    await expect(timing).toContainText("カットの時間は含みません");
  });
});

test.describe("Scenario B: 360x800 heavy recipe (Capricciosa) -> RESULT", () => {
  test("Timing summary visible, no horizontal clipping, CTA usable, details accessible", async ({ page }) => {
    test.setTimeout(60_000);
    await startCapricciosaUnlocked(page);
    await playFullCapricciosaRound(page);
    await page.waitForTimeout(200);

    const doc = await page.evaluate(() => ({
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(doc.docScrollWidth, "no horizontal overflow at 360x800").toBeLessThanOrEqual(doc.innerWidth);

    const timing = page.locator(".cooking-timing-summary");
    await expect(timing).toBeVisible();

    const cta = page.getByRole("button", { name: "もう一度つくる" });
    await expect(cta).toBeVisible();

    await timing.locator(".cooking-timing-summary__summary").click();
    await expect(timing).toHaveAttribute("open", "");
    await expect(timing).toContainText("生地");
    await expect(timing).toContainText("カット");
  });
});

test.describe("Scenario C: Marinara (no CHEESE step) -> RESULT -> Timing details", () => {
  test("Dynamic Steps: no チーズ tab during play, and the Timing Detail table never shows a CHEESE row", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startMarinaraUnlocked(page);
    await expect(page.getByRole("tab", { name: "チーズ" })).toHaveCount(0);

    await playFullMarinaraRound(page);
    await page.waitForTimeout(200);

    const timing = page.locator(".cooking-timing-summary");
    await expect(timing).toBeVisible();
    await timing.locator(".cooking-timing-summary__summary").click();
    await expect(timing).toHaveAttribute("open", "");
    await expect(timing).toContainText("生地");
    await expect(timing).toContainText("ソース");
    await expect(timing).toContainText("具材");
    await expect(timing.locator(".cooking-timing-summary__row", { hasText: "チーズ" })).toHaveCount(0);
  });
});

test.describe("Scenario D: Quattro-formaggi (no TOPPING step) -> RESULT -> Timing details", () => {
  test("Dynamic Steps: no 具材 tab during play, and the Timing Detail table never shows a TOPPING row", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startQuattroFormaggiHeavyInventory(page);
    await expect(page.getByRole("tab", { name: "具材" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "チーズ" })).toBeVisible();

    await playFullQuattroFormaggiRound(page);
    await page.waitForTimeout(200);

    const timing = page.locator(".cooking-timing-summary");
    await expect(timing).toBeVisible();
    await timing.locator(".cooking-timing-summary__summary").click();
    await expect(timing).toHaveAttribute("open", "");
    await expect(timing).toContainText("生地");
    await expect(timing).toContainText("チーズ");
    // "具材" is TOPPING's own label -- must be absent from the Timing Detail's own rows
    // specifically (the unrelated "くわしいスコアを見る" score-breakdown card also has a "具材"
    // feedback row, scoped away here since it is a different card entirely).
    await expect(timing.locator(".cooking-timing-summary__row", { hasText: "具材" })).toHaveCount(0);
  });
});

test.describe("Scenario E: Lunch Rush -- MissionClock semantics unchanged, no FREE Timing UI leak", () => {
  test("Mission RESULT shows its own existing fields; .cooking-timing-summary never renders in the Mission overlay", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await startLunchRushMission(page, 1);
    await page.waitForSelector(".mission-overlay__panel", { timeout: 8000 });

    // Lunch Rush RESULT is architecturally separate (MissionResultOverlay) -- confirm its own
    // pre-existing fields still render, untouched by this PR.
    await expect(page.getByText(/挑戦/)).toBeVisible();
    await expect(page.getByText(/成功/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /ホームへ/ })).toBeVisible();

    // The FREE-only Timing summary must never leak into Lunch Rush, anywhere on the page.
    expect(await page.locator(".cooking-timing-summary").count()).toBe(0);
  });
});
