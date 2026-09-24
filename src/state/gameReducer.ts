import { findOrderForRecipe, getNextOrder, type NextOrderOptions, type Order } from "../data/orders";
import { getRecipe, type Recipe, type RecipeId } from "../data/recipes";
import {
  getCookingProfile,
  postBakeSteps,
  preBakeSteps,
  type CookingProfile,
} from "../data/cookingProfiles";
import { applyStarterGrants, buildStarterGrantNotice, type StarterGrantNotice } from "./starterStock";
import { buildHintLine } from "../data/hints";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { DialogueLine } from "../data/dialogue";
import type { ScoreBreakdown } from "../logic/scoring";
import { classifyBake, type BakeState } from "../logic/bake";
import {
  advanceStepTiming,
  finishCookingTiming,
  pauseCookingTiming,
  resumeCookingTiming,
  startCookingTiming,
  type CookingTimingState,
} from "../logic/cookingTiming";
import { computeScoringV2, toLegacyScoreBreakdown, type ScoringV2Result } from "../logic/scoringV2";
import { evaluatePizzaCompletion, type PizzaCompletionResult } from "../logic/completionGate";
import { totalStars } from "../logic/mastery";
import { purchaseIngredient, restockIngredient } from "../logic/economy";
import { applyPitzCredit, type PitzCredit } from "../logic/pitzReward";
import { evaluateCookingEfficiency, type CookingEfficiencyCredit } from "../logic/efficiency";
import { discoveredRecipeIds, isDiscovered, registerScoreToDex, EMPTY_DEX, type DexState } from "./dex";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { evaluateDiscovery, type DiscoveryOutcome } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { registerDiscoveryToDex } from "./discoveryRegistration";
import { FREE_COOK_ORDER, FREE_COOK_RECIPE } from "../data/freeCook";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { availableRecipeIds, isRecipeAvailable } from "./progression";
import {
  canPlaceIngredient,
  consumePizzaInventory,
  EMPTY_INVENTORY,
  type InventoryState,
} from "./inventory";
import { pickMissionOrder } from "../mission/lunchRush";
import { isInsideDough } from "../logic/pizzaCoordinates";
import {
  addCutLine,
  createCutState,
  evaluateCutState,
  undoLastCutLine,
  type CutState,
} from "../logic/cut/state";
import { isEdgeToEdgeCutLine, resolveRequestedSliceCount, type CutLine } from "../logic/cut/types";
import { requiredCutCount } from "../logic/cut/evaluation";
import { isDuplicateCutLine } from "../logic/cut/geometry";
import { isValidDoughShape, type DoughShape } from "../logic/doughShape";
import {
  createEmptyPizza,
  findOpenSpot,
  isValidSauceDepositBatch,
  type PizzaState,
  type PlacementFeedback,
  type SauceDeposit,
} from "./pizzaState";

/** Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §8): adds
 *  `POST_BAKE`, a phase between BAKE and RESULT that hosts any step a recipe's `CookingProfile`
 *  places after BAKE (CUT/FINISH). Every one of the 15 shipped recipes has an empty post-BAKE
 *  step list (`../data/cookingProfiles.ts`'s `DEFAULT_COOKING_PROFILE`), so `CONFIRM_BAKE` below
 *  skips `POST_BAKE` entirely and lands directly on `RESULT` for all of them, exactly as before
 *  this phase -- `POST_BAKE` is reachable only via a recipe-specific profile, and Phase 1A
 *  activates none. */
export type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "POST_BAKE" | "RESULT" | "DISCOVERED";

/** Issue #32 Phase 2: the canonical, reducer-authoritative sub-step of the PREPARE/POST_BAKE
 *  phases' making flow, one-way only (see CONFIRM_MAKING_STEP below). A string union rather than
 *  a numeric index so Issue #33 could prepend "DOUGH" (now done) without renumbering anything
 *  else. `activeCategory` (App.tsx) is a *view* of this field, never the other way around -- the
 *  reducer is the only place this contract is enforced.
 *
 *  Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §8): widened
 *  from the original 4-value union (DOUGH/SAUCE/CHEESE/TOPPING) to represent every step the
 *  design doc's taxonomy (§3) names, so a future recipe's `CookingProfile`
 *  (../data/cookingProfiles.ts) and Phase 1A-T's per-step timing (§22.2) can be typed against the
 *  full set now. CUT/FOLD/SEAL/EDGE_FILL/FINISH have zero gameplay behind them in this phase --
 *  no reducer case, no UI, no `CookingProfile` entry ever produces one of these five for any of
 *  the 15 shipped recipes (`DEFAULT_COOKING_PROFILE` never includes them) -- they exist purely so
 *  the type is representable ahead of the step-implementation phases that will give each one real
 *  behavior (design doc §21's roadmap). */
export type MakingStep = "DOUGH" | "SAUCE" | "CHEESE" | "TOPPING" | "FOLD" | "SEAL" | "EDGE_FILL" | "CUT" | "FINISH";

/** Generalizes the old module-level `MAKING_STEP_ORDER`/`nextMakingStep` (Issue #32 Phase 2) into
 *  a pure, order-agnostic "advance one step within this list, clamped at the end" helper --
 *  Recipe Cooking Steps 1.0 Phase 1A (§8) now calls this with the *active round's* own
 *  `preBakeSteps(state.cookingProfile)`/`postBakeSteps(state.cookingProfile)` instead of one
 *  global constant, so a recipe-specific sequence can be walked the exact same way the fixed one
 *  always was. For every recipe on `DEFAULT_COOKING_PROFILE`, `steps` here is always exactly
 *  `["DOUGH", "SAUCE", "CHEESE", "TOPPING"]` -- byte-identical to the pre-Phase-1A behavior. */
function nextStepWithin(step: MakingStep, steps: readonly MakingStep[]): MakingStep {
  const index = steps.indexOf(step);
  return steps[Math.min(index + 1, steps.length - 1)];
}

