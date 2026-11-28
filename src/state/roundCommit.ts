/**
 * Save R8 (Issue #617, J-B): the moments where the save must hold a round's state BEFORE the game moves on.
 *
 * Each `run*` below computes the next state with the reducer (pure), then makes ONE synchronous, verified write of exactly what
 * the save effect would write for it (`commitProgress`) -- the consumed stock together with the round journal, or together with
 * the registration. Only when that write is `ok` does the caller dispatch the returned actions; otherwise the round stays where
 * it is. App.tsx owns the dispatching and the notices; everything decided here is testable without React.
 */
import { PITZ_FIRST_DISCOVERY_BONUS } from "../logic/pitzReward";
import { activeProgressionModel, completeReputationTable } from "../logic/progression/progressionModel";
import { EMPTY_SHOP_PROGRESS, sameShopProgress } from "../logic/progression/shopProgress";
import { activeShopCatalog, settleAwaitingMenu } from "../logic/progression/shopProgression";
import { commitDinnerProgress, commitProgress, getDefaultStorage, loadSave, type CommitResult, type ProgressionSnapshot, type StorageLike } from "./persistence";
import { gameReducer, type GameAction, type GameState, type MenuEntryNotice } from "./gameReducer";
import { addInventory, type InventoryState } from "./inventory";
import type { PendingRound } from "./pendingRound";
import { settlePendingRound, type SettleResult } from "./pendingRoundSettle";
import { isDinnerRound } from "./roundKind";

/** The part of the saved stock that stands for `state`: Lunch Rush stock not yet SERVED is still in the save as it was (L-1). */
export function storedInventoryOf(state: GameState): InventoryState {
  return state.unservedConsumption ? addInventory(state.inventory, state.unservedConsumption) : state.inventory;
}

/**
 * Everything a save of `state` writes, in one place: the save effect and every synchronous round commit build the same snapshot,
 * so a commit can never write something the effect would then contradict. `pendingRound`: `undefined` keeps the stored journal,
 * an object writes it in the same `setItem`, `null` removes it.
 */
export function progressionSnapshotOf(state: GameState, pendingRound: PendingRound | null | undefined): ProgressionSnapshot {
  return {
    dex: state.dex,
    pitzBalance: state.pitzBalance,
    ownedIngredientIds: state.ownedIngredientIds,
    inventory: storedInventoryOf(state),
    starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
    unlockedForShopIngredientIds: state.unlockedForShopIngredientIds,
    discoveryHintPurchases: state.discoveryHintPurchases,
    discoveryHintFacts: state.discoveryHintFacts,
    // Research 2.0 Phase 2: the additive negative ledger (a union on write; never lowered).
    researchExclusions: state.researchExclusions,
    // TQ-1C: saved in the same write as the Dex it came with (a union: never lowered, and ids a newer build wrote are kept by the
    // write's forward-compat merge).
    discoveredTechniqueIds: state.discoveredTechniqueIds,
    dinnerMissionRecordUpdates: state.dinnerMissionRecordsState.records,
    // B案 Phase 1b: merged on write (reputation max, union); a default state never creates the key.
    shopProgress: state.shop,
    pendingRound,
  };
}

/** A committed step: dispatch `actions` in order. */
export interface CommittedStep {
  status: "committed";
  actions: GameAction[];
  /** The state the actions produce (what the save now holds). */
  next: GameState;
}
/** The save did not take the step; nothing may be dispatched. */
export interface RefusedStep {
  status: "refused";
  commit: Exclude<CommitResult, { status: "ok" }>;
}
/** The reducer ignores the action in this state (a stray or repeated tap): nothing to commit, nothing to dispatch. */
export interface IgnoredStep {
  status: "ignored";
}
export type RoundStep = CommittedStep | RefusedStep | IgnoredStep;

function commitStep(next: GameState, journal: PendingRound | null | undefined, actions: GameAction[], storage?: StorageLike | null): RoundStep {
  const commit = storage === undefined ? commitProgress(progressionSnapshotOf(next, journal)) : commitProgress(progressionSnapshotOf(next, journal), storage);
  return commit.status === "ok" ? { status: "committed", actions, next } : { status: "refused", commit };
}

export type DinnerClearAction = Extract<GameAction, { type: "CONFIRM_BAKE" | "CONFIRM_MAKING_STEP" }>;
type DinnerClearStep = RoundStep | { status: "records-refused"; actions: GameAction[] };

/** Finalizes a shop Dinner payout before the result can display it. Dinner uses no journal of its own. */
export function runDinnerClear(state: GameState, action: DinnerClearAction, storage?: StorageLike | null): DinnerClearStep {
  const run = state.dinner?.run;
  if (run?.status !== "PLAYING" || activeProgressionModel().id !== "shop") return { status: "ignored" };
  if (run.targetRecipeIds.length - run.completedRecipeIds.length !== 1) return { status: "ignored" };
  if (action.type === "CONFIRM_MAKING_STEP" ? state.phase !== "POST_BAKE" : state.phase !== "BAKE") return { status: "ignored" };
  const next = gameReducer(state, action);
  if (next.dinner?.settlement?.kind !== "SETTLED") return { status: "ignored" };
  const commit = commitDinnerProgress(progressionSnapshotOf(next, undefined), storage);
  if (commit.status === "ok") return { status: "committed", actions: [action], next };
  if (commit.status !== "records-refused") return { status: "refused", commit };
  // Preserve the existing clear-without-payout result for a record that became corrupt during the run.
  const refuse: GameAction = { type: "DINNER_RECORDS_REFUSED", missionIds: commit.missionIds };
  return { status: "records-refused", actions: [action, refuse] };
}

