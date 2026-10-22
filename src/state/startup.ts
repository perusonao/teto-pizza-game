/**
 * The state the page starts from (moved out of App.tsx so the save -> state step, including R8's completion of a baked round, is
 * testable without React). A pure function of the stored save, apart from telling the write gate what this page loaded.
 */
import { initialTechniqueLedger } from "../logic/techniques/runtime";
import { createInitialGameState, type GameState } from "./gameReducer";
import { resolveShopEntitlement } from "./materialEntitlement";
import { loadStartupSave, type StorageLike } from "./persistence";
import type { HeldPendingRoundReason, PendingRound } from "./pendingRound";
import { settlePendingRound } from "./pendingRoundSettle";

/** What the page starts from: the state built from the save (a `pending` round journal already completed), and the journal's notices. */
export interface Startup {
  state: GameState;
  /** A `settled` journal waiting for the player's confirmation (completed now, or found settled in the save). */
  settled: PendingRound | null;
  /** A journal this build keeps but cannot act on. */
  held: HeldPendingRoundReason | null;
}

export function buildStartup(storage?: StorageLike | null): Startup {
  // PR-3 (#560, N1): the startup load -- it also tells the write gate what this page loaded (see state/saveSession.ts).
  // R8: the same read also yields the round journal found in the save.
  const { save, pendingRound } = storage === undefined ? loadStartupSave() : loadStartupSave(storage);
  // Progression 2.0 W1 Integration I4b-3 (REC-04; replaces EP4's load-time Starter Grant
  // catch-up, which is retired): resolve the Discovery Ladder once on load, before
  // `createInitialGameState`. For an existing save this is the migration -- the Shop
  // entitlement becomes the stored ledger + every finite material already OWNED (EP4-granted
  // ones included, stock untouched) + the ladder materials reached at the Dex discovered count;
  // anything newly entitled starts at stock 0. Nothing is granted and
  // `starterGrantClaimedRecipeIds` is carried through unchanged (so a rollback to a pre-I4b
  // build never re-grants a claimed recipe). A complete no-op for an up-to-date save.
  const entitlement = resolveShopEntitlement(
    save.dex,
    save.ownedIngredientIds,
    save.unlockedForShopIngredientIds,
  );
  const initial = createInitialGameState(
    save.dex,
    save.ownedIngredientIds,
    save.pitzBalance,
    save.inventory,
    save.starterGrantClaimedRecipeIds,
    entitlement.unlockedForShopIngredientIds,
    save.discoveryHintPurchases,
    save.discoveryHintFacts,
    // DM-4-3: the Dinner records, blocked (broken) missions included, so a settlement can never
    // mistake a broken record for "no record".
    save.dinnerMissionRecordsState,
    // Cooking Techniques TQ-1C: the technique ledger (known ids), repaired at load so every
    // technique a discovered recipe requires is present (INV-TQ-1). A no-op for today's saves.
    initialTechniqueLedger(save.discoveredTechniqueIds, save.dex),
    // Research 2.0 Phase 2: the persisted negative ledger (known recipe ids).
    save.researchExclusions,
  );
  if (pendingRound.kind === "held") return { state: initial, settled: null, held: pendingRound.reason };
  if (pendingRound.kind === "none") return { state: initial, settled: null, held: null };
  if (pendingRound.round.status === "settled") return { state: initial, settled: pendingRound.round, held: null };
  // R8: a round that was baked and not finished is completed now, with the ordinary scoring and registration (pure; the first
  // save effect writes the result and the `settled` journal in one write). A pure function of the save, so React StrictMode's
  // second initialization builds the same state.
  const completed = settlePendingRound(initial, pendingRound.round);
  if (!completed) return { state: initial, settled: null, held: "unresolvable" };
  return { state: completed.state, settled: completed.settled, held: null };
}

