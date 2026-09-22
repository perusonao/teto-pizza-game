import { test, expect } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  cutThreeLines,
  paintSauceRing,
  startCapricciosaUnlocked,
  startFreshMargherita,
  startMarinaraUnlocked,
  tapDoughPercent,
} from "./gestures";

/**
 * Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps + Bake Tab Emoji Removal, see
 * docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit F/G): real-browser coverage for
 * `getCookingProfile`'s new per-recipe step derivation (../src/data/cookingProfiles.ts's
 * `deriveCoreSteps`) and the removed 🔥 on the BAKE tab indicator. Runs under both the Chromium
 * and WebKit Playwright projects (playwright.config.ts) -- every spec in this directory runs on
 * both by default (see .github/workflows/e2e-webkit.yml), this file adds no exclusion.
 *
 * Scenario A: marinara (no required CHEESE) @390x844 -- CHEESE tab absent, no blank step, correct
 *   remaining tabs, BAKE label has no 🔥, BAKE -> CUT -> RESULT.
 * Scenario B: margherita (full-step recipe) @390x844 -- CHEESE/TOPPING both remain, flow stays
 *   functional, BAKE -> CUT.
 * Scenario C: capricciosa (the current maximum-tab recipe -- 6 tabs, same count every full-step
 *   CUT-eligible recipe reaches) @360x800 -- tabs fit, no horizontal clipping/overflow, 焼く/カット
 *   both readable.
 * Scenario D: Lunch Rush -- see that describe block's own comment for why full determinism on
 *   which recipe (skipped-step or not) Lunch Rush draws isn't achievable without changing
 *   production order-picking code, and how this scenario still exercises the skip-aware path.
 */

test.describe("Scenario A: Marinara (no CHEESE step) @390x844", () => {
  test("recipe select -> cooking screen shows no チーズ tab, then DOUGH -> SAUCE -> TOPPING -> BAKE -> CUT -> RESULT", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await startMarinaraUnlocked(page);

    // Tabs, from the moment PREPARE mounts: DOUGH/SAUCE/TOPPING + the BAKE indicator + CUT --
    // exactly 4 real <button role=tab> elements (DOUGH/SAUCE/TOPPING/CUT), no チーズ anywhere,
    // and no blank/empty step to tap through.
    await expect(page.getByRole("tab", { name: "チーズ" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "生地" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "ソース" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "具材" })).toBeVisible();

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /トマトソース/ }).click();
    await paintSauceRing(page, 25, 16);

    // Confirming SAUCE must go straight to TOPPING (具材), never to a CHEESE step that doesn't
    // exist for this recipe's own derived profile.
    await page.getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", exact: false })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "チーズ" })).toHaveCount(0);

    await page.getByRole("button", { name: /にんにく/ }).click();
    await tapDoughPercent(page, 35, 45);
    await tapDoughPercent(page, 65, 45);
    await tapDoughPercent(page, 50, 65);
    await page.getByRole("button", { name: /オレガノ/ }).click();
    await tapDoughPercent(page, 45, 30);
    await tapDoughPercent(page, 55, 30);

    // The BAKE tab label has no 🔥 -- exactly "焼く" -- and TOPPING (marinara's own last PREPARE
    // step) already shows the 焼く！ CTA rather than a 次へ that would go nowhere.
    await expect(page.getByText("焼く", { exact: true })).toBeVisible();
    await expect(page.locator(".making-step-tabs").getByText(/\u{1F525}/u)).toHaveCount(0);
    const bakeCta = page.getByRole("button", { name: /焼く！/ });
    await expect(bakeCta).toBeVisible();

    // Marinara's own bakeTarget (src/data/recipes.ts): { start: 45, end: 65 }. A virtual-clock
    // bake (bakeToTarget), not a real-time wait -- a fixed wait drifted under WebKit CI's own
    // slower/loaded runners, landing outside the target window and failing the round.
    await bakeToTarget(page, { start: 45, end: 65 });

    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
    await page.getByRole("button", { name: /切り終わる/ }).click();

    await expect(page.locator(".result-panel")).toBeVisible();
    const cutCard = page.locator(".cut-evaluation-summary");
    await expect(cutCard).toBeVisible();
    await expect(cutCard).toContainText("カット");
  });
});

