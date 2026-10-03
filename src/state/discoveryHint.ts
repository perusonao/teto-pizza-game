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
 *   (so a reload keeps it); once it is no longer DISCOVERABLE, a lone candidate is the target and
 *   with 2+ candidates none is (PR-4b-A D-1: `OPEN_POOL`, no arbitrary pick).
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
 *
 * Discovery Hint 5.0 (Issue #292, H5-2): behind `HINT5_LADDER_ENABLED` (off in every build), one
 * ladder rung is bought through the H5-1 pure authority (`requestHint5RungFact`), and the ladder's
 * view model is `hint5SheetView`. With the flag on, the 材料 / 構成 / 特徴 purchases are refused
 * (see the reducer). The Dex-0 Margherita onboarding keeps its free Hint 2.0 reveal.
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
import { DEDUCTION_HINT_PRICE, DEDUCTION_HINTS_ENABLED } from "../logic/discovery/deductionFlag";
import { HINT5_LADDER_ENABLED } from "../logic/discovery/hint5Flag";
import {
  HINT5_RUNG_MARKER,
  hint5ClassView,
  hint5Presentation,
  parseHint5ClassFactId,
  requestHint5Rung,
  subToppingClass,
  type Hint5Presentation,
} from "../logic/discovery/hint5Ladder";
import { deriveResearchEntries, researchEntryLabel, type ResearchEntry } from "../logic/discovery/researchEntry";
import { getIngredient } from "../data/ingredients";
import { INGREDIENT_TOTAL_FACT_ID } from "../logic/discovery/deductionHint";
import { TOPPING_TOTAL_FACT_ID } from "../logic/discovery/deductionGuard";
import { deductionKnownLines, deductionOwnership, requestDeductionHint, type DeductionFamily } from "../logic/discovery/deductionRequest";
import {
  buildSelectableHintModel,
  hintFactId,
  parseHintFactId,
  purchaseSelectableHint,
  selectableHintPresentation,
  type HintCategory,
  type SelectableHintModel,
  type SelectableHintPresentation,
} from "../logic/discovery/selectableHint";
import { discoveredRecipeIds, type DexState } from "./dex";
import { type InventoryState } from "./inventory";

export type { DeductionFamily };

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
  /** Discovery 3.0 (#346 S3): the Research Target the player picked this session, or absent / `null`.
   *  Session-only (never saved); a Hint target source and Research UI subject, never a matcher input. */
  researchTargetId?: string | null;
  pitzBalance: number;
  discoveryHintPurchases: DiscoveryHintPurchases;
  /** H3-3: the Hint 3.0 fact ledger (`recipeId -> fact ids`, H3-2). */
  discoveryHintFacts: Readonly<Record<string, readonly string[]>>;
  /** H3-3: the last Selectable request's non-purchase outcome, shown once in the sheet. Session UI
   *  only: never persisted, cleared when the sheet opens or closes and by a successful purchase. */
  hintOutcome?: HintOutcome | null;
}

/**
 * The last request's non-purchase outcome, shown once in the sheet (session UI only).
 * - `GUIDANCE_ONLY` (OD-H3-17): a 材料 request with nothing unrevealed for sale.
 * - DH4-2B (OD-DH4-2-4 / §15): a 構成 request with nothing new to tell (`STRUCTURE_GUIDANCE_ONLY`), a
 *   特徴 request whose answer is existence only (`ATTRIBUTE_EXISTENCE_ONLY`), or a family already
 *   answered (`*_ALREADY_OWNED`). None of them charges or stores anything.
 */
export type HintOutcome =
  | "GUIDANCE_ONLY"
  | "STRUCTURE_GUIDANCE_ONLY"
  | "STRUCTURE_ALREADY_OWNED"
  | "ATTRIBUTE_EXISTENCE_ONLY"
  | "ATTRIBUTE_ALREADY_OWNED"
  /** Hint 5.0 OD-H5-M3: the requested rung was already known and completed for 0 Pitz. Shown only
   *  after the request, never before. */
  | "HINT5_ALREADY_KNOWN";

