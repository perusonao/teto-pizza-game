/**
 * Discovery Hint 2.0 (Issue #229, slice 229-B): the hint progress behind the Free Cooking
 * 「ヒント」 sheet, and the view the sheet renders. Pure; the reducer owns the state.
 *
 * Discovery Hint Economy 1.0 (Issue #232, HE-2): from Dex 1 on, what the sheet shows comes from
 * the persisted purchase ledger (`discoveryHintPurchases`, recipe x level), not from the session:
 * every level bought for the target is shown, the next one is offered at its price
 * (`../logic/discovery/hintPurchase.ts`), and `unlockNextHint` is the one way to get it.
 *
 * - `HintSession` lives on `GameState` only (target, Dex pin, and the Dex-0 reveal index). It is
 *   never written to the save; the purchases are.
 * - It is carried across Free Cooking retries (ProgressionCarry) so one discovery search keeps
 *   its target. `resolveHintSession` re-checks it every time the sheet opens: the target stays
 *   only while `selectHintTarget` still returns it (sticky once H1+ was revealed or bought, or
 *   pinned from the Dex, and only while DISCOVERABLE); any other target starts again at H0.
 *   HE-UI-4: with no session target, a DISCOVERABLE recipe with purchased levels is preferred
 *   (so a reload keeps it); once it is no longer DISCOVERABLE, the deterministic order decides.
 * - Dex 0 + Margherita (OD-HE-5): the onboarding is free. The reveal stays session-only, and the
 *   pre-first-discovery escalation (`preDiscoveryFreeCookAttempts`) still counts: the sheet shows
 *   the larger of that automatic step and the manually revealed one (Fresh Audit §6 F-1/F-2).
 *
 * Discovery Hint 3.0 (Issue #238, H3-3): every target except that onboarding now uses the Selectable
 * Hint (`SELECTABLE` view, `purchaseSelectableHintFact`). The H3-1 pure authority prices and resolves
 * each purchase; H3-2's `selectableHintSavedState` supplies its input from both ledgers. A purchase
 * adds facts to `discoveryHintFacts` and never advances the legacy `discoveryHintPurchases`, which
 * stays the read-only source of `LegacyHintProgress` and `grandfatheredSteps`. Economy 1.0 levels
 * are no longer sold (`unlockNextHint` only runs for the onboarding, see the reducer).
 */
import { getRecipe, type RecipeId } from "../data/recipes";
import {
  discoveryHintPrice,
  isHintOnboardingFree,
  purchaseDiscoveryHint,
  purchasedHintLevel,
  type DiscoveryHintPurchases,
} from "../logic/discovery/hintPurchase";
import { buildHintSteps, type HintLevel, type HintStep } from "../logic/discovery/hintSteps";
import { discoverableHintCandidates, selectHintTarget, type HintEmptyKind } from "../logic/discovery/hintTarget";
import { selectableHintSavedState } from "../logic/discovery/hintFactMigration";
import {
  buildSelectableHintModel,
  hintFactId,
  purchaseSelectableHint,
  selectableHintPresentation,
  type HintCategory,
  type SelectableHintModel,
  type SelectableHintPresentation,
} from "../logic/discovery/selectableHint";
import { discoveredRecipeIds, type DexState } from "./dex";
import type { InventoryState } from "./inventory";

export interface HintSession {
  targetId: string;
  /** Dex 0 onboarding only: index into `buildHintSteps(target)` revealed for free (0 = H0 only).
   *  From Dex 1 on the shown steps come from `discoveryHintPurchases` and this stays 0. */
  revealedIndex: number;
  /** 229-D: the target was picked from a Dex card, so it stays even at H0 (while DISCOVERABLE). */
  fromDex?: boolean;
}

export interface DiscoveryHintState {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  inventory: InventoryState;
  preDiscoveryFreeCookAttempts: number;
  hintSession: HintSession | null;
  pitzBalance: number;
  discoveryHintPurchases: DiscoveryHintPurchases;
  /** H3-3: the Hint 3.0 fact ledger (`recipeId -> fact ids`, H3-2). */
  discoveryHintFacts: Readonly<Record<string, readonly string[]>>;
  /** H3-3: the last Selectable request's non-purchase outcome, shown once in the sheet. Session UI
   *  only: never persisted, cleared when the sheet opens or closes and by a successful purchase. */
  hintOutcome?: HintOutcome | null;
}

/** OD-H3-17: a request with nothing unrevealed for sale answers with generic guidance only. */
export type HintOutcome = "GUIDANCE_ONLY";

