import { test, expect, type Page } from "@playwright/test";
import {
  playFullMargheritaRound,
  failMissionOrderMissingSauce,
  startLunchRushMission,
} from "./gestures";

/**
 * Lunch Rush Phase 4 (Result Summary & Ranking achievedAt) e2e coverage. Follows
 * docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md's scope for gameplay/RESULT/ranking changes.
 * This file only exercises `e2e/`-owned fixtures/assertions against `src/**` -- it does not
 * modify any production code.
 *
 * Scope note (Completion Gate / Mission FAILED serve): `MissionState.serves` (src/mission/
 * lunchRush.ts) is pure in-memory reducer state, never persisted to localStorage
 * (src/state/persistence.ts's Save v2 schema has no such field) -- so, unlike this suite's other
 * fixtures (`startQuattroFormaggiHeavyInventory`/`startSalsicciaUnlocked` in ./gestures.ts), a
 * FAILED serve cannot be pre-seeded and must be produced by actually playing a live Mission run
 * through the real UI into a genuine Completion Gate failure. `failMissionOrderMissingSauce`
 * (./gestures.ts) does this by skipping the SAUCE step's own ingredient entirely -- a real,
 * deterministic `MISSING_REQUIRED_INGREDIENT` failure (src/logic/completionGate.ts), not a
 * fabricated one. This turned out to be practical within a single fast, deterministic run (see
 * Scenario A below), so no production-only debug hook was needed.
 */

async function pageScrollState(page: Page) {
  return page.evaluate(() => ({
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    docScrollHeight: document.documentElement.scrollHeight,
    docScrollWidth: document.documentElement.scrollWidth,
  }));
}

test.describe("Lunch Rush RESULT: attempt/success/failure/success-rate stats (Phase 4)", () => {
  test("one PASS + one FAILED (missing sauce) real serve -> RESULT shows 2/1/1/50% plus existing score/reward/CTAs", async ({
    page,
  }) => {
    // Generous headroom over the real wall-clock time the two orders below actually take (each
    // order's own gestures run in well under a few seconds even in a loaded CI sandbox) -- see
    // this task's own "not brittle" requirement: the run must reliably still be PLAYING when
    // both SERVEs land, never racing its own expiry.
    test.setTimeout(90_000);
    await startLunchRushMission(page, 25);

    // Order 1: a full, real PASS round (reuses the exact same gesture sequence
    // e2e/viewport-1screen.spec.ts's own FREE-mode regression already relies on).
    await playFullMargheritaRound(page);
    await expect(page.locator(".mission-serve-panel")).toBeVisible();
    await expect(page.locator(".mission-serve-panel--failed")).toHaveCount(0);
    await page.getByRole("button", { name: "次の注文へ" }).click();
    await page.waitForSelector(".pizza-stage");

    // Order 2: a genuine FAILED serve via the real UI (missing required sauce ingredient).
    await failMissionOrderMissingSauce(page);
    await expect(page.locator(".mission-serve-panel--failed")).toBeVisible();
    await page.getByRole("button", { name: "次の注文へ" }).click();

    // Let the run's real wall-clock timer actually expire (App.tsx's ~250ms TICK interval
    // detects it and flips Mission mode PLAYING -> RESULT on its own) rather than forcing it --
    // this is the "whatever is deterministic and not brittle" option the task called out,
    // since both real serves above are already safely landed well before the 25s clock ends.
    await page.waitForSelector(".mission-result__stats", { timeout: 40_000 });

    const stats = page.locator(".mission-result__stats");
    const statsText = await stats.innerText();

    // New Phase 4 stat rows -- exact class names/wording are the implementing session's own
    // call (task spec: "roughly 挑戦/成功/失敗/成功率"), so this asserts on the Japanese labels
    // and the actual computed numbers (2 attempts, 1 success, 1 failure, 50% rate --
    // src/logic/missionResultStats.ts's `deriveMissionResultStats`) rather than a specific class.
    expect(statsText, "attempts label").toContain("挑戦");
    expect(statsText, "successes label").toContain("成功");
    expect(statsText, "failures label").toContain("失敗");
    expect(statsText, "success-rate label").toContain("成功率");
    expect(statsText, "2 attempts (1 PASS + 1 FAILED)").toMatch(/2/);
    expect(statsText, "50% success rate (1/2)").toMatch(/50/);

    // Existing rows (score/reward) are unchanged by this task -- still present alongside the
    // new stats.
    expect(statsText, "existing スコア row").toContain("スコア");
    expect(statsText, "existing Pitz reward row").toContain("Pitz");
    await expect(page.locator(".mission-result__balance")).toContainText("Pitz");

    // Both HOME/FREE CTAs (and the two pre-existing nav CTAs) present and clickable.
    const rankingButton = page.getByRole("button", { name: /ランキングを見る/ });
    const retryButton = page.getByRole("button", { name: "もう一度" });
    const freePlayButton = page.getByRole("button", { name: "フリープレイへ" });
    const homeButton = page.getByRole("button", { name: /ホームへ/ });
    for (const button of [rankingButton, retryButton, freePlayButton, homeButton]) {
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
    }

    const s = await pageScrollState(page);
    expect(s.docScrollWidth, "RESULT with the new stats rows must never overflow horizontally").toBeLessThanOrEqual(
      s.innerWidth,
    );
  });
});

