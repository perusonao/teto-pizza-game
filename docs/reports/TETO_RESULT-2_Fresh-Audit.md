# Teto Pizza Game — RESULT 2.0 Fresh Audit

**Type:** Audit only. No production code or test changes in this session. Docs-only PR, not to
be merged to `main`.

- **Audited `origin/main` SHA:** `27818efb4876d9220e425ffe65afdc9a9288e62a`
  (`docs: Roadmap/SSOT Fresh Sync — sync Issue #22/#33/#37 + PROJECT_HANDOFF to fresh GitHub
  state (#69)`). Confirmed via `git fetch origin main`; working tree was clean; this session's
  branch (`claude/teto-result-2-audit-rjbvjo`) sits exactly at this SHA
  (`git merge-base HEAD origin/main` == `origin/main`'s own tip, zero diff).
- **PR #68 state (confirmed via GitHub API, not assumed from prior chat):** **OPEN, NOT
  MERGED.** `M3A Bake Judgment: fading bake guide + continuous bake visuals`,
  head `7f710740`, base `398d4844` (an older `main`, several commits behind the SHA above),
  `mergeable_state: unknown`, 1 comment, last updated `2026-09-18T13:09:00Z`. Its own PR body
  explicitly marks the Preview/Review Playthrough step as still "in progress." **This audit does
  not read, assume, or build on any file PR #68 touches** (`src/App.css`,
  `src/components/BakeOverlay.tsx`, `src/components/IngredientPieceVisual.tsx`,
  `src/components/PizzaStage.tsx`) beyond what is already on `main` today. Everything below is
  read from `main` as of the SHA above. This matches the independent same-day
  `TETO_ROADMAP-SSOT_FRESH-SYNC_2026-09-18.md` audit's own finding for PR #68.
- **Cooking Time:** confirmed out of scope for this audit (separate track, per task). Grepped
  the full `src/` tree for `cookingTime|efficiency|elapsedMs|roundStartedAt|timeSpent` — **zero
  matches**. No timing/efficiency infrastructure exists anywhere in the codebase today; section 7
  below treats this as a genuinely blank extension point, not a partially-built one.

---

## 1. Current RESULT architecture

RESULT is not one screen — it is **two sequential phases plus a third, entirely separate path
for Lunch Rush.** All three are real, distinct code paths on `main` today, not documents/design
intent:

| Path | Trigger | Component | Screen |
|---|---|---|---|
| FREE round scored | `CONFIRM_BAKE` → `phase: "RESULT"` | `ResultPanel` (`src/components/ResultPanel.tsx`) + Teto/Blue `DialogueBox` lines | Score/stars reveal |
| FREE round registered | `REGISTER_TO_DEX` → `phase: "DISCOVERED"` | inline JSX in `GameScreen.tsx`'s `DISCOVERED` branch | Pitz credit + BEST/discovery banner + retry CTAs |
| Lunch Rush pizza served | `CONFIRM_BAKE` while `mission.mode === "PLAYING"` | `MissionServePanel` | Compressed score+serve, immediate "次の注文へ" |
| Lunch Rush run ends | mission timer expiry → `mission.mode: "RESULT"` | `MissionResultOverlay` | Full-screen run summary (served/avg/BEST/score/Pitz/retry), **one screen** |

Key mechanics (`src/state/gameReducer.ts`):

- `CONFIRM_BAKE` computes `scoringV2Result` via the single authoritative `computeScoringV2` call
  site, derives legacy `score: ScoreBreakdown` via `toLegacyScoreBreakdown`, and sets
  `phase: "RESULT"`. This is shared by FREE and Lunch Rush alike.
- `ResultPanel`'s **only** interactive control is one button: `レシピ図鑑に登録する`
  ("Register to Recipe Dex"), wired to `onRegisterToDex` → dispatches `REGISTER_TO_DEX`.
  There is no "skip"/"just look" affordance and no separate "retry" action available from
  RESULT itself — the single CTA is a bureaucratic registration action, not a "what next"
  choice.
