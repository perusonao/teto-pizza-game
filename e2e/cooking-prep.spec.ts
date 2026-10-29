import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep, tapDoughPercent } from "./gestures";
import { base, HAND_ON_OWNED, SAVE_KEY } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Cooking Prep Phase 1 PR-B + Phase 1B #696 (下ごしらえ「炒める」, now a timing game): the optional beef prep in the TOPPING step, on both authority viewports (390x844, 360x800).
 * Production is OFF; the Preview / DEV opt-in `?cookPrep=on` stands in for it, so this runs against the gate as shipped. Pill geometry is the Owner's S0b
 * decision: 44px high, centred, pill bottom = stage bottom - 18px, >= 16px above the family-chip row, never touching the dough.
 * HV_SHOT_DIR (optional) writes the screenshots.
 */
const SHOT_DIR = process.env.HV_SHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

async function toTopping(page: Page, query: string, variant: "round" | "oval" | "square" = "round") {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(base(HAND_ON_OWNED))] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  if (variant === "oval") await page.getByRole("radio", { name: "ほかの生地" }).click();
  if (variant === "square") {
    await page.getByRole("radio", { name: "四角い生地" }).click();
    await finishSquareDough(page);
  } else await completeDoughStep(page);
  for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByTestId("prepare-dock")).toBeVisible();
}

/** The square tray's two-step dough (same drive as e2e/pan-switch-f4b.spec.ts). */
async function finishSquareDough(page: Page) {
  const layer = page.getByTestId("square-dough-layer");
  const attr = async (name: string) => (await layer.getAttribute(name)) ?? "";
  const at = async (x: number, y: number) => {
    const b = (await layer.boundingBox())!;
    return { x: b.x + (b.width * x) / 100, y: b.y + (b.height * y) / 100 };
  };
  const drag = async (pts: [number, number][]) => {
    const f = await at(...pts[0]);
    await page.mouse.move(f.x, f.y);
    await page.mouse.down();
    for (const pt of pts.slice(1)) {
      const q = await at(...pt);
      await page.mouse.move(q.x, q.y, { steps: 6 });
    }
    await page.mouse.up();
  };
  const rows = [14, 26, 38, 50, 62, 74, 86];
  for (let i = 0; i < rows.length; i += 1) await drag(i % 2 === 0 ? [[10, rows[i]], [50, rows[i]], [90, rows[i]]] : [[90, rows[i]], [50, rows[i]], [10, rows[i]]]);
  for (const [x, y] of [[10, 10], [90, 10], [90, 90], [10, 90]]) await drag([[50, 50], [x, y]]);
  for (let k = 0; k < 8 && (await attr("data-step")) !== "2"; k += 1) await drag([[12, 12 + k * 10], [88, 12 + k * 10]]);
  for (let k = 0; k < 60 && (await attr("data-complete")) !== "true"; k += 1) {
    const idx = await layer.evaluate((el) => {
      const v = (el.getAttribute("data-thickness") ?? "").split(",").map(Number);
      let best = 0;
      for (let i = 1; i < v.length; i += 1) if (v[i] > v[best]) best = i;
      return best;
    });
    const q = await at(((idx % 16) + 0.5) * (100 / 16), (Math.floor(idx / 16) + 0.5) * (100 / 16));
    await page.mouse.move(q.x, q.y);
    await page.mouse.down();
    await page.waitForTimeout(k % 3 === 0 ? 700 : 30);
    await page.mouse.up();
  }
}

async function select(page: Page, label: string) {
  const chip = page.locator(".ingredient-chip").filter({ hasText: label }).first();
  for (let i = 0; i < 20 && !(await chip.isVisible()); i += 1) {
    const nextPage = page.getByRole("button", { name: "次のページ" });
    if (!(await nextPage.isEnabled().catch(() => false))) break;
    await nextPage.click();
  }
  await chip.click();
}

const rect = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height };
  }, selector);
