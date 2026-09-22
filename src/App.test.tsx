import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY, type PersistentSaveV1 } from "./state/persistence";
import { EARLY_GAME_HINT_THRESHOLD, INGREDIENTS, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { RECIPES, type RecipeId } from "./data/recipes";

/** Recipe Select 2.0A: Pizza Select is a sectioned browse grid, not a single-recipe pager --
 *  reaching a given recipe means tapping its own grid card (opens the focused detail/confirm
 *  view), then the one shared CTA there. Kept as a small per-file helper, matching this file's
 *  own existing `completeDoughStep` convention rather than a shared test-utils module. */
async function selectRecipeInPizzaSelect(
  user: ReturnType<typeof userEvent.setup>,
  recipeId: RecipeId,
) {
  const recipe = RECIPES.find((r) => r.id === recipeId)!;
  await user.click(screen.getByRole("button", { name: new RegExp(`^${recipe.nameJa}、`) }));
  await user.click(screen.getByRole("button", { name: /このピザを作る/ }));
}

/** Issue #33 D1: a fresh round now starts at DOUGH, whose own "次へ" stays disabled until the
 *  size-completion threshold is met. Simulates enough taps around the dough's full radius to
 *  clear it (a stretch applies on pointerdown itself -- see PizzaStage's own DOUGH gesture
 *  branch -- so a tap at each of the 8 control-point angles is enough, no drag needed). */
function completeDoughStep() {
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;

  const center = 150; // 50% of a 300px box
  const radius = 140; // safely inside DOUGH_RADIUS (48%) to avoid float rounding at the rim
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const clientX = center + Math.cos(angle) * radius;
    const clientY = center + Math.sin(angle) * radius;
    const pointerId = 1000 + i;
    fireEvent.pointerDown(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
    fireEvent.pointerUp(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  }
}

/** Completion Gate Phase 1: a tap-select-then-tap-dough placement, reusing PizzaStage's own
 *  "pointerdown+pointerup at the same point with no movement in between reads as a tap"
 *  contract (see PizzaStage.tsx's `handlePointerUp`, the same one `completeDoughStep` above
 *  already relies on for DOUGH) -- `onTap` then routes to APPLY_SAUCE/PLACE_TOPPING exactly
 *  like App.tsx's own `handleTapPizza`. Needed now because a round with no sauce/cheese/
 *  topping at all is a FAILED round (../logic/completionGate.ts), not merely a low-scoring
 *  one, so this suite's real-round tests need an actual pizza, not just three "次へ" taps.
 */
async function selectAndTapPizza(
  user: ReturnType<typeof userEvent.setup>,
  ingredientNameJa: string,
  xPercent: number,
  yPercent: number,
) {
  // The chip's accessible name is its full text content (emoji + name + stock, e.g.
  // "🍅トマトソース∞"), never just `nameJa` alone, so this matches by substring.
  await user.click(screen.getByRole("button", { name: new RegExp(ingredientNameJa) }));
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  const clientX = (xPercent / 100) * 300;
  const clientY = (yPercent / 100) * 300;
  const pointerId = Math.floor(Math.random() * 1_000_000);
  fireEvent.pointerDown(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  fireEvent.pointerUp(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
}

/**
 * Completion Gate Phase 1: a single tap on a sauce (spread) ingredient only ever lays down one
 * small "starter tick" dab (see ../logic/sauceDispenseController.ts's own `start()` doc
 * comment) -- deliberately too little to pass the Completion Gate's own sauce-quality floor
 * (../logic/completionGate.ts), matching the spec's own "a single touch must not pass" Human
 * Feel requirement. Real painting is a hold-and-drag gesture (PizzaStage's dispense session),
 * but repeating several separate tap-release cycles at different points accumulates one starter
 * dab each (`COMMIT_SAUCE_DISPENSE`'s own deposit log append, since the sauce is already the
 * pizza's active one after the first tap) -- a `ring(25, 16)`-shaped spread of 16 such dabs
 * around the dough's center is the exact fixture this suite's own
 * gameReducer.scoringV2Authority.test.ts `ring()` helper already proved clears the gate's
 * sauce-quality floor while staying a deliberately mediocre application.
 */
async function paintSauceRing(
  user: ReturnType<typeof userEvent.setup>,
  ingredientNameJa: string,
  radius: number,
  count: number,
) {
  await user.click(screen.getByRole("button", { name: new RegExp(ingredientNameJa) }));
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const xPercent = 50 + Math.cos(angle) * radius;
    const yPercent = 50 + Math.sin(angle) * radius;
    const clientX = (xPercent / 100) * 300;
    const clientY = (yPercent / 100) * 300;
    const pointerId = Math.floor(Math.random() * 1_000_000);
    fireEvent.pointerDown(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
    fireEvent.pointerUp(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  }
}

/**
 * Completion Gate Phase 1: BakeOverlay drives its needle position from its own internal
 * `requestAnimationFrame` loop against real wall-clock time (see BakeOverlay.tsx's own file
 * header) -- left uncontrolled, an immediate "取り出す！" tap in a test captures whatever
 * position a handful of real jsdom animation frames happened to reach, which is both far too
 * low to land inside any recipe's PASS band and not deterministic. Stubbing
 * `requestAnimationFrame`/`performance.now` (mirrors BakeOverlay.test.tsx's own approach) lets
 * a test drive the needle to an exact, chosen value before confirming the bake.
 *
 * Call `stub()` BEFORE clicking "焼く" (so BakeOverlay's mount effect registers its first
 * `requestAnimationFrame` call against the stub, not the real one), then `driveTo(value)` right
 * before clicking "取り出す！", then `unstub()` afterward.
 */
function controlBakeNeedle() {
  let now = 0;
  let rafCallback: FrameRequestCallback | null = null;
  return {
    stub() {
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        rafCallback = callback;
        return 1;
      });
      vi.stubGlobal("cancelAnimationFrame", () => {});
      vi.stubGlobal("performance", { now: () => now });
    },
    driveTo(targetPosition: number) {
      const BAKE_NEEDLE_SPEED = 55; // percent per second, BakeOverlay.tsx's own SPEED constant
      now += (targetPosition / BAKE_NEEDLE_SPEED) * 1000;
      const callback = rafCallback;
      rafCallback = null;
      callback?.(now);
    },
    unstub() {
      vi.unstubAllGlobals();
    },
  };
}

/**
 * Lunch Rush Completion Gate 1A: bakes a genuine PASS order from Mission's own PREPARE step
 * (DOUGH already cleared by the caller). A fresh save's very first Mission order is always
 * margherita (the only recipe with no `unlockCondition`, ../data/recipes.ts) -- but Lunch
 * Rush's own MISSION_NEXT_ORDER registers every order to the Dex regardless of PASS/FAILED
 * (gameReducer.ts's own comment on that case), so a *second* order in the same run can already
 * be funghi (`{ requiresRecipeId: "margherita" }`, auto-unlocked + its own Starter Grant
 * auto-claimed the instant margherita is first registered, ../state/starterStock.ts) rather
 * than margherita again (`pickMissionOrder`'s own repeat-avoidance). Rather than predicting
 * which of the two a given call lands on, this places every ingredient either recipe could
 * need -- sauce + 3x mozzarella (>= both recipes' own minCount) always, then 2x basil and/or
 * 3x mushroom in TOPPING, whichever chip is actually present (mushroom only becomes owned once
 * funghi unlocks) -- since the Completion Gate only ever fails on a MISSING/insufficient
 * required ingredient, never an extra one. 70 sits inside both recipes' own bakeTarget perfect
 * zone (margherita {60,80}, funghi {58,78}). Mirrors the bismarck PASS sequence this file's own
 * "RESULT 2.0" test already establishes (paintSauceRing + selectAndTapPizza + controlBakeNeedle).
 */
async function bakeMissionOrderPass(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /次へ/ })); // DOUGH -> SAUCE
  await paintSauceRing(user, "トマトソース", 25, 16);
  await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
  await selectAndTapPizza(user, "モッツァレラ", 40, 50);
  await selectAndTapPizza(user, "モッツァレラ", 60, 50);
  await selectAndTapPizza(user, "モッツァレラ", 50, 30);
  await user.click(screen.getByRole("button", { name: /次へ/ })); // CHEESE -> TOPPING
  if (screen.queryByRole("button", { name: /バジル/ })) {
    await selectAndTapPizza(user, "バジル", 45, 55);
    await selectAndTapPizza(user, "バジル", 55, 45);
  }
  if (screen.queryByRole("button", { name: /マッシュルーム/ })) {
    await selectAndTapPizza(user, "マッシュルーム", 40, 60);
    await selectAndTapPizza(user, "マッシュルーム", 60, 60);
    await selectAndTapPizza(user, "マッシュルーム", 50, 40);
  }

  const needle = controlBakeNeedle();
  needle.stub();
  await user.click(screen.getByRole("button", { name: /焼く/ }));
  needle.driveTo(70);
  await user.click(screen.getByRole("button", { name: "取り出す！" }));
  needle.unstub();
  await completeCutStepIfPresent(user);
}

