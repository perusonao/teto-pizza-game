import { findOrderForRecipe, getNextFreeOrder, type NextFreeOrderOptions, type Order } from "../data/orders";
import { getRecipe, type Recipe, type RecipeId } from "../data/recipes";
import {
  getCookingProfile,
  postBakeSteps,
  preBakeSteps,
  type CookingProfile,
} from "../data/cookingProfiles";
import {
  buildMaterialUnlockNotice,
  resolveShopEntitlement,
  type MaterialUnlockNotice,
} from "./materialEntitlement";
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
import {
  bakeCompletionFailure,
  evaluatePizzaCompletion,
  type BakeCompletionFailure,
  type PizzaCompletionResult,
} from "../logic/completionGate";
import { purchaseFirstPack, refillPack } from "../logic/materialShop";
import { applyPitzCredit, type PitzCredit } from "../logic/pitzReward";
import { evaluateCookingEfficiency, type CookingEfficiencyCredit } from "../logic/efficiency";
import { discoveredRecipeIds, isDiscovered, registerScoreToDex, EMPTY_DEX, type DexState } from "./dex";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { evaluateDiscovery, type DiscoveryOutcome } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { registerDiscoveryToDex } from "./discoveryRegistration";
import { createTrialNotebook, type TrialNotebook } from "../logic/discovery/trialNotebook";
import { recordTrialAttempt, type LastTrialAttempt } from "./trialRecord";
import type { TechniqueId } from "../data/techniques";
import {
  productionTechniqueContext,
  resolveRoundTechniques,
  techniqueRoundEligibility,
} from "../logic/techniques/runtime";
import { FREE_COOK_ORDER, FREE_COOK_RECIPE, isFreeCookRecipe } from "../data/freeCook";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { RESEARCH_IDENTIFY_ENABLED } from "../logic/discovery/researchIdentifyFlag";
import { addResearchExclusions, type ResearchExclusions } from "./researchExclusions";
import { researchResultRows, type ResearchResultRow } from "../logic/discovery/researchResultRows";
import { researchRowsFeedback } from "../logic/discovery/researchResultFeedback";
import { canStartGuidedRound, isRecipeCookable } from "./recipeDiscoveryState";
import {
  canPlaceIngredient,
  consumePizzaInventory,
  EMPTY_INVENTORY,
  type InventoryState,
} from "./inventory";
import { cookableMissionRecipeIds, missionOrderRecipeIds, pickMissionOrder } from "../mission/lunchRush";
import { isInsideDough } from "../logic/pizzaCoordinates";
import { getDinnerMission } from "../mission/dinner/dinnerMission";
import { dinnerRunReducer, startDinnerRun, type DinnerRunState } from "../mission/dinner/dinnerRun";
import {
  dinnerAttemptView,
  dinnerBakePlanView,
  planDinnerBake,
  resolveDinnerAttempt,
} from "../mission/dinner/dinnerResultDetection";
import type { DinnerSession, DinnerSettlementView } from "../mission/dinner/dinnerSession";
import { getDinnerRewardTable } from "../mission/dinner/dinnerReward";
import { decideDinnerSettlement, dinnerRunKey } from "../mission/dinner/dinnerSettlement";
import {
  dinnerRecordForSettlement,
  EMPTY_DINNER_MISSION_RECORDS_STATE,
  type DinnerMissionRecordsState,
} from "./dinnerMissionRecordsSave";
import type { QualityStars } from "../logic/scoring";
import { completionPolicyForRound, isDinnerRound, roundKindFor, type RoundKind } from "./roundKind";
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
import { HINT5_LADDER_ENABLED } from "../logic/discovery/hint5Flag";
import {
  isOnboardingHintSession,
  purchaseSelectableHintFact,
  requestDeductionHintFact,
  requestHint5RungFact,
  resolveHintSession,
  researchAttemptContext,
  isValidResearchTarget,
  needsResearchTargetChoice,
  unlockNextHint,
  type DeductionFamily,
  type HintOutcome,
  type HintSession,
} from "./discoveryHint";
import type { HintCategory } from "../logic/discovery/selectableHint";
import type { DiscoveryHintPurchases } from "../logic/discovery/hintPurchase";
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

