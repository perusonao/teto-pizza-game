# Teto Pizza Game — RESULT 2.0 Slice 2 Player Feedback Preflight

**Type:** Audit/spec only. No production code or test changes in this session. Docs-only PR,
not to be merged to `main`. Read-only investigation of fresh `origin/main`.

- **Audited `origin/main` SHA:** `aaf56edaea533f9efc63b3ba623bf1ae8425a6b5`
  (`M3A Bake Judgment: fading bake guide + continuous bake visuals (#68)`). Confirmed via
  `git fetch origin main`; this session's branch
  (`claude/teto-slice2-feedback-audit-l0kzbq`) sits exactly at this SHA (`git merge-base HEAD
  origin/main` == the SHA above, zero diff). **PR #68 is now MERGED** (it was still open as of
  the prior `TETO_RESULT-2_Fresh-Audit.md`, audited SHA `27818ef`) — this audit supersedes that
  one's PR #68-overlap caveat; everything below is read from the merged state.
- **Scope:** this is a narrower, deeper follow-up to `TETO_RESULT-2_Fresh-Audit.md` section 4
  ("Scoring feedback possibilities") and section 9 slice 3 ("Feedback-line translation layer").
  That audit already established the high-level shape; this document verifies it against the
  actual current code for all 7 recipes, works out concrete thresholds/selection rules/sample
  copy, and gives a final go/no-go verdict specifically for implementing that one slice.
- **RESULT 1/DISCOVERED merge (Slice 1):** not read, not assumed, not depended on. This document
  treats `ScoringV2Result` as the sole input contract for a future feedback module — whether it
  is called from today's two-phase `ResultPanel`/`DISCOVERED` split or from a future merged
  screen does not change anything below. No Slice 1 branch was touched or inspected.

---

## 1. Scoring 2.0 available metrics (verified against current source)

Single entry point: `computeScoringV2(recipe, pizza)` in `src/logic/scoringV2/index.ts`, called
exactly once per round from `gameReducer.ts`'s `CONFIRM_BAKE`, result stored at
`state.scoringV2Result` and passed down to `GameScreen.tsx`. Weights (`SCORING_V2_RULESET_VERSION
= "phase-4a-2-shadow-3"`): **Sauce 52 / Pieces 16 / Recipe 12 / Bake 20** (sum 100).

| Component | File | Fields available today (all already computed, already reach the client) |
|---|---|---|
| **Sauce** | `src/logic/scoringV2/sauceComponent.ts` | `quantitySimilarity`, `coverageSimilarity`, `evennessScore`, `edgeScore` (all 0–1, already gated to near-0 when essentially no sauce was applied via `presenceGate`), `score` (0–100 weighted 30/30/20/20) |
| **Pieces** | `src/logic/scoringV2/piecesComponent.ts` | `groups: PieceGroupScoreV2[]`, one per required topping type, each with `ingredientId`, `targetCount`, `playerCount`, `quantitySimilarity` (0–1), `placementSimilarity` (0–1 or `null` if nothing placed), `score` (0–100, weighted 30/70 quantity/placement) |
| **Recipe** | `src/logic/scoringV2/recipeComponent.ts` | `requiredTypesPresent`/`requiredTypesTotal` (counts, not ids), `usedTypesTotal`, `extraTypesCount` (count, not ids), `purityMultiplier` (0–1), `score` (0–100) |
| **Bake** | `src/logic/scoringV2/bakeComponent.ts` | `bakeResult` (raw gauge value or `null`), `bakeState` (`"raw"｜"perfect"｜"burnt"`, from `classifyBake`), `distanceFromIdeal` (≥0, units of the gauge), `similarity` (0–1, symmetric nearest-edge falloff), `score` (0–100) |

All four components are real, non-placeholder data for every one of the 7 shipped recipes today
(confirmed fresh in section 2) — none of this is gated behind further scoring/reference work.
`ScoringV2Result.available` can only be `false` if a recipe has no Reference fixture at all (not
true for any of the 7) or if authored Reference/recipe data itself fails strict validation
(never true for real authored data, only a fail-closed guard against malformed input) — a
feedback module can treat `available === false` as the same "nothing to say" fallback the debug
panel already uses (`ScoringV2DebugPanel.tsx`), not a case worth designing new copy for.

## 2. All 7 recipes — Reference-fixture coverage (fresh re-confirmation)

