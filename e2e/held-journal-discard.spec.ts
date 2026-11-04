import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";
import { SAVE_KEY } from "./support/familyTray";

/**
 * Save P1-1 (Issue #664): a kept (held) `pendingRound` can be copied away and discarded, on explicit confirmation.
 * Real browser, 390x844 / 360x800 (webkit-* in CI). Seeds only this context's own storage; never touches another origin's data.
 *
 *   - the dialog: strong warning + every check required, cancel changes nothing;
 *   - confirm: the whole save is copied verbatim, only `pendingRound` leaves the save, the notice is gone after a reload;
 *   - a bake that was refused as `occupied` goes through after the discard (CUT round);
 *   - a copy that cannot be stored (quota) discards nothing;
 *   - another tab's save is not overwritten (stale-save).
 *
 * HV_OUT_DIR (unset in CI) gets screenshots.
 */
const OUT = process.env.HV_OUT_DIR;
async function shot(page: Page, name: string, project: string) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}-${project}.png` });
}

const QKEY = `${SAVE_KEY}.held-journal`;
const FIRST = `${QKEY}.quarantine-v1.first`;
const MARGHERITA_BAKE = { start: 60, end: 80 };

const baseSave = () => ({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
  pitzBalance: 100,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "onion"],
  missionBest: {},
  inventory: { onion: 9 },
  starterGrantClaimedRecipeIds: [] as string[],
});

const JOURNALS = {
  "unknown-version": { v: 2, id: "from-a-newer-build", status: "pending", anything: { new: "shape" } },
  unresolvable: {
    v: 1, id: "late-1", status: "pending", kind: "GUIDED", recipeId: "margherita", bakeValue: 70, createdAt: 1,
    pizza: {
      toppings: [{ id: "t1", ingredientId: "ingredient-from-a-later-catalog", x: 1, y: 1 }],
      sauceIds: [], sauceOrigin: null, sauceDeposits: [], doughShape: { radii: [18, 18, 18, 18, 18, 18, 18, 18] },
    },
  },
  corrupt: { v: 1, id: 5, status: "pending" },
} as const;

async function seed(page: Page, journal: object) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify({ ...baseSave(), pendingRound: journal })] as const);
}

const raw = (page: Page, key = SAVE_KEY) => page.evaluate((k) => localStorage.getItem(k), key);
const readSave = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as Record<string, any> | null, SAVE_KEY);
const held = (page: Page) => page.locator('[data-round-notice="held"]');
const dialog = (page: Page) => page.getByRole("alertdialog");
const confirmButton = (page: Page) => page.locator("[data-held-discard-confirm]");

async function boot(page: Page, journal: object) {
  await seed(page, journal);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(held(page)).toBeVisible();
}

async function tickAll(page: Page) {
  const checks = page.locator("[data-held-discard-check]");
  const n = await checks.count();
  for (let i = 0; i < n; i += 1) await checks.nth(i).check();
}

for (const reason of ["unknown-version", "unresolvable", "corrupt"] as const) {
  test(`${reason}: cancel changes nothing; confirm copies the whole save and removes only the journal`, async ({ page }, info) => {
    await boot(page, JOURNALS[reason]);
    const started = await raw(page);
    await shot(page, `p11-01-held-notice-${reason}`, info.project.name);

    await held(page).getByRole("button", { name: "この記録を退避して破棄…" }).click();
    await expect(dialog(page)).toBeVisible();
    const strong = reason !== "corrupt";
    await expect(page.locator("[data-held-discard-warning]")).toHaveCount(strong ? 1 : 0);
    await expect(page.locator("[data-held-discard-check]")).toHaveCount(strong ? 2 : 1);
    await expect(confirmButton(page)).toBeDisabled();
    await page.locator("[data-held-discard-check]").first().check();
    if (strong) await expect(confirmButton(page)).toBeDisabled();
    await shot(page, `p11-02-dialog-${reason}`, info.project.name);

    // cancel: nothing was written
    await page.locator("[data-held-discard-cancel]").click();
    await expect(dialog(page)).toHaveCount(0);
    expect(await raw(page)).toBe(started);
    expect(await raw(page, FIRST)).toBeNull();

    await held(page).getByRole("button", { name: "この記録を退避して破棄…" }).click();
    await tickAll(page);
    await expect(confirmButton(page)).toBeEnabled();
    await confirmButton(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(held(page)).toHaveCount(0);
    await expect(page.getByText("調理の記録を破棄しました")).toBeVisible();
    await shot(page, `p11-03-after-discard-${reason}`, info.project.name);

    // the copy is the whole save as it was, byte for byte
    const copy = JSON.parse((await raw(page, FIRST))!) as { raw: string; kind: string };
    expect(copy.kind).toBe("held-journal");
    expect(copy.raw).toBe(started);
    // the save lost that one key and nothing else
    const { pendingRound: _removed, ...expected } = JSON.parse(started!) as Record<string, unknown>;
    expect(await readSave(page)).toEqual(expected);

    await page.reload();
    await page.waitForSelector(".app-frame");
    await expect(held(page)).toHaveCount(0);
    expect(await readSave(page)).toEqual(expected);
  });
}

async function startGuidedMargherita(page: Page) {
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
}

async function prepareGuidedMargherita(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
}

test("a CUT bake refused as occupied goes through after the discard; the new journal is the only addition", async ({ page }, info) => {
  test.setTimeout(120_000);
  await boot(page, JOURNALS.unresolvable);
  await startGuidedMargherita(page);
  await prepareGuidedMargherita(page);
  await enterBakePaused(page);
  await page.clock.runFor(100);
  await landNeedleAndTakeOut(page, MARGHERITA_BAKE);
  const failure = page.locator('[data-round-notice="save-failure"]');
  await expect(failure).toBeVisible();
  await expect(failure).toContainText("この版では完了できない調理の記録");
  await shot(page, "p11-04-occupied-refusal", info.project.name);
  expect((await readSave(page))?.pendingRound?.id).toBe("late-1"); // untouched, onion not consumed
  expect((await readSave(page))?.inventory.onion).toBe(9);

  // HOME (nothing was baked, so there is nothing to complete), then discard
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /ホーム/ }).click();
  await expect(page.locator(".home-screen")).toBeVisible();
  await held(page).getByRole("button", { name: "この記録を退避して破棄…" }).click();
  await tickAll(page);
  await confirmButton(page).click();
  await expect(held(page)).toHaveCount(0);

  await startGuidedMargherita(page);
  await prepareGuidedMargherita(page);
  await bakeToTarget(page, MARGHERITA_BAKE);
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
  const mid = await readSave(page);
  expect(mid?.pendingRound?.status).toBe("pending");
  expect(mid?.pendingRound?.id).not.toBe("late-1");
  await cutThreeLines(page);
  await page.getByRole("button", { name: /切り終わる/ }).click();
  await expect.poll(async () => (await readSave(page))?.pendingRound).toBeUndefined();
  expect((await readSave(page))?.dex.find((e: any) => e.recipeId === "margherita").timesMade).toBe(2);
});

test("a copy that cannot be stored (quota) discards nothing and says so", async ({ page }, info) => {
  await boot(page, JOURNALS["unknown-version"]);
  const started = await raw(page);
  await page.evaluate((prefix) => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (k.startsWith(prefix)) throw new DOMException("quota", "QuotaExceededError");
      return real.call(this, k, v);
    };
  }, QKEY);
  await held(page).getByRole("button", { name: "この記録を退避して破棄…" }).click();
  await tickAll(page);
  await confirmButton(page).click();
  const failure = page.locator("[data-held-discard-failure]");
  await expect(failure).toContainText("何も破棄していません");
  await expect(dialog(page)).toBeVisible();
  expect(await raw(page)).toBe(started);
  expect(await raw(page, FIRST)).toBeNull();
  await expect(held(page)).toBeVisible();
  await shot(page, "p11-05-copy-failed", info.project.name);
});

test("another tab's save is not overwritten: the discard is refused (stale-save)", async ({ page, context }, info) => {
  await boot(page, JOURNALS.corrupt);
  await held(page).getByRole("button", { name: "この記録を退避して破棄…" }).click();
  await tickAll(page);
  // a second tab of the same origin saves something else in the meantime
  const other = await context.newPage();
  await other.goto("icons/icon-16.png");
  const otherSave = JSON.stringify({ ...baseSave(), pitzBalance: 321, pendingRound: JOURNALS.corrupt });
  await other.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, otherSave] as const);
  await other.close();

  await confirmButton(page).click();
  await expect(page.locator("[data-held-discard-failure]")).toContainText("別の画面で保存データが更新されました");
  expect(await raw(page)).toBe(otherSave);
  expect(await raw(page, FIRST)).toBeNull();
  await shot(page, "p11-06-stale-save", info.project.name);
});