export interface GameState {
  phase: GamePhase;
  order: Order;
  recipe: Recipe;
  /** Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §8):
   *  snapshotted once per round (`buildOrderState`/`startPreparingRecipe` below, mirroring how
   *  `recipe` itself is already snapshotted), the same way `getReferencePizza` is looked up
   *  on demand rather than stored -- except this *is* stored, because `nextStepWithin` below
   *  needs a stable ordered list to walk for the whole round, not a value re-derived per call.
   *  `preBakeSteps`/`postBakeSteps` (../data/cookingProfiles.ts) derive the active PREPARE/
   *  POST_BAKE sub-sequence from this on demand. Never persisted -- transient exactly like
   *  `pizza`/`score` (`state/persistence.ts` never serializes `GameState`). */
  cookingProfile: CookingProfile;
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
  /** Completion Gate Phase 1 (../logic/completionGate.ts): PASS/FAILED for the exact pizza
   *  `scoringV2Result` was just computed from, at the same CONFIRM_BAKE step. FAILED gates
   *  REGISTER_TO_DEX's own Dex/BEST/Starter-Grant/Pitz side effects (see that case below) --
   *  Scoring 2.0 itself is computed either way (never gated on this), since a FAILED pizza's
   *  score is simply never used, not undefined. Null until the first CONFIRM_BAKE of a round,
   *  reset to null for every fresh round, same lifecycle as `scoringV2Result`. */
  completion: PizzaCompletionResult | null;
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
  /** Economy & Progression 1.0 EP4: the exactly-once Starter Grant ledger (../state/
   *  starterStock.ts's `applyStarterGrants`) -- every recipe id whose free Starter Stock has
   *  ever been credited to `inventory`/`ownedIngredientIds`, so a later call (this round's own
   *  REGISTER_TO_DEX/MISSION_NEXT_ORDER, a future round, a reload, a future Achievement Reset)
   *  can never grant it a second time. Deliberately a separate concept from `dex`'s own
   *  discovery/unlock state -- "is this recipe currently unlocked" and "has its Starter Grant
   *  ever been claimed" must never be conflated, or a future Dex reset would either re-grant
   *  (if conflated one way) or permanently softlock the recipe after a reset (if conflated the
   *  other way). Mutated only by `applyStarterGrants`'s own callers (REGISTER_TO_DEX,
   *  MISSION_NEXT_ORDER below, and App.tsx's load-time migration catch-up) -- every other action
   *  carries it through unchanged, exactly like `ownedIngredientIds`/`inventory` themselves. */
  starterGrantClaimedRecipeIds: readonly string[];
  /** Progression 2.0 Phase 3-3 (Issue #198): how many free-cook rounds in a row have resolved
   *  to something other than a new match (ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH/FAILED,
   *  `CONFIRM_BAKE`'s own `freeCook.kind !== "MATCHED"` branch below) while the Dex is still
   *  completely empty -- drives `buildHintLine`'s pre-first-discovery hint escalation
   *  (../data/hints.ts). Carried through every "fresh round" path via `ProgressionCarry` (unlike
   *  `hint`/`lastPitzCredit`/..., it must survive a retry, not reset each round, or the
   *  escalation could never advance); frozen the instant any recipe is ever discovered, since
   *  `CONFIRM_BAKE` only increments it while the Dex has zero discoveries. Transient -- never
   *  persisted, always starts at 0 for a fresh session load, same as every other `lastX`
   *  discovery/reward snapshot on this type. */
  preDiscoveryFreeCookAttempts: number;
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
  /** Economy Tuning 1 P1: canonical transient DISCOVERED display snapshot for the Starter Grant
   *  `REGISTER_TO_DEX` just applied (../state/starterStock.ts's `buildStarterGrantNotice`) --
   *  `null` on every call that granted nothing (already-claimed, margherita, or no newly-unlocked
   *  recipe), and reset to `null` for every fresh round (`buildOrderState` below), exactly like
   *  `lastPitzCredit` above. Never persisted, never set by `MISSION_NEXT_ORDER` (Lunch Rush skips
   *  DISCOVERED entirely, so there is nowhere to show it -- the reset above still clears any stale
   *  value before the next order). */
  lastStarterGrantNotice: StarterGrantNotice | null;
  /** Cooking Time CT1/CT2: deterministic FREE-only "active making" timing (../logic/
   *  cookingTiming.ts), spanning `BEGIN_PREPARE`/an equivalent fresh-PREPARE entry (SELECT_RECIPE,
   *  RETRY_SAME_RECIPE) through `START_BAKE` -- BAKE's own needle-tap minigame is deliberately
   *  excluded (Fresh Audit boundary recommendation D). Always `null` for a Mission round
   *  (`isMissionRound`) -- Lunch Rush keeps its own unrelated `MissionClock`
   *  (../mission/lunchRush.ts) untouched, and this field is never read by any Mission/Scoring
   *  code path (CT2's own Efficiency bonus below is FREE-only for the same reason). Never
   *  persisted (`persistence.ts` never serializes `GameState`, same as `score`/`scoringV2Result`
   *  above). `completedMs` stays populated (not reset) across REGISTER_TO_DEX's RESULT ->
   *  DISCOVERED transition (that is in fact exactly where CT2's `lastEfficiencyCredit` below
   *  reads it from) and across DISCOVERED -> a same-order RESET_PIZZA is not possible (RESET_PIZZA
   *  is PREPARE-only); every "start a new round" path resets this to `null` via
   *  `buildOrderState`/`startPreparingRecipe` below, same as `score`/`scoringV2Result`. **CT2
   *  policy change**: `RESET_PIZZA` (mid-PREPARE discard/redo) is *not* one of the "start a new
   *  round" paths that resets this -- see its own reducer case below for why the same run's clock
   *  now continues through a reset uninterrupted, superseding CT1's original "fresh timer on
   *  reset" behavior (see docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md's RESET policy
   *  section for the full A/B/C comparison this decision is based on). */
  cookingTiming: CookingTimingState | null;
  /** Cooking Time CT2: canonical transient RESULT/DISCOVERED display+reward snapshot for this
   *  round's "手際" (Efficiency) evaluation (../logic/efficiency.ts) -- `null` whenever
   *  `lastPitzCredit` is also `null` (Mission round) or `cookingTiming.completedMs` never
   *  finalized (should not happen for a FREE round that reached RESULT). Strictly additive to
   *  `lastPitzCredit`: never read by `computeScoringV2`/`ScoreBreakdown.total`, and never folded
   *  into `pitzReward.ts`'s own `baseReward x qualityMultiplier` -- `REGISTER_TO_DEX` adds
   *  `bonusPitz` on top of `lastPitzCredit.balanceAfter` when crediting `pitzBalance`. Reset to
   *  `null` for every fresh round exactly like `lastPitzCredit`. */
  lastEfficiencyCredit: CookingEfficiencyCredit | null;
  /** Progression 2.0 Phase 3-1 (Issue #192): what REGISTER_TO_DEX's signature match
   *  (../logic/discovery/) concluded for this round's pizza -- a new discovery, an already
   *  discovered recipe, an original pizza (no match), an ambiguous match, or an exact match to
   *  another recipe whose own Completion Gate failed. FREE only (`null` for a Mission round, same
   *  as `lastPitzCredit`), `null` until REGISTER_TO_DEX credits a round, and reset for every fresh
   *  round. Not rendered by any UI in this slice; never persisted. */
  lastDiscovery: DiscoveryOutcome | null;
  /** Progression 2.0 Phase 3-2 (Issue #194): true for a free-cook round (START_FREE_COOK) -- no
   *  recipe was selected, the tray offers every OWNED ingredient, and CONFIRM_BAKE decides what
   *  the pizza is with the Phase 3-1 matcher (../logic/discovery/freeCook.ts). Until CONFIRM_BAKE
   *  `recipe` is the inert `FREE_COOK_RECIPE` sentinel; a matched pizza then carries the matched
   *  recipe so scoring/Dex/Pitz run through the unchanged recipe path. Stays true through
   *  RESULT/DISCOVERED so "もう一度つくる" restarts free cooking. Always false for Lunch Rush and
   *  recipe-guided rounds (`buildOrderState`); transient, never persisted. */
  freeCook: boolean;
  /** Pizza Cutting 1.0 Phase 2 (docs/design/TETO_PIZZA-CUTTING_1.0.md §11): the CUT step's own
   *  transient state (../logic/cut/state.ts's `CutState` -- `config`/`lines`/`evaluation`),
   *  reused wholesale rather than split into separate `cutLines`/`cutResult` fields, per Phase
   *  1's own handoff note (its Result Report §23: "ready to be the implementation a
   *  `GameState.cutState`-shaped reducer slice delegates to, rather than reimplemented").
   *  Always present (never `null`) -- fresh every round via `createCutState(cookingProfile.
   *  cutConfig)` (`buildOrderState` below), exactly as inert for the 14 non-CUT recipes as
   *  `cookingProfile.cutConfig` itself is absent for them. Never persisted -- transient exactly
   *  like `pizza`/`cookingTiming`. */
  cutState: CutState;
}