const pill = (page: Page) => page.getByTestId("cooking-prep-pill");
const pan = (page: Page) => page.getByTestId("cooking-prep-pan");
const beefFill = (page: Page) =>
  page.evaluate(() => {
    const path = document.querySelector(".pizza-dough .pizza-topping--beef svg path:nth-of-type(1)");
    return path ? getComputedStyle(path).fill : null;
  });
const beefPieces = (page: Page) => page.locator(".pizza-dough .pizza-topping--beef").count();
const readSave = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), SAVE_KEY);

async function noOverflow(page: Page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.sh).toBeLessThanOrEqual(m.ih);
}

test.describe("Cooking Prep: HV entry (?cookPrepHv=1)", () => {
  const REAL = "REAL-SAVE-SENTINEL";
  async function openEntry(page: Page, query: string) {
    await page.goto("icons/icon-16.png");
    await page.evaluate(([k, v]) => {
      localStorage.clear();
      localStorage.setItem(k, v);
    }, [SAVE_KEY, REAL] as const);
    await page.goto(`/${query}`);
  }

  test("one URL lands on the TOPPING step with the beef selected and unprepared, and the real save is never touched", async ({ page, context }) => {
    await openEntry(page, "?cookPrepHv=1&cookPrep=on");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("prepare-dock")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-cook-prep-hv", "cook-prep-hv-v1");
    expect(await beefPieces(page)).toBe(0);
    await expect(page.getByTestId("cooking-prep-done")).toHaveCount(0);
    // a placed piece starts raw, and the pan opens straight from here
    await tapDoughPercent(page, 38, 48);
    expect(await beefPieces(page)).toBe(1);
    expect(await beefFill(page)).toBe("rgb(184, 71, 58)");
    await pill(page).click();
    await expect(pan(page)).toBeVisible();
    // another page of the same origin still sees the device's own save, byte for byte
    const other = await context.newPage();
    await other.goto("icons/icon-16.png");
    expect(await other.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(REAL);
    await other.close();
  });

  test("a reload starts the entry over (nothing is kept)", async ({ page }) => {
    await openEntry(page, "?cookPrepHv=1&cookPrep=on");
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    await tapDoughPercent(page, 38, 48);
    expect(await beefPieces(page)).toBe(1);
    await page.reload();
    await expect(pill(page)).toBeVisible({ timeout: 10_000 });
    expect(await beefPieces(page)).toBe(0);
  });

  test("without the param the game opens as usual: no marker, no jump into cooking", async ({ page }) => {
    await openEntry(page, "?cookPrep=on");
    await page.waitForSelector(".app-frame");
    await expect(page.locator("html")).not.toHaveAttribute("data-cook-prep-hv", /.*/);
    await expect(pill(page)).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(REAL);
  });
});

test.describe("Cooking Prep: production default (no opt-in)", () => {
  test("beef selected: no pill, no prep DOM, dock not inert", async ({ page }) => {
    await toTopping(page, "");
    await select(page, "牛肉");
    await expect(page.locator('[class*="cooking-prep"]')).toHaveCount(0);
    await expect(page.getByTestId("prepare-dock")).not.toHaveAttribute("inert", /.*/);
    await tapDoughPercent(page, 50, 50);
    expect(await beefPieces(page)).toBe(1);
  });
});

test.describe("Cooking Prep: opt-in", () => {
  test("the pill shows only for beef; 44px, centred, 18px above the stage bottom, >= 16px above the family chips, clear of the dough; nothing moves", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "たまねぎ");
    await expect(pill(page)).toHaveCount(0);
    const before = { stage: await rect(page, ".pizza-stage"), dock: await rect(page, ".prepare-dock"), bar: await rect(page, ".prepare-bake-bar"), dough: await rect(page, ".pizza-dough") };
    await select(page, "牛肉");
    await expect(pill(page)).toBeVisible();
    await expect(pill(page)).toHaveText("🍳 炒める");
    const p = (await rect(page, '[data-testid="cooking-prep-pill"]'))!;
    const stage = (await rect(page, ".pizza-stage"))!;
    const dough = (await rect(page, ".pizza-dough"))!;
    const famTop = await page.evaluate(() => Math.min(...[...document.querySelectorAll(".prepare-dock .tray-family-chip")].map((e) => e.getBoundingClientRect().top)));
    const vp = page.viewportSize()!;
    expect(p.h, "pill height").toBeGreaterThanOrEqual(44);
    expect(p.h, "pill height").toBeLessThanOrEqual(44.5);
    expect(p.w, "pill width").toBeGreaterThanOrEqual(120);
    expect(Math.abs((p.l + p.r) / 2 - (stage.l + stage.r) / 2), "centred").toBeLessThanOrEqual(1);
    expect(Math.abs(stage.b - p.b - 18), "pill bottom = stage bottom - 18").toBeLessThanOrEqual(0.5);
    expect(famTop - p.b, "gap to the family chips").toBeGreaterThanOrEqual(15.9);
    expect(p.t, "never overlaps the dough box").toBeGreaterThanOrEqual(dough.b);
    expect(p.l).toBeGreaterThanOrEqual(0);
    expect(p.r).toBeLessThanOrEqual(vp.width);
    // the whole layout is exactly what it was without the pill
    expect(await rect(page, ".pizza-stage")).toEqual(before.stage);
    expect(await rect(page, ".prepare-dock")).toEqual(before.dock);
    expect(await rect(page, ".prepare-bake-bar")).toEqual(before.bar);
    expect(await rect(page, ".pizza-dough")).toEqual(before.dough);
    expect(await page.locator(".making-step-tabs > *").count()).toBe(6);
    await noOverflow(page);
    await shot(page, "1-pill");
  });

  test("the same placement rule on the oval (Pinsa) dough", async ({ page }) => {
    await toTopping(page, "?cookPrep=on&doughSwitch=open", "oval");
    await select(page, "牛肉");
    await expect(pill(page)).toBeVisible();
    const p = (await rect(page, '[data-testid="cooking-prep-pill"]'))!;
    const stage = (await rect(page, ".pizza-stage"))!;
    const dough = (await rect(page, ".pizza-dough"))!;
    const famTop = await page.evaluate(() => Math.min(...[...document.querySelectorAll(".prepare-dock .tray-family-chip")].map((e) => e.getBoundingClientRect().top)));
    await expect(page.locator(".pizza-dough")).toHaveClass(/pizza-dough--oval/);
    expect(Math.abs(stage.b - p.b - 18)).toBeLessThanOrEqual(0.5);
    expect(famTop - p.b).toBeGreaterThanOrEqual(15.9);
    expect(p.t).toBeGreaterThanOrEqual(dough.b);
    await shot(page, "2-pill-oval");
  });

  test("the same placement rule on the square tray", async ({ page }) => {
    test.setTimeout(120_000);
    await toTopping(page, "?cookPrep=on&panSwitch=open", "square");
    await select(page, "牛肉");
    await expect(pill(page)).toBeVisible();
    await expect(page.locator(".pizza-dough")).toHaveClass(/pizza-dough--square-pan/);
    const p = (await rect(page, '[data-testid="cooking-prep-pill"]'))!;
    const stage = (await rect(page, ".pizza-stage"))!;
    const dough = (await rect(page, ".pizza-dough"))!;
    const famTop = await page.evaluate(() => Math.min(...[...document.querySelectorAll(".prepare-dock .tray-family-chip")].map((e) => e.getBoundingClientRect().top)));
    expect(Math.abs(stage.b - p.b - 18)).toBeLessThanOrEqual(0.5);
    expect(famTop - p.b).toBeGreaterThanOrEqual(15.9);
    expect(p.t).toBeGreaterThanOrEqual(dough.b);
    await shot(page, "2b-pill-square");
  });

  test("the pan screen covers the stage only, the dock is inert, nothing leaks to the dough, × cancels and leaves nothing", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "牛肉");
    await tapDoughPercent(page, 35, 50);
    expect(await beefPieces(page)).toBe(1);
    const stageBefore = (await rect(page, ".pizza-stage"))!;
    const dockBefore = await rect(page, ".prepare-dock");
    const barBefore = await rect(page, ".prepare-bake-bar");
    await pill(page).click();
    await expect(pan(page)).toBeVisible();
    const o = (await rect(page, '[data-testid="cooking-prep-pan"]'))!;
    expect(o.t).toBeCloseTo(stageBefore.t, 0);
    expect(o.b).toBeCloseTo(stageBefore.b, 0);
    expect(o.w).toBeCloseTo(stageBefore.w, 0);
    expect(await rect(page, ".prepare-dock")).toEqual(dockBefore);
    expect(await rect(page, ".prepare-bake-bar")).toEqual(barBefore);
    await expect(page.getByTestId("prepare-dock")).toHaveAttribute("inert", "");
    const x = (await rect(page, '[data-testid="cooking-prep-cancel"]'))!;
    expect(x.w).toBeGreaterThanOrEqual(44);
    expect(x.h).toBeGreaterThanOrEqual(44);
    expect(x.r).toBeLessThanOrEqual(stageBefore.r);
    expect(x.t).toBeGreaterThanOrEqual(stageBefore.t);
    await shot(page, "3-pan-open");
    // a tap on the dough while the pan is up must not place a piece
    const d = (await rect(page, ".pizza-dough"))!;
    await page.mouse.click((d.l + d.r) / 2, (d.t + d.b) / 2);
    expect(await beefPieces(page)).toBe(1);
    await page.getByTestId("cooking-prep-cancel").click();
    await expect(pan(page)).toHaveCount(0);
    await expect(pill(page)).toBeVisible();
    await expect(page.getByTestId("prepare-dock")).not.toHaveAttribute("inert", /.*/);
    expect(await page.locator(".ingredient-piece--prepared").count()).toBe(0);
    await expect(page.getByTestId("cooking-prep-done")).toHaveCount(0);
  });

  test("the dough behind the pan screen takes no keyboard input (focus + Enter / Space place nothing); it works again after ×", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "牛肉");
    await tapDoughPercent(page, 35, 50);
    expect(await beefPieces(page)).toBe(1);
    await pill(page).click();
    await expect(pan(page)).toBeVisible();
    const dough = page.locator(".pizza-dough");
    await expect(dough).toHaveAttribute("tabindex", "-1");
    await dough.evaluate((el) => (el as HTMLElement).focus());
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    expect(await beefPieces(page)).toBe(1);
    await expect(pan(page)).toBeVisible();
    await page.getByTestId("cooking-prep-cancel").click();
    await expect(pan(page)).toHaveCount(0);
    await expect(dough).toHaveAttribute("tabindex", "0");
    await dough.evaluate((el) => (el as HTMLElement).focus());
    await page.keyboard.press("Enter");
    expect(await beefPieces(page)).toBe(2);
  });

  test("keyboard: with the pan screen up, Shift+Tab / Enter / Space cannot reach the dough behind it; after × everything works again (Codex P2)", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "牛肉");
    await pill(page).focus();
    await page.keyboard.press("Enter");
    await expect(pan(page)).toBeVisible();
    await expect(page.locator(".pizza-dough")).toHaveAttribute("tabindex", "-1");
    // One step back from the pan surface lands on the header's ホーム button (before the fix it landed on the dough). A second step would leave the page,
    // and leaving the window discards the pan screen by design (AC-10); the Vitest harness repeats Shift+Tab without that limit.
    for (let i = 0; i < 1; i += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await page.evaluate(() => document.activeElement?.classList.contains("pizza-dough") ?? false), `Shift+Tab #${i + 1}`).toBe(false);
    }
    await expect(pan(page)).toBeVisible();
    await page.locator(".pizza-dough").evaluate((el) => (el as HTMLElement).focus()); // even a forced focus
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    expect(await beefPieces(page)).toBe(0);
    await expect(pan(page)).toBeVisible(); // switching the input off did not discard the pan screen
    await page.getByTestId("cooking-prep-cancel").click();
    await expect(pan(page)).toHaveCount(0);
    await expect(page.locator(".pizza-dough")).toHaveAttribute("tabindex", "0");
    await page.locator(".pizza-dough").focus();
    await page.keyboard.press("Enter");
    expect(await beefPieces(page)).toBe(1);
  });

  test("skipping is fine: pieces are placed raw and nothing is asked", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "牛肉");
    await tapDoughPercent(page, 40, 50);
    await tapDoughPercent(page, 60, 50);
    expect(await beefPieces(page)).toBe(2);
    expect(await beefFill(page)).toBe("rgb(184, 71, 58)");
    await expect(pill(page)).toBeVisible();
  });
});


