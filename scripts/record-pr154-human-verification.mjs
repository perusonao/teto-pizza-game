// Human Verification Video recorder for PR #154 (Gameplay UX Phase 1: ingredient-selection
// vertical scroll removal). This is a recording/QA tool, not part of the shipped app -- it
// drives the real dev build through Playwright at human-visible pacing and overlays a
// synthetic pointer dot (injected at record time only, never touching src/**) so a reviewer
// can *watch* the fix instead of reading assertions. See
// docs/reports/TETO_GAMEPLAY-UX_Phase1_Ingredient-Selection_Result.md's
// "Human Verification Videos" section for how to interpret the output.
//
// Usage: node scripts/record-pr154-human-verification.mjs
// Requires: `npm run dev -- --port 5183 --strictPort` already running, and `ffmpeg` on PATH
// (falls back to leaving raw .webm in place if ffmpeg is missing).

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:5183/teto-pizza-game/";
// Output goes to artifacts/ (gitignored -- see .gitignore's own "Review Playthrough videos ...
// delivered to the user directly, never committed" convention). Never docs/reports/**, which
// is committed.
const RAW_DIR = "artifacts/gameplay-ux-phase1/_raw";
const OUT_DIR = "artifacts/gameplay-ux-phase1";
fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const MEASUREMENTS = {};

// ---------- Fixtures (mirrors e2e/gestures.ts's startQuattroFormaggiHeavyInventory, plus one
// extra topping (`onion`) so TOPPING's "その他" grid crosses the 6-item pagination boundary --
// SCENE 5 explicitly wants the existing ◀/▶ page-nav demonstrated on camera). ----------
const QUATTRO_SAVE = {
  schemaVersion: 2,
  dex: ["margherita", "funghi", "marinara", "bismarck", "genovese"].map((recipeId) => ({
    recipeId,
    discovered: true,
    bestScore: 70,
    bestStars: 3,
    timesMade: 1,
  })),
  pitzBalance: 500,
  ownedIngredientIds: [
    "olive-oil",
    "gorgonzola",
    "parmigiano",
    "fontina",
    "garlic",
    "oregano",
    "pesto",
    "cherry-tomato",
    "egg",
    "mushroom",
    "onion",
  ],
  missionBest: {},
  inventory: {
    "olive-oil": 99,
    gorgonzola: 99,
    parmigiano: 99,
    fontina: 99,
    garlic: 99,
    oregano: 99,
    pesto: 99,
    "cherry-tomato": 99,
    egg: 99,
    mushroom: 99,
    onion: 99,
  },
  starterGrantClaimedRecipeIds: ["margherita", "funghi", "marinara", "bismarck", "genovese"],
};

// ---------- Pointer visualization (record-time only; never touches production source) ----------
const POINTER_OVERLAY = () => {
  const dot = document.createElement("div");
  dot.id = "__hv_pointer_dot";
  Object.assign(dot.style, {
    position: "fixed",
    left: "-100px",
    top: "-100px",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "rgba(255, 45, 45, 0.35)",
    border: "3px solid rgba(220, 20, 20, 0.95)",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.6)",
    pointerEvents: "none",
    zIndex: "2147483647",
    transform: "translate(-50%, -50%)",
    transition: "left 40ms linear, top 40ms linear, width 80ms ease, height 80ms ease, background 80ms ease",
  });
  const mount = () => document.body && document.body.appendChild(dot);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.addEventListener(
    "pointermove",
    (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    },
    true,
  );
  window.addEventListener(
    "pointerdown",
    (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      dot.style.width = "34px";
      dot.style.height = "34px";
      dot.style.background = "rgba(40, 180, 80, 0.55)";
      dot.style.border = "3px solid rgba(20, 130, 50, 0.95)";
    },
    true,
  );
  window.addEventListener(
    "pointerup",
    () => {
      dot.style.width = "22px";
      dot.style.height = "22px";
      dot.style.background = "rgba(255, 45, 45, 0.35)";
      dot.style.border = "3px solid rgba(220, 20, 20, 0.95)";
    },
    true,
  );
};