/**
 * Pizza Cutting 1.0 Phase 2: margherita (the only recipe available from a fresh Dex, and
 * therefore always this suite's first FREE/Mission order) now carries a CUT-enabled profile
 * (../data/cookingProfiles.ts) -- CONFIRM_BAKE lands the round on POST_BAKE/CUT instead of
 * straight to RESULT, and nothing advances further until the player draws the required cut
 * lines and confirms. This walks that step through 3 real edge-to-edge pointer drags (the same
 * gesture PizzaStage.tsx's own CUT-mode handling expects, not a synthetic dispatch) and taps
 * "切り終わる" -- a safe no-op for any other (CUT-free) recipe a repeat Lunch Rush order might
 * land on (../mission/lunchRush.ts's own repeat-avoidance, see bakeMissionOrderPass's own doc
 * comment above), since that button only ever renders during CUT.
 */
async function completeCutStepIfPresent(user: ReturnType<typeof userEvent.setup>) {
  if (!screen.queryByRole("button", { name: /切り終わる/ })) return;
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  const center = 150;
  const radius = 140;
  for (const angleDeg of [0, 60, 120]) {
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    const startX = center - dx;
    const startY = center - dy;
    const endX = center + dx;
    const endY = center + dy;
    const pointerId = Math.floor(Math.random() * 1_000_000);
    fireEvent.pointerDown(dough, {
      pointerId,
      isPrimary: true,
      pointerType: "touch",
      clientX: startX,
      clientY: startY,
    });
    fireEvent.pointerMove(dough, {
      pointerId,
      isPrimary: true,
      pointerType: "touch",
      clientX: endX,
      clientY: endY,
    });
    fireEvent.pointerUp(dough, {
      pointerId,
      isPrimary: true,
      pointerType: "touch",
      clientX: endX,
      clientY: endY,
    });
  }
  await user.click(screen.getByRole("button", { name: /切り終わる/ }));
}

/**
 * HOME/GAME separation (Issue #24) integration coverage, extended by Issue #39 for the
 * HOME -> Pizza Select -> FREE navigation this file's own describe block now covers end to
 * end. Renders the real `App` (real reducers, real localStorage) end-to-end rather than
 * mocking anything internal -- these tests exist specifically to catch a broken navigation
 * wire or a HOME number that silently stops tracking `GameState`, not to re-verify
 * scoring/economy/Dex rules already covered by their own unit suites (src/logic, src/state).
 */