`src/data/referencePizza.ts`'s `REFERENCE_PIZZAS` map has exactly one entry per `RECIPES` id in
`src/data/recipes.ts`, cross-checked directly, both ways:

| Recipe | Sauce-type required ingredient | Piece-group required ingredients (= `pieceGroups` entries) | Bake target |
|---|---|---|---|
| margherita | tomato-sauce | mozzarella (×3 target), basil (×2 target) | 60–80 |
| marinara | tomato-sauce | garlic (×3), oregano (×2) | 45–65 |
| quattro-formaggi | olive-oil | mozzarella (×2), gorgonzola (×2), parmigiano (×2), fontina (×2) | 65–85 |
| genovese | pesto | mozzarella (×2), cherry-tomato (×3) | 50–70 |
| bismarck | tomato-sauce | mozzarella (×3), egg (×1) | 55–75 |
| funghi | tomato-sauce | mozzarella (×2), mushroom (×3) | 58–78 |
| fugazza | olive-oil | onion (×4), oregano (×1) | 63–83 |

**Fresh structural finding (not in the prior audit, load-bearing for section 5 below):** for
every one of the 7 recipes, `recipe.requiredIngredients` decomposes cleanly into **exactly one
sauce-type ingredient** (tomato-sauce / olive-oil / pesto — never itself a `pieceGroups` entry)
**plus N topping-type ingredients that are a 1:1 match with that recipe's own `pieceGroups`
entries** (verified by diffing `RECIPES[i].requiredIngredients` ingredient ids against
`REFERENCE_PIZZAS.get(id).pieceGroups` ingredient ids for all 7 — zero exceptions, zero extra or
missing entries either direction). This is not a coincidence the code enforces (nothing type-
checks it), but it is true today for all 7 authored recipes, and it is exactly the structural
property section 5's "which ingredient" elimination logic depends on — flagged as a **soft
invariant** in section 11's risks (an 8th recipe authored without a matching `pieceGroups` entry
for one of its toppings would silently break the "name the missing ingredient" elimination, not
crash — see that section).

Every `ReferenceSauce.quantity`/`.coverage` target is mechanically derived from the same shared
"ideal fixture" geometry (`computeMechanicalSauceReference`, `buildIdealSauceFixture`) regardless
of recipe — the numeric sauce target is identical across all 7 recipes today (only
`ingredientId` differs). Consequence for feedback design: **Sauce thresholds/messages can be
fully recipe-agnostic** — there is no per-recipe Sauce calibration difference to account for
(see "recipe差" callout in section 4).

## 3. Bake: under / good / over is already directly determined, not score-inferred

Verified in `src/logic/bake.ts`:

```ts
export type BakeState = "raw" | "perfect" | "burnt";
export function classifyBake(value: number, target: BakeTarget): BakeState {
  if (value < target.start) return "raw";
  if (value > target.end) return "burnt";
  return "perfect";
}
```

`BakeComponentV2Available.bakeState` already carries this exact categorical value — a feedback
module reads `bakeState` directly (`"raw"` → underbaked message, `"burnt"` → overbaked message,
`"perfect"` → no Bake concern) and **never** infers direction from `score`/`similarity` alone,
satisfying the task's explicit "don't decide 焼き不足 just because the score is low" instruction
by construction. `distanceFromIdeal` (raw units) and `similarity` (0–1, symmetric falloff from
either edge) are available for **magnitude** wording only ("ちょっと" vs "だいぶ"), never for
direction — direction is always `bakeState`.

## 4. Sauce metrics — free-boundary integration check