- `REGISTER_TO_DEX` is one atomic reducer step, guarded by `state.phase !== "RESULT" ||
  !state.score` (an exactly-once guard, deliberately, per Issue #38's Pattern A) that in a single
  transaction: (a) calls `registerScoreToDex` (Dex discovery + BEST-never-goes-down comparison),
  (b) computes `lastPitzCredit` via `applyPitzCredit` (skipped — `null` — for a Mission round),
  and (c) flips `phase: "DISCOVERED"`. Dex registration, BEST, and the FREE per-pizza Pitz credit
  are therefore **inseparable today** — there is no way to see "did I get a new BEST / how much
  Pitz did I earn" without also triggering the Dex-registration side effect, and no way to
  register to the Dex without leaving the score-reveal screen behind.
- `DISCOVERED` is where `justDiscovered`/`justGotNewBest`/`lastPitzCredit` (base
  reward/multiplier/balance-before→after) actually render, plus the two retry CTAs
  (`もう一度つくる` = `RETRY_SAME_RECIPE`, `別のピザを作る` = back to Pizza Select). None of
  this is visible on the RESULT (score) screen itself.
- Lunch Rush's own end-of-run screen (`MissionResultOverlay`) already does, in **one** screen,
  exactly the "score → BEST → Pitz → retry" sequence RESULT 2.0 is asked to build for FREE —
  useful existing precedent/prior art in this same codebase, not a hypothetical.

## 2. Current 390×844 information hierarchy

Top-to-bottom, for a FREE round at `phase: "RESULT"` (`GameScreen.tsx`, unconditionally
rendered order):

1. `.app-header` (fixed-ish, home button + Pitz balance chip) — always present, every phase.
2. `.dialogue-area`: Teto's line (`buildTetoResultLine`, keyed only on `bakeState` + recipe) and
   Blue's line (`buildBlueResultLine`, keyed on a 5-way band: `high`/`mid`/`low`/`lowRaw`/
   `lowBurnt` derived from stars + bakeState) — two stacked character `DialogueBox`es.
3. `PizzaStage` — the player's actual baked pizza, rendered unconditionally regardless of phase
   (see section 3), plus a `.pizza-perfect-glow` overlay gated on `resultRevealed && bakeState
   === "perfect"` (`resultRevealed` is `state.phase === "RESULT"` only, see section 3).
4. `ResultPanel`: stars line, numeric total, an optional 焼き加減 badge (raw/perfect/burnt icon +
   label), then four progress bars (ソース/具材/配置/焼き, see section 4), then the single
   `レシピ図鑑に登録する` button.
5. `ScoringV2DebugPanel` — Preview-build-only (`VITE_PREVIEW_MODE`, dead-code-eliminated from
   production), but present in the DOM order here in every non-production Preview build.

Then, after the player taps the one RESULT button, `phase` becomes `"DISCOVERED"` and the
**same** dialogue-area/PizzaStage stack re-renders with:

1. Discovery/BEST banner (`✨ 発見しました！` or `🌟 NEW BEST!`, mutually exclusive) — only if
   one of the two is true; otherwise nothing here.
2. `pitz-credit-summary` card: headline `+N Pitz`, then a 3-row `<dl>` (base reward / quality
   multiplier / balance before→after), or a "0 Pitz" explanatory note if `earnedPitz === 0`.
3. Two full-width stacked CTAs: `もう一度つくる` (retry same recipe) / `別のピザを作る` (back to
   Pizza Select).