/** Contract 2.1: the disclosed RESULT judgments of one attempt (the label is fixed at REGISTER_TO_DEX, never recomputed). */
export interface LastResearchRows {
  labelJa: string;
  rows: readonly ResearchResultRow[];
  /** 4+ unknown toppings were used: no individual topping row is disclosed (the copy is the UI's). */
  toppingOverCap: boolean;
  /** known(T) at evaluation time (before this attempt's positives were stored). Display-only: it lets the RESULT mark a
   *  used ingredient as "already known" (✓); it is never a judgment, never persisted, never in the Notebook. */
  knownIngredientIds: readonly string[];
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
  /** Canonical Pitz balance (Phase 3C-5, SSOT section 3). Mutated by PURCHASE_INGREDIENT /
   *  RESTOCK_INGREDIENT / PURCHASE_DISCOVERY_HINT (spend), CLAIM_MISSION_REWARD and
   *  REGISTER_TO_DEX's reward (earn) only -- never by anything else, including the
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
   *  other way). Progression 2.0 I4b-3 retired EP4: nothing mutates this any more; every action
   *  carries it through unchanged and it stays persisted, so a rollback to a pre-I4b build can
   *  never re-grant a recipe that was already claimed. */
  starterGrantClaimedRecipeIds: readonly string[];
  /** Progression 2.0 W1 Integration I4b-3 (REC-04 OD-REC04-1): every material the Discovery
   *  Ladder has unlocked for the Shop (./materialEntitlement.ts's `resolveShopEntitlement`). A
   *  ledger -- only ever grows. Unlocking grants no stock; `purchaseFirstPack` is what makes a
   *  material OWNED. Resolved at the same places EP4 used to grant (REGISTER_TO_DEX,
   *  MISSION_NEXT_ORDER, App.tsx's load path); carried through every other action unchanged. */
  unlockedForShopIngredientIds: readonly string[];
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
  /** Discovery Hint 2.0 (Issue #229, 229-B): the Free Cooking hint sheet's target and revealed
   *  step (./discoveryHint.ts). Session-only: carried across rounds through `ProgressionCarry`
   *  so one discovery search keeps its target, never persisted (a reload starts at H0). */
  hintSession: HintSession | null;
  /** Discovery 3.0 Research Recipe (#346 S3): the Research Target the player picked from a Dex Research
   *  Entry card -- the subject of the Research UI and of Hint requests ONLY. It is never read by the
   *  matcher / CONFIRM_BAKE / REGISTER_TO_DEX (any exact recipe is discovered as always). Session-only:
   *  carried across Free Cooking retries through `ProgressionCarry`, never persisted (no save field). */
  researchTargetId: string | null;
  /** Discovery Hint Economy 1.0 (Issue #232, HE-1): `recipeId -> highest purchased hint level`,
   *  the persisted ledger (./persistence.ts). Only a successful hint purchase raises a level; no
   *  action ever lowers or removes one (an entry stays after its recipe is discovered). Carried
   *  through every "fresh round" path via `ProgressionCarry`, like `pitzBalance`. */
  discoveryHintPurchases: DiscoveryHintPurchases;
  /** Discovery Hint 3.0 (Issue #238, H3-3): `recipeId -> purchased Selectable Hint fact ids`, the
   *  persisted Hint 3.0 ledger (H3-2, ./persistence.ts). Only a successful PURCHASE_SELECTABLE_HINT
   *  adds to it; nothing removes an entry. Unknown / future ids loaded from the save are kept as is.
   *  Carried through every "fresh round" path via `ProgressionCarry`. */
  discoveryHintFacts: Readonly<Record<string, readonly string[]>>;
  /** H3-3: the last Selectable request's non-purchase outcome (GUIDANCE_ONLY), shown in the open
   *  sheet. Transient: never persisted, reset by SHOW_HINT / CLOSE_HINT / a fresh round. */
  hintOutcome: HintOutcome | null;
  /** 229-B: the hint sheet is open. Only SHOW_HINT during a Free Cooking PREPARE sets it; every
   *  fresh round (`buildOrderState`) closes it. Transient, never persisted. */
  hintSheetOpen: boolean;
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
  /** Dinner Mission DM-2 (Issue #239): the explicit round authority (./roundKind.ts). Set once by
   *  `buildOrderState` for every round; `isMissionRound` / `freeCook` always agree with it. */
  roundKind: RoundKind;
  /** Dinner Mission DM-2: the Dinner run while a Dinner Mission is on screen, else `null`. Never
   *  saved. Non-null exactly when `roundKind === "DINNER"`. */
  dinner: DinnerSession | null;
  /** Dinner Mission DM-4-3: the saved per-mission records (./dinnerMissionRecordsSave.ts), hydrated
   *  from the save and carried through every round. Changed ONLY by the CLEAR settlement in
   *  `dinnerResolve`, in the same state step as its Pitz; App's persistence effect stores both in one
   *  write. Blocked missions (broken saved record) are part of it and are never settled. */
  dinnerMissionRecordsState: DinnerMissionRecordsState;
  /** Issue #212 (H-R): recipes skipped as short in the current Lunch Rush run -- SOLD OUT for the
   *  rest of it, never drawn again (stock cannot rise mid-run: the Shop is not reachable while
   *  PLAYING). Run-local: MISSION_SKIP_ORDER adds to it, MISSION_NEXT_ORDER carries it,
   *  MISSION_RESET_ORDER (a new run) and every FREE round (`buildOrderState`) reset it to `[]`.
   *  Never persisted. */
  missionSoldOutRecipeIds: readonly string[];
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
  /** Progression 2.0 I4b-3/4: transient NEW MATERIAL notice for the materials REGISTER_TO_DEX's
   *  ladder resolution just unlocked for the Shop (./materialEntitlement.ts), rendered by
   *  ResultPanel with a Shop CTA. `null` when nothing new was unlocked; reset to `null` every
   *  fresh round (`buildOrderState` below) like `lastPitzCredit`; never persisted. It replaces
   *  EP4's retired Starter Grant notice (`lastStarterGrantNotice`, removed). */
  lastMaterialUnlockNotice: MaterialUnlockNotice | null;
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
  /** Original Pizza Recovery P3-3a: the session-only Trial Notebook (what the player tried). Carried across every
   *  round transition (`ProgressionCarry`), written only by REGISTER_TO_DEX's free-cook ORIGINAL branch through
   *  `recordTrialAttempt`, empty in a fresh `createInitialGameState` (reload / Full Game Reset), and never part
   *  of the save. Not rendered by any UI in this slice. */
  trialNotebook: TrialNotebook;
  /** Research 2.0 Phase 2 (OD-R1-2): the persisted negative ledger `recipeId -> bare ingredient ids`, written only by
   *  REGISTER_TO_DEX's free-cook ORIGINAL branch (`researchAttemptResult`) from the NEGATIVE rows the RESULT disclosed
   *  (INV-B1), saved by App as an additive ledger. Never part of `discoveryHintFacts` (INV-B9). Not rendered yet. */
  researchExclusions: ResearchExclusions;
  /** P3-3a: the display-only result of the Trial Notebook record committed by this round's REGISTER_TO_DEX
   *  (`NEW` / `DUPLICATE` with the stable `#n`), or `null` (not recorded, or no ORIGINAL committed yet). Reset for
   *  every fresh round exactly like `lastDiscovery`; the RESULT must read this, never re-look-up the notebook. */
  lastTrialAttempt: LastTrialAttempt | null;
  /** Contract 2.1: the RESULT membership rows of this round's Research Target attempt, written only by REGISTER_TO_DEX's
   *  free-cook ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH branch (flag ON, registered target; rows may be empty), reset every fresh round.
   *  Session-only, never persisted. Carries no recipe name / id, count or distance. `null` without a valid attempt context. */
  lastResearchRows: LastResearchRows | null;
  /** Contract 2.1 (OD-RB-18): whether the Research Target was a VALID (registered and cookable) target when THIS round
   *  began. Fixed at round start by `buildOrderState` and never recomputed, so the attempt that consumes the target's
   *  last stock keeps its result while the retry that starts without it does not. It only gates the membership
   *  evaluation: `researchTargetId` (and the research context it drives) is carried independent of it. Session-only. */
  researchTargetValidAtStart: boolean;
  /** Cooking Techniques 1.0 TQ-1C: the technique ledger (known ids only; unknown ids stay in the
   *  save through persistence's forward-compat merge). Hydrated from the save, changed only by
   *  REGISTER_TO_DEX, and saved by App in the same write as the Dex. */
  discoveredTechniqueIds: readonly TechniqueId[];
  /** TQ-1C: techniques REGISTER_TO_DEX newly discovered this round, in registry order -- revealed
   *  before the recipe (SSOT P5, `discoveryRevealOrder`). `null` until REGISTER_TO_DEX, reset every
   *  fresh round, never persisted (so a reload never replays it). Rendered by the RESULT's technique stage (TQ-1D). */
  lastTechniqueDiscovery: readonly TechniqueId[] | null;
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
  // #346 S3: `researchTargetId` -- the Dex Research Entry the player chose to research. The reducer
  // keeps it only while it is a valid, DISCOVERABLE entry; omitted (HOME) clears any earlier target.
  | { type: "START_FREE_COOK"; now?: number; researchTargetId?: string }
  // #356: declares (or, with `null`, clears) the ONE ingredient to check this attempt. PREPARE of a Research Target
  // round only; anything else is a no-op.
  // Free Cooking PREPARE: opens the Discovery Hint 2.0 sheet (229-B). Any other round: the
  // explicit one-line operational hint, as before.
  // 229-D: `pinnedRecipeId` -- the Dex card whose 「💡 ヒントを見る」 started this round. Never read
  // from the DOM; a stale or unknown id falls back to the automatic target.
  | { type: "SHOW_HINT"; pinnedRecipeId?: string }
  // Discovery Hint Economy 1.0 (Issue #232, HE-2): unlocks hint `level` for the open sheet's target
  // -- free at Dex 0 (onboarding), otherwise a one-time Pitz purchase recorded in
  // `discoveryHintPurchases`. `level` is the level the CTA offered; the reducer re-checks it is
  // exactly the next one, so a double tap or a stale event never charges twice. Replaces #229's
  // free REVEAL_NEXT_HINT.
  // H3-3: since Hint 3.0 this only serves the free Dex-0 Margherita onboarding; any other target
  // is rejected (Economy 1.0 levels are no longer sold, so `discoveryHintPurchases` never advances).
  | { type: "PURCHASE_DISCOVERY_HINT"; level: number }
  // Discovery Hint 3.0 (Issue #238, H3-3): buys one Selectable Hint fact for the open sheet's target,
  // `preference` first (fallback sauce -> cheese -> topping, OD-H3-14). `expectedPaidCount` is the
  // paid count the sheet showed; a double tap or stale sheet no longer matches and changes nothing.
  | {
      type: "PURCHASE_SELECTABLE_HINT";
      preference: HintCategory;
      expectedPaidCount: number;
      /** DH4-2B: the hint family; omitted = 材料 (today's request). 構成 / 特徴 need the E3 flag. */
      family?: "material" | DeductionFamily;
    }
  // Discovery Hint 5.0 (Issue #292, H5-2): buys the next ladder rung for the open sheet's target,
  // behind HINT5_LADDER_ENABLED (off in every build: a no-op). `expectedRungIndex` is the rung the
  // sheet offered; a double tap or a stale sheet no longer matches and changes nothing.
  | { type: "PURCHASE_HINT5_RUNG"; expectedRungIndex: number }
  | { type: "CLOSE_HINT" }
  // Phase 3C-4 (Lunch Rush): both below reuse this same round machinery (an ORDER phase with
  // a freshly-picked, available recipe) -- there is no separate Mission round state. See
  // src/mission/lunchRush.ts's top comment for the canonical/derived boundary this keeps.
  | { type: "MISSION_NEXT_ORDER" }
  | { type: "MISSION_RESET_ORDER" }
  // Issue #212 (H-R): skip the current Lunch Rush order because it is short of stock. `recipeId`
  // is the order the player saw, so a stale/double tap against a newer order is a no-op.
  | { type: "MISSION_SKIP_ORDER"; recipeId: string }
  // Phase 3C-5 (Pitz + Shop), repriced by I4b-3: the reducer only applies the result of a pure
  // rule, it never computes a price or a reward itself. PURCHASE_INGREDIENT is the REC-04 first
  // pack (../logic/materialShop.ts's `purchaseFirstPack`); CLAIM_MISSION_REWARD uses
  // ../logic/economy.ts's `calculateMissionReward` amount.
  | { type: "PURCHASE_INGREDIENT"; ingredientId: string }
  | { type: "CLAIM_MISSION_REWARD"; runId: number; amount: number }
  // Economy & Progression 1.0 EP3 (Shop 2.0 restock), repriced by I4b-3: the REC-04 refill
  // (`refillPack`), a *separate* transaction from PURCHASE_INGREDIENT above. Repeatable, unlike
  // PURCHASE_INGREDIENT's exactly-once first pack.
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
  | { type: "UNDO_CUT_LINE" }
  | DinnerAction;

/**
 * Dinner Mission DM-2 (Issue #239): the runtime actions of a Dinner run. `now` is the wall clock
 * (`Date.now()`); the run's deadline is checked against it on every action that carries one.
 */
export type DinnerAction =
  /** Starts a run from any non-Lunch-Rush round when none is active. `durationMs` overrides the
   *  mission's own (untuned until DM-5) time limit; with neither, the start is rejected.
   *  DM-3R-2: `minimumStars` is the quality gate S for the run (OD-R2), injected by the caller
   *  (DM-5 decides the value); an invalid or missing one rejects the start. */
  | { type: "DINNER_START"; missionId: string; now: number; durationMs?: number; minimumStars: QualityStars }
  /** DM-3R-2: from a resolved pizza's RESULT (run still PLAYING) to the next recipe-free round. */
  | { type: "DINNER_NEXT_PIZZA"; now: number }
  | { type: "DINNER_TICK"; now: number }
  /** HOME during a PLAYING run: ask for confirmation first. */
  | { type: "DINNER_REQUEST_ABANDON" }
  | { type: "DINNER_CANCEL_ABANDON" }
  /** Confirmed HOME / navigation away: the run is FAILED (ABANDONED), no reward. */
  | { type: "DINNER_CONFIRM_ABANDON"; now: number }
  /** Leaves a finished (CLEARED / FAILED) run for a normal round. */
  | { type: "DINNER_EXIT" }
  /** DM-4-3: App's save write refused these missions' records (their stored record is broken --
   *  it became so underneath this session). Fail-closed reconciliation: the missions become blocked
   *  in memory too, their in-memory records are dropped, and an unsaved settlement of one of them is
   *  reverted (its Pitz removed, shown as BLOCKED) -- so memory never keeps a payout storage refused,
   *  and the next save (which no longer carries the record) goes through. */
  | { type: "DINNER_RECORDS_REFUSED"; missionIds: readonly string[] };

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
  unlockedForShopIngredientIds: readonly string[];
  preDiscoveryFreeCookAttempts: number;
  hintSession: HintSession | null;
  /** #346 S3: session-only Research Target; survives every round transition like `hintSession`. */
  researchTargetId: string | null;
  discoveryHintPurchases: DiscoveryHintPurchases;
  discoveryHintFacts: Readonly<Record<string, readonly string[]>>;
  /** DM-4-3: must survive every round transition, or a later clear would read a stale record. */
  dinnerMissionRecordsState: DinnerMissionRecordsState;
  /** TQ-1C: the technique ledger survives every round transition like the Dex. */
  discoveredTechniqueIds: readonly TechniqueId[];
  /** P3-3a: the session-only Trial Notebook survives every round transition (guided / Lunch Rush / Dinner included). */
  trialNotebook: TrialNotebook;
  /** Research 2.0 Phase 2: the persisted negative ledger (disclosed NEGATIVE rows only) survives every round transition. */
  researchExclusions: ResearchExclusions;
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
  missionSoldOutRecipeIds: readonly string[] = [],
  dinner: DinnerSession | null = null,
): GameState {
  // DM-3R-2: a Dinner round is recipe-free too -- the same inert sentinel, but it is not a Free
  // Cooking round (`freeCook` stays false; `roundKind` is DINNER).
  const recipe =
    freeCook || (dinner !== null && isFreeCookRecipe({ id: order.recipeId })) ? FREE_COOK_RECIPE : getRecipe(order.recipeId);
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
    // Dinner Mission DM-2: a Dinner round is only ever built with `isMissionRound: false` /
    // `freeCook: false` (see `dinnerFreeRound`), so the kind is DINNER exactly while a session exists.
    roundKind: dinner ? "DINNER" : roundKindFor(isMissionRound, freeCook),
    dinner,
    missionSoldOutRecipeIds: isMissionRound ? missionSoldOutRecipeIds : [],
    justDiscovered: false,
    justGotNewBest: false,
    hint: null,
    hintSheetOpen: false,
    hintOutcome: null,
    placement: null,
    lastPitzCredit: null,
    lastMaterialUnlockNotice: null,
    lastEfficiencyCredit: null,
    lastDiscovery: null,
    lastTrialAttempt: null,
    lastResearchRows: null,
    researchTargetValidAtStart: freeCook && isValidResearchTarget(carry, carry.researchTargetId),
    lastTechniqueDiscovery: null,
    freeCook,
  };
}