Re-confirmed against `TETO_SAUCE-FREE-BOUNDARY_Result.md` (PR #66, merged): that slice changed
only `PizzaStage`'s heatmap **render** path (`isCellVisible`), and explicitly did not touch
`computeSauceMetrics`/`scoreSauceComponentV2`/`evaluateSauceForPlayer` — confirmed again here by
reading `sauceComponent.ts` fresh (no reference to `doughShape` or any free-boundary concept
anywhere in it). **Scoring 2.0's Sauce component is fully unaffected by the free-boundary
change** — the metrics this preflight builds feedback on (`quantitySimilarity`,
`coverageSimilarity`, `evennessScore`, `edgeScore`) are exactly the same primitive whether the
player's dough is stretched, shrunk, or default-circular. No new Sauce signal exists from that
merge and none is needed — the existing four metrics are sufficient (see section 5).

## 5. Proposed feedback model

### 5.1 Two-level selection: which **component**, then which **sub-metric**

Each component already has a single authoritative `.score` (0–100). Rather than comparing raw
sub-metrics against each other directly across components (an apples-to-oranges comparison —
e.g. Sauce's `edgeScore` vs. Recipe's `purityMultiplier` are not naturally on the same footing
even though both are 0–1), the model works in two passes:

**Pass 1 — classify each of the 4 components as GOOD / NEUTRAL / IMPROVE**, using one
representative value per component:

| Component | "Good" representative | "Improve" representative |
|---|---|---|
| Sauce | `sauce.score` | `sauce.score` |
| Pieces | **best**-scoring required group's `.score` | **worst**-scoring required group's `.score` |
| Recipe | `recipe.score` | `recipe.score` |
| Bake | `bake.similarity * 100` — **but only reachable for GOOD when `bakeState === "perfect"`** | forced into IMPROVE whenever `bakeState !== "perfect"`, regardless of `similarity` magnitude (direction already known — see section 3) |

Pieces deliberately uses different representatives per side (best group for "was there anything
worth praising", worst group for "what to fix") rather than the `PiecesComponentV2.score`
aggregate, so one badly-placed topping among several well-placed ones is never averaged away
(matches the task's own worry about "毎回4要素を並べない" generic bars hiding the one thing that
matters).

**Thresholds** (0–100 scale, matching every component's own already-published `.score` units —
no new unit conversion):

- `GOOD_THRESHOLD = 85` — score ≥ 85 is eligible for a "よかったところ" line.
- `IMPROVE_THRESHOLD = 60` — score < 60 is eligible for a "次はここ" line.
- 60–85 is **neutral** — says nothing about that component either way (this is the band that
  keeps the feedback from feeling like it grades every axis every time; a "fine, unremarkable"
  Sauce score should not force a sentence into existence).
- Bake is the one exception to pure score-thresholding, exactly per section 3: `bakeState`
  decides eligibility, magnitude (`similarity`) only decides phrasing strength within that.

**Mutual exclusivity rule:** a component already picked for IMPROVE is removed from the GOOD
candidate pool for that same round, even if some other sub-metric of that same component (e.g.
Sauce `edgeScore`) individually clears 85 while `sauce.score` overall is below 60. Reasoning:
telling a player "your sauce edge was great, but also fix your sauce" in the same breath is
confusing, not clarifying — when a component is the round's headline problem, it does not also
get to be a headline compliment. (This can only actually arise for Sauce, whose 4 sub-metrics
can diverge; Pieces/Recipe/Bake's single representative number makes the conflict structurally
impossible for them.)

**Pass 2 — within a chosen component, pick the specific sub-metric/phrase** using a fixed,
documented priority order (this is what makes the "same tie every time" deterministic):

| Component | Sub-metric priority order (highest first) | Rationale |
|---|---|---|
| Sauce | coverage → edge → evenness → quantity | Coverage ("did you cover the dough") is the most legible-to-a-player concept; edge is already player-facing today via `sauceEvaluation.ts`'s ふち tier so its wording has precedent; evenness next; quantity last (hardest for a player to self-assess visually — "too little/much sauce overall" is the least actionable framing standing alone) |
| Pieces | placement → quantity | Matches the component's own internal weighting (70/30) |
| Recipe | presence (missing/insufficient required type) → purity (extra ingredient) | A missing requirement is always more important to name than a stray extra one |
| Bake | direction is fixed by `bakeState`; magnitude uses `similarity`/`distanceFromIdeal` for "ちょっと" vs "だいぶ" wording only | N/A — no ambiguity to break |

### 5.2 Cross-component selection (which component wins when several qualify)

If more than one component clears `GOOD_THRESHOLD` (max 2 shown) or, in principle, more than one
clears `IMPROVE_THRESHOLD` (max 1 shown — see task's "次はここ is 1 line in principle"), rank the
qualifying components by their **scoring weight**, heaviest first: **Sauce (52) → Bake (20) →
Pieces (16) → Recipe (12)**. This is not an arbitrary new ranking — it reuses the exact weight
ordering `computeScoringV2` already uses to build `totalScore`, so "the thing RESULT 2.0 tells
you mattered most" is always consistent with "the thing that actually moved your score most."

- **よかったところ:** take up to 2 GOOD-eligible components in weight order. If only 1 qualifies,
  show 1. If 0 qualify (a genuinely rough round), show **zero** "よかったところ" lines rather
  than fabricate one — see the fallback text in section 5.4, not a forced compliment.
- **次はここ:** take exactly the top 1 IMPROVE-eligible component in weight order. If 0 qualify
  (every component ≥ 60, i.e. a solid all-around round with nothing glaring), show **zero**
  "次はここ" lines — a round with nothing below 60 anywhere has nothing honest and specific to
  ask the player to fix; see section 5.4 for what replaces it.
- Never show the same component on both sides in the same round (guaranteed by the mutual
  exclusivity rule in 5.1).

### 5.3 "Which ingredient" — Recipe/Pieces naming, without any scoring API change

The task explicitly asks whether Recipe's low-score cause (missing / extra / wrong-count
ingredient) can be **specifically** identified, and says not to guess if it can't. Verified
finding, using the structural 1:1 correspondence from section 2:

- **Missing/insufficient required topping** (e.g. "モッツァレラが足りなかったかも"): read
  directly off `PiecesComponentV2.groups[i].playerCount` vs. `.targetCount` for that
  `ingredientId` — already itemized per group, no aggregation loss, no API change needed. This
  is also literally the section 5.1/5.2 Pieces "improve" pick, so it never needs to be
  separately re-derived — Pieces' own selected sub-metric *is* the specific ingredient.
- **Missing the recipe's one sauce-type ingredient** (e.g. "ソースを塗るのを忘れてない？"): not
  itself itemized by `RecipeComponentV2` (which only reports an aggregate
  `requiredTypesPresent`/`requiredTypesTotal` count) — **but derivable without any scoring
  change**, by elimination: `sauceTypePresent = requiredTypesPresent − (count of this recipe's
  piece-group ingredients with `playerCount ≥ 1`)`. Because section 2 confirmed every recipe has
  *exactly one* non-piece-group required ingredient, this elimination always resolves to exactly
  0 or 1, and that one ingredient's `nameJa` is already known statically from
  `recipe.requiredIngredients` minus the piece-group ids (no data is fabricated — the identity of
  "the sauce ingredient this recipe requires" is authored, static data, same source `dialogue.ts`
  and the reference popover already read). This is pure composition logic in the new feedback
  module, not a change to `recipeComponent.ts`.
- **Extra/wrong ingredient** (e.g. "レシピにない材料が混ざっているみたい"): **not** specifically
  identifiable today. `RecipeComponentV2.extraTypesCount` is a count only; `PiecesComponentV2`
  never sees an ingredient it has no Reference group for, so an off-recipe topping is invisible
  to it entirely, and `pizza.sauceIds`/toppings' raw ids are not exposed on `ScoringV2Result` at
  all (by design — components report derived similarity, not raw player state). **This is the
  one genuine gap** — see section 9's verdict discussion. The task's own principle ("原因を特定
  できない場合は断定的なmessageを作らない") is the correct answer here: use a deliberately
  generic phrase that names *that* something extra was used without claiming to know *what*
  (sample copy in 5.5). This does not block Slice 2; it only means the "extra ingredient" case
  can never be as specific as the "missing ingredient" case with today's contract.
- **Wrong count of a present ingredient** (too many/too few of a required topping): already
  fully covered by `PieceGroupScoreV2.playerCount` vs. `.targetCount` — direction (too few / too
  many) and magnitude both read directly off the two counts, no inference needed.

### 5.4 Fallback text (no signal clears any threshold, or data genuinely unavailable)

- **No component clears `GOOD_THRESHOLD`:** omit the "よかったところ" line entirely. Do not
  synthesize a compliment from a component that merely isn't the worst one.
- **No component clears `IMPROVE_THRESHOLD`:** show one neutral encouragement line instead of a
  forced critique — e.g. "全体的にバランスよく作れてるよ！" (sample only, Human Feel to confirm
  tone) — never invent a improvement point that isn't real.
- **`ScoringV2Result.available === false`** (only possible for a malformed-Reference edge case,
  never for real play on any of the 7 shipped recipes today): the feedback module returns "no
  feedback" (both lines omitted), exactly mirroring how `ResultPanel` already omits its Sauce row
  when `sauceScore` is `null` — an established, reviewed pattern in this codebase, not a new one.
- **Pieces group with `placementSimilarity === null`** (nothing of that ingredient placed at
  all): treat as a strong IMPROVE signal for "place some Xs" wording (not "improve your
  placement" wording, since there is nothing placed to critique the placement *of*) —
  `quantitySimilarity` alone (which will itself be low, since `playerCount = 0`) is what actually
  drives this candidate's score in that case; no special-case branch needed beyond picking the
  right phrase template for `playerCount === 0` vs. `playerCount > 0`.

### 5.5 Sample messages (illustrative — final copy is a Human Feel / voice decision, not this
audit's to lock in)

**よかったところ** (max 2, one per eligible component, weight order):

| Component | Sub-metric | Sample |
|---|---|---|
| Sauce | coverage high | 「ソースが生地全体にきれいに広がってるよ！」 |
| Sauce | edge high | 「ふちまで気をつけて塗れてる、いい感じ！」 |
| Sauce | evenness high | 「ソースのムラがなくて均一だね！」 |
| Bake | perfect | 「焼き加減はばっちり、ちょうどいいタイミングだったね！」 |
| Pieces | placement high (named ingredient) | 「{ingredientNameJa}の位置、お手本にすごく近いよ！」 |
| Recipe | purity/presence full | 「必要な材料がぜんぶそろってる、レシピどおりだ！」 |

**次はここ** (max 1):

| Component | Sub-metric | Sample |
|---|---|---|
| Sauce | coverage low | 「ソースが届いてないところがあるよ。もう少し広げてみよう」 |
| Sauce | edge low | 「ソースがふちの外まで出ちゃってるかも。もう少し内側を意識してみよう」 |
| Sauce | evenness low | 「ソースにムラがあるみたい。もう少しまんべんなく塗ってみよう」 |
| Sauce | quantity low/high | 「ソースの量、お手本と少し違うかも」 |
| Bake | raw, mild | 「ちょっと早く出しすぎたかも」 |
| Bake | raw, strong | 「まだ生っぽいところがありそう。もう少し焼いてみよう」 |
| Bake | burnt, mild | 「少し焼きすぎたみたい」 |
| Bake | burnt, strong | 「だいぶ焦げちゃったかも。次はもう少し早めに取り出そう」 |
| Pieces | quantity low (named ingredient) | 「{ingredientNameJa}がもう少しあるとよさそう」 |
| Pieces | quantity 0 (named ingredient) | 「{ingredientNameJa}を置くのを忘れてないかな？」 |
| Pieces | placement low (named ingredient) | 「{ingredientNameJa}の位置、もう少しお手本に近づけてみよう」 |
| Recipe | missing sauce-type ingredient (named, via 5.3 elimination) | 「{sauceIngredientNameJa}を塗るのを忘れてないかな？」 |
| Recipe | purity low (generic, per 5.3's gap) | 「レシピにない材料が少し混ざっているかも」 |

**Neutral fallback** (section 5.4): 「全体的にバランスよく作れてるよ！」

## 6. Bake under/good/over mapping (summary table, backed by section 3)

| `bakeState` | Feedback eligibility | Direction word | Magnitude source |
|---|---|---|---|
| `"raw"` | IMPROVE only, never GOOD | 「もう少し焼こう」系 | `distanceFromIdeal`/`similarity` picks mild vs. strong phrasing |
| `"perfect"` | GOOD only (when it's the round's selected GOOD component), never IMPROVE | 「ちょうどいい」系 | n/a |
| `"burnt"` | IMPROVE only, never GOOD | 「焼きすぎ」系 | `distanceFromIdeal`/`similarity` picks mild vs. strong phrasing |
| `bakeResult === null` (not yet baked — should not reach RESULT in practice) | excluded from both pools | — | `score` is already 0 in this case; excluding by `bakeState === null` check, not by score, keeps the "don't infer from score" rule uniform |

## 7. Architecture / file scope proposal (not implemented this session)

**New pure module:** `src/logic/resultFeedback.ts` (+ `src/logic/resultFeedback.test.ts`),
mirroring `src/data/dialogue.ts`'s existing authored-variant-line pattern and
`src/logic/scoringV2/toLegacyScoreBreakdown.ts`'s existing "pure adapter over `ScoringV2Result`"
pattern — placed in `src/logic/` (not inside `src/logic/scoringV2/` itself) because it is a
presentation-adjacent translation layer built *on top of* Scoring 2.0's authoritative output, not
a scoring component with its own weight/authority.

Proposed signature:

```ts
export interface ResultFeedbackLine {
  id: string;            // stable id, e.g. "sauce.coverage.low" — for tests/telemetry, never shown
  textJa: string;
}

export interface ResultFeedback {
  good: readonly ResultFeedbackLine[];    // 0-2 entries
  improve: ResultFeedbackLine | null;     // 0-1 entry
}

export function deriveResultFeedback(
  recipe: Recipe,
  result: ScoringV2Result,
): ResultFeedback
```

Taking `recipe` (already available at every call site — `state.recipe`) alongside `result`
(`state.scoringV2Result`) is required for section 5.3's ingredient-name lookups
(`recipe.requiredIngredients`, cross-referenced against `result.components.pieces.groups`) and
for `INGREDIENTS`'s `nameJa` lookup (`src/data/ingredients.ts`) — no new state field, no reducer
change, no new data file.

**Call site:** `GameScreen.tsx`, alongside the existing `sauceScore` computation
(`state.phase === "RESULT" && state.score && !isMissionActive` branch, same guard
`ResultPanel` already uses) — computed the same way, passed down as new props, e.g.
`<ResultPanel ... feedback={deriveResultFeedback(state.recipe, state.scoringV2Result)} />` (or
computed once in `GameScreen` and passed as a already-derived `ResultFeedback` object — either
is fine, this is a pure function of already-available data, safe to call on every render).

**Explicitly out of scope for this module** (per the task's "no UI, no production code this
session" and to keep this slice's own blast radius small):

- No `ResultPanel.tsx` layout change is proposed or required here — this preflight is about the
  translation function's contract, not where/how it renders. Section 9 slice 3 of the Fresh
  Audit already scoped the layout question as a separate slice.
- No change to `computeScoringV2`, any of its 4 component files, or `ScoringV2Result`'s type —
  section 5.3 established every message this model proposes is buildable from what already
  exists, except the one flagged extra-ingredient-naming gap (section 9).
- No character-voice decision (whether these lines are Teto/Blue-voiced like `dialogue.ts`, or a
  distinct neutral "coach" voice) — flagged as a Human Feel question in section 10, not decided
  here; the sample copy in 5.5 is deliberately voice-neutral so it can go either way.

## 8. Tests (proposed scope, not implemented)

Mirroring `dialogue.ts`'s own lack of dedicated tests would be a mistake here — this module's
selection *logic* (which component wins, tie-breaks, mutual exclusivity) is exactly the kind of
thing that silently regresses under a future scoring-weight tune. Proposed `resultFeedback.test.ts`
cases (pure unit tests, no rendering, constructing `ScoringV2Result` fixtures directly the same
way `scoringV2.test.ts` already does):

- One representative "good" pick per component (4 cases) — asserts both the component chosen and
  the specific sub-metric phrase.
- One representative "improve" pick per component (4 cases), including both `bakeState: "raw"`
  and `bakeState: "burnt"` as separate cases (2, not 1) since section 3/6 treats them as
  genuinely distinct branches, not a shared "bad bake" case.
- Tie-break determinism: two components both ≥ 85 (or both < 60) → asserts the heavier-weighted
  one wins, per section 5.2's fixed order.
- Mutual exclusivity: a fixture where Sauce's `edgeScore` is high but `sauce.score` overall is
  <60 → asserts Sauce appears only in `improve`, never in `good`.
- Section 5.3's elimination logic: a fixture with all piece groups fully present but the sauce-
  type ingredient's presence excluded → asserts the *named* sauce ingredient's `nameJa` appears
  in the improve line (one fixture per recipe's own sauce ingredient — 7 cases, cheap and
  guards the "1:1 structural invariant" from section 2/11 directly).
- Both "no good" and "no improve" fallback cases (section 5.4).
- `ScoringV2Result.available === false` → both lines empty, no throw.
- A `PieceGroupScoreV2` with `placementSimilarity: null` / `playerCount: 0` → asserts the
  "forgot to place any" phrasing branch, not the "improve your placement" one.

Existing suites this module must not perturb (regression-only, not new assertions): none —
this is a purely additive, purely-consuming module with zero write access to `GameState`, so it
cannot regress `gameReducer`/Dex/Pitz/Mission tests by construction, unlike Slice 1's reducer-
merge risk.

## 9. Verdict-relevant gap analysis

Only one concrete gap was found across all 7 recipes / 4 components (repeated from 5.3 for
visibility): **specifically naming an extra/off-recipe ingredient is not possible with today's
`ScoringV2Result` contract** (`RecipeComponentV2.extraTypesCount` is a count, not a list of ids).
Everything else the task asked to verify — Bake direction, all 4 recipes' worth of Sauce metrics
under the free-boundary change, all 7 recipes' Pieces/Recipe specificity including the missing-
ingredient case — is buildable today, verified against real source, not inferred from docs.

This gap does not block Slice 2: the task's own stated principle (never assert a specific cause
you cannot verify) is fully satisfiable today by using the generic fallback phrase in 5.5's last
row for exactly this one case, while every other message in the model can be fully specific. A
future, genuinely optional enhancement — adding `extraIngredientIds: readonly string[]` to
`RecipeComponentV2` (mirroring how `PieceGroupScoreV2` already exposes its own `ingredientId`) —
would let a *later* slice name the specific extra ingredient too, but is not required for this
slice to ship a correct, non-fabricating feedback layer.

## 10. Accessibility considerations

Extends the Fresh Audit's own already-flagged gap (section 11 of `TETO_RESULT-2_Fresh-Audit.md`:
no `aria-live` anywhere in RESULT/DISCOVERED today) rather than introducing a new one:

- The 2 new short text lines this slice adds are exactly the kind of dynamically-appearing
  content `aria-live="polite"` exists for — a screen-reader user hearing "score: 82" with no
  announcement of new qualitative text appearing would get strictly less information than a
  sighted player, widening the existing gap the Fresh Audit already flagged. This preflight does
  not implement it (no layout work this session) but any future implementation slice should wire
  the feedback container into the same live-region fix RESULT 2.0 already owes the rest of the
  screen, not treat it as a separate follow-up.
- Ingredient names interpolated into templates (`{ingredientNameJa}`) are always real Japanese
  words already used elsewhere in the UI (tray labels, `dialogue.ts` lines) — no risk of reading
  out an internal id/slug to an assistive-technology user, as long as the module always resolves
  through `INGREDIENTS`'s `nameJa` lookup and never falls back to a raw `ingredientId` string.
- Both lines are short, single-sentence, plain Japanese — no risk of a wall-of-text landmark
  problem, consistent with the task's own "短く、具体的で" instruction.

## 11. 390×844 space budget

Two single-line strings (`good` — 0 to 2 lines, `improve` — 0 or 1 line) is a small, bounded
addition, not the "情報を増やして縦長RESULTにする" failure mode the task explicitly warns
against — but it is still net-new vertical space on a screen the Fresh Audit already flagged as
unmeasured/potentially overflowing (section 2/11 of that report). Concretely:

- Worst case (2 good lines + 1 improve line, each wrapping to at most 2 lines of ~16px Japanese
  body text at 390px width): roughly 3 short paragraphs, comparable in height to one of today's
  `score-bar` rows plus its label — this slice is a plausible *net decrease* in vertical space if
  it replaces (rather than adds to) the 4 existing progress-bar rows per section 7 of the Fresh
  Audit's own layout proposal (item 5: "the 4 progress bars ... are candidates to be replaced or
  demoted, not kept verbatim"). This preflight does not decide that replacement — it only notes
  that the byte budget for 3 short sentences is small enough that the *net* effect depends
  entirely on whether the bars stay or go, which is a layout-slice decision, not this slice's.
- No new images/icons are proposed — plain text lines only, keeping the addition's own footprint
  minimal regardless of that later decision.
- Actual on-device measurement is out of scope for this read-only preflight (no Preview/video
  produced per the task's own instruction) — flagged as a risk in section 12, not resolved here.

## 12. Risks

- **Soft structural invariant (section 2).** The "exactly 1 sauce-type + N piece-group-matching
  toppings" property every recipe happens to have today is not type-enforced anywhere. If a
  future 8th recipe is authored with, say, two non-piece-group required ingredients (two sauces,
  or a required ingredient with no piece-group geometry at all), section 5.3's elimination logic
  for naming the missing sauce ingredient would silently degrade (resolve to an ambiguous count
  instead of exactly 0/1) rather than crash. Mitigation: the proposed test suite (section 8)
  should include an explicit assertion of this invariant (a test that fails loudly, not a
  runtime guard) so a future recipe addition that breaks it is caught at PR time, not silently
  shipped as a slightly-wrong feedback line.
- **Extra-ingredient naming gap (section 9).** Already covered above — mitigated by the generic
  fallback phrase, not blocking, but worth remembering as the one place this model is
  deliberately less specific than the others.
- **Threshold tuning has no Human Feel evidence yet.** `GOOD_THRESHOLD = 85`/`IMPROVE_THRESHOLD =
  60` (section 5.1) are this preflight's own proposed starting points, chosen to be
  conservative/legible (a clean 85/60/between-is-neutral split), not derived from playtesting —
  exactly the same "provisional, needs Human Feel" status the Fresh Audit already flagged for
  Pitz's reward bands. A future implementation slice should treat these as tunable constants in
  one place (this module), not hard-coded inline, so a Human Feel pass can adjust them without
  touching selection logic.
- **Voice/tone decision undecided (section 7/10).** Whether these lines are Teto/Blue character
  dialogue (reusing `dialogue.ts`'s exact pattern) or a distinct neutral "coach" voice is a real
  design decision this preflight deliberately does not make — the sample copy in 5.5 works
  either way, but the *module's own file location/exports* would differ slightly (e.g. whether it
  returns a `DialogueLine`-shaped value with a `speaker` field, or its own simpler shape as
  proposed in section 7). Flagged as a Human Feel/design question for whoever implements this
  slice, not a blocker to scoping it now.
- **390×844 net space effect is undetermined** until paired with the layout slice (section 11) —
  this preflight's own analysis is code-only, no on-device measurement.
- **Bake-badge redundancy.** `ResultPanel` already renders a separate 焼き加減 badge
  (raw/perfect/burnt icon + label) today, independent of this slice. If Bake also wins the
  "次はここ" slot in the same round, the player would see the doneness stated twice (badge +
  feedback line) in close proximity. Not a defect in the selection model itself (Bake winning
  the weight-order tie-break when it's genuinely the round's worst-scoring component is correct
  behavior), but a layout/copy overlap worth resolving explicitly in the implementation slice
  (e.g. by having the Bake "改善" line add texture/magnitude the badge doesn't already say,
  rather than restating "生焼け"/"焦げ" verbatim).

## 13. Implementation estimate

Consistent with `PROJECT_HANDOFF.md`'s own "Claude Code implementation tasks should generally
stay around 2–3 hours where practical" guidance:

- `resultFeedback.ts` + full test suite (section 8): **~1–1.5 hours** — pure function, no UI, no
  reducer change, the riskiest sub-part (section 5.3's elimination logic) is already fully
  worked out by this preflight, not left to be designed during implementation.
- Wiring into `GameScreen.tsx`/`ResultPanel.tsx` as new props, rendered as plain text (no new
  layout/positioning decisions, just inserted somewhere reasonable in the existing DOM order):
  **~30–45 minutes**.
- Typecheck/lint/build + full regression suite: **~15 minutes** (this module cannot touch
  `GameState`/reducer paths, so regression risk elsewhere is low, but the project's own
  Standard Completion Rule still requires the full pass).
- **Not included** (separate slices per the Fresh Audit's own section 9 sequencing, and per this
  task's explicit "no Preview/video needed" for a preflight): the HERO/layout reflow slice, the
  Preview deploy + 390×844 Review Playthrough + Human Feel pass a *player-facing* implementation
  PR would still owe per `PROJECT_HANDOFF.md`'s Standard Completion Rule (this preflight is
  exempt from that rule per its own "Audit-only tasks are exempt" clause, but a real
  implementation slice building on this spec is not).
- **Total for the translation-layer slice alone (not the layout slice):** roughly **2–2.5 hours**,
  fitting inside one normal session.

---

## Verdict

**A. READY.**

Every metric this feedback model needs — Sauce's 4 sub-metrics, per-topping Pieces
quantity/placement for all 7 recipes' full ingredient sets, Recipe's presence/purity counts, and
Bake's direct `bakeState` categorical direction — already exists on `ScoringV2Result` today, for
all 7 shipped recipes, unaffected by the merged Sauce Free Boundary or M3A Bake Judgment work.
The one identified gap (naming a specific extra/off-recipe ingredient) has a principled,
task-endorsed fallback (a deliberately generic phrase) rather than blocking implementation, and a
clearly-scoped optional future enhancement (`extraIngredientIds` on `RecipeComponentV2`) if a
later slice wants full symmetry with the missing-ingredient case. No Scoring 2.0 formula,
weight, Reference fixture, or type change is required to build `deriveResultFeedback` as
specified in section 7. The next step is a normal implementation session against this spec
(section 7's module + section 8's tests), independent of and not blocked by RESULT 2.0 Slice 1's
own reducer-merge work.
