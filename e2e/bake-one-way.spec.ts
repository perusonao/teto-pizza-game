import { expect, test, type Page } from "@playwright/test";
import { BAKE_SPEED_PCT_PER_S } from "../src/logic/bakeProgress";
import { completeDoughStep, enterBakePaused, paintSauceRing, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * Issue #419 (Bake Human Feel): BAKE is one-way. The needle runs 0 -> 100 in BAKE_DURATION_S (7s) and stops at
 * the right end; the target zone is shown for 2s, fades over 2-3.5s and is gone from 3.5s on; the track and
 * the needle stay; nothing else (needle colour, caption, CTA glow) points at the correct position.
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
  await enterBakePaused(page);
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
      await page.clock.runFor(250); // ~17.5s total, well past the 7s end
      const current = await snapshot(page);
      expect(current.left, `step ${i}`).toBeGreaterThanOrEqual(previous.left);
      expect(current.char, `char step ${i}`).toBeGreaterThanOrEqual(previous.char - 1e-6);
      previous = current;
    }
    expect(previous.left).toBe(100);
    await page.clock.resume();
  });

  test("the target zone is shown to 2s, fades 2-3.5s, is gone from 3.5s; track and needle stay", async ({ page }) => {
    await reachBake(page);
    const start = await snapshot(page);
    expect(start.zones).toBe(1);

    // Align to ~1.9s of BAKE time using the needle itself (elapsed = position / speed).
    const elapsedMs = (start.left / BAKE_SPEED_PCT_PER_S) * 1000;
    await page.clock.runFor(Math.max(0, 1900 - elapsedMs));
    expect((await snapshot(page)).zones).toBe(1);

    await page.clock.runFor(850); // ~2.75s, mid-fade
    const mid = (await snapshot(page)).zones;
    expect(mid).not.toBeNull();
    expect(mid!).toBeGreaterThan(0.2);
    expect(mid!).toBeLessThan(0.8);

    await page.clock.runFor(950); // ~3.7s
    const gone = await snapshot(page);
    expect(gone.zones).toBeNull();
    expect(gone.hasTrack).toBe(true);
    expect(gone.left).toBeGreaterThan(50);

    await page.clock.runFor(8000);
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
    expect(after.left - before.left).toBeLessThan(3);
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
