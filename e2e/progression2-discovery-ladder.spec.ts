import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * Progression 2.0 W1 Integration I4b-5 (REC-04 OD-REC04-1..3): the Discovery Ladder Shop through
 * the real UI at 390x844 and 360x800 (Chromium and WebKit projects, playwright.config.ts).
 *
 * New save: starter trio -> Free Cooking Margherita -> NEW MATERIAL (egg) -> Shop -> egg NEW,
 * stock 0 -> first pack 60 Pitz -> stock 10 -> Free Cooking Bismarck -> next material (bacon).
 * Plus: discovered-recipe replay from Pizza Select, reload, existing EP4 save migration,
 * insufficient Pitz, refill and Full Game Reset.
 */

const SAVE_KEY = "teto-pizza-save-v1";
// FREE_COOK_BAKE_TARGET (src/data/freeCook.ts); its center (68) is inside Margherita's (60-80)
// and Bismarck's (55-75) own windows.
const FREE_COOK_BAKE_TARGET = { start: 58, end: 78 };

type Save = {
  pitzBalance: number;
  ownedIngredientIds: string[];
  inventory: Record<string, number>;
  unlockedForShopIngredientIds: string[];
  starterGrantClaimedRecipeIds: string[];
  dex: { recipeId: string; discovered: boolean }[];
};

const readSave = (page: Page): Promise<Save> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), SAVE_KEY);

