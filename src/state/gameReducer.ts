import { getNextOrder, type NextOrderOptions, type Order } from "../data/orders";
import { getRecipe, type Recipe } from "../data/recipes";
import { buildHintLine } from "../data/hints";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { DialogueLine } from "../data/dialogue";
import { scorePizza, type ScoreBreakdown } from "../logic/scoring";
import { classifyBake, type BakeState } from "../logic/bake";
import { totalStars } from "../logic/mastery";
import { purchaseIngredient } from "../logic/economy";
import { discoveredRecipeIds, registerScoreToDex, EMPTY_DEX, type DexState } from "./dex";
import { availableRecipeIds } from "./progression";
import { pickMissionOrder } from "../mission/lunchRush";
import { isInsideDough } from "../logic/pizzaCoordinates";
import { getReferencePizza } from "../data/referencePizza";
import {
  createEmptyPizza,
  findOpenSpot,
  isValidSauceDepositBatch,
  type PizzaState,
  type PlacementFeedback,
  type SauceDeposit,
} from "./pizzaState";

export type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "RESULT" | "DISCOVERED";

export interface GameState {
  phase: GamePhase;
  order: Order;
  recipe: Recipe;
  pizza: PizzaState;
  score: ScoreBreakdown | null;
  bakeState: BakeState | null;
  dex: DexState;
  /** Canonical OWNED ingredient ids (Phase 3C-3+). Always a superset of the Starter Set.
   *  Mutated by PURCHASE_INGREDIENT (Phase 3C-5); every other action carries it through
   *  unchanged from the previous round. */
  ownedIngredientIds: readonly string[];
  /** Canonical Pitz balance (Phase 3C-5, SSOT section 3). Mutated by PURCHASE_INGREDIENT
   *  (spend) and CLAIM_MISSION_REWARD (earn) only -- never by anything else, including the
   *  round machinery itself (making/serving a pizza never touches this directly). */
  pitzBalance: number;
  /** Idempotency key for CLAIM_MISSION_REWARD (Phase 3C-5): the Mission run id
   *  (`MissionState.runId`, ../mission/lunchRush.ts) whose Pitz reward has already been
   *  applied to `pitzBalance`. A run's reward is granted at most once no matter how many
   *  times CLAIM_MISSION_REWARD is dispatched for it (rerenders, StrictMode double effects,
   *  Dex/overlay toggling, ...) -- see that action's reducer case below. `null` until the
   *  first Mission run in this session completes; deliberately not persisted (Mission run
   *  identity has no meaning across a reload, same as `MissionState` itself). */
  lastClaimedMissionRunId: number | null;
  /** Codex Broad Review MUST FIX 2 (Reducer Scope Guard): true for the whole lifetime of a
   *  Mission round (set by MISSION_RESET_ORDER/MISSION_NEXT_ORDER's shared
   *  `nextMissionOrderState`, cleared by every free-play round-start path), read directly by
   *  COMMIT_SAUCE_DISPENSE's own guard below. This makes "the Phase 4A-1A Reference/Quantity
   *  Prototype never applies during Mission play" a fact the reducer itself enforces from its
   *  own state -- not a contract the dispatch site (App.tsx) has to uphold correctly on its
   *  own every time, and not something a caller can spoof via the action payload. Transient
   *  only: never read or written by persistence.ts (a round in progress is never persisted). */
  isMissionRound: boolean;
  justDiscovered: boolean;
  /** True when REGISTER_TO_DEX just improved this recipe's Dex BEST (including its very
   *  first discovery, which trivially sets the first BEST). RESULT/DISCOVERED UI uses this
   *  to show a "NEW BEST!" moment for repeat plays specifically. */
  justGotNewBest: boolean;
  hint: DialogueLine | null;
  placement: PlacementFeedback | null;
}

export type GameAction =
  | { type: "BEGIN_PREPARE" }
  | { type: "APPLY_SAUCE"; ingredientId: string; x: number; y: number }
  // Phase 4A-1A (Post-Codex-Fix, MUST FIX 7 -- Cancel Transaction): commits one *complete,
  // already-finished* tomato-sauce dispense gesture from the Margherita Reference prototype
  // (src/logic/sauceDispenseController.ts) as a single atomic batch -- PizzaStage buffers
  // every tick locally while the gesture is in progress and only ever dispatches this once,
  // at a successful pointerup. A cancelled/discarded gesture (pointercancel, lost pointer
  // capture, an ingredient change or Reference-overlay-open mid-hold, a BAKE abort, or
  // component unmount) never dispatches this at all, so canonical pizza state can never
  // reflect a stroke the player didn't actually finish. Distinct from APPLY_SAUCE (which
  // every other ingredient/recipe/Mission path still uses unchanged) so this prototype-only
  // mechanic can never affect anything outside its own gate -- see this action's own reducer
  // case for the full validation contract (MUST FIX 2).
  | { type: "COMMIT_SAUCE_DISPENSE"; ingredientId: string; deposits: SauceDeposit[] }
  | { type: "PLACE_TOPPING"; ingredientId: string; x: number; y: number }
  | { type: "RESET_PIZZA" }
  | { type: "START_BAKE" }
  | { type: "CONFIRM_BAKE"; value: number }
  | { type: "REGISTER_TO_DEX" }
  | { type: "PLAY_AGAIN" }
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
    score: null,
    bakeState: null,
    ...carry,
    isMissionRound,
    justDiscovered: false,
    justGotNewBest: false,
    hint: null,
    placement: null,
  };
}