// ---------- Timing helpers (deliberately human-paced, not e2e-fast) ----------
const sceneWait = (page, ms, label) => {
  if (label) console.log(`    (holding ${ms}ms -- ${label})`);
  return page.waitForTimeout(ms);
};

async function moveMouseSmooth(page, x, y, steps = 18) {
  await page.mouse.move(x, y, { steps });
}

async function humanClickLocator(page, locator, { settleMs = 900 } = {}) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("locator not visible for humanClickLocator");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveMouseSmooth(page, x, y);
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForTimeout(settleMs);
}

async function doughBox(page) {
  const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
  if (!box) throw new Error("Pizza dough missing");
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, r: box.width * 0.46, box };
}

async function humanTapDoughPercent(page, xPercent, yPercent, { settleMs = 350 } = {}) {
  const { box } = await doughBox(page);
  const x = box.x + (xPercent / 100) * box.width;
  const y = box.y + (yPercent / 100) * box.height;
  await moveMouseSmooth(page, x, y, 10);
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForTimeout(settleMs);
}

/** DOUGH: a visible outward-stretch press-and-drag at each of 8 rim points (matches the real
 *  gesture contract -- PizzaStage.tsx applies the first stretch point at pointerdown itself,
 *  every move updates it live -- see that file's handlePointerDown/processMovePoint). Slower
 *  and with real intermediate movement (unlike e2e's instant down/up) so it reads on camera as
 *  an actual finger stretching the dough outward, not a series of taps. */
async function humanDoughStretch(page) {
  const { cx, cy, r } = await doughBox(page);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const startX = cx + Math.cos(angle) * r * 0.9;
    const startY = cy + Math.sin(angle) * r * 0.9;
    const endX = cx + Math.cos(angle) * r * 1.05;
    const endY = cy + Math.sin(angle) * r * 1.05;
    await moveMouseSmooth(page, startX, startY, 10);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 8 });
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(110);
  }
}

/** SAUCE ("spread"/paint ingredients): a genuine continuous circular drag rather than discrete
 *  taps -- PizzaStage's dispense session interpolates deposits between real pointermove
 *  samples over wall-clock time, so a slow, deliberate drag paints a visibly continuous ring,
 *  matching how a player would actually paint sauce. */
async function humanPaintSauceRing(page, radiusPercent = 24, steps = 40) {
  const { box } = await doughBox(page);
  const toXY = (pct) => {
    const angle = (pct / steps) * Math.PI * 2;
    return {
      x: box.x + ((50 + Math.cos(angle) * radiusPercent) / 100) * box.width,
      y: box.y + ((50 + Math.sin(angle) * radiusPercent) / 100) * box.height,
    };
  };
  const start = toXY(0);
  await moveMouseSmooth(page, start.x, start.y, 10);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    const { x, y } = toXY(i);
    await page.mouse.move(x, y, { steps: 3 });
    await page.waitForTimeout(28);
  }
  await page.waitForTimeout(80);
  await page.mouse.up();
}

async function measure(page, label) {
  const s = await page.evaluate(() => {
    const gs = document.querySelector(".game-screen");
    return {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      docScrollHeight: document.documentElement.scrollHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      gsClientHeight: gs ? gs.clientHeight : null,
      gsScrollHeight: gs ? gs.scrollHeight : null,
    };
  });
  MEASUREMENTS[label] = s;
  console.log(
    `[measure] ${label}: gsScrollHeight=${s.gsScrollHeight} gsClientHeight=${s.gsClientHeight} ` +
      `docScrollHeight=${s.docScrollHeight} innerHeight=${s.innerHeight} docScrollWidth=${s.docScrollWidth} innerWidth=${s.innerWidth}`,
  );
}

async function seedQuattro(page) {
  await page.goto(BASE);
  await page.evaluate((save) => {
    localStorage.clear();
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(save));
  }, QUATTRO_SAVE);
  await page.reload();
  await page.waitForSelector(".app-frame");
}

