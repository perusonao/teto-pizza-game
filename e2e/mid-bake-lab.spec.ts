import { expect, test, type Page } from "@playwright/test";
import { runOnlyOnWidth } from "./support/projectGuard";

/**
 * MID_BAKE Lab (#795 C-3; `?cookMidBakeHv=1`, Preview / DEV only): real-browser checks of the standalone Lab at the phone profiles (390x844 and 360x800 through the
 * projects, 390x664 and 360x640 forced once per engine). Emulation only -- the iPhone real-device HV is a later Owner step and is NOT claimed here.
 * The Lab runs on the real clock (the bake is 3 s, the needle holds at 65), so the checks wait on the screen's own state instead of fixed sleeps.
 */
test.use({ hasTouch: true });
test.setTimeout(60_000);

const PHASE_WAIT = { timeout: 20_000 };
const lab = (page: Page) => page.getByTestId("mb-lab");

async function openLab(page: Page, query = "?cookMidBakeHv=1") {
  await page.goto(`/${query}`);
  await expect(lab(page)).toBeVisible();
}
/** Starts the bake and waits until the needle has stopped at the window start. */
async function toHold(page: Page) {
  await page.getByTestId("mb-start").click();
  await expect(lab(page)).toHaveAttribute("data-clock", "holding", PHASE_WAIT);
}
const position = (page: Page) => page.getByTestId("mb-needle").getAttribute("data-position");

/** Resolves once React has committed what is already scheduled (its Scheduler runs from a MessageChannel, which `page.clock` does not fake). */
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
/** Opens the Lab with the virtual clock paused, so a take-out lands at an exact bake position instead of racing the real clock. */
async function openLabPaused(page: Page, query = "?cookMidBakeHv=1") {
  await page.clock.install();
  await page.goto(`/${query}`);
  await expect(lab(page)).toBeVisible();
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
  if (!paused) throw new Error("openLabPaused: could not pause the clock (every pauseAt landed in the past)");
}
/** A DOM click: Playwright's own actionability wait would need a running animation frame while the clock is paused. */
async function domClick(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((el) => (el as HTMLButtonElement).click());
  await flush(page);
}

for (const forced of [{ w: 390, h: 664 }, { w: 360, h: 640 }]) {
  test(`${forced.w}x${forced.h}: the primary controls stay on screen at a short viewport`, async ({ page }, testInfo) => {
    runOnlyOnWidth(testInfo, forced.w as 390 | 360);
    await page.setViewportSize({ width: forced.w, height: forced.h });
    await openLab(page);
    await expectControlsInside(page);
  });
}

async function expectControlsInside(page: Page) {
  const view = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, sw: document.documentElement.scrollWidth }));
  expect(view.sw).toBeLessThanOrEqual(view.w);
  for (const id of ["mb-chip-natto", "mb-close", "mb-start", "mb-restart"]) {
    const box = await page.getByTestId(id).boundingBox();
    if (!box) throw new Error(`no box for ${id}`);
    expect(box.x, id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, id).toBeLessThanOrEqual(view.w);
    expect(box.y + box.height, id).toBeLessThanOrEqual(view.h);
    expect(box.height, id).toBeGreaterThanOrEqual(44); // a thumb-sized target
  }
}

