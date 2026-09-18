# Teto Pizza Game — M3A Bake Judgment / Fading Bake Guide — Result

**Type:** Implementation, directly from `docs/reports/TETO_M3A_BAKE-JUDGMENT_Fresh-Audit.md`
(Phase 0, same session/PR per the task's own instruction).

- **Start SHA (fresh `origin/main`):** `cf6d41495b0f6cb3e568abadba16f5bb8ecbf80e` (PR #66, Sauce
  Free Boundary — confirmed merged and current via `git fetch origin main` before starting).
- **Final SHA (PR head):** `de52b612bcd65e1990e38d0ca752b1663e4cea35` — a merge commit bringing
  in 3 docs-only PRs that landed on `main` while this PR was open (#69 Roadmap/SSOT Fresh Sync,
  #70 Save v2 E1 Inventory Fresh Audit, #71 RESULT 2.0 Fresh Audit — all `docs/` only, verified
  via `git diff cf6d414 494486a --stat` before merging; zero overlap with this PR's own files).
  The implementation commit itself is `7f7107401ecd41d4e8d25b64d413a13ac4d12b3c`.
- **Branch:** `claude/teto-bake-guide-fade-fvk3yv`
- **PR:** [#68](https://github.com/perusonao/teto-pizza-game/pull/68) — CI green on the final head
  (`run 35363148241`, conclusion `success`).
- **Status:** Implementation complete, Preview deployed at the final head, Review Playthrough
  recorded and delivered. **Left OPEN, pending Human Review.**

---

## 1. Current bake architecture (recap of the Fresh Audit's key finding)

BAKE has no fixed-duration cook timer. `BakeOverlay` bounces a needle 0→100→0 forever at
55%/s (a full sweep ≈3.64s) until the player taps 取り出す！; that tap's raw value is the entire
input to scoring. This meant "fade timing" had to be a new concept (elapsed real BAKE-phase
time), and that a fast player who taps within the first sweep never sees the guide fade at all —
the fade is something a player *earns* by taking longer, not something forced on them.

## 2. Scoring boundary vs. Guide boundary

Unchanged and confirmed by a new regression test (`src/state/gameReducer.
bakeGuideRegression.test.ts`): `CONFIRM_BAKE` takes only `{ value: number }` (the raw needle
position) and scores it via `scoreBakeComponentV2(bakeResult, bakeTarget)` — no Guide/fade/
elapsed-time concept exists anywhere in that call path. Identical tap values always score
identically regardless of how faded the Guide was. `BakeOverlay` has no import from
`scoringV2` at all.

## 3. Fade policy (implemented)

- **What fades:** `.bake-gauge` (target/raw/burnt zones + needle, opacity), the Teto caption's
  state-revealing text (cross-fades to a neutral, state-independent line once fully hidden), and
  the CTA's target-zone glow (`cta-button--glow`, gated off once the Guide's opacity reaches 0) —
  all three are "the Guide" per the Fresh Audit's §3 finding (the CTA glow was an unguarded
  second tell that a naive gauge-only fade would have missed).
- **Curve:** `src/logic/bakeGuideFade.ts` — `computeGuideOpacity(elapsedSeconds)`, linear 1→0
  between `GUIDE_FADE_START_S = 3.6` and `GUIDE_FADE_END_S = 7.2`, deterministic and
  monotonically non-increasing (pinned by `bakeGuideFade.test.ts` and `BakeOverlay.test.tsx`).
  Driven by elapsed time accumulated inside `BakeOverlay`'s own `requestAnimationFrame` loop
  (summed `dt` per frame), never by needle proximity to `targetStart`/`targetEnd` — the brief's
  own constraint against exposing the scoring boundary as fade timing.
- **Fairness:** because the accumulator only advances inside real rAF callbacks, and browsers
  throttle/pause rAF for backgrounded tabs, a player who backgrounds the tab mid-BAKE does not
  return to find the Guide already gone (see the Fresh Audit §6 for the one documented residual
  edge case: partial throttling rather than a full pause on some browsers/OSes).

## 4. Visual progression (implemented)

Root cause fixed (Fresh Audit §4): `PizzaStage`'s dough/crust `background` (a radial-gradient)
and cheese melt/toast/char classes previously **snapped** at the exact instant the needle crossed
`bakeTarget.start`/`.end`, because CSS cannot animate a `background` swap. `src/logic/
bakeVisual.ts` replaces this with a continuous `computeBakeHeat(progress, target)` scalar (0 at
progress 0, exactly 1 at the target's own center, 2 at progress 100 — piecewise-linear, no seam
at the boundary), driving:

- **Dough/crust color** — `doughVisualColors(heat)`, an RGB lerp across the same 3 keyframe
  colors the old raw/perfect/burnt classes used, applied as an inline `background` on
  `.pizza-dough-shape` (the element actually visible during BAKE — the outer `.pizza-dough`'s own
  class-based background is overridden by `.pizza-dough--has-shape-layer` from PREPARE onward, a
  pre-existing fact confirmed while tracing this, not something this PR changed).
- **Cheese melt/toast/char** — `cheeseVisualFrame(heat)`, a small interpolated keyframe table
  (scale + brightness/saturate/sepia), applied via a `--bake-melt-scale` CSS custom property
  (composes with each cheese's own base `transform`, e.g. parmigiano's `rotate`, instead of
  overwriting it) plus an inline `filter`.
- **Char spots / smoke** — `charIntensity(heat)`, 0 through "browningDeep", ramping only in the
  final "charred" tail; applied as continuous `opacity` (smoke needed a wrapper element, since a
  running CSS animation — `smoke-rise`'s own keyframes — always wins the cascade over an inline
  style on the same property).
- **The "raw sheen" / "char vignette" overlay** — split into 2 always-mounted layers
  (`.pizza-bake-overlay--sheen`/`--char`) whose only per-frame change is `opacity`, replacing the
  old 3-way `background` swap (`--raw`/`--perfect`/`--burnt`). The old "perfect" warm-brown-rim
  gradient was dropped as part of this simplification (2 layers, not 3) — the crust-color and
  cheese-toast changes already carry the "looks good" signal; noted as a deliberate scope
  trim, not an oversight.

`classifyBake`/`bakeState` itself is untouched and still drives RESULT-screen dialogue/
`ResultPanel` and the one-shot perfect-glow (gated on `resultRevealed`, i.e. only after the
player has already committed their tap — a post-decision reveal, not a BAKE-time tell).

## 5. FREE / Lunch Rush

No behavioral difference introduced; both share `<BakeOverlay>`/`<PizzaStage>` and the one
`CONFIRM_BAKE` call site unchanged. V1 applies today's single fade curve identically to both
modes, documented as the "Normal"-equivalent baseline for the future Practice/Normal/Challenge
split the Fresh Audit's §8 describes (the fade window and visual module are both pure functions
with no mode coupling, ready for that split later without touching scoring).

