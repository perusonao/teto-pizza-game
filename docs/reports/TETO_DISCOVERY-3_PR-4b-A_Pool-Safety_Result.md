# Discovery 3.0 PR-4b-A: pool > 1 safety foundation — Result Report

Branch `claude/teto-pizza-pr-4b-a-j4k1zr`, from `origin/main` `565cd05` (PR-4a #327 / #328 merged, post-merge Deploy / WebKit green; no duplicate PR).
Authority: Owner decisions D-1 … D-6 (this task). Production stays at **25 recipes**; no `brazilian-calabresa`.

## 1. Production changes

| file | change |
|---|---|
| `src/logic/discovery/hintTarget.ts` | D-1: exactly one DISCOVERABLE = auto target; 2+ with no pin / sticky / purchase = new empty kind `OPEN_POOL` (no recipe chosen). The candidate order is kept as a list order only. |
| `src/state/discoveryHint.ts` | `isSessionTarget` now means "`resolveHintSession` still returns it" (sole candidate or sticky / purchased); `hintSheetView` without a session resolves sticky / purchased first, else the empty kind. |
| `src/components/HintSheet.tsx` | copy for `OPEN_POOL` (existence only: 「まだ発見できるピザがあるよ！」). |
| `src/components/DexOverlay.tsx` | D-2 / D-3: 2+ DISCOVERABLE (any save, state-derived) → one aggregated unknown card (no No., no number, no hint entrance, CTA 「フリークッキングで探す」); the candidates' own slots render as plain unknown slots. Pool 0 / 1 unchanged. |
| `src/data/recipes.ts`, `src/mission/lunchRush.ts` | D-4: `Recipe.lunchRush?: false` + `participatesInLunchRush`; filtered at `missionOrderRecipeIds` (the one merge point; cookable / start checks derive from it). No production recipe opts out. |
| `src/data/recipeHintRoles.ts` | D-5: `RECIPE_HINT_ROLES: Record<RecipeId, HintRoles>` (type only; data untouched). |

No change to save schema / persistence, recipe count, chapters, Orders, references, scoring, CUT, #295.

## 2. Behaviour

- **pool > 1 Hint:** no valid sticky and no purchase → no session, sheet shows the `OPEN_POOL` line, nothing is sold. Unknown recipes are never auto-targeted by candidate order.
- **sticky / purchased:** kept. Purchased facts or legacy levels (first in hint order if several), a revealed (H1+) or Dex-opened session target stay the target; they are never moved. An H0-only session does not survive pool 2+ (nothing was paid).
- **Dex:** one aggregated unknown; no candidate count / name / identity / per-candidate Hint entrance in text, attributes or slot numbering (a 2-candidate and a 3-candidate Dex render the identical card HTML). 「あと○種類」 is the unchanged total-remaining line.
- **Migration saves (D-3):** the rule is state-derived, so a legacy save with several DISCOVERABLE recipes gets the aggregated card too. The normal 25-ladder never reaches pool > 1 (asserted), so its player-visible behaviour is unchanged.

## 3. Tests

New: `discoveryHint.pool.test.ts` (pool 0 / 1 / 2+, A→B, B→A, sticky / purchased kept, stale sticky, unlock refused for a non-sticky session), `DexOverlay.hint.test.tsx` pool 0 / 1 / 2+ + count-independence, `lunchRush.exclusion.test.ts`, `recipeHintRoles.migration.test.ts`, `e2e/discovery-dex-aggregated.spec.ts`.
Updated (old "auto-target / one 🎨 card per candidate" assumptions): `hintTarget`, `branchingPool`, `discoveryHint`, `DexOverlay.hint`, `App.dexHint`, three Dex-0 onboarding reducer tests (now a fresh Dex-0 save, where Margherita is the only candidate).

Parity: all existing25 golden / Hint 5.0 / progression / economy simulation tests pass unmodified.

## 4. Verification

Full unit 5532 passed / 1 skipped; `tsc -b`, `vite build` OK; `oxlint` = the 2 existing warnings in `scoringV2.noSauceProfile.test.ts`. Chromium e2e (390×844 + 360×800): discovery-dex-hint, discovery-hint-sheet, discovery-hint5-ladder, discovery-near-miss-result, progression2-p3-3-onboarding, lunch-rush-material-shortage, lunch-rush-result-ranking-phase4, discovery-dex-aggregated → 50 passed, 12 skipped (existing skips), 0 failed (+ the 2 new).

## 5. Human Verification

390×844 video delivered directly (WebM / VP8: no H.264 encoder available, Policy §5), not committed. Before / after screenshots at 390×844 and 360×800: `docs/reports/screenshots/discovery3-pr4b-a-pool-safety/` (legacy pool-2+ save: Dex candidate area, Free Cooking hint sheet).

## 6. Open items

- **OD-4b-A-2 (pin, resolved):** with a pool > 1 a pin never chooses a target. `selectHintTarget` honours a pin only when the pool is one or the pin is the valid sticky / purchased target itself, so a pin on another recipe neither starts a target nor moves a kept one. Pool-1 pins and the Dex-card path at pool 1 are unchanged. Tests: `hintTarget.test.ts`, `branchingPool.test.ts`, `discoveryHint.test.ts`, `gameReducer.hintPurchase.test.ts` (reducer suites now start from a sticky session via `testSupport/hintSheetOpen.ts`).
- **OD-4b-A-3 (Dex-0 migration edge case, recorded spec, no exception):** Dex 0 + Margherita undiscovered + many owned materials (a migrated / hand-edited save; not reachable by normal play) + pool > 1 follows the general rule: no auto-target, so the free Margherita onboarding Hint is not offered (the sheet says only that something can be found). Margherita is still discovered by Free Cooking (starter materials only; the matcher reads neither hints nor stock), Pizza Select still shows the first-discovery prompt, and progression continues: no softlock. The Phase 3-3 contract (pre-discovery gate, Lunch Rush lock, free-cook escalation) is unaffected; only the OD-HE-5 free onboarding Hint is absent for this save shape. An ordinary new save (starters only) keeps the onboarding Hint. Pinned in `src/state/discoveryHint.guards.test.ts`.
- `PizzaSelectPrompt` / HOME bubble still carry the DISCOVERABLE count in view data (never rendered). Left as is.