async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${label}: no horizontal overflow`).toBeLessThanOrEqual(innerWidth);
}

/** A locator's box lies fully inside the viewport (after scrolling it into view if needed). */
async function expectFullyVisible(page: Page, selector: string, label: string) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, `${label}: rendered`).not.toBeNull();
  expect(box!.x, `${label}: left edge on-screen`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${label}: right edge on-screen`).toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y, `${label}: top edge on-screen`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${label}: bottom edge on-screen`).toBeLessThanOrEqual(vp.height + 1);
}

async function startFreeCook(page: Page) {
  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await page.waitForSelector(".pizza-stage");
}

/** Free-cooks tomato sauce + 3 mozzarella + the given toppings, bakes in the window, -> RESULT. */
async function cookPizza(page: Page, toppings: { name: RegExp; at: [number, number][] }[]) {
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
  for (const t of toppings) {
    await page.getByRole("button", { name: t.name }).click();
    for (const [x, y] of t.at) await tapDoughPercent(page, x, y);
  }
  await bakeToTarget(page, FREE_COOK_BAKE_TARGET);
  await page.waitForSelector(".result-panel");
}

const shopRow = (page: Page, id: string) => page.locator(`.shop-item[data-ingredient-id="${id}"]`);

async function openShopFromHome(page: Page) {
  await page.getByRole("button", { name: /ショップ/ }).click();
  await page.waitForSelector(".shop-overlay__panel");
}

async function closeShop(page: Page) {
  await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator(".shop-overlay__panel")).toHaveCount(0);
}

test.describe("Discovery Ladder Shop (I4b)", () => {
  test("new save: Margherita -> NEW MATERIAL -> Shop -> first pack -> Free Cooking Bismarck -> next material", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openHome(page);

    // Fresh save: the Shop lists nothing, only the discovery-based guidance.
    await openShopFromHome(page);
    await expect(page.locator(".shop-item")).toHaveCount(0);
    await expect(page.locator(".shop-overlay__progress")).toHaveText(/あと1つ発見で新しい材料が入荷/);
    await expect(page.locator(".shop-overlay__panel")).not.toContainText(/★|腕前|プレゼント/);
    await closeShop(page);

    // Free Cooking with the starter trio only.
    await startFreeCook(page);
    await cookPizza(page, [{ name: /バジル/, at: [[45, 60], [58, 42]] }]);
    await expect(page.locator(".discovered-banner--new-pizza")).toHaveText(/マルゲリータを発見しました！/);

    // NEW MATERIAL notice: names egg, not a gift, with a Shop CTA.
    const notice = page.locator(".material-unlock-notice");
    await expect(notice).toContainText("新しい材料が入荷：たまご");
    await expect(notice).not.toContainText(/プレゼント|無料|🎁/);
    await expectFullyVisible(page, ".material-unlock-notice__cta", "RESULT: ショップへ CTA");
    await expectNoHorizontalOverflow(page, "RESULT with NEW MATERIAL");
    const pitzAfterMargherita = (await readSave(page)).pitzBalance;
    expect(pitzAfterMargherita).toBeGreaterThanOrEqual(60);
    expect((await readSave(page)).unlockedForShopIngredientIds).toEqual(["egg"]);
    expect((await readSave(page)).inventory).toEqual({});

    // Shop from the notice: egg is NEW, stock 0, 10 pizzas (10), first pack 60.
    await page.locator(".material-unlock-notice__cta").click();
    await page.waitForSelector(".shop-overlay__panel");
    const egg = shopRow(page, "egg");
    await expect(egg).toHaveAttribute("data-shop-state", "NEW");
    await expect(egg).toContainText("NEW 入荷");
    await expect(egg).toContainText("在庫 0");
    await expect(egg).toContainText("10ピザ分（10個）");
    await expect(egg).toContainText(/初回 .*60 Pitz/);
    await expect(page.locator(".shop-item")).toHaveCount(1); // bacon etc. stay LOCKED and hidden
    await expect(page.locator(".shop-overlay__progress")).toHaveText(/あと1つ発見で新しい材料が入荷/);
    await expectFullyVisible(page, '.shop-item[data-ingredient-id="egg"] .shop-item__buy-button', "Shop: 仕入れる");
    await expectNoHorizontalOverflow(page, "Shop NEW");

    // First pack: -60 Pitz (the label), +10 stock.
    await egg.getByRole("button", { name: "仕入れる" }).click();
    await expect(egg).toHaveAttribute("data-shop-state", "OWNED");
    await expect(egg).toContainText("在庫 10");
    await expect(egg).toContainText(/補充 .*30 Pitz/);
    await expect(page.locator(".shop-overlay__feedback")).toContainText("たまごを仕入れました！");
    await expect(page.locator(".shop-overlay__balance")).toContainText(`${pitzAfterMargherita - 60} Pitz`);
    const afterBuy = await readSave(page);
    expect(afterBuy.pitzBalance).toBe(pitzAfterMargherita - 60);
    expect(afterBuy.inventory).toEqual({ egg: 10 });
    expect(afterBuy.ownedIngredientIds).toContain("egg");
    expect(afterBuy.starterGrantClaimedRecipeIds).toEqual([]); // EP4 retired: nothing granted

    // Close returns to the same RESULT.
    await closeShop(page);
    await expect(page.locator(".result-panel")).toBeVisible();

    // Free Cooking Bismarck with the bought egg.
    await page.getByRole("button", { name: "もう一度じゆうに作る" }).click();
    await cookPizza(page, [{ name: /たまご/, at: [[50, 50]] }]);
    await expect(page.locator(".discovered-banner--new-pizza")).toHaveText(/ビスマルクを発見しました！/);
    await expect(page.locator(".material-unlock-notice")).toContainText("新しい材料が入荷：ベーコン");
    const afterBismarck = await readSave(page);
    expect(afterBismarck.unlockedForShopIngredientIds).toEqual(["egg", "bacon"]);
    expect(afterBismarck.inventory.egg).toBe(9);
    expect(afterBismarck.inventory.bacon ?? 0).toBe(0);
    for (const v of Object.values(afterBismarck.inventory)) expect(v).toBeGreaterThanOrEqual(0);

    // Discovered recipe replay from Pizza Select (A2: Bismarck's EP1 predecessor marinara is
    // undiscovered, yet the discovered pizza is re-selectable).
    await page.getByRole("button", { name: /ホーム/ }).click();
    await page.getByRole("button", { name: /ピザを作る/ }).click();
    const bismarckCard = page.getByRole("button", { name: /^ビスマルク、/ });
    await expect(bismarckCard).not.toHaveAttribute("aria-label", /未解放/);
    await bismarckCard.click();
    await page.getByRole("button", { name: /このピザを作る/ }).click();
    await expect(page.locator(".order-card__recipe-name")).toHaveText(/ビスマルク/);

    // Reload: egg stays OWNED with its stock; bacon is NEW at 0.
    await page.reload();
    await page.waitForSelector(".app-frame");
    await openShopFromHome(page);
    await expect(shopRow(page, "egg")).toHaveAttribute("data-shop-state", "OWNED");
    await expect(shopRow(page, "egg")).toContainText("在庫 9");
    await expect(shopRow(page, "bacon")).toHaveAttribute("data-shop-state", "NEW");
    await expect(shopRow(page, "bacon")).toContainText("在庫 0");
    await expect(shopRow(page, "bacon")).toContainText("10ピザ分（30個）");
    await expectNoHorizontalOverflow(page, "Shop NEW + OWNED");
  });

  test("multi-material NEW MATERIAL notice (step 14, three cheeses): names whole, clear of the CTA, RESULT fits", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // 13 discoveries (all but Bismarck and Quattro Formaggi) + egg bought: Free Cooking Bismarck is
    // the 14th discovery, whose ladder step brings three materials at once -- the notice's widest
    // case (PR #227 post-fix delta; a leading "・" once glued the names into one unbreakable run).
    const all = [
      "margherita", "marinara", "genovese", "funghi", "fugazza", "salsiccia", "pepperoni", "napoletana",
      "tonno-e-cipolla", "pizza-bianca", "breakfast-pizza", "capricciosa", "meat-lovers",
    ];
    const save = {
      schemaVersion: 2,
      dex: all.map((recipeId) => ({ recipeId, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 })),
      pitzBalance: 100,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg"],
      missionBest: {},
      inventory: { egg: 10 },
      starterGrantClaimedRecipeIds: [],
    };
    await page.addInitScript(([key, raw]) => localStorage.setItem(key as string, JSON.stringify(raw)), [SAVE_KEY, save] as const);
    await openHome(page);
    await startFreeCook(page);
    await cookPizza(page, [{ name: /たまご/, at: [[50, 50]] }]);
    await expect(page.locator(".discovered-banner--new-pizza")).toHaveText(/ビスマルクを発見しました！/);
    const notice = page.locator(".material-unlock-notice__message");
    await expect(notice).toHaveText("\u{1F195} 新しい材料が入荷：フォンティーナ・ゴルゴンゾーラ・パルミジャーノ");
    const m = await page.evaluate(() => {
      const msg = document.querySelector(".material-unlock-notice__message")!;
      const cta = document.querySelector(".material-unlock-notice__cta")!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(msg);
      const gs = document.querySelector(".game-screen")!;
      return {
        // Line tops per name run; one line each means no name split.
        nameLines: Array.from(document.querySelectorAll(".material-unlock-notice__name")).map(
          (e) => new Set(Array.from(e.getClientRects()).map((r) => Math.round(r.top))).size,
        ),
        textRight: Math.max(...Array.from(range.getClientRects()).map((r) => r.right)),
        msgRight: msg.getBoundingClientRect().right,
        ctaLeft: cta.left,
        overflow: gs.scrollHeight - gs.clientHeight,
      };
    });
    expect(m.nameLines).toEqual([1, 1, 1]);
    expect(m.textRight, "notice text stays inside its box").toBeLessThanOrEqual(m.msgRight + 0.5);
    expect(m.textRight, "notice text never runs under the CTA").toBeLessThanOrEqual(m.ctaLeft);
    expect(m.overflow, "RESULT stays within its 1-screen budget").toBeLessThanOrEqual(0);
    await expectFullyVisible(page, ".material-unlock-notice__cta", "RESULT: ショップへ CTA (3 materials)");
    await expectNoHorizontalOverflow(page, "RESULT with a 3-material notice");
  });

  test("existing EP4 save: owned materials and stock kept, ladder materials become NEW at 0", async ({ page }) => {
    const legacy = {
      schemaVersion: 2,
      dex: [
        { recipeId: "margherita", discovered: true, bestScore: 80, bestStars: 4, timesMade: 4 },
        { recipeId: "funghi", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
        { recipeId: "marinara", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
      ],
      pitzBalance: 150,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "mushroom", "garlic", "oregano"],
      missionBest: {},
      inventory: { mushroom: 17, garlic: 3, oregano: 0 },
      starterGrantClaimedRecipeIds: ["funghi", "marinara"],
    };
    await page.addInitScript(
      ([key, save]) => {
        if (sessionStorage.getItem("__seeded")) return;
        sessionStorage.setItem("__seeded", "1");
        localStorage.setItem(key as string, JSON.stringify(save));
      },
      [SAVE_KEY, legacy] as const,
    );
    await openHome(page);
    await openShopFromHome(page);
    for (const [id, stock] of [["mushroom", 17], ["garlic", 3], ["oregano", 0]] as const) {
      await expect(shopRow(page, id)).toHaveAttribute("data-shop-state", "OWNED");
      await expect(shopRow(page, id)).toContainText(`在庫 ${stock}`);
    }
    for (const id of ["egg", "bacon"]) {
      await expect(shopRow(page, id)).toHaveAttribute("data-shop-state", "NEW");
      await expect(shopRow(page, id)).toContainText("在庫 0");
    }
    await expect(page.locator(".shop-item")).toHaveCount(5);
    const saved = await readSave(page);
    expect(saved.inventory).toEqual(legacy.inventory);
    expect(saved.starterGrantClaimedRecipeIds).toEqual(["funghi", "marinara"]);
    expect(saved.unlockedForShopIngredientIds).toEqual(["mushroom", "garlic", "oregano", "egg", "bacon"]);
    expect(saved.pitzBalance).toBe(150);
    await expectNoHorizontalOverflow(page, "Shop after migration");

    // Refill an owned material (mushroom: T1 step 3 -> 30 Pitz, +30).
    await shopRow(page, "mushroom").getByRole("button", { name: "補充する" }).click();
    await expect(shopRow(page, "mushroom")).toContainText("在庫 47");
    await expect(page.locator(".shop-overlay__balance")).toContainText("120 Pitz");
    expect((await readSave(page)).inventory.mushroom).toBe(47);
  });

  test("insufficient Pitz: the first pack is disabled with the shortfall shown", async ({ page }) => {
    const save = {
      schemaVersion: 2,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
      pitzBalance: 45,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
      missionBest: {},
      inventory: {},
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: ["egg"],
    };
    await page.addInitScript(([key, raw]) => localStorage.setItem(key as string, JSON.stringify(raw)), [SAVE_KEY, save] as const);
    await openHome(page);
    await openShopFromHome(page);
    const egg = shopRow(page, "egg");
    await expect(egg.getByRole("button", { name: "仕入れる" })).toBeDisabled();
    await expect(egg).toContainText("あと 15 Pitz たりません");
    await expectFullyVisible(page, '.shop-item[data-ingredient-id="egg"] .shop-item__shortfall', "shortfall line");
    expect((await readSave(page)).pitzBalance).toBe(45);
  });

  test("Full Game Reset clears the ledger, purchases and stock", async ({ page }) => {
    const save = {
      schemaVersion: 2,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
      pitzBalance: 40,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg"],
      missionBest: {},
      inventory: { egg: 10 },
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: ["egg"],
    };
    await page.addInitScript(
      ([key, raw]) => {
        if (sessionStorage.getItem("__seeded")) return;
        sessionStorage.setItem("__seeded", "1");
        localStorage.setItem(key as string, JSON.stringify(raw));
      },
      [SAVE_KEY, save] as const,
    );
    await openHome(page);
    await page.getByRole("button", { name: "設定" }).click();
    await page.getByRole("button", { name: "ゲームデータをリセット" }).click();
    await page.getByRole("button", { name: "最初からやり直す" }).click();
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".app-header__dex-pill")).toHaveText(/レシピ 0\//);
    await openShopFromHome(page);
    await expect(page.locator(".shop-item")).toHaveCount(0);
    await expect(page.locator(".shop-overlay__progress")).toHaveText(/あと1つ発見で新しい材料が入荷/);
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBeNull();
  });
});
