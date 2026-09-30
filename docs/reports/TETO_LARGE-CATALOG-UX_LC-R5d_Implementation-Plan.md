# Large Catalog UX — LC-R5-d Implementation Plan (dormant hand → Builder tray wiring)

Audited main `e14f33e`. Authority: LC-R5-d Fresh Audit §21 (OD-R5d-1〜3), LC-R5 Audit §21 / §21.1, IVP §8. Scope: **dormant only** — `HAND_ENFORCEMENT_ENABLED` stays `false`; no production-visible tray / pin UI change; no save change; session-only pins; FREE only; Hint 5.0 / Original Pizza Recovery untouched; capacity 9 / 12 not decided; R5-e / R6 not started.

## Design
1. **`src/logic/catalog/handTray.ts` (pure, new)**
   - `resolveTrayHandIds(input)`: `null` unless `HAND_ENFORCEMENT_ENABLED` ∧ `isLargeCatalogEligible(round)` ∧ a tray step (category given) ∧ the hand is **active** (owned > capacity). Otherwise `null` = today's tray path untouched. Priority (`selectWorkingSet`) decides membership only; the result is **normalised to catalog order** (F-1). Stock input = `ownership.stock` (round-start inventory, never pizza-aware). `favorite` / `recent` empty, `hint` none, `new` = `recentlyAcquiredIds` (no new inference).
   - `handTrayTransition({ before, after, selectedIngredientId })`: `changed = !sameIds(before, after)` (ordered catalog-order lists, so a priority-only reorder is not a change). Changed → `{ changed, page: 0, selectedIngredientId: on page 0 of after ? keep : null }`. Unchanged → identity. Page-level, never whole-hand.
   - `pinFitsHand(input, candidateSession)` (OD-R5d-3): true iff hand is inactive/null (nothing hidden) or every pin in the candidate session's category is in the resolved hand — an accepted pin can never be off the tray.
2. **`workingSet.ts`**: placed always kept (OD-R5d-2); pins fill `capacity − placed`; `overflowIds` = pins only.
3. **`pinEdit.togglePin`**: optional `fits` callback; a NEW pin that would not fit → outcome `rejected-capacity`, same session returned; unpinning never blocked. No UI/feedback (R6).
4. **Wiring (dormant)**: `App` computes `trayHandIds` (+ `canPin`) once, passes `trayHand` to `GameScreen` → `IngredientTray` (`handIds`, hand mode only) and the pantry (`pinFits`). `App` keeps `{ key: round|category, ids }` and evaluates `handTrayTransition` **in the render phase** (same idiom as `lastRoundKey` / `lastMakingStep`): no effect, no stale frame, no double clear; different key (round / step change) = no evaluation (existing resets own that). `IngredientTray` resets its page to 0 in the render phase only in hand mode.
5. **OFF equivalence**: flag `false` ⇒ `trayHandIds === null` ⇒ no state written, tray uses `trayIngredientsFor` exactly as before; the category effect is unchanged.

## Slices (one branch, no PR)
R5-d-1 pure + tests + mutants → R5-d-2 wiring + App tests → OFF/isolation/fuzz → full gate.

## Tests
Pure: priority-only reorder ≠ change; membership change → page 0; keep / clear on new page 0; whole-hand-only ≠ visible; page-1 viewing with page-0-only change → page 0; category isolation; placed protection; placed > capacity; pin capacity refusal; inventory-0 existing pin; 9 & 12; FREE-only; Dinner / guided / Lunch Rush null. App (flag forced on, active fixture ≥ 13 toppings): tray shows the hand in catalog order, pin → page 0 + evaluation, placement keeps page / selection, pantry open / search / shelf no clear, capacity-full pin refused, Dinner / guided / Lunch Rush tray unchanged, random-op fuzz of invariant I1. OFF: existing `App.handPins`, tray tests and boundary gates unchanged.

## Mutation (M98〜)
Tray in priority order; whole-hand selection rule; no page reset; hand computed with flag off; pizza-aware stock; non-eligible hand; other category pin changes list; placed evicted; pin accepted beyond capacity; capacity hard-coded; priority-only reorder counted as change; hint fed from a non-empty source.

## Gates before "READY"
full Vitest, `tsc -b`, `oxlint`, `vite build`, mutation gate, Chromium e2e (pin-dormant, pantry, stage-size-stability, dinner, lunch rush, free-cooking). No PR / merge.
