import { expect, test, type Page } from "@playwright/test";
import {
  BAKE_DURATION_S,
  BAKE_SPEED_PCT_PER_S,
  BAKE_ZONE_FADE_END_S,
  BAKE_ZONE_FADE_START_S,
} from "../src/logic/bakeProgress";
import { completeDoughStep, paintSauceRing, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * Issue #419 (Bake Human Feel): BAKE is one-way. The needle runs 0 -> 100 in BAKE_DURATION_S (3s, a comparison candidate)
 * and stops at the right end; the target zone is shown for 0.6s, fades over 0.6-1.2s and is gone from 1.2s on (every time here is
 * derived from src/logic/bakeProgress.ts, so a later tuning is a constant change); the track and the needle stay; nothing else (needle colour, caption, CTA glow) points at the correct position.
 * Runs on both authority viewports (390x844 and 360x800 projects). The virtual clock is used so
 * every sample is deterministic.
 */

async function reachBake(page: Page) {
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
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 55);
  await tapDoughPercent(page, 55, 45);
  await enterBakeAtZero(page);
}

/**
 * Enters BAKE with the virtual clock already paused, so the needle starts at exactly 0 and a sample at "t seconds" is
 * deterministic. (`enterBakePaused` pauses a few hundred real ms AFTER the click; at 33 pt/s that is already several
 * points -- and past the zone's first second on a loaded runner -- so these assertions cannot start from it.) The click
 * is a DOM click: Playwright's own actionability wait would need a running rAF.
 */
async function enterBakeAtZero(page: Page) {
  await page.clock.install();
  let paused = false;
  for (const buffer of [300, 800, 2000]) {
    try {
      await page.clock.pauseAt(Date.now() + buffer);
      paused = true;
      break;
    } catch (error) {
      if (!String(error).includes("to the past")) throw error;
    }
  }
  if (!paused) throw new Error("enterBakeAtZero: could not pause the clock before BAKE (every pauseAt landed in the past)");
  await page.getByRole("button", { name: /焼く/ }).evaluate((el) => (el as HTMLButtonElement).click());
  await page.waitForSelector(".bake-gauge__needle");
}

async function flush(page: Page) {
  for (let i = 0; i < 2; i += 1) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => resolve();
          channel.port2.postMessage(null);
        }),
    );
  }
}

async function snapshot(page: Page) {
  await flush(page);
  return page.evaluate(() => {
    const needle = document.querySelector<HTMLElement>(".bake-gauge__needle")!;
    const zones = document.querySelector<HTMLElement>(".bake-gauge__zones");
    const button = document.querySelector<HTMLElement>(".cta-button--bake")!;
    const char = document.querySelector<HTMLElement>(".pizza-char-spots");
    return {
      left: parseFloat(needle.style.left) || 0,
      color: getComputedStyle(needle).backgroundColor,
      zones: zones ? Number(zones.style.opacity) : null,
      hasTrack: !!document.querySelector(".bake-gauge"),
      glow: button.className.includes("glow"),
      caption: document.querySelector(".bake-oven__caption")?.textContent ?? "",
      char: char ? Number(getComputedStyle(char).opacity) : 0,
    };
  });
}

test.describe("Issue #419 Bake Human Feel", () => {
  test.setTimeout(120_000);

  test("the needle only moves forward, stops at 100 and never returns; the bake look never reverses", async ({ page }) => {
    await reachBake(page);
    let previous = await snapshot(page);
    expect(previous.left).toBeLessThan(5);
    for (let i = 0; i < 70; i += 1) {
      await page.clock.runFor(250); // ~17.5s total, well past the end of the bake (BAKE_DURATION_S)
      const current = await snapshot(page);
      expect(current.left, `step ${i}`).toBeGreaterThanOrEqual(previous.left);
      expect(current.char, `char step ${i}`).toBeGreaterThanOrEqual(previous.char - 1e-6);
      previous = current;
    }
    expect(previous.left).toBe(100);
    await page.clock.resume();
  });

  test("the target zone is shown to 0.6s, fades 0.6-1.2s, is gone from 1.2s; track and needle stay", async ({ page }) => {
    await reachBake(page);
    const start = await snapshot(page);
    expect(start.zones).toBe(1);

    // Align to just before the fade starts (FADE_START - 0.1s of BAKE time) using the needle itself (elapsed = position / speed).
    const elapsedMs = (start.left / BAKE_SPEED_PCT_PER_S) * 1000;
    const beforeFadeMs = (BAKE_ZONE_FADE_START_S - 0.1) * 1000;
    const midFadeMs = ((BAKE_ZONE_FADE_START_S + BAKE_ZONE_FADE_END_S) / 2) * 1000;
    const goneMs = (BAKE_ZONE_FADE_END_S + 0.2) * 1000;
    await page.clock.runFor(Math.max(0, beforeFadeMs - elapsedMs));
    expect((await snapshot(page)).zones).toBe(1);

    await page.clock.runFor(midFadeMs - beforeFadeMs); // mid-fade
    const mid = (await snapshot(page)).zones;
    expect(mid).not.toBeNull();
    expect(mid!).toBeGreaterThan(0.2);
    expect(mid!).toBeLessThan(0.8);

    await page.clock.runFor(goneMs - midFadeMs); // just past the end of the fade
    const gone = await snapshot(page);
    expect(gone.zones).toBeNull();
    expect(gone.hasTrack).toBe(true);
    expect(gone.left).toBeGreaterThan(30); // the zone is gone while the needle is still mid-gauge
    expect(gone.left).toBeLessThan(100);

    await page.clock.runFor((BAKE_DURATION_S + 3) * 1000);
    const end = await snapshot(page);
    expect(end.zones).toBeNull();
    expect(end.left).toBe(100);
    await page.clock.resume();
  });

  test("needle colour, caption and CTA never change with the position (no answer is announced)", async ({ page }) => {
    await reachBake(page);
    const first = await snapshot(page);
    const colors = new Set<string>([first.color]);
    const captions = new Set<string>([first.caption]);
    for (let i = 0; i < 44; i += 1) {
      await page.clock.runFor(250);
      const s = await snapshot(page);
      colors.add(s.color);
      captions.add(s.caption);
      expect(s.glow).toBe(false);
    }
    expect([...colors]).toHaveLength(1);
    expect([...captions]).toEqual(["見た目で焼き加減を確かめて！"]);
    await page.clock.resume();
  });

  test("a blur pauses the bake and returning does not jump the needle", async ({ page }) => {
    await reachBake(page);
    await page.clock.runFor(1000);
    const before = await snapshot(page);

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.clock.runFor(30_000);
    expect((await snapshot(page)).left).toBe(before.left);

    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.clock.runFor(100);
    const after = await snapshot(page);
    // Only the 100ms run after the refocus may count (not the 30s of blur): its needle travel plus a 1pt margin.
    expect(after.left - before.left).toBeLessThan(BAKE_SPEED_PCT_PER_S * 0.1 + 1);
    expect(after.left).toBeLessThan(50);
    await page.clock.resume();
  });

  test("the take-out is available immediately (no input lock)", async ({ page }) => {
    await reachBake(page);
    await page.clock.resume();
    await page.getByRole("button", { name: "取り出す！" }).click();
    await expect(page.getByRole("button", { name: "取り出す！" })).toHaveCount(0);
  });
});
