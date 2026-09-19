import { findOrderForRecipe, getNextOrder, type NextOrderOptions, type Order } from "../data/orders";
import { getRecipe, type Recipe, type RecipeId } from "../data/recipes";
import { buildHintLine } from "../data/hints";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { DialogueLine } from "../data/dialogue";
import type { ScoreBreakdown } from "../logic/scoring";
import { classifyBake, type BakeState } from "../logic/bake";
import { computeScoringV2, toLegacyScoreBreakdown, type ScoringV2Result } from "../logic/scoringV2";
import { totalStars } from "../logic/mastery";
import { purchaseIngredient } from "../logic/economy";
import { applyPitzCredit, type PitzCredit } from "../logic/pitzReward";
import { discoveredRecipeIds, registerScoreToDex, EMPTY_DEX, type DexState } from "./dex";
import { availableRecipeIds, isRecipeAvailable } from "./progression";
import { EMPTY_INVENTORY, type InventoryState } from "./inventory";
import { pickMissionOrder } from "../mission/lunchRush";
import { isInsideDough } from "../logic/pizzaCoordinates";
import { isValidDoughShape, type DoughShape } from "../logic/doughShape";
import {
  createEmptyPizza,
  findOpenSpot,
  isValidSauceDepositBatch,
  type PizzaState,
  type PlacementFeedback,
  type SauceDeposit,
} from "./pizzaState";

export type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "RESULT" | "DISCOVERED";

/** Issue #32 Phase 2: the canonical, reducer-authoritative sub-step of the PREPARE phase's
 *  making flow -- DOUGH -> SAUCE -> CHEESE -> TOPPING, one-way only (see
 *  CONFIRM_MAKING_STEP below). A string union rather than a numeric index so Issue #33 could
 *  prepend "DOUGH" (now done) without renumbering anything else. `activeCategory` (App.tsx)
 *  is a *view* of this field, never the other way around -- the reducer is the only place
 *  this contract is enforced. */
export type MakingStep = "DOUGH" | "SAUCE" | "CHEESE" | "TOPPING";

const MAKING_STEP_ORDER: readonly MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"];

function nextMakingStep(step: MakingStep): MakingStep {
  const index = MAKING_STEP_ORDER.indexOf(step);
  return MAKING_STEP_ORDER[Math.min(index + 1, MAKING_STEP_ORDER.length - 1)];
}

