# Issue #38 — Pitz Reward / Scoring-2.0-linked Economy — Fresh Audit

**Audit-only. No production code changed.** Design/contract document per Issue #38's own
E-P0 slice ("Fresh Audit / Economy contract").

## Baseline / SHA

- Audited/expected `origin/main` SHA: `2da3949de5bd642c709ca6ba343bc57d8101d03d` (PR #51 —
  Issue #33 Dough D0 revalidation, docs-only). Confirmed identical via `git fetch origin main`
  at audit start — no drift to reconcile.
- Audit branch: `claude/pitz-reward-fresh-audit-owo4rr`, created from fresh `origin/main`.
- Other in-flight sessions (per task instructions): Dough D1, Save v2/Inventory audit. This
  audit does not read or reason about their in-progress branches, and touches none of their
  files (`src/state/pizzaState.ts`'s `doughShape`, `src/state/persistence.ts`'s schema, Save
  v2 migration code do not exist on this SHA and are not designed here).

## 1. Authority gate

**Current authoritative score**: `scorePizza()` (`src/logic/scoring.ts`) → `ScoreBreakdown.total`
/`.stars` (0-100, weighted `Recipe 35 + Purity 15 + Placement 20 + Bake 30`). Computed once per
round inside `CONFIRM_BAKE` (`src/state/gameReducer.ts:431-441`) and stored on `GameState.score`.
This is the **only** score that today drives:

- Dex BEST / `timesMade` (`REGISTER_TO_DEX`, `MISSION_NEXT_ORDER` → `registerScoreToDex`)
- Mission Score / Mission BEST (`missionScoring.ts`'s `recordServe`/`missionScore`, fed
  `state.score.total` at `SERVE`)
- **The only Pitz reward path that exists today** — see below.

**Scoring 2.0** (`computeScoringV2Shadow`, `src/logic/scoringV2/`) is computed at the exact
same `CONFIRM_BAKE` call site, from the exact same canonical `pizza`, into
`GameState.scoringV2Shadow`. It is deliberately Shadow-only and structurally isolated from
every economic/progression path:

- **Never persisted** (`persistence.ts` never serializes `GameState`; `scoringV2Shadow` isn't
  in `PersistentSaveV1` at all).
- **Never read** by `registerScoreToDex`, `recordServe`, `missionScore`, or `economy.ts`'s
  `calculateMissionReward`/`purchaseIngredient` — confirmed by source inspection of every one
  of those call sites (each reads `state.score`/`ScoreBreakdown.total` explicitly, never
  `scoringV2Shadow`), and by the Shadow Result report's own dedicated legacy-isolation tests.
- Only available for Margherita today (`getReferencePizza` returns non-null for exactly one
  recipe); every other recipe's Shadow result is `available: false, totalScore: null`.

**Prerequisite for Pitz Reward activation** (per Issue #38's own "Dependencies / Gate"
section, re-verified against current `main`):

1. Issue #32 Authority blocker — **satisfied** (Issue #32 is closed, PR #45 merged).
2. Scoring 2.0 Human Feel calibration — **not yet satisfied**. Making Game 2.0 (dough/bake/
   finish, Issues #33/#37) is still mid-flight (D1 is the active priority per
   `docs/PROJECT_HANDOFF.md`); Scoring 2.0's own calibration gate depends on that Human Feel
   pass existing to calibrate against.
3. Phase 4A-3 / Scoring 2.0 Authority adoption rule — **not yet decided**. No code or docs on
   this SHA make Scoring 2.0 authoritative for anything; `docs/PROJECT_HANDOFF.md`'s own
   non-negotiable guards still read "Scoring 2.0 remains non-authoritative until its gates
   pass."
4. Fresh Audit of current Pitz/save/shop contracts — **this document**.
5. Save v2 migration precedes only if persistence semantics must change — see §6 below; this
   audit's recommended V1 design needs no such change.

**Contract decision**: design the reward formula against an abstract "authoritative Quality
score" input (0-100 + band), satisfied **today** by `ScoreBreakdown.total` (legacy) and
intended to become `scoringV2Shadow.totalScore` **only once Phase 4A-3 flips authority**. The
reward module must never import from `scoringV2/` directly while Shadow remains non-
authoritative — this is the same isolation discipline already proven for Dex/Mission. Do
**not** hard-code "Scoring 2.0" as the input in the first implementation; hard-code "whatever
`CONFIRM_BAKE` currently treats as `state.score`" instead, so a later authority flip is a
one-line change at the reducer's score-selection point, not a rewrite of the reward module.

## 2. Reward formula

### Relationship to the *existing* Pitz mechanism (critical finding)

Issue #38's candidate (`recipeBaseReward × qualityMultiplier = earnedPitz`) is a **per-pizza**
formula. It is not an evolution of the reward mechanism that already ships on `main` — it is a
different shape entirely:

`src/logic/economy.ts`'s `calculateMissionReward(metrics: MissionMetrics)` (Phase 3C-5, already
merged, already tested, already live) is a **per-Lunch-Rush-run** formula:

```
reward = 0                                     if servedCount == 0
reward = 40 + floor(avgQuality/10)*5 + min(servedCount,10)*5   otherwise   (cap 140)
```

It reads `MissionMetrics` (a whole run's aggregate: `servedCount`, `totalQualityScore`,
`bestQualityScore`), not a single pizza's score, and it is the **only** source of Pitz today —
FREE mode always yields exactly `0` Pitz (confirmed by `docs/reports/
PIZZA_GAME_Phase3C-5_Pitz-Shop_Result.md`'s explicit regression check and by
`ResultPanel.tsx` having no Pitz UI at all). Any Issue #38 implementation must decide how the
new per-pizza formula relates to this existing per-run one rather than silently assuming a
green field — see §4 for the recommendation (keep both, scoped to different modes, in V1).

### Is the candidate a sensible minimal V1?

**Bands**: `90–100 / 75–89 / 60–74 / 40–59 / 0–39` are not new thresholds — they are byte-for-
byte `scoring.ts`'s existing `STAR_THRESHOLDS` (`★5/★4/★3/★2/★1`). Reusing them means the
Pitz multiplier tier a player lands in always matches the star rating they already see on the
same RESULT screen — no second, uncoordinated tuning surface. This is a good, low-risk choice,
not one that needs re-derivation.

**Multiplier curve** `1.20 / 1.00 / 0.80 / 0.50 / 0.00`: monotonic, a modest (not runaway)
premium for excellence, and a hard floor of 0 for the bottom band (never a participation
reward for a failed pizza) — matches the existing Mission formula's own "0 servedCount → 0
Pitz, no free floor" discipline. **Verdict: sensible minimal V1.** Do not re-tune without
Human Feel evidence, per Issue #38's own instruction and the project's general "no coefficient
tuning without a failing behavior" rule (Issue #32's P1.3).

### Concrete contract for V1

- **Rounding**: `Math.round(recipeBaseReward * qualityMultiplier)` — matches the project's
  existing rounding convention (`missionScore`'s `Math.round`, `ResultPanel`'s displayed
  `Math.round(score.total)`), not `floor`/`ceil`.
- **Integer Pitz**: yes, always. `pitzBalance` (`persistence.ts`) is already validated as a
  non-negative number; nothing currently enforces integer-only, but every writer to date
  (`calculateMissionReward`, `purchaseIngredient`) already only ever produces integers. The
  new formula must preserve that invariant explicitly (the same way `isValidPrice` in
  `economy.ts` enforces `Number.isInteger` for shop prices).
- **Minimum/zero behavior**: 0–39 band → multiplier `0` → `earnedPitz = 0` unconditionally,
  regardless of `recipeBaseReward`. Defensively clamp with `Math.max(0, ...)` even though the
  band table cannot itself go negative — matches this codebase's existing style of guarding
  derived arithmetic at the boundary (`isValidPrice`, `sanitizePitzBalance`) rather than
  trusting band-table shape alone.
