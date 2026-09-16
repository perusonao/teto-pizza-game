# Phase 4A-2 Scoring 2.0 — Fresh Audit (Shadow Prototype, Pre-Implementation)

**Scope:** Issue #30 / SSOT #22. Read-only audit. No production code was changed by this
report. Nothing in this document alters the current 100-point score, Dex BEST, ★1–5,
totalStars, Mission, Pitz, Shop, unlock conditions, or save-v1 semantics.

## 0. Audited exact main SHA

```
a80698487bd4f56585a9a1572e0025d726631716  ("docs: no-op sync guard")
```

Fetched fresh from `origin/main` at audit time. This branch (`claude/phase-4a2-scoring-audit-33y3vx`)
was at this exact commit with a clean working tree before this report was written; the only
change in this branch is the addition of this report file.

---

## 1. Current architecture (as implemented, not as previously planned)

The game is a single `useReducer` state machine (`src/state/gameReducer.ts`) driving the
`ORDER → PREPARE → BAKE → RESULT → DISCOVERED` loop, wrapped by a thin, independent Mission
reducer (`src/mission/lunchRush.ts`) for Lunch Rush. Free play and Lunch Rush share the exact
same `GameState`/`PizzaState`/`gameReducer` machinery; Mission only adds a clock and a
per-run metrics tally on top.

Important: **most of the groundwork Issue #30 asks for already exists on main**, built during
Phase 4A-1A/4A-1B as explicitly shadow-only prototypes. This audit's main job is to map that
existing surface accurately rather than assume Phase 4A-2 starts from zero, per Issue #30's
own "do not assume the old Phase 4A-0 design still matches current main" instruction.

Already on main, all shadow-only, all Margherita-only, all gated out of Mission (see §7):

- `src/logic/sauceField.ts` — the 16×16 sauce density field and `computeSauceMetrics()`
  (quantity/coverage/evenness/overflow/edge), continuous and boundary-smooth by construction.
- `src/logic/sauceEvaluation.ts` — turns those metrics into player-facing ◎/○/× tiers and a
  single live message; reference-relative for coverage, absolute for evenness/edge.
- `src/logic/referenceMatching.ts` — a real Hungarian (Kuhn–Munkres) minimum-cost assignment
  between player toppings and reference positions, **already permutation-invariant by
  construction** (it is an assignment problem, not an indexed pairwise comparison), plus a
  smoothstep-based continuous `distanceSimilarity(distance, fullCreditRadius, zeroCreditRadius)`
  that is explicitly **not** exact-pixel matching.
- `src/logic/referenceScoring.ts` — `scoreSauceAgainstReference` (sauce quantity/coverage vs.
  reference) and `scorePiecesAgainstReference` (wraps the Hungarian matching per topping type).
- `src/data/referencePizza.ts` — `MARGHERITA_REFERENCE`: a target sauce quantity/coverage
  *derived from a literally-paintable fixture* (not hand-picked numbers — Codex Broad Review
  "Reachable Reference" fix), plus target mozzarella (3) / basil (2) positions with per-group
  matching radii.
- `src/components/SauceMetricsPanel.tsx` — renders the player-facing tiers always, and the raw
  numeric shadow metrics only behind `import.meta.env.VITE_PREVIEW_MODE`.

None of this is wired into `scorePizza` (`src/logic/scoring.ts`), Dex, Mission, or persistence.
Two independent regression suites (`src/state/phase4a1a.regression.test.ts`,
`src/state/phase4a1b.regression.test.ts`) pin exactly that boundary today.

**Consequence for Phase 4A-2:** this is much closer to "assemble a shadow score from existing,
already-reviewed primitives" than "design scoring from scratch." The primitives already satisfy
several of Issue #30's hard requirements (permutation invariance, no exact-pixel matching,
normalized-only quantity, boundary continuity). The real work is (a) generalizing what today is
Margherita-only/FREE-only into something that degrades safely elsewhere, and (b) combining the
existing per-metric numbers into one shadow `total`.

---

## 2. State / data contract map

### 2.1 Canonical pizza/game state (`src/state/pizzaState.ts`, `src/state/gameReducer.ts`)

```
PizzaState {
  sauceIds: string[]                // 0 or 1 entries; the applied sauce ingredient id
  sauceOrigin: { x, y } | null      // spread-animation origin, percent coords
  sauceToken: number                // bump counter for animation replay
  sauceDeposits: SauceDeposit[]     // { x, y, amount } — raw dispense log, see 2.2
  toppings: PlacedTopping[]         // { id, ingredientId, x, y } — percent coords
  bakeResult: number | null
}
```

`GameState` wraps one `PizzaState` plus `phase`, `order`, `recipe`, `score` (legacy
`ScoreBreakdown | null`), `bakeState`, `dex`, `ownedIngredientIds`, `pitzBalance`,
`lastClaimedMissionRunId`, `isMissionRound`, `justDiscovered`, `justGotNewBest`, `hint`,
`placement`. There is **one** canonical pizza per round; Scoring 2.0 has nothing new to model
here — it only needs read access to `PizzaState` + `Recipe` at the point `CONFIRM_BAKE` fires.

Coordinate space: 0–100 percent within the dough's own bounding box
(`src/logic/pizzaCoordinates.ts`). `DOUGH_CENTER = 50`, `DOUGH_RADIUS = 48`.
`isInsideDough(x, y)` is the one production containment check; toppings are already
constrained to it at placement time (`PLACE_TOPPING` rejects/adjusts via `findOpenSpot`).

