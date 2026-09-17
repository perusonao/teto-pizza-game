# Teto Pizza Game — Issue #32 Recipe Purity — Implementation Result

**Base SHA:** `679113c97daeccfa50c42d7f05425ba9048020fb` (main, Merge PR #42 — matches the task's
expected SHA exactly; confirmed via `git fetch origin && git log origin/main -1` before
branching).

**Implementation SHA:** `487f5a6d42e4acc112ea40b116649b3b5df56fd3`
(branch `claude/recipe-purity-extra-ingredients-i8cy2o`).

**PR:** [#43 — Issue #32: Scoring 2.0 Recipe purity for extra ingredient types](https://github.com/perusonao/teto-pizza-game/pull/43)

**Audit reference:** `docs/reports/TETO_ISSUE-32_RECIPE-CORRECTNESS_Fresh-Audit.md` (PR #42,
merged) — specifically §5 case G/H (extra ingredient invisible to Recipe) and §11's
next-implementation-slice recommendation.

---

## 1. Exact Recipe formula — before / after

### Before (current main, `src/logic/scoringV2/recipeComponent.ts`)

```
required = recipe.requiredIngredients (strictly validated)
requiredTypesPresent = |{ req in required : countUsedIngredient(pizza, req.ingredientId) >= 1 }|
score = (requiredTypesPresent / required.length) * 100
```

No signal at all for ingredient types the recipe didn't ask for — an extra/wrong ingredient was
completely invisible.

### After (this PR)

```
required        = recipe.requiredIngredients (strictly validated, unchanged)
requiredIds     = { req.ingredientId : req in required }
usedTypeIds     = distinct ids across pizza.sauceIds + pizza.toppings
extraTypesCount = |usedTypeIds \ requiredIds|

presenceScore    = (requiredTypesPresent / required.length) * 100        (unchanged)
purityMultiplier = usedTypeIds.size === 0 ? 1 : 1 - extraTypesCount / usedTypeIds.size
score            = presenceScore * purityMultiplier
```

`purityMultiplier` mirrors Legacy `src/logic/scoring.ts`'s existing `ingredientScore`
dilute-by-used-type-count shape (`extraCount / used.length`) rather than inventing a new one —
the Fresh Audit's §9 explicitly names a single "anything not required is impure" rule, diluted
the same way Legacy already dilutes it, as "the smaller change." Duplicate placements of the
same extra type count once (`usedTypeIds` is a `Set`) — purity is a type-correctness question,
quantity stays Pieces' concern.

`RecipeComponentV2` (types.ts) gained `usedTypesTotal`, `extraTypesCount`, `purityMultiplier`
for debuggability. `ScoringV2ShadowPanel` (Preview-only) now surfaces them as a third Recipe row
("必須 x/y", "余分な種類 n", "純度 p%").

No changes to `PiecesComponentV2`, `SauceComponentV2`, `referenceMatching.ts`, `boundary.ts`,
`tolerance.ts`, `../scoring.ts` (Legacy), or `index.ts`'s weighting (Sauce 65 / Pieces 20 /
Recipe 15 unchanged).

---

## 2. Score comparison table

Computed directly from `computeScoringV2Shadow` (Margherita: `tomato-sauce×1, mozzarella×3,
basil×2`, perfect bake) via a temporary scratch test (created, run, and deleted before commit —
never entered git history, same audit-only-artifact convention the Fresh Audit itself used).
Independently reproduced live in the Review Playthrough (§5) through actual UI interaction,
confirmed by the on-screen Scoring 2.0 Shadow panel.

