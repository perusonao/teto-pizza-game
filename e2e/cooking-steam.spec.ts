import { expect, test, type Page } from "@playwright/test";
import { BAKE_SPEED_PCT_PER_S } from "../src/logic/bakeProgress";
import { tapDoughPercent } from "./gestures";
import { SAVE_KEY } from "./support/familyTray";

/**
 * Cooking Steam Phase 1 (#726, S3): `?cookSteamHv=1` is ONE URL to the TOPPING step with the dough / sauce / cheese done, the clam and the mussel owned, stocked
 * and the clam selected, and the steam ON (both operations; `&cookSteamVariant=lid|shake` narrows it). Both authority viewports (390x844, 360x800). The device's own
 * save is never touched (a sentinel stands for it). HV_SHOT_DIR (optional) writes the screenshots.
 */
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}
const REAL = "REAL-SAVE-SENTINEL";
const pill = (page: Page) => page.getByTestId("cooking-steam-pill");
const screenEl = (page: Page) => page.getByTestId("cooking-steam");
const clamPieces = (page: Page) => page.locator(".pizza-dough .pizza-topping--clam").count();
const steamedPieces = (page: Page) => page.locator(".pizza-dough .ingredient-piece--steamed").count();

async function openEntry(page: Page, query: string) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, REAL] as const);
  await page.goto(`/${query}`);
}

/** Selects an ingredient chip by its name, paging the tray forward when needed (a short, bounded search; no pager race: every click has its own timeout). */
async function selectChip(page: Page, name: RegExp) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: name }).first();
  const next = page.getByRole("button", { name: "次のページ" });
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 6 && (await prev.isEnabled().catch(() => false)); i += 1) await prev.click({ timeout: 2000 }).catch(() => undefined);
  for (let i = 0; i < 8 && !(await chip.isVisible().catch(() => false)); i += 1) {
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click({ timeout: 2000 }).catch(() => undefined);
  }
  await chip.click();
}

/** Enters BAKE with the virtual clock paused, so the needle starts at exactly 0 (same helper shape as bake-one-way.spec.ts / cooking-sear-hv.spec.ts). */
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
  if (!paused) throw new Error("enterBakeAtZero: could not pause the clock before BAKE");
  await page.getByRole("button", { name: /焼く/ }).evaluate((el) => (el as HTMLButtonElement).click());
  await page.waitForSelector(".bake-gauge__needle");
}