## 6. Timer fairness

Audited only, per the task's own scope (`Phase 4`) — no new Cooking Time score was implemented.
See Fresh Audit §6 for the full finding: the fade reuses the needle's own already-audited
rAF-pause-on-background property rather than adding a new `visibilitychange` listener; the one
documented residual limitation (partial rAF throttling on some browsers) is a minor fairness
edge case with no scoring impact, carried forward as a note for any future M3B Cooking Time work.

## 7. Regression guard confirmation

`git diff cf6d414..7f71074 --stat` (the implementation commit alone): only `src/App.css`,
`src/components/BakeOverlay.tsx`, `src/components/IngredientPieceVisual.tsx`, and
`src/components/PizzaStage.tsx` were modified, plus new files (`src/logic/bakeVisual.ts`,
`src/logic/bakeGuideFade.ts`, and 5 test files). Nothing under `src/logic/scoringV2/`,
`src/logic/pitzReward.ts`, `src/state/persistence.ts`, `src/data/recipes.ts`, or any Recipe
Reference fixture was touched. Scoring 2.0 weights, the Bake 20pt formula, Sauce 52pt/Pieces
16pt/Recipe 12pt, the Pitz multiplier, Lunch Rush reward, and the Save schema are all unchanged.

## 8. Tests

62 test files / 1188 tests passing (baseline was 1162; 22 new, 0 regressions):

- `src/logic/bakeVisual.test.ts` (16) — `computeBakeHeat` monotonicity/no-discontinuity-at-
  boundary/clamping, `meltIntensity`/`toastIntensity`/`charIntensity`/`rawSheenIntensity` range
  and monotonicity, `bakeVisualStage` bucketing, `doughVisualColors`/`cheeseVisualFrame` anchor
  values and no-repeat-across-range.
