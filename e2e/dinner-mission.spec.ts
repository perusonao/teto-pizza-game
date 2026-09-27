import { expect, test, type Page } from "@playwright/test";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { cookDinnerPizza, DM_A, dinnerSave, nextDinnerPizza, openDinnerDetail, openWithSave, readSave } from "./support/dinner";

/**
 * Dinner Mission DM-3 (Issue #242, ported from PR #243) / DM-3R-2 (Issue #250): the playable
 * recipe-free Dinner loop on real browsers, at 390x844 and 360x800 (both Chromium projects; WebKit
 * in CI). START lands straight on cooking; every finished pizza is judged by the DM-3R-1 result
 * detection; nothing is declared. Duration and S come from `?dinnerDuration=` / `?dinnerMinStars=`
 * -- the DEV/Preview-only injection (OD-DM3-1 / OD-R2; the dev server is a DEV build). S=1 keeps
 * the real-gesture target pizzas deterministic (their ★ depends on hand placement); S=5 forces the
 * quality gate.
 */

const RUN = "?dinnerDuration=900&dinnerMinStars=1";

function noPageScroll(page: Page) {
  return page.evaluate(() => ({
    v: document.documentElement.scrollHeight <= window.innerHeight + 1,
    h: document.documentElement.scrollWidth <= window.innerWidth + 1,
  }));
}

async function start(page: Page, save: unknown, query = RUN) {
  await openWithSave(page, save, query);
  await openDinnerDetail(page, /ディナーミッション 1/);
  await page.getByRole("button", { name: /スタート/ }).click();
  await expect(page.getByTestId("dinner-target-row")).toBeVisible();
}

const result = (page: Page) => page.getByTestId("dinner-attempt-result");
const overlay = (page: Page) => page.getByRole("dialog", { name: "ディナーミッション結果" });

