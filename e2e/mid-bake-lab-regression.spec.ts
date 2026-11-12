import { expect, test, type Page } from "@playwright/test";
import { BAKE_DURATION_S, BAKE_SPEED_PCT_PER_S } from "../src/logic/bakeProgress";
import { completeDoughStep, paintSauceRing, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * MID_BAKE Lab (#795 C-3), normal BAKE regression: with the Lab's query absent the game is the game. The normal BAKE needle keeps its one-way linear run through the
 * window start (65) WITHOUT stopping, ends at 100 in BAKE_DURATION_S, and nothing of the Lab is on the page. (The detailed one-way / zone-fade rules stay in
 * bake-one-way.spec.ts; this file only pins what the Lab must never change.) The virtual clock is used so every sample is deterministic.
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
  if (!paused) throw new Error("could not pause the clock before BAKE");
  await page.getByRole("button", { name: /焼く/ }).evaluate((el) => (el as HTMLButtonElement).click());
  await page.waitForSelector(".bake-gauge__needle");
}

async function needle(page: Page) {
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
  return page.evaluate(() => parseFloat(document.querySelector<HTMLElement>(".bake-gauge__needle")!.style.left) || 0);
}

test.describe("MID_BAKE Lab: normal BAKE regression", () => {
  test.setTimeout(120_000);

  test("the normal needle runs straight through 65 without stopping and ends at 100 on time; the Lab is not on the page", async ({ page }) => {
    await reachBake(page);
    expect(await page.getByTestId("mb-lab").count()).toBe(0);
    expect(await needle(page)).toBeLessThan(5);

    const samples: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      await page.clock.runFor(200);
      samples.push(await needle(page));
    }
    // 200 ms steps for 3.2 s: strictly rising until it reaches 100, never flat in the 62..70 band where the Lab would hold.
    const inBand = samples.filter((value) => value >= 62 && value <= 70);
    expect(new Set(inBand).size, `samples ${samples.join(",")}`).toBe(inBand.length);
    for (let i = 1; i < samples.length; i += 1) {
      if (samples[i - 1] < 100) expect(samples[i], `step ${i}`).toBeGreaterThan(samples[i - 1]);
    }
    // At 2.0 s the needle is past the window start (65) at the unchanged speed.
    const atTwoSeconds = samples[9];
    expect(atTwoSeconds).toBeGreaterThan(65);
    expect(atTwoSeconds).toBeLessThan(BAKE_SPEED_PCT_PER_S * 2.0 + 6);
    expect(atTwoSeconds).toBeGreaterThan(BAKE_SPEED_PCT_PER_S * 2.0 - 6);
    // The deadline is BAKE_DURATION_S plus one explicit frame margin, NOT a second bake length: the sample at 3.2 s must already be 100
    // (a slowed-down bake that crosses 2.0 s on time would still be short of 100 here).
    const frameMarginS = 0.2;
    expect(samples[Math.round((BAKE_DURATION_S + frameMarginS) / 0.2) - 1], `samples ${samples.join(",")}`).toBe(100);
    // ... and it stays there.
    await page.clock.runFor(BAKE_DURATION_S * 1000);
    expect(await needle(page)).toBe(100);
    await page.clock.resume();
  });

  test("the normal take-out works at the window start: pressing 取り出す！ at ~65 really leaves BAKE", async ({ page }) => {
    await reachBake(page);
    await page.clock.runFor(1960); // 65% of the 3 s bake, the clock still paused
    const atWindowStart = await needle(page);
    expect(atWindowStart).toBeGreaterThan(60);
    expect(atWindowStart).toBeLessThan(72);
    // A DOM click (the clock is paused): the real onConfirm -> handleConfirmBake path, not just an enabled button.
    await page.getByRole("button", { name: "取り出す！" }).evaluate((el) => (el as HTMLButtonElement).click());
    await page.clock.resume();
    await expect(page.locator(".bake-gauge__needle")).toHaveCount(0); // BAKE was left for the next screen
    await expect(page.getByRole("button", { name: "取り出す！" })).toHaveCount(0);
    await expect(page.getByTestId("mb-takeout")).toHaveCount(0);
  });
});
