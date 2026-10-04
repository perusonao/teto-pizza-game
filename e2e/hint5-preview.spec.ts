import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Discovery Hint 5.0 (Issue #292), H5-5: the Preview-only opt-in and Human Verification seeds, on REAL
 * builds. It builds the app twice (a production build, and a Preview build with `VITE_PREVIEW_MODE`, which
 * is what the Preview pipeline sets), and serves both from ONE origin under their real base paths, the way
 * `perusonao.github.io` serves production and Preview. That shared origin is the point: localStorage is
 * per-origin, so the production save sits right next to the Preview save.
 *
 * Gates (390×844 and 360×800 are the two iphone projects):
 * - P2  production URL `?hint5=` is ignored (ON by default, H5-6) - P3  production URL `?hv=` seeds nothing
 * - P4  Preview build without a parameter: ON like production - P5  Preview `?hint5=1` on / `?hint5=0` off
 * - P6  a seed never touches the production save             - P7  reload keeps the Preview state
 * - P8  Full Reset resets the Preview save only              - P9  all HV scenarios reproduce
 * - P10 / P11 layout at 390×844 / 360×800
 * The production-bundle string scan (P1) is src/preview/previewIsolation.gate.test.ts.
 *
 * `HINT5_SCREENSHOTS=1` writes screenshots to docs/reports/screenshots/hint-5-h5-5/.
 */

const PROD_BASE = "/teto-pizza-game/";
const PREVIEW_BASE = "/teto-pizza-game-preview/";
const PROD_KEY = "teto-pizza-save-v1";
const PREVIEW_KEY = "teto-pizza-preview-save-v1";
const OPT_IN_KEY = "teto-pizza-preview-hint5-optin";

/** The shipped W1 Discovery Ladder: [target, materials its step unlocks]. */
const LADDER = [
  ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
  ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
  ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]],
] as const;

/** A valid save that makes meat-lovers the hint target (the production / Preview app both load it). */
function meatLoversSave(pitzBalance = 999) {
  const index = LADDER.findIndex(([id]) => id === "meat-lovers");
  const materials = LADDER.slice(1, index + 1).flatMap(([, m]) => m as readonly string[]);
  return {
    schemaVersion: 2,
    dex: LADDER.slice(0, index).map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
    missionBest: {},
    inventory: Object.fromEntries(materials.map((m) => [m, 10])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: {},
  };
}

// ---- two real builds, one static server ---------------------------------------------------------

let origin = "";
let server: http.Server | null = null;
let workDir = "";

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

function build(outDir: string, base: string, preview: boolean) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  if (preview) {
    env.VITE_PREVIEW_MODE = "1";
    env.VITE_PREVIEW_PR = "297";
    env.VITE_PREVIEW_SHA = "h5-5";
    env.TETO_TEST_HOOKS = "1"; // #377: the test-only targetless-start hook (tools/testHooksPlugin.ts); the production build below never gets it
  } else {
    delete env.TETO_TEST_HOOKS;
    delete env.VITE_PREVIEW_MODE;
    delete env.VITE_PREVIEW_PR;
    delete env.VITE_PREVIEW_SHA;
  }
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--base", base, "--logLevel", "error"], { env, stdio: "pipe" });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "hint5-preview-"));
  const prod = path.join(workDir, "production");
  const prev = path.join(workDir, "preview");
  build(prod, PROD_BASE, false);
  build(prev, PREVIEW_BASE, true);
  const roots: [string, string][] = [[PROD_BASE, prod], [PREVIEW_BASE, prev]];
  server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const hit = roots.find(([prefix]) => url.startsWith(prefix));
    if (!hit) {
      res.writeHead(404);
      return void res.end();
    }
    let file = path.join(hit[1], url.slice(hit[0].length) || "index.html");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return void res.end();
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
});

// ---- helpers --------------------------------------------------------------------------------------

async function seedStorage(page: Page, entries: Record<string, string | null>) {
  await page.goto(`${origin}${PREVIEW_BASE}icons/icon-16.png`);
  await page.evaluate((e) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(e)) if (v !== null) localStorage.setItem(k, v);
  }, entries);
}

