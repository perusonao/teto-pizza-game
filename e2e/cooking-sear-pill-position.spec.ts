import { expect, test, type Page } from "@playwright/test";
import { tapDoughPercent } from "./gestures";
import { SAVE_KEY } from "./support/familyTray";

/**
 * Cooking Sear (#724) iPhone HV follow-up: where the "🔥 炙る" pill (and the "✓ 炙り済み" mark) sits. The dough is ROUND and the stage square, so a corner of
 * the stage is free even when the dough fills the stage's height. Contract, on the authority viewports AND on the shorter visible heights a real iPhone Safari
 * has (address / tab bar): the pill never intersects the dough's circle, never blocks a tap on the dough, and stays inside the stage and the screen.
 *   - authority (390x844 / 360x800): the original centred band, pill bottom = stage bottom - 18px, >= 44px high.
 *   - short stage (the centred band would touch the round dough: stage < dough + ~124px, measured live): the compact bottom-right corner button, >= 52px high.
 * One test per profile (each sets its own viewport and runs once, on the 390x844 project, so a profile stays well inside the default timeout).
 */
const PROFILES: Array<[number, number, "band" | "corner"]> = [
  [390, 844, "band"],
  [360, 800, "band"],
  [390, 830, "band"],
  [390, 760, "corner"],
  [390, 750, "corner"],
  [390, 664, "corner"],
  [360, 700, "corner"],
  [360, 640, "corner"],
];

async function open(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(k, "X");
  }, [SAVE_KEY] as const);
  await page.goto("/?cookSearHv=1");
  await page.getByTestId("cooking-sear-pill").waitFor({ timeout: 10_000 });
}

const geometry = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const d = document.querySelector(".pizza-dough")!.getBoundingClientRect();
    const st = document.querySelector(".pizza-stage")!.getBoundingClientRect();
    const cx = d.left + d.width / 2;
    const cy = d.top + d.height / 2;
    const r = d.width / 2;
    // distance from the dough's centre to the nearest point of the element's box
    const nx = Math.min(Math.max(cx, b.left), b.right);
    const ny = Math.min(Math.max(cy, b.top), b.bottom);
    return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, stageB: st.bottom, stageL: st.left, stageR: st.right, stageT: st.top, clearance: Math.hypot(nx - cx, ny - cy) - r, iw: innerWidth, ih: innerHeight, cx };
  }, sel);

for (const [w, h, mode] of PROFILES) {
  test(`${w}x${h}: the pill (${mode}) never sits on the round dough, never blocks it, and the done mark keeps the same promise`, async ({ page }, info) => {
    test.skip(info.project.name !== "iphone-390x844", "sets its own viewport; once is enough");
    await open(page, w, h);
    const g = (await geometry(page, ".cooking-sear-pill"))!;
    const tag = `${w}x${h}`;
    // inside the stage and the screen
    expect(g.l, tag).toBeGreaterThanOrEqual(g.stageL);
    expect(g.r, tag).toBeLessThanOrEqual(g.stageR);
    expect(g.b, tag).toBeLessThanOrEqual(g.stageB);
    expect(g.t, tag).toBeGreaterThanOrEqual(g.stageT);
    expect(g.r, tag).toBeLessThanOrEqual(g.iw);
    // clear of the dough's circle (4px+ on the band, a few px on the corner where the stage is tight)
    expect(g.clearance, `${tag} pill vs dough circle`).toBeGreaterThanOrEqual(mode === "band" ? 3 : 4);
    if (mode === "band") {
      expect(g.h, tag).toBeGreaterThanOrEqual(44);
      expect(Math.abs(g.stageB - 18 - g.b), tag).toBeLessThanOrEqual(1);
      expect(Math.abs((g.l + g.r) / 2 - g.cx), `${tag} centred`).toBeLessThanOrEqual(1);
    } else {
      expect(g.h, tag).toBeGreaterThanOrEqual(52);
      expect(g.w, tag).toBeGreaterThanOrEqual(52);
      expect((g.l + g.r) / 2, `${tag} right-hand corner`).toBeGreaterThan(g.cx);
    }
    // the dough's lowest placeable area is reachable: a tap there places a piece and does not open the sear screen
    await tapDoughPercent(page, 50, 86);
    await expect(page.locator(".pizza-dough .pizza-topping--sausage")).toHaveCount(1);
    await expect(page.getByTestId("cooking-sear")).toHaveCount(0);
    // and the "done" mark keeps the same promise
    await page.getByTestId("cooking-sear-pill").click();
    const hb = (await page.getByTestId("cooking-sear-hold").boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.getByTestId("cooking-sear-done").waitFor({ timeout: 5000 });
    const dm = (await geometry(page, ".cooking-sear-done"))!;
    expect(dm.clearance, `${tag} done mark vs dough circle`).toBeGreaterThanOrEqual(mode === "band" ? 3 : 0);
    expect(dm.r, tag).toBeLessThanOrEqual(dm.iw);
    expect(dm.b, tag).toBeLessThanOrEqual(dm.stageB);
  });
}
