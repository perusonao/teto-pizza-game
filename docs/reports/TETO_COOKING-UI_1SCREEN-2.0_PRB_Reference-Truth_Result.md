# Cooking UI 1-Screen 2.0 — PR-B: Reference Truth — Result Report

Issue: [#167](https://github.com/perusonao/teto-pizza-game/issues/167)
Phase 0: [PR #168](https://github.com/perusonao/teto-pizza-game/pull/168), merged `3144b4a4cedff83d844c043316c24583f4b40363` — see
`docs/reports/TETO_COOKING-UI_1SCREEN-2.0_Phase0_Fresh-Audit.md`.
PR-A: [PR #169](https://github.com/perusonao/teto-pizza-game/pull/169), merged `ea9bb48ba4ad23dd18944df98ce9453d5b13c02b` — see
`docs/reports/TETO_COOKING-UI_1SCREEN-2.0_PRA_Result.md`.
Latest `main` SHA at Fresh Start: `0d10568175adc486deb729af5d6a8dd0a3257dc6` (PR #158, Lunch Rush HOME navigation — confirmed
via fresh `git fetch origin` at session start; branch was already exactly at this commit).
Base SHA for this PR: `0d10568175adc486deb729af5d6a8dd0a3257dc6`.
Implementation branch: `claude/cooking-ui-reference-truth-xm2dpd`.
Design Reference: `docs/design/references/cooking-ui-1screen-2.0-target.png` (structural intent only, per Phase 0's own priority order — not consulted further by this PR beyond what Phase 0 already extracted for PR-A).

## 0. Duplicate Gate #1 (pre-implementation)

Searched open Issues/PRs for: Reference Truth, ReferencePreview, PlayerReferencePreview,
ReferenceThumbnail, PizzaStage, 見本, reference, preview, Issue #167.

- No open PR implements Issue #167 PR-B scope. `closed_by_pull_requests.total_count` for #167 is 0.
- **PR #34** ("Issue #32 Phase 1: unify Reference ingredient visuals") is open but based on a
  long-stale `main` SHA (`6248108`, far behind current `main`) and scoped to Issue #32 (a
  different, already-superseded track — `docs/PROJECT_HANDOFF.md`'s own 2026-09-19 addendum
  already flags PR #34 as "stale/superseded by merged PR #45"). Not a duplicate of PR-B.
- No other PR/issue references PizzaStage/Reference rendering unification for Issue #167.

**Verdict: no duplicate. Cleared to implement.**

## 1. Root causes (renderer/data-flow map)

### Before (four independent implementations, per Phase 0 §8)

| Renderer | Sauce | Dough boundary | Piece scale | Size |
|---|---|---|---|---|
| `PizzaStage.tsx` (real play) | live heatmap (`buildSauceField`→`sauceFieldToRgbaPixels`), can overflow the guide onto the crust | player's own hand-shaped `doughShape` (8-point radial, clip-path) | native `IngredientPieceVisual`; non-cheese toppings bypassed it entirely via a hand-rolled `<span className="pizza-topping__emoji">` | 290×290 (PREPARE) / 358.8×358.8 (BAKE/CUT), height-aware `min()` |
| `ReferencePreview.tsx` (popover, Scoring-2.0-covered recipes) | **flat solid-color circle**, `transform: scale(0.55 + coverage*0.4)` — not the heatmap renderer at all | plain full circle | `IngredientPieceVisual` scaled via `--reference-piece-scale` | fixed 140×140 |
| `PlayerReferencePreview.tsx` (fallback popover) | same flat-circle pattern, ingredient color only | plain circle | `--player-reference-piece-scale` | fixed 140×140 |
| `ReferenceThumbnail.tsx` (always-visible mini icon) | **flat background-color rect**, no shape/coverage/opacity signal at all | none | `--thumb-piece-scale`; non-cheese pieces bypassed `IngredientPieceVisual` via a hand-rolled `<span className="reference-thumbnail__piece-emoji">` | 48×48 |

Root cause of "見本と、実際に作るPizzaStageが別物に見える": the sauce visual in every Reference
context was a **proxy shape** (a scaled/opacity circle standing in for "how much sauce"), never
the real painted-coverage pixels PizzaStage's own heatmap renders — so a recipe's actual sauce
distribution (evenness, rim margin, olive-oil's own oily tint) was structurally invisible in the
Reference, no matter how good the underlying data was. A secondary root cause: two of the four
renderers (`PizzaStage`'s own non-cheese branch, `ReferenceThumbnail`) didn't even route through
the shared `IngredientPieceVisual` piece renderer, and three independently-named custom
properties (`--reference-piece-scale`/`--thumb-piece-scale`/`--player-reference-piece-scale`) did
the same one job.

### After (one shared sauce renderer + one shared piece-layout algorithm)

| Renderer | Sauce | Dough boundary | Piece scale | Size |
|---|---|---|---|---|
| `PizzaStage.tsx` | `SauceHeatmapCanvas` (shared component) fed the player's own live `effectiveDeposits`/`doughShape`; PizzaStage's own overflow-marker dots layered on top, unchanged | player's own hand-shaped `doughShape` | `IngredientPieceVisual` uniformly (both branches) | unchanged (height-aware `min()`, untouched) |
| `ReferencePreview.tsx` | same `SauceHeatmapCanvas`, fed `buildIdealSauceFixture()` (deterministic) + the ideal circular `doughShape` | ideal circle at `DOUGH_RADIUS` (the same guide-ring/D1-threshold constant) | shared `--piece-scale` custom property, consumed generically by `.pizza-cheese`/`.ingredient-piece-visual__emoji` | fixed 140×140 (unchanged) |
| `PlayerReferencePreview.tsx` | same `SauceHeatmapCanvas`, same ideal fixture | same ideal circle | shared `--piece-scale` | fixed 140×140 (unchanged) |
| `ReferenceThumbnail.tsx` | same `SauceHeatmapCanvas`, same ideal fixture | same ideal circle | shared `--piece-scale` | 48×48 (unchanged) |

`renderPizzaVisualPieces` (`src/components/PizzaVisualPieces.tsx`) is the one piece-positioning
algorithm all three Reference views now call (each keeping its own existing wrapper class names
for CSS/test compatibility — see §4). `SauceHeatmapCanvas` (`src/components/SauceHeatmapCanvas.tsx`)
is the one sauce-pixel renderer PizzaStage and every Reference view now call, extracted verbatim
from PizzaStage's own pre-existing `buildSauceField`→`smoothSauceFieldForDisplay`→
`sauceFieldToRgbaPixels` pipeline (`src/logic/sauceField.ts`, itself completely unchanged).

## 2. Authoritative reference data source

`src/data/referencePizza.ts`'s `getReferencePizza(recipeId)` is the sole authority for
sauce/piece-group data, unchanged by this PR. **Finding (not previously documented):** all 15
currently shipped recipes now have a `getReferencePizza` fixture (B2's original 7/7 plus the
Recipe Expansion batches' own additions) — `getPlayerReferencePizza`/`PlayerReferencePreview`
(the Margherita-only-era fallback, Issue #47 Slice B) is therefore **unreachable in production
today**, kept only as an explicit defensive path for a future recipe shipped without a fixture
(and fully exercised by its own tests). No scope-guarded data changed: `getReferencePizza`,
`getPlayerReferencePizza`, `SAUCE_TARGET_RADIUS`, `DOUGH_RADIUS`, and every Scoring 2.0 file are
untouched (diff-verified — see §8 Scope Guard).

The deterministic sauce fixture every Reference view now renders (`buildIdealSauceFixture()`) is
not new data: it is the exact same fixture `computeMechanicalSauceReference` already used to
derive every recipe's `reference.sauce.quantity`/`.coverage` numbers (the popover's own bars).
Rendering it as real pixels instead of reading only its two aggregate numbers is therefore a
strictly more faithful presentation of the same authoritative data, never a fabricated addition.

## 3. Current-step vs finished-reference decision

**Unchanged from the existing (pre-PR-B) design, confirmed correct on inspection, not reopened by
this PR:** the compact thumbnail and modal both already show the recipe's one finished/target
composition (`pieceGroups` = the complete target layout, not a per-step subset), and the current
step is communicated separately by `.order-card__hint`/`state.hint` and `MakingStepTabs`'s own
current-step highlighting (Issue #86 UX-2). No "この工程でここまで作れ" ambiguity was found in the
existing copy (`見本` button label, `${recipe.nameJa} 見本` dialog title) — it already reads as an
identity/target label, not a step-progress claim. No copy change was needed or made.

## 4. Boundary/guide decision

**No dashed guide ring was added to the Reference views, and none was removed.** The Reference's
own outer circle (`.reference-mini-pizza`/`.reference-thumbnail`/`.player-reference-mini-pizza`,
`border-radius: 50%`) already *is* a truthful boundary: it represents the ideal, fully-round
target dough size (`DOUGH_RADIUS`) — the same value the DOUGH step's own dashed guide ring and
`DOUGH_COMPLETION_THRESHOLD` are measured against — which is by construction a perfect circle, so
a plain circular div and a `doughShape`-clipped organic boundary are visually identical for this
one shape. Adding a redundant `<clipPath>`/`.pizza-dough-shape` layer here would have been
unnecessary machinery, not a truthfulness improvement (§7's own instruction: "if it has no actual
gameplay/scoring meaning, remove it" — the converse applies equally: don't add machinery a plain
circle already renders correctly). `ReferencePreview`'s existing `SAUCE_TARGET_RADIUS` dashed
target-area ring (`.reference-mini-pizza__target-guide`) is unchanged — it already shared the
correct constant.

**Known, deliberately out-of-scope asymmetry:** the *player's own* dough in `PizzaStage` can be
organically hand-stretched (D3A) and is not always a perfect circle by the time SAUCE/CHEESE/
TOPPING happens — the Reference showing a perfect circle is the *target*, not a claim that the
player's dough already looks like it. This is correct, expected behavior (a target vs. current-
state distinction), not a new inconsistency introduced by this PR.

## 5. Sauce rendering decision

Reference sauce coverage is now rendered via the exact same `buildSauceField`→
`smoothSauceFieldForDisplay`→`sauceFieldToRgbaPixels` pipeline PizzaStage's own live gesture uses
(`SauceHeatmapCanvas`, §1), fed `buildIdealSauceFixture()` — a fixed, literally-paintable
deposit sequence (concentric rings, rim margin left bare) that is already deterministic by
construction (no `Math.random`, no per-render variance): opening the same recipe's Reference
twice, or on two different devices, renders byte-identical pixels every time. Olive-oil recipes
(quattro-formaggi, fugazza, pizza-bianca) additionally get the same `pizza-sauce-heatmap--oil`
filter class PizzaStage's own heatmap applies for the same ingredient, so the same
Issue #159 P1 "olive oil is hard to see against the dough" fix now also applies to the Reference,
not just live play (previously the Reference's flat ingredient-color circle had no equivalent
treatment at all).

## 6. Ingredient count/position semantics

Unchanged. Every position/count already came from `getReferencePizza`/`getPlayerReferencePizza`'s
own `pieceGroups` (Issue #159 P0's own SSOT fix, re-confirmed still holding — see the e2e SSOT
parity test, §9). This PR's own `ReferenceTruth.test.tsx` (§9) adds an explicit assertion that the
mini thumbnail and the full popover render from the *literal same* `pieceGroups` array for all 15
recipes, not just Margherita, and that per-ingredient counts/identities (cheese shape vs. matching
emoji) are correct for Margherita, Salsiccia, Quattro Formaggi (topping-heavy, 4 groups/8 pieces),
and Napoletana.

## 7. Shared renderer architecture

- **`src/components/SauceHeatmapCanvas.tsx`** (new): the one sauce-field-to-pixels renderer.
  Takes `deposits`/`doughShape`/`color`/`className`; renders a `<canvas>` and runs the exact
  pixel pipeline extracted from PizzaStage's own pre-existing effect. PizzaStage's own overflow-
  marker dots (an interactive, in-progress-painting-mistake signal with no meaning for a static,
  correct-by-construction target) stay in PizzaStage, in their own overlaid canvas, unchanged in
  behavior.
- **`src/components/PizzaVisualPieces.tsx`** (new): `renderPizzaVisualPieces` (the one
  position/rotate/`IngredientPieceVisual` piece-layout loop, replacing three near-duplicate
  `.flatMap` implementations) and `buildPieceCountLabels` (the "モッツァレラ3個とバジル2個"
  caption-text builder, previously duplicated verbatim in `ReferencePreview.tsx`/
  `PlayerReferencePreview.tsx`).
- **`src/logic/doughShape.ts`**: `createIdealDoughShape()` — a uniform `DOUGH_RADIUS` circle,
  the one ideal-dough-shape constructor every Reference view uses (§4).
- **`PizzaStage.tsx`**: its own topping loop now always calls `IngredientPieceVisual` (both
  cheese and emoji branches), matching every Reference view — the old `.pizza-topping__emoji`
  hand-rolled span is gone, replaced by the shared `.ingredient-piece-visual__emoji` class (its
  own font-size/drop-shadow rule now lives in one place, App.css, driven by the shared
  `--piece-scale` custom property, default `1` for PizzaStage's own full-size pieces).
- **Interaction stays exclusively in PizzaStage**: `SauceHeatmapCanvas`/`renderPizzaVisualPieces`
  are pure, non-interactive rendering; no pointer/gesture handler was added to any Reference view,
  and no Reference view gained `tabIndex`/`role="button"`/pointer event props. The Reference
  remains a static illustration behind a full-screen tap-absorbing backdrop, unchanged.

CSS consolidation (`src/App.css`): `--reference-piece-scale`/`--thumb-piece-scale`/
`--player-reference-piece-scale` (three custom properties, one job) are now one `--piece-scale`,
consumed generically by `.pizza-cheese`/`.pizza-cheese--parmigiano`/`.ingredient-piece-visual__emoji`
(composed with PizzaStage's own `--bake-melt-scale`, so neither Reference nor PizzaStage's bake
visuals lost anything). `.reference-mini-pizza__sauce`/`.reference-thumbnail__base`/
`.player-reference-mini-pizza__sauce` are now `<canvas>`-hosting position/size rules (background/
opacity removed, since a canvas draws its own pixels) instead of flat-color div rules.
`.reference-thumbnail`'s border color is now `#c99b56`, matching `.pizza-dough`/
`.reference-mini-pizza`/`.player-reference-mini-pizza` exactly (was `#d9b876`, a small,
independent inconsistency unrelated to piece/sauce data, fixed alongside the main issue for full
visual parity). The dead `.pizza-topping__emoji`/`.reference-thumbnail__piece-emoji` rules were
removed (superseded by the generic `.ingredient-piece-visual__emoji` rule).

## 8. Scope Guard (confirmed unchanged, diff-verified)

No changes to: `src/logic/scoring*`, `src/logic/scoringV2/**`, `src/data/referencePizza.ts`'s own
data values (`sauce`/`pieceGroups` per recipe — only *rendering* of the same values changed),
`src/data/playerReference.ts`'s generation algorithm, economy/Pitz, inventory/Stock Gate
semantics, Firebase/Cloud Functions/Firestore, ranking, Player Profile, recipe unlock
(`src/state/progression.ts`), Lunch Rush scoring, CUT scoring (`src/logic/cut/**`), or any
recipe's `requiredIngredients`. `getReferencePizza`/`getPlayerReferencePizza`/`SAUCE_TARGET_RADIUS`/
`DOUGH_RADIUS` are read-only inputs to this PR's new shared renderers, never written to.

**No scoring/reference discrepancy was found** during this audit that would need documenting per
the task's own "document, don't silently expand scope" instruction — every recipe's `pieceGroups`/
`sauce` target was already reachable-by-construction (referencePizza.ts's own header comment,
re-verified) and is now simply drawn more faithfully, not recomputed.

## 9. Tests

New: `src/components/ReferenceTruth.test.tsx` (54 tests) —

1. Every recipe's `getReferencePizza` (where present) is self-consistent (`recipeId` matches,
   `pieceGroups` non-empty) — no separate hard-coded list exists anywhere else.
2. `ReferenceThumbnail`'s rendered piece count matches `pieceGroups`'s own expected count for all
   15 recipes (SSOT, not two independent recomputations).
3. For every recipe with a fixture: the sauce heatmap (`SauceHeatmapCanvas`, mocked to capture
   props without a real `<canvas>` 2D context) receives the recipe's own authoritative
   `sauce.ingredientId`'s color, the same deterministic fixture deposit count as every other
   recipe, and the correct olive-oil filter class exactly for olive-oil recipes — both from the
   thumbnail and from the full modal, proving they share one fixture/color, not two.
4. The ideal Reference dough shape is a uniform circle (`Set(radii).size === 1`).
5. Ingredient identity/count for Margherita, Salsiccia, Quattro Formaggi (topping-heavy: 4
   groups/8 pieces, exact total asserted), Napoletana — cheese pieces render `.pizza-cheese--<id>`,
   non-cheese pieces render the exact matching emoji glyph.
6. **Every one of the 15 shipped recipes** renders `ReferenceThumbnail` +
   (`ReferencePreview` or `PlayerReferencePreview`, whichever applies) with no thrown error.
7. Opening/closing the popover leaves no stale dialog/sauce-probe in the DOM (unit-level; see also
   the e2e no-stale-overlay checks in Video C, §11).

Existing tests re-run, all still passing unmodified (no test file needed a behavior-changing
edit): `PizzaStage.sauceParity.test.tsx` (heatmap/flat-layer class assertions, oil class),
`PizzaStage.bakeVisual.test.tsx` (`.pizza-dough-shape`/`.pizza-cheese` bake-continuity), both
`ReferencePreview.test.tsx`/`PlayerReferencePreview.test.tsx` (piece count/coordinates/shared
`.pizza-cheese` visual), `IngredientPieceVisual.test.tsx`, `PizzaThumbnail.test.tsx` (the separate,
untouched Pizza Select card thumbnail), and the full `e2e/making-ui-1screen.spec.ts`/
`e2e/viewport-1screen.spec.ts` suite (§10) — including the pre-existing "Reference
thumbnail/popover SSOT parity" and the 390×650 `.pizza-topping--mozzarella` count=1 regression,
both of which would have broken had `.pizza-topping`/`.pizza-dough` been reused as literal
Reference class names instead of the dedicated `.reference-mini-pizza__topping`/
`.reference-thumbnail__piece`/`.pizza-visual-dough`-free design this PR settled on (see the
implementation notes below for why that specific naming choice was deliberate).

| Check | Result |
|---|---|
| Focused (`ReferenceTruth.test.tsx`) | **54/54 passed** |
| Full Vitest (`npm test` / `vitest run`) | **2146/2146 passed** (113 files; 54 new) |
| TypeScript (`tsc -b`) | clean |
| `npm run lint` (oxlint) | clean |
| `npm run build` | clean (pre-existing >500 kB chunk-size warning, unrelated) |
| Playwright Chromium, both projects (390×844/360×800) | **40/40 passed** |
| Playwright WebKit | **Blocked by network egress policy** — see §10 |

## 10. Chromium / WebKit status

Chromium: full suite (`iphone-390x844`/`iphone-360x800` projects), 40/40 passed, including the
Reference SSOT parity test and the 390×650 short-viewport `.pizza-topping--mozzarella` count
regression (§9) — both of which are exactly the tests that would have caught a careless literal
class-name merge between PizzaStage's real pizza and the Reference views.

WebKit: install attempted (`npx playwright install webkit`), confirmed blocked by this session's
own egress policy — identical failure to PR-A's own documented attempt:

```
Error: Download failed: server returned code 403 body 'request blocked: no rule or allowlist
entry allows host "playwright.download.prss.microsoft.com"'
Error: Download failed: server returned code 403 body 'request blocked: no rule or allowlist
entry allows host "cdn.playwright.dev"'
```

Not retried further or worked around, per the same policy PR-A's own Result Report documented.
**Not reported as PASS.** The two `webkit-390x844`/`webkit-360x800` projects PR-A already added to
`playwright.config.ts` need no further change to cover this PR's own DOM/CSS once WebKit is
reachable in some future environment (this PR added no new Playwright projects).

## 11. Screenshots

`docs/reports/screenshots/cooking-ui-reference-truth-pr-b/` (committed):

- `margherita_01_reference-thumbnail.png` / `_02_reference-modal.png` / `_03_pizzastage.png` /
  `_04_result.png`
- `salsiccia_01_reference-thumbnail.png` / `_02_reference-modal.png` / `_03_pizzastage.png` /
  `_04_result.png`
- `quattro-formaggi_01_reference-thumbnail.png` / `_02_reference-modal.png` /
  `_03_pizzastage.png` / `_04_result.png` (topping-heavy + olive-oil sauce)

All at 390×844. Each recipe's `_02`/`_03` pair is the direct visual-truth comparison this PR
exists to fix — the modal's sauce patch and the real stage's sauce patch are now the same painted
texture/color (including the olive-oil oily tint for quattro-formaggi), and piece
identity/count/relative position match exactly.

## 12. Human Verification Videos

Recorded via Playwright's `recordVideo` (WebM/VP8), converted to MP4/H.264 with a full
`apt`-installed `ffmpeg`/`libx264` (the pre-installed Playwright-bundled `ffmpeg` only supports
WebM/VP8 muxing, no H.264 encoder — same class of constraint PR-A's own Result Report
documented for a different tool). Verified via `ffprobe` (codec/resolution/duration/size) and
direct frame-extraction visual inspection (3 sample frames per video reviewed).

| Video | Viewport | Duration | Resolution | Codec | Size | Scenario |
|---|---|---:|---|---|---:|---|
| A | 390×844 | 28.28s | 390×844 | H.264 | 658 KB | HOME → Pizza Select → Margherita → PREPARE (thumbnail visible) → open Reference modal (held 3s) → close → DOUGH stretch → SAUCE paint → CHEESE/TOPPING placement → re-open Reference mid-PREPARE for a direct comparison beat → BAKE → 取り出す → CUT (3 lines) → 切り終わる → completed pizza held 3s. |
| B | 390×844 | 23.68s | 390×844 | H.264 | 527 KB | Salsiccia (the recipe explicitly flagged as diverging) → thumbnail → Reference modal held 3.5s (ingredient identity/count/scale/sauce all readable) → close → place the recipe's own ingredients (mozzarella ×2, sausage ×3) → BAKE → CUT → completed visual held 3s. |
| C | 360×800 | 10.92s | 360×800 | H.264 | 216 KB | Quattro Formaggi (topping-heavy, olive-oil sauce) at the secondary viewport → thumbnail/all-6-tabs/CTA held 1.8s → Reference modal held 3s (readable, no clipping) → close → Cooking UI back to its stable 1-screen state, held 1.5s. |

**Video Verification: PASS** for all three — `ffprobe` confirms `h264`/correct
resolution/duration/nonzero size (table above); frame extraction confirms real, non-corrupted app
content matching each scenario (Reference modal showing the real painted heatmap + correctly-
scaled/identified pieces; the actual PizzaStage/BAKE/completed pizza visually matching it; Video
C's own programmatic checks — `document.documentElement.scrollWidth === innerWidth` and
`.game-screen`'s `scrollHeight === clientHeight` both before opening and after closing the
Reference modal, plus `0` stale `.reference-preview__backdrop` elements after close — logged
alongside the recording, not just eyeballed from frames).

Download: delivered directly to the user this session (file-transfer attachments), per
`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §6 — never committed to the repository.

What to look for in these videos: whether the Reference modal's sauce patch and piece
identity/count/scale genuinely look like "the same pizza" as the PizzaStage/completed pizza shown
moments later in the same video, for both a Scoring-2.0-covered recipe (Margherita) and the
specifically-flagged Salsiccia, and whether the topping-heavy Quattro Formaggi Reference still
fits cleanly at the secondary 360×800 viewport with no layout regression from PR-A.

## 13. PR-A preservation

Confirmed unchanged (diff-verified — no `GameScreen.tsx` layout/CSS-selector edits outside the
`.reference-*`/`.player-reference-*`/`.pizza-topping__emoji`/`.pizza-cheese`/
`.ingredient-piece-visual__emoji` rules this PR touches):

- 6 tabs visible: unaffected — `MakingStepTabs.tsx` untouched.
- Horizontal overflow = 0 / vertical 1-screen: unaffected — verified live in Video C's own
  programmatic checks (§12) at the secondary 360×800 viewport with a topping-heavy recipe, the
  exact class of case PR-A's own margin budget was tuned against.
- PizzaStage height-aware sizing: unaffected — `.pizza-stage--roomy`/`--compact`/`.pizza-dough`
  sizing rules untouched; `SauceHeatmapCanvas`'s own canvas keeps the exact `pizza-sauce-heatmap`
  class/positioning PizzaStage's heatmap already used.
- Short-height (390×650) regression: covered by the full Chromium Playwright run (§10), including
  the exact `.pizza-topping--mozzarella` count=1 assertion at that viewport — 40/40 passed.
- Compact Ingredient UI / Bottom CTA / CUT progress copy: untouched, not in this PR's file set.

Reference modal open/close leaving the Cooking UI in its exact stable 1-screen state after
closing: confirmed in Video C (§12) both visually and via the programmatic before/after checks.

## 14. Changed files

```
 src/App.css                               | 111 ++++++++++++++-------------
 src/components/PizzaStage.tsx             | 121 +++++++++++-------------------
 src/components/PlayerReferencePreview.tsx |  60 ++++++++-------
 src/components/ReferencePreview.tsx       |  63 ++++++++--------
 src/components/ReferenceThumbnail.tsx     |  71 +++++++-----------
 src/logic/doughShape.ts                   |  11 +++
 src/components/SauceHeatmapCanvas.tsx     (new, 97 lines)
 src/components/PizzaVisualPieces.tsx      (new, 71 lines)
 src/components/ReferenceTruth.test.tsx    (new, 214 lines)
 docs/reports/screenshots/cooking-ui-reference-truth-pr-b/*.png (12 files, new)
 docs/reports/TETO_COOKING-UI_1SCREEN-2.0_PRB_Reference-Truth_Result.md (this file, new)
```

No changes to `.github/workflows/*`, `playwright.config.ts`, `src/logic/scoring*`, economy,
Firebase, ranking, Player Profile, recipe unlock, or CUT scoring.

## 15. Known limitations

- **WebKit could not be run** in this session (network egress policy, §10) — same, unresolved
  environment-level constraint PR-A's own Result Report documented; no new code gap.
- **PizzaStage's own topping "land" animations (`mozzarella-land`/`basil-land` keyframes) do not
  rotate the piece to its final `stablePieceRotation` value** (only `basil-land`'s own keyframes
  ever did), while every Reference view's own (unanimated) pieces do apply that rotation — a
  small, pre-existing asymmetry this PR did not touch, since fixing it would mean editing
  PizzaStage's already-tuned Human Feel landing animations, out of this PR's own scope (Reference
  vs. PizzaStage sauce/piece-scale/dough-boundary consistency, not animation parity). Documented
  here rather than silently left undiscovered.
- **The sauce heatmap canvas's own `blur(3px)` CSS filter (`.pizza-sauce-heatmap`, unchanged) is
  proportionally more visible at the 48px thumbnail size than at PizzaStage's own 290–380px
  dough** — a minor softness at the smallest size, not a correctness issue (the underlying pixel
  data and color are identical); left as-is rather than forking a size-specific blur value, to
  keep exactly one shared rendering path. Visible on close inspection of the thumbnail
  screenshots (§11); not something a player is likely to be evaluating the 見本 against at that
  size in practice (the modal, not the mini icon, is where a player actually compares detail).
- `PlayerReferencePreview`/`getPlayerReferencePizza` remain unreachable in production today (§2) —
  correctly still fully tested, not deleted, per the task's own "defensive path" reasoning.

## 16. PR-C handoff

Unchanged from PR-A's own handoff (`docs/reports/TETO_COOKING-UI_1SCREEN-2.0_PRA_Result.md` §12):
actually run the two `webkit-390x844`/`webkit-360x800` Playwright projects once this session's
network egress policy (or a future session's) allows `cdn.playwright.dev`/
`playwright.download.prss.microsoft.com`, or a pre-provisioned WebKit binary becomes available.
No PR-B-specific verification gap is being handed off — every DOM/CSS surface this PR touches
(`.reference-mini-pizza__sauce`/`.reference-thumbnail__base`/`.player-reference-mini-pizza__sauce`
canvases, the shared `--piece-scale` variable, `SauceHeatmapCanvas`) is already covered by the
existing 390×844/360×800 Chromium projects and this PR's own new unit tests.