async function openHintSheet(page: Page) {
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
  const dialog = page.getByRole("dialog", { name: /ヒント/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** A fresh navigation to a scenario URL (about:blank first, so it is a `navigate`, never a reload). */
async function visit(page: Page, url: string) {
  await page.goto("about:blank");
  await page.goto(url);
}

const previewUrl = (query: string) => `${origin}${PREVIEW_BASE}${query}`;
const nextTitle = (page: Page) => page.locator(".hint-sheet__h5-next .hint-sheet__card-title");
const cta = (page: Page) => page.locator(".hint-sheet__h5-next .hint-sheet__next");
const wallet = (page: Page) => page.locator(".hint-sheet__footer--h5 .hint-sheet__wallet").last();

async function ask(page: Page) {
  await expect(cta(page)).not.toHaveAttribute("aria-disabled", "true");
  await cta(page).click();
}

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

async function expectLayout(page: Page, where: string) {
  const m = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const clipped = [...document.querySelectorAll<HTMLElement>(".hint-sheet .hint-sheet__card-title, .hint-sheet .hint-sheet__row, .hint-sheet .hint-sheet__fact-line, .hint-sheet .hint-sheet__chip, .hint-sheet .hint-sheet__next, .hint-sheet .hint-sheet__wallet, .hint-sheet .hint-sheet__outcome, .hint-sheet .hint-sheet__guidance")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.className}: ${el.textContent}`);
    return { vw, vh, scrollWidth: document.documentElement.scrollWidth, sheet: rect(".hint-sheet"), cta: rect(".hint-sheet__h5-next .hint-sheet__next"), close: rect(".hint-sheet__close"), clipped };
  });
  expect(m.scrollWidth, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
  expect(m.sheet!.left, where).toBeGreaterThanOrEqual(0);
  expect(m.sheet!.right, where).toBeLessThanOrEqual(m.vw + 0.5);
  expect(m.sheet!.bottom, where).toBeLessThanOrEqual(m.vh + 0.5);
  expect(m.close!.height, `${where}: 閉じる`).toBeGreaterThanOrEqual(44);
  if (m.cta) {
    expect(m.cta.height, `${where}: CTA height`).toBeGreaterThanOrEqual(44);
    expect(m.cta.bottom, `${where}: CTA cut off`).toBeLessThanOrEqual(m.vh + 0.5);
  }
  expect(m.clipped, `${where}: clipped text`).toEqual([]);
}

async function shot(page: Page, name: string) {
  if (process.env.HINT5_SCREENSHOTS !== "1") return;
  const project = test.info().project.name.replace("iphone-", "");
  await page.screenshot({ path: `docs/reports/screenshots/hint-5-h5-5/${project}-${name}.png` });
}

// ---- production build ------------------------------------------------------------------------------

test.describe("production build: the Preview parameters do nothing (P2 / P3)", () => {
  test("?hint5=1&hv=cheese-none: the old sheet, no seed, no Preview key, the production save untouched", async ({ page }) => {
    const save = meatLoversSave(999);
    await seedStorage(page, { [PROD_KEY]: JSON.stringify(save) });
    await visit(page, `${origin}${PROD_BASE}?hint5=1&hv=cheese-none`);
    const dialog = await openHintSheet(page);
    // P2: the ladder is ON by default in production (H5-6); the Preview parameter changes nothing about that.
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    await expect(dialog.getByRole("button", { name: "ヒントをもらう" })).toHaveCount(0);
    await expect(nextTitle(page)).toContainText("ヒント1: ソース");
    await expect(page.locator(".preview-badge")).toHaveCount(0);
    // P3: no seed. The production save is the one that was planted (999 Pitz, 8 recipes, no marinara).
    const after = JSON.parse((await stored(page, PROD_KEY))!);
    expect(after.pitzBalance).toBe(999);
    expect(after.dex.length).toBe(save.dex.length);
    expect(after.dex.map((d: { recipeId: string }) => d.recipeId)).not.toContain("marinara");
    expect(await stored(page, PREVIEW_KEY)).toBeNull();
    expect(await stored(page, OPT_IN_KEY)).toBeNull();
    await shot(page, "prod-hint5-param-ignored");
  });

  test("?hint5=0 (the Preview kill switch) does not turn the production ladder off, and a stored Preview opt-in is left alone", async ({ page }) => {
    await seedStorage(page, { [PROD_KEY]: JSON.stringify(meatLoversSave(999)), [OPT_IN_KEY]: "1" });
    await visit(page, `${origin}${PROD_BASE}?hint5=0`);
    const dialog = await openHintSheet(page);
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    await expect(dialog.getByRole("button", { name: "ヒントをもらう" })).toHaveCount(0);
    expect(await stored(page, OPT_IN_KEY)).toBe("1"); // production neither reads nor clears it
  });
});

// ---- Preview build ---------------------------------------------------------------------------------

test.describe("Preview build: opt-in, seeds, isolation (P4 to P8)", () => {
  test("P4: without a parameter the Preview build behaves like production (the ladder is ON by default)", async ({ page }) => {
    await seedStorage(page, { [PREVIEW_KEY]: JSON.stringify(meatLoversSave(999)) });
    await visit(page, previewUrl(""));
    const dialog = await openHintSheet(page);
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    await expect(dialog.getByRole("button", { name: "ヒントをもらう" })).toHaveCount(0);
    await expect(page.locator(".preview-badge")).toContainText("PREVIEW");
  });

  test("P5: ?hint5=1 turns the ladder on (and it stays on without the parameter); ?hint5=0 turns it off", async ({ page }) => {
    await seedStorage(page, { [PREVIEW_KEY]: JSON.stringify(meatLoversSave(999)) });
    await visit(page, previewUrl("?hint5=1"));
    let dialog = await openHintSheet(page);
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    await expect(dialog.getByRole("button", { name: "ヒントをもらう" })).toHaveCount(0);
    await expect(nextTitle(page)).toContainText("ヒント1: ソース");
    expect(await stored(page, OPT_IN_KEY)).toBe("1");
    await visit(page, previewUrl(""));
    dialog = await openHintSheet(page);
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    await visit(page, previewUrl("?hint5=0"));
    dialog = await openHintSheet(page);
    await expect(dialog).not.toHaveAttribute("data-hint-ladder", /.+/);
    expect(await stored(page, OPT_IN_KEY)).toBe("0"); // an explicit, remembered off
    // The parameter is gone from the URL and the page is reloaded: still off (P2 review finding).
    await visit(page, previewUrl(""));
    dialog = await openHintSheet(page);
    await expect(dialog).not.toHaveAttribute("data-hint-ladder", /.+/);
    await page.reload();
    dialog = await openHintSheet(page);
    await expect(dialog).not.toHaveAttribute("data-hint-ladder", /.+/);
    // ?hint5=1 returns to on, and that is remembered as well.
    await visit(page, previewUrl("?hint5=1"));
    dialog = await openHintSheet(page);
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    await visit(page, previewUrl(""));
    dialog = await openHintSheet(page);
    await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    expect(await stored(page, OPT_IN_KEY)).toBe("1");
  });

  test("P6: a seed writes the Preview save only; a planted production save is byte for byte unchanged", async ({ page }) => {
    const production = JSON.stringify({ sentinel: "PRODUCTION-SAVE", note: "not even a valid save" });
    await seedStorage(page, { [PROD_KEY]: production });
    for (const id of ["normal", "cheese-none", "last-sub"]) {
      await visit(page, previewUrl(`?hint5=1&hv=${id}`));
      await page.waitForSelector(".app-frame");
      expect(await stored(page, PROD_KEY), id).toBe(production);
      const seeded = JSON.parse((await stored(page, PREVIEW_KEY))!);
      expect(seeded.pitzBalance, id).toBe(300);
    }
  });

  test("P7 + P8: reload keeps the Preview state with no recharge; Full Game Reset resets the Preview save only", async ({ page }) => {
    const production = JSON.stringify({ sentinel: "PRODUCTION-SAVE" });
    await seedStorage(page, { [PROD_KEY]: production });
    await visit(page, previewUrl("?hint5=1&hv=cheese-none"));
    let dialog = await openHintSheet(page);
    await expect(nextTitle(page)).toContainText("ヒント2: チーズ");
    await expect(wallet(page)).toContainText("所持 300 Pitz");
    await ask(page);
    await expect(wallet(page)).toContainText("所持 290 Pitz");
    await expect(dialog.locator('[data-hint5-rung="CHEESE"]')).toHaveText("チーズなし");

    // P7: a reload is not a fresh navigation, so the seed is not applied again.
    await page.reload();
    dialog = await openHintSheet(page);
    await expect(dialog.locator('[data-hint5-rung="CHEESE"]')).toHaveText("チーズなし");
    await expect(wallet(page)).toContainText("所持 290 Pitz");
    await expect(nextTitle(page)).toContainText("ヒント3: キートッピング");
    const persisted = JSON.parse((await stored(page, PREVIEW_KEY))!);
    expect(persisted.discoveryHintFacts.marinara).toEqual(["ing:tomato-sauce", "h5:sauce", "h5:cheese"]);

    // P8: Full Game Reset from the settings (the app reloads itself).
    await page.reload();
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: "設定" }).click();
    await page.getByRole("button", { name: "ゲームデータをリセット" }).click();
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "最初からやり直す" }).click()]);
    await page.waitForSelector(".app-frame");
    expect(await stored(page, PROD_KEY)).toBe(production); // the production save is untouched by the Preview's reset
    expect(await stored(page, OPT_IN_KEY)).toBe("1"); // the opt-in is not part of the save
    const afterReset = await stored(page, PREVIEW_KEY);
    if (afterReset !== null) {
      const save = JSON.parse(afterReset);
      expect(save.discoveryHintFacts ?? {}).toEqual({});
      expect(save.dex.map((d: { recipeId: string }) => d.recipeId)).not.toContain("bismarck");
      expect(save.pitzBalance).not.toBe(290);
    }
    // ...and it is a real initial state: the seed did not come back.
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await page.locator(".prepare-bake-bar").getByRole("button", { name: "ヒント" }).click();
    await expect(page.locator('[data-hint5-rung="CHEESE"]')).toHaveCount(0);
  });
});

// ---- the HV scenarios (P9, P10 / P11) --------------------------------------------------------------

interface Scenario {
  id: string;
  next: [title: string, price: string];
  wallet: number;
  act: (page: Page, dialog: ReturnType<Page["getByRole"]>) => Promise<void>;
}

const SCENARIOS: Scenario[] = [
  {
    id: "normal",
    next: ["ヒント1: ソース", "10 Pitz"],
    wallet: 300,
    act: async (page) => {
      await ask(page);
      await expect(wallet(page)).toContainText("所持 290 Pitz");
      await expect(nextTitle(page)).toContainText("ヒント2: チーズ");
    },
  },
  {
    id: "cheese-none",
    next: ["ヒント2: チーズ", "10 Pitz"],
    wallet: 300,
    act: async (page, dialog) => {
      await expect(dialog).not.toContainText("なし");
      await ask(page);
      await expect(dialog.locator('[data-hint5-rung="CHEESE"]')).toHaveText("チーズなし");
      await expect(wallet(page)).toContainText("所持 290 Pitz");
    },
  },
  {
    id: "key-none",
    next: ["ヒント3: キートッピング", "10 Pitz"],
    wallet: 300,
    act: async (page, dialog) => {
      await expect(dialog).not.toContainText("なし");
      await ask(page);
      await expect(dialog.locator('[data-hint5-rung="KEY_TOPPING"]')).toHaveText("キートッピングなし");
      await expect(nextTitle(page)).toContainText("ヒント4: 構成");
      await ask(page);
      await expect(dialog).toContainText("ここまでのヒントで、推理してみよう！");
      await expect(cta(page)).toHaveCount(0);
      await expect(wallet(page)).toContainText("所持 285 Pitz");
    },
  },
  {
    id: "already-known",
    next: ["ヒント1: ソース", "10 Pitz"],
    wallet: 300,
    act: async (page, dialog) => {
      await expect(dialog).not.toContainText("もう知っていた");
      await ask(page);
      await expect(dialog).toContainText("このヒントはもう知っていたよ！");
      await expect(wallet(page)).toContainText("所持 300 Pitz");
      await expect(nextTitle(page)).toContainText("ヒント2: チーズ");
    },
  },
  {
    id: "multi-sub",
    next: ["ヒント5: サブトッピング①の分類", "5 Pitz"],
    wallet: 300,
    act: async (page, dialog) => {
      for (let i = 0; i < 3; i += 1) await ask(page);
      await expect(dialog.locator('[data-hint5-rung="SUB_CLASS"]')).toHaveCount(3);
      await expect(dialog).toContainText("ここまでのヒントで、推理してみよう！");
      await expect(wallet(page)).toContainText("所持 285 Pitz");
    },
  },
  {
    id: "last-sub",
    next: ["ヒント7: サブトッピング③の分類", "5 Pitz"],
    wallet: 300,
    act: async (page, dialog) => {
      await ask(page);
      await expect(dialog.locator('[data-hint5-rung="SUB_CLASS"]')).toHaveCount(3);
      await expect(dialog).toContainText("ここまでのヒントで、推理してみよう！");
      await expect(cta(page)).toHaveCount(0);
      await expect(wallet(page)).toContainText("所持 295 Pitz");
      for (const name of ["オレガノ", "ハム", "ブラックオリーブ"]) await expect(dialog).not.toContainText(name);
    },
  },
  {
    id: "low-pitz",
    next: ["ヒント1: ソース", "10 Pitz"],
    wallet: 12,
    act: async (page, dialog) => {
      await ask(page);
      await expect(wallet(page)).toContainText("所持 2 Pitz");
      await expect(cta(page)).toBeDisabled();
      await expect(dialog).toContainText("Pitzがたまったら");
    },
  },
];

test.describe("P9 / P10 / P11: every Human Verification scenario opens directly and reproduces", () => {
  for (const scenario of SCENARIOS) {
    test(`?hint5=1&hv=${scenario.id}`, async ({ page }) => {
      await seedStorage(page, { [PROD_KEY]: "PRODUCTION-SAVE" });
      const url = previewUrl(`?hint5=1&hv=${scenario.id}`);
      await visit(page, url);
      const dialog = await openHintSheet(page);
      await expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
      await expect(nextTitle(page)).toContainText(scenario.next[0]);
      await expect(cta(page)).toContainText(scenario.next[1]);
      await expect(wallet(page)).toContainText(`所持 ${scenario.wallet} Pitz`);
      await expectLayout(page, `${scenario.id}: opened`);
      await shot(page, `${scenario.id}-1-opened`);
      await scenario.act(page, dialog);
      await expectLayout(page, `${scenario.id}: after`);
      await shot(page, `${scenario.id}-2-after`);
      expect(await stored(page, PROD_KEY), scenario.id).toBe("PRODUCTION-SAVE");

      // Opening the same URL again restarts the scenario.
      await visit(page, url);
      const again = await openHintSheet(page);
      await expect(again).toHaveAttribute("data-hint-ladder", "hint5");
      await expect(nextTitle(page)).toContainText(scenario.next[0]);
      await expect(wallet(page)).toContainText(`所持 ${scenario.wallet} Pitz`);
    });
  }

  test("an unknown scenario or a plain ?hint5=1 seeds nothing: the save that was there stays", async ({ page }) => {
    await seedStorage(page, { [PREVIEW_KEY]: JSON.stringify(meatLoversSave(777)) });
    for (const query of ["?hint5=1&hv=unknown", "?hint5=1&hv=__proto__", "?hint5=1"]) {
      await visit(page, previewUrl(query));
      await page.waitForSelector(".app-frame");
      expect(JSON.parse((await stored(page, PREVIEW_KEY))!).pitzBalance, query).toBe(777);
    }
  });
});
