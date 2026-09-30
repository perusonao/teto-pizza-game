# Large Catalog UX — LC-R5-d Result (dormant tray hand wiring + page-level #197 transition)

Branch `claude/lc-r5d-fresh-audit-2wa5cy`, from main `e14f33ef196cc4eb8c9080974cddd5dc67ba6459`. **No PR, no merge.** Authority: Fresh Audit §21 (OD-R5d-1 R-α, OD-R5d-2, OD-R5d-3 Model C — Owner-confirmed), Implementation Plan (same folder). Capacity 9 vs 12 **not decided** (R6).

Scope kept: `HAND_ENFORCEMENT_ENABLED = false`; production-visible tray, pantry, geometry unchanged; no pin UI; no save / persistence change; session-only pins; FREE only; Hint 5.0 / Original Pizza Recovery untouched; R5-e / R6 not started.

## What changed
- `src/logic/catalog/handTray.ts` (new, pure): `resolveTrayHandIds` (first statement = enforcement guard; `null` unless FREE Cooking ∧ a tray step ∧ hand active; priority selects **membership only**, the list is normalised to **catalog order**), `handTrayTransition` (actual list change ⇒ page 0; selection kept only if on the **new page 0**; identical list ⇒ identity, so a priority-only reorder is not a hand change), `pinFitsHand` (Model C), `sameIds` / `trayPageIds`.
- `workingSet.ts` (OD-R5d-2): placed ingredients are never dropped for capacity; pins take the remaining slots; `overflowIds` = pins only.
- `pinEdit.togglePin` (OD-R5d-3): optional `fits`; a NEW pin that would not be on the visible hand ⇒ `rejected-capacity` (same session returned); unpinning never blocked. No feedback UI (R6).
- `handPolicy.ts`: `DEFAULT_HAND_CAPACITY_CANDIDATE = 12` (design candidate, documented as not final; tests parametrize 9 and 12).
- Wiring: `App` derives `trayHandIds` + `pinFits` and evaluates the transition **in the render phase** (same idiom as `lastRoundKey` / `lastMakingStep`; no effect, no stale frame, no double clear; a round / step key change is not a hand change). `GameScreen` relays (`trayHand`). `IngredientTray` gets optional `handIds` (hand mode only; `null` = today's `trayIngredientsFor` path) and resets its page to 0 in the render phase only in hand mode. `IngredientPantry` gets optional `pinFits`.
- Flag OFF: `trayHandIds === null`; no state is written, the tray takes the exact current code path; the existing category `useEffect` page reset is untouched.

## Verification
- **Pure** (`handTray.test.ts`, 9 × 12 parametrized): catalog order; priority-only reorder ⇒ no change; membership change ⇒ page 0; keep / clear on the new page 0 (whole-hand ≠ visible page); page-0-only change while viewing page 1 ⇒ page 0; category isolation; placed protected first (brief example placed 3 + pins 8); placed > capacity keeps all; Model C refusal / unpin frees a slot / property test (300 random ops: every pin and placed ingredient stays on the hand); inventory-0 existing pin kept, new zero pin refused; round-start stock only; "new" tier; FREE-only (Dinner, guided, Lunch Rush, forged, no tray step); inactive hand ⇒ `null`. `handTray.off.test.ts`: shipped flag false ⇒ `null` for every round / capacity, pins never refused.
- **App** (`App.handTray.test.tsx`, flag forced on, 22 toppings owned ⇒ 12 on 2 pages): catalog-ordered tray; pin outside ⇒ page 0 + selection cleared / retained (page-0 selection); priority-only pin / unpin ⇒ tray, page, selection identical; placement never moves the tray; pantry open / search / close never clear; pinning every tile ⇒ exactly 12 pins, all on the tray; placed ingredients stay on a full tray; **fuzz** (36 random select / page / pin / unpin / clear / place ops): an invisible selection never places a piece (I1); Dinner keeps the 22-topping paged tray with pins. `App.handTray.off.test.tsx` (real flag): today's 4-page tray in catalog order, #197 unchanged, no pin UI.
- Boundary gates updated deliberately: new module list, App allow-list (`handTray`, `catalogSource`, `handPolicy`), new R5-d gate (dormant first statement, catalog sort, only App calls the resolver, tray / pantry know nothing of hand internals, persistence / reducer unaware, `handTray` imports fixed).
- **Mutation** `tools/large-catalog-ux/mutation-check.mjs` M98〜M114: **17/17 killed** (M112 first survived because the placed ingredients overlapped the pinned set; the test was strengthened, then killed). Source verified restored after each run.
- Full Vitest: **264 files, 5103 passed, 1 skipped, 0 failed** (main before: 255 / 4962 in R5-c + later work). `tsc -b` clean. `oxlint`: only the 2 pre-existing warnings (`scoringV2.noSauceProfile.test.ts`). `vite build` OK.
- Chromium e2e (`iphone-390x844` + `iphone-360x800`): large-catalog-pin-dormant, -pantry-search, -pantry-shell, -pantry-shelves, stage-size-stability, dinner-mission, lunch-rush-material-shortage, free-cooking-phase3-2, inventory-modal-stable-bounds — **56 passed, 16 intentional width-guard skips, 0 failed**. Geometry unchanged (production DOM unchanged). **WebKit not run here** (CI).

## Human Verification
Not applicable (Policy §2): no production-visible change — flag false ⇒ `trayHandIds = null`, production tray / pantry DOM and geometry unchanged (asserted by unit, App OFF and e2e). The forced-on hand's real-device feel (page 0 reset, pin capacity, 9 vs 12) belongs to R5-e / R6.

## Carried to R5-e / R6
Capacity-full feedback UI and 3-state cue (R6 / R5-e); a pin on an already-placed ingredient is accepted at no slot cost (presentation of 「配置ずみ」 = R5-e); edit-then-undo does not restore a cleared selection (per-edit evaluation, R6 observation); forced-on e2e / HV mechanism (G-c); WebKit in CI; 9 vs 12 at the R6 real-device Human Feel Gate.

**Verdict: A. R5-d IMPLEMENTED / READY FOR REVIEW**