export interface GameState {
  phase: GamePhase;
  order: Order;
  recipe: Recipe;
  pizza: PizzaState;
  /** Issue #32 Phase 2 / Issue #33 D1: which making step (DOUGH/SAUCE/CHEESE/TOPPING) is
   *  currently open for interaction. Always "DOUGH" for a fresh round (`buildOrderState`
   *  below) and after RESET_PIZZA -- a discarded pizza re-enters the making flow at the
   *  start. Only CONFIRM_MAKING_STEP advances it, and only forward. */
  makingStep: MakingStep;
  /** Bumped by CONFIRM_MAKING_STEP (and by RESET_PIZZA alongside its own `makingStep` reset)
   *  so PizzaStage/IngredientTray's existing `resetToken`-style gesture-abort effects can key
   *  off a step transition exactly like they already key off a whole-pizza reset -- a gesture
   *  in flight when a step confirms must not be able to commit into the step that follows it. */
  makingStepToken: number;
  score: ScoreBreakdown | null;
  bakeState: BakeState | null;
  /** Phase 4A-2 / A1: Scoring 2.0's own result (src/logic/scoringV2/), computed once at
   *  CONFIRM_BAKE from the exact canonical pizza that was just baked -- never App.tsx's
   *  UI-only live-preview useMemo (see ../logic/scoringV2/index.ts's own file header). This IS
   *  what `score` above is derived from that same CONFIRM_BAKE case, via
   *  `toLegacyScoreBreakdown` -- i.e. it feeds `score`/Dex/Mission/progression, it is not a
   *  side channel. Additive/transient only: never persisted (src/state/persistence.ts never
   *  serializes GameState at all). Null until the first CONFIRM_BAKE of a round, and reset to
   *  null for every fresh round (`buildOrderState` below) so a stale previous round's result
   *  can never leak into a new one's PREPARE/BAKE phases. */
  scoringV2Result: ScoringV2Result | null;
  dex: DexState;
  /** Canonical OWNED ingredient ids (Phase 3C-3+). Always a superset of the Starter Set.
   *  Mutated by PURCHASE_INGREDIENT (Phase 3C-5); every other action carries it through
   *  unchanged from the previous round. */
  ownedIngredientIds: readonly string[];
  /** Canonical Pitz balance (Phase 3C-5, SSOT section 3). Mutated by PURCHASE_INGREDIENT
   *  (spend) and CLAIM_MISSION_REWARD (earn) only -- never by anything else, including the
   *  round machinery itself (making/serving a pizza never touches this directly). */
  pitzBalance: number;
  /** Save v2 / Inventory E1: canonical consumable stock, keyed by ingredient id
   *  (../state/inventory.ts). Separate from `ownedIngredientIds` -- this is "how many units
   *  remain," not "can this ever be placed." No reducer case mutates this in E1 (that's E2's
   *  job); every action that isn't a "start a new round" path carries it through unchanged via
   *  its existing `{ ...state, ... }` pattern, same as `ownedIngredientIds` today. */
  inventory: InventoryState;
  /** Idempotency key for CLAIM_MISSION_REWARD (Phase 3C-5): the Mission run id
   *  (`MissionState.runId`, ../mission/lunchRush.ts) whose Pitz reward has already been
   *  applied to `pitzBalance`. A run's reward is granted at most once no matter how many
   *  times CLAIM_MISSION_REWARD is dispatched for it (rerenders, StrictMode double effects,
   *  Dex/overlay toggling, ...) -- see that action's reducer case below. `null` until the
   *  first Mission run in this session completes; deliberately not persisted (Mission run
   *  identity has no meaning across a reload, same as `MissionState` itself). */
  lastClaimedMissionRunId: number | null;
  /** True for the whole lifetime of a Mission round. Sauce parity deliberately does not use
   *  this as an interaction gate: FREE and Lunch Rush resolve the same recipe sauce profile
   *  and dispatch through the same reducer action. Transient only; never persisted. */
  isMissionRound: boolean;
  justDiscovered: boolean;
  /** True when REGISTER_TO_DEX just improved this recipe's Dex BEST (including its very
   *  first discovery, which trivially sets the first BEST). RESULT/DISCOVERED UI uses this
   *  to show a "NEW BEST!" moment for repeat plays specifically. */
  justGotNewBest: boolean;
  hint: DialogueLine | null;
  placement: PlacementFeedback | null;
  /** Issue #38 E-P1/E-P2: canonical transient RESULT/DISCOVERED display snapshot for the
   *  per-pizza Pitz credit `REGISTER_TO_DEX` just applied (../logic/pitzReward.ts) -- the display
   *  layer reads these five numbers rather than recomputing any of them (same discipline
   *  `scoringV2Result` already follows). `null` until `REGISTER_TO_DEX` actually credits a round
   *  (FREE only -- Lunch Rush's `MISSION_NEXT_ORDER` never sets this, so it never leaks a
   *  per-pizza number into Lunch Rush's own unchanged per-run reward), and reset to `null` for
   *  every fresh round (`buildOrderState` below) so a stale previous round's credit can never
   *  leak into a new one. Never persisted -- transient exactly like `score`/`scoringV2Result`. */
  lastPitzCredit: PitzCredit | null;
}

