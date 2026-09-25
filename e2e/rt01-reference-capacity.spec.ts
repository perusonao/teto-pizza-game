import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * RT-01b (docs/reports/TETO_RT01_REFERENCE-PIECE-CAPACITY_Fresh-Design.md, Owner Decision
 * RT-01-OD-1): real-browser layout check of the shared reference placement. Runs on every
 * project (Chromium iphone-* locally, WebKit webkit-* in CI).
 *
 * Uses the dev-only harness e2e/harness/rt01-reference.html, which renders the real production
 * reference components (popover mini pizza, ReferenceThumbnail at 64px and at the 48px mini 見本
 * size, and Recipe Select's PizzaThumbnail) for the 15 shipped recipes and for synthetic,
 * unregistered 9/10/12/15-piece recipes built from shipped ingredients only.
 */

const HARNESS = "e2e/harness/rt01-reference.html";

async function pieceCentres(view: Locator, selector: string) {
  const boxes = await view.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }),
  );
  return boxes;
}

function minDistance(points: { x: number; y: number }[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      best = Math.min(best, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return best;
}

async function openHarness(page: Page, query: string) {
  await page.goto(`${HARNESS}?${query}`);
  await expect(page.locator(".rt01-case").first()).toBeVisible();
}

test.describe("RT-01 reference placement", () => {
  test("shipped recipes: every reference piece is drawn at its own position", async ({ page }) => {
    await openHarness(page, "section=shipped");
    const cases = page.locator(".rt01-case");
    await expect(cases).toHaveCount(15);
    for (let i = 0; i < 15; i += 1) {
      const row = cases.nth(i);
      const total = Number(await row.getAttribute("data-total"));
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(8);
      const popover = await pieceCentres(row.locator('[data-view="popover-140"]'), ".player-reference-mini-pizza__piece");
      expect(popover).toHaveLength(total);
      if (total > 1) expect(minDistance(popover)).toBeGreaterThan(5);
    }
  });

  for (const [caseId, total] of [["p9", 9], ["p10", 10], ["p12", 12], ["p15", 15]] as const) {
    test(`${total} pieces: no stacked pieces in the popover, 64px and 48px mini reference`, async ({ page }) => {
      await openHarness(page, `only=${caseId}`);
      const row = page.locator(`.rt01-case[data-case="${caseId}"]`);
      await expect(row).toHaveAttribute("data-total", String(total));

      const popover = await pieceCentres(row.locator('[data-view="popover-140"]'), ".player-reference-mini-pizza__piece");
      expect(popover).toHaveLength(total);
      // 140px popover (128px inner): the approved layout keeps centres >= 18.2% apart.
      expect(minDistance(popover)).toBeGreaterThan(128 * 0.18);

      for (const view of ["thumb-64", "mini-48"]) {
        const centres = await pieceCentres(row.locator(`[data-view="${view}"]`), ".reference-thumbnail__piece");
        expect(centres).toHaveLength(total);
        const inner = view === "thumb-64" ? 56 : 40;
        expect(minDistance(centres)).toBeGreaterThan(inner * 0.18);
      }
    });
  }
});
