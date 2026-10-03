import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { buildLcApp, serveBuilds } from "./support/lcHandBuild";
import { captureFreeSnapshots, openFree, PREVIEW_KEY, PRODUCTION_KEY, saveWithToppings, toCheese, toSauce, toTopping, type Decoys } from "./support/lcHandDom";
import { runOnlyOnWidth } from "./support/projectGuard";

/**
 * Large Catalog UX LC-R6-b: Preview Hand activation infrastructure (OD-R6a-1 = A2), on REAL builds served from one
 * origin under four base paths -- production / Preview x source-as-committed (variant null) / variant 12 (the one
 * committed line rewritten in memory, what an HV-only disposable commit changes). Gates:
 *  - P-4  production build with the variant 12: Hand OFF, no pin UI, no HAND badge, and nothing (query string,
 *         localStorage / sessionStorage decoys) turns it on;
 *  - P-5  production DOM = the committed R5-e baseline (docs/reports/data/...PRODUCTION-DOM-GOLDEN.json, Chromium);
 *  - normal Preview (variant null) = OFF: DOM identical to production;
 *  - Preview + variant 12 = Hand ON (2 tray pages for 22 toppings, pin UI in the pantry, badge `HAND 12`), and
 *    still OFF-equivalent where the hand is inactive (SAUCE / CHEESE / 6 toppings).
 * Runs once per engine on the 390 project. 9 vs 12 and the capacity decision are NOT part of this task.
 */
const GOLDEN_FILE = "docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6b_PRODUCTION-DOM-GOLDEN.json";
const PROD = "/prod/";
const PROD12 = "/prod-v12/";
const PREV = "/preview/";
const PREV12 = "/preview-v12/";

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

/** `LC_R6B_SCREENSHOTS=1` writes the Human Verification screenshots to docs/reports/screenshots/lc-r6b-preview-activation/. */
async function shot(page: import("@playwright/test").Page, name: string) {
  if (process.env.LC_R6B_SCREENSHOTS !== "1") return;
  await page.screenshot({ path: `docs/reports/screenshots/lc-r6b-preview-activation/${name}.png` });
}

test.describe.configure({ mode: "serial" });

let origin = "";
let closeServer: (() => Promise<void>) | null = null;
let workDir = "";

test.beforeAll(async () => {
  test.setTimeout(240_000);
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-hand-preview-"));
  const specs = [
    [PROD, false, null],
    [PROD12, false, 12],
    [PREV, true, null],
    [PREV12, true, 12],
  ] as const;
  const roots: [string, string][] = [];
  for (const [base, preview, variant] of specs) {
    const outDir = path.join(workDir, base.replaceAll("/", ""));
    await buildLcApp({ outDir, base, preview, variant }, true);
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

test("Preview activation: production is Hand OFF with the variant committed, Preview needs the variant", async ({ page, browserName }, testInfo) => {
  runOnlyOnWidth(testInfo, 390);
  test.setTimeout(280_000);

  // ---- production, source as committed: the baseline ----
  const prod = await captureFreeSnapshots(page, `${origin}${PROD}`, PRODUCTION_KEY);
  expect(Object.keys(prod).filter((k) => k.startsWith("free22.topping.page")).length, "production 22 toppings: 4 pages (no hand)").toBe(4);
  await expect(page.locator(".preview-badge")).toHaveCount(0);
  if (browserName === "chromium") {
    // P-5: byte-identical to the baseline captured from a production build of main WITHOUT any R6-b source (6abddc7, re-baselined on 518c840: only the chicken #342 chip differs).
    const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, "utf8")) as { snapshots: Record<string, string | null> };
    expect(prod, "production DOM golden (R5-e baseline)").toEqual(golden.snapshots);
  }

  // ---- P-4: production build of source with the variant 12 (plus every decoy switch) ----
  const prod12 = await captureFreeSnapshots(page, `${origin}${PROD12}`, PRODUCTION_KEY, { ...DECOYS });
  expect(prod12, "production + variant 12 (+ query / storage decoys) = production").toEqual(prod);
  await expect(page.locator(".preview-badge")).toHaveCount(0);
  await openFree(page, `${origin}${PROD12}`, PRODUCTION_KEY, saveWithToppings(22), DECOYS);
  await toSauce(page);
  await toCheese(page);
  await toTopping(page);
  await shot(page, "production-variant12-topping-hand-off");
  await page.getByRole("button", { name: /食材庫/ }).click();
  await page.waitForSelector(".pantry-sheet");
  expect(await page.locator(".pantry-tile__toggle, .pantry-tile__pin-badge, .pantry-sheet__pins, .pantry-tile--editable").count(), "production + variant 12: no pin UI").toBe(0);
  await shot(page, "production-variant12-pantry-no-pin-ui");
  await page.keyboard.press("Escape");

  // ---- normal Preview (variant null): Hand OFF, same tray / pantry DOM as production ----
  await openFree(page, `${origin}${PREV}`, PREVIEW_KEY, saveWithToppings(22));
  await toSauce(page);
  await toCheese(page);
  await toTopping(page);
  await shot(page, "preview-normal-topping-hand-off-badge-no-hand");
  const prev = await captureFreeSnapshots(page, `${origin}${PREV}`, PREVIEW_KEY);
  expect(prev, "normal Preview (variant null) = production").toEqual(prod);
  await expect(page.locator(".preview-badge")).toHaveText(/^PREVIEW · PR#r6b · r6b0000$/);
  await expect(page.locator(".preview-badge")).not.toContainText("HAND");

  // ---- Preview + variant 12: Hand ON ----
  const prev12 = await captureFreeSnapshots(page, `${origin}${PREV12}`, PREVIEW_KEY);
  await expect(page.locator(".preview-badge")).toHaveText(/HAND 12$/);
  await expect(page.locator(".preview-badge")).toHaveAttribute("data-lc-hand-preview", "lc-hand-preview-v1");
  expect(Object.keys(prev12).filter((k) => k.startsWith("free22.topping.page")).length, "22 toppings + hand 12: 2 tray pages").toBe(2);
  expect(prev12["free22.topping.page1"], "the hand changes the tray").not.toEqual(prod["free22.topping.page1"]);
  // Inactive hand == OFF: SAUCE / CHEESE (catalog smaller than the capacity) and 6 owned toppings.
  for (const k of ["free22.sauce", "free22.cheese", "free6.sauce", "free6.cheese", "free6.topping.page1"]) {
    expect(prev12[k], `Preview variant 12, inactive hand: ${k} = OFF`).toEqual(prod[k]);
  }
  // Pin UI is live in the Preview variant's pantry (R5-d-level UI; R6-c refines it).
  await openFree(page, `${origin}${PREV12}`, PREVIEW_KEY, saveWithToppings(22));
  await toSauce(page);
  await toCheese(page);
  await toTopping(page);
  await shot(page, "preview-variant12-topping-hand-on-badge-hand12");
  await page.getByRole("button", { name: /食材庫/ }).click();
  await page.waitForSelector(".pantry-sheet");
  await shot(page, "preview-variant12-pantry-pin-ui");
  expect(await page.locator(".pantry-tile__toggle").count(), "Preview variant 12: pin toggles exist").toBeGreaterThan(0);
});