test.describe("Dinner Mission DM-3R-2", () => {
  test("HOME entry; with nothing unlocked, locked cards leak no target identity", async ({ page }) => {
    await openWithSave(page, dinnerSave(["margherita"]), RUN);
    const entry = page.getByRole("button", { name: /ディナーミッション/ });
    await expect(entry).toContainText("発見で解放");
    expect(await noPageScroll(page)).toEqual({ v: true, h: true });
    await entry.click();
    const locked = page.locator(".dinner-mission-card--locked");
    await expect(locked).toHaveCount(2);
    await expectNoUndiscoveredIdentity(page, ["margherita"], "Dinner Mission Select, all locked");
    await expect(page.locator(".dinner-mission-card--locked button")).toHaveCount(0);
  });

  test("a shortage disables START, lists need / have, and offers the Shop", async ({ page }) => {
    await openWithSave(page, dinnerSave([...DM_A], { egg: 1 }), RUN);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await expect(page.getByRole("alert")).toContainText("たまご 必要 2 / 所持 1");
    await expect(page.getByRole("button", { name: /スタート/ })).toBeDisabled();
    await page.getByRole("button", { name: /ショップで補充する/ }).click();
    await expect(page.locator(".shop-overlay__balance")).toBeVisible();
  });

  test("OD-DM3-1: without an injected duration START stays disabled (制限時間を調整中)", async ({ page }) => {
    await openWithSave(page, dinnerSave([...DM_A]));
    await openDinnerDetail(page, /ディナーミッション 1/);
    await expect(page.locator(".dinner-detail")).toContainText("調整中");
    await expect(page.getByRole("button", { name: /スタート/ })).toBeDisabled();
  });

  test("R1/R27/R21/R22: START -> cooking with no declaration; a chip opens the reference only; no Shop / hint", async ({ page }) => {
    await start(page, dinnerSave([...DM_A]));
    const row = page.getByTestId("dinner-target-row");
    await expect(row).toContainText("0/4");
    await expect(page.locator(".dinner-board, .order-card")).toHaveCount(0); // no Target Board, no recipe card
    await expect(page.getByRole("button", { name: "ヒント" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ショップ/ })).toHaveCount(0);
    expect(await noPageScroll(page)).toEqual({ v: true, h: true });
    await page.getByTestId("dinner-chip-bismarck").click();
    const popover = page.getByRole("dialog", { name: /ビスマルクの見本/ });
    await expect(popover).toBeVisible();
    await popover.getByRole("button", { name: /閉じる/ }).click();
    await expect(popover).toHaveCount(0);
    // Looking at bismarck selected nothing: funghi made next is judged as funghi.
    await cookDinnerPizza(page, "funghi");
    await expect(result(page)).toHaveAttribute("data-category", "TARGET_PASS");
    await expect(result(page)).toContainText("フンギ完成！");
    await expect(page.getByTestId("dinner-hud")).toHaveCount(1);
  });

  test("R3/R4/R19/R23/R24: any order to CLEAR by detection alone; no Dex / Pitz change; retry", async ({ page }) => {
    test.setTimeout(300_000);
    await openWithSave(page, dinnerSave([...DM_A]), RUN);
    const before = await readSave(page);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    const order: [keyof typeof import("./support/dinner").PIZZAS, string][] = [
      ["breakfast-pizza", "ブレックファストピザ"],
      ["margherita", "マルゲリータ"],
      ["funghi", "フンギ"],
      ["bismarck", "ビスマルク"],
    ];
    for (const [i, [id, name]] of order.entries()) {
      await cookDinnerPizza(page, id);
      if (i < order.length - 1) {
        await expect(result(page)).toContainText(`${name}完成！`);
        await expect(result(page)).toContainText(`完成 ${i + 1} / 4`);
        // A double tap on the CTA lands on one fresh round.
        await page.getByRole("button", { name: /次のピザを作る/ }).dblclick();
        await expect(page.getByTestId(`dinner-chip-${id}`)).toHaveClass(/dinner-chip--done/);
        await expect(page.getByTestId("dinner-target-row")).toContainText(`${i + 1}/4`);
      }
    }
    await expect(overlay(page)).toContainText("DINNER CLEAR!");
    await expect(overlay(page)).toContainText("4 / 4");
    // OD-DUI-3a: the last pizza by name and ★, not a result headline.
    await expect(page.getByTestId("dinner-result-last")).toHaveText(new RegExp(`^最後のピザ：${order[order.length - 1][1]} ★[1-5]$`));
    const after = await readSave(page);
    expect(after.dex).toEqual(before.dex);
    expect(after.pitzBalance).toBe(before.pitzBalance);
    expect(after.inventory.egg).toBe(before.inventory.egg - 2);
    await overlay(page).getByRole("button", { name: "もう一度" }).click();
    await expect(page.getByTestId("dinner-target-row")).toContainText("0/4");
  });

  test("R6/R18: the same target twice -> DUPLICATE, then the shared egg is gone -> INFEASIBLE", async ({ page }) => {
    test.setTimeout(180_000);
    await start(page, dinnerSave([...DM_A], { egg: 2 }));
    await cookDinnerPizza(page, "bismarck");
    await expect(result(page)).toContainText("ビスマルク完成！");
    await nextDinnerPizza(page);
    await cookDinnerPizza(page, "bismarck");
    await expect(overlay(page)).toContainText("材料が足りなくなりました");
    await expect(overlay(page)).toContainText("最後のピザ：ビスマルク");
    await expect(overlay(page)).not.toContainText("これはもう完成済み！");
    await expect(overlay(page)).toContainText("たまご 必要 1 / 所持 0");
    expect((await readSave(page)).inventory.egg).toBe(0); // nothing refunded
    await expect(overlay(page).getByRole("button", { name: "もう一度" })).toBeDisabled();
  });

  test("R7/R8/R13: a discovered non-target is named; an undiscovered one is an anonymous ORIGINAL; no match has no CUT", async ({ page }) => {
    test.setTimeout(240_000);
    await start(page, dinnerSave([...DM_A, "marinara"]));
    await cookDinnerPizza(page, "marinara");
    await expect(result(page)).toHaveAttribute("data-category", "NON_TARGET");
    await expect(result(page)).toContainText("マリナーラができた！");
    await nextDinnerPizza(page);
    // OD-R6 / OD-R4: the undiscovered identity never reaches the DOM -- not while baking or
    // cutting (its window and CUT step are used, its name is not), not in the result.
    await cookDinnerPizza(page, "hawaiian", {
      onStep: async (step) => {
        if (step === "bake" || step === "cut") {
          await expectNoUndiscoveredIdentity(page, [...DM_A, "marinara"], `Dinner ${step} of an undiscovered recipe`);
        }
      },
    });
    await expect(result(page)).toHaveAttribute("data-category", "ORIGINAL");
    await expect(result(page)).toContainText("オリジナルピザ！");
    await expectNoUndiscoveredIdentity(page, [...DM_A, "marinara"], "Dinner ORIGINAL result (hawaiian undiscovered)");
    await nextDinnerPizza(page);
    await cookDinnerPizza(page, "funghi-egg"); // no CUT step expected by the helper
    await expect(result(page)).toHaveAttribute("data-category", "ORIGINAL");
    await expect(page.getByTestId("dinner-target-row")).toHaveCount(0);
    await expect(result(page)).toContainText("完成 0 / 4");
  });

  test("R5/R9: ★ below S -> QUALITY_FAIL; a raw pizza -> INVALID_PIZZA; the targets stay open", async ({ page }) => {
    test.setTimeout(180_000);
    await start(page, dinnerSave([...DM_A], { egg: 5 }), "?dinnerDuration=900&dinnerMinStars=5");
    await cookDinnerPizza(page, "bismarck");
    await expect(result(page)).toHaveAttribute("data-category", "QUALITY_FAIL");
    await expect(result(page)).toContainText("もう少し丁寧に作ろう");
    await expect(result(page)).toContainText("合格は★5以上");
    await expect(page.getByTestId("dinner-attempt-gap")).toHaveText(/^あと★[1-4]$/);
    await nextDinnerPizza(page);
    await cookDinnerPizza(page, "bismarck", { underbake: true });
    await expect(result(page)).toHaveAttribute("data-category", "INVALID_PIZZA");
    await expect(result(page)).toContainText("生焼け");
    // Issue #256: the bake failed the Completion Gate, so no CUT step came before the result.
    await expect(page.getByRole("button", { name: /切り終わる/ })).toHaveCount(0);
    await expect(result(page)).toContainText("完成 0 / 4");
    expect((await readSave(page)).inventory.egg).toBe(3);
  });

  test("#256: a burnt margherita (identified CUT recipe) gets INVALID_PIZZA at 取り出す, with no CUT", async ({ page }) => {
    test.setTimeout(120_000);
    await start(page, dinnerSave([...DM_A]));
    await cookDinnerPizza(page, "margherita", { overbake: true });
    await expect(result(page)).toHaveAttribute("data-category", "INVALID_PIZZA");
    await expect(result(page)).toContainText("焦げてしまいました");
    await expect(page.getByRole("button", { name: /切り終わる/ })).toHaveCount(0);
    await expect(result(page)).toContainText("完成 0 / 4");
    // Not stuck: the next pizza starts.
    await nextDinnerPizza(page);
  });

  test("R20: the clock reaching 0 -> 時間切れ", async ({ page }) => {
    await page.clock.install();
    await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=30");
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await expect(page.getByTestId("dinner-hud")).toContainText("00:30");
    await page.clock.fastForward(31_000);
    await expect(overlay(page)).toContainText("時間切れ！");
    await expect(overlay(page)).toContainText("0 / 4");
    await overlay(page).getByRole("button", { name: /ホーム/ }).click();
    await expect(page.getByRole("button", { name: /ディナーミッション/ })).toBeVisible();
  });

  test("R26: HOME asks in-app; 続ける keeps the run; やめる abandons and keeps consumption", async ({ page }) => {
    test.setTimeout(120_000);
    page.on("dialog", () => {
      throw new Error("browser confirm must not be used for Dinner");
    });
    await start(page, dinnerSave([...DM_A], { egg: 5 }));
    await cookDinnerPizza(page, "bismarck");
    await nextDinnerPizza(page);
    await page.getByRole("button", { name: /ホーム/ }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("ディナーミッションをやめますか？");
    await dialog.getByRole("button", { name: "続ける" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("dinner-target-row")).toContainText("1/4");
    await page.getByRole("button", { name: /ホーム/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "やめる" }).click();
    await expect(page.getByRole("button", { name: /ディナーミッション/ })).toBeVisible();
    expect((await readSave(page)).inventory.egg).toBe(4);
  });

  test("R25: a reload drops the run and lands on HOME, with no resume offer", async ({ page }) => {
    await start(page, dinnerSave([...DM_A]));
    await page.reload();
    await page.waitForSelector(".app-frame");
    await expect(page.getByTestId("dinner-target-row")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ディナーミッション/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("再開");
  });
});