### 2.2 Sauce 16×16 field + derived metrics (`src/logic/sauceField.ts`)

`SauceDeposit { x, y, amount }` — `amount` is a normalized internal unit in `[0, 1]`
(`SAUCE_RATE_PER_TICK = 0.02` per 50 ms tick, `SAUCE_MAX_QUANTITY = 1.0` hard cap — see
`src/logic/sauceQuantity.ts`). **There is no gram/ml claim anywhere in this pipeline**, which
already matches Issue #30's "no unsupported grams/ml" requirement without any change needed.

`computeSauceMetrics(deposits) -> SauceMetrics`:

| field | range | meaning |
|---|---|---|
| `quantity` | 0–1 | inside-dough-weighted sum of deposited amount |
| `coverage` | 0–1 | fraction of in-dough 16×16 cells touched (> `COVERAGE_THRESHOLD`) |
| `evenness` | 0–1 | 1 − stddev/worst-case-stddev for this exact total; self-normalized, no reference needed; **1 (neutral) when nothing deposited**, not 0 |
| `overflowAmount`/`overflowRatio` | ≥0 / 0–1 | amount landed outside `DOUGH_RADIUS` (48) |
| `edgeAmount`/`edgeRatio` | ≥0 / 0–1 | amount landed beyond `SAUCE_TARGET_RADIUS` (40) — a *stricter* rim-margin boundary than the dough edge; overflow is a subset of edge |

Every boundary (`insideDoughFraction`, `insideTargetFraction`) is computed via exact
circle–circle overlap area, continuous through the rim — a deposit a fraction of a percent
from a boundary shifts the split by a similarly small amount. This already satisfies the
"tolerant continuous scoring, no exact-pixel matching" requirement for the sauce side.

`computeSauceMetrics([])` returns `emptySauceMetrics()` — all zero except `evenness: 1`.
Never NaN/Infinity for empty input; see §8.

### 2.3 Mozzarella / basil physical placement state

Same `PlacedTopping[]` as any scatter-placed ingredient — no separate cheese/topping type.
`MIN_TOPPING_DISTANCE = 9` (percent units) enforced at placement time. Nothing distinguishes
mozzarella from basil structurally; only `ingredientId` does, and only
`ReferencePieceGroup.ingredientId: "mozzarella" | "basil"` (a type-level union, currently) picks
them out for reference matching.

### 2.4 Recipe / reference data

- `src/data/recipes.ts` — 7 recipes (`margherita, marinara, quattro-formaggi, genovese,
  bismarck, funghi, fugazza`), each with `requiredIngredients` (id + minCount, unordered) and
  a `bakeTarget` range. No quantity/placement target data lives here.
- `src/data/recipeSauceProfiles.ts` — one sauce ingredient + interaction kind
  (`"PAINT" | "PAINT_TEMPORARY"`) per recipe. `tomato-sauce` (margherita, marinara, bismarck,
  funghi), `pesto` (genovese), `olive-oil` (quattro-formaggi, fugazza — `PAINT_TEMPORARY`).
  **`COMMIT_SAUCE_DISPENSE` in the reducer validates against this profile for every recipe**,
  not just Margherita — the deposit-log mechanism (§2.2) is not structurally Margherita-only,
  even though only Margherita currently has anything reading it (see §7, P0-2 and §9, P1-3).
- `src/data/referencePizza.ts` — `getReferencePizza(recipeId)` returns a full
  `{ sauce: { quantity, coverage }, pieceGroups: [mozzarella, basil] }` target **only for
  `"margherita"`; every other recipe id returns `null`.** This is the single largest state/data
  contract gap Phase 4A-2 has to design around (see §7, P0-1).

### 2.5 Legacy scoring (`src/logic/scoring.ts`) — authoritative, must stay untouched

```
ScoreBreakdown {
  matchScore      // required-ingredient presence, 0-100, weight 35
  ingredientScore // "purity" (penalizes extras), 0-100, weight 15
  placementScore  // src/logic/placement.ts: containment + avg-pairwise-distance spread, 0-100, weight 20
  bakeScore       // distance from bakeTarget range, 0-100, weight 30
  total           // weighted sum, 0-100
  stars           // 1-5 via STAR_THRESHOLDS, capped to 4 if total>=90 but bake not "perfect"
}
```

Computed once, synchronously, inside `CONFIRM_BAKE`. Nothing here reads `sauceDeposits`,
`SauceMetrics`, or reference data — confirmed both by reading the code and by the existing
`phase4a1a.regression.test.ts` (`scorePizza` ignores `sauceDeposits` entirely, byte-for-byte).
`placementScore` is a **different, independent** metric from the "mozzarella/basil placement
quality" Scoring 2.0 is being asked to build — it only measures containment + average pairwise
spread, has no reference-position concept, and must not be confused with or replaced by
Scoring 2.0's placement components.

### 2.6 RESULT generation flow

`CONFIRM_BAKE` (action) → `scorePizza(recipe, pizza)` → `classifyBake` → `phase: "RESULT"`.
That's the entire authoritative path. `REGISTER_TO_DEX` (from RESULT) is the only place Dex
BEST/timesMade are ever written (`src/state/dex.ts`); `MISSION_NEXT_ORDER` does the same Dex
write and additionally skips straight past DISCOVERED for Mission pacing. Both are guarded to
only fire from `phase === "RESULT" && score !== null`, so a stray/duplicate dispatch can never
double-register a round — this is the same "reducer scope guard" pattern Scoring 2.0 should
reuse rather than reinvent.