function seedSave(overrides: Partial<PersistentSaveV1>): void {
  const save: PersistentSaveV1 = {
    schemaVersion: 1,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
    missionBest: {},
    ...overrides,
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}

/** Economy & Progression 1.0 EP1: bismarck needs margherita->funghi->marinara discovered
 *  first (the Chapter 1 recipe-unlock chain, src/state/progression.ts's `recipeUnlocked`).
 *  Many of this file's end-to-end flows exercise a second, still-undiscovered recipe after
 *  margherita -- bismarck was the arbitrary pick before EP1 (when every Starter recipe was
 *  always available) and stays the pick here, just with its own chain pre-seeded so it
 *  actually shows up as an unlocked, NEW card on Pizza Select. */
function seedBismarckUnlocked(): void {
  seedSave({
    dex: [
      { recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
      { recipeId: "funghi", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
      { recipeId: "marinara", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
    ],
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("HOME/GAME separation (Issue #24)", () => {
  it("shows HOME on initial load, not GAME", () => {
    render(<App />);
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
    expect(document.querySelector(".game-screen")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ピザを作る/ })).toBeInTheDocument();
  });

  it("navigates HOME -> Pizza Select on the primary CTA (Issue #39), not straight into GAME", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expect(document.querySelector(".pizza-select-screen")).toBeInTheDocument();
    expect(document.querySelector(".game-screen")).not.toBeInTheDocument();
    expect(document.querySelector(".home-screen")).not.toBeInTheDocument();
    expect(screen.getByText("作るピザを選ぼう！")).toBeInTheDocument();
    // The old redundant "フリープレイ / Lunch Rush" two-choice picker must not appear here --
    // Pizza Select's cards are the only FREE entry point now.
    expect(screen.queryByRole("button", { name: /フリープレイ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lunch Rush/ })).not.toBeInTheDocument();
  });

  it("selects an unlocked recipe from Pizza Select and starts FREE with that exact recipe", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    // Bismarck is unlocked (Starter Set only) and undiscovered on a fresh save -- NEW.
    await selectRecipeInPizzaSelect(user, "bismarck");
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(document.querySelector(".pizza-select-screen")).not.toBeInTheDocument();
    // Issue #47 Finding C: Pizza Select already made the recipe choice explicit, so selecting
    // a recipe now lands straight at PREPARE -- the old redundant フリープレイ button (a
    // second FREE-mode choice after the recipe was already picked) no longer appears.
    expect(screen.queryByRole("button", { name: /フリープレイ/ })).not.toBeInTheDocument();
    expect(document.querySelector(".order-card")).toBeInTheDocument();
    // The recipe name shown in PREPARE's compact order-card confirms the selected recipeId
    // (not a random one) actually reached GameScreen/state.recipe.
    expect(screen.getAllByText(/ビスマルク/).length).toBeGreaterThan(0);
    // The in-round secondary Lunch Rush entry point was removed from GAME's ORDER action row
    // (Issue #39 PS1) -- only the one FREE CTA remains here.
    expect(screen.queryByRole("button", { name: /Lunch Rush/ })).not.toBeInTheDocument();
  });

  // Issue #47 Finding K: Shop/Pizza Dex must not be reachable from Making at all -- HOME
  // remains the sole hub. Checked across ORDER (Lunch Rush's own ORDER screen, the one place
  // GAME still renders phase "ORDER" for FREE-mode content) and PREPARE.
  it("never renders Shop/Pizza Dex navigation inside GAME's header (Finding K)", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck"); // Pizza Select -> GAME/PREPARE
    const header = document.querySelector<HTMLElement>(".game-screen .app-header")!;
    expect(within(header).queryByText(/Shop/)).not.toBeInTheDocument();
    expect(within(header).queryByText(/レシピ図鑑/)).not.toBeInTheDocument();
    expect(within(header).getByRole("button", { name: /ホーム/ })).toBeInTheDocument();
  });

  it("a locked recipe card (fugazza, before onion is owned) cannot start a round", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    // Queried once, before opening its detail -- the grid card stays mounted (only hidden)
    // behind the detail view, so this same aria-label would otherwise match twice.
    const mysteryCard = screen.getByLabelText("？？？、未解放");
    await user.click(mysteryCard);
    const cta = screen.getByRole("button", { name: /このピザを作る/ });
    expect(cta).toBeDisabled();
    await user.click(cta);
    // Still on Pizza Select -- a disabled button's click is a no-op, never reaching GAME.
    expect(document.querySelector(".pizza-select-screen")).toBeInTheDocument();
    expect(document.querySelector(".game-screen")).not.toBeInTheDocument();
  });

  it("navigates Pizza Select -> HOME via its back button", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expect(document.querySelector(".pizza-select-screen")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
    expect(document.querySelector(".pizza-select-screen")).not.toBeInTheDocument();
  });

  it("navigates HOME -> Lunch Rush straight into the Mission Intro overlay", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(document.querySelector(".mission-overlay")).toBeInTheDocument();
    expect(screen.getByText(/LUNCH RUSH/)).toBeInTheDocument();
  });

  // Issue #47 Finding C only changes SELECT_RECIPE (Pizza Select's own path) -- Mission's own
  // ORDER-phase round (MISSION_RESET_ORDER) must still show its own "ピザを作る！" ORDER CTA
  // unaffected, never the フリープレイ label or a skip straight to PREPARE.
  it("Lunch Rush's own ORDER screen is unaffected by the Pizza Select FREE-mode change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    await user.click(screen.getByRole("button", { name: "スタート" }));
    expect(screen.getByRole("button", { name: "ピザを作る！" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /フリープレイ/ })).not.toBeInTheDocument();
  });

  // RESULT 2.0 Slice 1 regression: `handleConfirmBake`'s new auto-REGISTER_TO_DEX dispatch is
  // guarded on `!state.isMissionRound` -- this pins that a Lunch Rush round's own CONFIRM_BAKE
  // still lands on MissionServePanel (score + immediate 次の注文へ), never the FREE-only merged
  // Hero result screen, and never applies a stray per-pizza Pitz/Dex credit mid-run.
  it("Lunch Rush: CONFIRM_BAKE still shows MissionServePanel, not FREE's merged RESULT screen", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    await user.click(screen.getByRole("button", { name: "スタート" }));
    await user.click(screen.getByRole("button", { name: "ピザを作る！" }));
    completeDoughStep();
    // Lunch Rush Completion Gate 1A: this round must actually PASS (see bakeMissionOrderPass's
    // own doc comment) -- an empty pizza is now a FAILED order (../logic/completionGate.ts),
    // covered by this suite's own dedicated FAILED tests below, not this PASS-path assertion.
    await bakeMissionOrderPass(user);

    expect(screen.getByRole("button", { name: "次の注文へ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もう一度つくる" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "別のピザを作る" })).not.toBeInTheDocument();
    expect(screen.queryByText(/を発見しました/)).not.toBeInTheDocument();
    expect(document.querySelector(".pitz-credit-summary")).not.toBeInTheDocument();
  });

  // Issue #85 UX-1: MissionServePanel's own "次の注文へ" tap used to land back at Mission's
  // ORDER phase, requiring a second, redundant 「ピザを作る！」 tap before PREPARE reopened for
  // the next pizza. handleMissionServeNext now also dispatches BEGIN_PREPARE in the same tick,
  // so the next order skips straight to PREPARE -- covers two consecutive pizzas to pin that
  // servedCount/mission HUD keep advancing correctly across the auto-advance, not just once.
  it("Lunch Rush: 次の注文へ skips the redundant ORDER gate and lands straight at PREPARE", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    await user.click(screen.getByRole("button", { name: "スタート" }));
    await user.click(screen.getByRole("button", { name: "ピザを作る！" }));
    completeDoughStep();
    await bakeMissionOrderPass(user);

    expect(screen.getByRole("button", { name: "次の注文へ" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "次の注文へ" }));

    // No intermediate ORDER-phase CTA -- straight to PREPARE's own DOUGH step.
    expect(screen.queryByRole("button", { name: "ピザを作る！" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-pizza-drop-target="true"]')).toBeInTheDocument();
    expect(document.querySelector(".mission-hud__served")?.textContent).toContain("1"); // servedCount after pizza 1

    // A second pizza confirms this holds across repeated auto-advances, not just once.
    completeDoughStep();
    await bakeMissionOrderPass(user);
    expect(screen.getByRole("button", { name: "次の注文へ" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "次の注文へ" }));
    expect(screen.queryByRole("button", { name: "ピザを作る！" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-pizza-drop-target="true"]')).toBeInTheDocument();
    expect(document.querySelector(".mission-hud__served")?.textContent).toContain("2"); // servedCount after pizza 2
  });

  // Lunch Rush Completion Gate 1A (docs/reports/TETO_LUNCH-RUSH_COMPLETION-GATE_1A_Result.md):
  // a FAILED order (no ingredients placed at all -- ../logic/completionGate.ts's own
  // MISSING_REQUIRED_INGREDIENT) must show the same short failure reason FREE's ResultPanel
  // already shows (buildCompletionFailureMessage, ../data/completionMessages.ts), never the
  // normal stars/score/+1 SERVED card, and must never bump servedCount.
  it("Lunch Rush: a Completion FAILED order shows the failure reason and never counts as served", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    await user.click(screen.getByRole("button", { name: "スタート" }));
    await user.click(screen.getByRole("button", { name: "ピザを作る！" }));
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);

    // The FAILED variant: reason text visible, no score/stars, no +1 SERVED, but the CTA to
    // move on is still there (the order is consumed, not retried in place).
    expect(screen.getByText("トマトソースが入っていません")).toBeInTheDocument();
    expect(document.querySelector(".mission-serve-panel__score")).not.toBeInTheDocument();
    expect(screen.queryByText(/SERVED/)).not.toBeInTheDocument();
    expect(document.querySelector(".mission-hud__served")?.textContent).toContain("0");
    const nextButton = screen.getByRole("button", { name: "次の注文へ" });

    await user.click(nextButton);

    // Order is still consumed and the run still advances to a fresh PREPARE -- not a retry of
    // the same order -- but servedCount stays at 0 since nothing was actually served.
    expect(screen.queryByRole("button", { name: "ピザを作る！" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-pizza-drop-target="true"]')).toBeInTheDocument();
    expect(document.querySelector(".mission-hud__served")?.textContent).toContain("0");
  });

  // A second consecutive FAILED order pins that repeated failures neither loop the same order
  // nor ever manage to sneak servedCount/score up -- "FAILEDだから無限にやり直せる" is explicitly
  // not the semantics here (see the Result Report's Product Rule section).
  it("Lunch Rush: repeated Completion FAILED orders never inflate servedCount or loop the same order", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    await user.click(screen.getByRole("button", { name: "スタート" }));
    await user.click(screen.getByRole("button", { name: "ピザを作る！" }));

    for (let i = 0; i < 2; i += 1) {
      completeDoughStep();
      await user.click(screen.getByRole("button", { name: /次へ/ }));
      await user.click(screen.getByRole("button", { name: /次へ/ }));
      await user.click(screen.getByRole("button", { name: /次へ/ }));
      await user.click(screen.getByRole("button", { name: /焼く/ }));
      await user.click(screen.getByRole("button", { name: "取り出す！" }));
      await completeCutStepIfPresent(user);
      expect(document.querySelector(".mission-hud__served")?.textContent).toContain("0");
      await user.click(screen.getByRole("button", { name: "次の注文へ" }));
      expect(document.querySelector('[data-pizza-drop-target="true"]')).toBeInTheDocument();
    }

    expect(document.querySelector(".mission-hud__served")?.textContent).toContain("0");
  });

  // A PASS pizza served right after a FAILED one pins that the two never bleed into each
  // other's counts -- FAILED stays 0/0, and the very next PASS still counts as exactly +1.
  it("Lunch Rush: a PASS order right after a FAILED one still counts as exactly +1 served", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランチラッシュ/ }));
    await user.click(screen.getByRole("button", { name: "スタート" }));
    await user.click(screen.getByRole("button", { name: "ピザを作る！" }));

    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);
    await user.click(screen.getByRole("button", { name: "次の注文へ" }));

    completeDoughStep();
    await bakeMissionOrderPass(user);
    await user.click(screen.getByRole("button", { name: "次の注文へ" }));
    expect(document.querySelector(".mission-hud__served")?.textContent).toContain("1");
  });

  it("opens the Dex overlay from HOME without leaving HOME underneath", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    expect(document.querySelector(".dex-overlay")).toBeInTheDocument();
    // Still on HOME underneath the overlay -- Dex/Shop are modals over HOME, not navigation.
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
    await user.click(within(document.querySelector(".dex-overlay")!).getByRole("button", { name: "閉じる" }));
    expect(document.querySelector(".dex-overlay")).not.toBeInTheDocument();
  });

  it("opens the Shop overlay from HOME without leaving HOME underneath", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    expect(document.querySelector(".dex-overlay")).toBeInTheDocument(); // ShopOverlay reuses this container class
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("HOME Weekly Ranking route: 実績 is temporarily off HOME's menu, not deleted as a feature", () => {
    render(<App />);
    // Issue #87 follow-up: 実績 stays a disabled/"近日公開" placeholder feature, just no longer
    // surfaced in HOME's 2x2 sub-nav grid (swapped for 🏆 ランキング, see HomeScreen.tsx's doc
    // comment) -- this only asserts it's off the HOME menu, never that the feature is removed.
    expect(screen.queryByRole("button", { name: /実績/ })).not.toBeInTheDocument();
  });

  it("HOME Weekly Ranking route: opens WeeklyRankingOverlay from HOME without leaving HOME underneath", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランキング/ }));
    expect(document.querySelector(".ranking-overlay__panel")).toBeInTheDocument();
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("HOME Weekly Ranking route: closing the overlay returns to HOME", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ランキング/ }));
    await user.click(within(document.querySelector(".ranking-overlay__panel")!).getByRole("button", { name: "閉じる" }));
    expect(document.querySelector(".ranking-overlay__panel")).not.toBeInTheDocument();
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("navigates GAME -> HOME via the header button when nothing is in progress", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck"); // Pizza Select -> GAME
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    // Still ORDER phase -- nothing built yet, so no confirmation should even be asked.
    const confirmSpy = vi.spyOn(window, "confirm");
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("confirms before discarding an in-progress pizza when leaving GAME for HOME", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck"); // Pizza Select -> GAME, already PREPARE (Finding C)
    // Issue #32 Phase 2 / Issue #33 D1: 焼く only appears once the making flow reaches
    // TOPPING (DOUGH -> SAUCE -> CHEESE -> TOPPING).
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(screen.getByRole("button", { name: /焼く/ })).toBeInTheDocument();

    // Cancel: stays on GAME, PREPARE state untouched.
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".game-screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /焼く/ })).toBeInTheDocument();

    // Confirm: discards the round and returns to HOME.
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
  });

  it("starts a fresh round instead of reopening a finished round from HOME's CTA", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck"); // Pizza Select -> GAME, already PREPARE
    // Issue #32 Phase 2 / Issue #33 D1: 焼く only appears once the making flow reaches
    // TOPPING (DOUGH -> SAUCE -> CHEESE -> TOPPING).
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ })); // PREPARE -> BAKE
    // RESULT 2.0 Slice 1: REGISTER_TO_DEX now applies automatically at BAKE -> RESULT (App.tsx's
    // handleConfirmBake), so this one tap lands directly on the merged Hero result screen --
    // there is no separate "レシピ図鑑に登録する" tap between RESULT and DISCOVERED anymore.
    await user.click(screen.getByRole("button", { name: "取り出す！" })); // BAKE -> POST_BAKE/CUT
    // Pizza Cutting 1.0 Phase 4B: bismarck is now CUT-eligible, so this lands on POST_BAKE/CUT
    // first -- complete it via the same real-UI gesture margherita's own CUT test uses.
    await completeCutStepIfPresent(user);
    // Issue #47 Finding D: the old single "もう一度作る" (always a *different* recipe) is
    // replaced by two explicit actions.
    expect(screen.queryByRole("button", { name: "もう一度作る" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度つくる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "別のピザを作る" })).toBeInTheDocument();

    // DISCOVERED has nothing in-progress to lose, so no confirmation is needed leaving GAME.
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(document.querySelector(".home-screen")).toBeInTheDocument();

    // Tapping HOME's CTA again lands on Pizza Select, now showing bismarck as COMPLETED
    // (just discovered above) rather than NEW -- selecting it again must land on a fresh
    // PREPARE, not reopen the DISCOVERED screen this same round left behind.
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck");
    expect(screen.queryByRole("button", { name: "もう一度つくる" })).not.toBeInTheDocument();
    expect(document.querySelector(".order-card")).toHaveTextContent("ビスマルク");
  });

  // RESULT 2.0 Slice 1: REGISTER_TO_DEX (Dex/BEST/Pitz) now applies automatically the instant
  // BAKE confirms -- there is no separate "レシピ図鑑に登録する" tap between RESULT and
  // DISCOVERED anymore (App.tsx's `handleConfirmBake`). This pins that end-to-end: one tap on
  // 取り出す！ already shows the discovery banner and Pitz credit, and the player's own
  // completed pizza (not a reference/placeholder image) stays the visual hero throughout.
  it("RESULT 2.0: auto-registers to Dex/Pitz on BAKE confirm and shows the player's own completed pizza as hero", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck");
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ })); // DOUGH -> SAUCE
    // Completion Gate Phase 1: this round must actually PASS (real sauce + every required
    // ingredient at its own minCount + a bake inside bismarck's own acceptable band) for the
    // discovery banner below to appear at all -- an empty pizza is now a FAILED round
    // (../logic/completionGate.ts), which never registers to Dex (see this suite's own
    // Completion Gate coverage in gameReducer.pitzReward.test.ts for that behavior directly).
    await paintSauceRing(user, "トマトソース", 25, 16);
    await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
    await selectAndTapPizza(user, "モッツァレラ", 40, 50);
    await selectAndTapPizza(user, "モッツァレラ", 60, 50);
    await selectAndTapPizza(user, "モッツァレラ", 50, 30);
    await user.click(screen.getByRole("button", { name: /次へ/ })); // CHEESE -> TOPPING
    await selectAndTapPizza(user, "たまご", 50, 65);

    const needle = controlBakeNeedle();
    needle.stub();
    await user.click(screen.getByRole("button", { name: /焼く/ }));

    // The same PizzaStage element (and the pizza it was built on) carries straight through
    // BAKE -> RESULT -- no remount, no reset to a blank/reference stage.
    const pizzaBeforeConfirm = document.querySelector(".pizza-stage .pizza-dough");
    expect(pizzaBeforeConfirm).toBeInTheDocument();

    // bismarck's bakeTarget is {55, 75} -- 65 sits in the middle of the perfect zone.
    needle.driveTo(65);
    await user.click(screen.getByRole("button", { name: "取り出す！" })); // BAKE -> POST_BAKE/CUT
    needle.unstub();

    // Pizza Cutting 1.0 Phase 4B: bismarck is now CUT-eligible (../data/cookingProfiles.ts), so
    // BAKE confirm lands on POST_BAKE/CUT, not RESULT/DISCOVERED directly -- complete it via the
    // same real-UI gesture margherita's own CUT test uses before the RESULT/DISCOVERED
    // assertions below. The still-live "a non-CUT recipe never shows a fabricated CUT card"
    // protection this test used to pin here now lives where it actually belongs -- a pure,
    // recipe-independent prop test (ResultPanel.test.tsx's "omits the CUT evaluation summary
    // for a non-CUT recipe (cutEvaluation null)") plus the allowlist/reducer-level synthetic
    // ineligible-fixture coverage (cookingProfiles.test.ts, gameReducer.cutStep.test.ts).
    expect(screen.getByRole("button", { name: /切り終わる/ })).toBeInTheDocument();
    await completeCutStepIfPresent(user);

    // No intermediate "score only, tap to register" screen -- the discovery banner, the CTAs,
    // and the completed pizza are all present on the very first render after CUT confirms.
    expect(screen.queryByRole("button", { name: "レシピ図鑑に登録する" })).not.toBeInTheDocument();
    expect(screen.getByText(/を発見しました/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度つくる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "別のピザを作る" })).toBeInTheDocument();

    // Still the exact same pizza element -- RESULT never rebuilds/replaces it with a fresh or
    // reference stage (the task's own "Preserve player pizza" requirement).
    const pizzaAfterConfirm = document.querySelector(".pizza-stage .pizza-dough");
    expect(pizzaAfterConfirm).toBe(pizzaBeforeConfirm);

    // Pizza Cutting 1.0 Phase 4B: bismarck is now CUT-eligible -- its RESULT now DOES show the
    // CUT evaluation card (positive case; regression for the "non-CUT recipe" case moved to
    // ResultPanel.test.tsx/cookingProfiles.test.ts/gameReducer.cutStep.test.ts as noted above).
    const cutCard = document.querySelector(".cut-evaluation-summary");
    expect(cutCard).toBeInTheDocument();
    expect(cutCard).toHaveTextContent(/カット/);
  });

  // Pizza Cutting 1.0 Phase 3 (docs/design/TETO_PIZZA-CUTTING_1.0.md §14 Option D / RESULT UI
  // section): the real BAKE -> POST_BAKE(CUT) -> RESULT walkthrough, driven through the actual
  // UI (real pointer gestures via `completeCutStepIfPresent`, not a synthetic reducer dispatch)
  // for margherita -- the one recipe Phase 2 activated CUT on and this repo's own default/
  // first recipe. Confirms the CUT evaluation card renders on RESULT with player-facing
  // Japanese labels, never the four raw technical signal names, and never perturbs the
  // existing stars/score/Pitz headline.
  it("Pizza Cutting Phase 3: margherita's RESULT shows the CUT evaluation card after a real CUT walkthrough", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "margherita");
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ })); // DOUGH -> SAUCE
    await paintSauceRing(user, "トマトソース", 25, 16);
    await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
    await selectAndTapPizza(user, "モッツァレラ", 40, 50);
    await selectAndTapPizza(user, "モッツァレラ", 60, 50);
    await selectAndTapPizza(user, "モッツァレラ", 50, 30);
    await user.click(screen.getByRole("button", { name: /次へ/ })); // CHEESE -> TOPPING
    await selectAndTapPizza(user, "バジル", 45, 55);
    await selectAndTapPizza(user, "バジル", 55, 45);

    const needle = controlBakeNeedle();
    needle.stub();
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    // margherita's bakeTarget is {60, 80} -- 70 sits in the middle of the perfect zone.
    needle.driveTo(70);
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    needle.unstub();

    // Lands on POST_BAKE/CUT, not RESULT yet -- the RESULT screen/CTAs aren't reachable until
    // CUT itself confirms.
    expect(screen.getByRole("button", { name: /切り終わる/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もう一度つくる" })).not.toBeInTheDocument();

    await completeCutStepIfPresent(user);

    expect(screen.getByRole("button", { name: "もう一度つくる" })).toBeInTheDocument();
    const cutCard = document.querySelector(".cut-evaluation-summary");
    expect(cutCard).toBeInTheDocument();
    expect(cutCard).toHaveTextContent(/カット/);
    expect(cutCard).toHaveTextContent(/点/);
    expect(cutCard).toHaveTextContent("均等さ");
    expect(cutCard).toHaveTextContent("中心");
    expect(cutCard).toHaveTextContent("切り分け");
    // Never a raw technical term leaking into player-facing text.
    expect(cutCard).not.toHaveTextContent(/uniformity/i);
    expect(cutCard).not.toHaveTextContent(/centerAccuracy/i);
    expect(cutCard).not.toHaveTextContent(/completeness/i);

    // The existing quality headline (stars/score) is untouched by CUT -- still rendered,
    // still the same component, never replaced or perturbed by the new card above it.
    expect(document.querySelector(".result-panel__stars")).toBeInTheDocument();
    expect(document.querySelector(".result-panel__score")).toBeInTheDocument();
  });

  it("「もう一度つくる」retries the exact same recipe with a fresh pizza (Finding D)", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck");
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);

    await user.click(screen.getByRole("button", { name: "もう一度つくる" }));

    // Same recipe, landed directly on a fresh PREPARE -- no Pizza Select, no フリープレイ gate.
    expect(document.querySelector(".pizza-select-screen")).not.toBeInTheDocument();
    expect(document.querySelector(".order-card")).toHaveTextContent("ビスマルク");
    expect(screen.queryByRole("button", { name: /フリープレイ/ })).not.toBeInTheDocument();
    // Issue #33 D1: fresh making state is back at DOUGH (次へ shows, disabled until stretched
    // again), not 焼く.
    const nextButton = screen.getByRole("button", { name: /次へ/ });
    expect(nextButton).toBeInTheDocument();
    expect(nextButton).toBeDisabled();
    expect(screen.queryByRole("button", { name: /焼く/ })).not.toBeInTheDocument();
  });

  it("「別のピザを作る」returns to Pizza Select instead of retrying (Finding D)", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck");
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);

    await user.click(screen.getByRole("button", { name: "別のピザを作る" }));

    expect(document.querySelector(".pizza-select-screen")).toBeInTheDocument();
    expect(document.querySelector(".game-screen")).not.toBeInTheDocument();
  });

  // Deeper Dex/Pitz/ownedIngredientIds preservation across RETRY_SAME_RECIPE is covered at the
  // reducer level (src/state/gameReducer.test.ts) -- this checks the one progression field
  // GAME's own header still surfaces (Pitz balance) stays stable across the same UI flow.
  it("keeps Pitz balance stable across a same-recipe retry", async () => {
    seedBismarckUnlocked();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck");
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);

    const pitzBefore = screen.getByLabelText(/Pitz残高/).textContent;
    await user.click(screen.getByRole("button", { name: "もう一度つくる" }));
    expect(screen.getByLabelText(/Pitz残高/).textContent).toBe(pitzBefore);
  });

  it("reads Pitz balance and Dex progress from persisted state, never hard-coded", () => {
    seedSave({
      pitzBalance: 250,
      dex: [
        {
          recipeId: "margherita",
          discovered: true,
          bestScore: 92,
          bestStars: 4,
          timesMade: 3,
        },
      ],
    });
    render(<App />);
    expect(screen.getByLabelText("Pitz残高 250")).toBeInTheDocument();
    // 15 total recipes (src/data/recipes.ts, Recipe Expansion Batch 1A + Batch 1B-A + Batch
    // 1B-B + Batch 1B-C) -- 1 discovered from the seeded save.
    expect(screen.getByLabelText(/レシピ図鑑 発見数 1 \/ 15/)).toBeInTheDocument();
    expect(screen.getByText(/発見 1\/15/)).toBeInTheDocument();
  });

  it("still shows HOME first after a reload, with persisted progression intact", () => {
    seedSave({ pitzBalance: 40, dex: [] });
    const { unmount } = render(<App />);
    expect(screen.getByLabelText("Pitz残高 40")).toBeInTheDocument();
    unmount();

    // Simulates a reload: a fresh mount reading the same storage back.
    render(<App />);
    expect(document.querySelector(".home-screen")).toBeInTheDocument();
    expect(screen.getByLabelText("Pitz残高 40")).toBeInTheDocument();
  });
});

