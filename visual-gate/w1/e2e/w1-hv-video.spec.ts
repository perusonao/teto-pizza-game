import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../../../e2e/gestures";
import { W1_GATE_SAVE_KEY, w1GateSeedSave } from "../candidates";

/**
 * W1 Visual Gate slice 3 -- scripted Human Verification video for the fresh-tomato Final
 * candidate B (opt-in: W1_GATE_HV_VIDEO=1, chromium-390x844 only, run against the exact
 * deployed bundle via W1_GATE_BASE_URL). Test-side only: the caption bar, tap cursor and final
 * checklist card are injected into the recorded page by this spec and are never part of the
 * Preview bundle. Step start times are written to W1_GATE_HV_MARKERS for frame sampling.
 */

const ENABLED = process.env.W1_GATE_HV_VIDEO === "1";
const MARKERS_PATH =
  process.env.W1_GATE_HV_MARKERS ?? fileURLToPath(new URL("../../../test-results/w1-hv-markers.json", import.meta.url));
const FREE_COOK_BAKE_TARGET = { start: 58, end: 78 };
const BAKE_NEEDLE_SPEED_PCT_PER_S = 55;
const HOLD = 3000;

test.skip(!ENABLED, "Human Verification video script: set W1_GATE_HV_VIDEO=1");

// Same 3x3 grid every time: fresh-tomato B (left) | pepperoni (middle) | cherry-tomato (right).
const COLUMNS = { fresh: 28, pepperoni: 50, cherry: 72 } as const;
const ROWS = [30, 52, 74];
const CHEESE: ReadonlyArray<readonly [number, number]> = [
  [39, 41],
  [61, 63],
];

/** Test-side annotation layer: caption bar + visible tap cursor (pointer-events: none). */
function installAnnotations() {
  const style = document.createElement("style");
  style.textContent = `
    #hv-caption { position: fixed; left: 0; right: 0; top: 0; z-index: 100000; padding: 6px 10px;
      background: rgba(20, 10, 40, 0.86); color: #fff; font: 700 13px/1.35 system-ui, sans-serif;
      pointer-events: none; }
    #hv-caption small { display: block; font-weight: 500; font-size: 11px; opacity: 0.9; }
    #hv-cursor { position: fixed; z-index: 100001; width: 22px; height: 22px; margin: -11px 0 0 -11px;
      border-radius: 50%; border: 3px solid #ff2d95; background: rgba(255, 45, 149, 0.25);
      pointer-events: none; transition: transform 90ms ease; display: none; }
    #hv-cursor.down { transform: scale(0.65); background: rgba(255, 45, 149, 0.6); }
    #hv-card { position: fixed; inset: 0; z-index: 100002; display: flex; flex-direction: column;
      justify-content: center; padding: 28px; background: #1d1030; color: #fff;
      font: 17px/1.5 system-ui, sans-serif; }
    #hv-card h1 { font-size: 30px; margin: 0 0 18px; letter-spacing: 0.04em; }
    #hv-card li { margin: 0 0 12px; }
    #hv-card p { font-size: 11px; opacity: 0.8; word-break: break-all; margin-top: 18px; }
  `;
  const mount = () => {
    if (document.getElementById("hv-cursor")) return;
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "hv-cursor";
    document.body.appendChild(cursor);
    const move = (event: PointerEvent) => {
      cursor.style.display = "block";
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", (event) => { move(event); cursor.classList.add("down"); }, true);
    window.addEventListener("pointerup", () => cursor.classList.remove("down"), true);
  };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
}

async function caption(page: Page, title: string, detail = "") {
  await page.evaluate(
    ([t, d]) => {
      let bar = document.getElementById("hv-caption");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "hv-caption";
        document.body.appendChild(bar);
      }
      bar.innerHTML = "";
      bar.append(t);
      if (d) {
        const small = document.createElement("small");
        small.textContent = d;
        bar.append(small);
      }
    },
    [title, detail] as const,
  );
}

async function selectChip(page: Page, name: string) {
  const chip = page.locator(".ingredient-chip").filter({
    has: page.locator(".ingredient-chip__name", { hasText: new RegExp(`^${name}$`) }),
  });
  await expect(chip).toHaveCount(1);
  await chip.click();
}