export type GameAction =
  | { type: "BEGIN_PREPARE" }
  | { type: "APPLY_SAUCE"; ingredientId: string; x: number; y: number }
  // Commits one complete, already-finished recipe-sauce dispense gesture
  // (src/logic/sauceDispenseController.ts) as a single atomic batch -- PizzaStage buffers
  // every tick locally while the gesture is in progress and only ever dispatches this once,
  // at a successful pointerup. A cancelled/discarded gesture (pointercancel, lost pointer
  // capture, an ingredient change or Reference-overlay-open mid-hold, a BAKE abort, or
  // component unmount) never dispatches this at all, so canonical pizza state can never
  // reflect a stroke the player didn't actually finish. The reducer validates the ingredient
  // against the current recipe's shared sauce profile for both FREE and Lunch Rush.
  | { type: "COMMIT_SAUCE_DISPENSE"; ingredientId: string; deposits: SauceDeposit[] }
  | { type: "PLACE_TOPPING"; ingredientId: string; x: number; y: number }
  // Issue #33 D1: commits one complete DOUGH radial-stretch gesture's final shape as a
  // single atomic replacement of `pizza.doughShape` -- mirrors COMMIT_SAUCE_DISPENSE's own
  // "PizzaStage buffers locally, dispatches once at a successful pointerup" contract
  // (position-driven rather than tick-driven, so there is no accumulated deposit log to
  // append here, just the gesture's final radii). A cancelled/discarded gesture
  // (pointercancel, lost pointer capture, blur/hidden, a reset or step change mid-hold, or
  // component unmount) never dispatches this at all -- see PizzaStage's DOUGH gesture branch.
  | { type: "COMMIT_DOUGH_STRETCH"; shape: DoughShape }
  // Issue #32 Phase 2: the one reducer-authoritative transition for the making flow's
  // DOUGH -> SAUCE -> CHEESE -> TOPPING sub-steps (see MakingStep above). Advances
  // `makingStep` one step forward and bumps `makingStepToken`; a no-op past "TOPPING" or
  // outside PREPARE. TOPPING -> BAKE remains a separate, pre-existing transition
  // (START_BAKE) -- this action never touches `phase`. Issue #33 D1: deliberately ungated at
  // the reducer layer for DOUGH -> SAUCE too, exactly like every other step -- the size
  // completion threshold is a UI-only CTA-disabled gate (GameScreen), not a reducer rule.
  | { type: "CONFIRM_MAKING_STEP" }
  | { type: "RESET_PIZZA" }
  | { type: "START_BAKE" }
  | { type: "CONFIRM_BAKE"; value: number }
  | { type: "REGISTER_TO_DEX" }
  | { type: "PLAY_AGAIN" }
  // Issue #39 (Pizza Select): starts a fresh FREE round for an explicitly player-chosen
  // recipe -- structurally identical to PLAY_AGAIN's `nextOrderState` case, just keyed by an
  // explicit id instead of "not the current recipe." Never touches Mission's own order
  // selection (MISSION_NEXT_ORDER/MISSION_RESET_ORDER, still `getNextOrder`-random). Rejects
  // (returns `state` unchanged) a recipe that isn't currently available, mirroring
  // PURCHASE_INGREDIENT's "reject invalid, return state unchanged" pattern -- Pizza Select's
  // UI already never wires a LOCKED card's button to this, but a stray/forced dispatch must
  // still be unable to start a locked recipe's round. Issue #47 Finding C: Pizza Select
  // already made the recipe choice explicit, so this lands straight at PREPARE (see
  // `startPreparingRecipe` below) instead of the old, now-redundant FREE-mode ORDER gate.
  | { type: "SELECT_RECIPE"; recipeId: RecipeId }
  // Issue #47 Finding D: RESULT/DISCOVERED's "もう一度つくる" -- retries the *exact same*
  // recipe just played (unlike PLAY_AGAIN, which explicitly excludes it). Reuses
  // `startPreparingRecipe`'s own body keyed to `state.recipe.id`, so it lands at a fresh
  // PREPARE the same way SELECT_RECIPE does. A no-op if the current recipe somehow has no
  // order (should never happen for a recipe the player just played).
  | { type: "RETRY_SAME_RECIPE" }
  | { type: "SHOW_HINT" }
  // Phase 3C-4 (Lunch Rush): both below reuse this same round machinery (an ORDER phase with
  // a freshly-picked, available recipe) -- there is no separate Mission round state. See
  // src/mission/lunchRush.ts's top comment for the canonical/derived boundary this keeps.
  | { type: "MISSION_NEXT_ORDER" }
  | { type: "MISSION_RESET_ORDER" }
  // Phase 3C-5 (Pitz + Shop): both reuse the pure economy rules in ../logic/economy.ts --
  // this reducer only applies their result, it never computes a price or a reward itself.
  | { type: "PURCHASE_INGREDIENT"; ingredientId: string }
  | { type: "CLAIM_MISSION_REWARD"; runId: number; amount: number };

/** Progression fields every "start a new round" path must carry forward unchanged --
 *  factored out so `buildOrderState`'s signature can't silently drop one when a new field is
 *  added here later. */
interface ProgressionCarry {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  pitzBalance: number;
  lastClaimedMissionRunId: number | null;
  inventory: InventoryState;
}

/** Builds a fresh ORDER-phase state around an already-picked `order` -- the one place that
 *  resets pizza/score/bakeState/hint/placement/justDiscovered/justGotNewBest for a new round,
 *  shared by every "start a new round" path (free play's `nextOrderState` below, and Mission's
 *  MISSION_NEXT_ORDER/MISSION_RESET_ORDER) so they can never drift out of sync on what a
 *  "fresh round" resets. Everything in `carry` (Dex, owned ingredients, Pitz balance, claimed
 *  Mission run id) passes through untouched -- a new round never resets progression.
 *  `isMissionRound` is set explicitly by each caller (never carried) since it describes the
 *  round about to start, not something to preserve from the previous one. */