/** Economy & Progression 1.0 EP3: seeds a v2 save directly (rather than `seedSave`'s v1 shape)
 *  so `inventory` can be set to an exact value -- a v1 seed would migrate onion's stock to the
 *  fixed `DEFAULT_MIGRATION_RESTOCK_QTY` (4) via `backfillInventoryForMigratedSave`, which these
 *  Shop-UI tests need to control precisely (e.g. a specific low stock, or exactly enough/not
 *  enough Pitz for one restock). */
function seedSaveV2(overrides: {
  pitzBalance?: number;
  ownedIngredientIds?: string[];
  inventory?: Record<string, number>;
  dex?: Array<{
    recipeId: string;
    discovered: boolean;
    bestScore: number;
    bestStars: 1 | 2 | 3 | 4 | 5;
    timesMade: number;
  }>;
}): void {
  const save = {
    schemaVersion: 2,
    dex: overrides.dex ?? [],
    pitzBalance: overrides.pitzBalance ?? 0,
    ownedIngredientIds: overrides.ownedIngredientIds ?? [...STARTER_INGREDIENT_IDS],
    missionBest: {},
    inventory: overrides.inventory ?? {},
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}

describe("Shop 2.0 restock (Economy & Progression 1.0 EP3)", () => {
  const ownedWithOnion = [...STARTER_INGREDIENT_IDS, "onion"];

  it("shows a restock row (stock/qty/price/CTA) for an owned finite ingredient, not a plain 購入済み checkmark", async () => {
    const user = userEvent.setup();
    seedSaveV2({ pitzBalance: 200, ownedIngredientIds: ownedWithOnion, inventory: { onion: 2 } });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(shop).getByText(/在庫 2/)).toBeInTheDocument();
    expect(within(shop).getByText("+12")).toBeInTheDocument();
    expect(within(shop).getByText(/170 Pitz/)).toBeInTheDocument();
    expect(within(shop).getByRole("button", { name: "補充する" })).toBeInTheDocument();
    expect(within(shop).queryByText("購入済み")).not.toBeInTheDocument();
  });

  it("補充する credits inventory by +12 and debits Pitz by 170 in one atomic tap", async () => {
    const user = userEvent.setup();
    seedSaveV2({ pitzBalance: 200, ownedIngredientIds: ownedWithOnion, inventory: { onion: 2 } });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    await user.click(within(shop).getByRole("button", { name: "補充する" }));
    expect(within(shop).getByText(/在庫 14/)).toBeInTheDocument(); // 2 + 12
    expect(within(shop).getByText(/補充しました/)).toBeInTheDocument();
    expect(within(shop).getByText(/30 Pitz/)).toBeInTheDocument(); // 200 - 170
  });

  it("disables 補充する when Pitz balance is insufficient for the restock price", async () => {
    const user = userEvent.setup();
    seedSaveV2({ pitzBalance: 50, ownedIngredientIds: ownedWithOnion, inventory: { onion: 2 } });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    const button = within(shop).getByRole("button", { name: "補充する" });
    expect(button).toBeDisabled();
    await user.click(button);
    // A disabled button never fires a click handler -- stock/Pitz must stay exactly as seeded.
    expect(within(shop).getByText(/在庫 2/)).toBeInTheDocument();
  });

  it("an ingredient the player doesn't own yet never shows a restock row", async () => {
    const user = userEvent.setup();
    // onion LOCKED (totalStars 0 < 12, and not owned) -- the pre-EP3 LOCKED/AVAILABLE_TO_BUY
    // branches must be completely unaffected by the restock UI addition.
    seedSaveV2({ pitzBalance: 999, ownedIngredientIds: [...STARTER_INGREDIENT_IDS] });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(shop).queryByRole("button", { name: "補充する" })).not.toBeInTheDocument();
    expect(within(shop).queryByText(/在庫/)).not.toBeInTheDocument();
  });
});

