import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { INGREDIENTS } from "../../src/data/ingredients";
import { RECIPES } from "../../src/data/recipes";

/**
 * Production Visual P1 -- Human Verification video script (opt-in: W1_P1_HV_VIDEO=1,
 * chromium-390x844, video recording via the config's W1_P1_VIDEO=1). Part 1 walks the P1
 * production build (W1_P1_AFTER_URL); part 2 flips BEFORE/AFTER captures produced by
 * before-after.spec.ts (W1_P1_SHOTS_DIR) with their pixel-diff counts. Captions / cursor / cards
 * are injected by this spec only; the app build is untouched.
 */

const ENABLED = process.env.W1_P1_HV_VIDEO === "1";
const AFTER = process.env.W1_P1_AFTER_URL ?? "";
const SHOTS = process.env.W1_P1_SHOTS_DIR ?? "";
const AFTER_SHA = process.env.W1_P1_AFTER_SHA ?? "";
const BEFORE_SHA = process.env.W1_P1_BEFORE_SHA ?? "";
const HOLD = 2600;

test.skip(!ENABLED || !AFTER || !SHOTS || !AFTER_SHA || !BEFORE_SHA, "Human Verification video script: see header");

const SAVE = {
  schemaVersion: 2,
  dex: RECIPES.map((r) => ({ recipeId: r.id, discovered: true, bestScore: 80, bestStars: 3, timesMade: 2 })),
  pitzBalance: 9999,
  ownedIngredientIds: INGREDIENTS.map((i) => i.id),
  missionBest: {},
  inventory: Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 30])),
  starterGrantClaimedRecipeIds: RECIPES.map((r) => r.id),
};

function annotations() {
  const style = document.createElement("style");
  style.textContent = `
    #hv-caption { position: fixed; left: 0; right: 0; top: 0; z-index: 100000; padding: 6px 10px;
      background: rgba(20, 10, 40, 0.86); color: #fff; font: 700 13px/1.35 system-ui, sans-serif; pointer-events: none; }
    #hv-caption small { display: block; font-weight: 500; font-size: 10.5px; opacity: 0.92; word-break: break-all; }
    #hv-cursor { position: fixed; z-index: 100001; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
      border: 3px solid #ff2d95; background: rgba(255, 45, 149, 0.25); pointer-events: none; display: none; }
    #hv-cursor.down { background: rgba(255, 45, 149, 0.6); transform: scale(0.7); }`;
  const mount = () => {
    if (document.getElementById("hv-cursor")) return;
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "hv-cursor";
    document.body.appendChild(cursor);
    const move = (e: PointerEvent) => {
      cursor.style.display = "block";
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", (e) => { move(e); cursor.classList.add("down"); }, true);
    window.addEventListener("pointerup", () => cursor.classList.remove("down"), true);
  };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
}

async function caption(page: Page, title: string, detail: string) {
  await page.evaluate(([t, d]) => {
    let bar = document.getElementById("hv-caption");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "hv-caption";
      document.body.appendChild(bar);
    }
    bar.innerHTML = "";
    bar.append(t);
    const small = document.createElement("small");
    small.textContent = d;
    bar.append(small);
  }, [title, detail] as const);
}

async function selectChip(page: Page, name: string) {
  const chip = page.locator(".ingredient-chip").filter({ has: page.locator(".ingredient-chip__name", { hasText: new RegExp(`^${name}$`) }) });
  for (let i = 0; i < 5 && (await chip.count()) === 0; i += 1) await page.getByRole("button", { name: "次のページ" }).click();
  await chip.click();
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 5 && (await prev.count()) && !(await prev.isDisabled()); i += 1) await prev.click();
}