/** The next level the sheet offers. Says nothing about what that level reveals. */
export interface HintUnlockOffer {
  level: HintLevel;
  /** 0 when `free`. */
  price: number;
  /** Dex 0 onboarding (OD-HE-5): no Pitz is asked for. */
  free: boolean;
  /** Free, or the balance covers the price. */
  affordable: boolean;
}

export type HintSheetView =
  | {
      kind: "TARGET";
      /** The steps shown so far (H0 first). Never the target's name or id. */
      steps: readonly HintStep[];
      canRevealMore: boolean;
      /** The next level to unlock; `null` once everything the target offers is shown. */
      next: HintUnlockOffer | null;
      pitzBalance: number;
    }
  | {
      /** H3-3: the Hint 3.0 sheet (every target except the Dex-0 Margherita onboarding). Carries
       *  only H3-1's privacy-safe presentation, the H0 line and this player's own grandfathered
       *  legacy lines -- never the target, a remaining count or per-category availability. */
      kind: "SELECTABLE";
      existenceText: string;
      presentation: SelectableHintPresentation;
      /** Already-purchased Economy 1.0 lines that named no ingredient (H3-2). Display only: never a
       *  fact, never for sale, never priced. H3-4 decides the final presentation. */
      grandfatheredSteps: readonly HintStep[];
      outcome: HintOutcome | null;
    }
  | { kind: HintEmptyKind };

/** The step the Dex-0 escalation alone would show: 1 failed try -> sauce + count/cheese,
 *  2 -> the next ingredient, 3+ -> every Margherita ingredient (the former Lv1..Lv3). */
export function autoHintIndex(state: Pick<DiscoveryHintState, "dex" | "preDiscoveryFreeCookAttempts">): number {
  if (discoveredCount(state.dex) > 0 || state.preDiscoveryFreeCookAttempts <= 0) return 0;
  return Math.min(state.preDiscoveryFreeCookAttempts + 1, 4);
}

function discoveredCount(dex: DexState): number {
  return discoveredRecipeIds(dex).length;
}

function stepsFor(targetId: string, dex: DexState): HintStep[] {
  const recipe = getRecipe(targetId as RecipeId);
  return recipe ? buildHintSteps(recipe, { discoveredCount: discoveredCount(dex) }) : [];
}

/** The session the sheet should open with: the current one while its target still holds,
 *  otherwise a fresh H0 session for today's target, or `null` when there is no target.
 *
 *  229-D: `pinnedRecipeId` is the Dex card the player tapped. It becomes the target only while it
 *  is DISCOVERABLE (`selectHintTarget`'s own rule); a stale or unknown pin falls back to the
 *  automatic target. Picking the recipe that already has a session keeps its progress; any other
 *  recipe starts at H0 (one session at a time, no per-recipe history). */
export function resolveHintSession(state: DiscoveryHintState, pinnedRecipeId?: string | null): HintSession | null {
  const current = state.hintSession;
  const sessionSticky =
    current && (current.revealedIndex >= 1 || current.fromDex || hasBoughtHints(state, current.targetId)) ? current.targetId : null;
  // HE-UI-4: without a session target (a reload, or a session that never got past H0), a
  // DISCOVERABLE recipe the player already paid for is preferred, first in hint order, so
  // re-opening the sheet never trades bought information for a different recipe. Anything else
  // (no purchase still DISCOVERABLE) keeps the deterministic automatic order.
  const candidates = discoverableHintCandidates(state);
  const stickyRecipeId =
    [sessionSticky, candidates.find((r) => hasBoughtHints(state, r.id))?.id].find(
      (id) => !!id && candidates.some((r) => r.id === id),
    ) ?? null;
  const target = selectHintTarget(state, { pinnedRecipeId, stickyRecipeId });
  if (target.kind !== "TARGET") return null;
  const fromDex = target.source === "dex" || (current?.targetId === target.recipeId && !!current.fromDex);
  if (current && current.targetId === target.recipeId) {
    return fromDex === !!current.fromDex ? current : { ...current, fromDex: true };
  }
  return fromDex ? { targetId: target.recipeId, revealedIndex: 0, fromDex: true } : { targetId: target.recipeId, revealedIndex: 0 };
}