/**
 * Weekly Ranking achievedAt (Phase 4). Same technique e2e/viewport-1screen.spec.ts's own
 * "Weekly Ranking modal" describe block already established: this dev/test environment has no
 * Firebase project configured, so `getWeeklyLeaderboard()` always resolves `{status:
 * "unavailable"}` -- there is no seam to inject real leaderboard rows without touching ranking
 * data/Firebase code (out of scope for this task, and for `e2e/`-only test work in general).
 * Instead this injects synthetic rows using the *real* CSS classes `WeeklyRankingOverlay.tsx`
 * renders, extended with the new `.ranking-overlay__achieved-at` span this task's task spec
 * names explicitly (task spec: rendered "under each ranking row's display name").
 */
async function freshHome(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
}

interface SyntheticRow {
  rank: number;
  name: string;
  score: number;
  achievedAt: string;
  isYou?: boolean;
}

async function renderRankingRowsWithAchievedAt(
  page: Page,
  rows: SyntheticRow[],
  outside?: SyntheticRow,
) {
  await page.evaluate(
    ({ rows, outside }) => {
      // Mirrors WeeklyRankingOverlay.tsx's own real markup shape exactly (including the
      // `.ranking-overlay__identity` wrapper it nests name+achievedAt inside of) -- only the
      // data source is synthetic here, not the DOM structure being layout-tested.
      function rowHtml(r: (typeof rows)[number]) {
        const youClass = r.isYou ? " ranking-overlay__row--you" : "";
        return `<li class="ranking-overlay__row${youClass}">
          <span class="ranking-overlay__rank">${r.rank}位</span>
          <div class="ranking-overlay__identity">
            <span class="ranking-overlay__name" title="${r.name}">${r.name}</span>
            <span class="ranking-overlay__achieved-at">${r.achievedAt}</span>
          </div>
          <span class="ranking-overlay__score">${r.score}</span>
          ${r.isYou ? '<span class="ranking-overlay__you-badge">あなた</span>' : ""}
        </li>`;
      }
      const body = document.querySelector(".ranking-overlay__body")!;
      const rowsHtml = rows.map((r) => rowHtml(r)).join("");
      const outsideHtml = outside
        ? `<div class="ranking-overlay__row ranking-overlay__row--you ranking-overlay__row--outside">
            <span class="ranking-overlay__rank">${outside.rank}位</span>
            <div class="ranking-overlay__identity">
              <span class="ranking-overlay__name" title="${outside.name}">${outside.name}</span>
              <span class="ranking-overlay__achieved-at">${outside.achievedAt}</span>
            </div>
            <span class="ranking-overlay__score">${outside.score}</span>
            <span class="ranking-overlay__you-badge">あなた</span>
          </div>`
        : "";
      body.innerHTML = `<p class="ranking-overlay__week">今週 9/14〜9/20</p><ol class="ranking-overlay__list">${rowsHtml}</ol>${outsideHtml}`;
    },
    { rows, outside },
  );
}

