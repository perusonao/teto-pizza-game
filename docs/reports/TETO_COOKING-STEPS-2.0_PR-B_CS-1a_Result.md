# Cooking Steps 2.0 — PR-B (CS-1a) Result

Base: `main` @ `187724573c9ece40329241da5fca66b45606a868` (PR-A #452 squash merge).
Authority: `docs/design/TETO_COOKING-STEPS-2.0_AUTHORITY-INDEX.md` §3 (PR-B row), §4 (fixed-value hazards).
Owner decisions kept as-is: OD-CS-1 = A, OD-CS-2 = B, OD-CS-9 (a), OD-CS-20, UD-C = C1. No open decision was filled in.

## Scope (re-baselined port of PR #295's CS-1a code; #295 stays open)

- `src/data/cookingProfiles.ts` — `MAX_VISIBLE_COOKING_TABS` (6) and `visibleCookingTabCount()`.
- `src/data/cookingProfiles.tabGate.test.ts` (new) — gate over `RECIPES`, the Free Cooking profile and every Dinner strip; a
  7-tab fixture fails; the ceiling itself is pinned. **No 25 / 18 / 7 pins** (Authority Index §4): the recipe count is
  `RECIPES.length`; the "ceiling is reached" check is `max(counts) === MAX_VISIBLE_COOKING_TABS`.
- `src/screens/postBakeView.ts` + test (new) — `renderedPostBakeStep()`.
- `src/screens/GameScreen.tsx` — the six `POST_BAKE && CUT` sites read `postBakeStepRendered` (layout) / `isCutStep` (CUT content).
  The `nextReady` expression is left byte-identical to `main`.

## Not changed

`gameReducer.ts` (CONFIRM_BAKE / finalization), scoring, inventory, save, recipes, CSS, e2e specs. FINISH gets no UI.
CS-1b (`finalizeRound`) is PR-C.

## Verification

| Check | Result |
|---|---|
| `vitest run` (full) | 376 files, 6962 passed, 1 skipped |
| `tsc -b` + `vite build` | pass |
| `oxlint` | no findings in changed files (pre-existing warnings elsewhere only) |
| Chromium E2E (iphone-390x844 + iphone-360x800): pizza-cutting-phase4b, cut-regions-427, dynamic-cooking-steps, making-ui-1screen, dinner-mission | 58 passed, 8 skipped, 0 failed; specs unmodified |
| WebKit / Layout Contract | CI on this PR |
| Human Verification | Not required: internal refactor, DOM identical to `main` (the six conditions are exactly equivalent; exhaustive phase × step equivalence test) |