Nothing in `.app-frame`/`.game-screen` sets `overflow-y: hidden` — `.app-frame` only sets
`overflow-x: hidden` with `min-height: 100svh`. So neither RESULT nor DISCOVERED is hard-capped
to one 390×844 viewport today; both **can** scroll if their stacked content (dialogue + pizza +
panel, twice, once per phase) exceeds it. This audit did not measure actual rendered height in a
browser (no visual verification was performed — read-only code audit per the task), but the
component list above is long enough per phase that "does the important stuff fit above the
fold" cannot be assumed without measuring, and is flagged as a risk in section 11.

## 3. Player-made pizza preservation

Better preserved than a naive reading of "RESULT/DISCOVERED are separate phases" would suggest,
because `PizzaStage` itself is rendered **unconditionally** in `GameScreen.tsx` (not gated on
`state.phase` at all) and reads its bake-visual state from `bakeProgress`, which `App.tsx`
computes as:

```
state.phase === "BAKE" ? liveBake
: state.phase === "RESULT" || state.phase === "DISCOVERED" ? state.pizza.bakeResult
: null
```

So the fully-decorated pizza (dough shape, sauce heatmap, toppings, bake-state-classed dough/
cheese/overlay, char-spots/smoke if burnt) **persists visually, unchanged, across both RESULT and
DISCOVERED** — the player is never looking at a blank stage or a stale intermediate state during
either phase. This is a solid foundation for a "completed pizza HERO" concept; it does not need
to be built from scratch, only re-emphasized/re-laid-out.

What is *not* preserved across the phase boundary:

- `.pizza-perfect-glow` (`PizzaStage.tsx` line ~1029) is gated on `resultRevealed && bakeState
  === "perfect"`, and `resultRevealed` is `state.phase === "RESULT"` only — this one decorative
  touch disappears the moment the player taps through to DISCOVERED, for no evident reason (it
  isn't reused as a "this was your best/registered pizza" cue there).
- The `ScoringV2DebugPanel` (Preview-only) does not render at all during DISCOVERED (only
  `state.phase === "RESULT"` shows it) — irrelevant to players, relevant only if Preview
  calibration workflows are touched by a future slice.

No mechanism resets or replaces `state.pizza` between RESULT and DISCOVERED (`RETRY_SAME_RECIPE`/
`SELECT_RECIPE`/`PLAY_AGAIN` are the only pizza-resetting actions, and none of those runs until
the player explicitly taps a DISCOVERED CTA). So "the pizza I actually made" is already the
correct, persistent visual anchor across the current two-phase flow — the audit's target concept
of a HERO pizza does not require new state, only reflowing where/how prominently it is composed
relative to the two panels stacked below it today.

## 4. Scoring feedback possibilities (internal metric → player-facing feedback)

**Scoring 2.0 Reference-fixture coverage is complete for all 7 recipes today** — this is a fresh
finding, not carried over from prior chat, and it materially changes what RESULT 2.0 can assume.
`src/data/referencePizza.ts` defines `MARGHERITA_REFERENCE`, `MARINARA_REFERENCE`,
`FUNGHI_REFERENCE`, `GENOVESE_REFERENCE`, `FUGAZZA_REFERENCE`, `BISMARCK_REFERENCE`, and
`QUATTRO_FORMAGGI_REFERENCE` — one entry per `RECIPES` id in `src/data/recipes.ts` (confirmed by
cross-referencing both files directly), each with real `sauce` + `pieceGroups` geometry, not
placeholders. `types.ts`'s own file-header comment ("only Margherita has an authoritative
Reference fixture... P0-1") is **stale** — it describes the Phase 4A-2 starting point, before the
B2 Reference-coverage work (`TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md`,
`TETO_SCORING2-B2_PARTC2_Result.md`) filled in the remaining 6 recipes. `computeScoringV2`
(`src/logic/scoringV2/index.ts`) gates its whole result on `getReferencePizza(recipe.id)` being
non-null — that is now true for every shipped recipe, so `ResultPanel`'s `sauceScore` (currently
only rendered when non-null) and every other component score should be `available: true` for
every recipe in ordinary play today, not just Margherita.

