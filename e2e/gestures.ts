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
 * `target` using Playwright's `page.clock`, then confirms with 取り出す！ and resumes real time
 * before returning.
 *
 * Three approaches were tried before this one landed; the first two both failed real WebKit CI:
 * (1) a fixed `waitForTimeout` tuned against one recipe's own midpoint drifted under CI load/
 * parallelism for every other recipe's differently-positioned target; (2) polling the live
 * `.bake-gauge__needle` DOM style for "inside/near-center of the target" and then clicking still
 * failed under simulated CI load (verified locally via CDP `Emulation.setCPUThrottlingRate`),
 * reproducing the exact same "焦げすぎて提供できません" OVERBAKED failure -- `BakeOverlay`'s own
 * tick loop computes `dt` from real `performance.now()` deltas between animation frames (`src/
 * components/BakeOverlay.tsx`), so a single delayed frame under a throttled/loaded runner can
 * jump the needle by a large, unpredictable amount that no polling margin can reliably outrun.
 *
 * A third attempt -- `page.clock.install()` then `runFor(durationMs)` -- *also* failed, still
 * OVERBAKED, and a direct diagnostic (reading `.bake-gauge__needle`'s own live position before
 * and after `runFor`) proved why: `install()` alone does not freeze time -- real time keeps
 * flowing through the faked implementation until the clock is explicitly paused (`page.clock`'s
 * own doc comment: "Fake timers are used to manually control the flow of time" describes
 * `pauseAt`/`runFor`/`fastForward`, not `install` by itself). So `runFor(1273)` was adding 1273ms
 * of virtual advance *on top of* however much real time had already elapsed since `install()` --
 * confirmed directly: under throttle, the needle was already at 19% (real time, ~350ms elapsed)
 * before `runFor` even started, then `runFor` itself took several real seconds to execute under
 * throttle (each faked callback still costs real CPU), landing near 100% by the time it resolved.
 *
 * The actual fix has two parts, both confirmed by direct diagnostics (reading
 * `.bake-gauge__needle`'s own live position at each step under CDP CPU throttling):
 *
 * 1. `pauseAt` an exact *current* instant (`Date.now()` read from Node, no extra page round
 *    trip) doesn't work either -- `pauseAt`'s own Playwright/CDP round trip takes long enough
 *    (worse under throttle) that by the time it executes, that already-past instant makes the
 *    clock controller throw ("Cannot fast-forward to the past"). Pausing at a small *future*
 *    buffer (Node-measured `Date.now() + 150`) avoids that error, but still lets real time flow
 *    for those extra ~150ms before the pause actually lands.
 * 2. So the target duration can never be computed up front from a known start (there isn't one,
 *    real time has already been flowing since the 焼く click) -- instead, once paused, this
 *    reads the needle's own actual live position and computes the *remaining* virtual duration
 *    from wherever it really landed to the target center, then `runFor`s exactly that. This is
 *    adaptive by construction, so it is correct regardless of how much real time the mount +
 *    pause round trip actually cost on a given run. Confirmed landing within ~1 point of the
 *    exact target center across repeated runs at 10x CPU throttle.
 */
export async function bakeToTarget(page: Page, target: { start: number; end: number }) {
  const center = (target.start + target.end) / 2;
  await page.clock.install();
  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForSelector(".bake-gauge__needle");
  // A short future buffer -- pausing at an already-past instant throws; this just needs to be
  // comfortably longer than the pauseAt round trip itself, not a precise duration (see below).
  await page.clock.pauseAt(Date.now() + 150);
  const needle = page.locator(".bake-gauge__needle");
  const currentPosition = await needle.evaluate((el) => Number.parseFloat(el.style.left) || 0);
  const remainingMs = Math.max(0, Math.round(((center - currentPosition) / BAKE_NEEDLE_SPEED_PCT_PER_S) * 1000));
  if (remainingMs > 0) await page.clock.runFor(remainingMs);
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

/**
 * Lunch Rush Phase 4 (Result Summary & Ranking achievedAt): starts a *real*, wall-clock Mission
 * run (unlike the `?missionDuration=1` fixtures used elsewhere in this repo's e2e suite, which
 * exist specifically to reach RESULT almost instantly with `servedCount=0`). Drives HOME ->
 * ランチラッシュ intro -> スタート -> the first order's own "ピザを作る！" tap, landing on
 * PREPARE/DOUGH for the first order -- from there, `playFullMargheritaRound`/
 * `failMissionOrderMissingSauce` below drive individual orders.
 */
export async function startLunchRushMission(page: Page, durationSeconds: number) {
  await page.goto(`/?missionDuration=${durationSeconds}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ランチラッシュ/ }).click();
  await page.getByRole("button", { name: "スタート" }).click();
  await page.getByRole("button", { name: "ピザを作る！" }).click();
  await page.waitForSelector(".pizza-stage");
}

/**
 * Lunch Rush Phase 4: produces a genuine `MISSING_REQUIRED_INGREDIENT` Completion Gate failure
 * (src/logic/completionGate.ts) via the real UI, for a live Mission run's current order --
 * Mission state (`serves`/PASS-FAILED history) is pure in-memory React state, not part of the
 * persisted save, so a FAILED serve cannot be pre-seeded via localStorage the way
 * `startQuattroFormaggiHeavyInventory`/`startSalsicciaUnlocked` above seed ownership/dex state.
 *
 * Deliberately skips the SAUCE step's own ingredient entirely (no chip tap, no paint gesture)
 * -- SAUCE has no completion gate of its own (`nextStepReady`, src/screens/GameScreen.tsx, only
 * ever gates DOUGH), so "次へ" stays enabled and the round can proceed all the way to BAKE with
 * zero of the recipe's required sauce ingredient placed. Every shipped recipe requires at least
 * one sauce ingredient at `minCount >= 1` (src/data/recipes.ts), so this reliably reproduces
 * `MISSING_REQUIRED_INGREDIENT` regardless of which recipe Lunch Rush happens to serve up this
 * order. Skips the real bake-timing wait `playFullMargheritaRound` uses for a PASS round --
 * completionGate.ts's own `PRIORITY_ORDER` always ranks a missing-ingredient failure above
 * UNDERBAKED/OVERBAKED, so the exact needle position at "取り出す！" never changes this outcome.
 *
 * Pizza Cutting 1.0 Phase 4B (Full Recipe Expansion, PR #173): `CONFIRM_BAKE` (src/state/
 * gameReducer.ts) decides POST_BAKE vs. RESULT purely from `postBakeSteps(cookingProfile).length
 * > 0` -- it never consults `completion.status` -- so now that CUT is eligible for all 15
 * shipped recipes (previously margherita-only), a FAILED bake still lands on POST_BAKE/CUT and
 * still requires a real `cutRequiredCount`-line cut + "切り終わる" confirm before `state.phase`
 * ever reaches "RESULT" (and therefore before `MissionServePanel`'s own `--failed` variant can
 * render) -- exactly the same real gesture `playFullMargheritaRound`'s own trailing CUT branch
 * already performs for a PASS round. Completion Gate semantics/CUT scoring are untouched by this
 * -- this only teaches the *test helper* to drive a step the real UI now shows more often.
 *
 * Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps): this used to click "次へ" exactly 3
 * times, assuming every recipe's own PREPARE sequence is the fixed DOUGH/SAUCE/CHEESE/TOPPING
 * 4-step walk. A recipe whose own derived `CookingProfile` (../src/data/cookingProfiles.ts) skips
 * CHEESE or TOPPING has fewer PREPARE steps than that, so a fixed count either double-advances
 * past the round's own last step or fails to find a "次へ" button at all once that step's CTA has
 * already become 焼く！ -- keep tapping "次へ" until the round reaches its own last PREPARE step
 * instead of assuming a fixed count, so this helper stays correct for whichever recipe Lunch
 * Rush's own random order draws.
 */
export async function failMissionOrderMissingSauce(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click(); // DOUGH -> SAUCE

  // SAUCE's own ingredient is deliberately skipped (see this function's own doc comment above) --
  // walk every remaining PREPARE step generically until 焼く！ appears, rather than assuming
  // exactly two more "次へ" taps (CHEESE/TOPPING may not both exist for this order's own recipe).
  while (await page.getByRole("button", { name: /次へ/ }).count()) {
    await page.getByRole("button", { name: /次へ/ }).click();
  }

  await page.getByRole("button", { name: /焼く/ }).click();
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

/**
 * Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps): a synthetic save satisfying マリナーラ's
 * own unlock (`unlockCondition: { requiresRecipeId: "funghi" }`, src/data/recipes.ts -- no
 * `minTotalStars` floor, the shallowest chain of any non-margherita recipe) directly via
 * localStorage, the same pattern `startSalsicciaUnlocked`/`startCapricciosaUnlocked` above use.
 * `ownedIngredientIds`/`inventory` cover marinara's own `requiredIngredients` beyond the one
 * Starter ingredient it uses (tomato-sauce, always owned): garlic/oregano, both finite
 * `starterGrantOnly` ingredients (../src/data/ingredients.ts).
 *
 * Marinara is this task's own primary "no required CHEESE" fixture (Fresh Audit F,
 * docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md) -- `getCookingProfile("marinara")`
 * derives `["DOUGH", "SAUCE", "TOPPING"]`, no CHEESE step at all.
 */
export async function startMarinaraUnlocked(page: Page) {
  const save = {
    schemaVersion: 2,
    dex: ["margherita", "funghi"].map((recipeId) => ({
      recipeId,
      discovered: true,
      bestScore: 70,
      bestStars: 3,
      timesMade: 1,
    })),
    pitzBalance: 500,
    ownedIngredientIds: ["garlic", "oregano"],
    missionBest: {},
    inventory: { garlic: 99, oregano: 99 },
    starterGrantClaimedRecipeIds: ["margherita", "funghi"],
  };

  await page.addInitScript((rawSave) => {
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify(rawSave));
  }, save);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マリナーラ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await page.waitForSelector(".pizza-stage");
}

/** Drives a full marinara round (DOUGH -> SAUCE -> TOPPING -- no CHEESE step, PR-A's own primary
 *  no-cheese fixture) from PREPARE/DOUGH through to RESULT, real UI gestures throughout, mirroring
 *  `playFullMargheritaRound`'s own shape. Never taps a CHEESE ingredient -- there is no CHEESE tab
 *  to advance through for this recipe's own derived `CookingProfile`. */
export async function playFullMarinaraRound(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();

  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();

  // SAUCE's own 次へ lands directly on TOPPING (具材) -- no CHEESE tab/step exists for this
  // recipe's own derived profile, so there is no モッツァレラ (or any cheese) tap here at all.
  await page.getByRole("button", { name: /にんにく/ }).click();
  await tapDoughPercent(page, 35, 45);
  await tapDoughPercent(page, 65, 45);
  await tapDoughPercent(page, 50, 65);
  await page.getByRole("button", { name: /オレガノ/ }).click();
  await tapDoughPercent(page, 45, 30);
  await tapDoughPercent(page, 55, 30);

  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "取り出す！" }).click();

  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await page.getByRole("button", { name: /切り終わる/ }).click();
  }
}