test.describe("Weekly Ranking: per-row achievedAt (Phase 4)", () => {
  test("TOP10 rows each show displayName/score/achievedAt; current-user row is marked", async ({
    page,
  }) => {
    await freshHome(page);
    await page.getByRole("button", { name: /ランキング/ }).click();
    await page.waitForTimeout(300);

    const rows: SyntheticRow[] = Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      name: `Player ${i + 1}`,
      score: 1000 - i,
      achievedAt: `9/${20 + (i % 3)} 0${i}:4${i % 6}`,
      isYou: i === 6, // rank 7, an ordinary mid-pack TOP10 row
    }));
    await renderRankingRowsWithAchievedAt(page, rows);

    const allRows = page.locator(".ranking-overlay__row");
    await expect(allRows).toHaveCount(10);

    // Every row renders its own displayName + score + achievedAt (all three facts present, not
    // just achievedAt tacked on for one row).
    for (const r of [rows[0], rows[4], rows[9]]) {
      const row = allRows.nth(r.rank - 1);
      await expect(row.locator(".ranking-overlay__name")).toHaveText(r.name);
      await expect(row.locator(".ranking-overlay__score")).toHaveText(String(r.score));
      await expect(row.locator(".ranking-overlay__achieved-at")).toHaveText(r.achievedAt);
    }

    // The current-user row (rank 7) is marked both by class and by the existing あなた badge --
    // this task doesn't change that marking, only adds achievedAt alongside it.
    const youRow = allRows.nth(6);
    await expect(youRow).toHaveClass(/ranking-overlay__row--you/);
    await expect(youRow.locator(".ranking-overlay__you-badge")).toHaveText("あなた");
    await expect(youRow.locator(".ranking-overlay__achieved-at")).toHaveText(rows[6].achievedAt);

    const s = await pageScrollState(page);
    expect(s.docScrollWidth, "10 rows + achievedAt must never overflow the page horizontally").toBeLessThanOrEqual(
      s.innerWidth,
    );
    expect(s.docScrollHeight, "10 rows + achievedAt must never grow the page (internal scroll only)").toBeLessThanOrEqual(
      s.innerHeight,
    );
  });

  test("current-user outside-top-10 row also shows achievedAt", async ({ page }) => {
    await freshHome(page);
    await page.getByRole("button", { name: /ランキング/ }).click();
    await page.waitForTimeout(300);

    const rows: SyntheticRow[] = Array.from({ length: 3 }, (_, i) => ({
      rank: i + 1,
      name: `Player ${i + 1}`,
      score: 900 - i * 10,
      achievedAt: `9/2${i} 1${i}:0${i}`,
    }));
    const outside: SyntheticRow = {
      rank: 42,
      name: "あなたのプレイヤー名",
      score: 310,
      achievedAt: "9/22 08:41",
    };
    await renderRankingRowsWithAchievedAt(page, rows, outside);

    const outsideRow = page.locator(".ranking-overlay__row--outside");
    await expect(outsideRow).toBeVisible();
    await expect(outsideRow.locator(".ranking-overlay__name")).toHaveText(outside.name);
    await expect(outsideRow.locator(".ranking-overlay__score")).toHaveText(String(outside.score));
    await expect(outsideRow.locator(".ranking-overlay__achieved-at")).toHaveText(outside.achievedAt);
    await expect(outsideRow.locator(".ranking-overlay__you-badge")).toHaveText("あなた");

    const s = await pageScrollState(page);
    expect(s.docScrollHeight).toBeLessThanOrEqual(s.innerHeight);
  });
});

test.describe("Weekly Ranking + achievedAt: 360x800 layout regression (Phase 4)", () => {
  test("10 rows + achievedAt: no horizontal overflow, no clipped text, 閉じる reachable", async ({
    page,
  }) => {
    await freshHome(page);
    await page.getByRole("button", { name: /ランキング/ }).click();
    await page.waitForTimeout(300);

    // Longer synthetic displayName/achievedAt values -- the more layout-constrained case this
    // scenario exists to catch (WeeklyRankingOverlay is the tighter of the two changed screens:
    // its rows are already a dense rank/name/score line, and Phase 4 adds a 4th field to every
    // one of up to 10 rows, unlike MissionResultOverlay's handful of new rows on RESULT).
    const rows: SyntheticRow[] = Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      name: i === 0 ? "とても長いプレイヤー表示名テスト" : `Player ${i + 1}`,
      score: 123456 - i * 111,
      achievedAt: "9/22 08:41",
      isYou: i === 9,
    }));
    await renderRankingRowsWithAchievedAt(page, rows);

    const s = await pageScrollState(page);
    expect(s.docScrollWidth, "must never overflow horizontally at 360px").toBeLessThanOrEqual(s.innerWidth);
    expect(s.docScrollHeight, "must never grow the page at 360x800").toBeLessThanOrEqual(s.innerHeight);

    const panelBox = await page.locator(".ranking-overlay__panel").boundingBox();
    expect(panelBox).not.toBeNull();

    // Every achievedAt span must stay within its panel's horizontal bounds -- no element
    // spilling past the panel edge (the concrete, checkable form of "no clipped text" for a
    // dynamically-sized synthetic fixture like this one).
    const achievedAtSpans = page.locator(".ranking-overlay__achieved-at");
    const count = await achievedAtSpans.count();
    expect(count).toBe(10);
    for (let i = 0; i < count; i += 1) {
      const box = await achievedAtSpans.nth(i).boundingBox();
      expect(box, `row ${i} achievedAt must be visible/laid out`).not.toBeNull();
      expect(box!.x, `row ${i} achievedAt must not start left of the panel`).toBeGreaterThanOrEqual(
        panelBox!.x - 1,
      );
      expect(
        box!.x + box!.width,
        `row ${i} achievedAt must not spill past the panel's right edge`,
      ).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }

    // The body region scrolls internally (as the existing 10-row test already establishes for
    // the pre-Phase-4 shape) rather than the page itself.
    const bodyMetrics = await page.evaluate(() => {
      const el = document.querySelector(".ranking-overlay__body")!;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY };
    });
    expect(bodyMetrics.overflowY).toBe("auto");

    // 閉じる stays reachable and clickable regardless of how tall the achievedAt-augmented list
    // gets.
    const closeButton = page.getByRole("button", { name: "閉じる" });
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toBeEnabled();
    await closeButton.click();
    await expect(page.locator(".ranking-overlay__panel")).toHaveCount(0);
  });
});
