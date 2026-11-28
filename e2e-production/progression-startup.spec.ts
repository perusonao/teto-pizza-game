import { expect, test, type Page } from "@playwright/test";
import { legacyStartupSave } from "../e2e/support/legacyStartupSave";
import { buildIdealSauceFixture, getReferencePizza } from "../src/data/referencePizza";
import { createInitialDoughShape } from "../src/logic/doughShape";

const SAVE_KEY = "teto-pizza-save-v1";
const PREVIEW_KEY = "teto-pizza-preview-progression-model";
const DEV_KEY = "teto.dev.progressionModel";

async function expectLegacyHome(page: Page) {
  await expect(page.getByRole("heading", { name: /てっちゃんのピザ屋さん/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /ピザを作る/ })).toBeVisible();
  await expect(page.getByLabel(/レシピ図鑑 発見数/)).toBeVisible();
  await expect(page.getByTestId("home-reputation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /注文を受ける/ })).toHaveCount(0);
}

test("the production Web build opens under its default in a clean context", async ({ page }) => {
  await page.goto("./");
  await expectLegacyHome(page);
  await expect(page.getByLabel("Pitz残高 0")).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).not.toContain(PREVIEW_KEY);
  expect(keys).not.toContain(DEV_KEY);
});

test("production startup keeps the shared save and isolates the remembered choices", async ({ page }) => {
  await page.goto("icons/icon-16.png");
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, { [SAVE_KEY]: JSON.stringify(legacyStartupSave), [PREVIEW_KEY]: "shop", [DEV_KEY]: "shop" });

  for (const search of [
    "", "?progression=legacy", "", "?progression=shop", "?progression=", "?progression=unknown",
    "?progression=legacy&progression=shop", "?progression=shop&progression=legacy",
  ]) {
    await test.step(`load ${search || "(no query)"}`, async () => {
      await page.goto("about:blank");
      await page.goto(`./${search}`);
      await expectLegacyHome(page);
      await expect(page.getByLabel("Pitz残高 731")).toBeVisible();
      await expect(page.getByLabel(/レシピ図鑑 発見数 1 \/ /)).toBeVisible();
      const stored = await page.evaluate(([saveKey, previewKey, devKey]) => ({
        save: JSON.parse(localStorage.getItem(saveKey) ?? "null"),
        preview: localStorage.getItem(previewKey),
        dev: localStorage.getItem(devKey),
      }), [SAVE_KEY, PREVIEW_KEY, DEV_KEY] as const);
      expect(stored.save).toMatchObject(legacyStartupSave);
      expect(stored.save.shopProgress).toBeUndefined();
      expect(stored.preview).toBe("shop");
      expect(stored.dev).toBe("shop");
    });
  }
});

test("production legacy startup settles a shop-origin journal exactly once", async ({ page }) => {
  const reference = getReferencePizza("margherita")!;
  const save = {
    ...legacyStartupSave,
    shopProgress: {
      reputation: 39, grantedMenuRecipeIds: [], awaitingMenuRecipeIds: ["meat-lovers"], menuEntryPaidRecipeIds: [],
    },
    pendingRound: {
      v: 2, id: "prod-shop-order", status: "pending", kind: "GUIDED", originMode: "shop", recipeId: "margherita",
      bakeValue: 70, createdAt: 1,
      pizza: {
        doughShape: createInitialDoughShape(),
        sauceIds: ["tomato-sauce"],
        sauceOrigin: null,
        sauceDeposits: buildIdealSauceFixture(),
        toppings: reference.pieceGroups.flatMap((group, g) => group.positions.map((position, i) => ({
          ...position, id: `piece-${g}-${i}`, ingredientId: group.ingredientId,
        }))),
      },
    },
  };
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [SAVE_KEY, JSON.stringify(save)] as const);

  const readSave = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), SAVE_KEY);
  const expected = {
    pitzBalance: 901,
    dex: [expect.objectContaining({ recipeId: "margherita", timesMade: 2 })],
    inventory: legacyStartupSave.inventory,
    discoveryHintPurchases: legacyStartupSave.discoveryHintPurchases,
    dinnerMissionRecords: legacyStartupSave.dinnerMissionRecords,
    shopProgress: { ...save.shopProgress, reputation: 50, menuEntryPaidRecipeIds: ["meat-lovers"] },
  };
  const notice = page.locator('[data-round-notice="settled"]');
  await page.goto("./?progression=legacy");
  await expectLegacyHome(page);
  await expect(notice).toBeVisible();
  await expect.poll(readSave).toMatchObject({ ...expected, pendingRound: { originMode: "shop", status: "settled" } });

  await page.reload();
  await expect(notice).toBeVisible();
  expect(await readSave()).toMatchObject(expected);
  await notice.getByRole("button", { name: "確認した" }).click();
  await expect.poll(async () => (await readSave()).pendingRound).toBeUndefined();
  expect(await readSave()).toMatchObject(expected);
});
