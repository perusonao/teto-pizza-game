import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { buildLcApp, serveBuilds } from "./support/lcHandBuild";
import { captureFreeSnapshots, openFree, PREVIEW_KEY, PRODUCTION_KEY, saveWithToppings, toCheese, toSauce, toTopping, type Decoys } from "./support/lcHandDom";
import { runOnlyOnWidth } from "./support/projectGuard";

/**
 * Large Catalog UX LC-R6-e (was LC-R6-b): Production Hand activation (formal capacity 12, OD-5), on REAL builds served
 * from one origin under base paths -- production / production + variant 12 / Preview (variant null) / Preview + variant 12
 * / production ROLLED BACK (the one flag line `HAND_ENFORCEMENT_PRODUCTION` = false). Gates:
 *  - production build: Hand ON with capacity 12 (2 tray pages for 22 toppings, pin UI in the pantry), NO preview badge;
 *  - P-4  production + Preview variant 12 (+ query / storage decoys) = production: the variant and the decoys do nothing;
 *  - parity: normal Preview (variant null) DOM = production DOM (badge aside); Preview + variant 12 = the same hand;
 *  - rollback: production with the flag line set to false = the pre-activation DOM, byte-identical to the committed
 *    R5-e baseline (docs/reports/data/...PRODUCTION-DOM-GOLDEN.json, Chromium) -- the rollback restores Hand OFF exactly.
 * Runs once per engine on the 390 project.
 */
const GOLDEN_FILE = "docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6b_PRODUCTION-DOM-GOLDEN.json";
const PROD = "/prod/";
const PROD12 = "/prod-v12/";
const PREV = "/preview/";
const PREV12 = "/preview-v12/";
const ROLLBACK = "/rollback/";

const DECOYS: Decoys = {
  query: "?lcHand=12&hand=12&lcHandCapacity=12&handCapacity=12&VITE_PREVIEW_MODE=1&hv=lc-22",
  local: {
    lcHand: "12",
    "lc-hand-preview-v1": "12",
    "teto-pizza-lc-hand": "12",
    "teto-pizza-preview-lc-hand": "12",
    handCapacity: "12",
    HAND_ENFORCEMENT_ENABLED: "true",
  },
  session: { lcHand: "12", "lc-hand-preview-v1": "12", handCapacity: "12" },
};

/** `LC_R6E_SCREENSHOTS=1` writes the Human Verification before/after screenshots to docs/reports/screenshots/lc-r6e-production-activation/. */
async function shot(page: import("@playwright/test").Page, name: string) {
  if (process.env.LC_R6E_SCREENSHOTS !== "1") return;
  await page.screenshot({ path: `docs/reports/screenshots/lc-r6e-production-activation/${name}.png` });
}

test.describe.configure({ mode: "serial" });

let origin = "";
let closeServer: (() => Promise<void>) | null = null;
let workDir = "";

test.beforeAll(async () => {
  test.setTimeout(240_000);
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-hand-preview-"));
  const specs = [
    [PROD, false, null, false],
    [PROD12, false, 12, false],
    [PREV, true, null, false],
    [PREV12, true, 12, false],
    [ROLLBACK, false, null, true],
  ] as const;
  const roots: [string, string][] = [];
  for (const [base, preview, variant, rollback] of specs) {
    const outDir = path.join(workDir, base.replaceAll("/", ""));
    await buildLcApp({ outDir, base, preview, variant, rollback, testHooks: true }, true);
    roots.push([base, outDir]);
  }
  const server = await serveBuilds(roots);
  origin = server.origin;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer?.();
  if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
});

test("Production Hand activation: ON (12) with Preview parity, variant/decoys inert, rollback = the pre-activation DOM", async ({ page, browserName }, testInfo) => {
  runOnlyOnWidth(testInfo, 390);
  test.setTimeout(280_000);

  // ---- production, source as committed: Hand ON, capacity 12, no badge ----
  const prod = await captureFreeSnapshots(page, `${origin}${PROD}`, PRODUCTION_KEY);
  expect(Object.keys(prod).filter((k) => k.startsWith("free22.topping.page")).length, "production 22 toppings + hand 12: 2 tray pages").toBe(2);
  await expect(page.locator(".preview-badge")).toHaveCount(0);
  await openFree(page, `${origin}${PROD}`, PRODUCTION_KEY, saveWithToppings(22));
  await toSauce(page);
  await toCheese(page);
  await toTopping(page);
  await shot(page, "production-topping-hand-on");
  await page.getByRole("button", { name: /食材庫/ }).click();
  await page.waitForSelector(".pantry-sheet");
  expect(await page.locator(".pantry-tile__toggle").count(), "production: pin toggles exist").toBeGreaterThan(0);
  await shot(page, "production-pantry-pin-ui");
  await page.keyboard.press("Escape");

  // ---- P-4: Preview variant 12 (plus every decoy switch) does nothing to a production build ----
  const prod12 = await captureFreeSnapshots(page, `${origin}${PROD12}`, PRODUCTION_KEY, { ...DECOYS });
  expect(prod12, "production + variant 12 (+ query / storage decoys) = production").toEqual(prod);
  await expect(page.locator(".preview-badge")).toHaveCount(0);

  // ---- parity: normal Preview (variant null) and Preview + variant 12 hold the same hand as production ----
  const prev = await captureFreeSnapshots(page, `${origin}${PREV}`, PREVIEW_KEY);
  expect(prev, "normal Preview (variant null) = production").toEqual(prod);
  await expect(page.locator(".preview-badge")).toHaveText(/^PREVIEW · PR#r6b · r6b0000$/);
  await expect(page.locator(".preview-badge")).not.toContainText("HAND");
  const prev12 = await captureFreeSnapshots(page, `${origin}${PREV12}`, PREVIEW_KEY);
  await expect(page.locator(".preview-badge")).toHaveText(/HAND 12$/);
  expect(prev12, "Preview variant 12 = production hand 12").toEqual(prod);

  // ---- rollback: the flag line set to false restores the pre-activation (Hand OFF) DOM exactly ----
  const rolled = await captureFreeSnapshots(page, `${origin}${ROLLBACK}`, PRODUCTION_KEY);
  expect(Object.keys(rolled).filter((k) => k.startsWith("free22.topping.page")).length, "rollback: 22 toppings, 4 pages (no hand)").toBe(4);
  await expect(page.locator(".preview-badge")).toHaveCount(0);
  await openFree(page, `${origin}${ROLLBACK}`, PRODUCTION_KEY, saveWithToppings(22));
  await toSauce(page);
  await toCheese(page);
  await toTopping(page);
  await shot(page, "before-rollback-topping-hand-off");
  await page.getByRole("button", { name: /食材庫/ }).click();
  await page.waitForSelector(".pantry-sheet");
  await shot(page, "before-rollback-pantry-no-pin-ui");
  await page.keyboard.press("Escape");
  if (browserName === "chromium") {
    // `LC_GOLDEN_WRITE=1` re-captures the golden from the rollback build (a deliberate, reviewed rebaseline only: the
    // metadata notes in the file are edited by hand and the diff is checked item by item).
    if (process.env.LC_GOLDEN_WRITE === "1") {
      const current = JSON.parse(fs.readFileSync(GOLDEN_FILE, "utf8")) as Record<string, unknown>;
      fs.writeFileSync(GOLDEN_FILE, JSON.stringify({ ...current, snapshots: rolled }, null, 2) + "\n");
    }
    const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, "utf8")) as { snapshots: Record<string, string | null> };
    expect(rolled, "rolled-back production DOM = the R5-e baseline golden").toEqual(golden.snapshots);
  }
});