- **Per-recipe base reward source**: needs a **new static field**, e.g. `Recipe.baseRewardPitz:
  number`, in `src/data/recipes.ts`. This is architecturally identical to how Phase 3C-5 added
  `Ingredient.pricePitz?: number` — a plain additive field on already-static, never-persisted
  authored data (`RECIPES`/`INGREDIENTS` are source-code arrays, not Save schema; recipe ids
  are what's referenced from Dex/`ownedIngredientIds`, never the `Recipe` object itself). No
  Save schema change, no migration, no version bump.
- **Locked/harder recipes with a different base reward**: architecturally trivial once the
  field exists (it's just a different literal per `RECIPES` entry) — but Issue #38 explicitly
  says "do not over-balance without gameplay evidence." **Recommendation**: ship the field on
  all 7 recipes in V1, but give every recipe the **same** baseline value (e.g. `100`, mirroring
  Issue #38's own worked example table) rather than inventing a difficulty-based ranking with
  no playtesting behind it. Differentiate later only once Human Feel evidence (E-P3) actually
  shows a specific recipe under/over-rewards relative to its real difficulty.

## 3. Exactly-once credit

The codebase already has **two** proven idempotency patterns for "this must happen exactly
once per round," both already load-bearing for real money-like state (`pitzBalance`,
`ownedIngredientIds`, Dex BEST). The reward credit must reuse one of these, not invent a third:

**Pattern A — phase-transition atomicity guard** (`REGISTER_TO_DEX`,
`gameReducer.ts:443-462`; also `MISSION_NEXT_ORDER`): the reducer case itself starts with
`if (state.phase !== "RESULT" || !state.score) return state;` and, on success, moves `phase`
away from `RESULT` (to `DISCOVERED`, or straight to the next Mission order) in the *same*
transition that applies the effect. A second dispatch of the identical action after that point
sees a `phase` that no longer satisfies the guard and is a structural no-op — not a "we hope
the UI only sends this once" no-op.

**Pattern B — idempotency-key guard** (`CLAIM_MISSION_REWARD` +
`MissionState.runId`/`GameState.lastClaimedMissionRunId`, `gameReducer.ts:547-561`): used
because the Mission reward is granted by a `useEffect` that legitimately *can* re-fire
(rerender, StrictMode double-invoke) — safety comes from the reducer comparing the action's
`runId` against the last-credited one, not from the effect's own firing discipline. The code's
own comments are explicit that this is deliberate: the effect is allowed to be sloppy because
the reducer is not.

**Recommendation for the new per-pizza credit**: use **Pattern A**, by extending
`REGISTER_TO_DEX` itself (not a new parallel action) to also apply the Pitz credit in the same
atomic transaction that already registers Dex and advances `phase` to `DISCOVERED`. This is
deliberately the smallest change:

- **RESULT rerender**: no dispatch is fired by a render; nothing to guard beyond what already
  exists.
- **Refresh/reload**: `GameState` (including `phase`, `score`, and any pending-credit
  transient) is **never persisted** — confirmed, `persistence.ts` only ever serializes
  `dex`/`pitzBalance`/`ownedIngredientIds`/`missionBest`. A reload always rehydrates from
  `createInitialGameState`, landing back at the idle phase, never at a resurrected `RESULT`.
  Whatever `pitzBalance` was already written by `persistProgress` before the reload survives;
  nothing about the reload path can re-trigger a second credit for the same round, because
  there is no surviving `RESULT` state to re-credit from. This is a structural property of the
  existing persistence boundary, not something the reward feature needs to build itself.
- **Retry** (`RETRY_SAME_RECIPE`/`PLAY_AGAIN`): both go through `startPreparingRecipe`/
  `nextOrderState`, which construct a **fresh** state at `PREPARE`/`ORDER` — there is no
  leftover `RESULT`+`score` for a stray dispatch to re-credit against.
- **Back navigation**: confirmed via source inspection — this SPA has no `react-router`, no
  history-based route restoration, and no `popstate` handling; the only `window.location`
  usage is a one-time `URLSearchParams` read for a dev-only Mission-duration override at
  mount. There is no code path by which "back" resurrects a `RESULT` phase differently from a
  reload.
- **Double click**: the button's single `onClick` dispatches one action; even if double-fired,
  the second dispatch is processed against the state the first dispatch already produced
  (`useReducer` applies actions in order) — `phase` is already `DISCOVERED`, guard rejects it.
- **Reducer duplicate event**: covered by construction — the guard is a property of `state`,
  not of dispatch count.
- **Lunch Rush multiple orders**: not applicable to the V1 scope recommended in §4 (Lunch
  Rush's reward path is left untouched); if a later slice adds per-pizza crediting inside
  Lunch Rush, the same Pattern-A guard already protects `MISSION_NEXT_ORDER` identically (each
  call only succeeds once per `RESULT` before advancing away from it).

**Explicit non-goal**: do not rely on a `useEffect`'s own single-fire behavior as the *only*
safety net, the way the existing Mission-reward effect's own code comments warn against.
Pattern A avoids needing an effect at all for FREE; if a future slice does need an
effect-triggered path (e.g. an automatic per-pizza credit inside a fast-paced Lunch Rush loop),
it must carry a Pattern-B-style idempotency key in canonical reducer state, never trust the
effect's call count.

## 4. Mode behavior

**FREE**: award Pitz **once per completed pizza**, in the same atomic reducer step as
`REGISTER_TO_DEX` (Pattern A above). Registration is already FREE's one mandatory,
player-initiated "commit this round" action — the only button rendered at FREE's `RESULT`
phase (`GameScreen.tsx:402-404`) — so tying the credit to it does not add a new commitment
gesture, it reuses the one that already exists. This also preserves current behavior for a
player who never presses the button (no state changes today if they navigate away instead;
that stays true with the credit attached to the same gate).

**Lunch Rush — per pizza vs. end-of-rush settlement**: **recommend leaving Lunch Rush's
existing end-of-run settlement (`calculateMissionReward`) completely unchanged in V1.**
Reasons:

- It is already implemented, tested (26 `economy.test.ts` cases + reducer/integration tests),
  and browser-verified with real one-shot/idempotency guarantees. Touching it is not required
  to satisfy Issue #38's stated goal (make → earn Pitz), which FREE mode currently fails
  entirely (0 Pitz always) while Lunch Rush already succeeds.
- `missionScoring.ts`'s own file header is explicit that Mission Score/Pitz are a **run-level**
  aggregate deliberately kept distinct from any single pizza's quality — introducing a
  competing per-pizza formula inside the same run in the same slice as introducing it to FREE
  would touch two different economic models at once, doubling the review/regression surface
  for one Issue.
- Per-pizza crediting mid-run would need its own new idempotency key (a per-serve id, not just
  `runId`), which is more surface area for exactly-once bugs in a fast, timed mode than
  end-of-run settlement carries today.

**Recommended smallest safe first implementation**: FREE gets the new per-pizza
`recipeBaseReward × qualityMultiplier` reward (today: `0` Pitz → now: something). Lunch Rush
keeps its existing per-run reward (today: `40-140` Pitz/run, unchanged). Unifying the two
formulas (e.g. Lunch Rush becomes "sum of per-pizza rewards for every pizza served this run")
is a plausible **later** slice, explicitly deferred until Human Feel evidence says the two
should converge — do not do it speculatively in the first pass.

## 5. Result 2.0 interface (future contract — not implemented, not designed as UI here)

RESULT/DISCOVERED must be able to display, sourced from the same atomic reducer transaction
that applies the credit (never recomputed independently by the display layer — the same
discipline `scoringV2Shadow` already follows as a reducer-computed transient field):

| Field | Source |
|---|---|
| Quality | `score.total` (0-100) / `score.stars` — whichever score is authoritative at credit time (§1) |
| Base reward | `recipe.baseRewardPitz` |
| Quality multiplier | derived from the band table, e.g. `×1.20` |
| Earned Pitz | `+N Pitz` |
| Balance before → after | `pitzBalance` immediately before the credit → `pitzBalance` after |

Suggested transient shape (not implemented): a `GameState.lastPitzCredit: { baseReward:
number; multiplier: number; earnedPitz: number; balanceBefore: number; balanceAfter: number }
| null` field, set by the same reducer case that applies the credit, reset to `null` on every
fresh round exactly like `scoringV2Shadow` already resets in `buildOrderState`. **Currency is
always "Pitz" — never 円/¥,** matching the existing `MissionResultOverlay` precedent (`+N
Pitz`, `現在残高: N Pitz`) and Issue #38's explicit currency contract.

Note for continuity: `MissionResultOverlay.tsx` **today** shows earned reward + balance-*after*
only (no before→after pair) — Result 2.0's before→after contract is a strict superset that a
future slice can also backport to Lunch Rush's display without changing its (unchanged) reward
math. This audit does not redesign either panel.

## 6. Persistence dependency

**What must persist**: only `pitzBalance` — already a first-class `PersistentSaveV1` field
since Phase 3C-5, already written through the existing `persistProgress` canonical merge path.
Nothing else in the V1 design needs to survive a reload: `recipe.baseRewardPitz` is static
authored data (never persisted, like every other `Recipe`/`Ingredient` field), and the
Result-2.0 display fields (`lastPitzCredit`) are transient/derived exactly like `score` and
`scoringV2Shadow` already are.

**Must reward implementation wait for Save v2?** **No**, for the V1 design recommended here.
It fits entirely inside the already-existing, already-migrated `pitzBalance` field and the
already-existing `persistProgress` write path — no new persisted field, no schema version
bump, no migration.

**Migration requirements**: none, provided the implementation stays within this contract (no
new Save field). If a later slice needs to persist something new (e.g. a durable per-round
credit ledger, or Lunch Rush per-pizza settlement history), that is exactly the kind of
"persistent semantics change" Issue #38's own gate #5 says must go through a reviewed Save v2
migration first — flagged here as an explicit trigger condition for future sessions, not
something this V1 needs.

**Exactly-once persistence implications**: `persistProgress` already treats `pitzBalance` as a
plain snapshot value and no-ops the write when the new value equals what storage already holds
(`nextPitzBalance === current.pitzBalance`). A duplicate *application* of the credit is
prevented at the reducer level (§3); a duplicate *write* of an already-applied balance is
already harmless at the storage level today. Save v2 is not a prerequisite for this property —
it already holds.

## 7. Recommended implementation sequence

Dependency shape between the five tracks:

- **Scoring2 Authority** (Phase 4A-3): gates only *which* score the reward formula reads
  (legacy today, Scoring 2.0 once authoritative) — see §1's abstraction-boundary design. Not a
  hard blocker for writing the reward module itself, but Issue #38's own gate text explicitly
  requires waiting for Scoring 2.0 Human Feel calibration + the Phase 4A-3 authority decision
  before *starting* implementation, so the reward isn't built against a score that gets
  replaced immediately after.
- **Save v2**: independent of Pitz Reward V1 per §6 — no shared surface unless a later slice
  needs new persisted reward state.
- **Pitz Reward** (this Issue): depends on Scoring2 Authority per Issue #38's own stated gate;
  does not depend on Save v2 for the V1 slice recommended here.
- **Inventory**: depends on Save v2 (per `docs/PROJECT_HANDOFF.md` P5), not on Pitz Reward.
  Reads `ownedIngredientIds`/`pitzBalance` the same way it already does today.
- **Shop**: depends on Save v2/Inventory (per P5) for its purchase-loop expansion; its existing
  `purchaseIngredient` already consumes `pitzBalance` however it's produced, so Pitz Reward V1
  requires no Shop code change at all.

**Safest shortest ordering**:

1. Scoring 2.0 Authority decision (Phase 4A-3) — already the dependency this Issue's own text
   names; proceeds via the Making Game 2.0 track (Issues #33/#37) already in progress.
2. Pitz Reward V1 (this Issue) — implement once Authority is decided, per the contract above
   (FREE per-pizza credit via `REGISTER_TO_DEX`, `Recipe.baseRewardPitz`, Lunch Rush unchanged).
3. Save v2 / Inventory / Shop economy expansion — proceeds on its own independent track in
   parallel with 1-2; only intersects Pitz Reward if/when a later slice adds persisted reward
   history or material-cost accounting (both explicitly out of scope for Issue #38's first
   slice).

## 8. Tests required later (exact regression cases)

- **Score-band boundaries**: `total = 39` → multiplier `0`; `40` → `0.50`; `59` → `0.50`;
  `60` → `0.80`; `74` → `0.80`; `75` → `1.00`; `89` → `1.00`; `90` → `1.20`; `100` → `1.20`
  (mirrors `starsFromTotal`'s own boundary tests — reuse the same boundary values).
- **Deterministic reward**: same `(recipeId, score.total)` in → same `earnedPitz` out, every
  call, no randomness/external state (mirrors `calculateMissionReward`'s own determinism test).
- **Zero reward**: `total` in `[0, 39]` → `earnedPitz === 0` regardless of `baseRewardPitz`.
- **Exact rounding**: a `(baseReward, multiplier)` pair whose product is non-integer rounds
  per the `Math.round` contract, pinned with an explicit `.5`-boundary case.
- **Credit once**: dispatching the extended `REGISTER_TO_DEX` twice in a row from the same
  `RESULT` state applies the credit exactly once (mirrors the existing
  `gameReducer.test.ts` "REGISTER_TO_DEX" describe block's own double-dispatch test).
- **Retry no duplicate**: `RETRY_SAME_RECIPE`/`PLAY_AGAIN` after a credited `RESULT`, then a
  stray `REGISTER_TO_DEX` replay against the *old* state object, must not double-credit the
  *new* state (construct this the same way `phase4a1a.regression.test.ts`'s existing
  "still a no-op outside RESULT" test is built).
- **Reload no duplicate**: a `persistProgress`-written `pitzBalance` survives `loadSave`
  unchanged when no new credit has been applied since (reuses the existing `persistProgress`
  round-trip test pattern).
- **FREE**: full FREE round → `REGISTER_TO_DEX` → `pitzBalance` increases by exactly the
  formula's output for that round's `score.total` and `recipe.baseRewardPitz`; a FREE round
  that is *not* registered leaves `pitzBalance` unchanged (mirrors the Phase 3C-5 report's own
  "FREE playでPitz増加なし" check, now scoped to "un-registered FREE").
- **Lunch Rush**: unchanged reward math still produces byte-identical results to the current
  `calculateMissionReward` test suite — a regression guard that this Issue's changes do not
  alter Lunch Rush's numbers.
- **Balance persistence**: `pitzBalance` round-trips through `persistProgress`/`loadSave`
  after a FREE credit, exactly like the existing Phase 3C-5 persistence tests for Mission
  credits.
- **Result display**: `lastPitzCredit`'s five fields match the exact values the reducer
  applied for that round (base reward, multiplier, earned, before, after) — a "display never
  invents its own numbers" test, mirroring how `ScoringV2ShadowPanel` is tested against
  `computeScoringV2Shadow`'s own output rather than recomputing anything.
- **Legacy/Shadow isolation**: a dedicated test asserting the new reward computation never
  reads `state.scoringV2Shadow` (construct analogously to the existing Shadow Result report's
  own Dex-BEST/Mission-serve isolation tests — same shape, new subject).

## 9. Scope guard

No production code was changed by this audit. Confirmed untouched by `git status`/`git diff`
against `origin/main` at the audited SHA: Scoring coefficients/authority
(`src/logic/scoring.ts`, `src/logic/scoringV2/**`), Dough (`src/state/pizzaState.ts`,
dough-shape gesture code), Making gestures, Save schema (`src/state/persistence.ts`), Inventory,
Shop (`src/components/ShopOverlay.tsx`, `src/logic/economy.ts`), and `src/data/recipes.ts`
(no `baseRewardPitz` field added — this document only specifies where it would go).

## 10. Report

- **Audited `main` SHA**: `2da3949de5bd642c709ca6ba343bc57d8101d03d` (PR #51, confirmed current
  at audit start, no drift).
- **PR**: opened against `main` from `claude/pitz-reward-fresh-audit-owo4rr`, docs-only,
  **not merged** (per task instructions — audit deliverable only).
- **Current score authority**: legacy `scorePizza()`/`ScoreBreakdown.total` (`scoring.ts`).
  Scoring 2.0 (`scoringV2Shadow`) remains fully Shadow — never persisted, never read by any
  Dex/Mission/Pitz/Shop code path, confirmed by direct source inspection of every consumer.
- **Reward formula contract**: `recipeBaseReward × qualityMultiplier = earnedPitz`
  (`Math.round`, integer, floor of 0), bands reusing `scoring.ts`'s existing star thresholds
  (90/75/60/40/0 → 1.20/1.00/0.80/0.50/0.00), `Recipe.baseRewardPitz` as a new static per-recipe
  field (uniform value across all 7 recipes in V1, no invented difficulty differentiation).
  Applies to **FREE mode only** in V1; Lunch Rush's existing per-run `calculateMissionReward`
  formula is left completely unchanged.
- **Exactly-once strategy**: extend the existing `REGISTER_TO_DEX` reducer case (Pattern A —
  phase-transition atomicity guard, already proven for Dex BEST) to also apply the Pitz credit
  in the same atomic transition; do not add a parallel action or rely on a `useEffect`'s own
  fire-once behavior.
- **FREE/Lunch behavior**: FREE newly earns Pitz per completed+registered pizza (today: always
  0). Lunch Rush is unchanged (existing end-of-run settlement, already exactly-once via
  `runId`/`lastClaimedMissionRunId`).
- **Persistence dependency**: none beyond the already-existing `pitzBalance` field and
  `persistProgress` write path. No Save v2 migration required for this V1 design; Save v2
  only becomes a prerequisite if a later slice needs new persisted reward state (durable
  credit ledger, per-pizza Lunch Rush settlement history, material-cost accounting).
- **Implementation ordering**: Scoring 2.0 Authority (Phase 4A-3) → Pitz Reward V1 (this
  Issue) → Save v2 / Inventory / Shop (independent, parallel track).
- **Next implementation recommendation**: do not start Issue #38 implementation yet — its own
  stated gate (Scoring 2.0 Human Feel calibration + Phase 4A-3 authority decision) is not yet
  satisfied. Continue the currently active priority (Issue #33 Dough D1 / Making Game 2.0)
  toward that gate; this document is the ready-to-implement contract for whenever it opens.

## Final verdict

**A. READY AFTER SCORING AUTHORITY**

The Pitz Reward contract itself is fully specified and requires no Save v2 migration (the V1
design stays entirely inside the already-existing `pitzBalance` field and `persistProgress`
path — see §6). The remaining blocker is exactly the one Issue #38's own text already names:
Scoring 2.0 Human Feel calibration and the Phase 4A-3 authority decision have not happened yet,
and this audit found no way to responsibly start Pitz Reward implementation before that
decision without risking building the reward formula against a score input that gets replaced
immediately after (legacy today, Scoring 2.0 once authoritative — see §1). No material design
issue was found in the existing Pitz/Shop/Mission/persistence contracts themselves; they are
sound, tested, and cleanly separated from Scoring 2.0's Shadow state.