/** Sweeps the finger across the pot `n` times (left-right-left...), 25 ms apart. */
async function shakePot(page: Page, sweeps: number) {
  const box = (await page.getByTestId("cooking-steam-pot").boundingBox())!;
  const y = box.y + box.height * 0.6;
  await page.mouse.move(box.x + box.width * 0.1, y);
  await page.mouse.down();
  for (let i = 0; i < sweeps; i += 1) {
    await page.mouse.move(box.x + box.width * (i % 2 === 0 ? 0.9 : 0.1), y, { steps: 3 });
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
}

test.describe("Cooking Steam HV entry (?cookSteamHv=1)", () => {
  test("one URL: TOPPING, clam selected, the pill is on screen and tappable at once, inside the stage; the real save is never touched", async ({ page, context }) => {
    await openEntry(page, "?cookSteamHv=1");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("prepare-dock")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-cook-steam-hv", "cook-steam-hv-v1");
    await expect(page.getByRole("button", { name: /焼く/ })).toBeEnabled(); // the sauce and the cheese are really on the pizza
    const g = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const s = r(".pizza-stage"), p = r(".cooking-steam-pill"), d = r(".pizza-dough");
      const centre = { x: (d.left + d.right) / 2, y: (d.top + d.bottom) / 2, r: Math.min(d.width, d.height) / 2 };
      const nx = Math.min(Math.max(centre.x, p.left), p.right), ny = Math.min(Math.max(centre.y, p.top), p.bottom);
      return { placement: document.querySelector(".cooking-steam-pill")!.getAttribute("data-placement"), stageB: s.bottom, stageR: s.right, pillB: p.bottom, pillR: p.right, pillL: p.left, pillH: p.height, pillW: p.width, clearance: Math.hypot(nx - centre.x, ny - centre.y) - centre.r, iw: innerWidth };
    });
    expect(g.pillH).toBeGreaterThanOrEqual(44);
    expect(g.pillW).toBeGreaterThanOrEqual(44);
    expect(g.pillL).toBeGreaterThanOrEqual(0);
    expect(g.pillR).toBeLessThanOrEqual(g.iw);
    expect(g.pillB).toBeLessThanOrEqual(g.stageB);
    expect(g.clearance).toBeGreaterThanOrEqual(0); // never ON the dough, in the band or in the corner
    await shot(page, "hv-00-entry");
    const other = await context.newPage();
    await other.goto("icons/icon-16.png");
    expect(await other.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(REAL);
    await other.close();
  });

  test("without the opt-in the steam is not there; with ?cookSteam=on alone the game opens as usual (no jump into cooking)", async ({ page }) => {
    await openEntry(page, "?cookSteam=on");
    await page.waitForSelector(".app-frame");
    await expect(page.locator("html")).not.toHaveAttribute("data-cook-steam-hv", /.*/);
    await expect(pill(page)).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(REAL);
  });

  test("the pills are exclusive: the clam shows the steam pill, the sausage only the sear's (production ON), and the dock/stage stay one screen", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("cooking-sear-pill")).toHaveCount(0);
    await selectChip(page, /ソーセージ/);
    await expect(page.getByTestId("cooking-sear-pill")).toBeVisible();
    await expect(pill(page)).toHaveCount(0);
    await shot(page, "hv-01-sausage-keeps-sear-pill");
    await selectChip(page, /あさり|アサリ/);
    await expect(pill(page)).toBeVisible();
    await expect(page.getByTestId("cooking-sear-pill")).toHaveCount(0);
    await selectChip(page, /ムール貝/);
    await expect(pill(page)).toBeVisible();
    await expect(page.getByTestId("cooking-sear-pill")).toHaveCount(0);
    const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
    expect(overflow.sw).toBeLessThanOrEqual(overflow.iw);
    expect(overflow.sh).toBeLessThanOrEqual(overflow.ih + 1);
  });

  test("operation A (lid): place, steam, the shells open one by one, lift -> words -> done mark -> the pieces are steamed", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1&cookSteamVariant=lid");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) await tapDoughPercent(page, x, y);
    expect(await clamPieces(page)).toBe(3);
    expect(await steamedPieces(page)).toBe(0);
    await pill(page).click();
    await expect(screenEl(page)).toHaveAttribute("data-variant", "lid");
    await expect(page.getByTestId("cooking-steam-variant-shake")).toHaveCount(0);
    await shot(page, "A-00-screen-idle");
    // every control is inside the stage, big enough, and the page does not scroll
    const geo = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const st = r(".pizza-stage"), b = r(".cooking-steam__button"), c = r(".cooking-steam__close"), t0 = r(".cooking-steam__title");
      const cs = getComputedStyle(document.querySelector(".cooking-steam__title")!);
      // the title box is full width with side padding that keeps its TEXT clear of the ×: compare the text area, not the box
      const t = { left: t0.left + parseFloat(cs.paddingLeft), right: t0.right - parseFloat(cs.paddingRight), top: t0.top, bottom: t0.bottom };
      return { inside: b.left >= st.left && b.right <= st.right && b.bottom <= st.bottom && b.top >= st.top, bh: b.height, ch: c.height, cw: c.width, titleHitsClose: !(t.right <= c.left || t.bottom <= c.top || t.left >= c.right || t.top >= c.bottom), sx: scrollX, sy: scrollY };
    });
    expect(geo.inside).toBe(true);
    expect(geo.bh).toBeGreaterThanOrEqual(56);
    expect(geo.ch).toBeGreaterThanOrEqual(44);
    expect(geo.cw).toBeGreaterThanOrEqual(44);
    expect(geo.titleHitsClose).toBe(false);
    await page.getByTestId("cooking-steam-lid-button").click();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "steaming");
    // While the shells open (the pop animation runs) none of them may leave the pot: sample every shell's box every ~40 ms for ~3 s (HV recording found one flashing in the corner)
    const strays = await page.evaluate(async () => {
      const pot = document.querySelector('[data-testid="cooking-steam-pot"]')!.getBoundingClientRect();
      let worst = 0;
      for (let i = 0; i < 75; i += 1) {
        for (const g of document.querySelectorAll('[data-testid^="cooking-steam-shell-"]')) {
          const r = g.getBoundingClientRect();
          const outside = Math.max(pot.left - r.left, r.right - pot.right, pot.top - r.top, r.bottom - pot.bottom);
          if (outside > worst) worst = outside;
        }
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      return worst;
    });
    expect(strays).toBeLessThanOrEqual(1);
    await expect(screenEl(page)).toHaveAttribute("data-open-count", /^[1-5]$/, { timeout: 4000 }); // the first shell opens on its own
    await shot(page, "A-01-steaming");
    await page.waitForTimeout(1200);
    const mid = Number(await screenEl(page).getAttribute("data-open-count"));
    expect(mid).toBeGreaterThanOrEqual(2);
    expect(mid).toBeLessThanOrEqual(5);
    await shot(page, "A-02-shells-opening");
    await page.getByTestId("cooking-steam-lid-button").click();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "done");
    await expect(page.getByTestId("cooking-steam-title")).toHaveText(/ちょっと開いた|ぱっくり開いた|くたっとしぼんだ/);
    await shot(page, "A-03-result");
    await expect(page.getByTestId("cooking-steam-done")).toBeVisible({ timeout: 4000 });
    expect(await steamedPieces(page)).toBe(3);
    await shot(page, "A-04-on-pizza");
  });

  test("operation B (shake): drag the pot, the shells open; stop and it fades; lift keeps it; the tap alternative alone also works", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1&cookSteamVariant=shake");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    for (const [x, y] of [[40, 50], [60, 50]]) await tapDoughPercent(page, x, y);
    await pill(page).click();
    await expect(screenEl(page)).toHaveAttribute("data-variant", "shake");
    await expect(page.getByTestId("cooking-steam-open")).toBeDisabled();
    await shot(page, "B-00-screen-idle");
    const scrollBefore = await page.evaluate(() => [scrollX, scrollY]);
    await shakePot(page, 14);
    await expect(screenEl(page)).toHaveAttribute("data-mode", "steaming");
    expect(await page.evaluate(() => [scrollX, scrollY])).toEqual(scrollBefore); // the drag never scrolled the page
    const reached = Number(await screenEl(page).getAttribute("data-open-count"));
    expect(reached).toBeGreaterThanOrEqual(2);
    await shot(page, "B-01-after-shaking");
    await page.waitForTimeout(5200); // stop shaking: the steam fades
    expect(Number(await screenEl(page).getAttribute("data-open-count"))).toBeLessThan(reached);
    await shakePot(page, 14);
    await shot(page, "B-02-shaken-again");
    await page.getByTestId("cooking-steam-open").click();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "done");
    await expect(page.getByTestId("cooking-steam-done")).toBeVisible({ timeout: 4000 });
    expect(await steamedPieces(page)).toBe(2);
    await shot(page, "B-03-on-pizza");
  });

  test("operation B with taps only (no dragging at all) reaches the same place", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1&cookSteamVariant=shake");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await tapDoughPercent(page, 40, 50);
    await pill(page).click();
    for (let i = 0; i < 8; i += 1) await page.getByTestId("cooking-steam-shake").click();
    await expect(screenEl(page)).toHaveAttribute("data-open-count", "5");
    await page.waitForTimeout(900);
    await page.getByTestId("cooking-steam-open").click();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "done");
    await expect(page.getByTestId("cooking-steam-done")).toBeVisible({ timeout: 4000 });
    expect(await steamedPieces(page)).toBe(1);
  });

  test("both operations: the in-screen switch (default mode), locked while steaming; × keeps nothing; the mussel has its own shell colours", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await pill(page).click();
    await expect(screenEl(page)).toHaveAttribute("data-variant", "lid");
    await page.getByTestId("cooking-steam-variant-shake").click();
    await expect(screenEl(page)).toHaveAttribute("data-variant", "shake");
    await page.getByTestId("cooking-steam-shake").click();
    await expect(page.getByTestId("cooking-steam-variant-lid")).toBeDisabled();
    await shot(page, "both-00-switch");
    await page.getByTestId("cooking-steam-cancel").click();
    await expect(screenEl(page)).toHaveCount(0);
    await expect(pill(page)).toBeVisible(); // nothing was kept
    await selectChip(page, /ムール貝/);
    await pill(page).click();
    await expect(screenEl(page)).toHaveAttribute("data-ingredient", "mussel");
    await shot(page, "both-01-mussel");
  });

  test("steamed -> bake -> RESULT: the steam look and the bake's own filter both apply; scoring and the flow are the plain ones", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1&cookSteamVariant=lid");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) await tapDoughPercent(page, x, y);
    await pill(page).click();
    await page.getByTestId("cooking-steam-lid-button").click();
    await page.waitForTimeout(2600);
    await page.getByTestId("cooking-steam-lid-button").click();
    await expect(page.getByTestId("cooking-steam-done")).toBeVisible({ timeout: 4000 });
    await page.waitForTimeout(700);
    const before = await page.evaluate(() => {
      const w = document.querySelector<HTMLElement>(".pizza-dough .pizza-topping--clam .ingredient-piece-visual__emoji")!;
      return { cls: w.className, glyph: getComputedStyle(w.querySelector(".ingredient-glyph")!).filter, wrapper: getComputedStyle(w).filter };
    });
    expect(before.cls).toContain("ingredient-piece--steamed");
    expect(before.glyph).toMatch(/brightness\(/);
    await enterBakeAtZero(page);
    await page.clock.runFor(Math.round((66 / BAKE_SPEED_PCT_PER_S) * 1000)); // the needle at 66, inside the JUST band
    const during = await page.evaluate(() => {
      const w = document.querySelector<HTMLElement>(".pizza-dough .pizza-topping--clam .ingredient-piece-visual__emoji")!;
      return { inline: w.style.filter, glyph: getComputedStyle(w.querySelector(".ingredient-glyph")!).filter };
    });
    expect(during.inline).toMatch(/brightness\(.*\) saturate\(.*\) sepia\(/); // the bake's roast on the wrapper
    expect(during.glyph).toMatch(/brightness\(/); // and the steam on the glyph, at the same time
    await shot(page, "bake-00-steamed-in-bake");
    await page.getByRole("button", { name: "取り出す！" }).evaluate((el) => (el as HTMLButtonElement).click());
    await page.clock.resume();
    await page.getByRole("button", { name: "完成" }).click();
    await page.waitForSelector(".result-panel", { timeout: 15_000 });
    await shot(page, "bake-01-result");
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).not.toBe(REAL);
  });

  test("a reload starts the entry over (nothing is kept) and ?cookSteamMs= still compares", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1&cookSteamVariant=lid&cookSteamMs=3000");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await tapDoughPercent(page, 40, 50);
    expect(await clamPieces(page)).toBe(1);
    await pill(page).click();
    await expect(screenEl(page)).toHaveAttribute("data-full-ms", "3000");
    await expect(page.getByTestId("cooking-steam-tune")).toBeVisible();
    await page.reload();
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    expect(await clamPieces(page)).toBe(0);
  });
});

