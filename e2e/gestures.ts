import type { Page } from "@playwright/test";

/**
 * Real-mouse (not synthetic PointerEvent dispatch) gesture helpers for driving a FREE round
 * through PizzaStage in a real browser. Mirrors src/App.test.tsx's own jsdom `fireEvent`-based
 * helpers (`completeDoughStep`/`selectAndTapPizza`/`paintSauceRing`/`completeCutStepIfPresent`)
 * but drives them via `page.mouse` at the dough element's *real* `boundingBox()` instead of a
 * mocked `getBoundingClientRect` + dispatched `PointerEvent` -- real Chromium's
 * `setPointerCapture` throws for a pointerId that was never associated with a live input
 * device, which a hand-rolled synthetic pointer session hits but a real mouse session never
 * does (see docs/reports/TETO_VIEWPORT-1SCREEN_Result.md's own audit notes on this).
 */

/** `BakeOverlay`'s own needle speed (`src/components/BakeOverlay.tsx`'s `SPEED` constant,
 *  percent per second) -- the one real-time fact `bakeToTarget` below needs to convert a target
 *  needle position into a virtual-clock duration. */
const BAKE_NEEDLE_SPEED_PCT_PER_S = 55;

/**
 * Pizza Cutting 1.0 Phase 4B: clicks 焼く, drives `BakeOverlay`'s needle to the exact center of
 * `target` using Playwright's `page.clock` (fakes `requestAnimationFrame`/`performance.now()`
 * for the whole page -- the same real-browser mechanism `src/App.test.tsx`'s jsdom-only
 * `controlBakeNeedle` helper approximates by stubbing rAF directly), then confirms with 取り出す！
 * and resumes real time before returning.
 *
 * Two earlier, real-time-based approaches were tried and both failed real WebKit CI: (1) a fixed
 * `waitForTimeout` tuned against one recipe's own midpoint drifted under CI load/parallelism for
 * every other recipe's differently-positioned target; (2) polling the live `.bake-gauge__needle`
 * DOM style for "inside/near-center of the target" and then clicking still failed under simulated
 * CI load (verified locally via CDP `Emulation.setCPUThrottlingRate` + artificial click latency,
 * reproducing the exact same "焦げすぎて提供できません" OVERBAKED failure) -- `BakeOverlay`'s own
 * tick loop computes `dt` from real `performance.now()` deltas between animation frames
 * (`src/components/BakeOverlay.tsx`), so under a throttled/loaded runner a single delayed frame
 * can jump the needle by a large, unpredictable amount, which no amount of polling margin or
 * `{ force: true }` click-latency reduction can reliably outrun. Faking the clock removes the
 * race entirely: `runFor` deterministically fires exactly the tick(s) needed to reach the target
 * duration, regardless of how slow or loaded the real host is.
 */
export async function bakeToTarget(page: Page, target: { start: number; end: number }) {
  const center = (target.start + target.end) / 2;
  const durationMs = Math.round((center / BAKE_NEEDLE_SPEED_PCT_PER_S) * 1000);
  await page.clock.install();
  await page.getByRole("button", { name: /焼く/ }).click();
  // Wait (real time -- BakeOverlay's mount/effect registration is unaffected by the fake clock,
  // only Date/rAF/performance.now() are faked) for BakeOverlay's own first render before
  // advancing virtual time -- otherwise a slow/throttled runner could still be mid-mount when
  // `runFor` fires, so its first `requestAnimationFrame(tick)` registration would only happen
  // *after* the virtual-time advance already completed, landing the needle back near 0 instead
  // of at the intended target.
  await page.waitForSelector(".bake-gauge__needle");
  await page.clock.runFor(durationMs);
  await page.getByRole("button", { name: "取り出す！" }).click();
  await page.clock.resume();
}

async function doughBox(page: Page) {
  const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
  if (!box) throw new Error("Pizza dough missing");
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, r: box.width * 0.46, box };
}

export async function tapDoughPercent(page: Page, xPercent: number, yPercent: number) {
  const { box } = await doughBox(page);
  const x = box.x + (xPercent / 100) * box.width;
  const y = box.y + (yPercent / 100) * box.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

export async function completeDoughStep(page: Page) {
  const { cx, cy, r } = await doughBox(page);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    await page.mouse.down();
    await page.mouse.up();
  }
}

export async function paintSauceRing(page: Page, radiusPercent: number, count: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    await tapDoughPercent(page, 50 + Math.cos(angle) * radiusPercent, 50 + Math.sin(angle) * radiusPercent);
  }
}

/**
 * PR-A (Issue #167 §7/Merge Gate follow-up): a real physical-drag mouse gesture -- pointerdown
 * on a tray chip, move past the drag-intent threshold (src/logic/pieceDrag.ts,
 * PIECE_DRAG_THRESHOLD_PX), then glide to a dough-percent target and release to commit the drop.
 * Used by the short-viewport regression (e2e/making-ui-1screen.spec.ts) to confirm pointer/drop
 * coordinates stay correct once PizzaStage's own height-aware `min()` term (App.css) actually
 * shrinks the dough below its `vw`/px caps, not just at the two shipped 390x844/360x800
 * viewports where that term never binds.
 */
