# Discovery Hint 3.0 — H3-3 Runtime Wiring: Result (Issue #238)

> Status: **Step 0 Integration Map, recorded before implementation.** The implementation sections are
> appended once the code lands.

## 1. Audited main

This audit reflects `main` = `4e78f3d` (Merge PR #244, H3-2), fetched fresh at the start of the session.

- Dinner DM-3 PR #243 is still open, and nothing here touches it.
- That PR edits `App.tsx`, `GameScreen.tsx`, `HomeScreen.tsx` and `App.css`.
- It does not edit `gameReducer.ts`, `discoveryHint.ts`, `HintSheet.tsx`, `persistence.ts`, or any
  `src/logic/discovery/*` file.
- H3-3 therefore keeps its edits to the four shared files minimal. That means a few lines in
  `App.tsx`, one prop in `GameScreen.tsx`, and one small CSS block.

## 2. Integration Map (Step 0, before code)

| Area | Current authority on `main` |
|---|---|
| Hint entry points | Three entry points all dispatch `SHOW_HINT`:<br>- Free Cooking 「ヒント」 button → `SHOW_HINT` (App.tsx `onShowHint`)<br>- Dex 🎨 card → `handleDexShowHint` → free-cook round + `SHOW_HINT { pinnedRecipeId }`<br>- Result 「💡 ヒントを見る」 → `handleRetryWithHint` → `RETRY_SAME_RECIPE` + `SHOW_HINT` |
| Sheet | `HintSheet.tsx` renders `hintSheetView(state)` (`discoveryHint.ts`). `GameScreen.tsx:724` passes `onUnlock` → `PURCHASE_DISCOVERY_HINT { level }`. Visible only in a Free Cooking PREPARE (`isHintSheetVisible`). |
| Target | `resolveHintSession`:<br>- The target must be DISCOVERABLE.<br>- A Dex pin keeps its recipe.<br>- A session target is sticky once H1+ is revealed or bought.<br>- Otherwise the deterministic order picks the target (`selectHintTarget`).<br>- With no DISCOVERABLE target, the sheet shows SHOP_NEW / REFILL / COMPLETE. |
| Purchase (Economy 1.0) | `PURCHASE_DISCOVERY_HINT` → `unlockNextHint` → `purchaseDiscoveryHint`: 5/10/20/40 Pitz, `requestedLevel === purchased + 1`, raises `discoveryHintPurchases`. |
| Dex-0 onboarding | `isHintOnboardingFree(0, "margherita")` means a free reveal. It is session-only (`hintSession.revealedIndex`) and never persisted. Auto-escalation comes from `preDiscoveryFreeCookAttempts`. |
| Pitz | `GameState.pitzBalance` is persisted through `persistProgress` in App.tsx's progression effect. |
| Save / load | `loadSave` → `createInitialGameState(..., save.discoveryHintPurchases)`. The effect persists `discoveryHintPurchases`. **`discoveryHintFacts` exists in the save (H3-2), but GameState neither reads nor writes it yet.** |
| H3-1 / H3-2 | Pure and unwired, with no importer: `selectableHint.ts` (model, pricing, purchase, presentation) and `hintFactMigration.ts` (`selectableHintSavedState` → `purchasedFactIds`, `legacy`, `grandfatheredSteps`). |
| Timer | `isHintSheetVisible` feeds `isAnyCookingTimingPauseReasonActive`, so the timer pauses while the sheet is open and resumes when it closes. |
| Near-miss | `resultNearMiss` uses DISCOVERABLE candidates only and names no ingredient. It does not depend on hint state. |
| Dinner | `DINNER_BLOCKED_ACTIONS` contains `PURCHASE_DISCOVERY_HINT`. A Dinner round is never `freeCook`. |
| Full Reset | `resetSave()` removes the whole key (both ledgers). |

## 2.1 Plan (derived from the map)

**New action** `PURCHASE_SELECTABLE_HINT { preference, expectedPaidCount }`. The guards are:

- the sheet is open;
- the round is a Free Cooking PREPARE;
- a session target exists and is still DISCOVERABLE;
- the target is not the Dex-0 Margherita onboarding.

The action calls H3-1's `purchaseSelectableHint` with input from H3-2's `selectableHintSavedState`.

- **Success:** Pitz is debited exactly once. The target's `discoveryHintFacts` becomes the union of
  the stored list (unknown or future ids kept) and the new facts. `discoveryHintPurchases` is left
  untouched.
- **GUIDANCE_ONLY:** nothing progression-related changes. Only a transient, never-persisted UI flag
  `hintOutcome` is set, so the sheet can show generic guidance.
- **Any rejection** (stale, insufficient, invalid, not a target): `state` is returned unchanged.

**`PURCHASE_DISCOVERY_HINT` becomes onboarding-only.** It still handles the Dex-0 Margherita free
reveal. A paid Economy 1.0 level is no longer sold, so the legacy field can no longer advance at
runtime. The legacy field remains the read authority for `LegacyHintProgress` and
`grandfatheredSteps`.

**The sheet has two modes.**

- The onboarding keeps today's Hint 2.0 free flow unchanged.
- Every other target gets a `SELECTABLE` view, built from `selectableHintPresentation`, the H0 line
  and the grandfathered lines. It is a minimal UI: preference radios, price, CTA, wallet, revealed
  chips, a legacy section and a guidance line. Final polish is left to H3-4.

**Persistence:**

- `GameState.discoveryHintFacts` is hydrated from `loadSave`.
- It is carried through `ProgressionCarry`.
- `App.tsx` passes it to `persistProgress`, where it is union-merged (H3-2).
- schemaVersion stays 2.

**Session stickiness:** a target with Hint 3.0 facts is sticky, just like one with legacy levels, so
a reload keeps the bought target.

**Dinner:** the new action is added to `DINNER_BLOCKED_ACTIONS` as defense in depth. No Dinner file
changes.