- `src/logic/bakeGuideFade.test.ts` (4) — `computeGuideOpacity` pre-fade/monotonic/post-fade/
  midpoint.
- `src/components/BakeOverlay.test.tsx` (9) — guide starts at full opacity; fades deterministically
  over a hand-driven `requestAnimationFrame` loop (mocked `performance.now`); monotonic across 90
  small frames; becomes fully hidden and swaps to the neutral caption; the CTA glow never applies
  once the Guide is hidden even when the needle sits inside the target zone; `onConfirm` still
  fires with the true needle position after the Guide has faded.
- `src/components/PizzaStage.bakeVisual.test.tsx` (6) — no bake styling before BAKE; no color jump
  at either scoring boundary (start=60/end=80); visibly different colors across under/good/over;
  cheese melts continuously across the boundary; char/smoke stay at 0 opacity well before deep
  overbake; char intensity ramps in only once deep into overbake.
- `src/state/gameReducer.bakeGuideRegression.test.ts` (7) — identical `CONFIRM_BAKE` values score
  identically across repeated rounds (parametrized 10/40/65/70/85/99); the action's payload shape
  carries only `{ type, value }`, nothing Guide-related to even score against.

Full suite: `npm test` (1188/1188), `npx tsc -b` (clean), `npm run lint` (0 warnings, matching
baseline — required moving `computeGuideOpacity` into its own module,
`src/logic/bakeGuideFade.ts`, since oxlint's `react/only-export-components` flags a component
file exporting anything besides the component), `npm run build` (clean, 327 kB JS / 36 kB CSS,
unchanged order of magnitude from before this PR).

## 9. Preview

Deployed via the existing `teto-pizza-game-preview` pipeline (unmodified, no new workflow files):

1. `deploy-from-source.yml` (`workflow_dispatch`, `ref=de52b612bcd65e1990e38d0ca752b1663e4cea35`,
   `pr_number=68`) → run [35363161578](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35363161578),
   **success**.
2. `pages.yml` dispatched as a safety net → run [35363427921](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35363427921),
   **success**.
3. `teto-pizza-game-preview`'s `README.md` on `main` confirms: Source ref/commit
   `de52b612bcd65e1990e38d0ca752b1663e4cea35`, Source PR #68, Built `2026-09-18T15:33:53Z`.

**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/

As with prior Preview gates in this repo, this sandboxed session's outbound network policy
blocks `perusonao.github.io` directly, so the Review Playthrough below was captured against a
local `vite dev` server running the exact same reviewed commit (`de52b612b...`) rather than the
live Preview URL — the served bytes are the same source, only the network hop to GitHub Pages
itself could not be exercised from this sandbox. This does not replace the Human Feel gate: the
user should still open the real Preview URL on a real device before merging.

## 10. Review Playthrough

390×844, MP4/H.264, 25fps, each scenario is a separate clip (delivered to the user as
attachments in this session, not committed to the repo):

