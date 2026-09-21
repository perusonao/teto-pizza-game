# TETO Pizza Cutting 1.0 — Phase 4 Human Feel / Activation Fresh Audit

**Scope: Fresh Audit / Human Feel Gate / Design only.** No production code, no CUT-activation
change, no scoring change, no Firebase change, no save-schema change. This is a docs-only
deliverable, per this task's own explicit instruction.

**Audited `origin/main` SHA:** `24cee828664e4ac34aa806157f3c8df69c02b8d1` — "feat: Pizza Cutting
1.0 Phase 3 evaluation and result feedback (#132)". Re-confirmed via `git fetch origin` at session
start; this branch (`claude/pizza-cutting-phase4-audit-2pyh0c`) was created directly at that tip
(`git merge-base HEAD origin/main` == `git rev-parse origin/main` == `git rev-parse HEAD`), so
every finding below is read from that exact tree, not carried forward from the prior three
reports' own text.

**SSOT authority:** `docs/design/TETO_PIZZA-CUTTING_1.0.md` (Fresh Design), and the three merged
Result Reports (`..._1.0_Fresh-Design_Result.md`, `..._Phase2_Result.md`, `..._Phase3_Result.md`).
All four were read in full before writing this document. Nothing below re-derives or re-decides
anything those documents already settled (gesture choice, geometry approach, score formula,
Completion Gate policy, save-schema boundary) — this audit's only job is the Human Feel Gate the
design doc's own §16 requires before any further CUT phase, plus the rollout-decision surface
(§13/§18) that gate feeds into.

---

## 0. Fresh Sync

- `git fetch origin` at session start. `origin/main` at `24cee828…` — matches the SHA carried
  forward from prior sessions' own notes; GitHub state re-confirmed as authority, not assumed.
- **Open PRs:** #133 (Player Profile 1.0 Phase 1B, ranking display-name snapshot, Issue #129) —
  unrelated to Pizza Cutting, **not read into or built on by this task**, not merged, not pushed
  to. #105 (draft, Dev Automation), #72/#46/#34/#3 (stale/superseded docs or design audits,
  pre-dating the current roadmap by a wide margin per the repo's own
  `TETO_ROADMAP-SSOT_FRESH-SYNC_2026-09-18.md`). **No open PR touches Pizza Cutting/CUT/POST_BAKE
  scope.**
- **PR #132 (Phase 3) merge state:** confirmed **MERGED**, squash commit `24cee828…`, matching
  `origin/main` HEAD exactly (not the stale `24cee828664e4ac34aa806157f3c8df69c02b8d1` figure
  handed down from prior context — re-verified fresh, and it happens to agree).
- **PR #133 state:** **OPEN**, not merged, unrelated branch (`claude/ranking-display-name-snapshot-brclvx`).
  This task does not touch it, build on it, or merge it.

## 1. Duplicate Gate