async function convertToMp4(webmPath, mp4Path) {
  try {
    execFileSync("ffmpeg", [
      "-y",
      "-i",
      webmPath,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      "-preset",
      "medium",
      "-movflags",
      "+faststart",
      mp4Path,
    ], { stdio: "inherit" });
    return true;
  } catch (err) {
    console.error(`ffmpeg conversion failed for ${webmPath}:`, err.message);
    return false;
  }
}

async function finalizeVideo(context, page, finalName) {
  await context.close();
  const rawPath = await page.video().path();
  const finalWebm = path.join(RAW_DIR, `${finalName}.webm`);
  fs.renameSync(rawPath, finalWebm);
  const mp4Path = path.join(OUT_DIR, `${finalName}.mp4`);
  const ok = await convertToMp4(finalWebm, mp4Path);
  return ok ? mp4Path : finalWebm;
}

// ============================================================================
// Video 1: 390x844 ingredient selection human verification (main video)
// ============================================================================
async function recordIngredientSelectionVideo() {
  console.log("\n=== Recording: 390x844 ingredient-selection-human-verification ===");
  const viewport = { width: 390, height: 844 };
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: RAW_DIR, size: viewport },
  });
  await context.addInitScript(POINTER_OVERLAY);
  const page = await context.newPage();

  // SCENE 1: HOME -> Pizza Select -> quattro-formaggi (heavy inventory) -> PREPARE
  await seedQuattro(page);
  await sceneWait(page, 1800, "HOME, settle");
  await humanClickLocator(page, page.getByRole("button", { name: /ピザを作る/ }), { settleMs: 1400 });
  await humanClickLocator(page, page.getByRole("button", { name: /クアトロ/ }), { settleMs: 1400 });
  await humanClickLocator(page, page.getByRole("button", { name: /このピザを作る/ }), { settleMs: 400 });
  await page.waitForSelector(".pizza-stage");

  // SCENE 2: DOUGH
  console.log("  SCENE 2: DOUGH");
  await sceneWait(page, 2500, "DOUGH -- tabs/pizza/CTA all visible");
  await humanDoughStretch(page);
  await sceneWait(page, 1000);
  await humanClickLocator(page, page.getByRole("button", { name: /次へ/ }), { settleMs: 2000 });

  // SCENE 3: SAUCE (most important)
  console.log("  SCENE 3: SAUCE");
  await sceneWait(page, 3500, "SAUCE arrival -- no scroll, everything visible");
  await measure(page, "390x844-SAUCE");
  await humanClickLocator(page, page.getByRole("button", { name: /オリーブオイル/ }), { settleMs: 800 });
  await humanPaintSauceRing(page, 22, 36);
  await sceneWait(page, 1200);
  await humanClickLocator(page, page.getByRole("button", { name: /ジェノベーゼソース/ }), { settleMs: 800 });
  await humanPaintSauceRing(page, 30, 30);
  await sceneWait(page, 1500);
  await humanClickLocator(page, page.getByRole("button", { name: /次へ/ }), { settleMs: 2000 });

  // SCENE 4: CHEESE
  console.log("  SCENE 4: CHEESE");
  await sceneWait(page, 2500, "CHEESE arrival -- multiple cheeses visible, no scroll");
  await measure(page, "390x844-CHEESE");
  await humanClickLocator(page, page.getByRole("button", { name: /ゴルゴンゾーラ/ }), { settleMs: 700 });
  await humanTapDoughPercent(page, 40, 45);
  await humanTapDoughPercent(page, 60, 55);
  await sceneWait(page, 900);
  await humanClickLocator(page, page.getByRole("button", { name: /パルミジャーノ/ }), { settleMs: 700 });
  await humanTapDoughPercent(page, 50, 30);
  await humanTapDoughPercent(page, 50, 70);
  await sceneWait(page, 1500);
  await humanClickLocator(page, page.getByRole("button", { name: /次へ/ }), { settleMs: 2000 });

  // SCENE 5: TOPPING
  console.log("  SCENE 5: TOPPING");
  await sceneWait(page, 2500, "TOPPING arrival -- 6+ owned toppings, no scroll");
  await measure(page, "390x844-TOPPING");
  await humanClickLocator(page, page.getByRole("button", { name: /マッシュルーム/ }), { settleMs: 700 });
  await humanTapDoughPercent(page, 35, 40);
  await humanTapDoughPercent(page, 65, 60);
  await sceneWait(page, 900);
  await humanClickLocator(page, page.getByRole("button", { name: /にんにく/ }), { settleMs: 700 });
  await humanTapDoughPercent(page, 55, 35);
  await sceneWait(page, 900);
  // Demonstrate the existing pagination (◀/▶) is what handles "many owned ingredients" --
  // NOT a new horizontal-scroll tray. onion (7th owned topping) pushes "その他" to 2 pages.
  const nextPageBtn = page.getByRole("button", { name: "次のページ" });
  if (await nextPageBtn.count()) {
    await humanClickLocator(page, nextPageBtn, { settleMs: 1400 });
    const prevPageBtn = page.getByRole("button", { name: "前のページ" });
    await humanClickLocator(page, prevPageBtn, { settleMs: 1200 });
  }

  // SCENE 6: CTA confirmation
  console.log("  SCENE 6: CTA bar (やり直す / 次へ / ヒント)");
  const resetBtn = page.getByRole("button", { name: "やり直す" });
  const resetBox = await resetBtn.boundingBox();
  if (resetBox) {
    await moveMouseSmooth(page, resetBox.x + resetBox.width / 2, resetBox.y + resetBox.height / 2);
    await sceneWait(page, 1200, "pointing at やり直す (not clicked -- no reset)");
  }
  await humanClickLocator(page, page.getByRole("button", { name: "ヒント" }), { settleMs: 1800 });
  await sceneWait(page, 1500, "final hold");

  const outPath = await finalizeVideo(context, page, "390x844-ingredient-selection-human-verification");
  await browser.close();
  console.log(`  -> ${outPath}`);
  return outPath;
}

