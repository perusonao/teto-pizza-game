# PIZZA_GAME Phase 4A-1B: Final Integration / Merge Gate Result

## Summary

Human Feel Fix 1-4 have been integrated into PR #26's head branch
(`codex/phase-4a-1b-physical-interaction`) by a clean fast-forward, verified
end to end, and the PR body updated. **PR #26 has not been merged.**

## SHAs

| Ref | SHA | Notes |
| --- | --- | --- |
| `origin/main` (at time of integration) | `65a3cc4b8e90c9c9f97486e69c95bc805a404fe9` | "Issue #24: HOME/GAME separation + App Icon/PWA (#25)" |
| PR #26 head, before this integration | `e02425b3855625d225339fcae0eaead5699ceff3` | "docs: append P2 fix result to Post-#25 integration report" |
| Human Feel Fix 4 commit | `e232a184d4aca83b9b6475a211f7b96bae82d76a` | matches the expected `e232a18` given in the task brief |
| `claude/sauce-visual-polish-fix4-daojxu` HEAD (Fix 4 result docs) | `628201c78a6140691d132626d3c5ac7d67bd5f93` | contains Fix 1-4 linearly on top of the pre-integration PR #26 head |
| PR #26 head, after this integration | `628201c78a6140691d132626d3c5ac7d67bd5f93` | identical to the fix4 branch HEAD (pure fast-forward) |

The Fix 4 SHA present on GitHub matches the expected SHA given in the task
brief exactly (`e232a18` is the abbreviated form of
`e232a184d4aca83b9b6475a211f7b96bae82d76a`), so integration proceeded
without needing to halt.

## Integration method

**Fast-forward merge** (no cherry-pick, no rebase, no force-push):

- `claude/phase-4a-1b-human-feel-preview-1byr1k` (Human Feel Fix 1-3 + Preview
  infra) and `claude/sauce-visual-polish-fix4-daojxu` (+ Fix 4) both build
  linearly on top of PR #26's own head commit (`e02425b`), with **zero**
  divergent commits on either side (`git merge-base --is-ancestor
  origin/codex/phase-4a-1b-physical-interaction
  origin/claude/sauce-visual-polish-fix4-daojxu` confirmed true, and no merge
  commits appear between the two).
- This meant the safest and most history-transparent option was also the
  simplest: `git checkout -B codex/phase-4a-1b-physical-interaction
  origin/codex/phase-4a-1b-physical-interaction && git merge --ff-only
  origin/claude/sauce-visual-polish-fix4-daojxu`, then a plain (non-force)
  `git push`. GitHub accepted it as a fast-forward
  (`e02425b..628201c`), so no PR history was rewritten and no approvals were
  invalidated by history changes.
- Fix "1" corresponds to commit `d141839` ("iOS Safari Human Feel fix for
  Mozzarella/Basil drag"); Fix 2 is `df54072` + `292c152` (fixed 3x2 grid,
  no tray scroll; Sauce Painting Visual/Scoring Discoverability); Fix 3 is
  `564fd52` (PREPARE 1-screen layout + Sauce Visual); Fix 4 is `e232a18`
  (Sauce Visual Polish). All four are present in the integrated PR #26 head.

## `origin/main...HEAD` changed files

The true diff against the current `origin/main` tip is **37 files, +5369 /
-152**, and is fully explainable as Phase 4A-1B physical interaction +
Human Feel Fix 1-4 + their docs:

```
docs/design/PIZZA_GAME_Phase4A-1B_Cheese-Topping-Physical-Interaction_Design.md
docs/design/PIZZA_GAME_Phase4A-1B_Ingredient-Palette-Fixed-Grid_Design.md
docs/reports/PIZZA_GAME_Phase4A-1B_Cheese-Topping-Physical-Interaction_Result.md
docs/reports/PIZZA_GAME_Phase4A-1B_Post25-Integration_Result.md
docs/reports/PIZZA_GAME_Phase4A-1B_PreImplementation_Audit.md
docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix2_Result.md
docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix3_Result.md
docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix4_Result.md
docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix_Result.md
src/App.css
src/App.humanFeelFix3.test.tsx
src/App.tsx
src/components/IngredientTray.palette.test.tsx
src/components/IngredientTray.physicalDragReset.test.tsx
src/components/IngredientTray.tsx
src/components/PizzaStage.tsx
src/components/PreviewBadge.tsx
src/components/ReferencePreview.tsx
src/components/SauceMetricsPanel.test.tsx
src/components/SauceMetricsPanel.tsx
src/data/ingredients.ts
src/data/referencePizza.test.ts
src/data/referencePizza.ts
src/logic/pieceDrag.test.ts
src/logic/pieceDrag.ts
src/logic/referenceMatching.test.ts
src/logic/referenceMatching.ts
src/logic/referenceScoring.ts
src/logic/sauceEvaluation.test.ts
src/logic/sauceEvaluation.ts
src/logic/sauceField.test.ts
src/logic/sauceField.ts
src/screens/GameScreen.tsx
src/state/gameReducer.pieceDrag.test.ts
src/state/gameReducer.ts
src/state/persistence.ts
src/state/phase4a1b.regression.test.ts
```

No `05_no_stray_files` warning: nothing under save schema, legacy
authoritative scoring, Dex, Mission, Pitz, Shop, or progression paths
appears in this list.

### Note on GitHub's PR summary numbers vs. the true diff