/**
 * DH4-2B: the 構成 / 特徴 part of the SELECTABLE sheet (behind the flag; on in production since
 * OD-DH4-PROD-1). Built from the player's own ledgers only: no availability, answer level,
 * candidate count, remaining count or reserve.
 */
export interface DeductionSheetView {
  /** 構成: the stored total line, then the stored topping line (never 0). */
  structureLines: readonly string[];
  /** 特徴: the stored informative attribute line. */
  attributeLines: readonly string[];
  /** The total is known only through a legacy 「材料は全部で○種類」 line (the 「以前のヒント」 archive). */
  legacyStructure: boolean;
  /** A 構成 request was answered under Hint 4.0 (stored total or clause): 「✓ もらいずみ」. */
  structureOwned: boolean;
  /** An informative 特徴 answer is stored: 「✓ もらいずみ」. */
  attributeOwned: boolean;
  /** The fixed price of a 構成 / 特徴 request (OD-DH4-PROD-1: 5 / 5, the same for both and for every
   *  target, so the sheet shows one number). */
  nextPrice: number;
  /** The shared paid count to echo back as `expectedPaidCount`. */
  paidCount: number;
  affordable: boolean;
}

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
      /** DH4-2B: `null` when the flag is off (on in every build since OD-DH4-PROD-1). */
      deduction: DeductionSheetView | null;
    }
  | {
      /** #353: 2+ registered Research Entries and no Research Target. Names no recipe, count or fact: the sheet only
       *  offers the way to the Dex's anonymous Research cards. */
      kind: "CHOOSE_RESEARCH";
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
  // #353 (Owner Option B): with 2+ registered Research Entries and no valid Research Target, the system never picks a
  // recipe for the player: not by the legacy sticky / purchase rules below, not as a lone candidate. Only the
  // player's own explicit Dex choice counts -- a Dex card's pin, or the session that pin made (`fromDex`).
  const choice = needsResearchTargetChoice(state);
  const explicitId = choice
    ? [pinnedRecipeId, state.hintSession?.fromDex ? state.hintSession.targetId : null].find((id) => isValidResearchTarget(state, id)) ?? null
    : null;
  if (choice && !explicitId) return null;
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
  const target = choice
    ? selectHintTarget(state, { pinnedRecipeId: explicitId, stickyRecipeId: explicitId, researchTargetId: state.researchTargetId })
    : selectHintTarget(state, { pinnedRecipeId, stickyRecipeId, researchTargetId: state.researchTargetId });
  if (target.kind !== "TARGET") return null;
  const fromDex = target.source === "dex" || (current?.targetId === target.recipeId && !!current.fromDex);
  if (current && current.targetId === target.recipeId) {
    return fromDex === !!current.fromDex ? current : { ...current, fromDex: true };
  }
  return fromDex ? { targetId: target.recipeId, revealedIndex: 0, fromDex: true } : { targetId: target.recipeId, revealedIndex: 0 };
}

/**
 * #353 (Owner Option B): true when the system may not pick a recipe-specific Hint subject for the player (the
 * player's explicit Dex choice, a pin or the session it made, is still honoured by `resolveHintSession`): 2 or more REGISTERED Research Entries (ownership-derived, so an entry with stock 0 still counts; never the
 * cookable count) and no valid Research Target. It reads no purchase and no session: saved Hint facts neither cause
 * nor lift it, and nothing about the recipes' contents. One entry (or none) is unchanged.
 */