This means the "internal metric → player-facing phrase" translation the task asks about is
buildable **today, for all 7 recipes**, not blocked on further Reference-fixture authoring. The
raw signals already computed and already reaching the client (currently only rendered in the
Preview-only `ScoringV2DebugPanel`, never shown to real players) are rich enough to support it:

- **Sauce** (`SauceComponentV2`, 52/100 weight — the single heaviest component and the one
  legacy `ScoreBreakdown` structurally has no field for): `quantitySimilarity`,
  `coverageSimilarity`, `evennessScore`, `edgeScore` — all 0–1. A translation layer could map,
  e.g., high `edgeScore` → "端まできれいに塗れた！", low `coverageSimilarity` → "ソースが足りない
  ところがあったよ", low `evennessScore` → "ムラがあったかも".
- **Pieces** (`PiecesComponentV2.groups`, per-ingredient-group `quantitySimilarity` +
  `placementSimilarity`, permutation-invariant Hungarian-matched): could drive per-topping
  feedback ("チーズの位置がお手本にかなり近い！" / "バジルの数が少なかったかな").
- **Recipe** (`RecipeComponentV2`): `requiredTypesPresent/Total`, `extraTypesCount`,
  `purityMultiplier` — directly supports "必要な材料は全部使えてる" vs. "レシピにない材料が
  ちょっと多かったね" framing.