Immediately after the push, GitHub's PR API (`pull_request_read` /
`get`) reports `changed_files: 60`, `additions: 8283`, `deletions: 363`,
computed against the PR's originally-recorded `base.sha`
(`0c880f6f...`, the pre-PR-#25 `main`). That is a **stale/display**
figure only -- `git merge-base` between the integrated head and the
*current* `origin/main` tip (`65a3cc4b...`) is `65a3cc4b` itself (i.e.
`main` is fully contained in the branch's history via its own earlier
"Post-#25 integration" merge commit), so the real, up-to-date diff is the
37-file list above. This is exactly the "old merge-history apparent diff"
risk flagged in the task brief; it was checked for and ruled out at the
git level. GitHub's PR page/API total may lag until it recomputes against
the branch's true merge-base with `main`; reviewers doing a fresh `git
diff origin/main...codex/phase-4a-1b-physical-interaction` locally will
see the 37-file diff, not 60.

## Test count

**Vitest: 32 files / 447 tests passed** (meets the "at least 447" bar).

```
Test Files  32 passed (32)
     Tests  447 passed (447)
```

## Full verification run (all PASS)

| Check | Result |
| --- | --- |
| `tsc -b` | PASS (clean) |
| `oxlint` | PASS (clean) |
| `vitest run` | PASS (447/447, 32 files) |
| `vite build` | PASS (production build succeeded) |
| `git diff --check` | PASS (no whitespace errors) |

## Browser verification (390x844, headless Chromium via Playwright)

Full flow driven end-to-end against a production `vite build` +
`vite preview` server:

`HOME -> GAME -> Margherita (free play) -> Sauce (hold-to-dispense paint) ->
Cheese tab -> Mozzarella x3 (physical pointer drag) -> Topping tab -> Basil
x2 (physical pointer drag) -> Bake -> Result`

| Checkpoint | Vertical scroll | Horizontal scroll |
| --- | --- | --- |
| HOME | 0 | 0 |
| GAME / ORDER | 0 | 0 |
| PREPARE - Sauce (before/after paint) | 0 | 0 |
| PREPARE - Cheese tab | 0 | 0 |
| PREPARE - after Mozzarella x3 | 0 | 0 |
| PREPARE - Topping tab | 0 | 0 |
| PREPARE - after Basil x2 | 0 | 0 |
| BAKE | 0 | 0 |
| RESULT | 0 | 0 |

- Bake CTA (`.cta-button--bake`) visible: **true**
- Result panel (`.result-panel`) reached: **true**
- Console errors / page errors during the entire run: **0**
- Result screen showed sauce + 3 Mozzarella + 2 Basil correctly placed on
  the pizza, a 4-star / 83-point score with 具材 100 / 配置 78 / 焼き 58
  sub-scores, and character dialogue -- confirming the physical drag
  placements were committed to game state, not just visually staged.
- A separate live smoke check confirmed tap fallback (click-to-select an
  ingredient chip without dragging) and keyboard fallback (focus the dough,
  press Enter, then Space) both place a piece with 0 console errors,
  exercising the same `DRAG_FROM_TRAY`/`TAP_PLACE` code path the automated
  suite covers.

## Human Feel PASS evidence

- `docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix_Result.md` (Fix 1: iOS Safari drag fix + Preview infra)
- `docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix2_Result.md` (Fix 2: fixed 3x2 palette, no tray scroll, Sauce Painting Visual/Scoring Discoverability)
- `docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix3_Result.md` (Fix 3: PREPARE one-screen layout, Sauce grid/stamp removal)
- `docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix4_Result.md` (Fix 4: Sauce paint color/opacity curve correction)

All four were carried onto PR #26's head unmodified by this integration
(pure fast-forward -- their content is byte-identical to what shipped on
`claude/sauce-visual-polish-fix4-daojxu`).

## Scope guard

Confirmed via `git diff` inspection of every changed file under
`src/state/` and `src/logic/pieceDrag.ts` for the Fix 1-4 range
(`e02425b..628201c`):

- `src/state/persistence.ts`: only change is namespacing
  `SAVE_STORAGE_KEY` under `VITE_PREVIEW_MODE` (preview vs. production save
  isolation). `CURRENT_SCHEMA_VERSION` and `PersistentSaveV1`'s shape are
  untouched -- no schema bump, no schema change.
- `src/logic/pieceDrag.ts`: only change is
  `PIECE_DRAG_THRESHOLD_PX` 6 -> 4 (grab-feedback tuning); the touch angle
  gate that protects tray horizontal scrolling is untouched.
- No occurrence of Dex/Mission/Pitz/Shop/progression/star logic changes in
  the Fix 1-4 diff (`src/state/`, `src/logic/pieceDrag.ts` grep for those
  keywords returns nothing relevant).
- `origin/main...HEAD` file list (above) contains no save-schema, legacy
  authoritative-scoring, Dex BEST, stars, Mission, Pitz, Shop, or
  progression files.
- PR #25 (HOME/PWA) and PR #21 (Sauce architecture) content already merged
  into `main` is untouched by this branch: `origin/main` is fully contained
  in the integrated branch's ancestry (its own earlier "Post-#25
  integration" merge commit already brought `main`'s tip in), and no file
  outside the Phase 4A-1B + Human Feel scope appears in the diff.

## CI status

- `build` check run on head `628201c78a6140691d132626d3c5ac7d67bd5f93`:
  **success** (completed shortly after push).

## Mergeability / changed files (post-push, GitHub API)

- `mergeable_state`: reported `unknown` immediately after push (GitHub
  still recomputing); `changed_files`/`additions`/`deletions` from the API
  reflect the stale base-sha comparison discussed above, not the true
  `origin/main...HEAD` diff.

## Unresolved review threads

- 1 review thread on PR #26 (`src/components/IngredientTray.tsx:181`,
  the P2 "abort active drag on RESET_PIZZA" finding from
  `chatgpt-codex-connector`) -- **already resolved**, with a documented fix
  (`0d8976c`) and its own regression test suite
  (`IngredientTray.physicalDragReset.test.tsx`) carried through this
  integration unchanged.
- No other open review threads found.

## Remaining risks

- GitHub's PR summary (`changed_files`/`additions`/`deletions`) may
  continue to display the stale, larger numbers until GitHub recomputes the
  diff against `main`'s current tip; this is cosmetic only -- the actual
  repository content diff is the 37-file list above; an independent
  reviewer comparing on GitHub's PR "Files changed" tab should sanity-check
  against `git diff origin/main...codex/phase-4a-1b-physical-interaction`
  directly if the file count looks larger than expected.
- `mergeable_state` was still `unknown` at the time of this report (GitHub
  had not finished recomputing after the push); this should resolve to
  `clean` shortly and does not block Independent Review, but should be
  re-checked before merge.
- Physical device (real iPhone Safari) verification was not re-run in this
  session -- browser verification here used headless Chromium at the
  390x844 viewport plus the existing recorded per-fix iPhone Human Feel
  evidence (Fix 1-4 result docs). Independent Review should confirm this
  is an acceptable substitute or request a fresh on-device pass before any
  merge decision.

## FINAL VERDICT

**READY FOR INDEPENDENT REVIEW**