/**
 * Touch input (the ghost click of the pill's own tap). On a touch tap the pill opens the screen on `pointerup`; the browser then sends the tap's compatibility
 * `mousedown` / `mouseup` / `click` (no new `pointerdown`) to whatever is under the finger NOW -- the screen's bottom button. Before the fix operation A started
 * steaming the moment the screen opened. Both authority viewports and the short visible heights real iPhone Safari has (address / tab bar).
 */
test.describe("Cooking Steam with touch input (?cookSteamHv=1)", () => {
  test.use({ hasTouch: true });

  for (const short of [false, true]) {
    for (const variant of ["lid", "shake"] as const) {
      test(`${variant}${short ? ", short screen" : ""}: opening the screen with a tap leaves it idle; the next deliberate tap (120 ms later) starts the steam`, async ({ page }) => {
        const vp = page.viewportSize()!;
        if (short) await page.setViewportSize({ width: vp.width, height: vp.width === 390 ? 664 : 640 });
        await openEntry(page, `?cookSteamHv=1&cookSteamVariant=${variant}`);
        await expect(pill(page)).toBeVisible({ timeout: 10_000 });
        // the order and targets of the events that follow the pill's tap (kept for the failure message)
        await page.evaluate(() => {
          const w = window as unknown as { __log: string[] };
          w.__log = [];
          for (const t of ["pointerdown", "touchstart", "pointerup", "mousedown", "click"]) {
            document.addEventListener(t, (e) => w.__log.push(`${t}->${(e.target as HTMLElement).getAttribute?.("data-testid") ?? (e.target as HTMLElement).className?.toString().slice(0, 24)}`), true);
          }
        });
        await pill(page).tap();
        await expect(screenEl(page)).toBeVisible();
        await page.waitForTimeout(400); // long enough for any compatibility click of that same tap to have arrived
        const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log.join(" | "));
        await expect(screenEl(page), `events after the pill's tap: ${log}`).toHaveAttribute("data-mode", "idle");
        if (variant === "lid") await expect(page.getByTestId("cooking-steam-lid-button")).toHaveText(/ふたをする/);
        await shot(page, `touch-${variant}${short ? "-short" : ""}-00-just-opened-idle`);
        // the next EXPLICIT tap works at once: no dead time after the screen opens
        await page.waitForTimeout(120);
        await page.getByTestId(variant === "lid" ? "cooking-steam-lid-button" : "cooking-steam-shake").tap();
        await expect(screenEl(page)).toHaveAttribute("data-mode", "steaming");
        await shot(page, `touch-${variant}${short ? "-short" : ""}-01-steaming-after-own-tap`);
        // and the controls are all inside the stage, on this height too
        const fits = await page.evaluate(() => {
          const st = document.querySelector(".pizza-stage")!.getBoundingClientRect();
          const inside = (sel: string) => [...document.querySelectorAll(sel)].every((el) => { const r = el.getBoundingClientRect(); return r.left >= st.left - 0.5 && r.right <= st.right + 0.5 && r.top >= st.top - 0.5 && r.bottom <= st.bottom + 0.5; });
          return { controls: inside(".cooking-steam__button"), close: inside(".cooking-steam__close"), noOverflowX: document.documentElement.scrollWidth <= innerWidth };
        });
        expect(fits).toEqual({ controls: true, close: true, noOverflowX: true });
      });
    }
  }

  test("two quick taps in a row both count: the first starts A's steam, the second (lifted after the minimum) keeps it", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1&cookSteamVariant=lid");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await pill(page).tap();
    await expect(screenEl(page)).toBeVisible();
    await page.waitForTimeout(300);
    await expect(screenEl(page)).toHaveAttribute("data-mode", "idle");
    await page.getByTestId("cooking-steam-lid-button").tap();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "steaming");
    await page.waitForTimeout(900);
    await page.getByTestId("cooking-steam-lid-button").tap();
    await expect(screenEl(page)).toHaveAttribute("data-mode", "done");
  });

  test("a touch drag on the pot (B) never scrolls the page or selects text, and a long press keeps the screen", async ({ page }) => {
    await openEntry(page, "?cookSteamHv=1&cookSteamVariant=shake");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await pill(page).tap();
    await page.waitForTimeout(300);
    const cdp = await page.context().newCDPSession(page).catch(() => null);
    test.skip(cdp === null, "needs CDP touch events (Chromium only)");
    const touch = (type: string, x: number, y: number) => cdp!.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] } as never);
    const pot = (await page.getByTestId("cooking-steam-pot").boundingBox())!;
    const y = pot.y + pot.height * 0.6;
    const before = await page.evaluate(() => JSON.stringify([scrollX, scrollY, document.documentElement.scrollTop, document.querySelector(".game-screen")?.scrollTop ?? 0]));
    await touch("touchStart", pot.x + pot.width * 0.1, y);
    for (let i = 0; i < 20; i += 1) {
      await touch("touchMove", pot.x + pot.width * (i % 2 === 0 ? 0.9 : 0.1), y + (i % 4 === 1 ? 14 : i % 4 === 3 ? -14 : 0));
      await page.waitForTimeout(60);
    }
    await touch("touchEnd", 0, 0);
    await expect(screenEl(page)).toHaveAttribute("data-mode", "steaming");
    expect(Number(await screenEl(page).getAttribute("data-open-count"))).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => JSON.stringify([scrollX, scrollY, document.documentElement.scrollTop, document.querySelector(".game-screen")?.scrollTop ?? 0]))).toBe(before);
    expect(await page.evaluate(() => String(getSelection()?.toString() ?? ""))).toBe("");
    await touch("touchStart", pot.x + pot.width * 0.5, y);
    await page.waitForTimeout(900);
    await touch("touchEnd", 0, 0);
    await expect(screenEl(page)).toBeVisible();
  });
});