test("W1 Human Verification video: fresh-tomato Final candidate B", async ({ page }) => {
  test.setTimeout(240_000);
  const t0 = Date.now();
  const markers: Array<{ step: string; t: number }> = [];
  const mark = (step: string) => markers.push({ step, t: (Date.now() - t0) / 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript(installAnnotations);
  // Focused save for the tray comparison: fresh-tomato + cherry-tomato + pepperoni only.
  await page.addInitScript(
    ([key, raw]) => localStorage.setItem(key, JSON.stringify(raw)),
    [W1_GATE_SAVE_KEY, w1GateSeedSave(["fresh-tomato", "cherry-tomato", "pepperoni"])] as const,
  );

  // 1. Preview entry: exact source SHA + tomato B.
  await page.goto("./");
  const sha = (await page.getByTestId("w1-hub-sha").textContent())!.match(/[0-9a-f]{40}/)![0];
  await caption(page, "1. Preview entry", `source ${sha}`);
  mark("1-hub");
  await page.waitForTimeout(HOLD + 500);
  await page.getByRole("link", { name: /トマト B/ }).hover();
  await page.waitForTimeout(900);

  // Game with the focused save (the hub's own link re-seeds the full save, so go direct).
  await page.goto("./game.html?clam=dedicated");
  await page.waitForSelector(".app-frame");
  await expect(page.getByTestId("w1-preview-ribbon")).toContainText("tomato B (Final)");
  await expect(page.getByTestId("w1-preview-ribbon")).toContainText(sha);
  await caption(page, "1. Game: fresh-tomato B (Final)", `ribbon (bottom): ${sha.slice(0, 12)}… · tomato B (Final)`);
  mark("1-game-ribbon");
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await page.waitForSelector(".pizza-stage");

  await caption(page, "Preparing: dough → tomato sauce → mozzarella");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await selectChip(page, "トマトソース");
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await selectChip(page, "モッツァレラ");
  for (const [x, y] of CHEESE) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();

  // 2. Tray: fresh-tomato B, cherry-tomato 🍅 and pepperoni 🔴 side by side.
  await caption(page, "2. Tray: トマト (B) · チェリートマト 🍅 · ペパロニ 🔴", "stock ×30 each · same tray page");
  mark("2-tray");
  await expect(page.locator('.ingredient-chip [data-w1-visual="tomato-slice-final"]')).toHaveCount(1);
  await page.waitForTimeout(HOLD);

  // 3. Place 3 of each on one pizza.
  await caption(page, "3. Place ×3 each on the same pizza", "left: fresh-tomato B · middle: pepperoni · right: cherry-tomato");
  mark("3-place");
  for (const [name, x] of [["トマト", COLUMNS.fresh], ["ペパロニ", COLUMNS.pepperoni], ["チェリートマト", COLUMNS.cherry]] as const) {
    await selectChip(page, name);
    for (const y of ROWS) {
      await tapDoughPercent(page, x, y);
      await page.waitForTimeout(260);
    }
  }
  const counts = await page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const el of document.querySelectorAll(".pizza-topping")) {
      const id = [...el.classList].find((c) => c.startsWith("pizza-topping--"))!.slice(15);
      out[id] = (out[id] ?? 0) + 1;
    }
    return out;
  });
  expect(counts).toMatchObject({ "fresh-tomato": 3, pepperoni: 3, "cherry-tomato": 3 });
  await expect(page.locator('.pizza-stage [data-w1-visual="tomato-slice-final"]')).toHaveCount(3);

  // 4. Raw hold (+ same pizza in grayscale).
  await page.mouse.move(195, 820);
  await caption(page, "4. RAW — shape check", "left B slice · middle 🔴 pepperoni · right 🍅 cherry");
  mark("4-raw");
  await page.waitForTimeout(HOLD + 800);
  await page.evaluate(() => { document.documentElement.style.filter = "grayscale(1)"; });
  await caption(page, "4. RAW — GRAYSCALE (same pizza)", "B = light radial wheel · pepperoni = plain disc");
  mark("4-raw-grayscale");
  await page.waitForTimeout(HOLD);
  await page.evaluate(() => { document.documentElement.style.filter = ""; });

  // 5. Proper bake: needle frozen at the free-cook window center (heat 1.0).
  const center = (FREE_COOK_BAKE_TARGET.start + FREE_COOK_BAKE_TARGET.end) / 2;
  await page.clock.install();
  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForSelector(".bake-gauge__needle");
  await page.clock.pauseAt(Date.now() + 150);
  const needle = page.locator(".bake-gauge__needle");
  const needleAt = () => needle.evaluate((el) => Number.parseFloat((el as HTMLElement).style.left) || 0);
  const start = await needleAt();
  await page.clock.runFor(Math.max(0, Math.round(((center - start) / BAKE_NEEDLE_SPEED_PCT_PER_S) * 1000)));
  expect(await needleAt()).toBeGreaterThan(FREE_COOK_BAKE_TARGET.start);
  expect(await needleAt()).toBeLessThan(FREE_COOK_BAKE_TARGET.end);
  await caption(page, "5. BAKED — proper bake (target center)", "same composition as RAW");
  mark("5-baked");
  await page.waitForTimeout(HOLD + 800);

  // 6. Deep bake look: advance the needle to ~87 (heat ≈ 1.6), hold, then let it bounce back to
  //    the window center before taking out -- the RESULT is a normal (not burnt) bake.
  await page.clock.runFor(Math.round((19 / BAKE_NEEDLE_SPEED_PCT_PER_S) * 1000));
  const deepAt = await needleAt();
  expect(deepAt).toBeGreaterThan(84);
  await caption(page, "6. DEEP BAKE look (needle ≈ 87, heat ≈ 1.6)", "B keeps outline + radial structure · not taken out here");
  mark("6-deep");
  await page.waitForTimeout(HOLD + 800);
  // To 100, bounce, back down to the center: (100 - deep) + (100 - center).
  await page.clock.runFor(Math.round((((100 - deepAt) + (100 - center)) / BAKE_NEEDLE_SPEED_PCT_PER_S) * 1000));
  const back = await needleAt();
  expect(back).toBeGreaterThan(FREE_COOK_BAKE_TARGET.start);
  expect(back).toBeLessThan(FREE_COOK_BAKE_TARGET.end);
  await caption(page, "Taking out at the proper bake…");
  await page.getByRole("button", { name: "取り出す！" }).click();
  await page.clock.resume();
  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }

  // 7. RESULT: small ingredient icons.
  await page.waitForSelector(".result-panel");
  await expect(page.locator(".result-panel")).not.toContainText("焦げ");
  const used = page.getByRole("list", { name: "使った材料" });
  await expect(used.locator('[data-w1-visual="tomato-slice-final"]')).toHaveCount(1);
  await caption(page, "7. RESULT — small icons", "🍅 トマトソース · (B) トマト · 🍅 チェリートマト · 🔴 ペパロニ");
  mark("7-result");
  await page.waitForTimeout(HOLD + 1500);

  // 8. Comparison board: B / A / cherry-tomato / pepperoni / tomato-sauce.
  await page.goto("./board.html", { waitUntil: "networkidle" });
  await expect(page.getByTestId("section-tomato")).toBeVisible();
  const board = [
    ["tray-tomato-b", "8. Board — tray B: チェリートマト · トマト(B) · ペパロニ", "same order as tray A below"],
    ["tray-tomato-a", "8. Board — tray A (slice 2, salami-like) + sauce tray", "A vs B · トマトソース 🍅 chip below"],
    ["row-tomato-b-sauce", "8. Board — B · cherry · pepperoni on tomato sauce", "raw · baked · deep"],
    ["row-tomato-a-sauce", "8. Board — A (previous) · cherry · pepperoni", "compare with B above"],
    ["row-tomato-b-small", "8. Board — B at 16px (thumbnail size)", "raw · baked · deep"],
  ] as const;
  mark("8-board");
  for (const [testId, title, detail] of board) {
    await page.getByTestId(testId).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await caption(page, title, detail);
    await page.waitForTimeout(2900);
  }

  // 9. Grayscale: B vs pepperoni (and A for reference).
  await page.getByTestId("row-tomato-b-gray").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await caption(page, "9. GRAYSCALE — B vs pepperoni", "B: radial wheel + seeds · pepperoni: plain disc");
  mark("9-grayscale");
  await page.waitForTimeout(HOLD + 800);
  await page.getByTestId("row-tomato-a-gray").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await caption(page, "9. GRAYSCALE — A (previous) for reference", "dark ring + round blobs = salami-like");
  await page.waitForTimeout(2600);

  // 10. Final still: HUMAN CHECK.
  await page.evaluate((source) => {
    document.getElementById("hv-caption")?.remove();
    const card = document.createElement("div");
    card.id = "hv-card";
    card.innerHTML = `<h1>HUMAN CHECK</h1><ol>
      <li>Tomato sliceとして読める？</li>
      <li>Pepperoniと形で区別できる？</li>
      <li>Cherry tomatoと区別できる？</li>
      <li>BはAより良い？</li></ol>
      <p>fresh-tomato Final candidate B · Preview source ${source}<br/>
      https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/</p>`;
    document.body.appendChild(card);
  }, sha);
  mark("10-human-check");
  await page.waitForTimeout(6500);
  mark("end");

  expect(errors).toEqual([]);
  writeFileSync(MARKERS_PATH, JSON.stringify({ sha, markers }, null, 2));
});