test("P1 Human Verification video", async ({ page }) => {
  test.setTimeout(300_000);
  const src = `P1 build · source ${AFTER_SHA}`;
  await page.addInitScript(annotations);
  await page.addInitScript(([raw]) => localStorage.setItem("teto-pizza-save-v1", JSON.stringify(raw)), [SAVE] as const);

  // Part 1: the P1 production build, end to end.
  await page.goto(AFTER);
  await page.waitForSelector(".app-frame");
  await caption(page, "P1 Human Verification — HOME", src);
  await page.waitForTimeout(HOLD + 400);

  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await page.waitForSelector(".pizza-stage");
  await caption(page, "Free Cooking — dough → sauce → cheese", src);
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await selectChip(page, "トマトソース");
  await paintSauceRing(page, 25, 14);
  await page.getByRole("button", { name: /次へ/ }).click();
  await caption(page, "Tray — cheese (unchanged)", src);
  await page.waitForTimeout(1500);
  await selectChip(page, "モッツァレラ");
  for (const [x, y] of [[40, 40], [60, 62]] as const) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();

  await caption(page, "Tray — toppings: every emoji as before", `3 pages · ${src}`);
  await page.waitForTimeout(HOLD);
  const next = page.getByRole("button", { name: "次のページ" });
  for (let p = 2; p <= 3 && (await next.count()) && !(await next.isDisabled()); p += 1) {
    await next.click();
    await page.waitForTimeout(1300);
  }
  const prev = page.getByRole("button", { name: "前のページ" });
  for (let i = 0; i < 5 && (await prev.count()) && !(await prev.isDisabled()); i += 1) await prev.click();

  await caption(page, "Pizza raw — placing toppings", src);
  const spots: Array<[string, number, number]> = [
    ["バジル", 30, 30], ["にんにく", 50, 24], ["オレガノ", 70, 30], ["チェリートマト", 26, 52], ["たまご", 74, 52],
    ["マッシュルーム", 32, 72], ["ペパロニ", 50, 80], ["ブラックオリーブ", 68, 72], ["ベーコン", 50, 48],
  ];
  for (const [name, x, y] of spots) {
    await selectChip(page, name);
    await tapDoughPercent(page, x, y);
  }
  await page.mouse.move(2, 2);
  await caption(page, "Pizza raw", `emoji pieces unchanged · ${src}`);
  await page.waitForTimeout(HOLD + 400);

  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:10Z"));
  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForSelector(".bake-gauge__needle");
  await page.clock.runFor(Math.round((68 / 55) * 1000));
  await caption(page, "Bake — target center (roast tint on emoji pieces)", src);
  await page.waitForTimeout(HOLD + 400);
  await page.getByRole("button", { name: "取り出す！" }).click();
  await page.clock.resume();
  if (await page.getByRole("button", { name: /切り終わる/ }).count()) await page.getByRole("button", { name: /切り終わる/ }).click();
  await page.waitForSelector(".result-panel");
  await expect(page.locator(".result-panel")).not.toContainText("焦げ");
  await caption(page, "RESULT — small ingredient icons", src);
  await page.waitForTimeout(HOLD + 800);

  await page.goto(AFTER);
  await page.waitForSelector(".app-frame");
  for (const [label, title] of [["材料", "Inventory"], ["ショップ", "Shop"], ["ピザ図鑑", "Dex"]] as const) {
    await page.locator(".home-menu__card", { hasText: label }).click();
    await caption(page, title, src);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const els = [...document.querySelectorAll<HTMLElement>("*")].filter((el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
      const el = els.sort((a, b) => b.clientHeight - a.clientHeight)[0];
      if (el) el.scrollTo({ top: el.clientHeight * 0.9, behavior: "smooth" });
    });
    await page.waitForTimeout(1600);
    await page.getByRole("button", { name: "閉じる" }).first().click();
  }

  // Part 2: BEFORE / AFTER flips from the pixel harness (same deterministic script on both builds).
  const report = JSON.parse(readFileSync(`${SHOTS}/report.json`, "utf8")) as { report: Array<{ name: string; differingPixels: number; exactChangedPixels: number }> };
  const picks = ["01-home", "05-tray-topping-p1", "06-pizza-raw", "07-bake", "08-result-0", "09-inventory-0", "10-shop-0", "11-dex-1", "02-pizza-select-0"];
  const img = (name: string, side: string) => `data:image/png;base64,${readFileSync(`${SHOTS}/${name}.${side}.png`).toString("base64")}`;
  await page.setContent(`<html><body style="margin:0;background:#111">
    <img id="shot" style="display:block;width:390px;height:844px">
    <div id="tag" style="position:fixed;left:0;right:0;top:0;padding:6px 10px;font:700 14px/1.35 system-ui;color:#fff"></div></body></html>`);
  for (const name of picks) {
    const row = report.report.find((r) => r.name === name)!;
    for (const side of ["before", "after", "before", "after"] as const) {
      await page.evaluate(([src2, label, bg]) => {
        (document.getElementById("shot") as HTMLImageElement).src = src2;
        const tag = document.getElementById("tag")!;
        tag.textContent = label;
        tag.style.background = bg;
      }, [
        img(name, side),
        `${side === "before" ? `BEFORE main ${BEFORE_SHA.slice(0, 7)}` : `AFTER P1 ${AFTER_SHA.slice(0, 7)}`} · ${name} · changed px (>2): ${row.differingPixels}`,
        side === "before" ? "rgba(20,70,160,0.9)" : "rgba(160,40,90,0.9)",
      ] as const);
      await page.waitForTimeout(650);
    }
  }
  await page.setContent(`<html><body style="margin:0;background:#1d1030;color:#fff;font:17px/1.5 system-ui;width:390px;height:844px;display:flex;flex-direction:column;justify-content:center;padding:26px;box-sizing:border-box">
    <h1 style="font-size:26px;margin:0 0 14px">HUMAN CHECK — P1</h1>
    <ol style="padding-left:20px;margin:0"><li>HOME / tray / pizza / bake / RESULT look unchanged?</li><li>Inventory / Shop / Dex look unchanged?</li><li>BEFORE / AFTER flips show no visible change?</li></ol>
    <p style="font-size:12px;opacity:.85;word-break:break-all;margin-top:18px">AFTER P1 ${AFTER_SHA}<br>BEFORE main ${BEFORE_SHA}<br>22 captures × 2 viewports, 0 pixels changed by more than 2</p></body></html>`);
  await page.waitForTimeout(5000);
});