export async function physicalDragToDough(
  page: Page,
  chipNameRegex: RegExp,
  xPercent: number,
  yPercent: number,
) {
  const chip = page.getByRole("button", { name: chipNameRegex });
  const chipBox = await chip.boundingBox();
  if (!chipBox) throw new Error("Draggable chip missing");
  const startX = chipBox.x + chipBox.width / 2;
  const startY = chipBox.y + chipBox.height / 2;
  const { box } = await doughBox(page);
  const targetX = box.x + (xPercent / 100) * box.width;
  const targetY = box.y + (yPercent / 100) * box.height;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 2, startY - 10, { steps: 3 });
  const steps = 10;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await page.mouse.move(startX + (targetX - startX) * t, startY - 10 + (targetY - (startY - 10)) * t);
  }
  await page.mouse.up();
}

export async function cutThreeLines(page: Page) {
  const { cx, cy, r } = await doughBox(page);
  for (const angleDeg of [0, 60, 120]) {
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
    await page.mouse.move(cx - dx, cy - dy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
    await page.mouse.up();
  }
}

/** Fresh HOME -> Pizza Select -> margherita (the only unlockCondition-free recipe) -> PREPARE. */
export async function startFreshMargherita(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
}

/** Drives a full margherita round (DOUGH -> SAUCE -> CHEESE -> TOPPING -> BAKE -> CUT) from
 *  PREPARE/DOUGH through to RESULT. Real time bake wait (no RAF stub -- this is a real browser
 *  run, not jsdom), matching BakeOverlay's own ~55%/s needle speed. */
export async function playFullMargheritaRound(page: Page) {
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

  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "取り出す！" }).click();

  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
}

/**
 * Gameplay UX Phase 1 (材料選択スクロール解消, docs/reports/TETO_GAMEPLAY-UX_4ITEMS_Fresh-Audit.md
 * sec.1.2's own "ケースB" fixture): a real, mid-game Save v2 state that owns enough
 * same-category ingredients to make quattro-formaggi available and to reproduce the "おすすめ +
 * その他" stacking overflow the Fresh Audit measured (SAUCE: おすすめ1 + その他2; TOPPING: その他6,
 * exactly MAX_INGREDIENT_PALETTE_SLOTS). Chosen to arise from the game's own real chain-unlock
 * rule (`isRecipeAvailable`, src/state/progression.ts) rather than an arbitrary owned-id list:
 * margherita -> funghi -> marinara -> bismarck -> genovese -> quattro-formaggi, each discovered
 * recipe's own Starter Grant ingredient included in `ownedIngredientIds`/`inventory` (mirrors
 * what a real player who reached quattro-formaggi organically would own). Written directly to
 * localStorage (Save v2 schema, see src/state/persistence.ts) rather than played through, since
 * driving 5 full rounds just to reach this state is unrelated to what this fixture exists to
 * test (PREPARE layout, not progression).
 */
export async function startQuattroFormaggiHeavyInventory(page: Page) {
  const save = {
    schemaVersion: 2,
    dex: ["margherita", "funghi", "marinara", "bismarck", "genovese"].map((recipeId) => ({
      recipeId,
      discovered: true,
      bestScore: 70,
      bestStars: 3,
      timesMade: 1,
    })),
    pitzBalance: 500,
    ownedIngredientIds: [
      "olive-oil",
      "gorgonzola",
      "parmigiano",
      "fontina",
      "garlic",
      "oregano",
      "pesto",
      "cherry-tomato",
      "egg",
      "mushroom",
    ],
    missionBest: {},
    inventory: {
      "olive-oil": 99,
      gorgonzola: 99,
      parmigiano: 99,
      fontina: 99,
      garlic: 99,
      oregano: 99,
      pesto: 99,
      "cherry-tomato": 99,
      egg: 99,
      mushroom: 99,
    },
    starterGrantClaimedRecipeIds: ["margherita", "funghi", "marinara", "bismarck", "genovese"],
  };

  // Issue #167 PR-C (Verification Hardening): seed localStorage via an init script rather than
  // goto -> evaluate(setItem) -> reload. This repo's own new WebKit CI job (added by this PR)
  // reproducibly showed the old pattern racing against WebKit's own reload/storage-flush timing
  // -- `loadSave()` (src/state/persistence.ts, plain synchronous localStorage.getItem/JSON.parse,
  // no browser-conditional code at all) read back a fresh/empty save instead of this fixture's
  // own data, so quattro-formaggi rendered LOCKED (its own real `unlockCondition` unmet by an
  // empty dex) and its detail CTA stayed disabled for this test's full 30s timeout. Confirmed
  // WebKit-only test-harness timing, not a production bug (same deterministic pure-JS card-state
  // derivation runs identically on every engine once it actually receives this fixture's data) --
  // out of Issue #167 PR-C §12's own scope guard for recipe-unlock production code either way.
  // `page.addInitScript` has no such race: Playwright guarantees it runs before any of the page's
  // own scripts on every navigation this page makes, in every engine, so no `reload()` round trip
  // (or its own timing) is involved at all. A fresh Playwright browser context already starts
  // with empty storage, so no explicit `localStorage.clear()` is needed either.
  await page.addInitScript((rawSave) => {
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(rawSave));
  }, save);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /クアトロ/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await page.waitForSelector(".pizza-stage");
}