test.describe("Scenario B: Margherita (full-step recipe, regression) @390x844", () => {
  test("CHEESE and TOPPING both remain; flow stays functional through BAKE -> CUT", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await startFreshMargherita(page);

    await expect(page.getByRole("tab", { name: "チーズ" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "具材" })).toBeVisible();

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

    await expect(page.getByText("焼く", { exact: true })).toBeVisible();
    await expect(page.locator(".making-step-tabs").getByText(/\u{1F525}/u)).toHaveCount(0);

    // Margherita's own bakeTarget (src/data/recipes.ts): { start: 60, end: 80 }. Virtual-clock
    // bake, matching every other spec in this repo -- see Scenario A's own comment for why a
    // fixed real-time wait is unreliable under WebKit CI.
    await bakeToTarget(page, { start: 60, end: 80 });

    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();

    await expect(page.locator(".result-panel")).toBeVisible();
    await expect(page.locator(".cut-evaluation-summary")).toContainText("カット");
  });
});

test.describe("Scenario C: constrained viewport (360x800), maximum-tab recipe (Capricciosa)", () => {
  test("all 6 tabs fit within width, no horizontal clipping/overflow, 焼く/カット readable", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 360, height: 800 });
    await startCapricciosaUnlocked(page);

    // Capricciosa is a full-step recipe (required SAUCE+CHEESE+TOPPING), reaching the same
    // 6-tab maximum every other full-step CUT-eligible recipe does: DOUGH/SAUCE/CHEESE/TOPPING +
    // BAKE indicator + CUT.
    const nav = page.locator(".making-step-tabs");
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox!.x, "nav strip must not start off-screen").toBeGreaterThanOrEqual(0);
    expect(
      navBox!.x + navBox!.width,
      "nav strip must not overflow the right edge",
    ).toBeLessThanOrEqual(360 + 1);

    const tabs = page.locator(".making-step-tabs > *");
    const tabCount = await tabs.count();
    expect(tabCount, "6 tabs: DOUGH/SAUCE/CHEESE/TOPPING + BAKE indicator + CUT").toBe(6);
    let lastRight = 0;
    for (let i = 0; i < tabCount; i += 1) {
      const box = await tabs.nth(i).boundingBox();
      expect(box, `tab ${i} must have a bounding box`).not.toBeNull();
      expect(box!.x, `tab ${i} must not start before the previous tab ends`).toBeGreaterThanOrEqual(
        lastRight - 1,
      );
      expect(box!.x + box!.width, `tab ${i} must not overflow the right edge`).toBeLessThanOrEqual(
        360 + 1,
      );
      lastRight = box!.x + box!.width;
    }

    await expect(page.getByText("焼く", { exact: true })).toBeVisible();

    const s = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
    }));
    expect(s.docScrollWidth, "no horizontal page overflow at 360x800").toBeLessThanOrEqual(s.innerWidth);

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /トマトソース/ }).click();
    await paintSauceRing(page, 25, 16);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 35, 45);
    await tapDoughPercent(page, 65, 45);
    await page.getByRole("button", { name: /次へ/ }).click();

    await page.getByRole("button", { name: /マッシュルーム/ }).click();
    await tapDoughPercent(page, 30, 60);
    await tapDoughPercent(page, 70, 60);
    await page.getByRole("button", { name: /オレガノ/ }).click();
    await tapDoughPercent(page, 50, 35);
    await page.getByRole("button", { name: /^.*ハム/ }).click();
    await tapDoughPercent(page, 50, 65);
    await page.getByRole("button", { name: /ブラックオリーブ/ }).click();
    await tapDoughPercent(page, 40, 50);
    await tapDoughPercent(page, 60, 50);

    await bakeToTarget(page, { start: 58, end: 78 });

    const cutCta = page.getByRole("button", { name: /切り終わる/ });
    await expect(cutCta).toBeVisible();
    // "カット" tab label (the CUT step's own tab, distinct from the 切り終わる CTA) must also be
    // readable -- present, non-empty text, inside the viewport.
    const cutTab = page.getByRole("tab", { name: "カット" });
    await expect(cutTab).toBeVisible();
    const cutTabBox = await cutTab.boundingBox();
    expect(cutTabBox!.x + cutTabBox!.width).toBeLessThanOrEqual(360 + 1);
  });
});

