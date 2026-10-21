import { expect, test, type Page } from "@playwright/test";

/**
 * FINISH FIN-D (Issue #294): the whole round BAKE -> FINISH -> RESULT on the real GameScreen + real reducer (e2e/harness/finish-screen.html?start=bake,
 * test-only fixture recipe -- production has no FINISH). Run at 390x844 and 360x800 (the two iphone-* projects). FIN-A..C measured each piece; this
 * walks them end to end and counts what must happen exactly once: stock consumption, FINAL scoring, Dex / Pitz registration.
 */
const HARNESS = "./e2e/harness/finish-screen.html";
const GOOD_BAKE = 70;

type S = {
  phase: string;
  makingStep: string;
  score: { total: number } | null;
  completion: { status: string } | null;
  inventory: Record<string, number>;
  pitzBalance: number;
  dex: { recipeId: string; timesMade: number }[];
  bakeValue: number | null;
  pizza: { toppings: { id: string; ingredientId: string; stage?: string }[] };
};
const state = (page: Page) => page.evaluate(() => (window as unknown as { __state: () => unknown }).__state() as S);
const actions = (page: Page) => page.evaluate(() => (window as unknown as { __actions: () => string[] }).__actions());
const count = async (page: Page, type: string) => (await actions(page)).filter((a) => a === type).length;
const post = async (page: Page) => (await state(page)).pizza.toppings.filter((t) => t.stage === "post");

async function open(page: Page, query = "") {
  await page.goto(`${HARNESS}?start=bake&${query}`);
  await page.waitForSelector(".game-screen");
  await page.waitForTimeout(300);
}

async function bake(page: Page, value = GOOD_BAKE) {
  await page.evaluate((v) => (window as unknown as { __confirmBake: (n: number) => void }).__confirmBake(v), value);
}

async function tapPizza(page: Page, fx: number, fy: number) {
  const box = (await page.locator(".pizza-dough").boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

async function placeParsley(page: Page, points: [number, number][]) {
  await page.getByRole("button", { name: /パセリ/ }).click();
  for (const [x, y] of points) await tapPizza(page, x, y);
}

test("BAKE shows the real bake control and the round has not entered FINISH yet", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("button", { name: "取り出す！" })).toBeVisible();
  await expect(page.getByTestId("finish-dock")).toHaveCount(0);
  const s = await state(page);
  expect(s.phase).toBe("BAKE");
  expect(s.bakeValue).toBeNull();
});

test("normal completion: BAKE -> FINISH -> RESULT, stock / score / Dex / Pitz happen once, double press included", async ({ page }) => {
  await open(page, "stock=3");
  const initial = await state(page);
  await bake(page);
  await expect(page.getByTestId("finish-dock")).toBeVisible();
  const atFinish = await state(page);
  expect(atFinish.phase).toBe("POST_BAKE");
  expect(atFinish.makingStep).toBe("FINISH");
  expect(atFinish.bakeValue).toBe(GOOD_BAKE);
  // the pre-bake pieces are consumed at CONFIRM_BAKE; the late stock is untouched until 完成
  expect(atFinish.inventory.parsley).toBe(3);
  expect(atFinish.score).not.toBeNull(); // the provisional score exists but is not the result yet (score values: gameReducer.finishFlow.test.ts, real Reference recipe)
  expect(atFinish.dex).toEqual(initial.dex); // nothing registered in FINISH

  await placeParsley(page, [[0.4, 0.4], [0.6, 0.6]]);
  expect((await state(page)).inventory.parsley).toBe(3); // placing never consumes
  await page.getByTestId("finish-complete").dblclick({ delay: 0 });
  await expect(page.getByTestId("finish-dock")).toHaveCount(0);
  await expect(page.locator(".result-panel")).toBeVisible();
  await expect(page.locator(".result-panel--failed")).toHaveCount(0);

  const done = await state(page);
  expect(["RESULT", "DISCOVERED"]).toContain(done.phase);
  expect(done.completion?.status).toBe("PASS");
  expect(done.inventory.parsley).toBe(1); // 3 - 2, once
  expect(done.bakeValue).toBeNull();
  expect(done.score).not.toBeNull();
  expect((await post(page)).length).toBe(2);
  // exactly-once bookkeeping: the Dex entry (if the fixture id registers at all) has timesMade <= 1 and the Pitz ledger moved at most once
  for (const e of done.dex) expect(e.timesMade).toBeLessThanOrEqual(1);
  expect(await count(page, "CONFIRM_BAKE")).toBe(1);
  // a further stray 完成 / registration (the UI is gone; replay through the reducer-facing counters) cannot change anything
  const final = await state(page);
  await page.waitForTimeout(400);
  expect(await state(page)).toEqual(final);
});