/* ------------------------------------------------------------------------------------------------------------------------------------------------
   Phase 1B (#696): the timing game. The page clock is faked and frozen BEFORE the pan opens, and the presses are keyboard presses (their moment is read
   from the same faked clock), so every grade lands on an exact millisecond and nothing depends on how loaded the machine is. The real pointer path
   (the press's own timeStamp) is exercised separately, in real time, waiting on the pan's own stage instead of sleeping.
   ------------------------------------------------------------------------------------------------------------------------------------------------ */
const take = (page: Page) => page.getByTestId("cooking-prep-take");
const grade = (page: Page) => pan(page).getAttribute("data-grade");

/** Freezes the faked clock here: from now on time moves only by `page.clock.runFor`. */
async function freezeClock(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 50);
}
async function openPanByKeyboard(page: Page) {
  await pill(page).focus();
  await page.keyboard.press("Enter");
  await expect(pan(page)).toBeVisible();
  await expect(take(page)).toBeFocused();
}
/** Leaving the window discards a pan screen (AC-10): the cheap way back to the pill between cases. */
async function discardPan(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(pan(page)).toHaveCount(0);
  await expect(pill(page)).toBeVisible();
}
async function toFrozenTopping(page: Page, opts: { place?: [number, number][] } = {}) {
  await page.clock.install();
  await toTopping(page, "?cookPrep=on");
  await select(page, "牛肉");
  for (const [x, y] of opts.place ?? []) await tapDoughPercent(page, x, y);
  await freezeClock(page);
}
/** Opens the pan, lets `ms` of game time pass, presses 「取り出す！」 from the keyboard, and returns the grade (null = the press was ignored). */
async function gradeAfter(page: Page, ms: number): Promise<string | null> {
  await openPanByKeyboard(page);
  await page.clock.runFor(ms);
  await page.keyboard.press("Enter");
  const g = await grade(page);
  return g;
}