test.describe("Scenario D: Lunch Rush -- generic dynamic-step-aware flow", () => {
  /**
   * Lunch Rush's own order picker (`pickMissionOrder` -> `getNextOrder`,
   * ../src/mission/lunchRush.ts / ../src/data/orders.ts) draws uniformly at random from every
   * *available* recipe (unlock chain AND ingredient ownership both satisfied) -- margherita has
   * no `unlockCondition` at all, so it is always in that pool alongside whatever else this seed's
   * dex/ownership makes available. There is no production hook to force a single specific recipe
   * deterministically without changing order-picking code itself, which is out of this task's
   * scope (Lunch Rush RESULT/ranking code must not be touched per the task's own scope guard).
   * This scenario therefore keeps the same "handle whichever tray/step is actually present"
   * generic shape ../e2e/pizza-cutting-phase4b.spec.ts's own Scenario D already uses, and adds an
   * explicit assertion for the one case this PR specifically cares about: when the drawn recipe
   * happens to be marinara (no required CHEESE), the CHEESE tab must be absent and the round must
   * still reach BAKE -> CUT -> serve with no blank step or stuck CTA.
   */
  test("order -> recipe-specific active steps -> BAKE -> CUT -> serve, dynamic-step-aware", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    const save = {
      schemaVersion: 2,
      dex: [
        { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
        { recipeId: "funghi", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
      ],
      pitzBalance: 500,
      ownedIngredientIds: ["mushroom", "garlic", "oregano"],
      missionBest: {},
      inventory: { mushroom: 99, garlic: 99, oregano: 99 },
      starterGrantClaimedRecipeIds: ["margherita", "funghi"],
    };
    await page.addInitScript((rawSave) => {
      localStorage.setItem("teto-pizza-save-v1", JSON.stringify(rawSave));
    }, save);
    await page.goto("/");
    await page.waitForSelector(".app-frame");

    await page.getByRole("button", { name: /ランチラッシュ/ }).click();
    await page.getByRole("button", { name: "スタート" }).click();
    await page.getByRole("button", { name: "ピザを作る！" }).click();

    const orderText = (await page.locator(".order-card").textContent()) ?? "";
    const isMarinara = orderText.includes("マリナーラ");
    const bakeTarget = isMarinara
      ? { start: 45, end: 65 }
      : orderText.includes("フンギ")
        ? { start: 58, end: 78 }
        : { start: 60, end: 80 }; // margherita

    if (isMarinara) {
      await expect(page.getByRole("tab", { name: "チーズ" })).toHaveCount(0);
    }

    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();

    if (await page.getByRole("button", { name: /トマトソース/ }).count()) {
      await page.getByRole("button", { name: /トマトソース/ }).click();
      await paintSauceRing(page, 25, 16);
    }
    await page.getByRole("button", { name: /次へ/ }).click();

    if (isMarinara) {
      // SAUCE -> TOPPING directly for marinara -- no blank CHEESE step was shown or advanced
      // through above; the tray now shows this order's own TOPPING ingredients already.
      await expect(page.getByRole("tab", { name: "具材" })).toHaveAttribute("aria-selected", "true");
    } else if (await page.getByRole("button", { name: /モッツァレラ/ }).count()) {
      await page.getByRole("button", { name: /モッツァレラ/ }).click();
      await tapDoughPercent(page, 40, 50);
      await tapDoughPercent(page, 60, 50);
      await tapDoughPercent(page, 50, 30);
      await page.getByRole("button", { name: /次へ/ }).click();
    }

    const trayButtonCount = await page.locator(".ingredient-tray button").count();
    for (let i = 0; i < trayButtonCount; i += 1) {
      await page.locator(".ingredient-tray button").nth(i).click();
      await tapDoughPercent(page, 40, 50);
      await tapDoughPercent(page, 60, 50);
      await tapDoughPercent(page, 50, 30);
    }

    await bakeToTarget(page, bakeTarget);

    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();

    const cutLine = page.locator(".mission-serve-panel__cut");
    await expect(cutLine).toBeVisible();
    await expect(cutLine).toContainText("カット");

    const servedBefore = await page.locator(".mission-hud__served").textContent();
    await page.getByRole("button", { name: "次の注文へ" }).click();
    await expect(page.locator(".mission-serve-panel")).toHaveCount(0);
    await expect(page.locator('[data-pizza-drop-target="true"]')).toBeVisible();
    const servedAfter = await page.locator(".mission-hud__served").textContent();
    expect(servedAfter).not.toBe(servedBefore);
  });
});
