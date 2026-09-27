import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Dinner DM-5-1 Human Timing — environment check (docs/data/tools only; NOT part of any test suite).
 *
 * Runs through ./playwright.check.config.ts against two local static builds of the SAME source
 * commit (see the config for the build commands):
 *   - /teto-pizza-game-preview/  the Preview build (VITE_PREVIEW_MODE=1) + dm5-timing.html
 *   - /teto-pizza-game/          the production build (no preview env)
 * It verifies, without touching the game source:
 *   E1  the helper seeds the Preview save only (never the production key) and can restore it
 *   E2  DM-A / DM-B open with the baseline 320 s / 355 s and ★3 through the helper's links
 *   E3  the beginner-only auxiliary 900 s link works and is labelled separately
 *   E4  the production build ignores ?dinnerDuration / ?dinnerMinStars (START stays closed)
 *   E5  the recorder's CSV has exactly the template columns and the summary tool accepts it
 *       (synthetic typed-in numbers — the file it writes is a pipeline check, not measurement data)
 */

const OUT = process.env.DM5_CHECK_OUT ?? "dm5-check";
const PREVIEW = "/teto-pizza-game-preview/";
const PREVIEW_SAVE = "teto-pizza-preview-save-v1";
const PROD_SAVE = "teto-pizza-save-v1";
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function shot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
}

async function openHelper(page: Page) {
  await page.goto(`${PREVIEW}dm5-timing.html`);
  await expect(page.getByRole("heading", { name: /Dinner 人の実測/ })).toBeVisible();
}

async function detail(page: Page, mission: RegExp) {
  await page.getByRole("button", { name: /ディナーミッション/ }).first().click();
  await page.locator(".dinner-mission-card", { hasText: mission }).click();
  await expect(page.locator(".dinner-detail")).toBeVisible();
}