type HomeMenuStep = IgnoredStep | RefusedStep | (CommittedStep & { notice: MenuEntryNotice });

/** Pays any menu entries opened by saved progress, including a Dinner result left on screen at shutdown. */
export function runHomeMenuSettlement(
  state: GameState,
  journal: PendingRound | undefined,
  storage: StorageLike | null = getDefaultStorage(),
): HomeMenuStep {
  const progression = activeProgressionModel();
  if (progression.id !== "shop" || state.dinner || !state.shop.awaitingMenuRecipeIds?.length) return { status: "ignored" };
  const table = completeReputationTable();
  if (!table) return { status: "ignored" };

  const saved = loadSave(storage);
  const savedShop = saved.shopProgress ?? EMPTY_SHOP_PROGRESS;
  // Use durable progress, and leave a newer save (or unconfirmed in-memory progress) for a fresh HOME load.
  if (saved.pitzBalance !== state.pitzBalance || !sameShopProgress(savedShop, state.shop)) return { status: "ignored" };
  const { shop, enteredRecipeIds, reputationGained } = settleAwaitingMenu(savedShop, table, activeShopCatalog());
  if (enteredRecipeIds.length === 0) return { status: "ignored" };

  const bonusPitz = enteredRecipeIds.length * PITZ_FIRST_DISCOVERY_BONUS;
  const { unlockedForShopIngredientIds } = progression.resolveEntitlement({ ...state, shop });
  const progress = { shop, pitzBalance: saved.pitzBalance + bonusPitz, unlockedForShopIngredientIds };
  const action: GameAction = { type: "APPLY_HOME_MENU_SETTLEMENT", progress };
  const step = commitStep(gameReducer(state, action), journal, [action], storage);
  return step.status === "committed"
    ? { ...step, notice: { recipeIds: enteredRecipeIds, bonusPitz, reputation: reputationGained } }
    : step;
}

/** True for the rounds that have no journal: Lunch Rush (L-1 keeps its stock out of the save until served) and Dinner. */
function hasNoJournal(state: GameState): boolean {
  return state.isMissionRound || isDinnerRound(state);
}

/**
 * 焼き上げ. A bake with no CUT / FINISH after it registers at once, so ONE write holds the consumed stock and the registered
 * pizza. A bake with post-BAKE steps writes the consumed stock and the journal together. `ignored` for Lunch Rush / Dinner (their
 * flows are not committed here) and for a bake the reducer does not accept.
 */
export function runBake(state: GameState, value: number, now: number, roundId: string, storage?: StorageLike | null): RoundStep {
  if (hasNoJournal(state)) return { status: "ignored" };
  const bake: GameAction = { type: "CONFIRM_BAKE", value, now, roundId };
  const afterBake = gameReducer(state, bake);
  if (afterBake === state) return { status: "ignored" };
  const registers = afterBake.phase === "RESULT";
  const next = registers ? gameReducer(afterBake, { type: "REGISTER_TO_DEX" }) : afterBake;
  // REGISTER_TO_DEX is dispatched in both cases: it is a no-op while the round waits in POST_BAKE.
  return commitStep(next, next.pendingRound ?? undefined, [bake, { type: "REGISTER_TO_DEX" }], storage);
}

/**
 * A step of a baked round that has a journal (CUT / FINISH confirmation). Confirming FINISH consumes the FINISH pieces (the journal
 * is rewritten with the finished pizza); the last step ends the round (registration, journal removed -- one write). `ignored`
 * when the round has no journal or the reducer refuses the step.
 */
export function runPostBakeStep(state: GameState, now: number, storage?: StorageLike | null): RoundStep {
  if (state.phase !== "POST_BAKE" || !state.pendingRound || hasNoJournal(state)) return { status: "ignored" };
  const step: GameAction = { type: "CONFIRM_MAKING_STEP", now };
  const afterStep = gameReducer(state, step);
  if (afterStep === state) return { status: "ignored" };
  const ended = afterStep.phase === "RESULT";
  const next = ended ? gameReducer(afterStep, { type: "REGISTER_TO_DEX" }) : afterStep;
  return commitStep(next, ended ? null : next.pendingRound, [step, { type: "REGISTER_TO_DEX" }], storage);
}

export type LeaveStep =
  | { status: "settled"; completed: SettleResult }
  | { status: "refused"; commit: Exclude<CommitResult, { status: "ok" }> }
  | { status: "ignored" };

/** The journal HOME would complete, or null (no journal, not a baked Guided / Free round). */
export function journalToSettleOnLeave(state: GameState): PendingRound | null {
  return state.phase === "POST_BAKE" && !hasNoJournal(state) ? state.pendingRound : null;
}

/** Leaving a baked round for HOME: the same completion a restart would do, in one verified write (registration + `settled` journal). */
export function runLeaveRound(state: GameState, storage?: StorageLike | null): LeaveStep {
  const journal = journalToSettleOnLeave(state);
  if (!journal) return { status: "ignored" };
  const completed = settlePendingRound(state, journal);
  if (!completed) return { status: "ignored" };
  const step = commitStep(completed.state, completed.settled, [], storage);
  return step.status === "committed" ? { status: "settled", completed } : step.status === "refused" ? step : { status: "ignored" };
}

/** The player's confirmation of a `settled` journal: removes it (the registration is already in the save). */
export function runAcknowledgeSettled(state: GameState, storage?: StorageLike | null): CommitResult {
  return storage === undefined ? commitProgress(progressionSnapshotOf(state, null)) : commitProgress(progressionSnapshotOf(state, null), storage);
}