`git branch -a` (full remote branch list) + `search_issues`/`search_pull_requests` for
"cutting"/"Pizza Cutting" across the repo: **zero results** beyond the four already-merged Pizza
Cutting phase branches (`pizza-cutting-phase0-v7hwm2`, `-phase1-geometry-oja36m`,
`-phase-2-d36vrn`, `-phase3-p43ntr`, all already merged into `main` via #123/#126/#128/#132) and
this task's own newly created branch. **No existing Phase 4 / Human Feel / Activation-expansion
Issue, PR, branch, or doc exists.** Clear to proceed as a genuinely fresh audit, not a duplicate.

## 2. Authority read (full, before any evaluation)

`docs/design/TETO_PIZZA-CUTTING_1.0.md` (all 22 sections), `..._1.0_Fresh-Design_Result.md`,
`..._Phase2_Result.md`, `..._Phase3_Result.md` (all in full) — plus current code:
`src/logic/cut/{types,geometry,evaluation,state}.ts`, `src/state/gameReducer.ts` (CUT cases),
`src/screens/GameScreen.tsx`, `src/components/ResultPanel.tsx`, `src/components/PizzaStage.tsx`
(CUT gesture branch), `src/data/cookingProfiles.ts`, `src/data/recipes.ts` (all 15 entries),
`src/logic/completionGate.ts` (confirmed: no `CUT` reference, gate unaffected), `src/state/
persistence.ts` (confirmed: no `cutState`/`CUT` reference, save schema unaffected). Phase 2/3
report screenshots (`docs/reports/screenshots/pizza-cutting-phase{2,3}/`) reviewed for continuity
before capturing this audit's own fresh set.

## 3. Current contract — from code, not from memory of prior reports

Confirmed directly against the audited SHA (every figure below is a live read, not carried
forward):

| Item | Current value | Source |
|---|---|---|
| CUT-enabled recipes | **1 of 15** — `margherita` only | `src/data/cookingProfiles.ts:61-69` |
| `requestedSliceCount` | 6 (only value shipped; 4/8 are typed but unused) | same file, `cutConfig: { requestedSliceCount: 6 }` |
| CUT position in flow | `BAKE → POST_BAKE(CUT) → RESULT`; 14 other recipes skip `POST_BAKE` entirely (byte-identical `BAKE → RESULT`) | `cookingProfiles.ts` `postBakeSteps`/`isPostBakeStep` |
| Gesture | Edge-to-edge drag, clamped to rim-to-rim chord on both ends (`buildRimToRimCutLine`); reuses `PizzaStage`'s existing pointer-capture dispatch (4th branch) | `src/components/PizzaStage.tsx` |
| Drag-vs-tap threshold | `DRAG_THRESHOLD_PX = 10` (existing, unchanged, shared with DOUGH/sauce/topping) | `PizzaStage.tsx` |
| Undo | Last-cut-only, one "↩ 1本戻す" button | `PizzaStage.tsx` / `GameScreen.tsx` |
| Cut limit | `requiredCutCount + 2` = 5 attempts for 6 slices | `PizzaStage.tsx` |
| Minimum-angular-separation gate | **Still absent** (Phase 2's own flagged, unresolved limitation — a near-duplicate line is geometrically handled but not rejected pre-commit) | confirmed unchanged in current `PizzaStage.tsx` |
| Guide | Full-opacity angle guide + center dot, fades 3.6s→7.2s (`GUIDE_FADE_START_S`/`GUIDE_FADE_END_S`, reused `bakeGuideFade.ts` curve), restarts every CUT (re-)entry | `GameScreen.tsx` |
| Evaluation weights | `countCorrectness 0.20 / completeness 0.20 / centerAccuracy 0.10 / uniformity 0.50` — **byte-identical to design doc §6 Option B**, confirmed by reading `CUT_SCORE_WEIGHTS` directly | `src/logic/cut/evaluation.ts:35-40` |
| Geometry | Deterministic 96×96 grid sampling (`GRID_RESOLUTION = 96`) | `src/logic/cut/geometry.ts:33` |
| RESULT UI | `.cut-evaluation-summary` card (✂️ カット N点 / N等分 / 均等さ・中心・切り分け rows), renders only when `cutEvaluation` is non-null | `src/components/ResultPanel.tsx:269-295` |
| Lunch Rush behavior | CUT active identically to FREE (no second timer, no CUT-specific carve-out); `MissionServePanel` does **not** show the CUT card (confirmed live, §5 below) | `src/mission/*`, confirmed by browser walkthrough |
| non-CUT recipe behavior | Zero observable difference — `POST_BAKE` skipped, no CUT card, no 切り終わる button, ever | confirmed by browser walkthrough (funghi) |
| Scoring 2.0 integration | `cutScore` **never** added to `state.score.total`/`ScoringV2Result` — standalone display only (design §14 Option D, unchanged) | `src/logic/cut/*` has zero imports into `scoringV2`/`completionGate`/`pitzReward` |
| Save schema | Untouched — `cutState` never serialized, `CURRENT_SCHEMA_VERSION` unchanged | `src/state/persistence.ts` (no `CUT` reference) |
| Completion Gate | `requiredForCompletion: false` for CUT (structural — CUT is not even named in `completionGate.ts`) | confirmed by grep, zero matches |

All of this matches the design doc and the three Result Reports' own claims exactly — **no drift
found between documentation and shipped code.** This audit did not need to correct any prior
report.

## 4. Real browser play

Dev server (`npm run dev`) + a standalone Playwright script (Chromium at `/opt/pw-browsers`, no
download), at **390×844** (authority) and **360×800** (secondary), covering all three required
scenarios. Screenshots saved to
`docs/reports/screenshots/pizza-cutting-phase4-audit/` (24 images, both viewports).

**FREE — margherita, full walkthrough:** HOME → Pizza Select → margherita → PREPARE (DOUGH →
SAUCE → CHEESE → TOPPING) → BAKE (needle guided into the perfect zone, confirmed) → 取り出す！ →
POST_BAKE/CUT (3 real edge-to-edge pointer drags at 0°/60°/120°, mirroring a careful player) →
切り終わる → RESULT.
- Guide (dashed angle lines + center dot) visible at CUT start (`05-cut-start.png`), still
  partially visible at 1 line (`06-cut-1line.png` — guide and the one committed solid line are
  simultaneously legible, good contrast).
- Progress readout advances 0/3→1/3→2/3→3/3; CTA lit orange exactly at 3/3
  (`07-cut-3lines-ready.png`).
- Cutter icon (🔪) renders, offset above the drag path, never occluded by the (synthetic) pointer.
- RESULT (`08-result.png`) shows the CUT card correctly, alongside the existing ★/score/Pitz
  blocks — see §11 for the specific juxtaposition finding this surfaced.
- **Zero console/page errors, zero horizontal overflow at either viewport** — asserted
  programmatically (`scrollWidth <= clientWidth`) and confirmed visually.

**FREE — funghi, non-CUT regression:** after margherita's RESULT, `別のピザを作る` → paged to
funghi (index 5, `RECIPES` order) → PREPARE → BAKE → 取り出す！ → **RESULT directly**, zero
`POST_BAKE`. Confirmed: `.cut-evaluation-summary` count **0**, `切り終わる` button **never
appeared**, no overflow, no console errors, at both viewports (`09-noncut-funghi-result.png`).
Byte-identical to the Phase 3 report's own funghi finding — no regression introduced by anything
merged since.

**Lunch Rush — margherita CUT:** HOME → ランチラッシュ → スタート → ピザを作る！ → PREPARE → BAKE
→ 取り出す！ → **POST_BAKE/CUT appears inside a live Mission run** (`11-lunchrush-cut.png` — the
countdown clock, `⏱ 2:58`, visible and ticking above the CUT instruction card) → 3 drags →
切り終わる → `MissionServePanel` (`12-lunchrush-serve.png` — ★★☆☆☆ 59点, +1 SERVED, 次の注文へ;
**no CUT card here**, confirmed, see §11). No console errors, no overflow, at either viewport.

**Summary (both viewports):** `console/page errors: NONE`, `horizontal overflow: none`,
non-CUT funghi `cutSummaryCount: 0` / `cutButtonAppeared: false`, Lunch Rush
`cutButtonAppeared: true`, `missionServePanelPresent: true`. This is a genuinely fresh,
independent re-run of the same scenario class Phase 2/3 already verified — it found no new defect
and no regression, which is itself the useful confirmation before evaluating feel (§5 onward).

## 5. Human Feel Gate — the four scored dimensions (design doc §16, this task's §4)

### A. 理解しやすさ (understandability) — **Good**

The instruction row ("ピザを6等分に切ろう！") plus the always-visible progress readout ("N / 3
本") together make the goal and remaining work unambiguous within the first second of entering
CUT — no different from how DOUGH/SAUCE/TOPPING already teach themselves in this game. The
full-opacity guide at CUT start (dashed diameters + center dot) answers "where do I drag" without
being told in words. One real gap: **the guide never explains "drag from one edge to the opposite
edge"** in text or iconography — a first-time player who has only ever tapped/dragged locally
(DOUGH stretch, sauce paint, topping placement) has no explicit cue that CUT wants a full
rim-to-rim sweep rather than a local mark. The generous start-tolerance (press anywhere inside the
dough, not just the rim, per design §2.2) makes this forgiving in practice — a short/local drag
just clamps to whatever chord it implies — but the *first* attempt's mental model still has to be
inferred from the dashed guide lines alone.

### B. 操作感 (feel) — **Good, with one open risk**

The drag itself reuses this game's already-proven pointer-capture architecture (same one DOUGH/
sauce/topping already use), so it inherits that family's already-validated smoothness — no new
risk there. The permanent, dark, 2px committed line reads clearly against the raw/perfect/burnt
crust backgrounds in every screenshot captured. The one specific concern flagged in the design doc
and never resolved through Phase 2/3: **no minimum-angular-separation duplicate-line gate**
(§3 table above) — a player who redraws a near-identical line (e.g., correcting a slightly
off-angle first attempt by dragging almost the same path again) gets two overlapping committed
lines that visually read as one but consume one of the 5 allowed attempts and produce a
numerically-tiny sliver piece the uniformity score then penalizes. This is exactly the scenario
the design doc's own §21 flagged as Human-Feel-tunable and never tuned. **Recommendation: fix in
Phase 4A** (§16 below) — this is a small, well-scoped constant addition, not a redesign.

### C. 難易度 (difficulty) — **Roughly right, weight distribution matches stated intent**

Uniformity-heavy weighting (50%) is confirmed live: a careful player's 100-point ideal cut
(`08-result.png`) is achievable but requires all three lines to actually cross near center at even
spacing — not a free 100 for "any 3 lines." At 300px/6-wedge spacing (60° per wedge), the wedges
are wide enough that a real thumb has comfortable room to aim, matching the design's own §3.1
forgiveness analysis for 6 slices specifically. No hard evidence surfaced in this audit that 6
slices is currently too easy or too hard — this needs a data point this Fresh Audit cannot
generate on its own (a human, not a scripted "ideal" drag, actually playing it) — see §16's
recommendation to collect that before widening rollout.

### D. Feedback — **Good in FREE, real gap in Lunch Rush**

Committed lines are unambiguous (permanent, dark, exactly where dragged). The RESULT card
(`✂️ カット 100点` / `6等分` / `均等さ・中心・切り分け`) is legible, uses only natural-language
labels (confirmed: no raw `uniformity`/`centerAccuracy`/`completeness` string anywhere in the
rendered DOM), and sits in a sensible position (after Pitz credit, before the collapsible detailed
breakdown) — matching the Phase 3 report's own claim exactly. **The gap:** Lunch Rush's own
`MissionServePanel` (`12-lunchrush-serve.png`) shows **no CUT feedback whatsoever** — a player who
just drew a perfect 6-way cut inside a live Mission timer gets literally zero visible
acknowledgement of that specific skill, only the pizza's already-existing ★/score. This was
already named as a known limitation in the Phase 3 report (§11, "Mission's own RESULT surface was
left untouched, matching scope discipline") — this audit confirms it live and elevates it from "a
scope note" to "a real Human Feel asymmetry" now that Lunch Rush rollout is the live question this
phase exists to answer (§6).

### E. Retry desire (やり直したくなるか) — **Plausible yes, not directly testable by a scripted audit**

The undo affordance (last-cut-only) plus generous 5-attempt slack gives a bad first cut a cheap
recovery path, which is the mechanical precondition for "want to try again" rather than "feels
like a wasted attempt." What this audit's own scripted "ideal" drags cannot answer is whether a
genuinely imprecise human drag *feels* fun to correct — that is exactly the kind of finding only a
real human playtest (not a script driving perfect chords) can produce, and none has been run yet
for CUT specifically (Phase 2/3's own browser verification, and this audit's, both drive
idealized drags). **Flagged as the one item this Fresh Audit cannot close on its own** — see §16.

## 6. Lunch Rush Tempo — Fresh evaluation

Confirmed live (§4): CUT costs real wall-clock seconds against the single `MissionClock` budget,
exactly as designed (no second timer). This audit's own scripted drags completed CUT in
~0.8 seconds (three fast synthetic drags); a real player doing three deliberate, aimed drags is
realistically **3–8 seconds** per the design doc's own estimate (§13), which was never verified
against real timing data before now — this audit is the first to actually watch the Mission clock
tick through a CUT step (`2:58` at CUT start → `2:57` at serve, in the scripted run; a real
player's window would be wider but still a small single-digit-second slice of a 180-second run).

Comparing the five options this task names:

| Option | Assessment |
|---|---|
| **A. CUT required in both FREE and Lunch Rush** | Current shipped behavior. Architecturally free (already the case — Mission is "a thin outer wrapper", design §13). Human Feel risk: §5D's feedback gap (no RESULT card in Mission) means the *cost* (a few seconds, a live-timer interaction) is paid every order but the *reward* (seeing your cut score) is never shown in the mode that actually charges for it. This is the one real mismatch in the current design. |
| **B. FREE only, Lunch Rush skips CUT** | Would need `CookingProfile` to somehow vary by mode — a real architectural change (profiles are keyed by `recipeId` only, design §13), contradicting the "no CUT-specific exception state machine" principle §1 of the design doc already committed to. Rejected for the same reason the original design rejected it implicitly. |
| **C. Simplified CUT in Lunch Rush** (fewer lines, no undo, etc.) | New, mode-conditional CUT behavior — meaningfully more code than A, and splits CUT's own evaluation logic into two behaviors to separately verify/tune. Not justified by anything this audit found (the ~3-8s cost is small relative to 180s, and the real problem — §5D's feedback gap — has a much cheaper fix than a second CUT variant). |
| **D. Only specific/bonus orders require CUT** | Requires a new `Order.requiredCutPieces?`-style field — already named as a *future*, separately-scoped item in the design doc's own §18 roadmap ("Lunch Rush CUT order-conditions... a real Lunch Rush CUT rollout" — explicitly downstream of Scoring 3.0). Premature before even one recipe's CUT tempo has real human playtest data. |
| **E. Other** | — |

**Recommendation: keep Option A (CUT active identically in FREE and Lunch Rush) — but treat §5D's
feedback gap as the actual Phase 4 fix, not the tempo itself.** The tempo cost is small and
architecturally already correct; the missing acknowledgement in `MissionServePanel` is the real,
inexpensive, well-scoped problem worth fixing before considering any broader Lunch Rush CUT
rollout. This reframes the task brief's own concern ("is CUT's tempo good for Lunch Rush") into a
sharper, evidence-backed one: **the tempo is probably fine; the feedback isn't**, and that's a
smaller fix than any of B/C/D would require.

## 7. CUT score review (current weights — no change proposed)

Confirmed live against `src/logic/cut/evaluation.ts:35-40`: `countCorrectness 0.20 / completeness
0.20 / centerAccuracy 0.10 / uniformity 0.50` — matches the task's own "existing assumption"
exactly, current code is authoritative and unchanged.

Human Feel observations (not a tuning proposal — flagged for a future Phase 5 slice per the
task's own instruction):
- **100 is achievable but not trivial** — this audit's scripted "ideal" drag (through-center,
  evenly spaced) reached exactly 100, as expected; a plausible small real-world imprecision (a
  chord a few percent off-center, wedges within ~10% of ideal area) would land visibly below 100
  under this weighting, since uniformity alone is half the score and directly penalizes area
  deviation. This looks calibrated to the brief's own request that uniformity dominate.
- **A visually "good-looking" cut and a numerically good `uniformity` should correlate** by
  construction (grid-sampled area, not a cosmetic proxy) — no case surfaced in this audit where a
  visually clean-looking cut scored low or a visually messy one scored high, but this audit's own
  drags were all near-ideal; a genuinely adversarial/sloppy human drag was not exercised (§5E's
  same limitation).
- **`centerAccuracy` at only 10% weight** means a line that's visibly off-center but still lands
  three roughly-even wedges scores only a small centerAccuracy penalty, dominated by uniformity.
  This matches the design's own §6 rationale (center/count "mostly add redundant information on
  top of uniformity") — this audit found no evidence contradicting that reasoning, only that it
  has never been checked against a real (non-scripted) off-center attempt.
- **No case produces the specific "high score, ugly cut" or "low score, pretty cut" inversion**
  the task asks about, in the scenarios this audit could actually drive (scripted geometry, not a
  human's actual imprecision) — this remains the one thing only real playtest data can close.

**No weight change is proposed.** Flagged for a possible Phase 5 tuning slice only if real human
playtest (§16) surfaces one of the two inversions above.

## 8. Slice count future

Confirmed: only `requestedSliceCount: 6` is shipped (margherita); the `4 | 6 | 8` type already
supports the other two with zero geometry/scoring/gesture changes (design §3.2, unchanged,
re-confirmed against current `CutConfig` type). This audit's own recommendation, evaluating the
three framings the task poses:

- **Difficulty-tier framing (easy→4, normal→6, hard→8):** No difficulty concept exists anywhere
  else in this game today (confirmed — the design doc's own §8.2 guide-visibility table already
  rejected "difficulty setting" as scope creep for the same reason). Introducing one *only* for
  slice count would be a new, standalone concept invented for CUT alone — not recommended as the
  first use of slice-count variation.
  8-slice weight, matching "the classic real-world pizza slice count" the design doc already
  named as 6's own selling point (design §3.1). **Recommended direction, not built now:**
  slice count as a per-recipe *authenticity* choice (a real pizza's own conventional cut count),
  not a difficulty dial — e.g., a thin/large-format pizza might authentically suit 8, a
  smaller/richer one 4. This is consistent with the existing per-recipe `CutConfig` shape and adds
  no new concept, only new data values on recipes CUT eventually activates on.
- **Per-order framing (Lunch Rush "6等分で！" requests):** already the design doc's own §18 future
  row ("Lunch Rush CUT order-conditions"), explicitly downstream of a real Lunch Rush CUT rollout
  decision and Scoring 3.0. Not ready to pursue before this Phase 4's own verdict (§15) picks a
  rollout direction.

**Recommendation: do not activate 4 or 8 in this phase (per the task's own instruction) or design
their rollout further until at least one more real recipe has shipped CUT at 6 slices with real
playtest data** — repeating the same "ship the narrowest thing first" discipline the original
design doc already used to justify shipping 6-only in Phase 1.

## 9. Recipe activation matrix (all 15 shipped recipes)

All 15 recipes in `src/data/recipes.ts` render as the same round-dough model (`PizzaStage`'s one
circular dough geometry) — there is no rectangular/calzone/stuffed-crust recipe shipped today, so
every recipe is mechanically CUT-compatible with zero new geometry. Classification uses the
task's own A/B/C/D taxonomy (A = CUT natural, B = possible but lower priority, C = a different
finish operation fits better, D = CUT unnecessary):

| Recipe | Real-world serving convention | Classification |
|---|---|---|
| **margherita** | Wedge-sliced | **A** — already CUT-enabled |
| **marinara** | Wedge-sliced (no cheese, still a classic round pizza) | **A** |
| **quattro-formaggi** | Wedge-sliced | **A** |
| **genovese** | Wedge-sliced | **A** |
| **bismarck** | Wedge-sliced (egg yolk in the center makes a clean wedge cut a genuine skill moment — cutting through/around the yolk is a nice real-world echo of this game's own center-accuracy signal) | **A**, arguably the strongest *second* CUT candidate after margherita for exactly this reason |
| **funghi** | Wedge-sliced | **A** |
| **fugazza** | Real-world Argentine fugazza is traditionally cut into squares/strips, not wedges — but this game models it as the same round dough as every other recipe (no rectangular variant exists), so in-game it is mechanically identical to any other round pizza | **B** — culturally a squares-cut pizza, but the game has no squares-cut mechanic to offer it; wedge CUT would be "correct for the game," not "correct for the dish" |
| **salsiccia** | Wedge-sliced | **A** |
| **pepperoni** | Wedge-sliced | **A** |
| **napoletana** | Wedge-sliced | **A** |
| **tonno-e-cipolla** | Wedge-sliced | **A** |
| **pizza-bianca** | Real-world Roman pizza bianca is often cut into rectangular strips (like `pizza al taglio`), not wedges — same in-game caveat as fugazza | **B** |
| **breakfast-pizza** | Individually-portioned in many real serving styles (egg/bacon personal pizza) — a "whole, uncut" serving is at least as authentic as a sliced one | **B/D borderline** — no strong reason to prioritize, no strong reason to exclude |
| **capricciosa** | Wedge-sliced | **A** |
| **meat-lovers** | Wedge-sliced | **A** |

**No recipe in the current 15 clearly belongs in C** (a different finish operation, e.g. FOLD/
SEAL/EDGE_FILL) — none of the shipped recipes are calzones or stuffed-crust pizzas; those remain
purely hypothetical future recipes per §10 below. **11 of 15 are clean category A**, 3 are B
(fugazza/pizza-bianca/breakfast-pizza — real-world cut convention differs, but the game's own
round-dough model makes wedge-CUT the only mechanically available option for them today anyway),
and 0 are C or D. This is a wide, low-risk activation surface *whenever* rollout is decided — not
evidence for rushing it (§15/§17 still govern timing), just evidence that "which recipes" is not
itself a hard design problem once "should we roll out further" is answered yes.

## 10. Cooking Steps integration — Fresh Audit of the architecture fit

`src/data/cookingProfiles.ts`'s `COOKING_PROFILES` map has exactly **one** entry (margherita) as
of this audited SHA — no FOLD/SEAL/EDGE_FILL/FINISH profile has been built yet for any recipe.
The task's own "ideal future flows" (normal / finish-required / calzone / stuffed-crust) remain
entirely aspirational against the current recipe catalog — none of the 15 shipped recipes are
calzones or stuffed-crust pizzas (confirmed, §9). The architecture itself (`CookingProfile.steps`,
`isPostBakeStep`, `preBakeSteps`/`postBakeSteps`) is already fully general enough to encode every
one of the task's four example flows with zero further engine work — this was the Cooking Steps
SSOT's own design intent (Phase 1A, already merged) and this audit found nothing in the current
CUT-specific code that narrows or special-cases that generality. **Finding: the architecture
already supports the task's aspirational flows; nothing here needs auditing further until a real
calzone/stuffed-crust recipe is actually proposed** — mechanically adding CUT to every recipe is
correctly *not* happening (only 1 of 15 carries it), consistent with the task's own "CUTを全レシピ
へ機械的に追加しない" instruction.

## 11. RESULT UX — Fresh evaluation of the Phase 3 CUT card

Confirmed live (`08-result.png`): the CUT card renders below the existing ★/score/Pitz blocks,
using natural-language labels, in a position that doesn't require scrolling at either viewport.
**The one concrete confusion risk this audit found, live, not hypothetically:** margherita's own
scripted-ideal round produced `✂️ カット 100点` directly above a headline of `★★☆☆☆ 59点` — a
perfect cut sitting right next to a middling overall score, with **no visual or textual
relationship drawn between the two** (no "カットは総合点に影響しません" note, nothing explaining
why a 100-point action didn't move a 59-point total). This is exactly the scenario the task's own
§11 names as a risk, now confirmed to actually occur under ordinary play (this round's low overall
score came from placement/ingredient-purity factors entirely unrelated to CUT, not a contrived
edge case).

**Recommendation for a future Phase 5 polish slice (not built here):** a single short clarifying
line near the CUT card — something to the effect of "カットの出来栄えは今回のスコアに含まれてい
ません" (cutting quality isn't part of this round's score yet) — would resolve the ambiguity
cheaply, without touching the score formula itself (§12 below governs whether/when that changes).
This is a copy-only change, low risk, and directly answerable without a design decision.

## 12. Scoring 3.0 decision — Fresh evaluation, not decided here

Comparing the five candidates against what this audit actually found:

| Option | Assessment |
|---|---|
| **A. Permanently standalone** | Simplest, safest, but leaves §11's confusion risk unresolved forever — a "100 CUT, 59 total" pairing would always look like a bug to a first-time player. |
| **B. Added into total score** | Rejected by the original design (§14) for the same reason still true today: the day CUT activates broadly, every recipe's *existing* score composition changes at once — a bigger blast radius than the formula change itself. This audit found nothing to overturn that reasoning. |
| **C. Quality multiplier** | Would make CUT's *own* quality bend the *other* components' payout — a genuinely new mechanic (nothing in this codebase's Scoring 2.0 does this today) with real design cost, not evaluated further here. |
| **D. Bonus score** | This is the SSOT's own already-designed §10 core+bonus mechanism (additive, clamped-to-100) — the lowest-engineering-cost integration path, and the one the original CUT design doc already earmarked as the eventual destination (§14 Option D → "a later Scoring 3.0 slice"). |
| **E. Recipe-specific score component** | Would require re-deriving Scoring 2.0's own weight table per-recipe — large scope, no evidence in this audit that CUT's importance actually varies enough by recipe to justify it. |

**This audit's recommendation, consistent with (not overriding) the original design: keep
standalone through Phase 4 (Option A in practice today), with Option D (the SSOT's existing
core+bonus mechanism) as the pre-designated eventual target** — no new comparison is needed later,
the mechanism already exists on paper. **Data needed before flipping it on:** real Human Feel
playtest data (§16) confirming CUT quality is a skill players actually want reflected in their
score, and a rollout decision on how many recipes carry CUT (§17) — both still open. **Not
decided or scheduled here** — this section only organizes what a future decision needs, per the
task's own instruction.

## 13. Accessibility / mobile

- **Touch target sizing:** CUT's own CTA/undo buttons reuse `.cta-button`/`.secondary-button`
  sizing verbatim (confirmed in `GameScreen.tsx`) — no smaller-than-established tap target
  introduced, consistent with every other bottom bar in this game.
- **Finger occlusion:** the 🔪 cutter icon offset above the fingertip (confirmed visually,
  `06-cut-1line.png`) keeps the icon visible during a real (larger-than-mouse) touch contact area,
  not just a mouse pointer — this was designed for touch specifically (design §8.3) and reads
  correctly in the captured screenshots.
- **Left/right-handed:** the gesture has no inherent handedness bias (any drag direction/start
  point works identically, confirmed by `isInsideDough`'s omnidirectional gate) — no finding here.
- **Line visibility/contrast:** committed lines are dark and solid against all three crust
  backgrounds; not independently re-verified against raw/burnt bake states in this audit's own
  screenshots (only the "perfect" bake state was walked through) — **flagged as an unverified gap
  requiring a Phase 4A check**, not a finding this audit can currently confirm or deny.
- **`prefers-reduced-motion`:** CUT ships no animation at all today (the piece-separation visual is
  still deferred, per §8.3 of the design doc, unchanged in this audit) — nothing to respect or
  violate yet, consistent with the design's own §8.5.
- **Small screen (360×800):** confirmed, no overflow, layout identical in structure to 390×844
  (`07-cut-3lines-ready.png` at both sizes) — no accessibility regression at the secondary
  viewport.
- **Accidental touch:** the existing `DRAG_THRESHOLD_PX` tap-rejection (shared with every other
  gesture family) already covers this; no CUT-specific incident surfaced.

## 14. Performance

`GRID_RESOLUTION = 96` confirmed unchanged (`src/logic/cut/geometry.ts:33`) — ~7,000-7,500 sampled
points, each checked against at most 4 lines, "well under a millisecond" per the original design's
own estimate. This audit's own browser walkthrough observed **no visible lag** during drag,
confirm, or the RESULT transition at either viewport, on the sandbox's own Chromium — consistent
with, not contradicting, the original estimate. **Not independently re-benchmarked on a real
device** in this audit (no such device available to this session) — flagged as unverified on real
hardware, same caveat the Phase 2/3 reports themselves carried. No optimization work is proposed
or needed based on anything found here.

## 15. Phase 4 Verdict

### **B — READY WITH SMALL POLISH**

Reasoning:

- **Correctness bar (design doc §15) is fully met** — nothing in this audit's fresh code read or
  fresh browser walkthrough found a regression, a drift from documented behavior, or a broken
  contract anywhere in the shipped CUT feature. Weights, geometry, gating, save/scoring isolation
  all match the SSOT exactly.
- **Human Feel bar (design doc §16) is mostly met**, with two concrete, narrow, already-scoped
  gaps found by this audit specifically (not carried forward as vague risk from prior reports):
  1. No minimum-angular-separation duplicate-line gate (§5B) — a real, if minor, feel rough edge.
  2. Lunch Rush's `MissionServePanel` shows zero CUT feedback (§5D/§6) — the sharpest concrete
     finding this audit produced, because it reframes the task's own Lunch Rush tempo question
     from "is the time cost too high" (probably not, §6) to "is the payoff visible" (currently
     no).
- **Neither gap is a "rework" (D) or "needs tuning before expansion" (C) scale problem** — both are
  small, additive, already-isolated fixes (a gesture-layer constant; a RESULT-surface prop wire)
  that don't touch geometry, scoring formula, or the gesture architecture itself. That is
  specifically what makes this **B, not C**: the mechanic itself doesn't need re-tuning, two
  concrete surface gaps do.
- **Not A (ready for broader activation as-is)** because activating CUT on more of the 11
  Category-A recipes (§9) before fixing the Lunch Rush feedback gap would multiply exactly that
  gap across every CUT-enabled recipe's own Lunch Rush rotation, for no offsetting benefit — the
  fix is cheap enough that there's no reason to ship the gap wider first.
- **One thing this audit could not close and flags honestly rather than guessing:** §5E (real
  retry-desire) and §5C (is 6 actually well-calibrated) both need a genuine human playtest, not a
  scripted "ideal drag" Playwright walkthrough — this audit's own browser verification, like Phase
  2/3's before it, only ever drove idealized geometry. This is named as the one open item Phase 4A
  should close before any further recipe activation, not glossed over.

## 16. Next Phase Plan

| Slice | Scope | Est. size |
|---|---|---|
| **Phase 4A — CUT gesture/feedback polish** | (1) Add the minimum-angular-separation duplicate-line rejection (§5B) — a single new gesture-layer constant + reducer guard, mirrors the existing `DRAG_THRESHOLD_PX` pattern. (2) Wire `cutEvaluation` into a compact Lunch Rush-appropriate feedback surface on `MissionServePanel` (§5D/§6/§15) — read the already-computed `state.cutState.evaluation`, no new evaluation logic. (3) A short RESULT-card clarifying line addressing §11's score-juxtaposition confusion (copy-only). | ~2-3h |
| **Phase 4B — Real human playtest** | A genuine (non-scripted) human playtest pass on a real or real-shaped touch device, targeting exactly §5C (is 6-slice difficulty calibrated) and §5E (does a bad cut invite retry) — the two things this and every prior CUT audit could not verify with an idealized Playwright script. Feed findings back into Phase 5 tuning candidates (§7) only if something concrete surfaces. | ~2-3h |
| **Phase 4C — Recipe activation batch 1** | Activate CUT (`cutConfig: { requestedSliceCount: 6 }`) on 2-3 more Category-A recipes from §9 (bismarck is the strongest second candidate — its center-yolk detail gives center-accuracy real in-fiction meaning) with the same regression discipline Phase 2 already proved out (`walkPostBakeToResult` helper, exhaustive non-activated-recipe pinning). Depends on 4A being merged first (no point widening the Lunch Rush feedback gap before fixing it). | ~2-3h |
| **Phase 5 (future, separately scoped)** | CUT scoring tuning, only if 4B's playtest surfaces a concrete weight/threshold issue (§7). Not scheduled by this audit — a conditional future slice, not a committed one. |
| **Scoring 3.0 (future, separately scoped)** | Flip on the SSOT's existing core+bonus mechanism for CUT (§12 Option D), once enough recipes carry CUT and 4B's playtest data exists to inform how it should weigh in. Not started, not scheduled here. |

## 17. Priority — should CUT development continue right now?

Comparing against the other active/parallel tracks visible in current repo state (branch names,
open PRs, and `docs/PROJECT_HANDOFF.md`'s own history): Player Profile 1.0 (PR #133 currently
open, Phase 1B), Firebase Ranking (merged, ongoing operational track), Recipe Expansion 2.0 (a
named design doc, `TETO_RECIPE-EXPANSION-20.md`, exists but no open PR), and a wide set of other
named branches (Dex/progression, visual polish, Pizza Select navigation, ingredient economy) that
appear to be exploratory or stale rather than actively landing right now (per the roadmap sync
doc's own caution about distinguishing active work from abandoned branches without direct
evidence).

**This audit's own recommendation: continue CUT into Phase 4A only, then pause CUT-specific
development** (not abandon it — pause it) after 4A/4B land, rather than immediately proceeding
into 4C's recipe-activation batch or Scoring 3.0. Reasoning:
- **4A is cheap and closes real, already-identified gaps** (§15) — worth finishing regardless of
  what else the team prioritizes next, since leaving a known duplicate-line rough edge and a
  Lunch Rush feedback blind spot in a *shipped* mechanic (margherita's CUT is live in production
  today, not behind a flag) has an ongoing small cost every time a player encounters it.
- **4B (real human playtest) is the one thing no further code-writing phase can substitute for.**
  Continuing to widen CUT's rollout (4C) without it means repeating the same "verified only by an
  idealized script" gap three phases in a row.
- **Beyond 4A/4B, CUT is not self-evidently the single highest-priority track** — it is one
  feature among several active tracks (Player Profile has an open PR right now; Firebase/Ranking
  is a live operational surface), and this audit found no evidence (usage data, player complaints,
  or a business goal stated anywhere in-repo) that CUT specifically is blocking or is more urgent
  than those. **Recommendation: after 4A/4B, the next-track decision should be made explicitly by
  whoever owns cross-track prioritization, not defaulted into by CUT's own momentum** — this
  audit's job is to make that decision informed, not to make it.

## 18-21. Deliverables / Issue / Validation / PR

- **This document is the deliverable** (`docs/reports/TETO_PIZZA-CUTTING_Phase4_Human-Feel_Fresh-Audit.md`).
  No change to `docs/design/TETO_PIZZA-CUTTING_1.0.md` — nothing in this audit found the SSOT
  itself to be wrong or stale; every claim it makes was re-confirmed against current code (§3),
  so no correction was needed.
- **Issue:** no existing Pizza Cutting Issue was found to attach this to (§1) — no new Issue opened
  either, per the task's own "don't proliferate Issues" instruction; this report stands alone,
  linkable from a future Phase 4A/4B PR's own description.
- **Validation performed:** `git status`/`git diff --stat` — confirms only this report + the new
  screenshots directory are added, zero `src/`/test/config file touched, zero Firebase file
  touched, zero workflow file touched, zero save-schema file touched. Every file path cited above
  was read directly in this session (not assumed from a prior report). Live browser walkthrough at
  both authority and secondary viewports, zero console errors, zero overflow (§4). No
  `npm test`/build run was required by this task's own docs-only validation list, and none was
  run (production code is unmodified, so the existing suite's status is unaffected by this task).
- **PR:** opened from `origin/main` HEAD (`24cee828…`), branch
  `claude/pizza-cutting-phase4-audit-2pyh0c`, base `main`, left **OPEN** for independent review per
  this task's own instruction. Not merged. Auto-merge not enabled.