/** Every free-play "start a new round" path (initial state, PLAY_AGAIN, exiting Mission to
 *  free) goes through here -- always `isMissionRound: false`. */
function nextOrderState(carry: ProgressionCarry, orderOptions: NextOrderOptions): GameState {
  const order = getNextOrder({
    ...orderOptions,
    dex: discoveredRecipeIds(carry.dex),
    availableRecipeIds: availableRecipeIds(carry.ownedIngredientIds),
  });
  return buildOrderState(order, carry, false);
}

/** Picks a fresh Mission order (see ../mission/lunchRush.ts's `pickMissionOrder`) and builds
 *  the ORDER-phase state around it -- always `isMissionRound: true`. Shared by
 *  MISSION_NEXT_ORDER and MISSION_RESET_ORDER so both pick a Mission order the exact same
 *  way and both mark the round as Mission's identically. */
function nextMissionOrderState(state: GameState): GameState {
  const ids = availableRecipeIds(state.ownedIngredientIds);
  const order = pickMissionOrder(ids, state.recipe.id);
  return buildOrderState(
    order,
    {
      dex: state.dex,
      ownedIngredientIds: state.ownedIngredientIds,
      pitzBalance: state.pitzBalance,
      lastClaimedMissionRunId: state.lastClaimedMissionRunId,
    },
    true,
  );
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
): GameState {
  return nextOrderState(
    { dex, ownedIngredientIds, pitzBalance, lastClaimedMissionRunId: null },
    { preferFirst: true },
  );
}

let placedIdCounter = 0;
let placementTokenCounter = 0;

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "BEGIN_PREPARE":
      return { ...state, phase: "PREPARE", hint: buildHintLine(state.recipe, state.pizza) };

    case "APPLY_SAUCE": {
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
      return { ...state, pizza, hint: buildHintLine(state.recipe, pizza) };
    }

    // Phase 4A-1A (Post-Codex-Fix, MUST FIX 2 -- Reducer Scope Guard): commits one complete
    // dispense gesture's worth of deposits as a single atomic batch. Every condition below
    // is independently enforced here, at the reducer/action boundary -- never trusted from
    // the UI alone -- so a stale, late, or malformed action can never mutate canonical pizza
    // state for BAKE/RESULT/ORDER, a non-Margherita recipe, a non-tomato-sauce ingredient, or
    // (via `isMissionRound`) a Mission round, whatever PizzaStage/App.tsx intended to gate.
    case "COMMIT_SAUCE_DISPENSE": {
      if (state.phase !== "PREPARE") return state;
      if (state.isMissionRound) return state;
      const reference = getReferencePizza(state.recipe.id);
      if (!reference || reference.sauce.ingredientId !== action.ingredientId) return state;
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
      return { ...state, pizza, hint: buildHintLine(state.recipe, pizza) };
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
        hint: buildHintLine(state.recipe, pizza),
        placement: {
          status: wasAdjusted ? "adjusted" : "placed",
          x: spot.x,
          y: spot.y,
          token: placementTokenCounter,
        },
      };
    }

    case "RESET_PIZZA": {
      const pizza = createEmptyPizza();
      return { ...state, pizza, hint: buildHintLine(state.recipe, pizza), placement: null };
    }

    case "START_BAKE":
      return { ...state, phase: "BAKE" };

    case "CONFIRM_BAKE": {
      const pizza: PizzaState = { ...state.pizza, bakeResult: action.value };
      const score = scorePizza(state.recipe, pizza);
      const bakeState = classifyBake(action.value, state.recipe.bakeTarget);
      return { ...state, pizza, score, bakeState, phase: "RESULT" };
    }

    case "REGISTER_TO_DEX": {
      // Only a RESULT with a score can register. This makes the Dex update atomic per
      // round: a stray or repeated dispatch (e.g. after the phase has already moved on to
      // DISCOVERED) can never double-count timesMade or re-evaluate BEST for the same round.
      if (state.phase !== "RESULT" || !state.score) {
        return state;
      }
      const { dex, wasNewDiscovery, isNewBest } = registerScoreToDex(
        state.dex,
        state.recipe.id,
        state.score,
      );
      return {
        ...state,
        dex,
        justDiscovered: wasNewDiscovery,
        justGotNewBest: isNewBest,
        phase: "DISCOVERED",
      };
    }

    case "PLAY_AGAIN":
      return nextOrderState(
        {
          dex: state.dex,
          ownedIngredientIds: state.ownedIngredientIds,
          pitzBalance: state.pitzBalance,
          lastClaimedMissionRunId: state.lastClaimedMissionRunId,
        },
        { excludeRecipeId: state.recipe.id },
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
      return { ...state, hint: buildHintLine(state.recipe, state.pizza, true) };

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