### 2.7 Dex BEST / ★1–5 / totalStars

`src/state/dex.ts`: `registerScoreToDex` compares by `(stars, then total)`, monotonic
("BEST never goes down"). `src/logic/mastery.ts`: `totalStars(dex)` = sum of `bestStars` across
discovered recipes, derived fresh every time, never itself persisted. Both are pure functions
over `ScoreBreakdown`/`DexState` — a shadow score object has no natural insertion point here and
must not be given one during Phase 4A-2.

### 2.8 Mission scoring / Pitz / Shop

`src/logic/missionScoring.ts`: `missionScore = servedCount * 100 + totalQualityScore`, where
`totalQualityScore` is a running sum of each served pizza's *legacy* `ScoreBreakdown.total`.
`src/logic/economy.ts` (Pitz/Shop pricing — not fully re-read line-by-line this pass, but its
only call sites are `PURCHASE_INGREDIENT` and `CLAIM_MISSION_REWARD` in the reducer, both of
which are idempotent/guarded and touch only `pitzBalance`/`ownedIngredientIds`). Nothing here
has any hook for a second score; none should be added in Phase 4A-2.

### 2.9 save-v1 persistence (`src/state/persistence.ts`)

`PersistentSaveV1 { schemaVersion: 1, dex, pitzBalance, ownedIngredientIds, missionBest }`.
Field-by-field sanitization with a fresh-default fallback on anything unrecognized; per-entry
tolerance (one corrupt Dex entry doesn't erase the rest). **No field exists for any shadow/
Scoring 2.0 value**, and Issue #30 requires none be added. `phase4a1b.regression.test.ts`
already pins `Object.keys(createDefaultSave())` to the current 5 keys — any accidental new key
would be caught by that test today, which is a useful existing tripwire to keep green.

### 2.10 FREE mode vs. Lunch Rush

Both go through the identical `gameReducer`/`PizzaState`/`COMMIT_SAUCE_DISPENSE` path — Mission
is a wrapper, not a fork (`src/mission/lunchRush.ts`'s own header comment is explicit about
this). The one place they diverge for *shadow* purposes is App.tsx's own UI-level gate — see
§7.

### 2.11 Reset / stale-event safety

Already load-bearing and tested today, not something Phase 4A-2 needs to newly invent:

- `isValidSauceDeposit`/`isValidSauceDepositBatch` (`pizzaState.ts`) reject non-finite or
  ≤0 amounts, and reject a batch atomically (no partial application).
- `COMMIT_SAUCE_DISPENSE`'s reducer case independently re-validates phase, ingredient identity
  against the recipe's sauce profile, ownership, and the deposit batch — never trusts the UI.
- `MAX_TICKS_PER_STEP` (10) caps a single `computeDueTicks` call so a backgrounded/stalled tab
  can never deposit a huge burst on resume.
- `RESET_PIZZA` fully replaces `PizzaState` via `createEmptyPizza()` — no stale sauce/topping
  field can survive a reset.
- `PLACE_TOPPING`/`COMMIT_SAUCE_DISPENSE` both check `state.phase !== "PREPARE"` to reject a
  late commit from a gesture that outlived its phase (e.g., a drag finishing after BAKE started).

Any Scoring 2.0 computation added at `CONFIRM_BAKE` inherits this safety for free, since it
would read the same already-validated `PizzaState` the legacy scorer reads — there is no new
attack surface here as long as Scoring 2.0 doesn't add its own separate input path.

### 2.12 Preview/dev-only metrics gating

Single existing convention: `import.meta.env.VITE_PREVIEW_MODE`, statically false in a
production `vite build` (dead-code-eliminated), true only in the preview deploy pipeline
(`perusonao/teto-pizza-game-preview`). `SauceMetricsPanel.tsx` and `PreviewBadge.tsx` both use
it. Scoring 2.0's own debug surface should reuse this exact flag rather than invent a second
gating mechanism.

---

## 3. Existing metric inventory (what's already computable today, verbatim)

| Metric | Function | Output | Reference-relative? | FREE only? |
|---|---|---|---|---|
| Sauce quantity | `computeSauceMetrics().quantity` | 0–1 | no (raw) | no (structurally general, see §7) |
| Sauce coverage | `computeSauceMetrics().coverage` | 0–1 | no (raw) | no |
| Sauce evenness | `computeSauceMetrics().evenness` | 0–1 | no (self-normalized) | no |
| Sauce overflow | `computeSauceMetrics().overflowAmount/-Ratio` | ≥0 / 0–1 | no | no |
| Sauce edge (rim) | `computeSauceMetrics().edgeAmount/-Ratio` | ≥0 / 0–1 | no | no |
| Sauce vs. reference (quantity+coverage) | `scoreSauceAgainstReference` | 0–1 each + average | yes | **yes — needs `ReferenceSauce`, only exists for margherita** |
| Player-facing sauce tiers | `evaluateSauceForPlayer` | ◎/○/× ×3 | mixed (coverage relative, evenness/edge absolute) | yes (same reason) |
| Topping count match | `scorePieceGroup().quantitySimilarity` | 0–1 | yes | yes (needs `ReferencePieceGroup`) |
| Topping placement match | `scorePieceGroup().placementSimilarity` | 0–1 or null, Hungarian-matched | yes | yes |
| Legacy placement (unrelated) | `scorePlacement` | 0–100 | no | no — this is the authoritative one, do not reuse for Scoring 2.0 |

The gap is not "these metrics don't exist" — it's "they exist for one recipe, live only in a
`useMemo` gated off `!isMissionActive`, and have never been combined into a single weighted
total."

---

## 4. Scoring 2.0 proposed component model

Six components, each 0–100, each computed purely from `(recipe, PizzaState)` at `CONFIRM_BAKE`
time (i.e., from the final committed sauce/topping state — **not** the live-while-painting
preview `App.tsx` currently builds for Margherita FREE). A shadow score is a snapshot of the
*finished* pizza, mirroring how `scorePizza` itself only runs once, at `CONFIRM_BAKE`.

1. **Sauce quantity** — tolerant band around `reference.sauce.quantity`.
2. **Sauce coverage** — tolerant band around `reference.sauce.coverage`.
3. **Sauce evenness/concentration** — tolerant band around a target evenness (see §5.3).
4. **Rim overflow / edge control** — tolerant band around target edge ratio ≈ 0 (asymmetric:
   only "too much on/past the rim" is penalized; there's no such thing as "too little edge
   control").
5. **Mozzarella placement quality** — count similarity + Hungarian placement similarity vs.
   `pieceGroups[mozzarella]`.
6. **Basil placement quality** — same, vs. `pieceGroups[basil]`.

A recipe with `getReferencePizza(recipeId) === null` (i.e., every recipe but Margherita today)
produces **no shadow score at all** (`null`), not a fabricated/zeroed one — see §7, P0-1 and
§9 for why guessing a target for unaudited recipes is worse than abstaining.

---

## 5. Proposed formulas / normalization / tolerance

All six components reuse the same shape: a **tolerant band** function, generalizing the
already-reviewed `distanceSimilarity(distance, fullCreditRadius, zeroCreditRadius)` from
`referenceMatching.ts` (full credit inside `fullCreditRadius`, smoothstep falloff to 0 at
`zeroCreditRadius`, 0 beyond). Reusing it directly (it's already generic over "a distance") is
strongly preferred over writing a second, subtly-different band function.

```
component(value, target, tightTolerance, wideTolerance) =
  distanceSimilarity(|value - target|, tightTolerance, wideTolerance) * 100
```

### 5.1 Sauce quantity (component 1)

`value = metrics.quantity`, `target = reference.sauce.quantity`. Proposed
`tightTolerance ≈ 0.06`, `wideTolerance ≈ 0.30` (of the 0–1 normalized scale) — wide enough that
a slightly-light or slightly-heavy hand doesn't cliff-edge to 0, tight enough that "way too
little" and "way too much" both clearly read as low. **Symmetric** in this draft (under- and
over-sauce penalized equally); flag for calibration whether under-sauce should be forgiven more
than over-sauce (a common real-cooking bias) — this is a tuning question, not a contract one.

### 5.2 Sauce coverage (component 2)

Same shape, `value = metrics.coverage`, `target = reference.sauce.coverage`,
`tightTolerance ≈ 0.05`, `wideTolerance ≈ 0.35` (coverage is more forgiving than quantity by
design intent — "roughly the whole dough" matters more than a precise fraction).

### 5.3 Sauce evenness/concentration (component 3)

`metrics.evenness` is already self-normalized (0=all-in-one-cell, 1=best-possible-for-this-total)
and does **not** need a reference value to be meaningful — unlike quantity/coverage, "spread
evenly" is a property of the sauce itself, not a match to a target number. Proposed: reuse the
existing absolute thresholds from `sauceEvaluation.ts` (`EVENNESS_GREAT = 0.9`,
`EVENNESS_POOR = 0.85`) but make the transition continuous rather than tiered:

```
evennessScore = distanceSimilarity(EVENNESS_GREAT - metrics.evenness, 0, EVENNESS_GREAT - EVENNESS_POOR) * 100
```

i.e. full credit at/above 0.9, smooth falloff down to 0 credit at/below 0.85, floor 0 below
that (never negative). This intentionally reuses the same numeric line `sauceEvaluation.ts`
already treats as "good," so Scoring 2.0's evenness component and the player-facing 均一さ tier
never quietly disagree about what "good" means.

**Known interaction with empty sauce:** `computeEvenness([]) → 1` by design ("nothing deposited
yet is neutral, not bad" — see the function's own doc comment). This means a pizza with *zero*
sauce would get a perfect evenness component score. This must not be treated as a bug to "fix"
in isolation — the aggregate total handles it correctly by construction, because that same
empty-sauce pizza also scores ~0 on quantity and coverage, which dominate the weighted total
(see §6). Component 3 in isolation is expected to look strange for empty input; the **required
test cases in §10 must assert on the aggregate total's ordering**, not on evenness alone, for
this exact reason.

### 5.4 Rim overflow / edge control (component 4)

`value = metrics.edgeRatio` (already the stricter of overflow/rim-band, per `sauceField.ts`'s
own design — "touched the ear" and "missed the pizza entirely" are deliberately the same
mistake here). Target is 0; only "too high" is ever penalized (this band is one-sided, not
symmetric like §5.1–5.2):

```
edgeScore = distanceSimilarity(metrics.edgeRatio, EDGE_GREAT, EDGE_POOR) * 100
```

reusing `sauceEvaluation.ts`'s existing `EDGE_GREAT = 0.03` / `EDGE_POOR = 0.12` constants for
the same reason as §5.3 — one line, shared meaning between the live tier and the shadow score.

### 5.5 / 5.6 Mozzarella / basil placement quality (components 5–6)

For each `ReferencePieceGroup`, reuse `scorePieceGroup(toppings, group)` verbatim (Hungarian
assignment, already permutation-invariant, already continuous via `distanceSimilarity`):

```
placementQuality(group) =
  metrics.playerCount === 0 ? 0
  : metrics.placementSimilarity === null ? metrics.quantitySimilarity * 100  // no matches possible (target has 0 positions) — count-only
  : (0.3 * metrics.quantitySimilarity + 0.7 * metrics.placementSimilarity) * 100
```

Weighting placement (0.7) above raw count (0.3) is deliberate and directly serves Issue #30's
"a pizza that merely has the right ingredient IDs must not score high" requirement — a player
who dumps the right *count* of mozzarella in one corner should score much lower than one who
places the right count *and* spreads them across the three reference positions, because
`placementSimilarity` (not `quantitySimilarity`) is what actually measures "did it land near
the reference target locations, matched permutation-invariantly."

**Why this is inherently permutation-invariant and inherently penalizes clustering** (both
required by Issue #30): the Hungarian assignment finds the *minimum-cost* pairing between
player and reference points regardless of array order — reordering `pizza.toppings` cannot
change the optimal assignment's total cost, only re-label which player index maps to which
reference index. And because `MARGHERITA_REFERENCE`'s own mozzarella/basil positions are
already spread out (a triangle / two-point spread, not co-located), clustering all player
toppings in one spot necessarily maximizes the assignment's total distance against a spread
target — no separate "distribution bonus" term is needed; it falls out of matching against a
spread reference for free.

---

## 6. Proposed weights (draft — explicitly requires calibration, per Issue #22's own ordered
gate: "Define tolerant component metrics, normalization and weights" is its own checklist item,
separate from this audit)

| Component | Weight |
|---|---|
| Sauce quantity | 15 |
| Sauce coverage | 20 |
| Sauce evenness | 15 |
| Rim/edge control | 15 |
| Mozzarella placement | 20 |
| Basil placement | 15 |
| **Total** | **100** |

Rationale for the draft split: coverage and mozzarella placement get the largest single
weights because they're the two components most visually obvious to a human judging "does this
look like the reference pizza" (a mispainted rim or three cheese pieces dumped in one spot are
the most legible mistakes); quantity/evenness/edge/basil share the remainder. This is a
starting point for the required "good/under/over/uneven/overflow" comparison pass (§10), not a
final tuning — expect it to move once real iPhone-painted deposit logs are available.

`shadowTotal = Σ(component_i * weight_i) / 100`, same shape as `scorePizza`'s own weighted-sum
pattern (`scoring.ts`) for consistency, but living in a **separate, non-authoritative** type —
proposed name `ShadowScoreV2` — never a second `ScoreBreakdown`.

---

## 7. FREE / Lunch Rush compatibility — the one real contract gap

Today, `App.tsx` computes shadow sauce metrics like this:

```
const referencePizza = getReferencePizza(state.recipe.id);
const referenceModeEnabled = referencePizza !== null && !isMissionActive;
const sauceMetrics = useMemo(
  () => referenceModeEnabled ? computeSauceMetrics([...deposits, ...pending]) : emptySauceMetrics(),
  ...
);
```

This `referenceModeEnabled` gate is a **live-preview UI concern** (should the Prototype Metrics
panel render and update while the player is actively painting?) — it was never meant to be the
answer to "can a shadow score be computed for this round at all," but today it structurally is
one, because nothing else calls `computeSauceMetrics`/`scorePieceGroups` for a finished pizza.

Issue #30's acceptance criteria explicitly requires: *"Shadow score can be computed in FREE and
Lunch Rush without altering legacy result/progression."* Under the current wiring, a Lunch Rush
round's shadow metrics are hard-computed to `emptySauceMetrics()` regardless of what the player
actually painted, and no shadow computation happens at all for topping placement during
Mission.

**This is not a hard architectural blocker** (`isMissionActive`/Mission mode never touches
`PizzaState`, `sauceDeposits`, or `pieceGroups` matching — the underlying data is exactly as
available during Mission as during FREE), but it does mean:

- Scoring 2.0's shadow computation must be triggered from **`CONFIRM_BAKE` in the reducer** (or
  a pure function called right after it, fed the resulting `PizzaState`+`Recipe`), not from
  App.tsx's live-preview `useMemo`, so it runs identically regardless of `isMissionActive`.
- The *live-while-painting* preview (`SauceMetricsPanel`, Margherita FREE only) and the
  *finished-pizza shadow score* (Scoring 2.0) are different concerns with different natural
  computation points, and should stay two separate call sites even though they call the same
  underlying `computeSauceMetrics`/`scorePieceGroups` functions.

---

## 8. Edge cases already covered vs. still open

**Already structurally safe** (verified by reading the code, not just assumed):

- Empty deposits → `emptySauceMetrics()`, no division by zero (`sauceField.ts` guards every
  denominator: `inDoughCellCount() === 0 ? 0 : ...`, `totalDispensedAmount <= 1e-9 ? 0 : ...`).
- Empty toppings → `scorePieceGroup` returns `playerCount: 0, quantitySimilarity: 0,
  placementSimilarity: null` (not NaN) — `matches.reduce(..., 0) / matches.length` is only
  reached when `matches.length > 0` (there's an explicit `matches.length === 0 ? null : ...`
  guard immediately before it).
- Malformed sauce deposit shapes (NaN/Infinity/non-positive amount) are already rejected
  atomically at the reducer boundary (`isValidSauceDepositBatch`) before they can ever reach
  `sauceDeposits` — Scoring 2.0 reading `PizzaState.sauceDeposits` inherits this for free.
- `distanceSimilarity`'s own domain: `!Number.isFinite(distance) || distance >= zero → 0` guards
  a non-finite distance explicitly.

**Still open — must be designed for, not assumed away, before/during implementation:**

- `distanceSimilarity(d, full, zero)` divides by `(zero - full)` internally
  (`(distance - full) / (zero - full)`) — if a future Scoring 2.0 tolerance constant is
  authored with `wideTolerance <= tightTolerance` (a copy-paste/typo risk when adding a 7th
  recipe's reference data later), this divides by zero or a negative number and produces NaN or
  an inverted band silently. **No test today guards this for reference-data authoring
  mistakes** (existing tests only exercise the two hand-verified Margherita radii). Scoring 2.0
  needs either a validating constructor for its own tolerance pairs, or a dedicated test that
  asserts `wideTolerance > tightTolerance` for every configured component/recipe.
- `getReferencePizza(recipeId) === null` for 6 of 7 recipes (§2.4) — the aggregator must return
  `null`/`undefined` for the whole shadow score, not attempt partial scoring with fabricated
  targets, and every call site (a future debug panel, a future test) must handle that `null`
  explicitly rather than assuming a shadow score always exists.
- `ReferencePieceGroup.positions.length === 0` is not currently possible in data
  (`MARGHERITA_REFERENCE` always has 3 mozzarella + 2 basil positions) but is not type-enforced
  to be non-empty — `scorePieceGroup` already degrades safely here (`targetCount: 0`,
  `quantitySimilarity` clamped via `clamp01`, `matches: []` since `matchReferencePositions`
  early-returns on an empty side), but this path has no dedicated test today and should get one
  once Scoring 2.0 depends on it.
- Extremely large `playerCount` (e.g., a hypothetical future recipe/topping with dozens of
  scatter placements): `matchReferencePositions`'s Hungarian implementation is O(n³) in the
  smaller of the two side lengths — fine at today's scale (≤3 mozzarella / ≤2 basil) but worth
  a one-line comment/test ceiling if Scoring 2.0 is ever extended to a topping with a much
  larger target count.

---

## 9. Persistence / progression isolation

No new field is proposed for `PersistentSaveV1`, `DexState`, `MissionMetrics`, or
`ProgressionSnapshot`. A shadow score is proposed to live only as a transient, in-memory value
on `GameState` (or a value returned alongside `CONFIRM_BAKE`'s existing `scorePizza` call,
attached to a new, clearly-separate field such as `GameState.shadowScoreV2: ShadowScoreV2 |
null`, mirroring how `score: ScoreBreakdown | null` already exists) — never serialized, never
read by `registerScoreToDex`, `missionScore`, `purchaseIngredient`, or `persistProgress`. This
matches how `sauceDeposits`/reference matching already behave today: real canonical fields, but
explicitly outside every persisted/scored boundary, and already proven safe by the two existing
regression suites (§1). Phase 4A-2 should add a third regression suite in the same style,
specifically pinning that `ShadowScoreV2` computation/presence never changes `scorePizza`'s
output, `createDefaultSave()`'s key set, or `missionScore`'s formula.

---

## 10. Required test cases — ordering, not exact values

Issue #30 and #22 both require these to produce a *sensible relative order*, not hit specific
numbers (calibration comes later, after iPhone Human Feel). Proposed as the Scoring 2.0 test
suite's spine, using `MARGHERITA_REFERENCE` as the fixture recipe since it's the only one with
reference data today:

1. Reference-fixture-quality pizza (paint `IDEAL_MARGHERITA_SAUCE_FIXTURE` verbatim + place all
   5 toppings exactly on their reference positions) scores highest of all cases below.
2. Sauce shortage (a small fraction of the fixture's total amount, same shape) scores lower on
   quantity but should not collapse coverage/evenness to 0 (partial paint, not garbage paint).
3. Sauce excess (fixture doubled/re-painted) scores lower on quantity, higher edge ratio if the
   re-paint pushes past `SAUCE_TARGET_RADIUS`.
4. Sauce concentrated at center (same total amount as the fixture, all in one small area) scores
   near-full quantity but low coverage and low evenness — this is the case §2.2's "quantity and
   coverage must be able to disagree" design property exists for; assert both independently.
5. Uneven sauce (half the dough double-coated, half untouched, same total amount) scores
   moderate coverage, clearly low evenness.
6. Rim overflow (fixture plus extra deposits beyond `SAUCE_TARGET_RADIUS`/`DOUGH_RADIUS`) scores
   clearly lower edge-control than case 1, independent of its coverage/quantity numbers.
7. Toppings clustered (right count of mozzarella/basil, all placed touching each other in one
   spot, respecting `MIN_TOPPING_DISTANCE`) scores clearly lower placement quality than case 1.
8. Toppings well distributed but not exactly on reference points (a small, human-plausible
   jitter around each reference position) scores high, not just case 1 itself — this is what
   proves the tolerance band is actually tolerant, not a disguised exact-match check.
9. **Permutation test:** the exact same topping positions as case 1, with `pizza.toppings`
   constructed in a different (e.g. reversed, or basil-before-mozzarella) array order, must
   produce an **identical** shadow score to case 1 — this is Issue #30's explicit acceptance
   criterion and should be asserted as an exact equality, not an approximate one.
10. Empty pizza (no sauce, no toppings) must produce a finite, low, non-NaN shadow score (or a
    well-defined `null` if the aggregator chooses to abstain on a completely empty round —
    either is acceptable, but it must be a deliberate, tested choice, not an accidental NaN).
11. Malformed/out-of-range inputs (quantity/coverage `> 1` or `< 0`, though these should be
    structurally unreachable given `clampQuantity`/the reducer's own validation) must not
    produce NaN/Infinity — reuse the existing `distanceSimilarity` finite-guard pattern and add
    a direct test for it at the Scoring 2.0 component level, not just relying on upstream
    reducer validation.
12. A non-Margherita recipe (e.g. `marinara`) must return `null`/no shadow score, not throw and
    not silently score against Margherita's reference data.
13. Lunch Rush round with the same deposits/toppings as a FREE round must produce the same
    shadow score as the FREE case — a direct regression for §7's contract gap.
14. A regression test asserting `scorePizza`, `registerScoreToDex`, `missionScore`, and
    `createDefaultSave()`'s key set are all byte-identical with and without Scoring 2.0 wired
    in, in the same style as `phase4a1a.regression.test.ts`/`phase4a1b.regression.test.ts`.

---

## 11. Required implementation files (for the next, implementation-only Claude Code session —
none of these were created by this audit)

- `src/logic/scoringV2/shadowSauceComponents.ts` (or extend `sauceEvaluation.ts`) — quantity/
  coverage/evenness/edge component scores, per §5.1–5.4, reusing `distanceSimilarity`.
- `src/logic/scoringV2/shadowPlacementComponents.ts` (or extend `referenceScoring.ts`) —
  mozzarella/basil placement quality wrapper per §5.5–5.6, reusing `scorePieceGroup` unchanged.
- `src/logic/scoringV2/shadowScore.ts` — the aggregator: `computeShadowScoreV2(recipe, pizza):
  ShadowScoreV2 | null`, weights per §6, returns `null` when `getReferencePizza` does.
- `src/state/gameReducer.ts` — `CONFIRM_BAKE` gains one additional, purely additive field
  (`shadowScoreV2`) computed alongside the existing `scorePizza` call; no existing line changes.
- A Preview-only debug surface (extend `SauceMetricsPanel.tsx` or add a sibling panel), gated by
  `import.meta.env.VITE_PREVIEW_MODE` exactly like the existing panel, shown for calibration
  only — never in a production build.
- Test files matching §10: `shadowSauceComponents.test.ts`, `shadowPlacementComponents.test.ts`,
  `shadowScore.test.ts`, plus one new regression file (`src/state/phase4a2.regression.test.ts`)
  in the same style as the two existing Phase 4A-1A/1B regression suites.

---

## 12. Risks

- **Reference-data coverage risk (highest):** 6 of 7 recipes have no reference target at all.
  If Phase 4A-2's calibration is expected to cover more than Margherita, authoring 6 more
  `ReferencePieceGroup`/`ReferenceSauce` fixtures is real, non-trivial content work (each needs
  a "literally paintable" ideal fixture, per the existing "Reachable Reference" discipline in
  `referencePizza.ts` — not just picked numbers), and is scoped separately from the scoring math
  itself. Recommend Phase 4A-2 stays Margherita-only for calibration (matching what already has
  reference data) and treats other-recipe reference-data authoring as an explicit, separate,
  later task — not silently expand scope mid-phase.
- **Metric/visual divergence risk (medium):** the iPhone Human Feel findings (tomato
  blur/banding, overly uniform pesto) are about the *rendered* sauce, not the *deposit-log*
  metrics Scoring 2.0 reads — the two can legitimately disagree (a numerically well-spread
  pesto coat can render "too uniform" while still scoring well; a blurry/banded tomato render
  can still come from a numerically fine deposit log). This must be called out explicitly to
  whoever runs the calibration pass so a visual complaint isn't mistaken for a scoring defect,
  or vice versa.
- **Tolerance-authoring risk (medium):** see §8's `distanceSimilarity` division-by-zero note —
  a single mistyped tolerance pair in a future recipe's reference data is a silent NaN, not a
  loud crash, unless a validating test/constructor is added as part of implementation.
  Recommend a shared `assertValidBand(tight, wide)` helper Scoring 2.0 calls once per configured
  band, both at module-load time (dev-time assertion) and covered by a direct test.
- **Scope-creep risk (low-medium):** because so much of the underlying machinery already exists
  and is already reviewed, there is a temptation to also "finish" Phase 4A-1A/1B follow-ups
  (e.g., sauce visual polish, Issue #27) while touching these files. Issue #30 explicitly
  excludes both — implementation should touch only new Scoring 2.0 files plus one additive
  `CONFIRM_BAKE` field, nothing else in `gameReducer.ts`/`sauceField.ts`/etc.

---

## 13. Findings (P0–P3)

**P0 — must be resolved by design decision before/during implementation:**

- **P0-1 — Reference data exists for 1 of 7 recipes.** `getReferencePizza` returns `null` for
  marinara/quattro-formaggi/genovese/bismarck/funghi/fugazza. Decision required: Scoring 2.0's
  aggregator must treat this as "no shadow score for this round" (return `null`), not attempt a
  partial/fabricated score. Recommend keeping Phase 4A-2's calibration scope to Margherita only
  (see §12).
- **P0-2 — The only existing shadow-metric computation call site is UI-gated off Mission.**
  `App.tsx`'s `referenceModeEnabled = referencePizza !== null && !isMissionActive` is a live-
  preview concern being (accidentally) relied on as the only computation trigger today. Scoring
  2.0 must compute from `CONFIRM_BAKE`'s resulting `PizzaState` directly, independent of that
  flag, to satisfy Issue #30's explicit FREE-and-Lunch-Rush requirement.

**P1 — should be resolved before Human Feel calibration:**

- **P1-1** `distanceSimilarity(d, full, zero)` has no guard against `zero <= full` at the config
  level; a future tolerance-authoring mistake produces silent NaN. Needs a validating helper +
  test, not just reliance on the two currently-correct Margherita radii.
- **P1-2** `ReferenceSauce` today only carries `quantity`/`coverage`. Evenness/edge targets are
  proposed as **absolute, self-normalized thresholds** (reusing `sauceEvaluation.ts`'s existing
  constants) rather than new per-recipe reference fields — this needs to be an explicit,
  documented design choice before implementation, not something implementation improvises.
- **P1-3** Olive-oil `"PAINT_TEMPORARY"` recipes (quattro-formaggi, fugazza) share the same
  `COMMIT_SAUCE_DISPENSE` reducer path per this audit's reading of `gameReducer.ts` +
  `recipeSauceProfiles.ts`, but this audit did not trace `PizzaStage.tsx`'s full paint-mode
  branch end-to-end pixel-for-pixel. Implementation must add a direct test confirming
  `sauceDeposits` is populated identically for a `PAINT_TEMPORARY` recipe before trusting it as
  a Scoring 2.0 input for any future non-Margherita reference data.
- **P1-4** Visual/metric divergence (§12) must be documented for calibration testers so it's not
  mistaken for a scoring bug during the iPhone Human Feel pass.

**P2 — should be resolved before sign-off, non-blocking for a first implementation pass:**

- **P2-1** Add a dedicated permutation-invariance test at the Scoring 2.0 aggregator level (not
  only at `referenceMatching.test.ts`'s existing lower level) — Issue #30 names this as its own
  acceptance criterion, so it deserves its own top-level assertion.
- **P2-2** `computeEvenness([]) → 1` (neutral-not-bad for empty sauce) is correct behavior but
  easy to misread as a bug in isolation; document it inline at the Scoring 2.0 aggregator and
  cover it via the aggregate-ordering tests in §10, not a standalone evenness-only assertion.
- **P2-3** No empty-`positions` reference-group test exists today; add one before Scoring 2.0
  depends on `scorePieceGroup` handling it.

**P3 — cosmetic / documentation only:**

- **P3-1** Keep Scoring 2.0's naming (`ShadowScoreV2`, `computeShadowScoreV2`) visibly distinct
  from the existing `SauceReferenceShadowScore`/`PieceReferenceMetrics` types so a future reader
  doesn't assume they're the same object.
- **P3-2** No persistence is proposed for `ShadowScoreV2`; keep it that way (transient only),
  consistent with how `sauceDeposits`/reference matching already behave.

---

## 14. Implementation estimate

Consistent with Issue #30's own sizing ("Claude Code: approximately 2–3 hours for fresh audit +
shadow prototype"). This audit consumed roughly the first half. Remaining implementation
(component functions + aggregator + one additive `CONFIRM_BAKE` field + Preview-only debug
panel + the test suite in §10 + one regression file) is estimated at **2–3 additional hours**,
assuming:
- scope stays Margherita-only (per P0-1's recommendation) — extending reference data to other
  recipes is separate follow-up work, not part of this estimate;
- no visual/UI work beyond the existing `SauceMetricsPanel.tsx`-style Preview-only panel.

---

## 15. FINAL VERDICT

**B. READY WITH MINOR DESIGN CHANGES**

Reasoning: the hard, previously-uncertain parts of Scoring 2.0 — permutation-invariant
placement matching, continuous/non-pixel-exact tolerance scoring, boundary-continuous sauce
geometry, normalized-only quantity, reset/stale-event safety, shadow/authoritative isolation —
are already built, reviewed, and tested on main from Phase 4A-1A/4A-1B. Nothing found in this
audit requires renegotiating the canonical `PizzaState`/`GameState`/`ScoreBreakdown`/save-v1
contracts (that would be verdict C). What remains is genuinely "minor" in code-change terms but
not in judgment terms: two explicit design decisions (P0-1: scope shadow scoring to recipes
that actually have reference data; P0-2: compute the shadow score from `CONFIRM_BAKE`'s
canonical state rather than the existing Mission-gated live-preview `useMemo`) plus a handful of
P1 hardening items (tolerance-band validation, documenting the absolute-threshold choice for
evenness/edge, confirming `PAINT_TEMPORARY` parity) that should be resolved *during*
implementation, not before it starts.

---

*Report prepared as a read-only Fresh Audit. No production code, save schema, or authoritative
scoring/progression path was modified to produce this document.*