/** Every free-play "start a new round" path (initial state, PLAY_AGAIN, exiting Mission to
 *  free) goes through here -- always `isMissionRound: false`.
 *
 *  Progression 2.0 W1 Discovery 2.0 (LK-8 / NF-1): the order is picked only from recipes a guided
 *  round may start for (`canStartGuidedRound`: DISCOVERED ∩ cookable). An empty pool (Dex 0, or
 *  nothing discovered is cookable) never falls back to an undiscovered order -- the round becomes
 *  a Free Cooking round at ORDER instead, the one discovery path. */
function nextOrderState(
  carry: ProgressionCarry,
  orderOptions: Omit<NextFreeOrderOptions, "guidedRecipeIds">,
): GameState {
  const order = getNextFreeOrder({ ...orderOptions, guidedRecipeIds: guidedRecipeIds(carry) });
  return order ? buildOrderState(order, carry, false) : buildOrderState(FREE_COOK_ORDER, carry, false, true);
}

/** Recipe ids a guided round may start for right now (DISCOVERED ∩ cookable), in RECIPES order. */
function guidedRecipeIds(carry: Pick<ProgressionCarry, "dex" | "ownedIngredientIds" | "inventory">): RecipeId[] {
  return discoveredRecipeIds(carry.dex).filter((id) => canStartGuidedRound(id, carry)) as RecipeId[];
}

/** Picks a fresh Mission order (see ../mission/lunchRush.ts's `pickMissionOrder`) and builds
 *  the ORDER-phase state around it -- always `isMissionRound: true`. Shared by
 *  MISSION_NEXT_ORDER, MISSION_RESET_ORDER and MISSION_SKIP_ORDER so all three pick a Mission
 *  order the exact same way and mark the round as Mission's identically.
 *
 *  Issue #212 (H-R): an order is only picked while at least one discovered, not-SOLD-OUT recipe
 *  is cookable (`cookableMissionRecipeIds`) -- otherwise `null`, and the caller keeps its own
 *  state (fail-closed: never an undiscovered order, never a Free Cooking fallback). A normal pick
 *  (`cookableOnly: false`) draws from every discovered, owned, not-SOLD-OUT recipe, so a short
 *  order may still appear; the pick right after a skip (`cookableOnly: true`) draws only from the
 *  cookable ones, so a shortage is never followed by another shortage. */
