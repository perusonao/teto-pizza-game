# Progression 2.0 Phase 3-3: 0レシピ開始 → 初回マルゲリータ発見 (Fresh Audit)

Issue #198 (parent #182). Branch `claude/progression-phase-3-3-onboarding-3t54xu`, cut from `main`.

| Item | Value |
|---|---|
| Audited `main` | `3f4693156b62a8423cb6d1c225764128c10759fc` (PR #196, Phase 3-4 finalize ingredient unlocks/prices — merged, matches the task's stated SHA) |
| Duplicate open Issue/PR | None found (see §1) |
| OD-01 / OD-02 | Treated as existing authority per the task; not re-derived or re-invented here |
| Scope decision | One PR. See §11 |

## 1. GitHub state

- `origin/main` HEAD is `3f46931`, matching the task's stated merge SHA for PR #196.
- Issue #198 read in full — its body already names the boundary with PR #196 and points at this
  report by its exact intended path, so no divergence to report against the Issue text.
- Open issues (fetched fresh): #182 (parent), #176, #134, #129, #104, #88, #87, #47, #39, #38, #37,
  #33, #32, #30, #27, #24, #22. None duplicates #198.
- Open PRs (fetched fresh): #105 (Dev Automation, draft), #72, #46, #34, #3 — all pre-existing,
  stale/superseded PRs unrelated to Progression 2.0 (already documented as such in
  `docs/PROJECT_HANDOFF.md`'s 2026-09-19 addendum). None touches discovery, HOME, Pizza Select,
  Lunch Rush, hints, Pitz reward or the save schema. No merge/rebase conflict risk.
- Phase 3-1 (#192, PR #193), Phase 3-2 (#194, PR #197) and Phase 3-4 (PR #196) are all merged.
  Phase 3-3 is the next open slice on the Progression 2.0 track, exactly as the Issue says.

## 2. New-game initial state (item 4/5/6/7 of the task's audit list)

Already correct on `main`, with no code change required:

- `src/state/persistence.ts`'s `createDefaultSave()` returns `dex: []` (line ~325) for a save
  with no `localStorage` entry.
- `createInitialGameState`'s own default (`src/state/gameReducer.ts`) is `dex = EMPTY_DEX`,
  `ownedIngredientIds = STARTER_INGREDIENT_IDS`.
- `STARTER_INGREDIENT_IDS` (`src/data/ingredients.ts`) is derived as "every ingredient with no
  `unlockCondition`" — exactly `tomato-sauce`, `mozzarella`, `basil` today (confirmed by reading
  every `INGREDIENTS` entry; every other ingredient has an explicit `unlockCondition`). These
  three are always OWNED and unconditionally unlimited (`∞`), by construction, regardless of
  `ownedIngredientIds` contents (`src/state/progression.ts`'s `ingredientState` has an explicit
  safety net for this).
- `margherita` (`src/data/recipes.ts`) is the **only** recipe with no `unlockCondition` — every
  other recipe's `unlockCondition.requiresRecipeId` chains transitively back to it
  (`funghi → margherita`, `marinara → funghi`, `bismarck → marinara`, …). So at Dex 0,
  `isRecipeAvailable` is true for margherita alone; every other recipe is LOCKED. This is the
  reason Pizza Select's own pre-Phase-3-3 gap (§4) only ever matters for margherita specifically.

**Conclusion:** "discovered recipes = 0, Dex = 0, starter materials = tomato sauce/mozzarella/
basil, Margherita makeable" was already the exact behavior of a genuinely fresh save before this
phase. No New Game Contract code changes were needed — only the *discovery loop* and *reward*
pieces below were missing.

## 3. Existing-save compatibility (item 18; Save/Migration section)

- `schemaVersion` stays 2 (`PersistentSaveV2`, unchanged by this phase).
- Every field this phase adds to `GameState` (`preDiscoveryFreeCookAttempts`) is **transient
  only** — never read by `persistence.ts`, never serialized, defaults to `0` on every fresh
  session load exactly like `lastPitzCredit`/`lastDiscovery`/`lastEfficiencyCredit` already do.
  No `PersistentSaveV1`/`PersistentSaveV2`/`migrateV1toV2` change; no new migration test needed
  for it specifically (it cannot desync from a save that never carries it).
- `RecipeCardState`'s new `preDiscoveryLocked?: boolean` field is likewise derived purely from
  `dex` at render time (`recipeCardState`, `src/state/pizzaSelect.ts`) — omitted (not `false`)
  whenever it doesn't apply, so an existing save's `RecipeCardState` shape is byte-identical to
  before this phase the instant `discoveredRecipeIds(dex).length > 0`, which is true for any
  save that has ever completed a single round.
- `PitzCredit`'s new `discoveryBonusPitz` field is additive and always present (never
  conditionally omitted) — this is a type-level addition to a transient RESULT/DISCOVERED display
  snapshot, not a save field.
- **Net effect for an existing player:** Dex, `pitzBalance`, `ownedIngredientIds`, `inventory`,
  `starterGrantClaimedRecipeIds` are all read back completely unchanged. Recipe Select's guided
  CTA is unaffected the instant `dex` has any discovery (true for every real existing save this
  repo could plausibly have, since a save is only ever created by actually playing). Lunch Rush
  unlocks under the identical condition. **No migration is required or added.**

## 4. Recipe Select: the pre-existing bypass (item 9; the issue's own primary scope item)

Before this phase, `PizzaSelectScreen`'s `RecipeDetail` CTA
(`src/screens/PizzaSelectScreen.tsx`) was disabled only for `card.kind === "LOCKED"`. A `"NEW"`
card (available, undiscovered) was always guided-selectable — including margherita on a
genuinely fresh save, since margherita is always `isRecipeAvailable`. This meant a brand-new
player could tap 「ピザを作る」→ Pizza Select → マルゲリータ → 「このピザを作る！」 and reach a
**guided** margherita round directly, bypassing Free Cooking (the discovery path) entirely — the
exact bypass Issue #198's own scope explicitly calls out.

**Chosen fix (closest to option A, minimal-change):** `recipeCardState` now sets
`preDiscoveryLocked: true` on a `"NEW"` card only when `discoveredRecipeIds(dex).length === 0` —
i.e., only for a genuinely fresh save, and only for margherita (the only recipe reachable at Dex
0). `PizzaSelectScreen`'s detail view swaps its CTA to a 「🎨 フリークッキングで探す」 button
(wired to the same `handleStartFreeCook` HOME already uses) instead of the guided 「このピザを作
る！」 button whenever this flag is set; the grid card also drops its `NEW` badge (misleading
pre-discovery) in favor of a 「🎨 フリークッキングで発見しよう」 line, reusing the existing
`pizza-select-card__unlock-hint` style. `gameReducer.ts`'s `SELECT_RECIPE` case adds the same
guard as a reducer-level backstop (any stray dispatch is rejected, not just the UI path) —
mirroring the existing "reducer re-checks `isRecipeAvailable`" pattern this file already
documents for the LOCKED case.

This satisfies the task's own comparison directly: **A** (discovered-only guided selection) is
applied, narrowly, only pre-first-discovery; **C** (Free Cooking as the primary CTA) is layered
on top at the HOME level (§6); **B**/**D** were not needed — margherita is not hidden or given a
separate "practice" mode, it is simply routed to the one discovery path that already exists.
**No regression for existing players:** the instant any recipe has ever been discovered,
`preDiscoveryLocked` is never set (the key is entirely absent from the object, not `false`), so
every existing "NEW, guided-selectable" recipe (e.g. funghi right after margherita) is completely
unaffected — pinned by `pizzaSelect.test.ts`.

## 5. First discovery flow (item 16/17)

Already fully built by Phase 3-1 (signature/matcher) and Phase 3-2 (Free Cooking + CONFIRM_BAKE
resolution) — re-verified, not reimplemented:

- `src/logic/discovery/signature.ts` / `matcher.ts` — pure, exact-match discovery, unchanged.
- `src/logic/discovery/freeCook.ts`'s `resolveFreeCookPizza` — recipe-free completion → matcher →
  matched recipe's own Completion Gate → `MATCHED` / `ORIGINAL` / `FAILED`. Unchanged.
- `gameReducer.ts`'s `CONFIRM_BAKE` re-labels a `MATCHED` free-cook pizza as that recipe before
  scoring; `REGISTER_TO_DEX` runs the **same** `registerScoreToDex`/`registerDiscoveryToDex` path
  for a free-cook MATCHED round as a guided round. `wasNewDiscovery`/`justDiscovered` are
  unchanged. Double registration is structurally impossible (same `state.phase !== "RESULT"`
  exactly-once guard as every other path) — re-confirmed by the existing
  `gameReducer.freeCook.test.ts` "NEW is exactly-once" test, still green.
- ORIGINAL (ambiguous/incomplete/no-match) is a normal finished result, not a failure
  (`ResultPanel`'s existing purple card) — unchanged.

**Conclusion:** tomato sauce + mozzarella + basil in Free Cooking already produces exactly
`NEW discovery → REGISTER_TO_DEX → Dex 1` with no reimplementation. This phase's only real
first-discovery-adjacent work is the **reward** (§7) and the **hint escalation** that leads a
player there (§6).

## 6. Hint escalation (item 13; the issue's own explicit "decide the retry count" ask)

Pre-existing state: `buildHintLine` (`src/data/hints.ts`) already had a per-recipe binary
`text`/`explicit` pair (toggled by the pre-existing `SHOW_HINT` action, a tap-for-more-detail
affordance unrelated to retries) and a free-cook branch with generic, non-escalating per-step
copy (`FREE_COOK_STEP_HINTS`). There was no retry-count-driven escalation and no ORIGINAL/FAILED
retry counter of any kind before this phase.

**Design:** reuses the existing free-cook hint slot — no new hint/dialogue system. A new
transient `GameState.preDiscoveryFreeCookAttempts: number`, carried through every "fresh round"
path via `ProgressionCarry` (so a retry/HOME-then-back doesn't reset it, but a genuine "start a
new session" does, since it is never persisted), increments by one in `CONFIRM_BAKE` whenever a
free-cook round resolves to anything other than `MATCHED` (ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH/
FAILED, all in the one existing branch) **while the Dex is still completely empty**
(`discoveredRecipeIds(state.dex).length === 0`). Once any recipe is discovered, the counter simply
stops moving (irrelevant from then on, since `buildHintLine` only reads it for a free-cook round,
and free cooking after a first discovery already gets the pre-existing generic copy at level 0 —
see below).

**Levels** (`level = min(attempts, 3)`, chosen because 3 attempts is enough for a player who
tried a full trio-based round twice without success to get real help, while leaving room to try
self-directed at least once more first — a hard number the task explicitly asked this audit to
pick, since it did not fix one):

| Level | Attempts | Copy |
|---|---|---|
| 0 | 0 (first attempt, or any player who has already discovered something) | pre-existing per-step generic free-cook copy, byte-identical to before this phase |
| 1 | 1 | 「気になる色の材料が3つあるよ…赤・白・緑を探してみよう！」 |
| 2 | 2 | 「赤いソース、とろける白いチーズ、香る緑のハーブを合わせてみたら？」 |
| 3 | 3+ | 「トマトソースを塗って、モッツァレラをのせて、バジルをちらして焼いてみよう！」 |

Level 1/2 never name an ingredient; level 3 names them but still requires the player to actually
place them (never auto-solves), satisfying the task's own "自力で発見できる余地を残す"
constraint. DOUGH's own hint is untouched at every level (unrelated to ingredient identity).

## 7. Discovery reward — OD-02 (item 17, Pitz reward)

Phase 3-2's own Result report (§6 finding 1) explicitly flagged this as unfinished, deferred to
this phase: *"ORIGINAL pays no Pitz... P3-3 must add the reward before any zero-recipe onboarding
ships."* Separately, `pitzReward.ts`'s pre-existing quality-multiplier bands mapped the entire
0-39 score band (i.e. every ★1 result) to multiplier `0` → **0 earned Pitz**, even for a
successfully registered round. A brand-new player's first (likely imperfect) bake could
legitimately land there.

OD-02 (already-approved Phase 2 authority, re-confirmed by the task prompt, **not invented
here**): a ★1 floor of 20 Pitz, plus a flat +50 first-discovery bonus. Implemented in
`src/logic/pitzReward.ts`:

- `PITZ_QUALITY_FLOOR = 20`: `calculatePitzReward`'s `earnedPitz` is now
  `Math.max(PITZ_QUALITY_FLOOR, round(baseReward × multiplier))` whenever `baseRewardPitz` is a
  real, positive value (an invalid/zero `baseRewardPitz` still earns 0 — the floor only ever
  applies to a genuine recipe reward, never conjures one from nothing). Since
  `scoring.ts`'s `starsFromTotal` never returns fewer than ★1 (there is no ★0), and
  `REGISTER_TO_DEX` only ever reaches this call for a non-FAILED (i.e. ≥★1) round, this floor is
  exactly "every real registered round pays at least 20 Pitz," not a fabricated new rule.
- `PITZ_FIRST_DISCOVERY_BONUS = 50`: `calculatePitzReward`/`applyPitzCredit` gain a
  `wasNewDiscovery` parameter; `discoveryBonusPitz` is `50` exactly when this round is a genuine
  first-ever discovery of the recipe being registered (the same `wasNewDiscovery` flag
  `REGISTER_TO_DEX` already computes), else `0`. Additive, folded into `PitzCredit.balanceAfter`
  (mirrors the existing Cooking Time CT2 `lastEfficiencyCredit.bonusPitz` "separate, additive
  bonus" convention already established on this same reducer case) and shown as its own
  「初回発見ボーナス」 row in `ResultPanel`'s existing Pitz breakdown `<details>`.
- Scope guard respected: this changes **only** the existing FREE-mode `pitzReward.ts` reward
  core (already scoped as FREE-only by Issue #38). Lunch Rush's `calculateMissionReward`
  (`src/logic/economy.ts`) is a completely separate function, untouched. **ORIGINAL pizzas still
  earn 0 Pitz** — deliberately left as-is; §11 below records this explicitly as a follow-up
  rather than inventing a number for it (not a deadlock: starters are unconditionally unlimited,
  so a player can always retry Free Cooking for free).

## 8. Lunch Rush lock at Dex 0 (item 12)

Pre-existing state: `handleStartLunchRush` (`src/App.tsx`) unconditionally dispatched
`SHOW_INTRO` — Lunch Rush was fully playable at Dex 0, picking orders from
`availableRecipeIds` (margherita only, at Dex 0). Not a crash risk, but contrary to the task's
explicit onboarding requirement ("まず1枚発見してから").

**Fix:** `App.tsx` derives `hasAnyDiscovery = state.dex.some((e) => e.discovered)` once, passes
`lunchRushLocked={!hasAnyDiscovery}` to `HomeScreen`, and `handleStartLunchRush` itself no-ops
when `!hasAnyDiscovery` (reducer-adjacent backstop, since `missionRunReducer`'s own `SHOW_INTRO`
case has no Dex awareness to gate on directly). `HomeScreen`'s ランチラッシュ button gets
`disabled`/`aria-disabled` (reusing the existing `.cta-button:disabled` muted style — no new CSS
needed for the button itself) plus a new short reason line, 「🔒 まず1枚ピザを発見しよう」
(`.home-lunch-rush-hint`), per the task's own "not a bare disabled, explain why" requirement.
Unlocks automatically and unconditionally the instant `hasAnyDiscovery` becomes true — no
separate flag to reset, no interaction with Achievement Reset (a future reset naturally re-locks
it, since it re-derives from `dex` every render).

## 9. HOME UI (item 8, item 8's Dex-0-empty-state concern)

- **Dex 0 is never an empty/error screen.** `DexOverlay` (`src/components/DexOverlay.tsx`)
  already rendered a full 15-card grid with every undiscovered recipe as a friendly
  「🔒 ？？？ / まだ見ぬピザ」 placeholder, plus a 「あと15種類！」 progress line, even before
  this phase — confirmed by reading the component; no change needed there.
  `HomeScreen`'s own Dex pill/menu-card sub-labels already read "0/15" (a real, honest number,
  not blank/broken) before this phase too.
- **What did change:** the hero speech bubble now reads 「まずはフリークッキングで最初の1枚を見
  つけよう！」 instead of the generic 「今日はどんなピザを作ろう？」 while `lunchRushLocked`, and
  フリークッキング takes the primary (visually leading) CTA slot in that state (design option C)
  — 「ピザを作る」 is *never removed*, only demoted to secondary styling/position, so every
  pre-existing HOME → Pizza Select navigation path stays reachable (this was tightened during
  implementation after the first draft accidentally hid it — see the Result report's own
  regression-fix note).

## 10. Reset / test-data / achievement clear (item 14)

`SettingsOverlay`'s existing Full Game Reset (Issue #89) already clears the one `localStorage`
save key and reloads, which re-runs the exact same fresh-load path as a genuine first launch
(`loadSave() → createDefaultSave() → applyStarterGrants() → createInitialGameState()`). Since §2
already establishes that path produces true Dex 0/starter-only state, and this phase's own new
transient fields are never persisted, **a reset already returns to true Phase 3-3 Dex 0 with no
code change** — confirmed end-to-end by this phase's own new E2E test
(`e2e/progression2-p3-3-onboarding.spec.ts`, "reset returns a played save to true Dex 0").

## 11. Scope guard confirmation

Confirmed **not** touched, matching the task's explicit exclusion list: full ingredient shop
implementation, the rest of Phase 3-4's production economy, any new unlock price, 172-recipe full
coverage, the 11 mechanics matrix, large-scale ingredient search/favorites UI, monetization,
Firebase, ranking. `docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json` and
`RECIPE_DISCOVERY_TARGET_IDS` (`src/data/discoveryCatalog.ts`) are both read-only inputs here,
unmodified.

**Recorded as a follow-up, not implemented here (deliberately, per the scope guard):** an ORIGINAL
free-cook pizza still earns 0 Pitz. Phase 3-2's own report flagged this as open; this phase closes
the *first-discovery* half of OD-02 (the floor + bonus) but does not invent a number for ORIGINAL
reward, since none is part of the given OD-01/OD-02 authority. A future slice should decide it
explicitly rather than this phase guessing.

## 12. Verdict

**One PR is safe.** The remaining work after this audit is: (a) the Recipe Select gate + HOME CTA
swap + Lunch Rush lock (small, self-contained UI/reducer changes, no save schema); (b) the hint
escalation (one new transient counter + one new hint-text table, reusing the existing free-cook
hint slot); (c) the OD-02 Pitz floor/bonus (a well-isolated change to `pitzReward.ts` alone, with
every call site updated). None of the three touches Scoring 2.0, the save schema, Lunch Rush's own
reward formula, or PR #196's own files. All three are already implemented, tested and verified as
of this report — see the companion Result report for the full test/E2E/Human Verification record.