// ============================================================================
// Video 2: 390x844 CUT unaffected regression
// ============================================================================
async function recordCutRegressionVideo() {
  console.log("\n=== Recording: 390x844 cut-unaffected-regression ===");
  const viewport = { width: 390, height: 844 };
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: RAW_DIR, size: viewport },
  });
  await context.addInitScript(POINTER_OVERLAY);
  const page = await context.newPage();

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  await sceneWait(page, 1200, "HOME");
  await humanClickLocator(page, page.getByRole("button", { name: /ピザを作る/ }), { settleMs: 1000 });
  await humanClickLocator(page, page.getByRole("button", { name: /マルゲリータ、/ }), { settleMs: 1000 });
  await humanClickLocator(page, page.getByRole("button", { name: /このピザを作る/ }), { settleMs: 600 });
  await page.waitForSelector(".pizza-stage");

  // DOUGH -> SAUCE -> CHEESE -> TOPPING -> BAKE (compact PREPARE sizing, quick pass-through --
  // this video's subject is CUT, not PREPARE, which the other video already covers in depth)
  await sceneWait(page, 1200, "DOUGH (compact PREPARE size)");
  await humanDoughStretch(page);
  await humanClickLocator(page, page.getByRole("button", { name: /次へ/ }), { settleMs: 900 });

  await humanClickLocator(page, page.getByRole("button", { name: /トマトソース/ }), { settleMs: 600 });
  await humanPaintSauceRing(page, 24, 30);
  await sceneWait(page, 600);
  await humanClickLocator(page, page.getByRole("button", { name: /次へ/ }), { settleMs: 900 });

  await humanClickLocator(page, page.getByRole("button", { name: /モッツァレラ/ }), { settleMs: 600 });
  await humanTapDoughPercent(page, 40, 50);
  await humanTapDoughPercent(page, 60, 50);
  await humanTapDoughPercent(page, 50, 30);
  await sceneWait(page, 600);
  await humanClickLocator(page, page.getByRole("button", { name: /次へ/ }), { settleMs: 900 });

  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await humanClickLocator(page, page.getByRole("button", { name: /バジル/ }), { settleMs: 500 });
    await humanTapDoughPercent(page, 45, 55);
    await humanTapDoughPercent(page, 55, 45);
  }
  await humanClickLocator(page, page.getByRole("button", { name: /焼く/ }), { settleMs: 500 });
  console.log("  BAKE -- waiting for real bake timer");
  await page.waitForTimeout(1500);
  await humanClickLocator(page, page.getByRole("button", { name: "取り出す！" }), { settleMs: 800 });
  await page.waitForSelector(".cut-progress-readout");

  // CUT: hold on the roomy (unchanged) stage, then actually drag 3 cut lines.
  console.log("  SCENE: CUT -- roomy size unaffected by PREPARE's compact change");
  await sceneWait(page, 3000, "CUT arrival -- still roomy/large, guide lines visible");

  const { cx, cy, r } = await doughBox(page);
  for (const angleDeg of [0, 60, 120]) {
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
    await moveMouseSmooth(page, cx - dx, cy - dy, 10);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 20 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await sceneWait(page, 700, "cut line placed");
  }
  await sceneWait(page, 1500, "3 lines placed, before confirming");

  const finishBtn = page.getByRole("button", { name: /切り終わる/ });
  if (await finishBtn.isEnabled().catch(() => false)) {
    await humanClickLocator(page, finishBtn, { settleMs: 2000 });
  } else {
    await sceneWait(page, 1500, "final hold");
  }

  const outPath = await finalizeVideo(context, page, "390x844-cut-unaffected-regression");
  await browser.close();
  console.log(`  -> ${outPath}`);
  return outPath;
}