| Scenario | File | Duration | What it shows |
|---|---|---|---|
| A — Underbake | `scenario-a-underbake.mp4` | 10.2s | BAKE starts with the Guide fully visible; confirmed early (~1s in, needle still just under the target's `start` edge) → RESULT shows `焼き加減: 生焼け`, Teto/Blue dialogue calling out an underbake ("マルゲリータの真ん中がまだ生っぽいや…"), 焼き sub-score 98/100 (correctly high — the continuous edge-distance formula gives near-full credit for landing just barely outside the zone, not a bug). |
| B — Good judgment | `scenario-b-good.mp4` | 19.1s | Guide fully visible at t≈0 (target zone + needle colored by state); by t≈8s the gauge, needle color and state-revealing caption are all gone, replaced by the neutral "見た目で焼き加減を確かめて！" line — held for ~1-2s exactly as the brief's Scenario B asks; confirmed while judging only the pizza's own look → RESULT screen. |
| C — Overbake | `scenario-c-overbake.mp4` | 36.7s | Guide fades out as in B, bake continues well past that; dough visibly darkens continuously into a deep brown with char spots by ~20s in (no sudden jump — screenshots at 2 different "char peak" moments show progressively deeper char, not a toggle); confirmed late → RESULT shows `焼き加減: 焦げ`, dialogue calling out overbake, 焼き sub-score 82/100. |
| D — Reset/retry | `scenario-d-reset-retry.mp4` | 18.7s | From a completed round's RESULT/home flow, starts a fresh round: DOUGH step is empty (no carry-over), and the fresh round's own BAKE phase shows the Guide at full opacity again — no stale fade/elapsed-time state leaked from the previous round's BAKE. No console errors observed. |

Representative frames (also delivered): BAKE at t≈0 (guide fully visible, target/raw/burnt zones
and colored needle legible), BAKE at t≈8s (guide fully hidden, pizza-only judgment state), 2 char-
progression frames from Scenario C, and the RESULT screen for each of A/B/C/D.

## 11. Known limitations

- The cheese's own char/toast look is fairly subtle in the video — mozzarella's base color is
  near-white, so even `cheeseVisualFrame`'s heat=2 (brightness 0.6, sepia 0.25) reads as a muted
  grayish tone rather than a dramatic char; the dough/crust color and char-spot overlay carry
  most of the "how done is this" signal visually. Acceptable for V1 (the brief's own visual list
  treats crust/char as first-class, cheese as one contributing signal among several), but a
  candidate for a follow-up tuning pass if Human Feel flags it.
- The old 3-way "raw sheen / perfect warm-rim / char vignette" overlay lost its distinct
  "perfect" warm-brown-rim look (simplified to 2 continuous-opacity layers, sheen + char — see
  §4). If Human Feel misses that cue specifically, it can be reintroduced as a third continuous
  layer peaking near heat≈1 without touching scoring.
- Sauce-layer/topping `filter` tint and the sauce-heatmap's own bake-state tint were deliberately
  left on the old 3-class (`pizza-dough--raw/--perfect/--burnt`) scheme rather than made
  continuous (Fresh Audit §4's scoped compromise) — they still have a CSS-transition-smoothed
  snap at the scoring boundary, just a much smaller visual contribution than the dough/cheese
  fixes above. Candidate for M3B if judged worth the extra surface area.
- No `visibilitychange` handling was added to `BakeOverlay`'s rAF loop (matches the pre-existing
  needle behavior, safe by construction — see Fresh Audit §6); a full pause-on-background timer
  architecture remains a real Cooking Time feature's own concern, out of scope here.

## 12. Human Feel — what to look for

1. Does the fade feel natural, or too fast/slow? (Currently ~3.6s full visibility + ~3.6s fade —
   easy to retune via `GUIDE_FADE_START_S`/`GUIDE_FADE_END_S` in `src/logic/bakeGuideFade.ts`
   alone, no scoring impact.)
2. Once the Guide is gone, can you actually tell under/good/over apart from the pizza alone on a
   real phone screen (390×844, real ambient lighting) — not just in a screenshot?
3. Does the neutral caption ("見た目で焼き加減を確かめて！") read as a helpful nudge or as an
   unhelpful non-answer once the Guide is gone?
4. Does losing the CTA glow (previously a strong "you're in the zone" pulse) feel like a fair
   trade for the judgment gameplay, or too abrupt?

## 13. M3B candidates

- Retune the fade window / visual keyframes from real Human Feel data.
- Reintroduce a distinct "perfect" visual cue (§11) if the 2-layer overlay simplification reads
  as a real loss.
- Extend continuity to sauce-layer/topping tint and the sauce-heatmap's own bake tint (§11).
- A real Practice/Normal/Challenge difficulty split, using `bakeGuideFade.ts`'s already-pure
  function shape (per-mode `GUIDE_FADE_START_S`/`END_S`, or `Infinity`/`0` for "never fades"/"no
  guide at all") — Issue #37's own M3 roadmap item.
- Cooking Time as a secondary evaluation (Issue #37's separately-flagged candidate), once the
  Fresh Audit's timer-fairness residual note is revisited with a real feature behind it.

---

## Final verdict

**A. READY FOR HUMAN REVIEW**

PR #68 stays OPEN. Do not merge until the user has reviewed the Playthrough video (and ideally
opened https://perusonao.github.io/teto-pizza-game-preview/ on a real device) and confirmed the
Human Feel questions in §12.