/** H3-3: the player paid for something on `recipeId` -- a legacy level or a Hint 3.0 fact. */
function hasBoughtHints(state: Pick<DiscoveryHintState, "dex" | "discoveryHintPurchases" | "discoveryHintFacts">, recipeId: string): boolean {
  if (purchasedFor(state, recipeId) >= 1) return true;
  const facts = state.discoveryHintFacts;
  const own = Object.prototype.hasOwnProperty.call(facts, recipeId) ? facts[recipeId] : undefined;
  return Array.isArray(own) && own.length > 0;
}

/** Highest purchased level for `recipeId`, clamped to what its steps offer (0 = none). */
function purchasedFor(state: Pick<DiscoveryHintState, "dex" | "discoveryHintPurchases">, recipeId: string): number {
  const steps = stepsFor(recipeId, state.dex);
  return steps.length === 0 ? 0 : purchasedHintLevel(state.discoveryHintPurchases, recipeId, lastLevel(steps));
}

function lastLevel(steps: readonly HintStep[]): number {
  return steps[steps.length - 1].level;
}

/** The index of the last step at or below `level` (H4 can span several lines: one level). */
function lastIndexAtLevel(steps: readonly HintStep[], level: number): number {
  let index = 0;
  steps.forEach((step, i) => {
    if (step.level <= level) index = i;
  });
  return index;
}

function shownIndex(state: DiscoveryHintState, session: HintSession, steps: readonly HintStep[]): number {
  if (isHintOnboardingFree(discoveredCount(state.dex), session.targetId)) {
    return Math.min(Math.max(session.revealedIndex, autoHintIndex(state)), steps.length - 1);
  }
  return lastIndexAtLevel(steps, purchasedFor(state, session.targetId));
}

/** True while `session`'s target is still a DISCOVERABLE hint target (the same rule SHOW_HINT uses). */
function isSessionTarget(state: DiscoveryHintState, session: HintSession): boolean {
  const target = selectHintTarget(state, { pinnedRecipeId: session.targetId });
  return target.kind === "TARGET" && target.recipeId === session.targetId;
}

export type HintUnlockPatch = Partial<Pick<DiscoveryHintState, "hintSession" | "discoveryHintPurchases" | "pitzBalance">>;

/**
 * HE-2: unlocks `requestedLevel` for the current target -- the patch to apply, or `null` when the
 * request is rejected (nothing changes). The level must be exactly the next one shown; the target
 * must still be the session's DISCOVERABLE target.
 *
 * - Dex-0 Margherita (OD-HE-5): free, session-only: `revealedIndex` moves to the last line of
 *   that level.
 * - Anything else (Dex >= 1, or another recipe DISCOVERABLE at Dex 0 on a migrated save):
 *   `purchaseDiscoveryHint` debits the price and raises the ledger in one step.
 */
export function unlockNextHint(state: DiscoveryHintState, requestedLevel: number): HintUnlockPatch | null {
  const session = state.hintSession;
  if (!session) return null;
  const steps = stepsFor(session.targetId, state.dex);
  if (steps.length === 0 || !isSessionTarget(state, session)) return null;
  const count = discoveredCount(state.dex);
  if (isHintOnboardingFree(count, session.targetId)) {
    const shownLevel = steps[shownIndex(state, session, steps)].level;
    if (requestedLevel !== shownLevel + 1 || requestedLevel > lastLevel(steps)) return null;
    return { hintSession: { ...session, revealedIndex: lastIndexAtLevel(steps, requestedLevel) } };
  }
  const result = purchaseDiscoveryHint({
    recipeId: session.targetId,
    requestedLevel,
    maxLevel: lastLevel(steps),
    isTarget: true,
    discoveredCount: count,
    purchases: state.discoveryHintPurchases,
    pitzBalance: state.pitzBalance,
  });
  if (!result.success) return null;
  return { discoveryHintPurchases: result.nextPurchases, pitzBalance: result.nextPitzBalance };
}

/** H3-3: the Selectable Hint inputs for the session target, or `null` for the Dex-0 Margherita
 *  onboarding (which keeps the free Hint 2.0 reveal) or when there is no valid target. */
function selectableContext(state: DiscoveryHintState, session: HintSession) {
  const count = discoveredCount(state.dex);
  if (isHintOnboardingFree(count, session.targetId)) return null;
  const model: SelectableHintModel | null = buildSelectableHintModel(session.targetId, { discoveredCount: count });
  const saved = selectableHintSavedState(session.targetId, state);
  return model && saved ? { model, saved } : null;
}

/** True while the session target is the free Dex-0 Margherita onboarding (the only target
 *  `PURCHASE_DISCOVERY_HINT` still serves). */