| Case | Recipe (before) | Recipe (after) | Pieces | Sauce | Total (after) | Total (audit, before) |
|---|---|---|---|---|---|---|
| correct | 100.0 | 100.0 | 100.0 | 99.1 | 99.4 | 99.4 (unchanged) |
| missing required type (basil) | 66.7 | 66.7 *(unchanged — no extras)* | 50.0 | 99.1 | 84.4 | 84.4 (unchanged) |
| extra unspecified type (+ mushroom) | 100.0 | **75.0** | 100.0 | 99.1 | 95.7 | 99.4 (was identical to "correct" — the audit's case G/H) |
| wrong-type substitution (basil → mushroom) | 66.7 *(identical to "missing")* | **44.4** | 50.0 | 99.1 | 81.1 | 84.4 (was identical to "missing" — the audit's case F/E parity gap) |
| same-type overquantity (9× mozzarella) | 100.0 | 100.0 *(unchanged)* | 50.0 | 99.1 | 89.4 | 89.4 (unchanged) |
| poor placement (correct types, far off-target) | 100.0 | 100.0 *(unchanged)* | 30.0 | 99.1 | 85.4 | 85.4 (unchanged) |

**Confirmed orderings (all hold, per the task's required contract):**
- `correct (100) > extra (75)` ✅
- `correct (100) > missing (66.7)` ✅
- `correct (100) > wrong substitution (44.4)` ✅
- `wrong substitution (44.4) < missing-alone (66.7)` ✅ — closes the audit's F/E parity gap
  (previously both scored 84.4/66.7 identically; a wrong substitution now reads strictly worse
  than plain omission, matching intuition)
- same-type overquantity: **Recipe unchanged** (100 → 100) — Pieces alone reflects it (50.0)
- poor placement: **Recipe unchanged** (100 → 100) — Pieces alone reflects it (30.0)

---

## 3. Tests

9 new cases added to `src/logic/scoringV2/scoringV2.test.ts`'s
`describe("scoreRecipeComponentV2 purity (Issue #32 -- extra/wrong ingredient types)")`:

1. All required present, zero extras → unchanged 100 (regression pin)
2. Missing required type (no extras) → presence-only drop, purity untouched
3. Wrong-type substitution vs. missing-alone → strictly lower, never identical
4. Correct + one extra unspecified type → below 100, never 0 (no all-or-nothing cliff);
   Pieces/Sauce unaffected (explicit non-reaction guard via `computeScoringV2Shadow`)
5. Severe same-type overquantity (9 mozzarella vs. target 3) → Recipe exactly unchanged
6. Poor placement (correct types, far off-target) → Recipe exactly unchanged
7. Empty pizza → score 0, full purity (no extras exist to detect on nothing)
8. Duplicate extra-type placements (1 vs. 5 stray mushroom pieces) → `extraTypesCount` counts
   the type once, not per-piece; identical Recipe score either way
9. Bismarck Recipe component (pure function, no Reference fixture needed) — correct required
   types score 100, an extra unspecified type lowers it below 100; `computeScoringV2Shadow`
   confirmed still `available:false` for Bismarck (P0-1 gate untouched)

Plus the pre-existing "presence-only, no overlap with Pieces" and malformed-input describe
blocks were re-run unchanged and still pass (no fixture in either used an extra ingredient, so
none needed updating).

**Full suite:** 869/869 tests passing across 49 test files (`npm test`).

---

## 4. CI

PR #43's `build` check run: **success**
(https://github.com/perusonao/teto-pizza-game/actions/runs/35219304278/job/105195229493).

Locally, in addition to the full test suite above:
- `npx tsc -b` — clean, no errors
- `npm run lint` (`oxlint`) — clean, exit 0
- `npm run build` (`tsc -b && vite build`) — clean production build

---

## 5. Preview deployment

- **Preview repo:** `perusonao/teto-pizza-game-preview`
- **Workflow:** `deploy-from-source.yml` (`Build & deploy a source PR/branch`), dispatched with
  `ref=claude/recipe-purity-extra-ingredients-i8cy2o`, `pr_number=43`
- **Result commit:** `61c5325e40bbd0fb5967016eae45be768a3a5c46` ("Deploy preview:
  claude/recipe-purity-extra-ingredients-i8cy2o (487f5a6)") on `teto-pizza-game-preview`'s
  `main`, which auto-triggered `pages.yml` (`Deploy Preview to GitHub Pages`)
- **Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
- **Exact PR implementation SHA carried:** `487f5a6d42e4acc112ea40b116649b3b5df56fd3` (full),
  `487f5a6` (short, matches the on-screen badge and `VITE_PREVIEW_SHA`)
- **Preview badge:** `PreviewBadge.tsx` renders `PREVIEW · PR#43 · 487f5a6` (visible throughout
  the Review Playthrough video)
- **noindex:** the workflow's own `sed` step injects
  `<meta name="robots" content="noindex, nofollow" />` into `dist-preview/index.html` — confirmed
  present in the deployed `site/index.html`
- **Preview localStorage namespace:** unaffected by this PR — `VITE_PREVIEW_MODE=1` (existing
  mechanism, `src/state/persistence.ts`) keeps the preview save key separate from
  `perusonao.github.io/teto-pizza-game/`'s production save; nothing in this change touches
  persistence
- **Production Pages:** untouched — this PR contains no changes to `teto-pizza-game`'s own
  `deploy.yml`/production build, and the preview pipeline lives in a wholly separate repo

**Preview smoke — network caveat:** this session's outbound network policy denies direct HTTPS
access to `perusonao.github.io` (confirmed via the sandbox's own proxy status endpoint:
`connect_rejected`/403 for `perusonao.github.io:443`), so the live Pages URL could not be
`curl`/browser-fetched directly from this environment. As an equivalent substitute, the exact
deploy workflow steps (`vite build --base=/teto-pizza-game-preview/` with the same
`VITE_PREVIEW_MODE=1`/`VITE_PREVIEW_PR=43`/`VITE_PREVIEW_SHA=487f5a6` env vars, the same
manifest path rewrite, the same `noindex` injection) were reproduced locally from the identical
commit — the resulting `index.html` and `manifest.webmanifest` are byte-for-byte identical to
what `git show origin/main:site/...` returns from the actual deployed `teto-pizza-game-preview`
repo, and the built JS asset hash (`index-DUcYrgwZ.js`) matches exactly. The full Review
Playthrough (§6) was recorded against this byte-identical local build, served at the same
`/teto-pizza-game-preview/` base path. The real deploy's git history
(`teto-pizza-game-preview`'s `main` branch, commit `61c5325e...`) confirms the actual Pages
deployment succeeded with this exact commit and content.

---

## 6. Review Playthrough

**File:** `TETO_ISSUE-32_RECIPE-PURITY_Preview-Playthrough.mp4` (H.264, `yuv420p`, `390×844`,
25 fps, faststart) — delivered to the user directly (not committed to the repository, per
scope). Source `.webm` (VP8, same resolution/duration) also delivered.

- **Codec/resolution/duration (ffprobe-confirmed):** `h264`, `390x844`, `25/1` fps,
  `duration=57.760000` seconds
- **Viewport:** 390×844 (iPhone-class), matching the task's requirement
- **Recorded against:** the byte-identical local rebuild of the exact Preview deploy commit
  (§5's network caveat) — same `/teto-pizza-game-preview/` base path, same `VITE_PREVIEW_MODE`/
  `PR`/`SHA` env vars, so the on-screen PREVIEW badge, save namespace, and Scoring 2.0 Shadow
  panel gating are all exactly what the real Preview URL would show

**This is a real, driven playthrough, not a page-load recording** — every step below was
performed as actual pointer/click interaction against the running app (HOME → Pizza Select →
ingredient selection → tap-to-place → step confirmation → BAKE minigame → RESULT), scripted with
Playwright driving the pre-installed Chromium at the exact 390×844 viewport, with 1.5s holds on
each RESULT/diagnostics screen per the task's "重要画面は1〜3秒hold" requirement.

**Scenarios covered (each: HOME → Pizza Select → Margherita → SAUCE → CHEESE → TOPPING → BAKE →
RESULT → Legacy `ResultPanel` → Scoring 2.0 Shadow diagnostics panel, held ~3s, → register to
Dex → back to HOME):**

- **CASE A — correct:** tomato-sauce ×1, mozzarella ×3, basil ×2 (required types only)
- **CASE B — missing:** tomato-sauce ×1, mozzarella ×3, basil deliberately never placed
- **CASE C — extra:** CASE A's exact placements + one mushroom (not in Margherita's recipe)
- **CASE D — wrong substitution:** tomato-sauce ×1, mozzarella ×3, basil skipped, mushroom ×2
  placed instead

**Shadow diagnostics were available in normal Preview UI** (`ScoringV2ShadowPanel`, gated on
`VITE_PREVIEW_MODE` which this build sets) — no debug UI was added to production code, per the
task's explicit guard. The video captures this panel directly; the automation additionally
logged its exact text at each RESULT for the table below (live confirmation of §2's numbers,
not a separate estimate):

| Case | Recipe (live, on-screen) | Extra types (live) | Purity (live) |
|---|---|---|---|
| A correct | 100 | 0 | 100% |
| B missing | 67 | 0 | 100% |
| C extra | 75 | 1 | 75% |
| D wrong substitution | 44 | 1 | 67% |

These match §2's precomputed table exactly (rounding-only differences), confirming the fix
behaves identically end-to-end through real UI interaction and through direct unit-level calls.

---

## 7. Regression guards

Unchanged, confirmed by reading the diff (`git diff` on this branch touches exactly 4 files:
`recipeComponent.ts`, `types.ts`, `scoringV2.test.ts`, `ScoringV2ShadowPanel.tsx`):

- Pieces algorithm / Hungarian matching (`piecesComponent.ts`, `referenceMatching.ts`) — untouched
- PR #31 asymmetric over-quantity gate — untouched, and re-pinned by test 5 above (Recipe stays
  unchanged under severe over-quantity; Pieces alone reacts, exactly as before)
- Sauce scoring (`sauceComponent.ts`, `sauceField.ts`) — untouched
- Bake scoring — untouched, Scoring 2.0 Bake stays `available:false` this phase
- Legacy scoring (`src/logic/scoring.ts`) — untouched (out of scope per the audit's §10)
- Stars / BEST / Pitz authority — untouched; `computeScoringV2Shadow`'s only call site
  (`gameReducer.ts`'s `CONFIRM_BAKE`) and its only consumer (`ScoringV2ShadowPanel`, still gated
  on `VITE_PREVIEW_MODE`) are both unchanged
- Reference fixtures / recipe data — untouched; no new fixture added for Bismarck (test 9 above
  deliberately exercises only the pure `scoreRecipeComponentV2` function plus confirms
  `computeScoringV2Shadow` still reports Bismarck `available:false`)
- Save, Dough, Making flow, HOME, Pizza Select, Lunch Rush rules — untouched (no files under
  `src/state/persistence.ts`, `src/screens/`, `src/mission/` were modified)

---

## 8. Authority status

Scoring 2.0 Shadow remains **Shadow-only, non-authoritative** — exactly as before this PR.
`state.scoringV2Shadow` is still written by the same single `CONFIRM_BAKE` call site and read by
nothing except the Preview-gated debug panel. Dex BEST/★, Mission Score, and Pitz reward all
continue to derive from `state.score` (Legacy `ScoreBreakdown`) exclusively, which this PR does
not touch.

---

## 9. Blockers

None to shipping this slice. One environmental limitation, documented and worked around:

- This session's sandbox network policy denies direct outbound access to
  `perusonao.github.io` (see §5's "Preview smoke — network caveat"). The real Preview deploy is
  confirmed via `teto-pizza-game-preview`'s own git history (commit `61c5325e...`) and via a
  byte-identical local rebuild used for the actual Review Playthrough — functionally equivalent
  verification, but not a literal fetch of the public URL from this environment.

---

## Final Verdict

**A. PREVIEW READY — HUMAN FEEL REQUIRED**

Implementation, tests (869/869), typecheck, lint, and build are all green; the fix is minimal,
explainable, and directly closes the Fresh Audit's two named gaps (case G/H under-penalty, case
F/E parity) without touching Pieces/Sauce/Legacy/authority. PR #43 is open, CI is green, and the
Preview deploy for this exact commit succeeded. A driven 390×844 Review Playthrough exists and
was verified against real UI interaction, not just automated assertions — but per the task's own
completion rule, this does not merge without a human Human Feel pass on the actual Preview URL
(physical iPhone Safari check for how the new purity drop *feels*, per this project's established
Preview review convention).