test.describe("DM-5-1 Human Timing environment", () => {
  test("E1 + E2 + E3: seed, baseline DM-A 320 s / DM-B 355 s with ★3, auxiliary 900 s", async ({ page }) => {
    await openHelper(page);
    await page.evaluate(([p, k]) => { localStorage.clear(); localStorage.setItem(p, "{\"sentinel\":1}"); localStorage.setItem(k, "prod-untouched"); }, [PREVIEW_SAVE, PROD_SAVE]);
    await shot(page, "01-helper-top");
    await page.getByRole("button", { name: /テスト用セーブを入れる/ }).click();
    await expect(page.getByRole("status").first()).toContainText("テスト用セーブを入れました");
    const seeded = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), PREVIEW_SAVE);
    expect(seeded.dex.map((d: { recipeId: string }) => d.recipeId).sort()).toEqual(
      ["bismarck", "breakfast-pizza", "funghi", "margherita", "melanzane-pizza", "parmigiana-pizza"],
    );
    expect(await page.evaluate((k) => localStorage.getItem(k), PROD_SAVE)).toBe("prod-untouched");

    const cases = [
      { link: /^DM-A: ディナーミッション 1/, mission: /ディナーミッション 1/, clock: "5:20", query: "?dinnerDuration=320&dinnerMinStars=3" },
      { link: /^DM-B: ディナーミッション 2/, mission: /ディナーミッション 2/, clock: "5:55", query: "?dinnerDuration=355&dinnerMinStars=3" },
      { link: /補助 DM-A/, mission: /ディナーミッション 1/, clock: "15:00", query: "?dinnerDuration=900&dinnerMinStars=3" },
      { link: /補助 DM-B/, mission: /ディナーミッション 2/, clock: "15:00", query: "?dinnerDuration=900&dinnerMinStars=3" },
    ];
    for (const [i, c] of cases.entries()) {
      await openHelper(page);
      await page.getByRole("link", { name: c.link }).click();
      await page.waitForSelector(".app-frame");
      expect(new URL(page.url()).search).toBe(c.query);
      await detail(page, c.mission);
      await expect(page.locator(".dinner-detail__row").filter({ hasText: "制限時間" })).toContainText(c.clock);
      await expect(page.locator(".dinner-detail__row").filter({ hasText: "合格ライン" })).toContainText("★3 以上");
      if (i < 2) await shot(page, `0${i + 2}-detail-${c.clock.replace(":", "")}`);
      await page.getByRole("button", { name: /スタート/ }).click();
      await expect(page.getByTestId("dinner-target-row")).toBeVisible();
      await expect(page.getByText(/⏱/).first()).toContainText(/\d+:\d\d/);
      if (i < 2) await shot(page, `0${i + 4}-playing-${c.clock.replace(":", "")}`);
      // The helper pre-selects the run it opened.
      await openHelper(page);
      await expect(page.locator("#mission button[aria-pressed=true]")).toHaveAttribute("data-v", i % 2 ? "dm-b" : "dm-a");
      await expect(page.locator("#duration button[aria-pressed=true]")).toHaveAttribute("data-v", c.clock === "15:00" ? "900" : c.clock === "5:20" ? "320" : "355");
      await expect(page.locator("#cond")).toContainText(c.clock === "15:00" ? "補助（正式サンプルではない）" : "正式サンプル");
    }

    // Restore puts the pre-measurement Preview save back.
    await page.getByRole("button", { name: /測定前の Preview セーブに戻す/ }).click();
    expect(await page.evaluate((k) => localStorage.getItem(k), PREVIEW_SAVE)).toBe("{\"sentinel\":1}");
    expect(await page.evaluate((k) => localStorage.getItem(k), PROD_SAVE)).toBe("prod-untouched");
  });

  test("E4: the production build ignores the Preview-only parameters", async ({ page }) => {
    await page.goto("/teto-pizza-game/icons/icon-16.png");
    await page.evaluate((k) => {
      localStorage.clear();
      const FINITE = ["parmigiano", "egg", "mushroom", "bacon", "eggplant"];
      localStorage.setItem(k, JSON.stringify({
        schemaVersion: 2,
        dex: ["margherita", "bismarck", "breakfast-pizza", "funghi"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
        pitzBalance: 500, ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...FINITE], missionBest: {},
        inventory: Object.fromEntries(FINITE.map((m) => [m, 30])), starterGrantClaimedRecipeIds: [], unlockedForShopIngredientIds: FINITE,
      }));
    }, PROD_SAVE);
    await page.goto("/teto-pizza-game/?dinnerDuration=320&dinnerMinStars=3");
    await page.waitForSelector(".app-frame");
    await detail(page, /ディナーミッション 1/);
    await expect(page.locator(".dinner-detail__row").filter({ hasText: "制限時間" })).toContainText("調整中");
    await expect(page.getByRole("button", { name: /スタート/ })).toBeDisabled();
  });

  test("E5: recorder CSV = template columns, and the summary tool accepts it", async ({ page }) => {
    await openHelper(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator("#tester").fill("SYNTH");
    const typeRun = async (o: { mission: string; dur: string; outcome: string; clear?: string; pizzas: [string, string, string, string][]; profile?: string }) => {
      if (o.profile) await page.locator("#profile").selectOption(o.profile);
      await page.locator(`#mission button[data-v="${o.mission}"]`).click();
      await page.locator(`#duration button[data-v="${o.dur}"]`).click();
      await page.locator(`#outcome button[data-v="${o.outcome}"]`).click();
      if (o.clear) await page.locator("#clear").fill(o.clear);
      for (const [i, [rem, cat, stars, recipe]] of o.pizzas.entries()) {
        if (i > 0) await page.getByRole("button", { name: /ピザを追加/ }).click();
        const card = page.locator(".pizza").nth(i);
        await card.locator(".rem").fill(rem);
        await card.locator(".cat").selectOption(cat);
        await card.locator(".stars").selectOption(stars);
        await card.locator(".recipe").selectOption(recipe);
      }
      await page.locator("#notes").fill("synthetic pipeline check, not measurement data");
      await page.getByRole("button", { name: /この run を保存/ }).click();
      await expect(page.locator("#formErr")).toHaveText("");
    };
    // DM-A CLEAR with one QUALITY_FAIL retake; last pizza's ⏱ left empty (derived from the clear time).
    await typeRun({ mission: "dm-a", dur: "320", outcome: "CLEAR", clear: "4:10", pizzas: [
      ["4:40", "TARGET_PASS", "4", "funghi"], ["4:02", "QUALITY_FAIL", "2", "bismarck"], ["3:20", "TARGET_PASS", "3", "bismarck"],
      ["2:05", "TARGET_PASS", "3", "margherita"], ["", "TARGET_PASS", "", "breakfast-pizza"]] });
    await typeRun({ mission: "dm-b", dur: "355", outcome: "TIME_UP", pizzas: [["4:30", "TARGET_PASS", "3", "margherita"], ["1:10", "INVALID_PIZZA", "", ""]] });
    // The form refuses an off-protocol pairing and a non-beginner on the auxiliary condition.
    await page.locator(`#mission button[data-v="dm-a"]`).click();
    await page.locator(`#duration button[data-v="355"]`).click();
    await expect(page.locator("#cond")).toContainText("手順外");
    await page.locator(`#duration button[data-v="900"]`).click();
    await page.locator(`#outcome button[data-v="TIME_UP"]`).click();
    await page.locator(".pizza .rem").first().fill("10:00");
    await page.getByRole("button", { name: /この run を保存/ }).click();
    await expect(page.locator("#formErr")).toContainText("900 秒（補助）は beginner だけです");
    await typeRun({ mission: "dm-a", dur: "900", outcome: "CLEAR", clear: "7:30", profile: "beginner", pizzas: [
      ["13:00", "TARGET_PASS", "3", "margherita"], ["11:00", "TARGET_PASS", "3", "funghi"], ["9:30", "TARGET_PASS", "4", "bismarck"], ["", "TARGET_PASS", "", "breakfast-pizza"]] });
    await expect(page.locator("#count")).toContainText("3 run（正式 2 / 補助 1）");
    await page.locator("#share").scrollIntoViewIfNeeded();
    await shot(page, "06-recorder-saved");

    const bundle = await page.locator("#csv").inputValue();
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, "SYNTHETIC-recorder-bundle.txt"), bundle);
    const lines = bundle.split("\n");
    const tmpl = (n: string) => readFileSync(join(REPO, `docs/reports/data/TETO_DINNER-MISSION_DM5_human-timing_${n}.template.csv`), "utf8").trim();
    expect(lines[1]).toBe(tmpl("runs"));
    expect(lines[lines.indexOf("# pizzas.csv") + 1]).toBe(tmpl("pizzas"));

    const summary = JSON.parse(execFileSync("python3", [join(REPO, "tools/dinner-dm5/dm5_human_timing_summary.py"), "--strict",
      "--bundle", join(OUT, "SYNTHETIC-recorder-bundle.txt"), "--split-to", join(OUT, "SYNTHETIC-sheets")], { encoding: "utf8" }));
    writeFileSync(join(OUT, "SYNTHETIC-summary.json"), JSON.stringify(summary, null, 1));
    expect(summary.problems).toEqual([]);
    const [clear, timeUp, aux] = summary.runs;
    expect(clear).toMatchObject({ run_id: "SYNTH-dm-a-320-1", condition: "BASELINE", clearS: 250, qualityFailCount: 1, pizzaRetakes: 1,
      pizzaSeconds: [40, 38, 42, 75, 55], completionOrder: ["funghi", "bismarck", "margherita", "breakfast-pizza"] });
    expect(timeUp).toMatchObject({ condition: "BASELINE", outcome: "TIME_UP", timeUp: true });
    expect(aux).toMatchObject({ run_id: "SYNTH-dm-a-900-1", condition: "AUX_900", clearS: 450, pizzaSeconds: [120, 120, 90, 120] });
    expect(summary.missions["dm-a"].perProfile.beginner.runs).toBe(0); // the 900 s run is not a balance sample
    expect(summary.supplemental900["dm-a"]).toMatchObject({ runs: 1, wouldTimeUpAtBaselineShare: 1 });
  });
});