// ============================================================================
// Video 3: 360x800 SAUCE edge case
// ============================================================================
async function recordEdgeCaseVideo() {
  console.log("\n=== Recording: 360x800 sauce-edge-case ===");
  const viewport = { width: 360, height: 800 };
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: RAW_DIR, size: viewport },
  });
  await context.addInitScript(POINTER_OVERLAY);
  const page = await context.newPage();

  await seedQuattro(page);
  await sceneWait(page, 1200, "HOME (360x800)");
  await humanClickLocator(page, page.getByRole("button", { name: /ピザを作る/ }), { settleMs: 900 });
  await humanClickLocator(page, page.getByRole("button", { name: /クアトロ/ }), { settleMs: 900 });
  await humanClickLocator(page, page.getByRole("button", { name: /このピザを作る/ }), { settleMs: 400 });
  await page.waitForSelector(".pizza-stage");

  await humanDoughStretch(page);
  await humanClickLocator(page, page.getByRole("button", { name: /次へ/ }), { settleMs: 1500 });

  console.log("  SCENE: SAUCE at 360x800 -- tightest measured case (Fresh Audit worst case)");
  await sceneWait(page, 3000, "SAUCE arrival, tight viewport, no scroll");
  await measure(page, "360x800-SAUCE");
  await humanClickLocator(page, page.getByRole("button", { name: /オリーブオイル/ }), { settleMs: 700 });
  await humanPaintSauceRing(page, 22, 32);
  await sceneWait(page, 1000);
  await humanClickLocator(page, page.getByRole("button", { name: /トマトソース/ }), { settleMs: 700 });
  await humanPaintSauceRing(page, 30, 28);
  await sceneWait(page, 1500);
  await humanClickLocator(page, page.getByRole("button", { name: /次へ/ }), { settleMs: 1500 });

  const outPath = await finalizeVideo(context, page, "360x800-sauce-edge-case");
  await browser.close();
  console.log(`  -> ${outPath}`);
  return outPath;
}

const results = {};
results.ingredientSelection = await recordIngredientSelectionVideo();
results.cutRegression = await recordCutRegressionVideo();
results.edgeCase = await recordEdgeCaseVideo();

fs.writeFileSync(
  path.join(OUT_DIR, "_measurements.json"),
  JSON.stringify(MEASUREMENTS, null, 2),
);

console.log("\n=== Done ===");
console.log(results);
console.log("Measurements written to", path.join(OUT_DIR, "_measurements.json"));
