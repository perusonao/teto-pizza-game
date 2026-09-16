# PIZZA_GAME Phase 4A-1B.2 — Sauce Interaction Parity Result

## Delivery

- Baseline SHA: `3a3610de9769061df5bab9173e63fcc3ef973bf0` (PR #28 HEAD, verified against origin before branching)
- Branch: `claude/phase-4a-1b2-sauce-parity`
- Implementation commit SHA: `2c2a68ae5b1820a1e2fb75f5b79f19dd347a510e`
- PR: [#29 — Phase 4A-1B.2: Recipe Sauce Interaction Parity](https://github.com/perusonao/teto-pizza-game/pull/29)
- CI: [run 35057600054](https://github.com/perusonao/teto-pizza-game/actions/runs/35057600054) — success
- PR #28 and `claude/phase-4a-1b1-first-fun-fix-b445ge` were not modified.

The named `PIZZA_GAME_Post-HumanFeel_Gameplay-Consistency_Audit.md` file was not present in the baseline checkout, origin branches, GitHub code search, or PR #28 discussion. The Sauce-parity findings reproduced in the implementation brief were therefore used as the audit input.

## Changed files

- `src/App.tsx`
- `src/components/PizzaStage.tsx`
- `src/components/PizzaStage.sauceParity.test.tsx`
- `src/data/recipeSauceProfiles.ts`
- `src/data/recipeSauceProfiles.test.ts`
- `src/logic/sauceField.ts`
- `src/logic/sauceField.test.ts`
- `src/screens/GameScreen.tsx`
- `src/screens/GameScreen.keyboardOverlay.test.tsx`
- `src/screens/GameScreen.keyboardSpreadRepeat.test.tsx`
- `src/screens/GameScreen.physicalDragOverlay.test.tsx`
- `src/state/gameReducer.ts`
- `src/state/gameReducer.commitSauceDispense.test.ts`
- `src/state/pizzaState.ts`

No order-selection change remains in the implementation commit. A local-only deterministic order fixture used for browser QA was reverted before the final test run and commit.

## Current seven-recipe Sauce matrix

| Recipe id | Sauce ingredient | Before this PR | Expected interaction | Final profile |
|---|---|---|---|---|
| `margherita` | `tomato-sauce` | FREE: field paint; Lunch Rush: legacy one-shot/full fill | player paint | `PAINT` |
| `marinara` | `tomato-sauce` | legacy one-shot/full fill | player paint | `PAINT` |
| `quattro-formaggi` | `olive-oil` | legacy one-shot/full fill | player interaction | `PAINT_TEMPORARY` |
| `genovese` | `pesto` | legacy one-shot/full fill | player paint | `PAINT` |
| `bismarck` | `tomato-sauce` | legacy one-shot/full fill | player paint | `PAINT` |
| `funghi` | `tomato-sauce` | legacy one-shot/full fill | player paint | `PAINT` |
| `fugazza` | `olive-oil` | legacy one-shot/full fill | player interaction | `PAINT_TEMPORARY` |

All profiles start from `createEmptyPizza()` with empty `sauceIds` and `sauceDeposits`. Changing recipes or advancing to a second/third pizza does not synthesize a completed Sauce state.

## Olive-oil decision

Olive oil is explicitly `PAINT_TEMPORARY`, not mechanically classified as ordinary paint and not left pre-completed. Implementing a distinct amount/line-oriented DRIZZLE lifecycle would exceed this parity PR and duplicate or substantially reshape the proven dispenser/rendering path.

The profile data and code retain:

`TODO: olive-oil -> DRIZZLE candidate.`

Olive oil uses the shared field painter for now and renders with its ingredient color (`#e9d9a0`), visibly separate from tomato red and pesto green.

## Recipe Sauce profile design

`recipeSauceProfiles.ts` is the single recipe-to-Sauce interaction table. Every one of the seven `RecipeId` values maps to exactly one required Sauce ingredient and an interaction kind. Tests compare that table against `RECIPES[].requiredIngredients`, so adding or changing a recipe cannot silently drift from its Sauce profile.

`App` resolves the profile from the current recipe and passes the same object through `GameScreen` into `PizzaStage`. `PizzaStage` reuses the Phase 4A-1B.1 `SauceDispenseController`, atomic pending/commit lifecycle, authoritative `sauceDeposits`, `buildSauceField`, and `smoothSauceFieldForDisplay` path for every profile. There is no FREE-specific or Lunch Rush-specific Sauce implementation.

The reducer independently resolves the same profile and accepts `COMMIT_SAUCE_DISPENSE` only when the action ingredient matches that recipe. Phase, ownership, finite-coordinate, positive-amount, and atomic-batch guards remain enforced.

## FREE / Lunch Rush parity evidence

- Code: `isMissionRound` is no longer an exclusion for `COMMIT_SAUCE_DISPENSE`; both modes use `getRecipeSauceProfile(state.recipe.id)` and the same action/reducer case.
- Regression: the Mission test commits `pesto` for a Mission Genovese state through the same reducer path as FREE.
- Browser: a 390×844 Lunch Rush Genovese round opened with an empty field, auto-selected `pesto`, accepted the same pointer drag, changed the live hint to the cheese step, and rendered the same green field.

## Sauce field and visual evidence

- Every recipe begins with zero heatmap canvases and zero legacy flat Sauce layers.
- Pointerdown immediately creates the starter field deposit; pointermove feeds the timestamped path; pointerup atomically commits the batch.
- Component regressions cover Margherita/tomato, Genovese/pesto, and Quattro Formaggi/olive-oil and assert that the legacy `onTap` path is not used.
- `sauceFieldToRgbaPixels(field, colorHex)` changes only RGB bytes. The alpha/density curve and authoritative field are unchanged.
- `smoothSauceFieldForDisplay` remains called only on the local display copy immediately before pixel conversion. Metrics continue to consume the unsmoothed authoritative field.
- Existing finite Sauce metrics and quantity/coverage/evenness/edge tests remain green.

## Unchanged-contract evidence

The diff from baseline to implementation commit is empty for:

- `src/logic/scoring.ts` and `src/logic/referenceScoring.ts` — legacy score, shadow scoring, stars, BEST, and Sauce scoring semantics unchanged.
- `src/data/referencePizza.ts` — Reference data, Reference Pizza availability, quantities, and piece positions unchanged.
- `src/state/persistence.ts` — save key/schema and migration behavior unchanged.
- `src/logic/economy.ts` and `src/state/progression.ts` — Inventory, ownership, stock, Pitz, Economy, and progression unchanged.

Existing Mozzarella/Basil physical-interaction suites, Bake→Result suites, reset suites, persistence suites, scoring suites, and Reference suites all pass without weakened assertions. Reset still clears Sauce and permits repainting; no one-way step lock was added.

## Verification

Runtime note: the machine default Node 20.8.1 is too old for the checked-in Vite/Vitest toolchain, so local verification used the installed Node 24.19.0 runtime. GitHub CI also passed with its configured environment.

| Check | Result |
|---|---|
| TypeScript (`tsc -b`) | pass |
| Lint (`oxlint`) | pass |
| Full Vitest | **38 files / 511 tests passed** |
| Production build (`vite build`) | pass |
| `git diff --check` | pass |
| GitHub PR CI | success |

## Browser human-flow — 390×844

Browser: Chromium-based Codex in-app browser, exact `window.innerWidth × innerHeight = 390 × 844` confirmed during PREPARE. Console errors: **0**.

For repeatable QA only, the local order picker was temporarily forced to the requested sequence; that temporary diff was reverted before final verification and is absent from commit `2c2a68a`.

1. Pizza 1 — Margherita / tomato
   - Began on bare dough: heatmap 0, flat Sauce layer 0.
   - Pointer drag created a soft red tomato field and advanced the hint.
   - Mozzarella ×3 and Basil ×2 physical/tap placement remained functional.
   - Fixed Bake stayed inside the viewport; Bake→Result completed.
2. Pizza 2 — Genovese / pesto
   - Second consecutive pizza again began on bare dough: heatmap 0, flat Sauce layer 0.
   - `pesto` was selected from recipe data; pointer drag created a green field.
   - The basic interaction did not change from pizza 1; Bake→Result completed.
3. Pizza 3 — Quattro Formaggi / olive oil
   - Third consecutive pizza again began on bare dough: heatmap 0, flat Sauce layer 0.
   - `olive-oil` was selected; pointer drag created a pale gold field distinct from tomato/pesto.
   - Reset cleared the field back to heatmap 0 / flat layer 0; repaint worked immediately.
   - Four-cheese placement and Bake→Result completed with the existing 5-star result contract.

Across the flow, the fixed Bake bar remained visible (measured bottom `834` within height `844`) and the existing 3×2-capped Ingredient Palette layout remained intact.

## Preview

- Preview source SHA: `2c2a68ae5b1820a1e2fb75f5b79f19dd347a510e`
- Preview repository commit: `4f11c7cedc305ee80fda46f58963df63bf40c0c5`
- Build-from-source run: [35057635288](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35057635288) — success
- Pages run: [35057687724](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35057687724) — success (manual `workflow_dispatch`, because the bot push did not auto-trigger Pages)
- Preview URL: https://perusonao.github.io/teto-pizza-game-preview/
- Live badge verified: `PREVIEW · PR#29 · 2c2a68a`
- Live console errors: 0

## Remaining issues

- `olive-oil` remains a deliberate `PAINT_TEMPORARY`; a dedicated `DRIZZLE` profile is a later candidate.
- Recipe order selection remains the existing random/undiscovered-priority behavior. The requested three-recipe QA sequence was test orchestration only, not a gameplay change.
- One-Way Cooking Steps, Scoring 2.0, Reference cheese mismatch, save migration, Inventory/Economy, and baked visual polish remain explicitly out of scope for their own phases/PRs.

## Status

PR created, CI green, dedicated Preview deployed successfully. Production `main` was not merged or modified.

**WAITING FOR IPHONE HUMAN FEEL**

---

## Codex merge-blocker fix — Sauce gesture survives RESET_PIZZA

### Blocking finding

The final independent merge gate found one blocking P2 lifecycle race: while a Sauce pointer
remained held, tapping `やり直す` cleared canonical `state.pizza` but did not invalidate
PizzaStage's local dispense session. Releasing the pre-reset pointer could therefore dispatch
`COMMIT_SAUCE_DISPENSE` and restore Sauce onto the freshly reset pizza.

### Root cause

`GameScreen` already incremented `pizzaResetToken` in the same handler that dispatched
`RESET_PIZZA`, but only `IngredientTray` consumed it for the PR #26 physical-piece drag race.
PizzaStage watched `interactive` and ingredient changes, neither of which changes during a normal
reset, so its controller, RAF, pending deposits, pointer capture, and gesture refs stayed live.

### Exact fix

The existing reset generation is now passed to both interaction owners. PizzaStage observes
`pizzaResetToken` and invokes its existing semantic `abortActiveGesture()` path whenever the
generation changes. That path stops the controller/RAF, discards pending deposits, reports empty
progress, safely releases pointer capture, clears the trail, and replaces the gesture state.
Later pointerup/pointercancel/lostpointercapture events from the old pointer no longer match a
session and cannot dispatch `COMMIT_SAUCE_DISPENSE`. A new post-reset pointerdown starts normally.

No recipe, profile, scoring, Reference, persistence, Inventory, Economy, palette, physical-piece,
or visual-polish behavior changed.

### Regression tests added

`PizzaStage.sauceReset.test.tsx` uses the real game reducer and the same reset-token wiring as
GameScreen. It covers:

- tomato pointerdown → reset → stale pointerup;
- pesto pointerdown/move → reset → stale pointerup;
- olive-oil `PAINT_TEMPORARY` reset followed by a successful fresh gesture;
- Lunch Rush pesto reset followed by a successful fresh gesture;
- reset followed by pointercancel, lostpointercapture, blur, and visibilitychange;
- explicit assertions that stale paths never attempt `COMMIT_SAUCE_DISPENSE` and canonical Sauce
  remains empty.

Full Vitest after the fix: **39 files / 518 tests passed**. Existing assertions were not weakened.
TypeScript, lint, production build, and `git diff --check` also passed.

### Browser verification — 390×844

Production build, Lunch Rush Genovese:

1. Confirmed empty initial Sauce field (`heatmap = 0`, legacy flat layer = 0).
2. Began a held pesto drag and activated `やり直す` before its release.
3. Confirmed the stale release left the pizza empty (`heatmap = 0`, flat layer = 0) and the
   initial Sauce hint remained active.
4. Performed a new post-reset pesto drag and confirmed it painted normally (`heatmap = 1`) and
   advanced the hint to the mozzarella step.
5. Confirmed `window.innerWidth × innerHeight = 390 × 844` and console errors = **0**.

### Commit

- Final blocker-fix implementation SHA: `b9ed315b4fbd5afb3198c30a225086e68d8d458a`

## Updated status

**READY FOR BLOCKER VERIFICATION**