export function isOnboardingHintSession(state: DiscoveryHintState): boolean {
  const session = state.hintSession;
  return !!session && isHintOnboardingFree(discoveredCount(state.dex), session.targetId);
}

export type SelectableHintPatch = Partial<Pick<DiscoveryHintState, "pitzBalance" | "discoveryHintFacts" | "hintOutcome">>;

/**
 * H3-3: one Selectable Hint request for the session target -- the patch to apply, or `null` when
 * it is rejected (nothing changes). H3-1's `purchaseSelectableHint` is the only authority: it
 * re-checks the preference, the paid count the sheet showed (`expectedPaidCount`: a double tap or a
 * stale sheet is rejected), the price with the legacy rung, and the balance.
 *
 * - Success: Pitz is debited once and the target's ledger becomes the stored list (unknown / future
 *   ids kept) plus the revealed facts. `discoveryHintPurchases` is never touched.
 * - GUIDANCE_ONLY (nothing unrevealed for sale, OD-H3-17): only the session UI flag changes -- no Pitz,
 *   no facts, no legacy change.
 */
export function purchaseSelectableHintFact(
  state: DiscoveryHintState,
  preference: HintCategory,
  expectedPaidCount: number,
): SelectableHintPatch | null {
  const session = state.hintSession;
  if (!session || !isSessionTarget(state, session)) return null;
  const context = selectableContext(state, session);
  if (!context) return null;
  const { model, saved } = context;
  const result = purchaseSelectableHint({
    model,
    purchasedFactIds: saved.purchasedFactIds,
    preferences: [preference],
    expectedPaidCount,
    pitzBalance: state.pitzBalance,
    legacy: saved.legacy,
  });
  if (!result.success) {
    return result.reason === "GUIDANCE_ONLY" ? { hintOutcome: "GUIDANCE_ONLY" } : null;
  }
  // Only the onboarding answers `persist: false`, and it never reaches here (`selectableContext`).
  if (!result.persist) return null;
  const stored = saved.purchasedFactIds;
  const merged = [...stored, ...result.revealed.map((f) => hintFactId(f.ingredientId)).filter((id) => !stored.includes(id))];
  const ledger: Record<string, readonly string[]> = Object.create(null) as Record<string, readonly string[]>;
  for (const [id, facts] of Object.entries(state.discoveryHintFacts)) ledger[id] = facts;
  ledger[model.recipeId] = merged;
  return { pitzBalance: result.nextPitzBalance, discoveryHintFacts: ledger, hintOutcome: null };
}

export function hintSheetView(state: DiscoveryHintState): HintSheetView {
  const session = state.hintSession;
  const steps = session ? stepsFor(session.targetId, state.dex) : [];
  if (!session || steps.length === 0) {
    const target = selectHintTarget(state);
    // A target without a session only happens before SHOW_HINT ran; show it as SHOW_HINT would.
    if (target.kind === "TARGET") return hintSheetView({ ...state, hintSession: { targetId: target.recipeId, revealedIndex: 0 } });
    return { kind: target.kind };
  }
  const context = selectableContext(state, session);
  if (context) {
    const { model, saved } = context;
    return {
      kind: "SELECTABLE",
      existenceText: steps[0].textJa,
      presentation: selectableHintPresentation(model, saved.purchasedFactIds, state.pitzBalance, saved.legacy),
      grandfatheredSteps: saved.grandfatheredSteps,
      outcome: state.hintOutcome ?? null,
    };
  }
  const index = shownIndex(state, session, steps);
  const shown = steps.slice(0, index + 1);
  const nextStep = steps[index + 1];
  let next: HintUnlockOffer | null = null;
  if (nextStep) {
    const free = isHintOnboardingFree(discoveredCount(state.dex), session.targetId);
    const price = free ? 0 : discoveryHintPrice(nextStep.level);
    next = { level: nextStep.level, price, free, affordable: free || state.pitzBalance >= price };
  }
  return { kind: "TARGET", steps: shown, canRevealMore: next !== null, next, pitzBalance: state.pitzBalance };
}

/** The sheet is on screen only during a Free Cooking PREPARE, so a flag left open by a phase
 *  change can never surface (or block cooking) anywhere else. */
export function isHintSheetVisible(state: { hintSheetOpen: boolean; phase: string; freeCook: boolean }): boolean {
  return state.hintSheetOpen && state.phase === "PREPARE" && state.freeCook;
}