export function needsResearchTargetChoice(
  state: Pick<DiscoveryHintState, "dex" | "ownedIngredientIds" | "unlockedForShopIngredientIds" | "inventory" | "discoveryHintFacts" | "researchTargetId">,
): boolean {
  if (deriveResearchEntries(state).entries.length < 2) return false;
  return !isValidResearchTarget(state, state.researchTargetId);
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
  // The same rule SHOW_HINT applies (D-1): a session target holds only while it is still the sole
  // candidate or sticky (revealed / from the Dex / purchased), never merely because it is DISCOVERABLE.
  return resolveHintSession(state)?.targetId === session.targetId;
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

/** The recipe's stored Hint fact ids (unknown / future ids included, as H3-2 keeps them). */
function storedFactIds(state: Pick<DiscoveryHintState, "discoveryHintFacts">, recipeId: string): readonly string[] {
  const facts = state.discoveryHintFacts;
  const own = Object.prototype.hasOwnProperty.call(facts, recipeId) ? facts[recipeId] : undefined;
  return Array.isArray(own) ? own.filter((id): id is string => typeof id === "string") : [];
}

/**
 * DH4 Production Enablement (OD-DH4-PROD-1): 構成 and 特徴 cost a fixed price (5 / 5), not a rung of
 * the 材料 ESC ladder, and a deduction purchase never moves the 材料 price. The paid count is kept
 * only as the request's STALE token (DH4-2B): the 材料 paid count (legacy rungs included) plus one
 * per deduction family bought under Hint 4.0, so any purchase in between refuses an echoed request.
 * It depends only on what this player paid, never on the target's answers.
 */
function deductionPricing(state: DiscoveryHintState, context: NonNullable<ReturnType<typeof selectableContext>>, family: DeductionFamily = "structure") {
  const { model, saved } = context;
  const materialPaid = selectableHintPresentation(model, saved.purchasedFactIds, state.pitzBalance, saved.legacy).paidCount;
  const stored = storedFactIds(state, model.recipeId);
  const own = deductionOwnership(model.recipeId, stored, {});
  const structureBought = stored.includes(INGREDIENT_TOTAL_FACT_ID) || stored.includes(TOPPING_TOTAL_FACT_ID);
  const paidCount = materialPaid + (structureBought ? 1 : 0) + (own.attributeOwned ? 1 : 0);
  return { paidCount, nextPrice: DEDUCTION_HINT_PRICE[family], stored, structureBought, attributeOwned: own.attributeOwned };
}

function deductionContext(state: DiscoveryHintState) {
  return { discoveredCount: discoveredCount(state.dex), ownedIngredientIds: state.ownedIngredientIds };
}

const DEDUCTION_OUTCOMES = {
  structure: { GUIDANCE_ONLY: "STRUCTURE_GUIDANCE_ONLY", ALREADY_OWNED: "STRUCTURE_ALREADY_OWNED" },
  attribute: { EXISTENCE_ONLY: "ATTRIBUTE_EXISTENCE_ONLY", ALREADY_OWNED: "ATTRIBUTE_ALREADY_OWNED" },
} as const;

/**
 * DH4-2B: one 構成 / 特徴 request for the session target -- the patch to apply, or `null` when it is
 * rejected (nothing changes). The DH4-2A pure authority (`requestDeductionHint`) decides everything
 * in its fixed order (family -> target -> price -> STALE -> balance -> answer); this only supplies
 * its inputs and applies the result.
 *
 * - Only with the flag (`enabled`; on in every build since OD-DH4-PROD-1). Flag off: always `null`.
 * - ANSWERED: Pitz is debited once and the new fact ids are appended to the target's ledger (unknown
 *   / future ids kept) in the same patch.
 * - EXISTENCE_ONLY / GUIDANCE_ONLY / ALREADY_OWNED: only the transient `hintOutcome` changes -- no
 *   Pitz, no ledger (OD-DH4-2-4).
 * - Any rejection (not the session's DISCOVERABLE target, stale paid count, balance, ...) is `null`:
 *   the reason is never surfaced.
 */
export function requestDeductionHintFact(
  state: DiscoveryHintState,
  family: DeductionFamily,
  expectedPaidCount: number,
  enabled: boolean = DEDUCTION_HINTS_ENABLED,
): SelectableHintPatch | null {
  if (!enabled) return null;
  const session = state.hintSession;
  if (!session || !isSessionTarget(state, session)) return null;
  const context = selectableContext(state, session);
  if (!context) return null;
  const pricing = deductionPricing(state, context, family);
  const result = requestDeductionHint({
    family,
    recipeId: context.model.recipeId,
    context: deductionContext(state),
    storedFactIds: pricing.stored,
    legacyPurchases: state.discoveryHintPurchases,
    requestPrice: pricing.nextPrice,
    paidCount: pricing.paidCount,
    expectedPaidCount,
    pitzBalance: state.pitzBalance,
  });
  switch (result.outcome) {
    case "REJECTED":
      return null;
    case "ANSWERED": {
      const merged = [...pricing.stored, ...result.addFactIds.filter((id) => !pricing.stored.includes(id))];
      const ledger: Record<string, readonly string[]> = Object.create(null) as Record<string, readonly string[]>;
      for (const [id, facts] of Object.entries(state.discoveryHintFacts)) ledger[id] = facts;
      ledger[context.model.recipeId] = merged;
      return { pitzBalance: state.pitzBalance - result.charge, discoveryHintFacts: ledger, hintOutcome: null };
    }
    case "EXISTENCE_ONLY":
      return { hintOutcome: DEDUCTION_OUTCOMES.attribute.EXISTENCE_ONLY };
    case "GUIDANCE_ONLY":
      return { hintOutcome: DEDUCTION_OUTCOMES.structure.GUIDANCE_ONLY };
    case "ALREADY_OWNED":
      return { hintOutcome: DEDUCTION_OUTCOMES[result.family].ALREADY_OWNED };
  }
}

/** DH4-2B: the 構成 / 特徴 sheet part, or `null` when the flag is off. */
function deductionSheetView(state: DiscoveryHintState, context: NonNullable<ReturnType<typeof selectableContext>>, enabled: boolean): DeductionSheetView | null {
  if (!enabled) return null;
  const pricing = deductionPricing(state, context);
  const lines = deductionKnownLines(context.model.recipeId, deductionContext(state), pricing.stored, state.discoveryHintPurchases);
  const balance = Number.isFinite(state.pitzBalance) ? state.pitzBalance : 0;
  return {
    structureLines: lines.structure,
    attributeLines: lines.attribute,
    legacyStructure: lines.legacyStructure,
    structureOwned: pricing.structureBought,
    attributeOwned: pricing.attributeOwned,
    nextPrice: pricing.nextPrice,
    paidCount: pricing.paidCount,
    affordable: balance >= pricing.nextPrice,
  };
}

/**
 * Discovery 3.0 (#346 S3): the exact fact the player already holds about a Research Target, derived
 * from ownership (S1 `unlockIngredientId`). It is request-time input only (OD-H5-M3): the ledger is
 * never written with it (a request merges the STORED ids and the new ones), so a rung whose subjects
 * are all unlock-known completes for 0 Pitz (ALREADY_KNOWN) and a partly-known name rung charges
 * normally and stores only the unknown names. Without a Research Target nothing is derived, so
 * every non-research Hint request is exactly as before.
 */
function derivedUnlockFactIds(state: DiscoveryHintState, recipeId: string): string[] {
  if (!state.researchTargetId || state.researchTargetId !== recipeId) return [];
  const entry = deriveResearchEntries(state).entries.find((e) => e.recipeId === recipeId);
  return entry ? [hintFactId(entry.unlockIngredientId)] : [];
}

/**
 * Discovery Hint 5.0 (Issue #292, H5-2): one ladder rung for the session target. It returns the patch
 * to apply, or `null` when nothing changes. The H5-1 pure authority (`requestHint5Rung`) decides
 * everything in its fixed order (target -> STALE -> complete -> price / balance -> empty rung ->
 * answer); this only supplies its inputs and applies an ANSWERED result.
 *
 * - The flag is off (the default in every build) -> `null`.
 * - No DISCOVERABLE session target, or the Dex-0 Margherita onboarding (which keeps its free,
 *   session-only Hint 2.0 reveal) -> `null`.
 * - ANSWERED: Pitz is debited by the P-C rung price, and the new fact ids (`ing:` /
 *   `meta:ingredient-total` / `cls:<ingredientId>`) plus the rung's completion record are appended
 *   to the target's ledger in the same patch. Every stored id, unknown or future ones included, is
 *   kept as it is (E3).
 * - ALREADY_KNOWN (OD-H5-M3): only the completion record is appended, Pitz is unchanged, and the
 *   transient `hintOutcome` says so, after the request only.
 * - Everything else (NOT_A_TARGET, STALE, INSUFFICIENT_PITZ, RESERVED_EMPTY_RUNG, LADDER_COMPLETE)
 *   -> `null`: no Pitz, no fact and no new session state. An empty rung keeps the H5-1
 *   RESERVED_EMPTY_RUNG semantics; OD-H5-P4 / P4b are undecided.
 */
export function requestHint5RungFact(
  state: DiscoveryHintState,
  expectedRungIndex: number,
  enabled: boolean = HINT5_LADDER_ENABLED,
): SelectableHintPatch | null {
  if (!enabled) return null;
  const session = state.hintSession;
  if (!session || !isSessionTarget(state, session)) return null;
  const count = discoveredCount(state.dex);
  if (isHintOnboardingFree(count, session.targetId)) return null;
  const stored = storedFactIds(state, session.targetId);
  const result = requestHint5Rung({
    recipeId: session.targetId,
    discoveredCount: count,
    storedFactIds: [...stored, ...derivedUnlockFactIds(state, session.targetId).filter((id) => !stored.includes(id))],
    legacyPurchases: state.discoveryHintPurchases,
    expectedRungIndex,
    pitzBalance: state.pitzBalance,
  });
  if ((result.outcome !== "ANSWERED" && result.outcome !== "ALREADY_KNOWN") || !result.persist) return null;
  const merged = [...stored, ...result.addFactIds.filter((id) => !stored.includes(id))];
  const ledger: Record<string, readonly string[]> = Object.create(null) as Record<string, readonly string[]>;
  for (const [id, facts] of Object.entries(state.discoveryHintFacts)) ledger[id] = facts;
  ledger[session.targetId] = merged;
  return {
    pitzBalance: state.pitzBalance - result.charge,
    discoveryHintFacts: ledger,
    hintOutcome: result.outcome === "ALREADY_KNOWN" ? "HINT5_ALREADY_KNOWN" : null,
  };
}

/**
 * Discovery Hint 5.0 (H5-2): the ladder view model for the session target, or `null` when the flag is
 * off, there is no DISCOVERABLE target, the target is the Dex-0 onboarding, or it is not a ladder
 * target (fail closed; see `hint5LadderActive`). The hint sheet renders it (H5-3).
 */
export function hint5SheetView(state: DiscoveryHintState, enabled: boolean = HINT5_LADDER_ENABLED): Hint5Presentation | null {
  if (!enabled) return null;
  const session = state.hintSession;
  if (!session || !isSessionTarget(state, session)) return null;
  const count = discoveredCount(state.dex);
  if (isHintOnboardingFree(count, session.targetId)) return null;
  return hint5Presentation({
    recipeId: session.targetId,
    discoveredCount: count,
    storedFactIds: storedFactIds(state, session.targetId),
    legacyPurchases: state.discoveryHintPurchases,
    pitzBalance: state.pitzBalance,
  });
}

/**
 * Discovery Hint 5.0 (H5-4): the ladder serves the open sheet (the flag is ON, the session has a
 * DISCOVERABLE target, and it is not the Dex-0 onboarding). With this true and `hint5SheetView` null
 * (a target outside the ladder), the sheet fails closed: nothing is offered, and never the retired
 * 材料 / 構成 / 特徴 purchases (OD-H5-T-COV, OD-H5-RETIRE).
 */
export function hint5LadderActive(state: DiscoveryHintState, enabled: boolean = HINT5_LADDER_ENABLED): boolean {
  if (!enabled) return false;
  const session = state.hintSession;
  if (!session || !isSessionTarget(state, session)) return false;
  return !isHintOnboardingFree(discoveredCount(state.dex), session.targetId);
}

export function hintSheetView(state: DiscoveryHintState, deductionEnabled: boolean = DEDUCTION_HINTS_ENABLED): HintSheetView {
  // #353: checked before the session, so a session carried from an earlier round cannot show a recipe either.
  if (needsResearchTargetChoice(state) && !resolveHintSession(state)) return { kind: "CHOOSE_RESEARCH" };
  const session = state.hintSession;
  const steps = session ? stepsFor(session.targetId, state.dex) : [];
  if (!session || steps.length === 0) {
    // A target without a session only happens before SHOW_HINT ran; show it as SHOW_HINT would.
    const resolved = resolveHintSession(state);
    if (resolved) return hintSheetView({ ...state, hintSession: resolved }, deductionEnabled);
    // No session target resolves, so the only target-less answers apply (never a TARGET here).
    const empty = selectHintTarget(state);
    return { kind: empty.kind === "TARGET" ? "OPEN_POOL" : empty.kind };
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
      deduction: deductionSheetView(state, context, deductionEnabled),
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


// ---- Discovery 3.0 (#346 S3): Research Target + Research view ---------------------------------------

/** The Research Target is valid only while it is a registered entry AND a DISCOVERABLE Hint candidate
 *  (so cooking it is possible and `selectHintTarget` can honour it). Anything else is no target. */
export function isValidResearchTarget(
  state: Pick<DiscoveryHintState, "dex" | "ownedIngredientIds" | "unlockedForShopIngredientIds" | "inventory" | "discoveryHintFacts">,
  recipeId: string | null | undefined,
): boolean {
  if (!recipeId) return false;
  return (
    deriveResearchEntries(state).entries.some((e) => e.recipeId === recipeId) &&
    discoverableHintCandidates(state).some((r) => r.id === recipeId)
  );
}

/** What the Research UI (Dex card, cooking context) may show of one entry. No recipe name / id. */
export interface ResearchEntryView {
  /** Opaque key for wiring only (callbacks); never rendered. */
  recipeId: string;
  /** 「？？？ピザ」 / 「？？？ピザ ①」 */
  label: string;
  /** Exact ingredients known: the unlock fact, then bought exact-name Hint facts (`ing:`). */
  knownExactIngredientIds: readonly string[];
  /** Bought SUB_CLASS facts only (`cls:`), as 「🥩 肉系」, one line per fact. Never an ingredient. */
  classLinesJa: readonly string[];
  /** The ingredient total, only after STRUCTURE was bought. */
  totalIngredientCount: number | null;
}

type ResearchViewInputs = Pick<DiscoveryHintState, "dex" | "ownedIngredientIds"> & Partial<Pick<DiscoveryHintState, "discoveryHintFacts">>;

function viewOf(entry: ResearchEntry, index: number, count: number, stored: readonly string[]): ResearchEntryView {
  const recipe = getRecipe(entry.recipeId as RecipeId);
  const inRecipe = new Set(recipe?.requiredIngredients.map((r) => r.ingredientId) ?? []);
  // Exact: S1's unlock fact, then the player's own bought `ing:` names (Hint authority), recipe-checked.
  const exact = [...entry.knownExactIngredientIds];
  for (const id of stored) {
    const name = parseHintFactId(id);
    if (name !== null && inRecipe.has(name) && getIngredient(name) && !exact.includes(name)) exact.push(name);
  }
  // Class: only a bought `cls:` fact, only once STRUCTURE was completed (the Hint sheet's own rule), only
  // for a sub-topping of this recipe that is not already shown as exact. Existing taxonomy only.
  const classLines: string[] = [];
  if (stored.includes(HINT5_RUNG_MARKER.STRUCTURE)) {
    for (const id of stored) {
      const ingredientId = parseHint5ClassFactId(id);
      if (ingredientId === null || !inRecipe.has(ingredientId) || exact.includes(ingredientId)) continue;
      const family = subToppingClass(ingredientId);
      if (family !== null) classLines.push(`△ ${hint5ClassView(family).labelJa}`);
    }
  }
  return {
    recipeId: entry.recipeId,
    label: researchEntryLabel(index, count),
    knownExactIngredientIds: exact,
    classLinesJa: classLines,
    totalIngredientCount: entry.totalIngredientCount,
  };
}

/** Every registered Research Entry as the UI may show it, in S1's stable anonymous order. */
export function researchEntryViews(state: ResearchViewInputs): ResearchEntryView[] {
  const { entries } = deriveResearchEntries(state);
  return entries.map((entry, index) => viewOf(entry, index, entries.length, storedFactIds({ discoveryHintFacts: state.discoveryHintFacts ?? {} }, entry.recipeId)));
}

/** The Research Target's view for the cooking context, or `null` without a valid target. */
export function researchTargetView(state: DiscoveryHintState): ResearchEntryView | null {
  if (!isValidResearchTarget(state, state.researchTargetId)) return null;
  return researchEntryViews(state).find((v) => v.recipeId === state.researchTargetId) ?? null;
}

/** Discovery 3.0 (#346 S4): the registered Research Entries that can be researched right now (cookable =
 *  DISCOVERABLE), in S1's anonymous order. Opaque ids for wiring only -- the post-discovery CTA reads
 *  "is there one" and, for exactly one, starts it; no count is ever rendered. */
export function researchableEntryIds(
  state: Pick<DiscoveryHintState, "dex" | "ownedIngredientIds" | "unlockedForShopIngredientIds" | "inventory" | "discoveryHintFacts">,
): string[] {
  const cookable = new Set(discoverableHintCandidates(state).map((r) => r.id as string));
  return deriveResearchEntries(state)
    .entries.map((e) => e.recipeId)
    .filter((id) => cookable.has(id));
}

/** #346 S4: the Research Target's view for the RESULT of the round that just finished. Unlike
 *  `researchTargetView` it does not require the target to still be cookable: a trial that used up the last unit
 *  of a finite ingredient is still a research attempt (entries are ownership-derived, never stock-derived). Null
 *  once the target is discovered or was never a registered entry. */
export function researchResultView(state: DiscoveryHintState): ResearchEntryView | null {
  if (!state.researchTargetId) return null;
  return researchEntryViews(state).find((v) => v.recipeId === state.researchTargetId) ?? null;
}

// ---- Contract 2.1 (RESULT-based identification): the Research Target context of one finished attempt ----

/** What REGISTER_TO_DEX needs of the attempt's Research Target: its already-public label and the full known(T). */
export interface ResearchAttemptContext {
  /** The registered entry's public label with its unlock fact: 「？？？ピザ ①（チキン）」. Never a recipe name / id. */
  labelJa: string;
  /** known(T): the derived unlock fact plus every stored `ing:` fact (Contract 2.1 §2), as `researchResultView` knows it. */
  knownIngredientIds: readonly string[];
}

/**
 * The Research Target context of a finished attempt, or `null` without a registered target. Ownership-derived, NOT
 * stock-derived (the same basis as `researchResultView`): an attempt that used the target's last finite stock still
 * has its context (OD-RB-18). It reads no recipe membership for the player-facing label.
 */
export function researchAttemptContext(state: DiscoveryHintState): ResearchAttemptContext | null {
  const view = researchResultView(state);
  if (!view) return null;
  const unlockId = deriveResearchEntries(state).entries.find((e) => e.recipeId === view.recipeId)?.knownExactIngredientIds[0];
  const unlockName = unlockId ? getIngredient(unlockId)?.nameJa : undefined;
  return {
    labelJa: unlockName ? `${view.label}（${unlockName}）` : view.label,
    knownIngredientIds: view.knownExactIngredientIds,
  };
}