function buildOrderState(order: Order, carry: ProgressionCarry, isMissionRound: boolean): GameState {
  const recipe = getRecipe(order.recipeId);
  if (!recipe) {
    throw new Error(`Unknown recipe for order ${order.id}`);
  }
  return {
    phase: "ORDER",
    order,
    recipe,
    pizza: createEmptyPizza(),
    // Issue #33 D1 (D0 revalidation §R.4 item 1): every "start a new round" path shares this
    // one literal -- nextOrderState/FREE, nextMissionOrderState/Lunch Rush, and
    // startPreparingRecipe/SELECT_RECIPE+RETRY_SAME_RECIPE all route through here, so a fresh
    // dough ball is what every one of them starts at, with no per-path edit needed.
    makingStep: "DOUGH",
    makingStepToken: 0,
    score: null,
    bakeState: null,
    scoringV2Result: null,
    ...carry,
    isMissionRound,
    justDiscovered: false,
    justGotNewBest: false,
    hint: null,
    placement: null,
    lastPitzCredit: null,
  };
}

/** Every free-play "start a new round" path (initial state, PLAY_AGAIN, exiting Mission to
 *  free) goes through here -- always `isMissionRound: false`. */
function nextOrderState(carry: ProgressionCarry, orderOptions: NextOrderOptions): GameState {
  const order = getNextOrder({
    ...orderOptions,
    dex: discoveredRecipeIds(carry.dex),
    availableRecipeIds: availableRecipeIds(carry.dex, carry.ownedIngredientIds),
  });
  return buildOrderState(order, carry, false);
}

/** Picks a fresh Mission order (see ../mission/lunchRush.ts's `pickMissionOrder`) and builds
 *  the ORDER-phase state around it -- always `isMissionRound: true`. Shared by
 *  MISSION_NEXT_ORDER and MISSION_RESET_ORDER so both pick a Mission order the exact same
 *  way and both mark the round as Mission's identically. */
function nextMissionOrderState(state: GameState): GameState {
  const ids = availableRecipeIds(state.dex, state.ownedIngredientIds);
  const order = pickMissionOrder(ids, state.recipe.id);
  return buildOrderState(
    order,
    {
      dex: state.dex,
      ownedIngredientIds: state.ownedIngredientIds,
      pitzBalance: state.pitzBalance,
      lastClaimedMissionRunId: state.lastClaimedMissionRunId,
      inventory: state.inventory,
    },
    true,
  );
}

/** Issue #47 Finding C/D: builds a fresh PREPARE-phase state around an explicitly chosen
 *  recipe's order -- the ORDER-phase state `buildOrderState` produces, immediately advanced
 *  the same way BEGIN_PREPARE advances it (phase -> "PREPARE", hint built from the fresh
 *  empty pizza). Shared by SELECT_RECIPE (Pizza Select's own pick) and RETRY_SAME_RECIPE
 *  (RESULT/DISCOVERED's "もう一度つくる"), since both skip the now-redundant FREE-mode ORDER
 *  gate the same way. Returns `null` if `recipeId` has no order (SELECT_RECIPE additionally
 *  guards availability before calling this; RETRY_SAME_RECIPE's recipeId is always the one
 *  just played, so this should never actually miss for it).
 */
function startPreparingRecipe(recipeId: RecipeId, carry: ProgressionCarry): GameState | null {
  const order = findOrderForRecipe(recipeId);
  if (!order) return null;
  const orderState = buildOrderState(order, carry, false);
  return {
    ...orderState,
    phase: "PREPARE",
    hint: buildHintLine(orderState.recipe, orderState.pizza, orderState.makingStep),
  };
}

/** `dex` defaults to empty, `ownedIngredientIds` defaults to the Starter Set, and
 *  `pitzBalance` defaults to 0 for existing call sites (tests, a from-scratch player);
 *  App.tsx passes all three in from persistence.ts so a reload hydrates BEST/timesMade/
 *  ownership/Pitz while everything else (the round in progress) starts fresh at ORDER
 *  regardless. */
export function createInitialGameState(
  dex: DexState = EMPTY_DEX,
  ownedIngredientIds: readonly string[] = STARTER_INGREDIENT_IDS,
  pitzBalance = 0,
  inventory: InventoryState = EMPTY_INVENTORY,
): GameState {
  return nextOrderState(
    { dex, ownedIngredientIds, pitzBalance, lastClaimedMissionRunId: null, inventory },
    { preferFirst: true },
  );
}

