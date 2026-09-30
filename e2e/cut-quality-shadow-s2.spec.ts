import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
} from "./gestures";
import { evaluateCut } from "../src/logic/cut/evaluation";
import { evaluateCutQuality } from "../src/logic/cut/quality";
import type { CutLine } from "../src/logic/cut/types";
import { OPERATOR_PROFILES, planOperatorCuts, seededRandom, type OperatorProfile } from "../src/logic/testSupport/cutOperatorModel";

/**
 * CUT-S2 (Issue #288) shadow harness. Drives the REAL app (margherita -> CUT) with real pointer
 * input at 390x844 and 360x800, reads the lines the game itself committed from the DOM, and
 * records `evaluateCut` (existing cutScore) next to `evaluateCutQuality` for each. Nothing here
 * changes the game: CutQuality is computed in the test process only.
 *
 * The "operator" is a seeded noise model (src/logic/testSupport/cutOperatorModel.ts), not a
 * person: this proves the pipeline and gives distributions; it does not replace an Owner's
 * hands-on check. Output: docs/reports/data/cut-s2/shadow-<w>x<h>.json
 */
const TRIALS_PER_PROFILE = 24;
const PROFILE_IDS = ["ideal", "normal", "sloppy", "rough"] as const;

async function readLines(page: Page): Promise<CutLine[]> {
  return page.$$eval(".pizza-cut-line", (els) =>
    els.map((el) => ({
      start: { x: Number(el.getAttribute("x1")), y: Number(el.getAttribute("y1")) },
      end: { x: Number(el.getAttribute("x2")), y: Number(el.getAttribute("y2")) },
    })),
  );
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.up();
}

test("CUT-S2: real-pointer shadow evaluation (existing cutScore vs CutQuality)", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const vp = page.viewportSize()!;
  await startFreshMargherita(page);
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
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
  await bakeToTarget(page, { start: 60, end: 80 });
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();

  const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
  if (!box) throw new Error("dough box missing");
  const pxPerPercent = box.width / 100;
  const toPx = (p: { x: number; y: number }) => ({ x: box.x + (p.x / 100) * box.width, y: box.y + (p.y / 100) * box.height });

  const rows: unknown[] = [];
  let lastLines: CutLine[] = [];
  for (const id of PROFILE_IDS) {
    const profile: OperatorProfile = OPERATOR_PROFILES[id];
    for (let trial = 0; trial < TRIALS_PER_PROFILE; trial++) {
      const rand = seededRandom(vp.width * 1000 + PROFILE_IDS.indexOf(id) * 100 + trial);
      const plan = planOperatorCuts(profile, pxPerPercent, rand);
      for (const cut of plan) await drag(page, toPx(cut.press), toPx(cut.release));
      const lines = await readLines(page);
      lastLines = lines;
      const cutEval = evaluateCut(lines, { requestedSliceCount: 6 });
      const quality = evaluateCutQuality(lines, { requestedSliceCount: 6 });
      rows.push({
        profile: id,
        trial,
        committedLines: lines.length,
        plannedMatchesCommitted: plan.every((c, i) => !!lines[i] && !!c.line &&
          Math.abs(c.line.start.x - lines[i].start.x) < 0.6 && Math.abs(c.line.end.y - lines[i].end.y) < 0.6),
        cutScore: cutEval.cutScore,
        cutScoreCompleteness: cutEval.completeness,
        cutScoreCount: cutEval.countCorrectness,
        cutScoreCenter: cutEval.centerAccuracy,
        cutScoreUniformity: cutEval.uniformity,
        quality: {
          lineValidity: quality.lineValidity,
          sliceCountFit: quality.sliceCountFit,
          centerAccuracy: quality.centerAccuracy,
          sliceUniformity: quality.sliceUniformity,
          overall: quality.overall,
          pieceAreas: quality.pieceAreas,
          sliverCount: quality.sliverCount,
          actualPieceCount: quality.actualPieceCount,
        },
        lines,
      });
      for (let i = 0; i < lines.length; i++) await page.getByRole("button", { name: /1本戻す/ }).click();
      await expect(page.locator(".pizza-cut-line")).toHaveCount(0);
    }
  }

  // Cross-check the harness's cutScore against what the app itself shows on RESULT.
  for (const cut of planOperatorCuts(OPERATOR_PROFILES.normal, pxPerPercent, seededRandom(4242))) {
    await drag(page, toPx(cut.press), toPx(cut.release));
  }
  lastLines = await readLines(page);
  await page.getByRole("button", { name: /切り終わる/ }).click();
  await expect(page.locator(".cut-evaluation-summary")).toBeVisible();
  const shown = await page.locator(".cut-evaluation-summary summary strong").innerText();
  const expected = Math.round(evaluateCut(lastLines, { requestedSliceCount: 6 }).cutScore);
  expect(Number.parseInt(shown, 10)).toBe(expected);

  mkdirSync("docs/reports/data/cut-s2", { recursive: true });
  writeFileSync(
    `docs/reports/data/cut-s2/shadow-${vp.width}x${vp.height}.json`,
    JSON.stringify(
      { project: testInfo.project.name, viewport: vp, stagePx: box.width, pxPerPercent, trialsPerProfile: TRIALS_PER_PROFILE,
        appShownCutScore: Number.parseInt(shown, 10), harnessCutScoreForSameLines: expected, rows },
      null,
      1,
    ) + "\n",
  );
});