export type GameAction =
  // Cooking Time CT1: `now` is optional so every pre-existing call site (production and the
  // ~50 tests that dispatch this with no timing concern at all) keeps compiling unchanged --
  // omitting it simply leaves `cookingTiming` at `null` (timing not measured for that
  // dispatch), it is never defaulted to `Date.now()` inside this reducer. App.tsx's real
  // dispatch always passes it; see ../logic/cookingTiming.ts's own file header for why the
  // reducer itself must never read the wall clock.
  | { type: "BEGIN_PREPARE"; now?: number }
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
  //
  // Recipe Cooking Steps 1.0 Phase 1A-T (design doc §22.2/§22.11): `now` is optional, same
  // back-compat convention as BEGIN_PREPARE/START_BAKE/SELECT_RECIPE/RETRY_SAME_RECIPE --
  // omitting it simply leaves `cookingTiming`'s per-step fields untouched by this dispatch
  // (never defaulted to `Date.now()` inside the reducer). When present, it finalizes the
  // outgoing step's `perStepElapsedMs` entry and starts the incoming step's own window; see the
  // reducer case below.
  | { type: "CONFIRM_MAKING_STEP"; now?: number }
  // Cooking Time CT2: no `now` payload -- unlike BEGIN_PREPARE/START_BAKE/SELECT_RECIPE/
  // RETRY_SAME_RECIPE, this action never starts, finishes, or otherwise touches `cookingTiming`
  // at all (see its own reducer case below). CT1 originally gave this a `now?: number` and
  // treated a reset as starting the timed attempt over; re-decided for CT2 now that an
  // Efficiency bonus exists to game -- a fresh timer on every reset would let a player "re-roll"
  // a slow start for free, so the same run's clock now continues through a reset uninterrupted
  // instead (see docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md's RESET policy section).
  // Phase 1A-T: this also means per-step timing is left exactly as untouched as the whole-round
  // clock -- `activeStep`/`stepStartedAt` carry straight through a discard/redo (§22.11).
  | { type: "RESET_PIZZA" }
  | { type: "START_BAKE"; now?: number }
  // Recipe Cooking Steps 1.0 Phase 1A-T: `now` is optional, same convention as above -- when
  // present and the recipe's profile lands the round on POST_BAKE (none of the 15 shipped
  // recipes do), starts timing that phase's first step. No-op for `cookingTiming` on every
  // profile without post-BAKE steps, whether or not `now` is supplied.
  | { type: "CONFIRM_BAKE"; value: number; now?: number }
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
  | { type: "SELECT_RECIPE"; recipeId: RecipeId; now?: number }
  // Issue #47 Finding D: RESULT/DISCOVERED's "もう一度つくる" -- retries the *exact same*
  // recipe just played (unlike PLAY_AGAIN, which explicitly excludes it). Reuses
  // `startPreparingRecipe`'s own body keyed to `state.recipe.id`, so it lands at a fresh
  // PREPARE the same way SELECT_RECIPE does. A no-op if the current recipe somehow has no
  // order (should never happen for a recipe the player just played).
  | { type: "RETRY_SAME_RECIPE"; now?: number }
  // Progression 2.0 Phase 3-2 (Issue #194): starts a fresh FREE round with no recipe selected
  // (HOME's フリークッキング). Lands straight at PREPARE like SELECT_RECIPE. Never a Mission round.
  | { type: "START_FREE_COOK"; now?: number }
  | { type: "SHOW_HINT" }
  // Phase 3C-4 (Lunch Rush): both below reuse this same round machinery (an ORDER phase with
  // a freshly-picked, available recipe) -- there is no separate Mission round state. See
  // src/mission/lunchRush.ts's top comment for the canonical/derived boundary this keeps.
  | { type: "MISSION_NEXT_ORDER" }
  | { type: "MISSION_RESET_ORDER" }
  // Phase 3C-5 (Pitz + Shop): both reuse the pure economy rules in ../logic/economy.ts --
  // this reducer only applies their result, it never computes a price or a reward itself.
  | { type: "PURCHASE_INGREDIENT"; ingredientId: string }
  | { type: "CLAIM_MISSION_REWARD"; runId: number; amount: number }
  // Economy & Progression 1.0 EP3 (Shop 2.0 restock): a *separate* transaction from
  // PURCHASE_INGREDIENT above -- see ../logic/economy.ts's `restockIngredient` doc comment for
  // why the two are never merged. Repeatable, unlike PURCHASE_INGREDIENT's exactly-once grant.
  | { type: "RESTOCK_INGREDIENT"; ingredientId: string }
  // Cooking Time CT1: the only minimal pause boundary this slice implements -- driven by
  // App.tsx from the exact same `isReferencePopoverOpen`/`isGlobalOverlayOpen` signals that
  // already gate PizzaStage interactivity during PREPARE (GameScreen.tsx's own
  // `interactive={...}` condition), not a new detection mechanism. No `visibilitychange`/
  // `blur` wiring here -- see cookingTiming's own module header / the Implementation Result
  // report's "CT2 recommended scope" for why that is deliberately deferred, not an oversight.
  // Both are no-ops outside PREPARE or once `cookingTiming` is already finished/absent
  // (Mission rounds always have it `null`), so a stray dispatch can never affect BAKE/RESULT
  // or leak into a Mission round.
  | { type: "PAUSE_COOKING_TIMING"; now: number }
  | { type: "RESUME_COOKING_TIMING"; now: number }
  // Pizza Cutting 1.0 Phase 2 (design doc §2.2/§15.3): commits one complete edge-to-edge drag
  // gesture (../logic/cut/types.ts's `buildRimToRimCutLine`, already clamped to a genuine
  // rim-to-rim chord by the gesture layer) as a single atomic line -- mirrors
  // COMMIT_DOUGH_STRETCH's own "gesture layer buffers locally, dispatches once at a successful
  // pointerup" contract. Rejected (state unchanged) outside POST_BAKE's own CUT step, for a
  // line that isn't genuinely edge-to-edge, or once the cut limit (`requiredCutCount + 2`) is
  // already reached -- see the reducer case below for the full independent-of-the-UI guard.
  | { type: "ADD_CUT_LINE"; line: CutLine }
  // design doc §8.4: removes exactly the most recently committed line ("1本戻す"). A no-op
  // outside POST_BAKE's own CUT step or with zero lines to undo.
  | { type: "UNDO_CUT_LINE" };

/** Progression fields every "start a new round" path must carry forward unchanged --
 *  factored out so `buildOrderState`'s signature can't silently drop one when a new field is
 *  added here later. */
interface ProgressionCarry {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  pitzBalance: number;
  lastClaimedMissionRunId: number | null;
  inventory: InventoryState;
  starterGrantClaimedRecipeIds: readonly string[];
  preDiscoveryFreeCookAttempts: number;
}

/** Builds a fresh ORDER-phase state around an already-picked `order` -- the one place that
 *  resets pizza/score/bakeState/hint/placement/justDiscovered/justGotNewBest for a new round,
 *  shared by every "start a new round" path (free play's `nextOrderState` below, and Mission's
 *  MISSION_NEXT_ORDER/MISSION_RESET_ORDER) so they can never drift out of sync on what a
 *  "fresh round" resets. Everything in `carry` (Dex, owned ingredients, Pitz balance, claimed
 *  Mission run id) passes through untouched -- a new round never resets progression.
 *  `isMissionRound` is set explicitly by each caller (never carried) since it describes the
 *  round about to start, not something to preserve from the previous one. */
