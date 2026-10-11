import { expect, test, type Page } from "@playwright/test";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";
import { completeDoughStep, paintSauceRing, physicalDragToDough, startLunchRushMission, startSalsicciaUnlocked, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";
import { DM_A, dinnerSave, openDinnerDetail, openWithSave } from "./support/dinner";

/**
 * Issue #476 (Topping Placement Human Feel 2.0), slice S1: tray drag-and-drop belongs to the ROUND, not to a Reference.
 * Guided (a recipe that is not Margherita), Free Cooking, Research and Dinner drag every scatter piece (a cheese AND a
 * non-mozzarella / non-basil topping); Lunch Rush still cannot. Real mouse gestures at 390x844 and 360x800 (the two
 * Chromium projects; WebKit in CI). Pinned alongside the drag: it lands at the requested point (no change to the
 * placement coordinates), Escape cancels, 1つ戻す takes the piece back, nothing overflows and every chip stays >= 44px.
 */

const pieces = (page: Page) => page.locator(".pizza-stage [data-topping-id]");
const bar = (page: Page) => page.locator(".prepare-bake-bar");
const physicalChips = (page: Page) => page.locator(".ingredient-chip--physical");

async function toCheeseStep(page: Page) {
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "チーズ" })).toHaveAttribute("aria-selected", "true");
}

async function expectLayoutSane(page: Page, where: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.sw, `${where}: horizontal overflow`).toBeLessThanOrEqual(m.vw);
  const boxes = await page.locator(".ingredient-chip").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  );
  for (const b of boxes) {
    expect(b.h, `${where}: chip height`).toBeGreaterThanOrEqual(44);
    expect(b.w, `${where}: chip width`).toBeGreaterThanOrEqual(44);
  }
}

/** Drags `chip` to (x%, y%) and returns the piece it created, read from the DOM (the placed coordinates). */
async function dragAndRead(page: Page, chip: RegExp, x: number, y: number) {
  const before = await pieces(page).count();
  await physicalDragToDough(page, chip, x, y);
  await expect(pieces(page)).toHaveCount(before + 1);
  return pieces(page).last().evaluate((el) => ({ left: (el as HTMLElement).style.left, top: (el as HTMLElement).style.top }));
}

/** The round-independent part: cheese drag, Escape cancel, topping drag with a NON-mozzarella/basil piece, ↩. */
async function exerciseDrag(page: Page, label: string, topping: RegExp) {
  await expectLayoutSane(page, `${label} CHEESE`);
  await expect(physicalChips(page).first()).toBeVisible();

  const cheese = await dragAndRead(page, /モッツァレラ/, 40, 50);
  expect(cheese, `${label}: dropped exactly where it was released`).toEqual({ left: "40%", top: "50%" });

  // Escape mid-drag cancels: nothing is placed.
  const chipBox = (await page.getByRole("button", { name: /モッツァレラ/ }).boundingBox())!;
  await page.mouse.move(chipBox.x + chipBox.width / 2, chipBox.y + chipBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(chipBox.x + chipBox.width / 2 + 2, chipBox.y - 12, { steps: 3 });
  await page.mouse.move(chipBox.x + chipBox.width / 2, chipBox.y - 120, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(pieces(page)).toHaveCount(1);

  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "具材" })).toHaveAttribute("aria-selected", "true");
  await expectLayoutSane(page, `${label} TOPPING`);
  await expect(page.getByRole("button", { name: topping })).toHaveClass(/ingredient-chip--physical/);
  const placed = await dragAndRead(page, topping, 62, 52);
  expect(placed, `${label}: a non-mozzarella/basil topping drops where released`).toEqual({ left: "62%", top: "52%" });
  await expect(pieces(page)).toHaveCount(2);

  await page.getByRole("button", { name: "1つ戻す" }).click();
  await expect(pieces(page)).toHaveCount(1);
}

test.describe("S1: unified tray drag (#476)", () => {
  test("Guided, a recipe that is not Margherita (Salsiccia)", async ({ page }) => {
    await startSalsicciaUnlocked(page);
    await toCheeseStep(page);
    await exerciseDrag(page, "guided-salsiccia", /ソーセージ/);
  });

  test("Free Cooking", async ({ page }) => {
    await openWithSave(page, dinnerSave([...DM_A]));
    await startTargetlessFreeCook(page);
    await toCheeseStep(page);
    await exerciseDrag(page, "free-cooking", /にんにく/);
  });

  test("Research", async ({ page }) => {
    const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
    const discovered = [...keysBefore(25), "brazilian-calabresa", "aussie"];
    const materials = materialsUpTo(25);
    await openWithSave(page, {
      schemaVersion: 2,
      dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 999,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
      missionBest: {},
      inventory: Object.fromEntries(materials.map((m) => [m, 30])),
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: materials,
    });
    await page.getByRole("button", { name: /ピザ図鑑/ }).click();
    await page.waitForSelector(".dex-overlay");
    await page.locator(".dex-overlay__research").getByRole("button", { name: /を研究する/ }).first().click();
    await toCheeseStep(page);
    await exerciseDrag(page, "research", /にんにく/);
  });

  test("Dinner", async ({ page }) => {
    await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=900&dinnerMinStars=1");
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await expect(page.getByTestId("dinner-target-row")).toBeVisible();
    await toCheeseStep(page);
    await exerciseDrag(page, "dinner", /にんにく/);
  });

  test("Lunch Rush is unchanged: no draggable chip, a drag places nothing, a tap still places", async ({ page }) => {
    await startLunchRushMission(page, 120);
    await toCheeseStep(page);
    await expect(physicalChips(page)).toHaveCount(0);
    await expectLayoutSane(page, "lunch-rush CHEESE");
    await physicalDragToDough(page, /モッツァレラ/, 40, 50);
    await expect(pieces(page)).toHaveCount(0);
    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 40, 50);
    await expect(pieces(page)).toHaveCount(1);
  });

  test("tap placement is unchanged in a drag round (select the chip, tap the pizza)", async ({ page }) => {
    await startSalsicciaUnlocked(page);
    await toCheeseStep(page);
    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 35, 50);
    await tapDoughPercent(page, 65, 50);
    await expect(pieces(page)).toHaveCount(2);
    const first = await pieces(page).first().evaluate((el) => (el as HTMLElement).style.left);
    expect(first).toBe("35%");
  });
});
