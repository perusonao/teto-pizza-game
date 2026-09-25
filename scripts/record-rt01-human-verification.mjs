// Human Verification video recorder for RT-01b (Reference Pizza piece capacity; see
// docs/reports/TETO_RT01_REFERENCE-PIECE-CAPACITY_Fresh-Design.md and the RT-01b Result Report).
// A recording/QA tool, not part of the shipped app: it drives the real dev build at human-visible
// pacing and injects a caption banner at record time only (never touching src/**).
//
// Scenes (per viewport):
//   1. Real app Recipe Select with all 15 shipped recipes discovered -- thumbnails unchanged.
//   2. Real app Making: Meat Lovers (8 pieces) mini 見本 -> popover -- unchanged.
//   3. Harness BEFORE/AFTER: 8, 9, 10, 12, 15 pieces (BEFORE = the pre-RT-01 `slot % 8` rule).
//
// Usage: node scripts/record-rt01-human-verification.mjs [390x844|360x800 ...]
// Requires `npm run dev -- --port 5183 --strictPort` running. MP4 conversion uses $FFMPEG or
// `ffmpeg` on PATH (libx264); without it the raw .webm is left in place.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:5183/teto-pizza-game/";
const OUT_DIR = "artifacts/rt01";
const RAW_DIR = path.join(OUT_DIR, "_raw");
fs.mkdirSync(RAW_DIR, { recursive: true });

const RECIPES = ["margherita", "marinara", "quattro-formaggi", "genovese", "bismarck", "funghi", "fugazza", "salsiccia",
  "pepperoni", "napoletana", "tonno-e-cipolla", "pizza-bianca", "breakfast-pizza", "capricciosa", "meat-lovers"];
const INGREDIENTS = ["tomato-sauce", "olive-oil", "pesto", "mozzarella", "gorgonzola", "parmigiano", "fontina", "basil",
  "garlic", "oregano", "cherry-tomato", "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna",
  "rosemary", "bacon", "ham", "black-olive"];

const viewports = (process.argv.slice(2).length ? process.argv.slice(2) : ["390x844", "360x800"]).map((v) => {
  const [width, height] = v.split("x").map(Number);
  return { name: v, width, height };
});

const hold = (page, ms) => page.waitForTimeout(ms);

async function caption(page, text) {
  await page.evaluate((t) => {
    let el = document.getElementById("__rt01_caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "__rt01_caption";
      Object.assign(el.style, {
        position: "fixed", left: "8px", right: "8px", bottom: "8px", zIndex: "99999", padding: "8px 10px",
        background: "rgba(40, 24, 12, 0.88)", color: "#fff", font: "600 14px/1.4 system-ui, sans-serif",
        borderRadius: "10px", pointerEvents: "none", whiteSpace: "pre-line",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

async function smoothScroll(page, selector, totalMs) {
  const steps = Math.max(1, Math.round(totalMs / 60));
  const distance = await page.evaluate((sel) => {
    const el = sel ? document.querySelector(sel) : document.scrollingElement;
    return el ? el.scrollHeight - el.clientHeight : 0;
  }, selector);
  for (let i = 1; i <= steps; i += 1) {
    await page.evaluate(([sel, y]) => {
      const el = sel ? document.querySelector(sel) : document.scrollingElement;
      if (el) el.scrollTop = y;
    }, [selector, (distance * i) / steps]);
    await page.waitForTimeout(60);
  }
}

async function scrollableSelector(page) {
  return page.evaluate(() => {
    const els = [document.scrollingElement, ...document.querySelectorAll("*")];
    const el = els.find((e) => e && e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== "visible"
      && getComputedStyle(e).overflowY !== "hidden");
    if (!el || el === document.scrollingElement) return null;
    el.setAttribute("data-rt01-scroll", "1");
    return "[data-rt01-scroll='1']";
  });
}

async function record(vp) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    recordVideo: { dir: RAW_DIR, size: { width: vp.width, height: vp.height } },
  });
  const page = await context.newPage();
  await page.addInitScript(({ recipes, ingredients }) => {
    if (!location.pathname.includes("/e2e/harness/")) {
      localStorage.setItem("teto-pizza-save-v1", JSON.stringify({
        schemaVersion: 1,
        dex: recipes.map((recipeId) => ({ recipeId, discovered: true, bestScore: 95, bestStars: 3, timesMade: 3 })),
        pitzBalance: 0, ownedIngredientIds: ingredients, missionBest: {},
      }));
    }
  }, { recipes: RECIPES, ingredients: INGREDIENTS });

  // Scene 1: Recipe Select.
  await page.goto(BASE);
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.waitForSelector(".pizza-thumbnail");
  await caption(page, `RT-01b 確認 (${vp.name})\n① レシピ選択: 既存15レシピのサムネイル（1〜8個・変化なし）`);
  await hold(page, 3000);
  const selectScroll = await scrollableSelector(page);
  await smoothScroll(page, selectScroll, 7000);
  await hold(page, 2000);

  // Scene 2: Making -- Meat Lovers (8 pieces) mini 見本 + popover.
  await page.getByRole("button", { name: /ミートラヴァーズ、/ }).first().click();
  await hold(page, 1200);
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await page.waitForSelector(".mini-reference");
  await caption(page, "② 調理画面: ミートラヴァーズ（8個）のミニ見本（変化なし）");
  await hold(page, 3000);
  await page.locator(".mini-reference").click();
  await caption(page, "② 見本ポップアップ: 8個の配置は従来どおり");
  await hold(page, 3500);
  await page.getByRole("button", { name: "閉じる" }).first().click();
  await hold(page, 1000);

  // Scene 3: BEFORE/AFTER, 8 / 9 / 10 / 12 / 15 pieces.
  const cases = [
    ["p8", "③ 8個 BEFORE/AFTER: 同一（既存レイアウト維持）"],
    ["p9", "④ 9個: BEFOREは1個が重なり8か所 → AFTERは9か所・1リング+中心"],
    ["p10", "⑤ 10個（ポルトゲーザ構成）: BEFOREは8か所 → AFTERは10か所"],
    ["p12", "⑥ 12個: 外周+内周の2リング、同じ食材は離して配置"],
    ["p15", "⑦ 15個（推定最大）: 48pxミニ見本でも重ならない"],
  ];
  for (const [id, text] of cases) {
    await page.goto(`${BASE}e2e/harness/rt01-reference.html?compare=${id}`);
    await page.waitForSelector(".rt01-compare--after");
    await caption(page, text);
    await hold(page, 3500);
    await page.locator(".rt01-compare--after").scrollIntoViewIfNeeded();
    await hold(page, 3000);
  }
  await caption(page, "確認終了");
  await hold(page, 1500);

  const video = page.video();
  await context.close();
  await browser.close();
  const raw = await video.path();
  const webm = path.join(OUT_DIR, `rt01b-human-verification-${vp.name}.webm`);
  fs.renameSync(raw, webm);
  const mp4 = webm.replace(/\.webm$/, ".mp4");
  const ffmpeg = process.env.FFMPEG || "ffmpeg";
  try {
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
      "-movflags", "+faststart", mp4]);
    fs.rmSync(webm);
    console.log(`wrote ${mp4}`);
  } catch (error) {
    console.log(`ffmpeg unavailable (${error.message}); left ${webm}`);
  }
}

for (const vp of viewports) {
  await record(vp);
}
