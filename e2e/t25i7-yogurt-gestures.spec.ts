import { test, expect, type Page } from "@playwright/test";
import { RECIPES } from "../src/data/recipes";
import { DISCOVERY_LADDER } from "../src/data/discoveryLadder";
import { getReferencePizza } from "../src/data/referencePizza";
import { bakeToTarget, completeDoughStep, paintSauceRing, squeezeDoughStroke, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";

/**
 * Batch 25 (Owner: real-play verification of pizza-salad's yogurt-sauce): the second sauce is ONE presence dab of 0.02, whatever the hand does.
 * A real mouse is used on the real dough at 390x844 and 360x800: a tap, a long press, a drag, and re-tapping must all leave exactly ONE yogurt deposit of
 * 0.02 in the baked round's journal (the save is the only place the player's pizza is observable), and the round still completes to a NEW DISCOVERY.
 * Tomato is painted as a normal ring first (primary sauce).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const ALL_IDS = RECIPES.map((r) => r.id as string);
const OWNED = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]);
const ref = getReferencePizza("pizza-salad")!;

const saveJson = () =>
  JSON.stringify({
    schemaVersion: 2,
    dex: ALL_IDS.filter((id) => id !== "pizza-salad").map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...OWNED],
    missionBest: {},
    inventory: Object.fromEntries(OWNED.map((m) => [m, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: [...OWNED],
  });

const bar = (page: Page) => page.locator(".prepare-bake-bar");

async function open(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, saveJson()] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function placeGroup(page: Page, id: string, chip: RegExp) {
  const group = ref.pieceGroups.find((g) => g.ingredientId === id)!;
  await (await chipOnTrayOrPin(page, chip)).click();
  for (const p of group.positions) await tapDoughPercent(page, p.x, p.y);
}

/** Plays the round up to the yogurt step, runs `gesture` with the yogurt chip selected, then finishes the round. Returns the stored journal's pizza. */
async function playWith(page: Page, gesture: () => Promise<void>) {
  await open(page);
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await page.waitForSelector(".dex-overlay");
  await page.locator(".dex-overlay__research").getByRole("button", { name: /^？？？ピザ（ヨーグルトソース）を研究する$/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await bar(page).getByRole("button", { name: /次へ/ }).click();
  await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
  await (await chipOnTrayOrPin(page, /トマトソース/)).click();
  await paintSauceRing(page, 25, 16);
  await (await chipOnTrayOrPin(page, /ヨーグルトソース/)).click();
  await gesture();
  for (const piece of [{ id: "mozzarella", chip: /モッツァレラ/, tab: "チーズ" }, { id: "corn", chip: /コーン/, tab: "具材" }, { id: "cucumber", chip: /きゅうり/, tab: "具材" }]) {
    while (!(await page.getByRole("tab", { name: piece.tab, selected: true }).isVisible().catch(() => false))) await bar(page).getByRole("button", { name: /次へ/ }).click();
    await placeGroup(page, piece.id, piece.chip);
  }
  for (let i = 0; i < 3 && !(await page.getByRole("button", { name: /焼く/ }).isVisible().catch(() => false)); i += 1) await bar(page).getByRole("button", { name: /次へ/ }).click();
  await bakeToTarget(page, { start: 60, end: 76 }, { finish: false });
  await expect(page.getByTestId("finish-dock")).toBeVisible();
  // The baked pizza is in the save's pending journal from the bake until the round settles: this is where the player's sauces are observable.
  const journalPizza = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) ?? "{}");
    return save.pendingRound?.pizza ?? null;
  }, SAVE_KEY);
  await placeGroup(page, "lettuce", /レタス/);
  await page.getByTestId("finish-complete").click();
  await page.waitForSelector(".result-panel");
  await expect(page.locator(".result-panel--discovery")).toContainText("ピザサラダ");
  return journalPizza as { sauceIds: string[]; sauceDeposits: Array<{ amount: number; ingredientId?: string }> } | null;
}

const stageCenter = async (page: Page) => {
  const box = (await page.locator('[data-pizza-drop-target="true"]').boundingBox())!;
  return { x: box.x + box.width * 0.4, y: box.y + box.height * 0.6, box };
};

function expectOneDab(pizza: Awaited<ReturnType<typeof playWith>>, label: string) {
  expect(pizza, `${label}: the journal holds the baked pizza`).not.toBeNull();
  expect(pizza!.sauceIds, label).toEqual(["tomato-sauce", "yogurt-sauce"]);
  const yogurt = pizza!.sauceDeposits.filter((d) => d.ingredientId === "yogurt-sauce");
  expect(yogurt, `${label}: exactly ONE yogurt deposit`).toHaveLength(1);
  expect(yogurt[0]!.amount, `${label}: 0.02`).toBe(0.02);
}

test.describe("pizza-salad: the yogurt-sauce presence dab under real mouse gestures", () => {
  test.setTimeout(300_000);

  test("one tap", async ({ page }) => {
    expectOneDab(await playWith(page, async () => tapDoughPercent(page, 40, 60)), "tap");
  });

  test("a long press (1.5 s) on the dough", async ({ page }) => {
    expectOneDab(
      await playWith(page, async () => {
        const { x, y } = await stageCenter(page);
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.waitForTimeout(1500);
        await page.mouse.up();
      }),
      "long press",
    );
  });

  test("a drag across the dough", async ({ page }) => {
    expectOneDab(await playWith(page, async () => squeezeDoughStroke(page, [30, 70], [70, 30], 14)), "drag");
  });

  test("re-tapping: a second and third tap elsewhere, and on the same spot", async ({ page }) => {
    expectOneDab(
      await playWith(page, async () => {
        await tapDoughPercent(page, 40, 60);
        await tapDoughPercent(page, 60, 40);
        await tapDoughPercent(page, 40, 60);
      }),
      "re-tap",
    );
  });

  test("a tap followed by a long press and a drag", async ({ page }) => {
    expectOneDab(
      await playWith(page, async () => {
        await tapDoughPercent(page, 40, 60);
        const { x, y } = await stageCenter(page);
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.waitForTimeout(1200);
        await page.mouse.up();
        await squeezeDoughStroke(page, [30, 70], [70, 30], 10);
      }),
      "tap + hold + drag",
    );
  });
});