/**
 * Issue #167 PR-C (Verification Hardening): a synthetic save that satisfies サルシッチャ's own
 * chain unlock (`unlockCondition: { requiresRecipeId: "fugazza", minTotalStars: 15 }`,
 * src/data/recipes.ts) directly via localStorage, the same "write the save, don't play 5+ full
 * rounds to reach it" approach `startQuattroFormaggiHeavyInventory` above already uses. Three
 * discovered dex entries at bestStars 5 sum to exactly the required 15 totalStars
 * (src/logic/mastery.ts); `fugazza` itself must be one of them (`isDiscovered` gate). Ownership
 * is set directly to サルシッチャ's own three `requiredIngredients` (tomato-sauce/mozzarella are
 * Starter, always owned regardless; sausage is not, so it must be both in `ownedIngredientIds`
 * and given inventory headroom) -- `isRecipeAvailable` only checks ownership of the *target*
 * recipe's ingredients, not any ingredient belonging to the unlock-chain recipes.
 *
 * Salsiccia matters specifically for Reference Truth (PR-B) regression coverage: it is the
 * recipe the user originally reported the 見本/PizzaStage divergence on (Issue #167 background),
 * so PR-C's own WebKit Reference-modal verification must cover it, not just Margherita.
 *
 * Seeds localStorage via `page.addInitScript`, not goto -> evaluate(setItem) -> reload -- see
 * `startQuattroFormaggiHeavyInventory` above's own comment for why the latter is not WebKit-safe.
 */
/**
 * Pizza Cutting 1.0 Phase 4B (Full Recipe Expansion): a synthetic save satisfying capricciosa's
 * own deep chain unlock (`unlockCondition: { requiresRecipeId: "breakfast-pizza",
 * minTotalStars: 33 }`, src/data/recipes.ts) directly via localStorage -- the full
 * margherita -> funghi -> marinara -> bismarck -> genovese -> quattro-formaggi -> fugazza ->
 * salsiccia -> pepperoni -> napoletana -> tonno-e-cipolla -> pizza-bianca -> breakfast-pizza
 * chain (13 recipes), each discovered at bestStars 3 (39 total, clears the 33 floor). Chosen as
 * the E2E "topping-heavy" scenario fixture (5 non-sauce ingredient types / 8 total pieces,
 * PIECE_RING_POSITIONS' own shared ceiling, matching quattro-formaggi/meat-lovers) per the
 * Phase 4B task brief's own suggestion. `ownedIngredientIds`/`inventory` cover exactly
 * capricciosa's own `requiredIngredients` beyond the two Starter ones (tomato-sauce/mozzarella,
 * always owned): mushroom/oregano/ham/black-olive.
 */
export async function startCapricciosaUnlocked(page: Page) {
  const chain = [
    "margherita",
    "funghi",
    "marinara",
    "bismarck",
    "genovese",
    "quattro-formaggi",
    "fugazza",
    "salsiccia",
    "pepperoni",
    "napoletana",
    "tonno-e-cipolla",
    "pizza-bianca",
    "breakfast-pizza",
  ];
  const save = {
    schemaVersion: 2,
    dex: chain.map((recipeId) => ({
      recipeId,
      discovered: true,
      bestScore: 70,
      bestStars: 3,
      timesMade: 1,
    })),
    pitzBalance: 500,
    ownedIngredientIds: ["mushroom", "oregano", "ham", "black-olive"],
    missionBest: {},
    inventory: { mushroom: 99, oregano: 99, ham: 99, "black-olive": 99 },
    starterGrantClaimedRecipeIds: chain,
  };

  await page.addInitScript((rawSave) => {
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(rawSave));
  }, save);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /カプリチョーザ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await page.waitForSelector(".pizza-stage");
}

/** Drives a full capricciosa round (topping-heavy: mozzarella + mushroom/oregano/ham/
 *  black-olive, 8 total non-sauce pieces) from PREPARE/DOUGH through to RESULT, real UI
 *  gestures throughout, mirroring `playFullMargheritaRound`'s own shape. */
export async function playFullCapricciosaRound(page: Page) {
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

  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "取り出す！" }).click();

  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
}

export async function startSalsicciaUnlocked(page: Page) {
  const save = {
    schemaVersion: 2,
    dex: ["margherita", "funghi", "fugazza"].map((recipeId) => ({
      recipeId,
      discovered: true,
      bestScore: 90,
      bestStars: 5,
      timesMade: 1,
    })),
    pitzBalance: 500,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "sausage"],
    missionBest: {},
    inventory: { sausage: 99 },
    starterGrantClaimedRecipeIds: ["margherita", "funghi", "fugazza"],
  };

  await page.addInitScript((rawSave) => {
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(rawSave));
  }, save);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /サルシッチャ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await page.waitForSelector(".pizza-stage");
}