let placedIdCounter = 0;
let placementTokenCounter = 0;

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "BEGIN_PREPARE":
      return {
        ...state,
        phase: "PREPARE",
        hint: buildHintLine(state.recipe, state.pizza, state.makingStep),
      };

    case "APPLY_SAUCE": {
      // Issue #32 Phase 2: sauce is only ever legal while PREPARE is still on the SAUCE
      // making step -- this also closes a pre-existing gap (this action previously had no
      // `phase` guard at all, let alone a step guard).
      if (state.phase !== "PREPARE" || state.makingStep !== "SAUCE") return state;
      // Ownership boundary (Phase 3C-6 follow-up): IngredientTray only ever offers owned
      // ingredients (src/components/IngredientTray.tsx filters by `ownedIngredientIds`), but
      // this guard makes that the UI's job, not its only safeguard -- a LOCKED/AVAILABLE_TO_BUY
      // ingredient id can never be applied even if it somehow reaches this action (a stray
      // dispatch, a future UI bug, ...). A no-op, same shape as PURCHASE_INGREDIENT's own
      // "unknown/invalid id -> return state unchanged" guard below.
      if (!state.ownedIngredientIds.includes(action.ingredientId)) return state;
      const pizza: PizzaState = {
        ...state.pizza,
        sauceIds: [action.ingredientId],
        sauceOrigin: { x: action.x, y: action.y },
        sauceToken: state.pizza.sauceToken + 1,
        // A single-commit APPLY_SAUCE always replaces whatever sauce was there, deposit
        // log included -- this is the one-shot path (every recipe but the Margherita
        // Reference prototype's tomato sauce, plus Mission play), so any stale Phase
        // 4A-1A deposits from a since-abandoned dispense session can never linger into it.
        sauceDeposits: [],
      };
      return { ...state, pizza, hint: buildHintLine(state.recipe, pizza, state.makingStep) };
    }

    // Phase 4A-1A (Post-Codex-Fix, MUST FIX 2 -- Reducer Scope Guard): commits one complete
    // dispense gesture's worth of deposits as a single atomic batch. Every condition below
    // is independently enforced here, at the reducer/action boundary -- never trusted from
    // the UI alone -- so a stale, late, or malformed action can never mutate canonical pizza
    // state for BAKE/RESULT/ORDER or a non-sauce ingredient, whatever PizzaStage/App.tsx
    // intended to gate. FREE and Lunch Rush deliberately share this same boundary.
    //
    // Issue #32 sauce parity fix: this used to additionally require
    // `action.ingredientId === getRecipeSauceProfile(state.recipe.id).ingredientId`, rejecting
    // (silent no-op) any sauce that didn't match the current recipe -- PizzaStage's UI then
    // fell back to the legacy one-shot APPLY_SAUCE path for that case, so picking a sauce that
    // didn't match the recipe painted instantly at full coverage instead of gradually like the
    // recipe-correct one (Fresh Audit Finding 1-B). Recipe/Purity scoring already reacts to a
    // wrong `sauceIds[0]` normally either way (it never depended on this guard) -- so any of
    // the three sauce ingredients may now use this same incremental dispense path, matching
    // and required for the recipe or not.
    case "COMMIT_SAUCE_DISPENSE": {
      // Issue #32 Phase 2: same making-step gate as APPLY_SAUCE -- a dispense session that
      // straddles a step confirmation (or is dispatched after one) must never mutate the
      // pizza. PizzaStage's `makingStepToken`-keyed abort effect is what stops the gesture
      // itself from surviving long enough to dispatch this in the first place; this is the
      // reducer-boundary backstop that holds even if that abort somehow didn't fire.
      if (state.phase !== "PREPARE" || state.makingStep !== "SAUCE") return state;
      if (getIngredient(action.ingredientId)?.category !== "sauce") return state;
      if (!state.ownedIngredientIds.includes(action.ingredientId)) return state;
      if (!isValidSauceDepositBatch(action.deposits)) return state;

      const isFreshApplication = state.pizza.sauceIds[0] !== action.ingredientId;
      const firstPoint = action.deposits[0];
      const pizza: PizzaState = {
        ...state.pizza,
        sauceIds: [action.ingredientId],
        sauceOrigin: isFreshApplication
          ? { x: firstPoint.x, y: firstPoint.y }
          : state.pizza.sauceOrigin,
        sauceToken: isFreshApplication ? state.pizza.sauceToken + 1 : state.pizza.sauceToken,
        sauceDeposits: [
          ...(isFreshApplication ? [] : state.pizza.sauceDeposits),
          ...action.deposits,
        ],
      };
      return { ...state, pizza, hint: buildHintLine(state.recipe, pizza, state.makingStep) };
    }

    case "PLACE_TOPPING": {
      // Phase 4A-1B: a tray drag can finish after PREPARE was synchronously left by a
      // second pointer (BAKE/overlay/navigation). Reject the late commit at the canonical
      // boundary, independent of component cleanup.
      if (state.phase !== "PREPARE") return state;
      if (!Number.isFinite(action.x) || !Number.isFinite(action.y)) return state;
      if (!isInsideDough(action.x, action.y)) return state;
      // Same ownership boundary as APPLY_SAUCE above.
      if (!state.ownedIngredientIds.includes(action.ingredientId)) return state;
      // Issue #32 Phase 2: PLACE_TOPPING is shared by both CHEESE and TOPPING ingredients
      // (see src/data/ingredients.ts) -- gate on the ingredient's own category against the
      // current making step, not merely `phase`, so cheese can't be placed during TOPPING (or
      // vice versa). An ingredient in neither making-flow category (or an unknown id) can
      // never be placed via this action.
      const placingIngredient = getIngredient(action.ingredientId);
      if (!placingIngredient) return state;
      if (placingIngredient.category === "cheese" && state.makingStep !== "CHEESE") return state;
      if (placingIngredient.category === "topping" && state.makingStep !== "TOPPING") return state;
      if (placingIngredient.category === "sauce") return state;
      const spot = findOpenSpot(state.pizza.toppings, action.x, action.y);
      placementTokenCounter += 1;

      if (!spot) {
        return {
          ...state,
          placement: {
            status: "rejected",
            x: action.x,
            y: action.y,
            token: placementTokenCounter,
          },
        };
      }

      placedIdCounter += 1;
      const pizza: PizzaState = {
        ...state.pizza,
        toppings: [
          ...state.pizza.toppings,
          {
            id: `topping-${placedIdCounter}`,
            ingredientId: action.ingredientId,
            x: spot.x,
            y: spot.y,
          },
        ],
      };
      const wasAdjusted = spot.x !== action.x || spot.y !== action.y;
      return {
        ...state,
        pizza,
        hint: buildHintLine(state.recipe, pizza, state.makingStep),
        placement: {
          status: wasAdjusted ? "adjusted" : "placed",
          x: spot.x,
          y: spot.y,
          token: placementTokenCounter,
        },
      };
    }

    case "RESET_PIZZA": {
      // Issue #32 Phase 2: whole-pizza discard/restart is the explicit recovery path, but it
      // only ever makes sense while a round is still being made -- a stray/direct dispatch
      // during BAKE/RESULT/DISCOVERED must not silently blank a pizza those phases are
      // displaying/scored from (previously unguarded). A discarded pizza also re-enters the
      // making flow at its start, so `makingStep` resets to "DOUGH" alongside it (Issue #33
      // D1, D0 revalidation §R.4 item 2 -- this literal is independent of buildOrderState's
      // own, so both had to move together), bumping `makingStepToken` the same way
      // CONFIRM_MAKING_STEP does so any gesture from the pre-reset pizza is invalidated by
      // the same mechanism.
      if (state.phase !== "PREPARE") return state;
      const pizza = createEmptyPizza();
      return {
        ...state,
        pizza,
        makingStep: "DOUGH",
        makingStepToken: state.makingStepToken + 1,
        hint: buildHintLine(state.recipe, pizza, "DOUGH"),
        placement: null,
      };
    }

    // Issue #33 D1: the DOUGH step's own commit action -- see its own GameAction doc comment
    // above for the full contract. Independently re-checks phase/makingStep here (never
    // trusted from PizzaStage alone), same belt-and-suspenders discipline as
    // COMMIT_SAUCE_DISPENSE, so a gesture that somehow survives past a step change can never
    // mutate canonical state for the wrong step.
    case "COMMIT_DOUGH_STRETCH": {
      if (state.phase !== "PREPARE" || state.makingStep !== "DOUGH") return state;
      if (!isValidDoughShape(action.shape)) return state;
      const pizza: PizzaState = { ...state.pizza, doughShape: action.shape };
      return { ...state, pizza };
    }

    // Issue #32 Phase 2: the one reducer-authoritative transition for the making flow's
    // sub-steps. Forward-only (DOUGH -> SAUCE -> CHEESE -> TOPPING, clamped past TOPPING --
    // reaching BAKE is the pre-existing, separate START_BAKE transition) and a no-op outside
    // PREPARE, so a direct dispatch can never advance a step that isn't open yet or move a
    // round that has already left PREPARE.
    case "CONFIRM_MAKING_STEP": {
      if (state.phase !== "PREPARE") return state;
      const makingStep = nextMakingStep(state.makingStep);
      if (makingStep === state.makingStep) return state;
      // Issue #33 D1: recompute `hint` for the step actually being entered -- every other
      // step's hint already happened to stay accurate across a step confirm purely from
      // `pizza`'s own ingredient content (unchanged by this action), but DOUGH's new
      // step-only hint branch (buildHintLine, data/hints.ts) doesn't naturally "expire" that
      // way, so without this the SAUCE step could briefly show DOUGH's own hint text until
      // the player's first sauce action recomputed it. Zero behavior change for every other
      // transition (same recipe, same unchanged pizza -> same hint text as before).
      return {
        ...state,
        makingStep,
        makingStepToken: state.makingStepToken + 1,
        hint: buildHintLine(state.recipe, state.pizza, makingStep),
      };
    }

    case "START_BAKE":
      return { ...state, phase: "BAKE" };

    case "CONFIRM_BAKE": {
      const pizza: PizzaState = { ...state.pizza, bakeResult: action.value };
      const bakeState = classifyBake(action.value, state.recipe.bakeTarget);
      // A1 Authority Cutover: Scoring 2.0 (../logic/scoringV2/) is now authoritative for
      // `state.score` -- computed here, from this exact canonical `pizza`, the one and only
      // Scoring 2.0 call site, shared by FREE and Lunch Rush alike (both dispatch this same
      // action; see ../logic/scoringV2/index.ts's own file header). `toLegacyScoreBreakdown`
      // adapts it into the `ScoreBreakdown` shape every downstream consumer already reads
      // formula-agnostically (see ../logic/scoringV2/toLegacyScoreBreakdown.ts). The legacy
      // `scorePizza` formula (previously ../logic/scoring.ts) was retired in A3b -- Scoring 2.0
      // is the sole scoring authority now.
      const scoringV2Result = computeScoringV2(state.recipe, pizza);
      const score = toLegacyScoreBreakdown(scoringV2Result, action.value, state.recipe.bakeTarget);
      return { ...state, pizza, score, bakeState, scoringV2Result, phase: "RESULT" };
    }

    case "REGISTER_TO_DEX": {
      // Only a RESULT with a score can register. This makes the Dex update atomic per
      // round: a stray or repeated dispatch (e.g. after the phase has already moved on to
      // DISCOVERED) can never double-count timesMade or re-evaluate BEST for the same round.
      // Issue #38 E-P1/E-P2: the same guard is what makes the Pitz credit below exactly-once
      // too -- a second dispatch against the post-transition state (phase already DISCOVERED)
      // is rejected here before either Dex or Pitz is touched a second time (Pattern A, see
      // docs/reports/TETO_ISSUE-38_PITZ-REWARD_Fresh-Audit.md sec. 3).
      if (state.phase !== "RESULT" || !state.score) {
        return state;
      }
      const { dex, wasNewDiscovery, isNewBest } = registerScoreToDex(
        state.dex,
        state.recipe.id,
        state.score,
      );
      // FREE only: Lunch Rush keeps its existing, unchanged per-run reward
      // (calculateMissionReward via CLAIM_MISSION_REWARD/MISSION_NEXT_ORDER) -- this per-pizza
      // credit must never also apply inside a Mission round, or a Lunch Rush pizza would earn
      // Pitz twice under two different formulas. Registration UI itself already never renders
      // during a Mission round (ResultPanel is gated on `!isMissionActive`), but this guard is
      // the reducer-level backstop, not just a UI convention.
      const lastPitzCredit = state.isMissionRound
        ? null
        : applyPitzCredit(state.recipe.baseRewardPitz, state.score.total, state.pitzBalance);
      return {
        ...state,
        dex,
        justDiscovered: wasNewDiscovery,
        justGotNewBest: isNewBest,
        phase: "DISCOVERED",
        pitzBalance: lastPitzCredit ? lastPitzCredit.balanceAfter : state.pitzBalance,
        lastPitzCredit,
      };
    }

    case "PLAY_AGAIN":
      return nextOrderState(
        {
          dex: state.dex,
          ownedIngredientIds: state.ownedIngredientIds,
          pitzBalance: state.pitzBalance,
          lastClaimedMissionRunId: state.lastClaimedMissionRunId,
          inventory: state.inventory,
        },
        { excludeRecipeId: state.recipe.id },
      );

    case "SELECT_RECIPE": {
      const recipe = getRecipe(action.recipeId);
      if (!recipe || !isRecipeAvailable(recipe, state.dex, state.ownedIngredientIds)) return state;
      return (
        startPreparingRecipe(action.recipeId, {
          dex: state.dex,
          ownedIngredientIds: state.ownedIngredientIds,
          pitzBalance: state.pitzBalance,
          lastClaimedMissionRunId: state.lastClaimedMissionRunId,
          inventory: state.inventory,
        }) ?? state
      );
    }

    case "RETRY_SAME_RECIPE":
      return (
        startPreparingRecipe(state.recipe.id, {
          dex: state.dex,
          ownedIngredientIds: state.ownedIngredientIds,
          pitzBalance: state.pitzBalance,
          lastClaimedMissionRunId: state.lastClaimedMissionRunId,
          inventory: state.inventory,
        }) ?? state
      );

    // Registers the current RESULT into the Dex (same rule as REGISTER_TO_DEX: BEST never
    // goes down, timesMade always increments once) and, in the same step, advances straight
    // to the next Mission order -- deliberately skipping DISCOVERED so Mission's serve flow
    // never pays the DISCOVERED overlay's pacing cost (SSOT section 11 / Phase 3C-4 scope).
    // Same atomicity guarantee as REGISTER_TO_DEX: only valid from a RESULT with a score, so
    // a stray/repeated dispatch can never double-register a round.
    case "MISSION_NEXT_ORDER": {
      if (state.phase !== "RESULT" || !state.score) {
        return state;
      }
      const { dex } = registerScoreToDex(state.dex, state.recipe.id, state.score);
      return nextMissionOrderState({ ...state, dex });
    }

    // Forces a fresh Mission order regardless of the current phase -- used when a Mission run
    // starts or retries, since the underlying round could be sitting anywhere (idle at ORDER,
    // or frozen mid-PREPARE/BAKE/RESULT if the previous run's timer expired mid-round).
    case "MISSION_RESET_ORDER":
      return nextMissionOrderState(state);

    case "SHOW_HINT":
      return { ...state, hint: buildHintLine(state.recipe, state.pizza, state.makingStep, true) };

    // Applies one purchase transaction (../logic/economy.ts's `purchaseIngredient`, the only
    // place the LOCKED/AVAILABLE_TO_BUY/OWNED/price rules are evaluated). A failed purchase
    // (locked, already owned, insufficient funds, not for sale) returns `state` completely
    // unchanged -- there is no partial-failure state to represent. A successful purchase
    // updates `ownedIngredientIds` and `pitzBalance` together in the same step, so the two can
    // never drift out of sync (a charge without an unlock, or vice versa).
    case "PURCHASE_INGREDIENT": {
      const ingredient = getIngredient(action.ingredientId);
      if (!ingredient) return state;
      const result = purchaseIngredient({
        ingredient,
        ownedIngredientIds: state.ownedIngredientIds,
        totalStars: totalStars(state.dex),
        pitzBalance: state.pitzBalance,
      });
      if (!result.success) return state;
      return {
        ...state,
        ownedIngredientIds: result.nextOwnedIngredientIds,
        pitzBalance: result.nextPitzBalance,
      };
    }

    // Grants one Mission run's Pitz reward (../logic/economy.ts's `calculateMissionReward`,
    // computed by the caller and passed in as `action.amount` -- this reducer never computes
    // the amount itself). Idempotent per `runId`: once a given run's reward has been applied,
    // every subsequent CLAIM_MISSION_REWARD for that *same* runId is a no-op, no matter how
    // many times it's dispatched (a rerender, a StrictMode double effect invocation, opening/
    // closing the Dex, ...) -- this is what makes "grant exactly once per run" hold
    // structurally rather than depending on an effect only ever firing once. A fresh
    // `runId` (assigned by missionRunReducer's START, ../mission/lunchRush.ts, including on
    // retry) always gets its own grant.
    case "CLAIM_MISSION_REWARD": {
      if (state.lastClaimedMissionRunId === action.runId) return state;
      const amount = Math.max(0, action.amount);
      return {
        ...state,
        pitzBalance: state.pitzBalance + amount,
        lastClaimedMissionRunId: action.runId,
      };
    }

    default:
      return state;
  }
}
