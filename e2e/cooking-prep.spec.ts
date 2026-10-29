import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep, tapDoughPercent } from "./gestures";
import { base, HAND_ON_OWNED, SAVE_KEY } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Cooking Prep Phase 1 PR-B (下ごしらえ「炒める」): the optional beef prep in the TOPPING step, on both authority viewports (390x844, 360x800).
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

async function threeTosses(page: Page) {
  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId("cooking-prep-surface").dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true });
    await page.waitForTimeout(160); // past the 120 ms debounce
  }
}
async function noOverflow(page: Page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.sh).toBeLessThanOrEqual(m.ih);
}

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
    // a tap on the dough while the pan is up must not place a piece (it is a toss instead)
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

  test("three taps prep the beef: the placed pieces change colour, the mark appears, saves / stock / pieces are untouched, and the first tap after it cannot leak", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "牛肉");
    await tapDoughPercent(page, 38, 48);
    await tapDoughPercent(page, 62, 52);
    expect(await beefPieces(page)).toBe(2);
    expect(await beefFill(page)).toBe("rgb(184, 71, 58)"); // BeefSlices as shipped (#691)
    const saveBefore = await readSave(page);
    await pill(page).click();
    await expect(pan(page)).toBeVisible();
    await threeTosses(page);
    await expect(page.getByTestId("cooking-prep-done")).toBeVisible({ timeout: 4000 });
    await expect(page.getByTestId("cooking-prep-done")).toHaveText("✓ 炒め済み");
    await expect(pan(page)).toHaveCount(0);
    expect(await beefFill(page)).toBe("rgb(122, 66, 38)"); // the prepped target, on pieces placed BEFORE the prep (Owner decision P-4)
    expect(await beefPieces(page)).toBe(2);
    expect(await readSave(page)).toEqual(saveBefore);
    await shot(page, "4-prepped");
    // right after it closes the stage swallows taps (AC-16 c) ...
    const d = (await rect(page, ".pizza-dough"))!;
    if (await page.getByTestId("cooking-prep-guard").count()) {
      await page.mouse.click((d.l + d.r) / 2, (d.t + d.b) / 2);
      expect(await beefPieces(page)).toBe(2);
    }
    // ... and a moment later placing works as always, and the new piece is prepped too
    await page.waitForTimeout(450);
    await expect(page.getByTestId("cooking-prep-guard")).toHaveCount(0);
    await tapDoughPercent(page, 50, 30);
    expect(await beefPieces(page)).toBe(3);
    expect(await page.locator(".pizza-dough .pizza-topping--beef .ingredient-piece--prepared").count()).toBe(3);
    // pressing the mark does nothing
    await page.getByTestId("cooking-prep-done").click({ force: true });
    await expect(pan(page)).toHaveCount(0);
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

  test("keyboard: Enter opens the pan, Space tosses, and it finishes", async ({ page }) => {
    await toTopping(page, "?cookPrep=on");
    await select(page, "牛肉");
    await pill(page).focus();
    await page.keyboard.press("Enter");
    await expect(pan(page)).toBeVisible();
    await expect(page.getByTestId("cooking-prep-surface")).toBeFocused();
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(160);
    }
    await expect(page.getByTestId("cooking-prep-done")).toBeVisible({ timeout: 4000 });
  });

  test("reduced motion: no toss / steam animation, the 1/3 text and colour steps remain", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await toTopping(page, "?cookPrep=on");
    await select(page, "牛肉");
    await pill(page).click();
    await page.getByTestId("cooking-prep-surface").dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true });
    await expect(page.getByRole("status").filter({ hasText: "1 / 3" })).toHaveCount(1);
    const names = await page.evaluate(() => [...document.querySelectorAll(".cooking-prep-pan__beef, .cooking-prep-pan__steam span")].map((e) => getComputedStyle(e).animationName));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toBe("none");
  });
});