/**
 * Visual Polish 1C (AI UI/UX Visual Review 1.0, P1-3 / P2-5): fresh/early-game Shop guidance +
 * category filter. "few" below means fewer than `EARLY_GAME_HINT_THRESHOLD` owned finite
 * ingredients, "many" means at least that many -- `MANY` is sized directly off the real,
 * currently-shipped constant (imported from ShopOverlay.tsx) rather than a hardcoded copy of it,
 * so this suite doesn't go stale every time a Recipe Expansion batch changes the ingredient
 * catalog's size (as it already did once: 15 -> 17 shop-eligible ingredients moved the threshold
 * from 8 to 9 when Batch 1B-A added rosemary/bacon).
 */
describe("Shop Visual Polish 1C: empty state + scalability", () => {
  const FEW = ["mushroom"]; // funghi's own grant -- 1 shop product, topping category
  // The first `EARLY_GAME_HINT_THRESHOLD` shop-eligible ingredient ids, in catalog order --
  // always exactly at the threshold, spanning whichever categories the catalog's own early
  // entries happen to cover (today: sauce/cheese/topping, same 3 as ever).
  const MANY = INGREDIENTS.filter((i) => i.unlockCondition)
    .map((i) => i.id)
    .slice(0, EARLY_GAME_HINT_THRESHOLD);

  it("A/B. fresh game (0 products) shows only the big empty-shop message, no hint/filter/list", async () => {
    const user = userEvent.setup();
    seedSaveV2({ pitzBalance: 0, ownedIngredientIds: [...STARTER_INGREDIENT_IDS] });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(shop).getByText("新しい素材は、ピザの腕前が上がると入荷します")).toBeInTheDocument();
    expect(within(shop).queryByText(/レシピを解放すると/)).not.toBeInTheDocument();
    expect(within(shop).queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("C. a few-item early Shop shows the progression hint alongside the real row (not instead of it)", async () => {
    const user = userEvent.setup();
    seedSaveV2({
      pitzBalance: 200,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...FEW],
      inventory: { mushroom: 3 },
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(shop).getByText("レシピを解放すると、買える材料が増えます")).toBeInTheDocument();
    expect(within(shop).getByText("マッシュルーム")).toBeInTheDocument();
    expect(within(shop).getByRole("tablist")).toBeInTheDocument();
  });

  it("D. a progressed Shop (>= threshold products) no longer shows the progression hint", async () => {
    const user = userEvent.setup();
    seedSaveV2({
      pitzBalance: 500,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...MANY],
      inventory: Object.fromEntries(MANY.map((id) => [id, 5])),
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;
    expect(within(shop).queryByText(/レシピを解放すると/)).not.toBeInTheDocument();
    expect(within(shop).getAllByRole("button", { name: "補充する" }).length).toBe(MANY.length);
  });

  it("E. category filtering narrows the visible list to that category only", async () => {
    const user = userEvent.setup();
    seedSaveV2({
      pitzBalance: 500,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "olive-oil", "gorgonzola", "mushroom", "onion"],
      inventory: { "olive-oil": 3, gorgonzola: 6, mushroom: 9, onion: 12 },
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;

    await user.click(within(shop).getByRole("tab", { name: "ソース" }));
    expect(within(shop).getByText("オリーブオイル")).toBeInTheDocument();
    expect(within(shop).queryByText("ゴルゴンゾーラ")).not.toBeInTheDocument();
    expect(within(shop).queryByText("マッシュルーム")).not.toBeInTheDocument();

    await user.click(within(shop).getByRole("tab", { name: "トッピング" }));
    expect(within(shop).getByText("マッシュルーム")).toBeInTheDocument();
    expect(within(shop).getByText("たまねぎ")).toBeInTheDocument();
    expect(within(shop).queryByText("オリーブオイル")).not.toBeInTheDocument();

    await user.click(within(shop).getByRole("tab", { name: "すべて" }));
    expect(within(shop).getByText("オリーブオイル")).toBeInTheDocument();
    expect(within(shop).getByText("ゴルゴンゾーラ")).toBeInTheDocument();
    expect(within(shop).getByText("マッシュルーム")).toBeInTheDocument();
  });

  it("F. a category with zero purchasable items shows a short empty state, not a broken list", async () => {
    const user = userEvent.setup();
    // Owns sauce/cheese products only -- topping is a real, populated category in the game
    // (garlic/oregano/mushroom/... ) but this player owns none of it yet.
    seedSaveV2({
      pitzBalance: 200,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "olive-oil", "gorgonzola"],
      inventory: { "olive-oil": 3, gorgonzola: 6 },
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;

    await user.click(within(shop).getByRole("tab", { name: "トッピング" }));
    expect(within(shop).getByText(/このカテゴリで買える材料はまだありません/)).toBeInTheDocument();
    // Still early game overall (2 < 8) -- the category-empty state may add the same
    // progression hint, but never a broken-looking blank list.
    expect(within(shop).queryByText("在庫")).not.toBeInTheDocument();
  });

  it("G/H. restock still works after filtering, at the exact same price/quantity as unfiltered", async () => {
    const user = userEvent.setup();
    seedSaveV2({
      pitzBalance: 200,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion", "olive-oil"],
      inventory: { onion: 2, "olive-oil": 3 },
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;

    await user.click(within(shop).getByRole("tab", { name: "トッピング" }));
    expect(within(shop).queryByText("オリーブオイル")).not.toBeInTheDocument();
    expect(within(shop).getByText(/170 Pitz/)).toBeInTheDocument(); // onion's price, unchanged
    await user.click(within(shop).getByRole("button", { name: "補充する" }));
    expect(within(shop).getByText(/在庫 14/)).toBeInTheDocument(); // 2 + 12 (onion's restockQuantity, unchanged)
    expect(within(shop).getByText(/30 Pitz/)).toBeInTheDocument(); // 200 - 170, unchanged
  });

  it("I/J. a starterGrantOnly ingredient the player doesn't own stays hidden in every filter tab", async () => {
    const user = userEvent.setup();
    // onion not owned -- starterGrantOnly means it must never show as LOCKED/AVAILABLE_TO_BUY,
    // in any tab, even the "トッピング" category it belongs to.
    seedSaveV2({
      pitzBalance: 999,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom"],
      inventory: { mushroom: 9 },
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;

    await user.click(within(shop).getByRole("tab", { name: "すべて" }));
    expect(within(shop).queryByText("たまねぎ")).not.toBeInTheDocument();
    await user.click(within(shop).getByRole("tab", { name: "トッピング" }));
    expect(within(shop).queryByText("たまねぎ")).not.toBeInTheDocument();
    expect(within(shop).getByText("マッシュルーム")).toBeInTheDocument();
  });

  it("K. switching filter tabs never mutates Pitz balance, stock, or ownership", async () => {
    const user = userEvent.setup();
    seedSaveV2({
      pitzBalance: 321,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion", "olive-oil"],
      inventory: { onion: 7, "olive-oil": 3 },
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ショップ/ }));
    const shop = document.querySelector<HTMLElement>(".dex-overlay")!;

    await user.click(within(shop).getByRole("tab", { name: "ソース" }));
    await user.click(within(shop).getByRole("tab", { name: "トッピング" }));
    await user.click(within(shop).getByRole("tab", { name: "すべて" }));

    expect(screen.getByLabelText("Pitz残高 321")).toBeInTheDocument();
    expect(within(shop).getByText(/在庫 7/)).toBeInTheDocument();
    expect(within(shop).getByText(/在庫 3/)).toBeInTheDocument();
  });
});