function buildOrderState(
  order: Order,
  carry: ProgressionCarry,
  isMissionRound: boolean,
  freeCook = false,
): GameState {
  const recipe = freeCook ? FREE_COOK_RECIPE : getRecipe(order.recipeId);
  if (!recipe) {
    throw new Error(`Unknown recipe for order ${order.id}`);
  }
  const cookingProfile = getCookingProfile(recipe.id);
  return {
    phase: "ORDER",
    order,
    recipe,
    cookingProfile,
    pizza: createEmptyPizza(),
    // Pizza Cutting 1.0 Phase 2: fresh every round, from this round's own profile -- the one
    // place `cutState` is (re)created, shared by every "start a new round" path exactly like
    // `pizza`/`cookingTiming` above, so a previous pizza's cut lines/evaluation can never leak
    // into a new one (design doc's own RESET/recipe-change semantics).
    cutState: createCutState(cookingProfile.cutConfig),
    // Issue #33 D1 (D0 revalidation §R.4 item 1): every "start a new round" path shares this
    // one literal -- nextOrderState/FREE, nextMissionOrderState/Lunch Rush, and
    // startPreparingRecipe/SELECT_RECIPE+RETRY_SAME_RECIPE all route through here, so a fresh
    // dough ball is what every one of them starts at, with no per-path edit needed.
    makingStep: "DOUGH",
    makingStepToken: 0,
    score: null,
    bakeState: null,
    scoringV2Result: null,
    completion: null,
    cookingTiming: null,
    ...carry,
    isMissionRound,
    justDiscovered: false,
    justGotNewBest: false,
    hint: null,
    placement: null,
    lastPitzCredit: null,
    lastStarterGrantNotice: null,
    lastEfficiencyCredit: null,
    lastDiscovery: null,
    freeCook,
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
  const discoveredIds = discoveredRecipeIds(state.dex) as RecipeId[];
  const order = pickMissionOrder(ids, discoveredIds, state.recipe.id);
  // Issue #200: an empty discovered ∩ available pool must fail closed. The HOME gate normally
  // prevents Mission at Dex 0, but a stray lower-level dispatch must never fall back to an
  // undiscovered order.
  if (!order) return state;
  return buildOrderState(
    order,
    {
      dex: state.dex,
      ownedIngredientIds: state.ownedIngredientIds,
      pitzBalance: state.pitzBalance,
      lastClaimedMissionRunId: state.lastClaimedMissionRunId,
      inventory: state.inventory,
      starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
      preDiscoveryFreeCookAttempts: state.preDiscoveryFreeCookAttempts,
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
 *
 * Cooking Time CT1: this path lands at PREPARE directly, without ever dispatching
 * `BEGIN_PREPARE` -- so it must start `cookingTiming` itself (`now` optional, same convention
 * as every other CT1 action) rather than relying on a BEGIN_PREPARE case that never runs here.
 * Always `false` for `isMissionRound` (see `buildOrderState` above), so this never needs an
 * `isMissionRound` check the way BEGIN_PREPARE's own reducer case does.
 */
function startPreparingRecipe(
  recipeId: RecipeId,
  carry: ProgressionCarry,
  now?: number,
): GameState | null {
  const order = findOrderForRecipe(recipeId);
  if (!order) return null;
  return startPreparing(buildOrderState(order, carry, false), now);
}

/** Progression 2.0 Phase 3-2: the free-cook counterpart of `startPreparingRecipe` -- the same
 *  fresh round (`buildOrderState` resets pizza/score/lastDiscovery/...), with the inert
 *  `FREE_COOK_RECIPE` sentinel instead of a selected recipe. */
function startFreeCook(carry: ProgressionCarry, now?: number): GameState {
  return startPreparing(buildOrderState(FREE_COOK_ORDER, carry, false, true), now);
}

function startPreparing(orderState: GameState, now?: number): GameState {
  return {
    ...orderState,
    phase: "PREPARE",
    hint: buildHintLine(
      orderState.recipe,
      orderState.pizza,
      orderState.makingStep,
      false,
      orderState.preDiscoveryFreeCookAttempts,
    ),
    cookingTiming: now !== undefined ? startCookingTiming(now, orderState.makingStep) : null,
  };
}

/** `dex` defaults to empty, `ownedIngredientIds` defaults to the Starter Set, and
 *  `pitzBalance` defaults to 0 for existing call sites (tests, a from-scratch player);
 *  App.tsx passes all four (plus EP4's `starterGrantClaimedRecipeIds`) in from persistence.ts so
 *  a reload hydrates BEST/timesMade/ownership/Pitz/the Starter Grant ledger while everything
 *  else (the round in progress) starts fresh at ORDER regardless. Deliberately a pure
 *  passthrough -- this never itself calls `applyStarterGrants` (../state/starterStock.ts),
 *  unlike REGISTER_TO_DEX/MISSION_NEXT_ORDER below, so a caller that hands it an already-unlocked
 *  `dex` alongside a deliberately smaller `ownedIngredientIds` (as many existing tests do, to
 *  exercise `isRecipeAvailable`'s ingredient-ownership axis in isolation) keeps getting back
 *  exactly the state it asked for. App.tsx's own load path is the one place that runs the EP4
 *  migration catch-up explicitly, before calling this. */
export function createInitialGameState(
  dex: DexState = EMPTY_DEX,
  ownedIngredientIds: readonly string[] = STARTER_INGREDIENT_IDS,
  pitzBalance = 0,
  inventory: InventoryState = EMPTY_INVENTORY,
  starterGrantClaimedRecipeIds: readonly string[] = [],
): GameState {
  return nextOrderState(
    {
      dex,
      ownedIngredientIds,
      pitzBalance,
      lastClaimedMissionRunId: null,
      inventory,
      starterGrantClaimedRecipeIds,
      preDiscoveryFreeCookAttempts: 0,
    },
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
        hint: buildHintLine(
          state.recipe,
          state.pizza,
          state.makingStep,
          false,
          state.preDiscoveryFreeCookAttempts,
        ),
        // Cooking Time CT1: FREE only -- this same action also fires for Lunch Rush's
        // continuous per-pizza flow (App.tsx's handleMissionServeNext, right after
        // MISSION_NEXT_ORDER, which already set `isMissionRound: true` before this case ever
        // runs), and Mission must never accumulate a Cooking Time of its own alongside its
        // existing MissionClock (../mission/lunchRush.ts, untouched).
        cookingTiming:
          !state.isMissionRound && action.now !== undefined
            ? startCookingTiming(action.now, state.makingStep)
            : null,
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
      // EP3 Stock Gate: a reservation/limit check only (never a consumption -- CONFIRM_BAKE's
      // consumePizzaInventory remains the sole place stock is actually decremented). No shipped
      // spread ingredient is finite today (only `onion`, scatter/topping), so this is a no-op
      // for every current sauce -- see canPlaceIngredient's own doc comment (../state/inventory.ts).
      const sauceIngredient = getIngredient(action.ingredientId);
      if (!sauceIngredient || !canPlaceIngredient(sauceIngredient, state.inventory, state.pizza)) {
        return state;
      }
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
      return {
        ...state,
        pizza,
        hint: buildHintLine(state.recipe, pizza, state.makingStep, false, state.preDiscoveryFreeCookAttempts),
      };
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
      const dispenseIngredient = getIngredient(action.ingredientId);
      if (dispenseIngredient?.category !== "sauce") return state;
      if (!state.ownedIngredientIds.includes(action.ingredientId)) return state;
      if (!isValidSauceDepositBatch(action.deposits)) return state;

      const isFreshApplication = state.pizza.sauceIds[0] !== action.ingredientId;
      // EP3 Stock Gate: only a *fresh* application (switching to/starting a sauce this pizza
      // doesn't already carry) could consume a new unit at CONFIRM_BAKE -- continuing to dispense
      // more of the already-active sauce is still the same one unit, so it is never re-gated here.
      if (isFreshApplication && !canPlaceIngredient(dispenseIngredient, state.inventory, state.pizza)) {
        return state;
      }
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
      return {
        ...state,
        pizza,
        hint: buildHintLine(state.recipe, pizza, state.makingStep, false, state.preDiscoveryFreeCookAttempts),
      };
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
      // EP3 Stock Gate: a reservation/limit check only -- placed count for a finite (owned,
      // `unlockCondition`-bearing) ingredient can never exceed its remaining stock this round.
      // Never decrements `state.inventory` itself (CONFIRM_BAKE's consumePizzaInventory remains
      // the sole consumption point) -- this only rejects the placement, exactly like the
      // "no open spot" case just below, reusing the same rejected-placement feedback.
      if (!canPlaceIngredient(placingIngredient, state.inventory, state.pizza)) {
        placementTokenCounter += 1;
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
        hint: buildHintLine(state.recipe, pizza, state.makingStep, false, state.preDiscoveryFreeCookAttempts),
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
        hint: buildHintLine(state.recipe, pizza, "DOUGH", false, state.preDiscoveryFreeCookAttempts),
        placement: null,
        // Cooking Time CT2 (re-decided from CT1's original "fresh timer on reset"):
        // `cookingTiming` is deliberately absent from this returned object, so `...state` above
        // carries it through completely untouched -- not restarted, not paused/resumed. The
        // player is still mid-attempt on the same order, just discarding and redoing the
        // assembly, so the clock counts this exactly like any other few seconds of active
        // PREPARE time. This also means a reset mid-pause (an overlay open when RESET_PIZZA
        // fires) correctly stays paused across the reset with no special-casing needed here --
        // whatever PAUSE_COOKING_TIMING already set (`pausedAt`/`accumulatedPauseMs`) simply
        // isn't touched by this action at all.
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
    // sub-steps. Forward-only (clamped at the active sub-sequence's last step -- reaching BAKE
    // is the pre-existing, separate START_BAKE transition) and a no-op outside PREPARE/
    // POST_BAKE, so a direct dispatch can never advance a step that isn't open yet or move a
    // round that has already left one of those two phases.
    //
    // Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §8): now
    // also valid during POST_BAKE, walking `postBakeSteps(state.cookingProfile)` the same way
    // PREPARE walks `preBakeSteps` -- "same CONFIRM_MAKING_STEP mechanism, same one-way gate" per
    // that section. For every one of the 15 shipped recipes `postBakeSteps` is always empty, so
    // `state.phase` can never actually be "POST_BAKE" for them (see CONFIRM_BAKE below) and this
    // branch is unreachable in production; it exists so a future recipe's non-default profile
    // (none activated this phase) has a working transition to exercise once its own step ships.
    // Confirming the *last* POST_BAKE step is what finally leaves POST_BAKE for RESULT -- there
    // is no separate "START_RESULT" action the way START_BAKE exists for PREPARE, since no step
    // after the last one needs its own dedicated trigger.
    case "CONFIRM_MAKING_STEP": {
      if (state.phase !== "PREPARE" && state.phase !== "POST_BAKE") return state;
      const steps =
        state.phase === "PREPARE"
          ? preBakeSteps(state.cookingProfile)
          : postBakeSteps(state.cookingProfile);
      const currentIndex = steps.indexOf(state.makingStep);
      // Pizza Cutting 1.0 Phase 2 (design doc §15.3): confirming CUT itself (whichever
      // POST_BAKE step this happens to be -- always the last one for Margherita's own profile,
      // §1.1's FINISH->CUT ordering means a future profile could still have a step after it)
      // is gated on `requiredCutCount` and computes `cutResult` exactly once, mirroring
      // `CONFIRM_BAKE`'s own "reducer-level guard is the real backstop, never trust the UI
      // alone" discipline for the CTA's disabled state (GameScreen). A no-op (state unchanged)
      // below `requiredCutCount` -- the CTA is already disabled then, this is the backstop.
      const isConfirmingCut = state.phase === "POST_BAKE" && state.makingStep === "CUT";
      if (isConfirmingCut) {
        const required = requiredCutCount(resolveRequestedSliceCount(state.cutState.config));
        if (state.cutState.lines.length < required) return state;
      }
      const cutState = isConfirmingCut ? evaluateCutState(state.cutState) : state.cutState;
      if (state.phase === "POST_BAKE" && currentIndex === steps.length - 1) {
        return {
          ...state,
          phase: "RESULT",
          makingStepToken: state.makingStepToken + 1,
          cutState,
          // Phase 1A-T (§22.2): finalizes the last POST_BAKE step's own elapsed ms; no next
          // step to start (RESULT has none). A no-op when `cookingTiming` is null (Mission
          // round) or `now` wasn't supplied (same back-compat convention as every other timing
          // dispatch).
          cookingTiming:
            state.cookingTiming && action.now !== undefined
              ? advanceStepTiming(state.cookingTiming, action.now, null)
              : state.cookingTiming,
        };
      }
      const makingStep = nextStepWithin(state.makingStep, steps);
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
        cutState,
        hint: buildHintLine(state.recipe, state.pizza, makingStep, false, state.preDiscoveryFreeCookAttempts),
        // Phase 1A-T (§22.2): finalizes the outgoing step's elapsed ms and starts the incoming
        // one's window. Same back-compat no-op convention as above.
        cookingTiming:
          state.cookingTiming && action.now !== undefined
            ? advanceStepTiming(state.cookingTiming, action.now, makingStep)
            : state.cookingTiming,
      };
    }

    // Pizza Cutting 1.0 Phase 2 (design doc §2.2/§15.3): the reducer-level backstop behind the
    // gesture layer's own `isInsideDough` (start) + drag-threshold (tap rejection) +
    // `buildRimToRimCutLine` (rim-to-rim construction) -- never trusts the UI alone, exactly
    // like COMMIT_SAUCE_DISPENSE/COMMIT_DOUGH_STRETCH's own independent re-checks. A line that
    // somehow isn't genuinely edge-to-edge (a stray/malformed dispatch) is rejected outright,
    // never partially accepted. The cut limit (`requiredCutCount + 2`, design doc §8.4) bounds
    // the interaction independent of the UI's own gesture gating.
    case "ADD_CUT_LINE": {
      if (state.phase !== "POST_BAKE" || state.makingStep !== "CUT") return state;
      if (!isEdgeToEdgeCutLine(action.line)) return state;
      const limit = requiredCutCount(resolveRequestedSliceCount(state.cutState.config)) + 2;
      if (state.cutState.lines.length >= limit) return state;
      // Pizza Cutting 1.0 Phase 4A (design doc §2.2/Phase 4 Fresh Audit §5B/§15): the reducer-
      // level backstop behind the gesture layer's own pre-dispatch check (App.tsx's
      // `handleAddCutLine`) -- never trusts the UI alone, exactly like the limit check above. A
      // near-duplicate line is rejected outright (state unchanged, same no-op contract as every
      // other ADD_CUT_LINE rejection above): it never grows `cutState.lines`, never invalidates
      // undo history, and leaves `evaluation` exactly as it was.
      if (isDuplicateCutLine(action.line, state.cutState.lines)) return state;
      return { ...state, cutState: addCutLine(state.cutState, action.line) };
    }

    case "UNDO_CUT_LINE": {
      if (state.phase !== "POST_BAKE" || state.makingStep !== "CUT") return state;
      return { ...state, cutState: undoLastCutLine(state.cutState) };
    }

    case "START_BAKE": {
      // Cooking Time CT1: finalizes `cookingTiming.completedMs` right here, before BAKE's own
      // needle-tap minigame ever starts -- see cookingTiming's own module header for why the
      // boundary ends exactly at this transition, not at CONFIRM_BAKE.
      const finishedRound =
        state.cookingTiming && action.now !== undefined
          ? finishCookingTiming(state.cookingTiming, action.now)
          : state.cookingTiming;
      // Phase 1A-T (§22.2/§22.3): finalizes the last PREPARE step's own elapsed ms into
      // `perStepElapsedMs` and closes step timing out (`activeStep`/`stepStartedAt` -> null) --
      // BAKE itself is never a `MakingStep` and never accumulates its own entry, matching
      // `completedMs`'s existing BAKE-exclusion exactly.
      const cookingTiming =
        finishedRound && action.now !== undefined
          ? advanceStepTiming(finishedRound, action.now, null)
          : finishedRound;
      return { ...state, phase: "BAKE", cookingTiming };
    }

    case "CONFIRM_BAKE": {
      // Economy & Progression 1.0 EP2: CONFIRM_BAKE is the sole inventory-consumption
      // transaction boundary (the SSOT's explicit decision -- PREPARE-time placement never
      // touches `inventory`). This guard makes that transaction exactly-once, the same
      // pattern REGISTER_TO_DEX already uses against its own phase ("RESULT"): only a round
      // still actually in "BAKE" may confirm. Without it, a duplicate/stray CONFIRM_BAKE
      // dispatched against the post-transition state (phase already "RESULT") would
      // recompute the bake and, worse, re-run inventory consumption a second time for a
      // pizza that was already baked -- this is the fix for that pre-existing gap (E1
      // Preflight/Fresh Audit both flagged CONFIRM_BAKE as having no `phase` guard at all).
      if (state.phase !== "BAKE") {
        return state;
      }
      const pizza: PizzaState = { ...state.pizza, bakeResult: action.value };
      // Progression 2.0 Phase 3-2: a free-cook pizza is identified here, once, by the Phase 3-1
      // matcher (../logic/discovery/freeCook.ts). A MATCHED pizza becomes that recipe's round
      // from this point on (scored, gated and later registered as it); anything else keeps the
      // sentinel and is either FAILED (not a dish) or an unscored ORIGINAL pizza.
      const freeCook = state.freeCook ? resolveFreeCookPizza(pizza, state.dex) : null;
      if (freeCook && freeCook.kind !== "MATCHED") {
        // Progression 2.0 Phase 3-3 (Issue #198): a free-cook round that didn't match anything
        // new (ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH/FAILED, all folded into this one branch)
        // advances the hint-escalation counter, but only while the Dex is still completely
        // empty -- once any recipe has ever been discovered, escalation is over for good (the
        // counter simply stops moving; `buildHintLine` never reads it for a non-free-cook round
        // anyway).
        const preDiscoveryFreeCookAttempts =
          discoveredRecipeIds(state.dex).length === 0
            ? state.preDiscoveryFreeCookAttempts + 1
            : state.preDiscoveryFreeCookAttempts;
        return {
          ...state,
          pizza,
          score: null,
          bakeState: classifyBake(action.value, state.recipe.bakeTarget),
          scoringV2Result: null,
          completion: freeCook.kind === "FAILED" ? freeCook.completion : { status: "PASS" },
          inventory: consumePizzaInventory(pizza, state.inventory),
          phase: "RESULT",
          preDiscoveryFreeCookAttempts,
        };
      }
      const recipe = freeCook ? freeCook.recipe : state.recipe;
      const bakeState = classifyBake(action.value, recipe.bakeTarget);
      // A1 Authority Cutover: Scoring 2.0 (../logic/scoringV2/) is now authoritative for
      // `state.score` -- computed here, from this exact canonical `pizza`, the one and only
      // Scoring 2.0 call site, shared by FREE and Lunch Rush alike (both dispatch this same
      // action; see ../logic/scoringV2/index.ts's own file header). `toLegacyScoreBreakdown`
      // adapts it into the `ScoreBreakdown` shape every downstream consumer already reads
      // formula-agnostically (see ../logic/scoringV2/toLegacyScoreBreakdown.ts). The legacy
      // `scorePizza` formula (previously ../logic/scoring.ts) was retired in A3b -- Scoring 2.0
      // is the sole scoring authority now.
      const scoringV2Result = computeScoringV2(recipe, pizza);
      const score = toLegacyScoreBreakdown(scoringV2Result, action.value, recipe.bakeTarget);
      // Completion Gate Phase 1 / Lunch Rush Completion Gate 1A: computed unconditionally
      // (FREE and Lunch Rush alike), from this exact canonical `pizza`, alongside Scoring 2.0
      // -- the two are independent (see ../logic/completionGate.ts's own file header).
      // REGISTER_TO_DEX below branches on it for FREE's own Dex/BEST/Pitz registration; Lunch
      // Rush's own servedCount/quality/missionScore gating reads this same `state.completion`
      // one layer up, in App.tsx's `handleMissionServeNext` (see MISSION_NEXT_ORDER's own
      // comment below for why its Dex/Starter Grant registration itself stays unconditional).
      // Issue #215 (OD-1 = G1 / OD-4 = LR-A): a Lunch Rush round still needs the ordered
      // quantity ("order"); every other round completes with one piece of each required
      // ingredient ("recipe") and pays for any shortage in Scoring 2.0's quantity factor.
      const completion = evaluatePizzaCompletion(
        recipe,
        pizza,
        state.isMissionRound ? "order" : "recipe",
      );
      // EP2: consumes exactly the finite ingredients this canonical `pizza` actually used
      // (placed-piece count for scatter, 1-per-sauce-id for spread), computed as one pure
      // next-inventory value from `state.inventory` + `pizza` -- see consumePizzaInventory's
      // own doc comment (./inventory.ts) for the full consumption/clamp/atomicity contract.
      // Completion Gate Phase 1: unaffected by `completion` -- ingredients used on a FAILED
      // pizza were still genuinely used (see the Result Report's inventory semantics section),
      // so this consumption happens exactly the same way regardless of the gate's outcome.
      const inventory = consumePizzaInventory(pizza, state.inventory);
      // Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §8):
      // `postBake` is empty for every one of the 15 shipped recipes (`DEFAULT_COOKING_PROFILE`
      // has no post-BAKE steps), so `phase` below is always "RESULT" and `makingStep` is left
      // completely untouched (carried through by `...state`, exactly as before this phase) for
      // every real recipe today -- byte-identical to the pre-Phase-1A behavior. Only a future
      // recipe's non-default profile (none activated this phase) would ever land on "POST_BAKE"
      // here, entering it at that profile's own first post-BAKE step.
      const postBake = postBakeSteps(state.cookingProfile);
      // Phase 1A-T (§22.2/§22.14): starts timing `postBake[0]` the instant the round actually
      // enters POST_BAKE -- `state.cookingTiming.activeStep` is already `null` here (closed out
      // by START_BAKE above), so this is purely a "start", never a re-finalize. No-op (byte-
      // identical `cookingTiming`) whenever `postBake` is empty, `cookingTiming` is null
      // (Mission round), or `now` wasn't supplied -- true for every one of the 15 shipped
      // recipes today.
      const cookingTiming =
        postBake.length > 0 && state.cookingTiming && action.now !== undefined
          ? advanceStepTiming(state.cookingTiming, action.now, postBake[0])
          : state.cookingTiming;
      return {
        ...state,
        recipe,
        pizza,
        score,
        bakeState,
        scoringV2Result,
        completion,
        inventory,
        cookingTiming,
        ...(postBake.length > 0
          ? { phase: "POST_BAKE" as const, makingStep: postBake[0] }
          : { phase: "RESULT" as const }),
      };
    }

    case "REGISTER_TO_DEX": {
      // Only a RESULT with a score can register. This makes the Dex update atomic per
      // round: a stray or repeated dispatch (e.g. after the phase has already moved on to
      // DISCOVERED) can never double-count timesMade or re-evaluate BEST for the same round.
      // Issue #38 E-P1/E-P2: the same guard is what makes the Pitz credit below exactly-once
      // too -- a second dispatch against the post-transition state (phase already DISCOVERED)
      // is rejected here before either Dex or Pitz is touched a second time (Pattern A, see
      // docs/reports/TETO_ISSUE-38_PITZ-REWARD_Fresh-Audit.md sec. 3).
      if (state.phase !== "RESULT") {
        return state;
      }
      // Progression 2.0 Phase 3-2: an unmatched free-cook pizza (CONFIRM_BAKE left `score` null
      // and the sentinel recipe in place). A FAILED one stays parked exactly like any FAILED
      // round. A finished ORIGINAL pizza is a normal result, not a failure: it moves on to
      // DISCOVERED with its outcome recorded, but has no score, so nothing is written to the
      // Dex and no Pitz is credited (Phase-2 X-3: scoring and rewards only follow a match; an
      // original-pizza reward is Phase 3-3 economy work). Same RESULT guard => exactly once.
      if (state.freeCook && !state.score) {
        if (state.completion?.status !== "PASS") return state;
        const resolution = resolveFreeCookPizza(state.pizza, state.dex);
        if (resolution.kind !== "ORIGINAL") return state;
        return { ...state, phase: "DISCOVERED", lastDiscovery: resolution.outcome };
      }
      if (!state.score) {
        return state;
      }
      // Completion Gate Phase 1: a FAILED pizza never registers -- no Dex discovery/BEST/
      // timesMade update, no Starter Grant, no Pitz credit (see ../logic/completionGate.ts and
      // the Result Report's FAILED semantics section for the full rationale). `state` is
      // returned completely unchanged, so the round stays parked at "RESULT" with
      // `lastPitzCredit`/`lastStarterGrantNotice` still at their fresh-round `null` -- the
      // FAILED RESULT UI reads `state.completion` directly instead of any of the fields this
      // case would otherwise set.
      if (state.completion?.status === "FAILED") {
        return state;
      }
      // Progression 2.0 Phase 3-1: classify the pizza by its runtime signature against the Dex
      // as it was *before* this round (so the selected recipe's own first registration still
      // reads as NEW_DISCOVERY). FREE only, like the Pitz credit below.
      const evaluatedDiscovery = state.isMissionRound
        ? null
        : evaluateDiscovery(
            signatureOfPizza(state.pizza),
            RECIPE_DISCOVERY_CATALOG,
            discoveredRecipeIds(state.dex),
          );
      const selectedRegistration = registerScoreToDex(state.dex, state.recipe.id, state.score);
      const { wasNewDiscovery, isNewBest } = selectedRegistration;
      // The selected recipe is registered exactly as before; the discovery writer only adds a
      // different recipe the pizza is an exact match for (./discoveryRegistration.ts).
      const discoveryRegistration = evaluatedDiscovery
        ? registerDiscoveryToDex(selectedRegistration.dex, evaluatedDiscovery, state.recipe.id, state.pizza)
        : null;
      const dex = discoveryRegistration ? discoveryRegistration.dex : selectedRegistration.dex;
      // Economy & Progression 1.0 EP4: this is one of the two places `dex` can change (the
      // other is MISSION_NEXT_ORDER below), and `recipeUnlocked` (../state/progression.ts) is
      // purely a function of `dex` -- so this is exactly where a newly-unlocked recipe's own
      // Starter Grant must be applied, atomically in the same transition, so `ownedIngredientIds`
      // reflects it before any later action (SELECT_RECIPE/PLAY_AGAIN's own `isRecipeAvailable`/
      // `availableRecipeIds` checks) ever reads it. `applyStarterGrants` is idempotent against
      // `starterGrantClaimedRecipeIds`, so calling it on every registration (not just ones that
      // happen to newly unlock something) is always safe and a no-op when nothing is newly
      // eligible (see its own doc comment, ../state/starterStock.ts).
      const grant = applyStarterGrants(
        dex,
        state.ownedIngredientIds,
        state.inventory,
        state.starterGrantClaimedRecipeIds,
      );
      // FREE only: Lunch Rush keeps its existing, unchanged per-run reward
      // (calculateMissionReward via CLAIM_MISSION_REWARD/MISSION_NEXT_ORDER) -- this per-pizza
      // credit must never also apply inside a Mission round, or a Lunch Rush pizza would earn
      // Pitz twice under two different formulas. Registration UI itself already never renders
      // during a Mission round (ResultPanel is gated on `!isMissionActive`), but this guard is
      // the reducer-level backstop, not just a UI convention.
      // OD-02 (Progression 2.0 Phase 2, reaffirmed for Phase 3-3): `wasNewDiscovery` also drives
      // the flat first-discovery Pitz bonus, additive inside `lastPitzCredit.balanceAfter`
      // itself (../logic/pitzReward.ts) -- unlike CT2's Efficiency bonus below, this one is
      // folded straight into the credit snapshot, since it is genuinely part of "what this
      // pizza's registration paid," not a separate cross-cutting system.
      const lastPitzCredit = state.isMissionRound
        ? null
        : applyPitzCredit(
            state.recipe.baseRewardPitz,
            state.score.total,
            state.pitzBalance,
            wasNewDiscovery,
          );
      // Cooking Time CT2: the additive Efficiency bonus, computed independently of
      // `lastPitzCredit` above and never folded into its own `multiplier`/`earnedPitz`
      // (pitzReward.ts is untouched by CT2 -- see efficiency.ts's own file header). FREE only,
      // same guard as `lastPitzCredit` (redundant with `cookingTiming` always being `null` for a
      // Mission round, but explicit here rather than relying on that alone), and additionally
      // requires `cookingTiming.completedMs` to have actually finalized (should always be true
      // for a FREE round that reached RESULT via START_BAKE, but a defensive `null` check all the
      // same rather than asserting).
      const lastEfficiencyCredit =
        !state.isMissionRound && state.cookingTiming?.completedMs != null
          ? evaluateCookingEfficiency(
              state.recipe,
              state.cookingTiming.completedMs,
              state.score.total,
              state.recipe.baseRewardPitz,
            )
          : null;
      const pitzBalanceAfterQuality = lastPitzCredit ? lastPitzCredit.balanceAfter : state.pitzBalance;
      return {
        ...state,
        dex,
        ownedIngredientIds: grant.ownedIngredientIds,
        inventory: grant.inventory,
        starterGrantClaimedRecipeIds: grant.claimedRecipeIds,
        justDiscovered: wasNewDiscovery,
        justGotNewBest: isNewBest,
        phase: "DISCOVERED",
        // The Efficiency bonus is credited on top of the quality-based balance above -- additive,
        // never compounded into `lastPitzCredit.balanceAfter` itself (that field stays exactly
        // what `applyPitzCredit` computed, so its own display keeps meaning "quality reward
        // only"; ResultPanel adds `lastEfficiencyCredit.bonusPitz` back in for the final
        // displayed balance arrow -- see its own comment).
        pitzBalance: pitzBalanceAfterQuality + (lastEfficiencyCredit?.bonusPitz ?? 0),
        lastPitzCredit,
        lastEfficiencyCredit,
        lastStarterGrantNotice: buildStarterGrantNotice(grant.grantedRecipeIds),
        lastDiscovery: discoveryRegistration?.outcome ?? null,
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
          starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
          preDiscoveryFreeCookAttempts: state.preDiscoveryFreeCookAttempts,
        },
        { excludeRecipeId: state.recipe.id },
      );

    case "SELECT_RECIPE": {
      const recipe = getRecipe(action.recipeId);
      if (!recipe || !isRecipeAvailable(recipe, state.dex, state.ownedIngredientIds)) return state;
      // Progression 2.0 Phase 3-3 (Issue #198): before the player's first-ever discovery, an
      // available-but-undiscovered recipe is not directly guided-selectable -- Free Cooking
      // (START_FREE_COOK) is the only discovery path pre-Dex-1, so a stray SELECT_RECIPE
      // dispatch can never let a fresh player skip it. Margherita is the only recipe unlocked at
      // Dex 0 (every other recipe's own `unlockCondition.requiresRecipeId` chains from it), so
      // this only ever gates a brand-new save's very first round; once any recipe has been
      // discovered (`discoveredRecipeIds(state.dex).length > 0`), guided selection of any other
      // NEW-but-available recipe is completely unaffected -- unchanged from before this phase.
      if (
        !isDiscovered(state.dex, action.recipeId) &&
        discoveredRecipeIds(state.dex).length === 0
      ) {
        return state;
      }
      return (
        startPreparingRecipe(action.recipeId, {
          dex: state.dex,
          ownedIngredientIds: state.ownedIngredientIds,
          pitzBalance: state.pitzBalance,
          lastClaimedMissionRunId: state.lastClaimedMissionRunId,
          inventory: state.inventory,
          starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
          preDiscoveryFreeCookAttempts: state.preDiscoveryFreeCookAttempts,
        }, action.now) ?? state
      );
    }

    case "START_FREE_COOK":
      return startFreeCook(
        {
          dex: state.dex,
          ownedIngredientIds: state.ownedIngredientIds,
          pitzBalance: state.pitzBalance,
          lastClaimedMissionRunId: state.lastClaimedMissionRunId,
          inventory: state.inventory,
          starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
          preDiscoveryFreeCookAttempts: state.preDiscoveryFreeCookAttempts,
        },
        action.now,
      );

    // Progression 2.0 Phase 3-2: after a free-cook round (matched or not) "もう一度つくる" means
    // "cook freely again", never "make the recipe the matcher happened to name".
    case "RETRY_SAME_RECIPE":
      if (state.freeCook) {
        return startFreeCook(
          {
            dex: state.dex,
            ownedIngredientIds: state.ownedIngredientIds,
            pitzBalance: state.pitzBalance,
            lastClaimedMissionRunId: state.lastClaimedMissionRunId,
            inventory: state.inventory,
            starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
            preDiscoveryFreeCookAttempts: state.preDiscoveryFreeCookAttempts,
          },
          action.now,
        );
      }
      return (
        startPreparingRecipe(state.recipe.id, {
          dex: state.dex,
          ownedIngredientIds: state.ownedIngredientIds,
          pitzBalance: state.pitzBalance,
          lastClaimedMissionRunId: state.lastClaimedMissionRunId,
          inventory: state.inventory,
          starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
          preDiscoveryFreeCookAttempts: state.preDiscoveryFreeCookAttempts,
        }, action.now) ?? state
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
      // Lunch Rush Completion Gate 1A (see docs/reports/TETO_LUNCH-RUSH_COMPLETION-GATE_1A_
      // Result.md): `state.completion` gating for Lunch Rush's own servedCount/quality/
      // missionScore now lives one layer up, in App.tsx's `handleMissionServeNext` and
      // ../mission/lunchRush.ts's `missionRunReducer` SERVE case (the two places that own
      // Mission's own run metrics) -- not here. This reducer's own Dex/BEST/timesMade/Starter
      // Grant registration below is deliberately left exactly as it already was (unconditional
      // on `state.completion`, same as before this phase): FREE-only completion gating on Dex
      // itself (REGISTER_TO_DEX above) is untouched scope, not an oversight.
      const { dex } = registerScoreToDex(state.dex, state.recipe.id, state.score);
      // EP4: the second (and last) place `dex` changes -- see REGISTER_TO_DEX's own comment
      // above for why this exact spot, atomically with the `dex` update, is where a Lunch Rush
      // round's registration must also apply any newly-eligible Starter Grant.
      const grant = applyStarterGrants(
        dex,
        state.ownedIngredientIds,
        state.inventory,
        state.starterGrantClaimedRecipeIds,
      );
      return nextMissionOrderState({
        ...state,
        dex,
        ownedIngredientIds: grant.ownedIngredientIds,
        inventory: grant.inventory,
        starterGrantClaimedRecipeIds: grant.claimedRecipeIds,
      });
    }

    // Forces a fresh Mission order regardless of the current phase -- used when a Mission run
    // starts or retries, since the underlying round could be sitting anywhere (idle at ORDER,
    // or frozen mid-PREPARE/BAKE/RESULT if the previous run's timer expired mid-round).
    case "MISSION_RESET_ORDER":
      return nextMissionOrderState(state);

    case "SHOW_HINT":
      return {
        ...state,
        hint: buildHintLine(
          state.recipe,
          state.pizza,
          state.makingStep,
          true,
          state.preDiscoveryFreeCookAttempts,
        ),
      };

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

    // Economy & Progression 1.0 EP3: applies one restock transaction (../logic/economy.ts's
    // `restockIngredient`, the only place NOT_OWNED/UNLIMITED/NOT_FOR_SALE/INSUFFICIENT_FUNDS
    // are evaluated). A failed restock (not owned, unlimited/Starter, not for sale, insufficient
    // funds) returns `state` completely unchanged -- same "no partial-failure state" contract as
    // PURCHASE_INGREDIENT. A successful restock updates `pitzBalance` and `inventory` together in
    // the same step, so a charge can never land without its matching stock credit, or vice versa.
    // Repeatable by design (unlike PURCHASE_INGREDIENT): the same ingredient can be restocked
    // again immediately, each call its own independent, atomic transaction. Sequential dispatch
    // processing (the same reasoning `restockIngredient`'s own doc comment gives) is what keeps a
    // double-tap from double-crediting: a second RESTOCK_INGREDIENT sees the already-debited
    // `pitzBalance` from the first, so it either succeeds again at the new price (a real second
    // purchase) or fails on insufficient funds -- it can never apply the first tap's charge twice.
    case "RESTOCK_INGREDIENT": {
      const ingredient = getIngredient(action.ingredientId);
      if (!ingredient) return state;
      const result = restockIngredient({
        ingredient,
        ownedIngredientIds: state.ownedIngredientIds,
        inventory: state.inventory,
        pitzBalance: state.pitzBalance,
      });
      if (!result.success) return state;
      return {
        ...state,
        inventory: result.nextInventory,
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

    // Cooking Time CT1 minimal pause boundary (see the GameAction doc comment above): a no-op
    // outside PREPARE or with no `cookingTiming` running (already finished, or a Mission round,
    // which never has one) -- so this can never affect BAKE/RESULT or leak into Lunch Rush.
    case "PAUSE_COOKING_TIMING": {
      if (state.phase !== "PREPARE" || !state.cookingTiming) return state;
      return { ...state, cookingTiming: pauseCookingTiming(state.cookingTiming, action.now) };
    }

    case "RESUME_COOKING_TIMING": {
      if (state.phase !== "PREPARE" || !state.cookingTiming) return state;
      return { ...state, cookingTiming: resumeCookingTiming(state.cookingTiming, action.now) };
    }

    default:
      return state;
  }
}