test.describe("Cooking Prep Phase 1B: timing game", () => {
  test("grades the press by its own moment, half-open: 4200 ms exactly is overdone; a press inside 300 ms is no grade", async ({ page }) => {
    await toFrozenTopping(page);
    const cases: [number, string | null][] = [
      [0, null],
      [299, null],
      [300, "early"],
      [2099, "early"],
      [2100, "best"],
      [4199, "best"],
      [4200, "overdone"],
      [5999, "overdone"],
    ];
    for (const [ms, expected] of cases) {
      expect(await gradeAfter(page, ms), `+${ms}ms`).toBe(expected);
      await discardPan(page);
    }
  });

  test("the time-out closes the pan itself at 6000 ms as overdone (\"出し遅れた\"), and nothing is kept", async ({ page }) => {
    await toFrozenTopping(page, { place: [[38, 48]] });
    const saveBefore = await readSave(page);
    await openPanByKeyboard(page);
    await page.clock.runFor(5999);
    await expect(pan(page)).toHaveAttribute("data-mode", "running");
    await page.clock.runFor(1);
    await expect(pan(page)).toHaveAttribute("data-grade", "overdone");
    await expect(page.getByTestId("cooking-prep-result")).toHaveText("出し遅れた…");
    await expect(page.getByTestId("cooking-prep-choices")).toBeVisible();
    await expect(page.getByTestId("cooking-prep-done")).toHaveCount(0);
    expect(await readSave(page)).toEqual(saveBefore);
  });

  test("the display stages switch on their exact edges and the pan shows no gauge, bar, ring, number or countdown", async ({ page }) => {
    await toFrozenTopping(page);
    await openPanByKeyboard(page);
    let at = 0;
    for (const [ms, stage] of [[0, "0"], [1799, "0"], [1800, "1"], [2099, "1"], [2100, "2"], [3599, "2"], [3600, "3"], [4199, "3"], [4200, "4"]] as const) {
      await page.clock.runFor(ms - at);
      at = ms;
      await expect(pan(page), `+${ms}ms`).toHaveAttribute("data-stage", stage);
      const text = (await pan(page).textContent()) ?? "";
      expect(text).not.toMatch(/[0-9０-９]|秒|%|％|残り/);
      expect(await pan(page).locator('progress, meter, [role="progressbar"], [role="meter"], [role="timer"]').count()).toBe(0);
    }
    await shot(page, "1b-stage4-smoke");
  });

  test("the beef looks different at early / best / burnt, and what you took out stays frozen", async ({ page }) => {
    await toFrozenTopping(page);
    const looks: string[] = [];
    for (const ms of [1000, 3150, 5500]) {
      await gradeAfter(page, ms);
      const fill = await page.getByTestId("cooking-prep-beef").evaluate((el) => getComputedStyle(el.querySelector("svg path:nth-of-type(1)")!).fill);
      await page.clock.runFor(200);
      expect(await page.getByTestId("cooking-prep-beef").evaluate((el) => getComputedStyle(el.querySelector("svg path:nth-of-type(1)")!).fill)).toBe(fill);
      looks.push(fill);
      await shot(page, `1b-result-${ms}`);
      await discardPan(page);
    }
    expect(new Set(looks).size).toBe(3);
    expect(looks[1]).toBe("rgb(122, 66, 38)"); // the middle of best is the cooked target
  });

  test("best: the result shows, then the pan closes itself, the pieces take the cooked look, the mark appears, saves are untouched, and the guard holds the dough", async ({ page }) => {
    await toFrozenTopping(page, { place: [[38, 48], [62, 52]] });
    expect(await beefPieces(page)).toBe(2);
    expect(await beefFill(page)).toBe("rgb(184, 71, 58)");
    const saveBefore = await readSave(page);
    await openPanByKeyboard(page);
    await page.clock.runFor(3150);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("cooking-prep-result")).toHaveText("ちょうどいい！");
    await expect(page.getByTestId("cooking-prep-choices")).toHaveCount(0); // best asks nothing: it closes by itself
    await page.clock.runFor(699);
    await expect(pan(page)).toBeVisible();
    await page.clock.runFor(1);
    await expect(page.getByTestId("cooking-prep-done")).toHaveText("✓ 炒め済み");
    await expect(pan(page)).toHaveCount(0);
    expect(await beefFill(page)).toBe("rgb(122, 66, 38)");
    expect(await beefPieces(page)).toBe(2);
    expect(await readSave(page)).toEqual(saveBefore);
    // the stage swallows taps for 300 ms, then placing works as always and the new piece is prepped too
    await expect(page.getByTestId("cooking-prep-guard")).toHaveCount(1);
    const d = (await rect(page, ".pizza-dough"))!;
    await page.mouse.click((d.l + d.r) / 2, (d.t + d.b) / 2);
    expect(await beefPieces(page)).toBe(2);
    await page.clock.runFor(300);
    await expect(page.getByTestId("cooking-prep-guard")).toHaveCount(0);
    await tapDoughPercent(page, 50, 30);
    expect(await beefPieces(page)).toBe(3);
    expect(await page.locator(".pizza-dough .pizza-topping--beef .ingredient-piece--prepared").count()).toBe(3);
    await shot(page, "1b-best-kept");
  });

  test("early / overdone: nothing is kept until you choose; 「これで使う」 keeps that look, 「もう一度炒める」 starts fresh, × leaves nothing", async ({ page }) => {
    await toFrozenTopping(page, { place: [[40, 50]] });
    const saveBefore = await readSave(page);
    // early -> the choices wake up after 300 ms; retry gives a fresh run
    await openPanByKeyboard(page);
    await page.clock.runFor(1000);
    await page.keyboard.press("Enter");
    await expect(pan(page)).toHaveAttribute("data-grade", "early");
    await expect(page.getByTestId("cooking-prep-result")).toHaveText("まだ赤みが残ってる");
    await expect(page.getByTestId("cooking-prep-choices")).toHaveAttribute("data-armed", "false");
    await page.getByTestId("cooking-prep-use").click({ force: true });
    await expect(pan(page)).toBeVisible(); // too soon: nothing was kept
    await page.clock.runFor(300);
    await expect(page.getByTestId("cooking-prep-choices")).toHaveAttribute("data-armed", "true");
    await page.getByTestId("cooking-prep-retry").click();
    await expect(pan(page)).toHaveAttribute("data-mode", "running");
    await expect(pan(page)).toHaveAttribute("data-stage", "0");
    await expect(take(page)).toHaveAttribute("data-armed", "false");
    await expect(page.getByTestId("cooking-prep-done")).toHaveCount(0);
    // the fresh run has its own clock; run it to the time-out (burnt) and keep that
    await page.clock.runFor(6000);
    await expect(pan(page)).toHaveAttribute("data-grade", "overdone");
    await page.clock.runFor(300);
    await shot(page, "1b-overdone-choices");
    await page.getByTestId("cooking-prep-use").click();
    await expect(page.getByTestId("cooking-prep-done")).toHaveText("✓ 炒め済み");
    expect(await beefFill(page)).toBe("rgb(58, 34, 24)"); // burnt (provisional colour)
    expect(await readSave(page)).toEqual(saveBefore);
    expect(await page.locator("[data-testid=cooking-prep-pan]").count()).toBe(0);
  });

  test("× closes it at any moment and leaves nothing: running, and during a result", async ({ page }) => {
    await toFrozenTopping(page, { place: [[40, 50]] });
    await openPanByKeyboard(page);
    await page.clock.runFor(1500);
    await page.getByTestId("cooking-prep-cancel").click();
    await expect(pan(page)).toHaveCount(0);
    await expect(pill(page)).toBeVisible();
    await openPanByKeyboard(page);
    await page.clock.runFor(1000);
    await page.keyboard.press("Enter");
    await expect(pan(page)).toHaveAttribute("data-grade", "early");
    await page.getByTestId("cooking-prep-cancel").click();
    await expect(pan(page)).toHaveCount(0);
    await page.clock.runFor(10_000);
    await expect(page.getByTestId("cooking-prep-done")).toHaveCount(0);
    expect(await page.locator(".ingredient-piece--prepared").count()).toBe(0);
    expect(await beefFill(page)).toBe("rgb(184, 71, 58)");
  });

  test("layout: 「取り出す！」 is >= 56px tall, inside the stage, >= 16px from ×, the result buttons are tall too, and nothing scrolls", async ({ page }) => {
    await toFrozenTopping(page);
    await openPanByKeyboard(page);
    const stage = (await rect(page, ".pizza-stage"))!;
    const t = (await rect(page, '[data-testid="cooking-prep-take"]'))!;
    const x = (await rect(page, '[data-testid="cooking-prep-cancel"]'))!;
    const panel = (await rect(page, ".cooking-prep-pan__pan"))!;
    expect(t.h).toBeGreaterThanOrEqual(56);
    expect(t.t).toBeGreaterThanOrEqual(stage.t);
    expect(t.b).toBeLessThanOrEqual(stage.b);
    expect(t.l).toBeGreaterThanOrEqual(stage.l);
    expect(t.r).toBeLessThanOrEqual(stage.r);
    expect(t.t).toBeGreaterThanOrEqual(panel.b); // below the pan, never over it
    // gap to the × (vertical, or separated sideways): at least 16px either way
    const gapY = t.t - x.b;
    const gapX = x.l - t.r;
    expect(Math.max(gapY, gapX)).toBeGreaterThanOrEqual(16);
    expect(x.w).toBeGreaterThanOrEqual(44);
    await noOverflow(page);
    await shot(page, "1b-pan-running");
    await page.clock.runFor(1000);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("cooking-prep-choices")).toBeVisible();
    for (const id of ["cooking-prep-retry", "cooking-prep-use"]) {
      const r = (await rect(page, `[data-testid="${id}"]`))!;
      expect(r.h).toBeGreaterThanOrEqual(48);
      expect(r.b).toBeLessThanOrEqual(stage.b);
      expect(r.l).toBeGreaterThanOrEqual(stage.l);
      expect(r.r).toBeLessThanOrEqual(stage.r);
    }
    await noOverflow(page);
  });

  test("keyboard: Enter opens, the take button has the focus, Space takes it", async ({ page }) => {
    await toFrozenTopping(page);
    await openPanByKeyboard(page);
    await page.clock.runFor(3000);
    await page.keyboard.press("Space");
    await expect(pan(page)).toHaveAttribute("data-grade", "best");
    await expect(page.getByRole("status").filter({ hasText: "ちょうどいい！" })).toHaveCount(1);
  });

  test("real pointer input: the press's own timestamp decides (waiting on the pan's stage, not on a sleep)", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "牛肉");
    await tapDoughPercent(page, 38, 48);
    // early: right after 「取り出す！」 wakes up
    await pill(page).click();
    await expect(take(page)).toHaveAttribute("data-armed", "true");
    await take(page).dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true });
    await expect(pan(page)).toHaveAttribute("data-grade", "early");
    await page.getByTestId("cooking-prep-cancel").click();
    // best: as soon as the beef is in its best stage (stage 2 lasts 1.5 s)
    await pill(page).click();
    await expect(pan(page)).toHaveAttribute("data-stage", "2", { timeout: 6000 });
    await take(page).dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true });
    await expect(pan(page)).toHaveAttribute("data-grade", "best");
    await expect(page.getByTestId("cooking-prep-done")).toBeVisible({ timeout: 4000 });
  });

  test("reduced motion: nothing animates, and every stage is still readable as a still frame (steam, then smoke, then dark smoke)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await toFrozenTopping(page);
    await openPanByKeyboard(page);
    const vapor = () =>
      page.evaluate(() => {
        const v = document.querySelector('[data-testid="cooking-prep-vapor"]') as HTMLElement;
        const i = v.querySelector("i") as HTMLElement;
        return { opacity: Number(getComputedStyle(v).opacity), animation: getComputedStyle(i).animationName, bg: getComputedStyle(i).backgroundImage };
      });
    const frames: { opacity: number; animation: string; bg: string }[] = [];
    let at = 0;
    for (const ms of [1000, 2500, 3800, 4500]) {
      await page.clock.runFor(ms - at);
      at = ms;
      frames.push(await vapor());
    }
    for (const f of frames) expect(f.animation).toBe("none");
    expect(frames[0].opacity).toBe(0); // stage 0: nothing yet
    expect(frames[1].opacity).toBeGreaterThan(0.5); // best: steam
    expect(frames[2].bg).not.toBe(frames[1].bg); // about to burn: the steam turned to smoke
    expect(frames[3].bg).not.toBe(frames[2].bg); // burnt: darker smoke
    const names = await page.evaluate(() => [...document.querySelectorAll(".cooking-prep-pan__bubbles i")].map((e) => getComputedStyle(e).animationName));
    for (const n of names) expect(n).toBe("none");
  });
});
