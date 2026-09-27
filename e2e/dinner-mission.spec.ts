import { expect, test } from "@playwright/test";
import { expectNoUndiscoveredIdentity } from "./support/antiSpoiler";
import { cookDinnerTarget, DM_A, dinnerSave, openDinnerDetail, openWithSave, readSave } from "./support/dinner";

/**
 * Dinner Mission DM-3 (Issue #242): the playable vertical slice on real browsers, at 390x844 and
 * 360x800 (both Chromium projects; WebKit in CI). Durations come from `?dinnerDuration=` -- the
 * DEV/Preview-only injection of OD-DM3-1 (the dev server is a DEV build).
 */

const RUN = "?dinnerDuration=900";

function noPageScroll(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    v: document.documentElement.scrollHeight <= window.innerHeight + 1,
    h: document.documentElement.scrollWidth <= window.innerWidth + 1,
  }));
}

test.describe("Dinner Mission DM-3", () => {
  test("1/2/32: HOME entry; with nothing unlocked, locked cards leak no target identity", async ({ page }) => {
    await openWithSave(page, dinnerSave(["margherita"]), RUN);
    const entry = page.getByRole("button", { name: /ディナーミッション/ });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText("発見で解放");
    expect(await noPageScroll(page)).toEqual({ v: true, h: true });
    await entry.click();
    const locked = page.locator(".dinner-mission-card--locked");
    await expect(locked).toHaveCount(2);
    await expect(locked.first()).toContainText("あと3種類のピザを発見すると解放");
    await expect(locked.nth(1)).toContainText("あと3種類のピザを発見すると解放");
    // Whole-DOM sweep (text + every attribute): no undiscovered recipe name / description / id.
    await expectNoUndiscoveredIdentity(page, ["margherita"], "Dinner Mission Select, all locked");
    // A locked card is not a button and opens nothing.
    await expect(page.locator(".dinner-mission-card--locked button")).toHaveCount(0);
    await expect(page.locator(".dinner-detail")).toHaveCount(0);
  });

  test("3/32: an unlocked mission names its targets; the other stays anonymous", async ({ page }) => {
    await openWithSave(page, dinnerSave([...DM_A]), RUN);
    await page.getByRole("button", { name: /ディナーミッション/ }).click();
    const open = page.locator("button.dinner-mission-card");
    await expect(open).toHaveCount(1);
    await expect(open).toContainText("マルゲリータ・ビスマルク・ブレックファストピザ・フンギ");
    await expect(page.locator(".dinner-mission-card--locked")).toContainText("あと2種類のピザを発見すると解放");
    await expectNoUndiscoveredIdentity(page, [...DM_A], "Dinner Mission Select, DM-A unlocked");
  });

  test("4: a shortage disables START, lists need / have, and offers the Shop", async ({ page }) => {
    await openWithSave(page, dinnerSave([...DM_A], { egg: 1 }), RUN);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await expect(page.getByRole("alert")).toContainText("材料が足りません");
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

  test("5-11/17/27/28/29/31: any order to CLEAR, completed targets locked, no Dex / Pitz change", async ({ page }) => {
    test.setTimeout(240_000);
    await openWithSave(page, dinnerSave([...DM_A]), RUN);
    const before = await readSave(page);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await expect(page.getByRole("status").first()).toContainText("材料はそろっています");
    await page.getByRole("button", { name: /スタート/ }).click();
    const board = page.locator(".dinner-board");
    await expect(board).toContainText("残り 4 / 4");
    // The normal ORDER screen never shows under Dinner (no dead 「ピザを作る！」).
    await expect(page.getByRole("button", { name: /ピザを作る！|フリープレイ/ })).toHaveCount(0);
    expect(await noPageScroll(page)).toEqual({ v: true, h: true });

    const order: [string, RegExp][] = [
      ["breakfast-pizza", /ブレックファストピザ/],
      ["margherita", /マルゲリータ/],
      ["funghi", /フンギ/],
      ["bismarck", /ビスマルク/],
    ];
    for (const [i, [id, name]] of order.entries()) {
      await cookDinnerTarget(page, id, name);
      if (i < order.length - 1) {
        await expect(page.locator(".dinner-target-result")).toContainText("完成！");
        // 31: a double tap on the CTA lands on the board once.
        await page.getByRole("button", { name: "ターゲット一覧へ" }).dblclick();
        await expect(board).toContainText(`残り ${3 - i} / 4`);
        await expect(page.locator(".dinner-board__item", { hasText: name })).toBeDisabled();
      }
    }
    const result = page.getByRole("dialog", { name: "ディナーミッション結果" });
    await expect(result).toContainText("DINNER CLEAR!");
    await expect(result).toContainText("4 / 4");
    await expect(result).toContainText("クリアタイム");

    const after = await readSave(page);
    expect(after.dex).toEqual(before.dex); // 27: no timesMade / bestScore / discovery
    expect(after.pitzBalance).toBe(before.pitzBalance); // 28: no FREE Pitz, no payout yet
    expect(after.inventory.egg).toBe(before.inventory.egg - 2); // real consumption stays

    // 20: retry is feasible (stock remains) and starts a fresh run.
    await result.getByRole("button", { name: "もう一度" }).click();
    await expect(board).toContainText("残り 4 / 4");
  });

  test("13/18/21/23: over-placing the last eggs -> INFEASIBLE; retry blocked; Shop after the run", async ({ page }) => {
    test.setTimeout(120_000);
    await openWithSave(page, dinnerSave([...DM_A], { egg: 2 }), RUN);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await cookDinnerTarget(page, "bismarck", /ビスマルク/, { extra: { chip: /たまご/, count: 1 } });
    const result = page.getByRole("dialog", { name: "ディナーミッション結果" });
    await expect(result).toContainText("材料が足りなくなりました");
    await expect(result).toContainText("1 / 4");
    await expect(result).toContainText("たまご 必要 1 / 所持 0");
    expect((await readSave(page)).inventory.egg).toBe(0); // 18: nothing restored
    await expect(result.getByRole("button", { name: "もう一度" })).toBeDisabled();
    await result.getByRole("button", { name: "ショップへ" }).click();
    await expect(page.getByRole("button", { name: /ディナーミッション/ })).toBeVisible(); // back on HOME
    await expect(page.locator(".shop-overlay__balance")).toBeVisible();
  });

  test("14: a quality-FAILED target with stock to spare stays open and can be cooked again", async ({ page }) => {
    test.setTimeout(120_000);
    await openWithSave(page, dinnerSave([...DM_A], { egg: 3 }), RUN);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await cookDinnerTarget(page, "bismarck", /ビスマルク/, { underbake: true });
    await expect(page.locator(".dinner-target-result")).toContainText("ビスマルクはもう一度作れます");
    await page.getByRole("button", { name: "ターゲット一覧へ" }).click();
    await expect(page.locator(".dinner-board")).toContainText("残り 4 / 4");
    await expect(page.locator(".dinner-board__item", { hasText: /ビスマルク/ })).toBeEnabled();
  });

  test("15: a quality-FAILED target that leaves the set short -> FAILED at once", async ({ page }) => {
    test.setTimeout(120_000);
    await openWithSave(page, dinnerSave([...DM_A], { egg: 2 }), RUN);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await cookDinnerTarget(page, "bismarck", /ビスマルク/, { underbake: true });
    const result = page.getByRole("dialog", { name: "ディナーミッション結果" });
    await expect(result).toContainText("材料が足りなくなりました");
    await expect(result).toContainText("0 / 4");
  });

  test("12: the clock reaching 0 -> 時間切れ", async ({ page }) => {
    await page.clock.install();
    await openWithSave(page, dinnerSave([...DM_A]), "?dinnerDuration=30");
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await expect(page.locator(".dinner-board__timer")).toContainText("00:30");
    await page.clock.fastForward(31_000);
    const result = page.getByRole("dialog", { name: "ディナーミッション結果" });
    await expect(result).toContainText("時間切れ！");
    await expect(result).toContainText("0 / 4");
    await result.getByRole("button", { name: /ホーム/ }).click();
    await expect(page.getByRole("button", { name: /ディナーミッション/ })).toBeVisible();
  });

  test("16/17/18/22: HOME asks in-app; 続ける keeps the run; やめる abandons and keeps consumption", async ({ page }) => {
    test.setTimeout(120_000);
    page.on("dialog", () => {
      throw new Error("browser confirm must not be used for Dinner");
    });
    await openWithSave(page, dinnerSave([...DM_A], { egg: 5 }), RUN);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await cookDinnerTarget(page, "bismarck", /ビスマルク/);
    await page.getByRole("button", { name: "ターゲット一覧へ" }).click();
    // 22: no Shop anywhere on the running screens.
    await expect(page.getByRole("button", { name: /ショップ/ })).toHaveCount(0);
    await page.getByRole("button", { name: /ホーム/ }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("ディナーミッションをやめますか？");
    await dialog.getByRole("button", { name: "続ける" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".dinner-board")).toContainText("残り 3 / 4");
    await page.getByRole("button", { name: /ホーム/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "やめる" }).click();
    await expect(page.getByRole("button", { name: /ディナーミッション/ })).toBeVisible();
    expect((await readSave(page)).inventory.egg).toBe(4);
  });

  test("19: a reload drops the run and lands on HOME, with no resume offer", async ({ page }) => {
    await openWithSave(page, dinnerSave([...DM_A]), RUN);
    await openDinnerDetail(page, /ディナーミッション 1/);
    await page.getByRole("button", { name: /スタート/ }).click();
    await expect(page.locator(".dinner-board")).toBeVisible();
    await page.reload();
    await page.waitForSelector(".app-frame");
    await expect(page.locator(".dinner-board")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ディナーミッション/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("再開");
  });
});