function nextMissionOrderState(
  state: GameState,
  missionSoldOutRecipeIds: readonly string[],
  cookableOnly: boolean,
): GameState | null {
  const cookable = cookableMissionRecipeIds(state, missionSoldOutRecipeIds);
  if (cookable.length === 0) return null;
  const pool = cookableOnly ? cookable : missionOrderRecipeIds(state, missionSoldOutRecipeIds);
  // Discovery 2.0 (OD-DISC-5): both pools are discovered-only already, so the discovered filter
  // inside `pickMissionOrder` is the unchanged Issue #200 backstop.
  const order = pickMissionOrder(pool, discoveredRecipeIds(state.dex) as RecipeId[], state.recipe.id);
  if (!order) return null;
  return buildOrderState(
    order,
    carryOf(state),
    true,
    false,
    missionSoldOutRecipeIds,
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
 *  App.tsx passes them all in from persistence.ts (plus the retired EP4 ledger
 *  `starterGrantClaimedRecipeIds`, carried through untouched, and I4b's Shop entitlement
 *  `unlockedForShopIngredientIds`, and HE-1's hint purchase ledger `discoveryHintPurchases`) so a reload hydrates progression while the round in progress
 *  starts fresh at ORDER regardless. Deliberately a pure passthrough -- this never itself resolves
 *  the Discovery Ladder (./materialEntitlement.ts), unlike REGISTER_TO_DEX/MISSION_NEXT_ORDER
 *  below, so a caller keeps getting back exactly the state it asked for. App.tsx's load path is
 *  the one place that resolves the entitlement explicitly, before calling this. */
export function createInitialGameState(
  dex: DexState = EMPTY_DEX,
  ownedIngredientIds: readonly string[] = STARTER_INGREDIENT_IDS,
  pitzBalance = 0,
  inventory: InventoryState = EMPTY_INVENTORY,
  starterGrantClaimedRecipeIds: readonly string[] = [],
  unlockedForShopIngredientIds: readonly string[] = [],
  discoveryHintPurchases: DiscoveryHintPurchases = {},
  discoveryHintFacts: Readonly<Record<string, readonly string[]>> = {},
  dinnerMissionRecordsState: DinnerMissionRecordsState = EMPTY_DINNER_MISSION_RECORDS_STATE,
  discoveredTechniqueIds: readonly TechniqueId[] = [],
  researchExclusions: ResearchExclusions = {},
): GameState {
  return nextOrderState(
    {
      dex,
      ownedIngredientIds,
      pitzBalance,
      lastClaimedMissionRunId: null,
      inventory,
      starterGrantClaimedRecipeIds,
      unlockedForShopIngredientIds,
      preDiscoveryFreeCookAttempts: 0,
      hintSession: null,
      researchTargetId: null,
      discoveryHintPurchases,
      discoveryHintFacts,
      dinnerMissionRecordsState,
      discoveredTechniqueIds,
      trialNotebook: createTrialNotebook(),
      researchExclusions,
    },
    { preferFirst: true },
  );
}

let placedIdCounter = 0;
let placementTokenCounter = 0;

function baseGameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "BEGIN_PREPARE":
      // Issue #212: only an ORDER round can begin preparing. Without this, a BEGIN_PREPARE that
      // lands on a round sitting at RESULT/POST_BAKE/BAKE (e.g. MISSION_NEXT_ORDER finding no
      // next order) would drag an already-baked pizza back into PREPARE.
      if (state.phase !== "ORDER") return state;
      // LK-8 backstop (Discovery 2.0): a guided round (not Free Cooking) starts only for a
      // DISCOVERED, cookable recipe -- FREE and Lunch Rush alike (Issue #212: a short Lunch Rush
      // order stays at ORDER, where it can only be skipped). A stale ORDER stays at ORDER.
      if (
        !state.freeCook &&
        (state.isMissionRound
          ? !isDiscovered(state.dex, state.recipe.id) || !isRecipeCookable(state.recipe, state)
          : !canStartGuidedRound(state.recipe.id, state))
      ) {
        return state;
      }
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
        // Lunch Rush keeps its own flag exactly as before; Dinner (DM-2) reads the round kind.
        state.isMissionRound ? "order" : completionPolicyForRound(state),
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
      //
      // Issue #256 (OD-CUT256-1..4): a pizza the Completion Gate has just failed for its bake
      // (UNDERBAKED / OVERBAKED anywhere in `failures`, e.g. MISSING + UNDERBAKED too) skips the
      // post-BAKE steps (CUT) and lands on RESULT -- its outcome is already certain and CUT never
      // changes it. The verdict is `completion` above, read through `bakeCompletionFailure`; no
      // band is computed here. A servable pizza (PASS, incl. a ★4 "生焼け / 焦げ" badge) and a
      // composition-only failure keep CUT. A Dinner round forwards the same verdict to Stage B
      // (`dinnerGuardedReducer`), so its CUT gate stays consistent.
      const postBake = bakeCompletionFailure(completion) ? [] : postBakeSteps(state.cookingProfile);
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
      // Dinner Mission DM-2 (OD-DM-11): a Dinner pizza never registers -- no discovery, no Dex
      // timesMade / BEST, no FREE Pitz. (The Dinner guard in `gameReducer` already rejects this
      // action during a run; this is the per-case backstop.)
      if (isDinnerRound(state)) return state;
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
        // TQ-1C: an original pizza can still reveal a technique it used (usage path, affordance-
        // gated). The Dex does not change, so the recipe path adds nothing here. An AMBIGUOUS or
        // INCOMPLETE_MATCH result is shown as an original pizza but discovers nothing, techniques
        // included (Codex review on #289; gate T7).
        const techniques =
          resolution.outcome.kind === "ORIGINAL"
            ? roundTechniques(state, state.dex)
            : { ledger: state.discoveredTechniqueIds, newlyDiscovered: [] };
        // P3-3a (OD-P3-17): the exactly-once Trial Notebook commit. The RESULT guard above makes this transition
        // happen once per round; `recordTrialAttempt` records an ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH outcome
        // (OD-P3-16 as updated by OD-D3-23: an INCOMPLETE_MATCH must not stand out by being unrecorded).
        const research = researchAttemptResult(state);
        const trial = recordTrialAttempt(state, resolution.outcome, research.feedback);
        return {
          ...state,
          discoveryHintFacts: research.discoveryHintFacts,
          researchExclusions: research.researchExclusions,
          lastResearchRows: research.lastResearchRows,
          phase: "DISCOVERED",
          lastDiscovery: resolution.outcome,
          trialNotebook: trial.trialNotebook,
          lastTrialAttempt: trial.lastTrialAttempt,
          discoveredTechniqueIds: techniques.ledger,
          lastTechniqueDiscovery: techniques.newlyDiscovered,
        };
      }
      if (!state.score) {
        return state;
      }
      // Completion Gate Phase 1: a FAILED pizza never registers -- no Dex discovery/BEST/
      // timesMade update, no Starter Grant, no Pitz credit (see ../logic/completionGate.ts and
      // the Result Report's FAILED semantics section for the full rationale). `state` is
      // returned completely unchanged, so the round stays parked at "RESULT" with
      // `lastPitzCredit`/`lastMaterialUnlockNotice` still at their fresh-round `null` -- the
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
      // Progression 2.0 W1 Discovery 2.0: NEW discoveries come only from the matcher. A Free
      // Cooking round's recipe *is* the matcher's pick (CONFIRM_BAKE), so it registers as before;
      // a guided round only ever re-registers an already-discovered recipe. A guided round whose
      // recipe is undiscovered (unreachable behind SELECT_RECIPE/BEGIN_PREPARE/RETRY, kept as the
      // last backstop) writes nothing for that id -- only the matcher below may discover it.
      const guidedIdOnly = !state.freeCook && !isDiscovered(state.dex, state.recipe.id);
      const selectedRegistration = guidedIdOnly
        ? { dex: state.dex, wasNewDiscovery: false, isNewBest: false }
        : registerScoreToDex(state.dex, state.recipe.id, state.score);
      const { wasNewDiscovery, isNewBest } = selectedRegistration;
      // The selected recipe is registered exactly as before; the discovery writer only adds a
      // recipe the pizza is an exact match for that the selected registration did not already
      // write (./discoveryRegistration.ts).
      const discoveryRegistration = evaluatedDiscovery
        ? registerDiscoveryToDex(
            selectedRegistration.dex,
            evaluatedDiscovery,
            guidedIdOnly ? null : state.recipe.id,
            state.pizza,
          )
        : null;
      const dex = discoveryRegistration ? discoveryRegistration.dex : selectedRegistration.dex;
      // TQ-1C: techniques in the same transition as the Dex -- the usage path (Free Cooking only)
      // and the recipe path (INV-TQ-1: every recipe discovered now implies its techniques). Lunch
      // Rush records nothing (`techniqueRoundEligibility`); Dinner never reaches this case.
      const techniques = roundTechniques(state, dex);
      // Progression 2.0 W1 Integration I4b-3 (REC-04): this is one of the two places `dex` can
      // change (the other is MISSION_NEXT_ORDER below), so it is where the Discovery Ladder is
      // resolved -- atomically with the Dex update, exactly where EP4's Starter Grant used to be
      // applied. EP4 is retired: nothing is granted, `ownedIngredientIds`/`inventory`/
      // `starterGrantClaimedRecipeIds` are carried through untouched, and a newly unlocked
      // material starts at stock 0 (OD-REC04-2) until its first pack is bought.
      const entitlement = resolveShopEntitlement(
        dex,
        state.ownedIngredientIds,
        state.unlockedForShopIngredientIds,
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
        unlockedForShopIngredientIds: entitlement.unlockedForShopIngredientIds,
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
        lastMaterialUnlockNotice: buildMaterialUnlockNotice(entitlement.newlyUnlockedMaterialIds),
        lastDiscovery: discoveryRegistration?.outcome ?? null,
        discoveredTechniqueIds: techniques.ledger,
        lastTechniqueDiscovery: techniques.newlyDiscovered,
      };
    }

    case "PLAY_AGAIN":
      return nextOrderState(
        carryOf(state),
        { excludeRecipeId: state.recipe.id },
      );

    case "SELECT_RECIPE": {
      // Progression 2.0 W1 Discovery 2.0 (LK-8): the single guided-round authority. Only a
      // DISCOVERED recipe that is cookable right now (owned, finite stock for its own minimum)
      // can be selected -- at any Dex size. An undiscovered recipe is found only by Free
      // Cooking's matcher (START_FREE_COOK), never by holding its id. (Replaces Phase 3-3's
      // Dex-0-only guard, which this subsumes.)
      if (!canStartGuidedRound(action.recipeId, state)) return state;
      return (
        startPreparingRecipe(action.recipeId, carryOf(state), action.now) ?? state
      );
    }

    case "START_FREE_COOK": {
      // #346 S3: HOME / Dex-pin starts carry no target (an earlier one is cleared); a Research Entry
      // start keeps its target only while valid. Either way only the Hint subject changes -- never
      // what the matcher accepts.
      const researchTargetId = isValidResearchTarget(state, action.researchTargetId) ? action.researchTargetId! : null;
      const carry = { ...carryOf(state), researchTargetId };
      // #353: a fresh start with 2+ Research Entries and no target drops the carried Hint session, so an earlier
      // round's pick cannot act as this round's choice. (A retry keeps it: that is the same search.)
      const dropSession = needsResearchTargetChoice({ ...state, researchTargetId });
      return startFreeCook(dropSession ? { ...carry, hintSession: null } : carry, action.now);
    }

    // Progression 2.0 Phase 3-2: after a free-cook round (matched or not) "もう一度つくる" means
    // "cook freely again", never "make the recipe the matcher happened to name".
    case "RETRY_SAME_RECIPE":
      if (state.freeCook) {
        return startFreeCook(
          carryOf(state),
          action.now,
        );
      }
      // LK-8 backstop (NF-4): the guided retry follows the same authority as SELECT_RECIPE.
      if (!canStartGuidedRound(state.recipe.id, state)) return state;
      return (
        startPreparingRecipe(state.recipe.id, carryOf(state), action.now) ?? state
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
      // Discovery 2.0: Lunch Rush never discovers -- only an already-discovered recipe is
      // re-registered (its pool is discovered-only; this is the reducer backstop).
      const dex = isDiscovered(state.dex, state.recipe.id)
        ? registerScoreToDex(state.dex, state.recipe.id, state.score).dex
        : state.dex;
      // I4b-3: the second (and last) place `dex` changes -- resolved here too for symmetry with
      // REGISTER_TO_DEX. Lunch Rush only serves discovered recipes, so in practice the count
      // does not move here; nothing is granted either way (EP4 retired).
      const entitlement = resolveShopEntitlement(
        dex,
        state.ownedIngredientIds,
        state.unlockedForShopIngredientIds,
      );
      const registered: GameState = {
        ...state,
        dex,
        unlockedForShopIngredientIds: entitlement.unlockedForShopIngredientIds,
      };
      // Issue #212 (OD-2): nothing cookable left -> the served round stays at RESULT (registered)
      // and App.tsx ends the run (END_EARLY); BEGIN_PREPARE's phase guard keeps it there.
      return nextMissionOrderState(registered, state.missionSoldOutRecipeIds, false) ?? registered;
    }

    // Forces a fresh Mission order regardless of the current phase -- used when a Mission run
    // starts or retries, since the underlying round could be sitting anywhere (idle at ORDER,
    // or frozen mid-PREPARE/BAKE/RESULT if the previous run's timer expired mid-round).
    // Issue #212: a new run starts with an empty SOLD OUT set. With nothing cookable the state is
    // returned unchanged (App.tsx never starts such a run -- `canStartLunchRush`).
    case "MISSION_RESET_ORDER":
      return nextMissionOrderState(state, [], false) ?? state;

    // Issue #212 (H-R): the only way past a short Lunch Rush order. Accepted only for the Mission
    // ORDER the player is looking at, and only while it really is short -- a cookable order can
    // never be skipped (no rerolling). The recipe becomes SOLD OUT for the rest of the run and the
    // next order comes from the cookable pool. Nothing else moves: Dex/BEST/timesMade, inventory,
    // Pitz, score and the Mission metrics/clock (a separate reducer) are untouched. With nothing
    // cookable left, only the SOLD OUT set changes and App.tsx ends the run (OD-2).
    case "MISSION_SKIP_ORDER": {
      if (
        !state.isMissionRound ||
        state.freeCook ||
        state.phase !== "ORDER" ||
        state.recipe.id !== action.recipeId ||
        isRecipeCookable(state.recipe, state)
      ) {
        return state;
      }
      const soldOut = state.missionSoldOutRecipeIds.includes(action.recipeId)
        ? state.missionSoldOutRecipeIds
        : [...state.missionSoldOutRecipeIds, action.recipeId];
      return nextMissionOrderState(state, soldOut, true) ?? { ...state, missionSoldOutRecipeIds: soldOut };
    }

    case "SHOW_HINT":
      // Discovery Hint 2.0 (229-B): in Free Cooking the button opens the progressive hint sheet
      // (PREPARE only) and leaves the order-card line alone; guided / Lunch Rush rounds keep the
      // explicit operational line below.
      if (state.freeCook) {
        if (state.phase !== "PREPARE") return state;
        return { ...state, hintSession: resolveHintSession(state, action.pinnedRecipeId), hintSheetOpen: true, hintOutcome: null };
      }
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

    // HE-2: the only place a hint level is unlocked. `unlockNextHint` (./discoveryHint.ts ->
    // ../logic/discovery/hintPurchase.ts) re-validates the session target, the next level, the
    // price, the balance and the Dex-0 exemption; a rejection returns `state` unchanged. A
    // purchase debits `pitzBalance` and raises the ledger in this one step (never one without the
    // other), exactly like PURCHASE_INGREDIENT.
    case "PURCHASE_DISCOVERY_HINT": {
      if (!state.hintSheetOpen || state.phase !== "PREPARE" || !state.freeCook) return state;
      // H3-3: only the free Dex-0 Margherita onboarding still reveals Hint 2.0 levels.
      if (!isOnboardingHintSession(state)) return state;
      const patch = unlockNextHint(state, action.level);
      return patch ? { ...state, ...patch } : state;
    }

    // H3-3: the only place a Selectable Hint fact is bought. `purchaseSelectableHintFact`
    // (./discoveryHint.ts -> ../logic/discovery/selectableHint.ts) re-validates the target, the
    // preference, the paid count, the price (legacy rung included) and the balance. A purchase
    // debits `pitzBalance` and extends `discoveryHintFacts` in this one step; GUIDANCE_ONLY only
    // sets the transient `hintOutcome`; any rejection returns `state` unchanged.
    case "PURCHASE_SELECTABLE_HINT": {
      if (!state.hintSheetOpen || state.phase !== "PREPARE" || !state.freeCook) return state;
      // Hint 5.0 (H5-2): with the ladder flag on, the ladder replaces 材料 / 構成 / 特徴, so a
      // sub-topping name is never sold (OD-H5-C3). With the flag off (every build) this line is inert.
      if (HINT5_LADDER_ENABLED) return state;
      // DH4-2B: 構成 / 特徴 go to the DH4-2A request authority (flag only, E3), which also refuses any
      // family it does not know (INVALID_FAMILY -> no change).
      const family = action.family ?? "material";
      const patch =
        family === "material"
          ? purchaseSelectableHintFact(state, action.preference, action.expectedPaidCount)
          : requestDeductionHintFact(state, family, action.expectedPaidCount);
      if (!patch) return state;
      if (patch.hintOutcome && patch.hintOutcome === state.hintOutcome && Object.keys(patch).length === 1) return state;
      return { ...state, ...patch };
    }

    // Hint 5.0 (H5-2): the only place a ladder rung is bought. `requestHint5RungFact`
    // (./discoveryHint.ts -> ../logic/discovery/hint5Ladder.ts) re-validates the flag, the target,
    // the rung index, the P-C price and the balance. A purchase debits `pitzBalance` and extends
    // `discoveryHintFacts` in this one step; anything else returns `state` unchanged.
    case "PURCHASE_HINT5_RUNG": {
      if (!state.hintSheetOpen || state.phase !== "PREPARE" || !state.freeCook) return state;
      const patch = requestHint5RungFact(state, action.expectedRungIndex);
      return patch ? { ...state, ...patch } : state;
    }

    case "CLOSE_HINT":
      return state.hintSheetOpen ? { ...state, hintSheetOpen: false, hintOutcome: null } : state;

    // I4b-3 (REC-04 OD-REC04-2/3): the first-pack purchase of a NEW (ladder-unlocked, not yet
    // owned) material -- ../logic/materialShop.ts's `purchaseFirstPack`, the only place the
    // LOCKED/NEW/OWNED, tier price and `10 x k` pack rules are evaluated. A failed purchase
    // (locked, already owned, starter, not for sale, insufficient Pitz) returns `state` unchanged.
    // A successful one updates `ownedIngredientIds`, `inventory` and `pitzBalance` together in
    // this one step, so a charge can never land without its stock, or vice versa. A second
    // dispatch sees the material OWNED and is rejected (ALREADY_OWNED): no double purchase.
    case "PURCHASE_INGREDIENT": {
      const ingredient = getIngredient(action.ingredientId);
      if (!ingredient) return state;
      const result = purchaseFirstPack({
        ingredient,
        ownedIngredientIds: state.ownedIngredientIds,
        unlockedForShopIngredientIds: state.unlockedForShopIngredientIds,
        inventory: state.inventory,
        pitzBalance: state.pitzBalance,
      });
      if (!result.success) return state;
      return {
        ...state,
        ownedIngredientIds: result.nextOwnedIngredientIds,
        inventory: result.nextInventory,
        pitzBalance: result.nextPitzBalance,
      };
    }

    // Economy & Progression 1.0 EP3, repriced by I4b-3: applies one refill transaction
    // (../logic/materialShop.ts's `refillPack`: tier refill price, `+10 x k` stock -- the only
    // place NOT_OWNED/UNLIMITED/NOT_FOR_SALE/INSUFFICIENT_FUNDS are evaluated). A failed restock (not owned, unlimited/Starter, not for sale, insufficient
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
      const result = refillPack({
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

// ---------------------------------------------------------------------------------------------
// Dinner Mission DM-2 (Issue #239): runtime integration of the DM-1 pure core
// (../mission/dinner/, docs/reports/TETO_DINNER-MISSION_DM-2_Runtime-Integration_Result.md §3).
// ---------------------------------------------------------------------------------------------

/** TQ-1C: this round's technique step (../logic/techniques/runtime.ts), from REGISTER_TO_DEX only.
 *  `dexAfter` is the Dex this transition writes. The usage path needs a Completion Gate PASS; the
 *  recipe path follows `dexAfter`. The ledger keeps its identity when nothing was discovered, so
 *  App's persistence effect does not re-run for nothing. */
function roundTechniques(state: GameState, dexAfter: DexState) {
  const result = resolveRoundTechniques({
    eligibility: techniqueRoundEligibility({
      isMissionRound: state.isMissionRound,
      isDinnerRound: isDinnerRound(state),
      freeCook: state.freeCook,
    }),
    ledger: state.discoveredTechniqueIds,
    signature: signatureOfPizza(state.pizza),
    completionPassed: state.completion?.status === "PASS",
    dexBefore: state.dex,
    dexAfter,
    context: productionTechniqueContext(),
  });
  return result.newlyDiscovered.length > 0 ? result : { ...result, ledger: state.discoveredTechniqueIds };
}

/**
 * Contract 2.1: the RESULT-based membership of a free-cook round that finished as a plain ORIGINAL / AMBIGUOUS /
 * INCOMPLETE_MATCH (REGISTER_TO_DEX's only call site, so exactly once per round; a MATCHED / cross-recipe round has a
 * score and never reaches it). The outcome kind is only the permission to be here: membership never reads it, the
 * matcher or the cooking quality (INV-D6).
 *
 * - Flag OFF, no explicit target, a target that was not VALID when this round began (`researchTargetValidAtStart`, a
 *   start-of-round snapshot: a retry that begins without the target's last stock gets no result), or a target that is
 *   not a REGISTERED entry (ownership, not stock: the attempt's own last-stock use must not drop the result) ->
 *   nothing changes.
 * - known(T) is taken once, here, from the state before this write; S1 judges only what is not yet known.
 * - Only S1's positive `ing:` ids are added to the target's ledger (deduplicated). A negative or an over-capped
 *   topping is never stored.
 * - The Notebook line is built from the same disclosed rows (S2); no rows -> `null`.
 */
function researchAttemptResult(state: GameState): {
  discoveryHintFacts: GameState["discoveryHintFacts"];
  researchExclusions: GameState["researchExclusions"];
  lastResearchRows: LastResearchRows | null;
  feedback: ReturnType<typeof researchRowsFeedback>;
} {
  const none = {
    discoveryHintFacts: state.discoveryHintFacts,
    researchExclusions: state.researchExclusions,
    lastResearchRows: null,
    feedback: null,
  };
  const targetId = state.researchTargetId;
  if (!RESEARCH_IDENTIFY_ENABLED || !targetId || !state.researchTargetValidAtStart) return none;
  const context = researchAttemptContext(state);
  if (!context) return none;
  const result = researchResultRows({ targetRecipeId: targetId, pizza: state.pizza, knownIngredientIds: context.knownIngredientIds });
  const feedback = researchRowsFeedback({ labelJa: context.labelJa, rows: result.rows });
  // `knownIngredientIds` is the known(T) snapshot this evaluation used (taken before this attempt's own write), so the
  // RESULT can mark prior knowledge without re-reading the ledger (which already holds this attempt's new positives).
  const lastResearchRows: LastResearchRows = {
    labelJa: context.labelJa,
    rows: result.rows,
    toppingOverCap: result.toppingOverCap,
    knownIngredientIds: [...context.knownIngredientIds],
  };
  // Phase 2 (INV-B1): the NEGATIVE rows this RESULT discloses, and only those, join the separate ledger -- never
  // `discoveryHintFacts` (INV-B9). Same rows as the RESULT panel and the Notebook line; same reference when nothing is new.
  const researchExclusions = addResearchExclusions(state.researchExclusions, targetId, result.persistExclusionIds);
  const own = Object.prototype.hasOwnProperty.call(state.discoveryHintFacts, targetId) ? state.discoveryHintFacts[targetId] : [];
  const added = result.persistFactIds.filter((id) => !own.includes(id));
  if (added.length === 0) return { discoveryHintFacts: state.discoveryHintFacts, researchExclusions, lastResearchRows, feedback };
  const ledger: Record<string, readonly string[]> = Object.create(null) as Record<string, readonly string[]>;
  for (const [id, facts] of Object.entries(state.discoveryHintFacts)) ledger[id] = facts;
  ledger[targetId] = [...own, ...added];
  return { discoveryHintFacts: ledger, researchExclusions, lastResearchRows, feedback };
}

function carryOf(state: GameState): ProgressionCarry {
  return {
    dex: state.dex,
    ownedIngredientIds: state.ownedIngredientIds,
    pitzBalance: state.pitzBalance,
    lastClaimedMissionRunId: state.lastClaimedMissionRunId,
    inventory: state.inventory,
    starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
    unlockedForShopIngredientIds: state.unlockedForShopIngredientIds,
    preDiscoveryFreeCookAttempts: state.preDiscoveryFreeCookAttempts,
    hintSession: state.hintSession,
    researchTargetId: state.researchTargetId,
    discoveryHintPurchases: state.discoveryHintPurchases,
    discoveryHintFacts: state.discoveryHintFacts,
    dinnerMissionRecordsState: state.dinnerMissionRecordsState,
    discoveredTechniqueIds: state.discoveredTechniqueIds,
    trialNotebook: state.trialNotebook,
    researchExclusions: state.researchExclusions,
  };
}

/**
 * DM-3R-2 (Issue #250): a fresh DINNER-kind round -- recipe-free, straight at PREPARE. No target is
 * chosen: the round carries the inert Free Cooking sentinel recipe (every OWNED ingredient on the
 * tray, OD-R5, no recipe hint or reference) and what the pizza *is* is decided from its composition
 * at START_BAKE / its result (../mission/dinner/dinnerResultDetection.ts). Always
 * `isMissionRound: false`, `freeCook: false` (Dinner is neither Lunch Rush nor Discovery); no
 * Cooking Time (CT1 / CT2 are FREE-only, so `startPreparing` gets no `now`).
 */
function dinnerFreeRound(state: GameState, session: DinnerSession): GameState {
  const next: DinnerSession = { ...session, roundSeq: session.roundSeq + 1, pending: null, lastResult: null };
  return startPreparing(buildOrderState(FREE_COOK_ORDER, carryOf(state), false, false, [], next));
}

function withRun(state: GameState, session: DinnerSession, run: DinnerRunState): GameState {
  return run === session.run ? state : { ...state, dinner: { ...session, run } };
}

/** The Dinner run after a deadline check at `now` (a TICK). */
function tickedRun(session: DinnerSession, now: number): DinnerRunState {
  return dinnerRunReducer(session.run, { type: "TICK", now });
}

function isValidMinimumStars(value: unknown): value is QualityStars {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function dinnerActionReducer(state: GameState, action: DinnerAction): GameState {
  if (action.type === "DINNER_RECORDS_REFUSED") return dinnerRecordsRefused(state, action.missionIds);
  if (action.type === "DINNER_START") {
    // One run at a time, never on top of a Lunch Rush round.
    if (state.dinner !== null || state.isMissionRound) return state;
    // DM-3R-2: S is required (DM-5 decides it; until then the caller injects it). No default.
    if (!isValidMinimumStars(action.minimumStars)) return state;
    const mission = getDinnerMission(action.missionId);
    if (!mission) return state;
    const started = startDinnerRun(
      mission,
      { dex: state.dex, ownedIngredientIds: state.ownedIngredientIds, inventory: state.inventory },
      action.now,
      action.durationMs,
    );
    if (!started.ok) return state;
    const session: DinnerSession = {
      run: started.state,
      // DM-4-3: the reward authority is captured once for the run (never changes mid-run). The
      // shipped Phase 1 table is untuned, so production pays 0 until DM-5-2 (OD-DM5-5).
      rewardTable: getDinnerRewardTable(mission.reward.tableId) ?? null,
      settlement: null,
      abandonRequested: false,
      minimumStars: action.minimumStars,
      roundSeq: 0,
      pending: null,
      lastResult: null,
    };
    return dinnerFreeRound(state, session);
  }

  const session = state.dinner;
  if (session === null) return state;

  switch (action.type) {
    case "DINNER_TICK":
      return withRun(state, session, tickedRun(session, action.now));

    case "DINNER_NEXT_PIZZA": {
      // Only from a resolved pizza's RESULT while the run is still going.
      if (state.phase !== "RESULT" || session.pending !== null) return state;
      const run = tickedRun(session, action.now);
      if (run.status !== "PLAYING") return withRun(state, session, run);
      return dinnerFreeRound(state, { ...session, run });
    }

    case "DINNER_REQUEST_ABANDON":
      if (session.run.status !== "PLAYING" || session.abandonRequested) return state;
      return { ...state, dinner: { ...session, abandonRequested: true } };

    case "DINNER_CANCEL_ABANDON":
      if (!session.abandonRequested) return state;
      return { ...state, dinner: { ...session, abandonRequested: false } };

    case "DINNER_CONFIRM_ABANDON": {
      if (!session.abandonRequested) return state;
      const run = dinnerRunReducer(session.run, { type: "ABANDON", now: action.now });
      return { ...state, dinner: { ...session, run, abandonRequested: false } };
    }

    case "DINNER_EXIT":
      // A PLAYING run is left only through the abandon confirmation (or the clock).
      if (session.run.status === "PLAYING") return state;
      return nextOrderState(carryOf(state), { excludeRecipeId: state.recipe.id });

    default:
      return state;
  }
}

/** While a Dinner session exists: actions that would start another round, register to the Dex,
 *  open a hint, or move Pitz / stock outside the Dinner rules (the Shop is closed during Dinner,
 *  OD-DM-8). DM-3R-2 adds SHOW_HINT: a Dinner round has no hint sheet or explicit hint line. */
const DINNER_BLOCKED_ACTIONS: ReadonlySet<GameAction["type"]> = new Set<GameAction["type"]>([
  "BEGIN_PREPARE",
  "SELECT_RECIPE",
  "START_FREE_COOK",
  "RETRY_SAME_RECIPE",
  "PLAY_AGAIN",
  "MISSION_NEXT_ORDER",
  "MISSION_RESET_ORDER",
  "MISSION_SKIP_ORDER",
  "REGISTER_TO_DEX",
  "PURCHASE_INGREDIENT",
  "RESTOCK_INGREDIENT",
  "SHOW_HINT",
  "PURCHASE_DISCOVERY_HINT",
  "PURCHASE_SELECTABLE_HINT",
  "PURCHASE_HINT5_RUNG",
  "CLAIM_MISSION_REWARD",
]);

/** Actions that change the pizza's composition: PREPARE only. After START_BAKE the composition --
 *  and with it the Stage A identity, bake window and CUT step -- can no longer change. */
const DINNER_COMPOSITION_ACTIONS: ReadonlySet<GameAction["type"]> = new Set<GameAction["type"]>([
  "APPLY_SAUCE",
  "COMMIT_SAUCE_DISPENSE",
  "PLACE_TOPPING",
  "RESET_PIZZA",
  "COMMIT_DOUGH_STRETCH",
]);

/** Pizza-changing actions: in a Dinner round only while the run is PLAYING. */
const DINNER_COOKING_ACTIONS: ReadonlySet<GameAction["type"]> = new Set<GameAction["type"]>([
  ...DINNER_COMPOSITION_ACTIONS,
  "CONFIRM_MAKING_STEP",
  "START_BAKE",
  "CONFIRM_BAKE",
  "ADD_CUT_LINE",
  "UNDO_CUT_LINE",
]);

function isDinnerAction(action: GameAction): action is DinnerAction {
  return action.type.startsWith("DINNER_");
}

/**
 * DM-3R-2 Stage A at START_BAKE: the composition is final, so its identity picks the BAKE window
 * and the steps after BAKE (CUT for a CUT recipe). The round keeps the anonymous sentinel recipe --
 * only its bake window changes -- so nothing on the BAKE / CUT screen names the identity (OD-R6);
 * the plan itself stays in `dinner.pending`, read by the UI only through `dinnerBakePlanView`.
 */
function dinnerStartBake(state: GameState, session: DinnerSession, action: Extract<GameAction, { type: "START_BAKE" }>): GameState {
  if (state.phase !== "PREPARE") return state;
  const plan = planDinnerBake(state.pizza);
  const view = dinnerBakePlanView(plan);
  const baked = baseGameReducer(state, action);
  const cookingProfile: CookingProfile = {
    steps: [...preBakeSteps(state.cookingProfile), ...view.postBakeSteps],
    ...(view.cutConfig ? { cutConfig: view.cutConfig } : {}),
  };
  return {
    ...baked,
    recipe: { ...FREE_COOK_RECIPE, bakeTarget: view.bakeTarget },
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
    dinner: { ...session, pending: { plan, preConsumptionInventory: null } },
  };
}

/**
 * DM-3R-2 Stage B: resolves the finished pizza through the DM-3R-1 authority and adopts its run.
 * `preConsumptionInventory` is the stock captured at CONFIRM_BAKE, *before* its consumption --
 * never `next.inventory`, which CONFIRM_BAKE has already reduced (that would consume the pizza
 * twice). The stock itself is not touched here: CONFIRM_BAKE's single consumption stays the one
 * decrement, and the resolver's own `postConsumptionInventory` is only what it judges the remaining
 * targets against (pinned equal to `next.inventory` in the tests).
 */
function dinnerResolve(
  state: GameState,
  next: GameState,
  session: DinnerSession,
  preConsumptionInventory: InventoryState,
  cut: { completed: boolean; waivedFor: BakeCompletionFailure | null },
  now: number,
): GameState {
  const result = resolveDinnerAttempt({
    run: session.run,
    pizza: next.pizza,
    cutCompleted: cut.completed,
    cutWaivedFor: cut.waivedFor,
    preConsumptionInventory,
    ownedIngredientIds: next.ownedIngredientIds,
    dex: next.dex,
    minimumStars: session.minimumStars,
    now,
  });
  if (result.status === "REJECTED") return state;
  if (result.status === "TIME_UP") return withRun(state, session, result.run);
  const resolved: GameState = {
    ...next,
    dinner: {
      ...session,
      run: result.run,
      pending: null,
      lastResult: dinnerAttemptView(result.classification, next.dex),
    },
  };
  // DM-4-3: the one authoritative settlement point -- the transition that turns this run CLEARED.
  // No other transition can produce CLEARED (TICK only reaches TIME_UP, ABANDON only ABANDONED), so
  // FAILED / TIME_UP / ABANDONED never reach it and pay 0 (OD-DM4-2).
  if (session.run.status === "PLAYING" && result.run.status === "CLEARED") return dinnerSettle(resolved);
  return resolved;
}

/** DM-4-3: see `DINNER_RECORDS_REFUSED`. Idempotent: an already-blocked mission changes nothing. */
function dinnerRecordsRefused(state: GameState, missionIds: readonly string[]): GameState {
  const recs = state.dinnerMissionRecordsState;
  const ids = [...new Set(missionIds)].filter((id) => typeof id === "string" && !recs.blockedMissionIds.includes(id));
  if (ids.length === 0) return state;
  const records = Object.fromEntries(Object.entries(recs.records).filter(([id]) => !ids.includes(id)));
  let { pitzBalance, dinner } = state;
  const settlement = dinner?.settlement;
  if (dinner && settlement?.kind === "SETTLED" && ids.includes(dinner.run.missionId)) {
    pitzBalance = Math.max(0, pitzBalance - settlement.pitz);
    dinner = { ...dinner, settlement: { kind: "BLOCKED", runKey: settlement.runKey, pitz: 0 } };
  }
  return {
    ...state,
    pitzBalance,
    dinner,
    dinnerMissionRecordsState: { ...recs, records, blockedMissionIds: [...recs.blockedMissionIds, ...ids] },
  };
}

/**
 * DM-4-3 (OD-DM4-3): settles a run's CLEAR exactly once, entirely through the approved authorities --
 * DM-4-1 `decideDinnerSettlement` (reward, first-clear vs repeat, tier, record update, replay
 * refusal) and DM-4-2 `dinnerRecordForSettlement` (a broken saved record blocks its mission; it is
 * never read as "no record"). Pitz and the record change in this one state step, so App's
 * persistence effect writes them in one save write (`requireDinnerRecords`). No Dex, discovery,
 * hint or Shop state is touched. No reward policy lives here.
 */
function dinnerSettle(state: GameState): GameState {
  const session = state.dinner;
  if (session === null || session.run.status !== "CLEARED") return state;
  const run = session.run;
  const runKey = dinnerRunKey(run);
  // Backstop: this session already settled this run (a replayed transition changes nothing).
  const settledRunKey = session.settlement?.runKey ?? null;
  if (settledRunKey === runKey) return state;
  const withSettlement = (settlement: DinnerSettlementView, extra: Partial<GameState> = {}): GameState => ({
    ...state,
    ...extra,
    dinner: { ...session, settlement },
  });

  const access = dinnerRecordForSettlement(state.dinnerMissionRecordsState, run.missionId);
  if (access.blocked) return withSettlement({ kind: "BLOCKED", runKey, pitz: 0 });

  const decision = decideDinnerSettlement({
    run,
    mission: getDinnerMission(run.missionId),
    record: access.record,
    table: session.rewardTable,
    settledRunKey,
  });
  if (decision.kind === "NO_SETTLEMENT" && decision.reason === "ALREADY_SETTLED") return state;
  if (decision.kind !== "SETTLE") {
    return withSettlement({ kind: "REFUSED", runKey, pitz: 0, problems: [decision.reason, ...decision.problems] });
  }
  const records = state.dinnerMissionRecordsState;
  return withSettlement(
    {
      kind: "SETTLED",
      runKey: decision.runKey,
      pitz: decision.pitz,
      schedule: decision.schedule,
      tier: decision.tier,
      clearMs: decision.clearMs,
      newBestTime: decision.newBestTime,
      newBestTier: decision.newBestTier,
    },
    {
      pitzBalance: state.pitzBalance + decision.pitz,
      dinnerMissionRecordsState: { ...records, records: { ...records.records, [decision.missionId]: decision.record } },
    },
  );
}

/**
 * A normal action during a Dinner session (DM-3R-2, recipe-free rounds):
 * - composition actions only in PREPARE while PLAYING, and nothing while the HOME confirmation is open;
 * - START_BAKE runs Stage A (window + CUT);
 * - CONFIRM_BAKE captures the pre-consumption stock, consumes exactly once (the base reducer's
 *   `consumePizzaInventory`), and resolves at once when no CUT follows -- including a CUT recipe
 *   whose bake the Completion Gate failed (Issue #256: the base skipped CUT; the verdict goes on
 *   as `cutWaivedFor`);
 * - the last CONFIRM_MAKING_STEP (CUT) resolves with the stock captured at CONFIRM_BAKE.
 * The clock is checked on every step that bakes or resolves: past the deadline nothing is baked,
 * consumed or completed.
 */
function dinnerGuardedReducer(state: GameState, action: GameAction, session: DinnerSession): GameState {
  if (DINNER_BLOCKED_ACTIONS.has(action.type)) return state;
  if (!DINNER_COOKING_ACTIONS.has(action.type)) return baseGameReducer(state, action);
  if (session.run.status !== "PLAYING") return state;
  // The HOME confirmation is open: nothing cooks, bakes or consumes behind it (the clock still runs).
  if (session.abandonRequested) return state;
  if (DINNER_COMPOSITION_ACTIONS.has(action.type) && state.phase !== "PREPARE") return state;

  if (action.type === "START_BAKE") return dinnerStartBake(state, session, action);

  if (action.type === "CONFIRM_BAKE") {
    if (state.phase !== "BAKE" || session.pending === null || action.now === undefined) return state;
    const run = tickedRun(session, action.now);
    if (run.status !== "PLAYING") return withRun(state, session, run); // time is up: nothing baked
    const preConsumptionInventory = state.inventory;
    // The base CONFIRM_BAKE bakes and consumes (once). Its score / completion are computed against
    // the anonymous sentinel and mean nothing for Dinner -- the result is the resolver's -- so they
    // are cleared rather than left for any screen to misread.
    const baked = baseGameReducer(state, action);
    // Issue #256: read the base Completion Gate's bake verdict before it is cleared. With the
    // sentinel recipe carrying the Stage A window, that verdict is the bake check against the same
    // window Stage B judges. When it made the base reducer skip CUT, it is forwarded as the CUT
    // waiver; Stage B only accepts it if its own classification agrees (fail closed otherwise).
    const cutWaivedFor = bakeCompletionFailure(baked.completion);
    const next: GameState = { ...baked, score: null, scoringV2Result: null, completion: null };
    if (next.phase === "RESULT") {
      return dinnerResolve(state, next, session, preConsumptionInventory, { completed: false, waivedFor: cutWaivedFor }, action.now);
    }
    return { ...next, dinner: { ...session, pending: { ...session.pending, preConsumptionInventory } } };
  }

  if (action.type === "CONFIRM_MAKING_STEP") {
    const next = baseGameReducer(state, action);
    const reachesResult = next.phase === "RESULT" && state.phase !== "RESULT";
    if (!reachesResult) return next;
    const pre = session.pending?.preConsumptionInventory;
    if (action.now === undefined || pre == null) return state;
    const run = tickedRun(session, action.now);
    if (run.status !== "PLAYING") return withRun(state, session, run);
    return dinnerResolve(state, next, session, pre, { completed: true, waivedFor: null }, action.now);
  }

  return baseGameReducer(state, action);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (isDinnerAction(action)) return dinnerActionReducer(state, action);
  if (state.dinner !== null) return dinnerGuardedReducer(state, action, state.dinner);
  return baseGameReducer(state, action);
}