test.describe("MID_BAKE Lab (?cookMidBakeHv=1)", () => {
  test("opens on the profile's own viewport with the label, the window band and nothing addable yet", async ({ page }) => {
    await openLab(page);
    await expect(page.getByRole("note")).toHaveText("MID_BAKE Lab（試作・保存されません）");
    await expect(page.getByTestId("mb-window")).toBeVisible();
    await expect(page.getByTestId("mb-chip-natto")).toBeDisabled();
    await expect(page.getByTestId("mb-close")).toBeDisabled();
    await expectControlsInside(page);
  });

  test("the needle stops at the window start (65) and stays put while holding", async ({ page }) => {
    await openLab(page);
    await toHold(page);
    expect(await position(page)).toBe("65.0");
    await page.waitForTimeout(900);
    expect(await position(page)).toBe("65.0");
    await expect(lab(page)).toHaveAttribute("data-clock", "holding");
    await expect(page.getByTestId("mb-status")).toHaveAttribute("data-hold", "1");
  });

  test("two taps add two natto, the bake resumes by itself, and the take-out ends the round as complete (virtual clock, exact positions)", async ({ page }) => {
    await openLabPaused(page);
    await domClick(page, "mb-start");
    await page.clock.runFor(2100); // past the window start (1950 ms): the needle is holding
    await flush(page);
    await expect(lab(page)).toHaveAttribute("data-clock", "holding");
    await domClick(page, "mb-chip-natto");
    await expect(page.getByTestId("mb-piece")).toHaveCount(1);
    await expect(page.getByTestId("mb-count")).toHaveText("2");
    await domClick(page, "mb-chip-natto");
    await expect(page.getByTestId("mb-piece")).toHaveCount(2);
    await expect(lab(page)).toHaveAttribute("data-clock", "running");
    await page.clock.runFor(100); // ~3 points on from 65, well inside the Lab's plain 55-75 target
    await flush(page);
    await domClick(page, "mb-takeout");
    const result = page.getByTestId("mb-result");
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute("data-completion", "complete");
    await expect(result).toHaveAttribute("data-bake", "perfect");
    await expect(lab(page)).toHaveAttribute("data-phase", "finished");
    await page.clock.resume();
  });

  test("the take-out is refused while holding and the bake goes on", async ({ page }) => {
    await openLab(page);
    await toHold(page);
    // The button is aria-disabled while holding but stays pressable on purpose (a mis-tap is counted); Playwright treats aria-disabled as
    // "not enabled" and would wait it out, so the press is forced.
    await page.getByTestId("mb-takeout").click({ force: true });
    await expect(lab(page)).toHaveAttribute("data-phase", "baking");
    await expect(lab(page)).toHaveAttribute("data-clock", "holding");
    await expect(page.getByTestId("mb-log")).toContainText("止まっている間は取り出せない");
  });

  test("closing without adding resumes the bake and the round ends as a miss (追加不足)", async ({ page }) => {
    await openLab(page);
    await toHold(page);
    await page.getByTestId("mb-close").click();
    await expect(lab(page)).toHaveAttribute("data-clock", "running");
    const result = page.getByTestId("mb-result");
    await expect(result).toBeVisible(PHASE_WAIT);
    await expect(result).toHaveAttribute("data-completion", "missing-additions");
    await expect(result).toHaveAttribute("data-bake", "burnt");
  });

  test("the hold ends by itself at the Lab's provisional timeout (shortened with the Lab knob)", async ({ page }) => {
    // A 400 ms hold is too short to wait for on the screen's state, so the record and the result are what is checked.
    await openLab(page, "?cookMidBakeHv=1&cookMidBakeHoldMs=400");
    await page.getByTestId("mb-start").click();
    await expect(page.getByTestId("mb-log")).toContainText("タイムアウト（400ms）で再開", PHASE_WAIT);
    const result = page.getByTestId("mb-result");
    await expect(result).toBeVisible(PHASE_WAIT);
    await expect(result).toHaveAttribute("data-completion", "missing-additions");
    await expect(result).toContainText("再開の理由 timeout");
  });

  test("the alternative control (collapsed by default) adds through the same path", async ({ page }) => {
    await openLab(page);
    await toHold(page);
    await expect(page.getByTestId("mb-alt-add")).toBeHidden();
    await page.getByText("別の操作方法を使う").click();
    await page.getByTestId("mb-alt-add").click();
    await expect(page.getByTestId("mb-piece")).toHaveCount(1);
    await expect(page.getByTestId("mb-piece")).toHaveAttribute("data-input", "alternative");
  });

  test("a stand-in stock of 1 allows one addition, then refuses, and the round ends short", async ({ page }) => {
    await openLab(page, "?cookMidBakeHv=1&cookMidBakeStock=1");
    await toHold(page);
    await page.getByTestId("mb-chip-natto").click();
    await expect(page.getByTestId("mb-piece")).toHaveCount(1);
    await expect(page.getByTestId("mb-chip-natto")).toBeDisabled();
    await expect(page.getByTestId("mb-count")).toHaveText("0");
    await page.getByTestId("mb-close").click();
    const result = page.getByTestId("mb-result");
    await expect(result).toBeVisible(PHASE_WAIT);
    await expect(result).toHaveAttribute("data-completion", "missing-additions");
    await expect(result).toContainText("1 消費");
  });

  test("restart gives a fresh round", async ({ page }) => {
    await openLab(page);
    await toHold(page);
    await page.getByTestId("mb-chip-natto").click();
    await page.getByTestId("mb-restart").click();
    await expect(lab(page)).toHaveAttribute("data-phase", "ready");
    await expect(page.getByTestId("mb-piece")).toHaveCount(0);
    await expect(page.getByTestId("mb-count")).toHaveText("3");
  });
});

test.describe("MID_BAKE Lab isolation", () => {
  test("writes nothing to the device: no localStorage or sessionStorage entry after a whole round", async ({ page }) => {
    await openLab(page);
    await toHold(page);
    await page.getByTestId("mb-chip-natto").click();
    await page.getByTestId("mb-chip-natto").click();
    await expect(page.getByTestId("mb-result")).toBeVisible(PHASE_WAIT); // the bake runs out by itself: no race with a take-out click
    const stored = await page.evaluate(() => ({ local: Object.keys(window.localStorage), session: Object.keys(window.sessionStorage) }));
    expect(stored).toEqual({ local: [], session: [] });
  });

  test("without the query, with a wrong value, with a repeat, or next to another dev entry, the Lab is not shown", async ({ page }) => {
    for (const query of ["", "?cookMidBakeHv=0", "?cookMidBakeHv=on", "?cookMidBakeHv=1&cookMidBakeHv=1", "?cookMidBakeHv=1&dev=postlayer", "?cookMidBakeHv=1&hv=normal"]) {
      await page.goto(`/${query}`);
      await expect(page.locator("#root")).not.toBeEmpty();
      await expect(page.getByTestId("mb-lab"), query).toHaveCount(0);
    }
  });
});