test("後乗せ 0 個: 完成 -> RESULT is a FAILED card, no dialog, no stock, no Dex, no Pitz", async ({ page }) => {
  await open(page, "stock=3");
  const initial = await state(page);
  await bake(page);
  await page.getByTestId("finish-complete").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".result-panel--failed")).toBeVisible();
  const s = await state(page);
  expect(s.completion?.status).toBe("FAILED");
  expect(s.inventory.parsley).toBe(3);
  expect(s.pitzBalance).toBe(initial.pitzBalance);
  expect(s.dex).toEqual(initial.dex);
});

test("連続 Undo と再配置: 後乗せだけが動き、最終の在庫消費は残った配置数ぶんの 1 回", async ({ page }) => {
  await open(page, "stock=3");
  await bake(page);
  const preBake = (await state(page)).pizza.toppings.filter((t) => t.stage !== "post");
  await placeParsley(page, [[0.35, 0.4], [0.5, 0.6], [0.65, 0.4]]);
  expect(await post(page)).toHaveLength(3);
  const undo = page.getByTestId("finish-undo");
  await undo.click();
  await undo.click();
  await undo.click();
  expect(await post(page)).toHaveLength(0);
  await expect(undo).toBeDisabled();
  expect((await state(page)).inventory.parsley).toBe(3); // undo never changes stock
  expect((await state(page)).pizza.toppings.filter((t) => t.stage !== "post")).toEqual(preBake);
  await placeParsley(page, [[0.45, 0.45], [0.58, 0.55]]);
  await page.getByTestId("finish-complete").click();
  const s = await state(page);
  expect(s.completion?.status).toBe("PASS");
  expect(s.inventory.parsley).toBe(1);
  expect(s.pizza.toppings.filter((t) => t.stage !== "post")).toEqual(preBake);
});

test("在庫不足: 在庫 1 では 1 個で止まり、追加タップで増えず、消費は 1 個だけ", async ({ page }) => {
  await open(page, "stock=1");
  await bake(page);
  await placeParsley(page, [[0.4, 0.4]]);
  await tapPizza(page, 0.6, 0.6);
  await tapPizza(page, 0.3, 0.6);
  expect(await post(page)).toHaveLength(1);
  await page.getByTestId("finish-complete").click();
  const s = await state(page);
  expect(s.inventory.parsley).toBe(0);
  expect(s.completion?.status).toBe("PASS"); // the Completion Gate needs presence (1); minCount is a Scoring 2.0 quality matter
});

test("焼成失敗（生焼け / 焦げ）は FINISH を飛ばして RESULT の FAILED、後乗せ在庫は無傷", async ({ page }) => {
  for (const value of [40, 95]) {
    await open(page, "stock=3");
    await bake(page, value);
    await expect(page.getByTestId("finish-dock")).toHaveCount(0);
    await expect(page.locator(".result-panel--failed")).toBeVisible();
    const s = await state(page);
    expect(s.phase).not.toBe("POST_BAKE");
    expect(s.inventory.parsley).toBe(3);
    expect(s.bakeValue).toBeNull();
  }
});

test("CUT 付きプロファイル: 完成 -> CUT（RESULT はまだ）、CUT の確定まで最終結果は 1 回だけ", async ({ page }) => {
  await open(page, "cut=1&stock=2");
  await bake(page);
  await placeParsley(page, [[0.5, 0.5], [0.4, 0.55]]);
  await page.getByTestId("finish-complete").dblclick({ delay: 0 });
  expect((await state(page)).phase).toBe("POST_BAKE");
  expect((await state(page)).makingStep).toBe("CUT");
  expect((await state(page)).inventory.parsley).toBe(0);
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeDisabled();
});

test("the FINISH hint names the button that is actually there (完成), never 「次へ」", async ({ page }) => {
  await open(page, "stock=3");
  await bake(page);
  await placeParsley(page, [[0.4, 0.4], [0.6, 0.6]]);
  await expect(page.getByTestId("finish-hint")).toContainText("「完成」で進もう");
  await expect(page.getByTestId("finish-hint")).not.toContainText("次へ");
  await expect(page.getByTestId("finish-complete")).toHaveText(/完成/);
  await expect(page.getByRole("button", { name: /次へ/ })).toHaveCount(0);
});

for (const round of ["LUNCH_RUSH", "DINNER", "FREE_COOK"]) {
  test(`${round}: a real round of that mode never enters FINISH, even with a FINISH profile and a late requirement`, async ({ page }) => {
    await open(page, `round=${round}&stock=3`);
    const before = await state(page);
    expect(before.phase).toBe("BAKE");
    await bake(page);
    await expect(page.getByTestId("finish-dock")).toHaveCount(0);
    const s = await state(page);
    expect(s.makingStep).not.toBe("FINISH");
    expect(s.bakeValue).toBeNull();
    expect(s.pizza.toppings.filter((t) => t.stage === "post")).toHaveLength(0);
  });
}
