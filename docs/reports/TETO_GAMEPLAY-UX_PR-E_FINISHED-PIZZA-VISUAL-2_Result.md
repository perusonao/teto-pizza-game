# Gameplay UX PR-E: Finished Pizza Visual 2.0 — Result Report

Status: **Implementation complete, PR open, NOT merged.** Per the task's own instruction, this
PR intentionally stops here for an independent Fresh Merge Gate review of the exact PR HEAD.

## Child Issue / Umbrella

- Child Issue: [#186](https://github.com/perusonao/teto-pizza-game/issues/186) — "Gameplay UX
  PR-E: Finished Pizza Visual 2.0"
- Umbrella: [#176](https://github.com/perusonao/teto-pizza-game/issues/176) — Gameplay UX /
  Scoring 3.0

## PR / SHAs

- Branch: `claude/finished-pizza-visual-2-hms1o6`
- Base SHA (`origin/main` at Fresh Start, re-confirmed at Duplicate Gate #2): `89896e52ba0da7851155b85ef892113693936e59`
  (PR #185, "Gameplay UX PR-C: Timing Transparency", merged)
- This report is written against the exact working-tree diff on that branch; the PR's exact HEAD
  commit SHA is recorded in the PR body/GitHub UI once pushed.

## PR #183 parallel-work status

PR #183 ("Progression 2.0 Phase 0: Fresh Audit / Full-Catalog Foundation", Issue #182) was open
throughout this session — re-confirmed via `pull_request_read` at task start: `state: open`,
`draft: false`, base `70d85b4034f3b69f8902cce5e2cf319e9bca274d` (an older `main`, before PR #185
merged), head `1a0fb3226bd93c73e18a0f804d97f998ebd35946`, **docs/data/tooling-only**
(`docs/reports/**`, `docs/design/**`, `tools/*.py` — zero `src/**` files in its 15 changed files).
This PR's own diff touches only `src/logic/bakeVisual.ts`, `src/components/PizzaStage.tsx`,
`src/components/IngredientPieceVisual.tsx`, `src/data/ingredients.ts`, `src/App.tsx`,
`src/App.css`, plus their tests and one new E2E spec — **zero file overlap** with PR #183's own
change set. No conflict possible; re-verified at Duplicate Gate #2 (below) that PR #183 was still
open and still docs-only.

## Duplicate Gate #1 (task start)

Searched open issues/PRs for: Finished Pizza Visual, Finished Pizza, Bake Visual, baked toppings,
browning, 焼き上がり, 焼き色, チーズ, toppings visual, PizzaStage visual. One hit: **Issue #37**
("Making Game 2.0: physical pizza-making flow") — open, but scoped to shaping/placement/bake-
judgment/result-identity mechanics broadly, never mentions finished-pizza browning/topping visual
specifically. **Not a duplicate.** No open PR matched any of the search terms at all. Proceeded to
open child Issue #186.

## Duplicate Gate #2 (immediately before push)

Re-ran `git fetch origin` and re-checked PR #183/open issues/PRs immediately before finalizing.
`origin/main` unchanged at `89896e5`. PR #183 still open, still docs/data/tooling-only (no new
commits touching `src/**`). No new issue/PR opened in the interim that overlaps this scope. Safe
to push without any base-merge or overlap resolution.

## Fresh Visual Audit (findings)

Read `CLAUDE.md`, `docs/PROJECT_HANDOFF.md`, the Fresh Audit's own §7 ("Audit E — Finished Pizza
Visual 2.0"), the PR-C/PR-D Result Reports, and `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`
in full, then read the live `main`-tip source directly (not trusting the prior audit's own
findings without re-verification, per the task's own instruction):

- **Crust**: `src/logic/bakeVisual.ts`'s `computeBakeHeat`/`doughVisualColors` already drive a
  continuous (no snap-at-scoring-boundary), explicit, well-documented crust color gradient —
  raw/pale → golden → darker overbaked. Already deliberate, not accidental. **Left unchanged**
  (not flagged as broken by the Fresh Audit or this session's own re-verification; the task's own
  §8 only asked to "consider" strengthening it, gated on it actually being needed).
- **Cheese**: `cheeseVisualFrame` (5-keyframe melt/spread/toast/char curve) already continuous and
  deliberate, driving both `--bake-melt-scale` (spread) and a `filter` (brightness/saturate/sepia)
  on the dedicated `.pizza-cheese` shape. **Left unchanged** (kept intact per the task's own
  instruction not to break the existing good cheese behavior).
- **Toppings — the real bug, re-confirmed on live code, not just the prior audit's word**:
  `PizzaStage.tsx` computed one `cheeseStyle` object from `cheeseVisualFrame(bakeHeat)` and passed
  it as the `style` prop to **every** topping's `<IngredientPieceVisual>`, cheese or not. The
  emoji branch of `IngredientPieceVisual` (`src/components/IngredientPieceVisual.tsx`) applies
  `style` verbatim to the rendered `<span>` — the old inline comment's claim that this was "a
  no-op for the emoji branch" was **false**: a CSS `filter` set inline on an element is never a
  no-op, and it **silently replaced** that element's own baseline `filter: drop-shadow(...)` (set
  in `App.css`'s `.ingredient-piece-visual__emoji` rule) instead of composing with it. A *second*,
  separate mechanism (`App.css`'s `.pizza-dough--raw/--perfect/--burnt .pizza-topping` compound
  selectors) applied a discrete 3-bucket filter on the wrapper element at the same time, snapped
  exactly at the `classifyBake` scoring boundary — the same class of "answer reveal" bug the M3A
  Bake Judgment work had already eliminated for every *other* bake visual in this codebase, just
  never applied here. Net effect confirmed by direct code read: non-cheese toppings roasted along
  a curve tuned for cheese's own melt/spread/char (wrong shape for a flat emoji glyph), stacked
  with a second, discrete, snapping filter, and lost their own drop-shadow — exactly as the Fresh
  Audit's own §7 predicted, now confirmed on the current `main` tip rather than taken on faith.
- **RESULT continuity gap found during this session's own audit (not in the prior written
  audit)**: `App.tsx`'s `bakeProgress` derivation only read `state.pizza.bakeResult` for
  `RESULT`/`DISCOVERED` phases, leaving `POST_BAKE` (the CUT step, between BAKE and RESULT) at
  `null` — the same value PREPARE uses for "no bake styling at all." This meant the finished
  pizza's crust/cheese/topping bake tint visibly **reverted to raw** the instant BAKE ended, then
  reappeared at RESULT — a real violation of the task's own §11 continuity requirement, on every
  CUT-eligible recipe, pre-existing and not specific to the topping bug. Fixed (see below).

## New explicit visual model

- **`toppingVisualFrame(heat, roastResistant)`** (new, `src/logic/bakeVisual.ts`): a dedicated,
  continuous, non-cheese-topping roast curve — no scale/spread (toppings stay flat glyphs, matching
  the audit's own note that they never change shape), ramping later and capping lower than
  cheese's own curve so a topping visibly roasts without becoming a cheese-brown lump. A second,
  far gentler `HERB_FRAMES` curve is selected via a new `Ingredient.bakeRoastResistant` data field
  (`src/data/ingredients.ts`), set `true` for `basil`/`oregano`/`rosemary` (the shipped green
  herbs) — reused as-is by every recipe that places them, no recipe-ID branching.
- **`PizzaStage.tsx`**: `cheeseStyle` (unchanged, cheese-only) now only applies to
  `ingredient.category === "cheese"`; every other ingredient gets a new `toppingPieceStyle(ingredient)`
  that reads `toppingVisualFrame` and explicitly re-composes the emoji's own baseline
  `drop-shadow(...)` into the same `filter` value (a CSS `filter` is not additive across a class +
  inline style on one element — this is exactly the value the old code silently dropped).
- **`App.css`**: removed the old discrete `.pizza-dough--raw/--perfect/--burnt .pizza-topping`
  compound-selector filter (the second, snapping mechanism) — one deliberate, continuous,
  per-ingredient curve now replaces both prior mechanisms. Moved the `filter` `transition` from
  the now-inert `.pizza-topping` wrapper to `.ingredient-piece-visual__emoji`, the element whose
  `filter` actually changes.
- **`App.tsx`**: `bakeProgress` now also reads `state.pizza.bakeResult` during `POST_BAKE`, closing
  the BAKE→CUT→RESULT continuity gap found above. Pure visual-derivation change — `bakeResult`
  itself, `bakeTarget`, and every scoring path are untouched.

## Crust / cheese / topping / herb behavior (final)

| Element | Curve | Notes |
|---|---|---|
| Crust | `doughVisualColors(bakeHeat)` | Unchanged — already continuous/explicit |
| Cheese | `cheeseVisualFrame(bakeHeat)` | Unchanged — melt/spread/toast/char, own curve |
| Topping (default) | `toppingVisualFrame(bakeHeat, false)` | New, gentler than cheese, no spread, own drop-shadow preserved |
| Herb (basil/oregano/rosemary) | `toppingVisualFrame(bakeHeat, true)` | New, far gentler still — stays visibly green even at deep overbake |

## Ideal vs. overbaked

Confirmed both via unit tests (`toppingVisualFrame`'s own monotonic-roast tests) and real-browser
Human Verification (Video C / screenshot C): at the recipe's own target center (heat 1, "ideal"),
a normal topping is unchanged from raw; well past the target (heat ≈1.63, still inside the
Completion Gate's own servable margin), it's visibly darker/more sepia. The **before/after
screenshot pair `C-overbaked-before.png` / `C-overbaked-after.png` is the clearest single piece of
evidence for this whole PR**: on unmodified `main`, an overbaked Margherita's basil is fully
browned into the same dark tone as the crust/cheese — completely unidentifiable, exactly the
failure mode the task's own brief explicitly prohibited ("basil等の緑色具材が全部茶色になって識別
不能になるのは禁止"). On this PR's branch, the same overbaked round's basil stays clearly green.

## BAKE → RESULT continuity

Fixed at the root (`App.tsx`'s `bakeProgress`, above) rather than papered over per-visual. E2E
Scenario A/C both assert the topping filter read at RESULT is byte-identical to the one read at
the end of BAKE for the same round.

## CUT visibility

`.pizza-cut-line`/`.pizza-cut-layer` are a separate SVG overlay, untouched by this PR. Re-verified
(unit + E2E) that CUT lines remain visible against both an ideal and a fully overbaked (dark)
crust — confirmed visually in Video C / screenshot `C-overbaked-after.png` (3 black cut lines
clearly readable against the dark crust).

## RESULT 1-Screen (PR #181) regression

No regression. `git diff --stat` confirms zero changes to `ResultPanel.tsx`,
`.result-panel__actions`, or any layout-affecting CSS. E2E Scenario A/D assert `.result-panel__actions`
visibility and the primary CTA, at both 390×844 and 360×800, alongside the new topping-visual
assertions.

## Timing Transparency (PR #185) regression

No regression. `.cooking-timing-summary` presence asserted in the same E2E scenarios that assert
the new visual contract — no changes to `cookingTimingDisplay.ts`/`ResultPanel.tsx`'s timing
section.

## Dynamic Steps (PR #179) regression

No regression. `getCookingProfile`/`cookingProfiles.ts` untouched. New unit tests explicitly cover
a no-cheese-recipe fixture (marinara-shaped: only non-cheese toppings) and a no-topping-recipe
fixture (quattro-formaggi-shaped: cheese only) rendering correctly under the new model.

## Lunch Rush regression

No regression. `MissionHud`/`MissionServePanel`/mission scoring untouched. E2E Scenario E plays a
full Lunch Rush Margherita round and asserts `.mission-hud__timer` visible throughout,
`.mission-serve-panel--failed` count 0, and the new topping filter present during BAKE.

## Scope guard

Zero changes to: `score.total`, ★ thresholds, bake scoring, CUT score/weights, efficiency
formula, Pitz formula, Lunch Rush scoring, leaderboard, Firebase/Firestore/Cloud Functions,
progression, recipe unlock, catalog, inventory/economy, `recipe.bakeTarget`, bake guide fade
timing/needle speed/target range. Confirmed via `git diff --stat` — no file under `src/logic/scoringV2/**`,
`src/logic/cut/**`, `src/logic/pitzReward.ts`, `src/logic/efficiency.ts`, `src/logic/bakeGuideFade.ts`,
`src/state/progression.ts`, `src/logic/economy.ts`, `src/firebase/**`, or `src/data/recipes.ts`
changed.

## Before/After evidence

Committed under `docs/reports/screenshots/gameplay-ux-finished-pizza-visual-2/` (same recipe, same
viewport, same doneness both times — before = unmodified `origin/main`/89896e5 via `git stash`,
after = this PR's branch, same session, same gestures):

| File | What it shows |
|---|---|
| `A-margherita-before.png` / `A-margherita-after.png` | Margherita IDEAL RESULT, 390×844 — subtle at this small thumbnail size, basil roast curve intentionally gentle at heat≈1 |
| `B-heavy-before.png` / `B-heavy-after.png` | Capricciosa (mushroom/oregano/ham/black-olive) IDEAL RESULT, 390×844 |
| `C-overbaked-before.png` / `C-overbaked-after.png` | Margherita OVERBAKED RESULT, 390×844 — **the clearest evidence**: basil fully browned/unidentifiable on `main`, stays green on this PR |
| `D-result-390x844.png` | This PR's Capricciosa IDEAL RESULT, 390×844 |
| `E-result-360x800.png` | This PR's Capricciosa IDEAL RESULT, 360×800 — no clipping, CTA reachable |

## Tests

- Focused: `bakeVisual.test.ts` (+15 new: `toppingVisualFrame` contract), `PizzaStage.bakeVisual.test.tsx`
  (+8 new: pre-bake/ideal/overbaked topping filter, cheese-vs-topping curve distinction,
  no-cheese/no-topping recipe fixtures, RESULT continuity, CUT overlay presence).
- Full Vitest: **2324/2324 pass** (118 files; 14 more than the pre-PR baseline of 2310, all new).
- TypeScript (`tsc --noEmit -p .`): clean.
- Lint (`oxlint`): clean.
- Build (`tsc -b && vite build`): clean.

## Chromium E2E

New dedicated spec `e2e/finished-pizza-visual-2.0.spec.ts`, Scenario A–E per the task's own
lettering, **10/10 pass** (5 scenarios × 2 viewports, `iphone-390x844`/`iphone-360x800`). Full
existing Chromium E2E suite (all specs, both viewports): **102/102 pass**, zero regressions —
including every spec exercising RESULT/CUT/Timing/Dynamic-Steps/Lunch Rush (`result-1screen-2.0.spec.ts`,
`pizza-cutting-phase4b.spec.ts`, `timing-transparency.spec.ts`, `dynamic-cooking-steps.spec.ts`,
`lunch-rush-result-ranking-phase4.spec.ts`, `viewport-1screen.spec.ts`, `making-ui-1screen.spec.ts`).

## CI / WebKit

Not runnable in this sandbox (no `webkit-*` package under `/opt/pw-browsers`, the same
pre-existing, previously-documented limitation every prior PR in this series records) — this PR's
own GitHub Actions CI run (fast lint/vitest/build job) and the dedicated WebKit job
(`.github/workflows/e2e-webkit.yml`) at the exact final PR HEAD are authoritative; per the task's
own §24/§27, this PR does not claim done until both report SUCCESS on GitHub.

## Human Verification videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| A — Margherita IDEAL | 390×844 | 17.5s | 824 KB | VP8/WebM | PASS |
| B — Capricciosa (topping-heavy) IDEAL | 390×844 | 14.4s | 712 KB | VP8/WebM | PASS |
| C — Margherita OVERBAKED | 390×844 | 11.9s | 595 KB | VP8/WebM | PASS |
| D — Capricciosa (heavy) → RESULT | 360×800 | 11.6s | 662 KB | VP8/WebM | PASS |

Download: delivered directly to the user this session (not committed to the repo, per policy §6).

**Format note**: this sandbox has no `ffmpeg`/`ffprobe` installed (`apt-get install ffmpeg` failed
on unrelated transitive package mirror 404s, a network/environment limitation, not a code issue)
— per Policy §5 ("MP4化できない環境ではWebMでも可。その場合はResult Reportに理由を明記する"), all
4 videos are delivered as WebM (VP8), Playwright's own native recording format, explicit resolution
set to match each scenario's authority viewport. Verified via `opencv-python` (installed this
session for exactly this purpose): each file opens, reports the expected resolution/frame count/fps,
and every sampled frame (start/mid/end) decodes to a real, non-blank image — full-file decode
confirmed by successfully reading frames at multiple offsets across each file's whole duration.

What each video shows:
- **A**: fresh Margherita round, PREPARE (dough/sauce/cheese/basil placement) → BAKE (held on the
  finished pizza) → CUT (3 lines) → RESULT, with every `<details>` opened to show CUT/score
  breakdown and the Timing Transparency line, before a final hold on the full RESULT view.
- **B**: Capricciosa (mozzarella + mushroom/oregano/ham/black-olive, 8 pieces) through the same
  flow — multiple toppings held on-screen post-bake so each one's continued identity is visible.
- **C**: Margherita baked well past the ideal target (clearly overbaked but still servable) —
  crust/cheese visibly darker than A, basil still visibly green, through CUT and RESULT.
- **D**: Capricciosa at 360×800 through to RESULT, held at the end to show no clipping and the CTA
  reachable.

Video Verification: **PASS**

## Screenshots

8 files, `docs/reports/screenshots/gameplay-ux-finished-pizza-visual-2/` (see Before/After section
above for the full list). All visually inspected before commit.

## Changed files

```
 src/App.css                                   |  28 +++--
 src/App.tsx                                   |   8 +-
 src/components/IngredientPieceVisual.tsx      |   7 +-
 src/components/PizzaStage.bakeVisual.test.tsx | 144 +++++++++++++++++++++++++-
 src/components/PizzaStage.tsx                 |  28 ++++-
 src/data/ingredients.ts                       |  11 ++
 src/logic/bakeVisual.test.ts                  |  60 +++++++++++
 src/logic/bakeVisual.ts                       |  77 ++++++++++++++
 8 files changed, 335 insertions(+), 28 deletions(-)

 e2e/finished-pizza-visual-2.0.spec.ts (new, 288 lines)
 docs/reports/screenshots/gameplay-ux-finished-pizza-visual-2/*.png (new, 8 files)
 docs/reports/TETO_GAMEPLAY-UX_PR-E_FINISHED-PIZZA-VISUAL-2_Result.md (new, this file)
```

## Scope guard (reiterated)

No changes to progression / recipe unlock / discovery / catalog foundation / recipe dataset /
recipe requirements / economy / inventory / Firebase / leaderboard — that scope belongs to the
parallel PR #183, which this PR does not touch or depend on.

## Limitations

- WebKit CI cannot be run locally in this sandbox — GitHub Actions is authoritative for that
  signal (same as every prior PR in this series).
- Video format is WebM, not MP4/H.264 — `ffmpeg` could not be installed in this sandbox
  (transitive-dependency mirror 404s), documented above per Policy §5's explicit allowance.
- The topping/herb roast curves' exact numeric shape (brightness/saturate/sepia values, which
  three ingredients are `bakeRoastResistant`) are this session's own deliberate design choice
  within the task's constraints, not a value handed down by an existing SSOT — flagged for the
  Merge Gate reviewer's own visual judgment call, same as any other new visual-tuning PR.
- Crust visuals were left unchanged (not flagged as broken); if the Merge Gate reviewer's own
  Human Feel pass wants crust strengthened further, that is additive follow-up scope, not part of
  this PR's own fix.