- **Bake** (`BakeComponentV2Available`, computed for all 7 recipes regardless of Reference —
  it needs none): `bakeState`, `distanceFromIdeal`, `similarity` — already exactly the shape
  needed for the task's own example ("少し焼きすぎたみたい" reads directly off `bakeState ===
  "burnt"` plus a small `distanceFromIdeal` for "just slightly").

Today, **none of this reaches players.** `ResultPanel` only ever shows raw 0–100 numbers on
generic progress bars (ソース/具材/配置/焼き) with plain Japanese labels — no qualitative
sentence anywhere derives from these finer signals. The only existing qualitative text at RESULT
is `dialogue.ts`'s `buildTetoResultLine`/`buildBlueResultLine`, and both are keyed **only** on
`bakeState` (3-way) and star count (Blue's 5-way band) — they already prove the "authored-variant
line, seeded by recipe+bakeResult for rotation" pattern works and reads naturally in this game's
voice, but neither touches Sauce/Pieces/Recipe internals at all. Extending that same authored-
variant-line pattern to consume the per-component signals above (rather than inventing a new
mechanism) is the natural, lowest-risk path to "why this score" feedback — see section 8.

One caveat: `matchScore`/`ingredientScore` in the legacy `ScoreBreakdown` are themselves already
lossy blends (`ingredientFeedbackScore` in `ResultPanel.tsx` blends `matchScore*0.7 +
ingredientScore*0.3` into a single "具材" bar) — a "why" layer should read the richer
`ScoringV2Result.components` directly (as `ResultPanel` already does for `sauceScore`), not the
already-blended legacy fields, to avoid re-deriving fuzzy feedback from an already-fuzzy number.

## 5. Pitz / BEST / Dex integration

- **Pitz (FREE per-pizza credit, Issue #38 E-P1/E-P2):** `applyPitzCredit` — a pure V1 formula,
  `baseRewardPitz × qualityMultiplier` where the multiplier is a 5-band table (`90→1.2, 75→1.0,
  60→0.8, 40→0.5, else→0`) **byte-for-byte pinned to the same thresholds as the star bands**
  (`STAR_THRESHOLDS` in `scoring.ts`), by explicit design comment ("do not re-tune without Human
  Feel evidence"). This is a genuinely good invariant for RESULT 2.0 to preserve: whatever star
  count is shown, the Pitz multiplier tier is guaranteed consistent with it, so a
  reveal-sequenced UI (stars → Pitz) can never show a contradictory pair (e.g., 5★ but the
  lowest Pitz tier).
- **BEST:** `registerScoreToDex`/`isBetterQuality` in `src/state/dex.ts` — ranks by `stars`
  first, `total` second (explicitly, so a higher-total-but-lower-star round can never regress a
  recipe's displayed BEST stars). "BEST never goes down" and "`timesMade` increments exactly
  once per round" both hold structurally, by this being the only call site.
- **Dex:** discovery (`wasNewDiscovery`) and BEST are computed by the same
  `registerScoreToDex` call, so a first-time recipe completion is always simultaneously a
  discovery and a new-BEST event (both banners are mutually exclusive in the current JSX —
  `justGotNewBest`'s banner only shows `!state.justDiscovered && ...`).
- **The coupling problem:** all three (Dex registration, BEST comparison, Pitz credit) are
  currently gated behind the *single* `REGISTER_TO_DEX` action, which is also the *only* way to
  leave the RESULT (score) screen. A player cannot see "did I improve my BEST" or "how much Pitz
  did I earn" without first taking an action framed entirely as bureaucratic ("register to Dex")
  — the actual payoff (Pitz reward, BEST achievement) is hidden *behind* that action rather than
  being what the button visibly promises. This is very likely the single biggest reason the
  current RESULT reads as "a score-confirmation screen" rather than "a payoff screen": the
  reward is real and already well-modeled in state, but it is architecturally placed one tap
  later and one full phase away from the score reveal that precedes it.
- Reducer-level exactly-once guards (`state.phase !== "RESULT"`) are the load-bearing safety net
  for both BEST-never-regresses and Pitz-never-double-credited — any redesign that merges RESULT
  + DISCOVERED into one screen must preserve "the underlying dispatch happens exactly once per
  round," even if the *visual* presentation becomes a single continuous screen. This is a
  UI/reducer decoupling question, not a reason the phases can't be visually merged (see section
  9, Slice 1).

## 6. Cooking Time extension point

No code exists to build on (confirmed by the zero-match grep above) — this is a green-field
extension point, not a partially-built one, and this audit does not propose implementing it. For
a future track to slot a secondary, non-scoring evaluation card into RESULT 2.0
(task's own example: 品質88 / 手際GOOD / +5 Pitz) without disturbing Scoring 2.0's existing
100-point formula, the natural seam is:

- **A new, independent state field**, structurally parallel to `lastPitzCredit` (a `null`-until-
  computed snapshot set atomically by whichever reducer action would compute it), not a new
  `ScoreBreakdown`/`ScoringV2Result` field — Scoring 2.0's 100-point total is explicitly a
  quality-only formula today (Sauce 52/Pieces 16/Recipe 12/Bake 20), and mixing a time signal
  into it would be a scoring-authority change this audit's task explicitly excludes.
  `pitzReward.ts`'s own design ("a pure domain module, deliberately independent of `scoringV2/`,
  takes an abstract 0-100 quality total... so a future authority change never requires touching
  this file") is a template worth mirroring for a `cookingEfficiency.ts` module: a pure function
  of elapsed time (once something starts recording a round's start timestamp — nothing does yet)
  in, a `{ band: "GOOD"|..., bonusPitz }`-shaped result out.
- **Display placement**: a visually distinct secondary card *below* the primary Score/Stars/Pitz
  payoff (task's own priority list has it unranked/deferred — consistent with "today: implement
  nothing, only leave room"), so a future Cooking Time slice is additive to RESULT 2.0's layout
  rather than requiring it to be re-derived.
- Needs, at minimum: a round-start timestamp captured somewhere in `GameState` (candidate: set
  at `START_BAKE` or at the PREPARE-entry action, not decided by this audit), and a pure
  banding function mirroring `qualityMultiplierForScore`'s own shape/tone.

## 7. Proposed RESULT 2.0 hierarchy

Following the task's own priority list, and grounded in what sections 1–6 found already exists
vs. needs to move:

1. **完成ピザ HERO** — already exists and already persists correctly across both phases
   (section 3); the work here is purely layout/prominence (make it the visual anchor, likely
   larger/higher on screen than today, not new state).
2. **Tetoの短い総評** — `buildTetoResultLine` already exists and is already short/single-line;
   reuse as-is or extend its banding (see section 4) with sauce/pieces/recipe signals, not
   replace the mechanism.
3. **Score / Stars** — already exists (`ResultPanel`'s headline); keep but de-emphasize relative
   to HERO/verdict per the task's own "not the main character" instruction — likely means
   smaller type / lower visual weight than today's 30px stars + 22px score, not removal.
4. **「よかったところ」** — new: 1 short authored line, selected from the best-scoring
   available component signal (section 4), not a generic bar.
5. **「次はここ」** — new: 1 short authored line, selected from the weakest-scoring component
   signal, using the same translation approach. Task explicitly does not want the raw
   Sauce/Pieces/Recipe/Bake formula shown — the 4 progress bars in today's `ResultPanel` are the
   most literal "formula exposed" element and are candidates to be replaced or demoted, not kept
   verbatim.
6. **+Pitz** — state (`lastPitzCredit`) and formula (`applyPitzCredit`) already exist and are
   already well-modeled (section 5); the change needed is architectural (surface it on the same
   screen as the score reveal) not computational.
7. **NEW BEST / Dex** — same: state (`justGotNewBest`/`wasNewDiscovery`) already exists; needs
   to move onto the same screen, not be computed differently.
8. **Retry CTA** — `RETRY_SAME_RECIPE`/back-to-select already exist and already work; needs to
   move onto the same screen as the score reveal, replacing the "register to Dex" framing with a
   forward-looking framing ("retry" / "next"), since registration would become an implicit
   side-effect of reaching this single screen rather than a player-facing action.

The core structural change section 5 already implies: **collapse the RESULT + DISCOVERED phase
split into one continuous screen**, mirroring Lunch Rush's own `MissionResultOverlay` precedent
(one screen, score→BEST→Pitz→retry, already shipped and working in this codebase). The reducer
transaction (`REGISTER_TO_DEX`'s Dex/BEST/Pitz side effects) can fire automatically the moment
`CONFIRM_BAKE` lands (or via a short internal auto-advance), rather than waiting for an explicit
"register" tap that no longer needs to exist as a separate player-facing gesture.

## 8. Pitz E-P3 integration / reveal sequencing

The task asks for one merged sequence, not two separately redesigned reward moments:

**score reveal → stars → Pitz → BEST/Dex → retry**

What this audit found relevant to sequencing risk:

- The star/Pitz-multiplier band alignment (section 5) means stars and Pitz can be revealed
  adjacently without ever contradicting each other — a real design asset for a smooth
  sequence.
- `justDiscovered`/`justGotNewBest` are mutually exclusive today (an "already discovered, new
  BEST" round never also reads as "just discovered") — the sequence only ever needs to show one
  banner, not reconcile two.
- Lunch Rush's `MissionResultOverlay` is the existing "all in one screen, no extra navigation"
  precedent this task's own instruction ("派手すぎる長い演出は禁止") matches almost exactly —
  it shows all five pieces of information (served/avg/BEST/score/Pitz) plainly, immediately, no
  staged reveal. That is strong evidence in this codebase's own established taste that a
  static, immediately-legible layout (not a multi-step animated reveal) is what "not
  interrupting repeated play" means here — an animated stars→Pitz→BEST reveal sequence should be
  treated as an optional enhancement layered onto a screen that already reads correctly at
  t=0, not a required mechanism.
- Nothing today computes an explicit "reveal order" or animation timeline anywhere in RESULT/
  DISCOVERED/Mission code — this would be new UI-only sequencing logic, not a reducer change.

## 9. Implementation slices

Ordered so each slice is independently shippable and testable, and none requires the next to be
useful on its own:

1. **Merge RESULT+DISCOVERED into one screen for FREE.** Reducer: either auto-dispatch the
   `REGISTER_TO_DEX` side effects at `CONFIRM_BAKE` time (folding Dex/BEST/Pitz into the same
   transaction that sets `phase: "RESULT"`) or keep two internal phases but render both sets of
   information from one `GameScreen` branch. Preserve the exactly-once guarantee explicitly —
   this is the highest-risk slice structurally (touches the one place BEST-never-regresses and
   Pitz-never-double-credits are enforced) and should ship with reducer tests before any visual
   work, mirroring `gameReducer.pitzReward.test.ts`'s existing coverage style.
2. **HERO layout pass.** Re-lay-out `PizzaStage` + verdict + de-emphasized score/stars per
   section 7, items 1–3. Purely presentational; no state changes. Restore `.pizza-perfect-glow`
   parity if the merged screen still distinguishes an internal RESULT-vs-DISCOVERED sub-state.
3. **Feedback-line translation layer.** New pure module (mirrors `dialogue.ts`'s existing
   authored-variant-line pattern) mapping `ScoringV2Result.components` → one "良かった点" line +
   one "次はここ" line, per section 4's signal list. Ship with unit tests asserting the mapping
   for representative component values (high edge score, low coverage, burnt bake, extra
   ingredient types, etc.), independent of any layout change.
4. **Pitz/BEST/Dex surfacing on the merged screen.** Move `lastPitzCredit`
   headline+`pitz-credit-summary` and the discovery/BEST banner from the old DISCOVERED-only
   render branch onto the merged screen; retire the "register to Dex" button label/framing in
   favor of a forward-looking retry CTA (section 7, item 8).
5. **Reveal sequencing (optional, last).** Only after 1–4 read correctly with no animation —
   add a restrained stars→Pitz→BEST stagger if playtesting (section 10) shows the static version
   feels flat, per section 8's finding that the static version is not obviously wrong on its
   own.
6. **Cooking Time scaffold (structure only, separate track).** Per section 6 — add the
   `GameState` timestamp field and an empty/stubbed secondary-card slot in the merged layout, no
   scoring/formula work. Explicitly the task's own "not to implement now" item; listed here only
   so slice 2's layout pass can reserve the space rather than needing to be revisited.

## 10. Human Feel questions

- Does collapsing RESULT+DISCOVERED into one screen feel like it removes a natural "beat" of
  anticipation (see the score, *then* decide to register), or does it read as removing needless
  friction? This is exactly the kind of question this codebase's own convention (Human Feel
  Fix passes, iPhone Calibration reports) treats as needing an actual device playtest, not a
  code-level guess.
- With the "register to Dex" button gone as an explicit player action, does anything need to
  visually confirm "this pizza is now saved" at all, or does the BEST/Pitz reveal itself already
  read as sufficient confirmation?
- How much of "良かった点/次はここ" should be authored per-recipe (like `dialogue.ts`'s existing
  Teto/Blue lines) vs. purely data-driven off component scores? A purely generic phrase risks
  feeling flat across 7 different recipes; a fully per-recipe authored set is a much larger
  content-authoring lift than this slice implies.
- Should a 0-Pitz round (`earnedPitz === 0`, already has an explanatory note today) get a
  gentler HERO/verdict tone than a high-scoring round, or does that risk feeling punishing on a
  screen the task explicitly wants to make players want to return to?
- Is the star-rating still the right primary "at a glance" quality signal once a qualitative
  verdict line exists above it, or does showing both risk feeling redundant rather than
  reinforcing?

## 11. Risks

- **Reducer atomicity regression.** The single largest technical risk: merging RESULT+DISCOVERED
  must not accidentally create a path where `REGISTER_TO_DEX`'s side effects can fire twice (a
  double Pitz credit or a spurious second BEST comparison) or zero times (a round that never
  registers to the Dex at all). The existing `state.phase !== "RESULT"` guard is exactly-once by
  construction only because phase transition and side-effect application happen in the same
  reducer step; any redesign that decouples "screen the player sees" from "phase the reducer is
  in" needs an equally explicit new invariant, not an implicit one.
  - Update after the fresh re-read above: this is not "for most recipes" — it is now the
    default case for all 7. Any RESULT 2.0 slice that assumed only Margherita had per-metric
    data would have been solving a problem that no longer exists on `main`; this audit corrects
    that going in.
- **Mission-path coupling.** Lunch Rush's `MissionServePanel`/`MissionResultOverlay` are
  deliberately separate from FREE's RESULT/DISCOVERED (explicit design comment: "free play's
  own RESULT dialogue/ResultPanel... would cost too much tempo... during a Mission run"). RESULT
  2.0 work must stay scoped to the `!isMissionActive` branch in `GameScreen.tsx` and must not
  pull Mission's already-working, already-compressed flow into scope, or reintroduce the tempo
  cost Phase 3C-4 explicitly designed Mission's path to avoid.
- **Accessibility baseline is currently weak and must not be carried forward uncritically.**
  Stars render as bare `★`/`☆` glyph repetition with no `aria-label` (a screen reader reads
  literal star glyphs, not "3 out of 5"); nothing in `ResultPanel`/DISCOVERED's banners uses
  `aria-live` to announce the score/BEST/Pitz reveal to an assistive-technology user, who would
  otherwise receive no signal that new content appeared. A RESULT 2.0 that adds more
  reveal-sequenced content without addressing this makes the gap larger, not smaller (this audit
  did not find any existing accessibility-focused test or lint gate over ResultPanel/DISCOVERED
  to catch a regression here).
- **Vertical space budget.** Per section 2, neither RESULT nor DISCOVERED is currently capped to
  one viewport, and the task explicitly warns against turning RESULT 2.0 into "単に情報を増やして
  縦長RESULTにしない." Merging two already-substantial phases into one screen, even while
  removing some elements (score bars likely demoted/removed per section 7), needs an actual
  measured layout pass on a real 390×844 viewport before considering any slice "done" — this
  audit is code-only and did not render or measure the page.
- **Translation-layer scope creep.** Section 4's rich signal set (per-topping placement
  similarity, per-axis sauce similarity, etc.) is tempting to expose in full; the task explicitly
  does not want the underlying formula shown. A feedback-line generator needs a firm rule for
  "which one signal per side (good/improve) wins," or it risks reintroducing the same
  "score/metrics dominate the screen" problem in prose form instead of bars.
- **PR #68 overlap risk (bake visuals).** PR #68, still open, touches `BakeOverlay.tsx`,
  `PizzaStage.tsx`'s bake-visual rendering, and `App.css`'s bake-related classes — none of which
  this audit assumes or depends on. A future RESULT 2.0 implementation slice touching
  `PizzaStage.tsx`'s bake-state rendering (e.g., for the perfect-glow persistence fix in section
  3) should re-check PR #68's merge status first, since a rebase against unmerged, unrelated
  bake-visual changes could otherwise create unnecessary conflict.

---

## Verdict

**B. READY — MULTIPLE SLICES.**

The state/data model this needs (Scoring 2.0 components across all 7 recipes, Pitz credit,
BEST/Dex, the persistent player pizza) is already fully built and already correct — nothing here
is blocked on new scoring/formula/save-schema work. What RESULT 2.0 actually requires is
primarily a **UI/reducer restructuring** (collapsing two existing phases into one screen while
preserving an exactly-once side-effect guarantee) plus **one genuinely new piece of logic** (the
internal-metric → player-facing feedback-line translation layer, section 4/9 slice 3), both of
which are scoped and sequenceable as independent slices per section 9. No slice here depends on
Cooking Time or on PR #68 landing first.
