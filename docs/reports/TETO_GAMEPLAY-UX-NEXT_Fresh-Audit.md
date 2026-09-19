# Teto Pizza Game — Gameplay UX Next: Fresh Audit / Development Plan

READ-ONLY Fresh Audit. **No production code changed in this session** — `src/**` is byte-identical
to the audited `main` HEAD; only this report (and a short `docs/PROJECT_HANDOFF.md` addendum) are
added/changed.

## Audited main SHA

`c3741810cf2fce96a6cc2f422e919d9aa471b1ec` — fetched fresh via `git fetch origin && git rev-parse
origin/main` at the start of this session (matches the task's own reference SHA exactly; fresh
GitHub state was re-confirmed rather than assumed).

Recent history on `main` leading to this SHA (most recent first):

```
c374181 docs: Recipe Master Catalog 160 -- fresh data-first analysis (read-only, verdict A) (#81)
397ad41 Economy & Progression 1.0 EP2: Inventory atomic consumption at CONFIRM_BAKE (#82)
b784cd3 Economy & Progression 1.0 EP1: Recipe Unlock foundation (#80)
8918fe4 Save v2 / Inventory E1: wire InventoryState into GameState (foundation only) (#78)
654629f Economy & Progression 1.0: Fresh Design (docs-only, Margherita-only start) (#77)
```

So EP1 (Recipe Unlock) and EP2 (atomic inventory consumption at `CONFIRM_BAKE`) are both **already
merged into `main`** — this audit treats their code as ambient fact, not upcoming work.

## OPEN PR state (fresh, via `pull_request_read`/`list_pull_requests`, not cached text)

| PR | Title | Base SHA | Status vs. this audit |
|---|---|---|---|
| **#83** | Economy & Progression 1.0 **EP3: Shop 2.0 restock + placement Stock Gate** | `c374181` (current `main` HEAD) | **Active, in-flight EP3** — the exact "another session's EP3" the task describes is *not* merely planned, it already has code in an open PR. See §EP3 conflict matrix below; diff-stat obtained directly (`git diff --stat main...origin/claude/ep3-shop-inventory-restock-7nu0ao`), not guessed. |
| #72 | docs: correct `PROJECT_HANDOFF.md` PR #68 status to MERGED | `aaf56ed` (stale, pre-#75/#77+) | **Already represented on main.** `PROJECT_HANDOFF.md`'s own "RESULT 2.0 Slice 1" addendum (written after this PR was opened) already states "PR #68 above is now confirmed MERGED" — the one fact #72 exists to add. Superseded, not still-needed. |
| #46 | Issue #33: Dough Shaping D0 Fresh Audit / Interaction Design | `6e55491` (stale) | **Superseded.** D0 (and D0 revalidation, PR #51) merged; D1/D2 (PR #54), D3A (PR #65), and Sauce Free Boundary (PR #66) are all merged on top. This PR's own design content is fully obsolete. |
| #34 | Issue #32 Phase 1: unify Reference ingredient visuals | `6248108` (very stale) | **Superseded.** Issue #32 was completed via a different, later PR (#45, sauce parity + olive-oil visibility) after this PR's base SHA. Abandoned branch. |
| #3 | docs: Phase 2前基盤整備レポートにPages実測結果を反映 | `133b439` (earliest infra era) | **Superseded / historical.** Pre-dates almost the entire current codebase; no longer relevant to anything currently active. |

**No PR was closed or merged in this session** (out of scope, per the task). #72/#46/#34/#3 are
flagged here as candidates for a future housekeeping close, but that decision belongs to the repo
owner, not this audit.

## SSOT / PROJECT_HANDOFF confirmation

`docs/PROJECT_HANDOFF.md` and `docs/reports/TETO_ROADMAP-SSOT_FRESH-SYNC_2026-09-18.md` were both
read in full. Neither yet mentions EP3 (PR #83, opened after the roadmap sync doc's own audited
SHA) or any of the five UX items below — this audit is the first documented pass over them. A short
addendum has been appended to `PROJECT_HANDOFF.md` (see the diff) recording EP3's open-PR state and
this report's existence; no other SSOT rewrite was needed.

---

## 1. Current architecture ground truth (read fresh from `src/`, not from memory)

This section is the shared factual basis every UX-1..5 recommendation below cites back to.

### 1.1 Screens / state machine

- `App.tsx` owns three top-level `Screen`s (`"HOME" | "PIZZA_SELECT" | "GAME"`, `App.tsx:89`) plus
  two `useReducer`s: `gameReducer` (the per-pizza round, `GamePhase = "ORDER" | "PREPARE" | "BAKE" |
  "RESULT" | "DISCOVERED"`, `gameReducer.ts:27`) and `missionRunReducer` (Lunch Rush's own outer
  wrapper, `MissionMode = "FREE" | "INTRO" | "PLAYING" | "RESULT"`, `lunchRush.ts:95`). These are
  two independent reducers by design (`lunchRush.ts:9-18`) — Mission never duplicates round state,
  it only wraps it.
- `MakingStep = "DOUGH" | "SAUCE" | "CHEESE" | "TOPPING"` (`gameReducer.ts:35`) is the PREPARE
  phase's own forward-only sub-stepper. `CONFIRM_MAKING_STEP` (`gameReducer.ts:476-493`) is the
  **only** transition, and it is explicitly, permanently one-way: `nextMakingStep` clamps forward
  only (`gameReducer.ts:39-42`), there is no "go back" action anywhere in `GameAction`. TOPPING's
  own forward step is the pre-existing `START_BAKE`, not `CONFIRM_MAKING_STEP`.
- `makingStepToken` (`gameReducer.ts:54-58`) bumps on every step confirm (and on `RESET_PIZZA`) so
  `PizzaStage`/`IngredientTray`'s gesture-abort effects can invalidate an in-flight gesture the
  instant a step changes — this is the generic mechanism D0's Fresh Audit designed and every
  later system (Sauce dispense, Dough stretch) already reuses; a UX-2 tab implementation gets this
  abort-safety for free by continuing to key off the same token.

### 1.2 Lunch Rush's actual per-pizza loop today (UX-1's baseline)

Concretely, one Lunch Rush pizza today requires exactly these player taps, reconstructed from
`App.tsx`/`GameScreen.tsx`/`gameReducer.ts`:

1. `ORDER` phase renders `GameScreen.tsx:325-331`'s single CTA, labeled **「ピザを作る！」** for
   Mission mode (`mission.mode !== "FREE"`) — the player must tap it (`onBeginPrepare` →
   `BEGIN_PREPARE`) to reach `PREPARE`. **This is the literal button the task's UX-1 request names.**
2. `PREPARE`: DOUGH → SAUCE → CHEESE → TOPPING via `CONFIRM_MAKING_STEP`/「次へ」
   (`GameScreen.tsx:392-413`), then 「焼く！」 (`START_BAKE`).
3. `BAKE`: `BakeOverlay`'s own tap-to-confirm (`onConfirmBake` → `CONFIRM_BAKE`).
4. `RESULT` (Mission only, `isMissionPlaying`): `MissionServePanel` (`MissionServePanel.tsx`)
   shows stars/score/served-count and one CTA, **「次の注文へ」** → `handleMissionServeNext`
   (`App.tsx:295-306`), which dispatches `SERVE` then (if not expired) `MISSION_NEXT_ORDER`.
5. `MISSION_NEXT_ORDER` (`gameReducer.ts:610-616`) registers the Dex entry and calls
   `nextMissionOrderState`, which — via `buildOrderState` — **always lands back at `phase: "ORDER"`**
   (`gameReducer.ts:203`, unconditional for every "start a new round" path). So step 1's
   「ピザを作る！」 tap is required again for every single pizza.

So today's real per-pizza tap count for Lunch Rush is: 「ピザを作る！」 → (make) → 「次へ」×N →
「焼く！」 → confirm bake → 「次の注文へ」 → back to step 1. The task's UX-1 request is specifically
about collapsing the boundary between step 5 and step 1 (RESULT confirm → next ORDER's own gate),
not about removing BAKE confirm or the making steps themselves — nothing in the task asks for that,
and Recipe/Bake/Sauce scoring must not be touched by this slice.

Mission's own timer (`MissionClock`, `lunchRush.ts:43-59`) is **wall-clock-absolute**
(`endsAt - now`, immune to tick throttling) — any UX-1 design must preserve this; it never becomes
some new relative "restart the clock on auto-advance" model.

### 1.3 Pizza Select today (UX-4's baseline)

`PizzaSelectScreen.tsx` renders a `role="list"` **CSS grid** (`pizza-select-grid`,
`PizzaSelectScreen.tsx:99-108`) of all 7 `RECIPES`, one `RecipeSelectCard` each — this is the
"multiple cards, vertical scroll" layout the task's UX-4 wants replaced with a 1-screen
pager/carousel. `recipeCardState` (`pizzaSelect.ts:49-67`) derives exactly three card kinds —
`COMPLETED` (name + stars + BEST), `NEW` (name + badge), `LOCKED` (name or `？？？` + hint) — purely
from `isRecipeAvailable(recipe, dex, ownedIngredientIds)` and the Dex entry; **no separate stored
"seen"/"unlocked" flag exists anywhere**, so a carousel rewrite only needs to change how these three
kinds are *laid out*, never how they're computed.

Fugazza's mystery lock (`recipes.ts:47` `mysteryLock?: boolean`, only `fugazza` sets it,
`recipes.ts:163`) is enforced entirely inside `unlockHintFor` (`pizzaSelect.ts:28-47`): a mystery
card's hint is *always* a star-count line (`あと★N で解禁`), never the recipe name or the
prerequisite ingredient name — `pizzaSelect.test.ts:104-110` pins this exactly (`unlockHint` must
not contain `たまねぎ` or `フガッサ`). **Any UX-4 pager implementation must reuse `recipeCardState`
verbatim and never branch on `recipe.id === "fugazza"` itself** — the existing test suite is the
guardrail, but a hand-rolled carousel that re-derives lock state independently could accidentally
leak the name through a card-index label, an aria-label built from `recipe.nameJa` before checking
`mystery`, etc.

7 production recipes today (`recipes.test.ts:35-46`): margherita, funghi, marinara, genovese,
bismarck, quattro-formaggi, fugazza (#7, mystery). The task's caution about a "53-entry Recipe
Master" not being shown in production is already satisfied structurally — `PizzaSelectScreen.tsx`
iterates `RECIPES` (`recipes.ts`'s own array), which has exactly 7 entries; there is no code path
that could accidentally render a larger catalog. (Recipe Master Catalog 160 — PR #81, current HEAD
— is a separate, explicitly non-production data-audit artifact per its own title/verdict; it is not
wired into any screen.)

### 1.4 Lunch Rush's saved result today (UX-3's baseline)

- `MissionMetrics` (`missionScoring.ts`, per-run: `servedCount`, `totalQualityScore`/average,
  `bestQualityScore`) is **entirely in-memory**, reset to `EMPTY_MISSION_METRICS` on every `START`
  (`lunchRush.ts:142-148`) — never persisted itself.
- `missionScore(mission.metrics)` is computed once the run ends and written via
  `persistMissionBest(LUNCH_RUSH_MISSION_ID, score)` (`App.tsx:238-241`) into
  `PersistentSaveV2.missionBest: Record<string, number>` (`persistence.ts:114-121`) — **a single
  monotonic "never goes down" BEST number**, keyed by mission id. `isNewMissionBest` gates the
  actual write (`persistence.ts:537-546`) so a worse run never overwrites the stored BEST.
- There is **no run history at all** — no list of past runs, no timestamps, no per-run breakdown
  survives past the single RESULT screen (`MissionResultOverlay`) for that run. "自己ベスト" already
  exists (the one `missionBest` number); "ローカルランキング" (a local *list*, even single-player) and
  "過去ベスト記録" (a history) do not exist in any form today.
- `PersistentSaveV2` (`persistence.ts:114-121`, `schemaVersion: 2`) is validated/sanitized
  field-by-field (`sanitizeSave`, `persistence.ts:340-354`) with a documented, tested v1→v2
  migration pattern (`migrateV1toV2`, `persistence.ts:276-285`) — **a v2→v3 addition for a bounded
  run-history array is a small, low-risk, purely-additive schema change that follows an
  already-proven pattern**, not a novel migration risk.

### 1.5 Progression / reset primitives today (UX-5's baseline)

- `DexState` (`dex.ts:13-21`) is a flat array of `{recipeId, discovered, bestScore, bestStars,
  timesMade}`. `registerScoreToDex` (`dex.ts:66-94`) is the **only** writer; BEST is monotonic by
  construction (`isBetterQuality`, `dex.ts:55-58`).
- `RecipeUnlockCondition` (`recipes.ts:19-26`): `requiresRecipeId` (chain, reads `dex.discovered`)
  AND/OR `minTotalStars` (reads `totalStars(dex)`, i.e. `Σ bestStars` — `mastery.ts`, not read in
  this session but referenced consistently across `progression.test.ts`). **Recipe unlock is a
  pure function of `dex` alone** — it never reads `ownedIngredientIds` for the chain/star axis.
  Ingredient *ownership* (`isRecipeAvailable`, `progression.ts`, confirmed via
  `progression.test.ts:264-277` "フガッサ needs both axes") is the second, independent axis: a
  recipe's `unlockCondition` being satisfied and its `requiredIngredients` all being in
  `ownedIngredientIds` are AND'd together, but **only the first axis is `dex`-derived** — the
  second lives entirely in `ownedIngredientIds`/`inventory`, never in `dex`.
- `clearSave(storage)` (`persistence.ts:561-568`) **already exists** — "kept for tests and future
  dev/reset use", explicitly not wired to any UI (`persistence.ts`'s own doc comment). It wipes the
  entire `localStorage` key, i.e. it is today's only implemented reset primitive and it is
  all-or-nothing (equivalent to the task's "Save完全削除" candidate, not "実績だけ").
- **No per-field reset function exists yet** (no "reset just `dex`", no "reset just `inventory`",
  no "reset just `pitzBalance`") — UX-5 is genuinely new code, not wiring up something already built.
- **EP4 (not yet implemented anywhere — no PR, no merged code)** is designed
  (`docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md:41-47,167-225`) to auto-grant a
  `starterStockPlays = 10`-pizzas'-worth of every new ingredient a recipe needs **the instant that
  recipe's chain/star gate is satisfied** — i.e., EP4 will make ingredient ownership/inventory a
  side effect that can fire again if its own "already granted" tracking is re-armed. The design
  doc explicitly flags this as unresolved implementation detail (`Fresh-Design.md:518-521`):
  *"whether 'already granted' is tracked as a new persisted set or derived implicitly from 'is the
  ingredient already OWNED' is an implementation-time call"* — and separately (`:488-492`) that this
  guard "needs an exactly-once guard... a re-triggerable grant bug would over-grant 10 plays' worth
  of stock per accidental re-fire." **This is the exact hazard the task's UX-5 section warns about**,
  and it is not hypothetical scaremongering — it is a real, named, still-open EP4 design question
  that a naively-scoped "実績だけクリア" could turn into a live exploit once EP4 ships. See §5's
  design and the cross-cutting guard recorded there.

---

## 2. UX-1 — Lunch Rush continuous progression

### Current state
See §1.2. The player-visible seam the task wants removed is specifically: `MissionServePanel`'s
「次の注文へ」 tap lands at a fresh `ORDER` phase, which then requires a *second*, separate
「ピザを作る！」 tap before PREPARE reopens. Two taps do the same conceptual job ("I'm ready for the
next pizza"); Lunch Rush is the *only* mode where this double-gate matters for tempo (FREE's own
ORDER→PREPARE gate is single-pizza-per-visit by design, unaffected here).

### Options compared

| Option | Mechanism | Tempo | Result visibility | Risk |
|---|---|---|---|---|
| **A. Immediate auto-advance** | `handleMissionServeNext` also dispatches `BEGIN_PREPARE` right after `MISSION_NEXT_ORDER`, in the same handler tick — no extra CTA, no delay. | Fastest. | `MissionServePanel`'s score/stars view is still shown (unchanged) *before* the tap; nothing is lost, since the score screen already required an explicit tap to leave. | Lowest — zero new UI, one new dispatch line, reuses two already-existing actions in the already-existing handler. |
| **B. RESULT confirm → 次の注文 CTA (current label kept), but skip ORDER's own separate gate** | Same as A structurally — the "次の注文へ" button *is* the confirm-and-advance action; this is really Option A described from the player's perspective, not a different option. | Same as A. | Same as A. | Same as A — listed separately only because the task asked for it as a distinct point of comparison; on inspection it collapses into A once `MISSION_NEXT_ORDER` already lands at ORDER unconditionally. |
| **C. Auto-advance after N seconds with no tap at all** | Timer-driven transition straight from `MissionServePanel` into PREPARE. | Fastest in theory, but removes the player's own pacing control. | Risk: a player who wants an extra half-second to read their score/stars is forced to keep up with the timer instead of the timer being paused for that beat — the opposite of "テンポと結果確認の両立." | Highest — a new timer concept parallel to Mission's own clock, extra states to test (what if the player starts a gesture during the auto-transition window?), and directly fights the task's own "結果確認" goal instead of serving it. |

### Recommendation

**Option A** (== the collapsed B): keep `MissionServePanel`'s existing tap-to-confirm score screen
completely unchanged (this already satisfies "結果確認" — the player is never rushed off it), and
change only what that one tap *does*: instead of landing at `ORDER` and waiting for a second
「ピザを作る！」 tap, land straight at `PREPARE`. Concretely:

```
handleMissionServeNext():
  dispatch(SERVE)
  if not expired:
    dispatch(MISSION_NEXT_ORDER)   // unchanged — still lands at phase "ORDER"
    dispatch(BEGIN_PREPARE)        // NEW — immediately advances ORDER -> PREPARE
```

This is additive (one new dispatch call in one existing handler), touches no reducer case, no
scoring, no Recipe/Bake logic, and is naturally scoped to Mission alone (`handleMissionServeNext` is
never called from FREE — FREE's own ORDER→PREPARE gate, `onBeginPrepare` wired to the visible
「フリープレイ」/「ピザを作る！」 button, is completely untouched). **FREE mode is unaffected by
construction**, not by an added conditional — there is no shared code path to gate.

One open detail worth flagging, not blocking: `BEGIN_PREPARE` also recomputes `hint`
(`gameReducer.ts:299-304`) from the brand-new empty pizza/DOUGH step — this already happens
correctly for the existing separate tap today, so auto-dispatching it changes nothing about what
hint text appears, only when the dispatch happens.

---

## 3. UX-2 — Making-step tabs (生地 | ソース | チーズ | トッピング | 焼く)

### Major finding: 80% of this already exists, unused

`IngredientTray.tsx:307-337` already renders a `category-tabs` row with **exactly** the visual
contract the task describes — completed (✓-prefixed, `category-tab--completed`), active
(`category-tab--active`), and locked/not-yet-reachable (`category-tab--locked`, `disabled`) states
— for the `SAUCE`/`CHEESE`/`TOPPING` categories (`CATEGORY_ORDER`, referenced but not itself printed
in this audit's reads; inferred length-3 from `activeIndex`/`isCompleted` logic operating over
sauce/cheese/topping only). The tab's own code comment (`IngredientTray.tsx:311-316`) states the
exact constraint this task needs to respect: *"the making flow is one-way... only the current
step's tab is ever interactive... this is only the UI half of 'no backward-editing path'"* — i.e.,
**this exact tab strip was already deliberately built forward-only**, and `onClick={() =>
onChangeCategory(category)}` already fires on every tab (not just enabled ones would, if `disabled`
didn't block it) — but `onChangeCategory` is wired to `App.tsx:327`'s **explicit no-op**
(`handleChangeCategory`, with its own comment: *"tabs no longer freely switch, so there is nothing
left for a category-tab click to do... kept as an explicit no-op... to make that 'does nothing'
intentional"*).

So today's tabs are **purely decorative progress indicators** for 3 of 4 making steps, already
disabled for anything but the current step, and completely inert even when tapped. What's actually
missing for the task's request:

1. **DOUGH has no tab at all** — the whole `IngredientTray` (and therefore its `category-tabs` row)
   is hidden entirely while `makingStep === "DOUGH"` (`GameScreen.tsx:360`, `IngredientCategory` has
   no `"dough"` value — `makingStepToCategory` maps `DOUGH → "sauce"` purely as a placeholder,
   `App.tsx:64-75`, explicitly documented as never actually rendered for DOUGH).
2. **BAKE has no tab** — `IngredientCategory` doesn't model a 5th phase-level entry at all; BAKE is
   a different `GamePhase`, not a `MakingStep`.
3. **Tapping the tab does nothing** even where it exists (the no-op above).

### Design for "completed / current / next-reachable / unreached" tab semantics

The task explicitly asks for four states; this audit's recommendation reuses the existing pattern's
three states (completed/active/locked) and shows why a fourth ("next-reachable") does not need to
exist as a *separate* interactive state given the current one-way reducer contract:

| Task's requested state | Tap behavior recommended | Why |
|---|---|---|
| **完了済み工程** (before current) | Non-interactive (view-only highlight, ✓ prefix) — same as today's `category-tab--completed`. | The reducer has no backward transition (`CONFIRM_MAKING_STEP` is forward-only, no such action exists in `GameAction`). Making a completed tab tappable-to-jump-back would need a new reducer capability (see "Bigger option" below) — out of this slice's scope as a *minimal* tab UI. |
| **現在工程** (active) | **Tappable — replaces/duplicates the 「次へ」 CTA's forward action.** Tapping the active DOUGH/SAUCE/CHEESE tab dispatches `CONFIRM_MAKING_STEP` exactly like today's 「次へ」 button; tapping the active TOPPING tab dispatches `START_BAKE` exactly like today's 「焼く！」 button. | This is the one meaningfully *new* interactive behavior the task actually asks for ("タブを押して工程を切り替えたい"), and it maps 1:1 onto an already-existing, already-tested reducer transition — no new reducer code needed. |
| **次に進める工程** | Not applicable as a separate state under a forward-only model — "next" is always exactly the tab that becomes active the instant the current one confirms; there is no state where two tabs are simultaneously "reachable next" to distinguish from "current." | Collapsing "current" and "next-reachable" into one tappable state is a direct, honest consequence of the reducer already being single-active-step. |
| **未到達工程** (after current) | Non-interactive, dimmed/locked, same as today's `category-tab--locked`/`disabled`. | Unchanged from today. |

BAKE's tab: recommend treating it as a 5th, purely **visual** (never tappable) entry appended to the
strip once TOPPING is active/completed — it reflects "焼く工程が次にある" without needing BAKE to
become a `MakingStep` value or duplicating `START_BAKE`'s own dedicated, already-prominent 「焼く！」
CTA. Making the BAKE tab itself launch `START_BAKE` would be redundant with the existing bake
button sitting right below it in the same `prepare-bake-bar` and risks two same-purpose controls
competing for the same tap.

### 「次へ」 button: keep, remove, or fold into the tabs?

**Recommendation: keep the CTA, add the tabs as a second, equivalent affordance — do not remove
「次へ」/「焼く！」 in this slice.** Reasoning:

- The CTA already carries the DOUGH step's own `disabled={state.makingStep === "DOUGH" &&
  !doughShapeComplete}` gate (`GameScreen.tsx:405`) — the *only* step-completion gate that exists.
  A tab tap must respect this identical gate (disabled DOUGH tab until `doughShapeComplete`), so the
  tab and the button are two skins over the exact same guarded action, not two independent paths
  that could disagree.
- Removing the CTA entirely on day one removes a large, unambiguous touch target
  (`cta-button--bake`, already sized for Issue #47's touch-target fix) in favor of a smaller tab
  chip as the *only* way to advance — a real mobile-usability regression risk with no playtesting
  evidence yet that tabs alone are enough.
- Keeping both, with the tab's onClick literally calling the same handler prop the CTA already
  calls (`onConfirmMakingStep`/`onStartBake`), is a few-line addition with no new reducer surface
  and no way for the two controls to drift out of sync (there is only one dispatch to make either
  way).
- A future slice, once real device feedback exists, can decide to shrink or remove the CTA if the
  tabs alone prove sufficient — that is a Human-Feel-gated decision, not a Fresh-Audit one.

### Bigger option, explicitly out of scope for this slice

A "true" tappable-tab experience where completed tabs let the player **go back and re-edit** a
prior step (e.g., re-paint sauce after cheese is placed) would require: a new backward-transition
reducer action, a decision on whether re-entering DOUGH/SAUCE after CHEESE/TOPPING exist silently
clears downstream state or preserves it (directly implicating the SSOT's own "avoid silent
normalization" guard and "preserve player-made shape/placement through later steps" guard), and
reworking `makingStepToken`'s current "step confirm invalidates in-flight gestures" contract into
something that also handles a backward jump correctly. This is materially larger and is recorded
here as an explicit, separate future option — **not implied or half-built by the recommended
minimal slice above**, which never touches backward navigation at all.

---

## 4. UX-3 — Lunch Rush ranking (self-best / local ranking / history)

### Current state
See §1.4: exactly one persisted number (`missionBest["lunch-rush"]`), no history, no per-run
records. "自己ベスト" (self-best) already exists in the sense of a single number; the task's
"ローカルランキング" (a list, even single-device/single-player) and "過去ベスト記録" (a history) do
not exist in any form.

### What "safely implementable, GitHub Pages only" means here

GitHub Pages serves static files — there is no server-side write path, no database, no per-user
identity beyond a single browser's `localStorage`. Everything in Phase 1 must therefore be:
client-only, same-device, same-browser, resettable by the player clearing site data. This is not a
new constraint this audit is inventing — it's the same constraint `persistence.ts`'s entire existing
design already lives under.

| Candidate | Feasible on GitHub Pages alone? | Design |
|---|---|---|
| **Self-best** (single BEST number) | **Already implemented.** | No change needed — `missionBest`, unchanged. |
| **Local ranking** (a bounded list of this device's own past runs, ranked) | **Yes, safely.** | Add `missionRuns: Record<string, MissionRunRecord[]>` to a new `PersistentSaveV3` (`schemaVersion: 3`), where `MissionRunRecord = { score: number; servedCount: number; averageQuality: number; completedAt: number /* epoch ms */ }`. Cap the array (e.g. top 10 by `score`, ties broken by earliest `completedAt`) so it can never grow unbounded — same "clamp, never let a field grow forever" discipline `consumePizzaInventory`'s clamp-to-zero and `MISSION_REWARD_SERVE_BONUS_CAP` already follow elsewhere in this codebase. Write it from the same `useEffect` that already calls `persistMissionBest` (`App.tsx:238-241`), so there is exactly one place a Mission RESULT gets persisted, not two effects racing. |
| **Past-best records** (a small "history of BESTs over time," distinct from every-run history) | **Yes, safely**, but recommend treating it as the *same* list as "local ranking" above rather than a third parallel structure — a ranked top-10 list already *is* "past best records" once sorted; a separate "BEST-only-when-it-was-a-new-BEST" log is a plausible alternative shape but adds a second array to maintain for marginal benefit over just keeping the top-N. Recorded as an open product decision (§8) rather than pre-decided here. |
| **Online / cross-device ranking** | **No — out of Phase 1 by construction.** GitHub Pages has no backend to compare scores across devices/players. | Recorded only as a boundary: if ever built, it needs a separate hosted service (a small API + datastore) that the static site calls — a materially different, much larger project (auth/anti-cheat/moderation all become relevant) that this repo's current GitHub Pages hosting cannot provide alone. **Do not build any placeholder online-ranking UI or schema field now** — an unused `onlineRank` field would be exactly the kind of "fabricated" forward-looking data the SSOT's guards warn against (`docs/reports/...`'s repeated "do not fabricate... progression data" language applies here by the same logic it applies to Recipe/Reference data). |

### Migration

`schemaVersion: 2 → 3` follows the exact `migrateV1toV2` pattern (`persistence.ts:276-285`):
`migrateV2toV3` carries every v2 field through unchanged and initializes `missionRuns: {}` (empty,
never fabricated from anything — a pre-v3 save simply has no run history, which is honest, not a
bug). `sanitizeSave`'s existing per-field-tolerant repair discipline
(`sanitizeDex`/`sanitizeMissionBest`/`sanitizeInventory`'s shared "one bad entry doesn't cost the
rest" pattern) extends naturally to a new `sanitizeMissionRuns`.

### UI

Out of this audit's scope to design pixel-for-pixel, but the natural home is `MissionResultOverlay`
(today shows one run's own score/stars/BEST-flag) gaining a small "過去の記録" expandable section, or
a new small view reachable from HOME/Lunch Rush's own entry point — a UI decision, not an
architecture one, and left for the implementation slice.

---

## 5. UX-4 — Pizza Select as one screen (pager/carousel)

### Current state
See §1.3 — a scrolling CSS grid of 7 cards.

### Design: single-recipe pager

Replace `pizza-select-grid`'s multi-card grid with a single-card view plus ← 前へ / 次へ → controls
and a `作る` CTA, all sized to fit 390×844 without scroll — exactly the layout the task specifies.
Minimum on-screen content per the task: recipe name, visual (`PizzaThumbnail`, reused unchanged),
stars/BEST or locked state, unlock hint, 作る CTA, 前へ/次へ. All of this data is already computed by
the unchanged `recipeCardState`/`RecipeSelectCard` — **this is a layout change, not a data-model
change**: `RecipeSelectCard`'s existing JSX branches (COMPLETED/NEW/LOCKED) can be reused almost
verbatim inside a single-card container; only the surrounding grid/scroll chrome changes.

New minimal state needed: one `currentIndex: number` (local `useState` in `PizzaSelectScreen`,
0..6, wrapping or clamping at the ends — a product decision, see §8) driving which single
`RECIPES[currentIndex]` is shown. No `GameState`/reducer/persistence change at all — this is
presentation-only, structurally the same "purely derived, nothing new persisted" shape
`recipeCardState` already has.

**Forward-compatibility for a future larger catalog**: index into `RECIPES` by position, never by a
hard-coded count or id list, and keep the ← / → controls' disabled-at-ends (or wraparound) logic
purely a function of `RECIPES.length` — this already generalizes to more recipes with zero
architecture change, satisfying the task's "同じpager/carousel architectureを使える設計" requirement
without any speculative extra code now.

**Fugazza mystery-lock safety**: because the pager renders through the same `recipeCardState`, no
new leak surface is introduced — but the *pager's own chrome* (e.g., a "6 / 7" position indicator,
or a peek/preview of the "next" card's name in a carousel-style transition) is a genuinely new
surface that didn't exist in the grid layout and must be explicitly checked: a page-position counter
is safe (index-only, no name), but any "peek at the next card" transition style must render the
next card through the same LOCKED/mystery branch, never bypass it for a preview thumbnail.

### Compared: buttons-only vs. swipe + buttons

| Option | UX | Risk |
|---|---|---|
| **前へ/次へ buttons only** | Simple, fully accessible (keyboard/screen-reader unaffected — buttons already have `aria-label`s in the current cards), no gesture-conflict surface. | Lowest — no new touch/pointer handling at all; reuses ordinary `<button onClick>`. |
| **Swipe + 前へ/次へ buttons** | More native-feeling on a phone. | Real, non-trivial: `PizzaSelectScreen` currently has *zero* pointer/gesture code — this would be the first swipe gesture in a screen that isn't `PizzaStage`/`IngredientTray`. Must not conflict with the browser's own back-swipe-to-navigate gesture at screen edges (a common mobile-web footgun), and needs its own abort/cancel handling independent of (but ideally modeled after) the existing `resetToken`/pointer-cancel patterns already proven in `PizzaStage.tsx`/`IngredientTray.tsx`. |

**Recommendation: ship buttons-only first.** It fully satisfies the task's 1-screen requirement and
every listed minimum-content item with the lowest implementation/regression risk, and does not
foreclose adding swipe later as a pure enhancement on top of the same `currentIndex` state (swipe
would just call the same `setCurrentIndex` the buttons already call). Recommending buttons+swipe as
day-one scope would roughly double this slice's size and testing surface for a gesture the task
itself only asked to have "compared," not mandated.

---

## 6. UX-5 — Test Achievement / Progress Reset

### Current state
See §1.5. `clearSave` exists (all-or-nothing, unwired), no per-field reset exists, and EP4
(unimplemented) has a named, still-open "exactly-once starter-grant guard" design question that
directly interacts with whatever UX-5 builds.

### Exact scope definition: what "実績だけクリア" deletes vs. keeps

This is the task's own central request ("何を削除するか / 何を保持するか を厳密に定義する"). Recommended definition:

**実績だけクリア (Achievement/Dex-only reset) — deletes:**
- `dex`: every entry's `discovered`/`bestScore`/`bestStars`/`timesMade`, back to `EMPTY_DEX`.

**実績だけクリア — explicitly preserves (never touched):**
- `ownedIngredientIds` (purchased/starter ingredients stay owned).
- `inventory` (consumable stock stays exactly as-is).
- `pitzBalance` (currency stays exactly as-is).
- `missionBest` / (future) `missionRuns` (Lunch Rush records are a separate achievement axis from
  recipe discovery and are not part of "Recipe Unlock" testing at all).

**Why this specific split, not "reset everything but Pitz" or similar**: the task's own stated
purpose is *"Margherita → Funghi → Marinara → ... という Recipe Unlock を Fresh 状態から何度でも
テストする"* — recipe unlock's chain/star axis (§1.5) is a pure function of `dex` alone. Clearing
only `dex` genuinely re-locks every chain-gated recipe (their `unlockCondition.requiresRecipeId`/
`minTotalStars` checks read `dex` and nothing else) and restores the Pizza Select LOCKED/mystery
presentation from scratch, **without** touching the orthogonal ingredient-ownership axis — so a
tester who already owns `onion` from real purchase testing doesn't have to re-buy it every single
reset cycle just to re-test the *discovery* chain. This is a deliberately narrow, single-purpose
reset — exactly what "実績だけ" (achievements *only*) should mean, as distinct from the broader
reset tiers below.

### Cross-cutting guard this reset design imposes on EP4 (must be recorded now, before EP4 ships)

Because EP4's starter-stock grant (§1.5) will trigger off "a recipe's chain/star gate just became
satisfied," and this reset only clears `dex` (the very state that gate reads), **EP4's own
"already granted" exactly-once tracking must never be derived from `dex`/discovery state** — if it
were (e.g., "grant starter stock the first time `registerScoreToDex` discovers this recipe"), then
Achievement Reset would trivially re-arm it: reset `dex` → re-discover the same recipe by playing it
again → EP4 grants another 10 plays' worth of the same ingredient for free, with `ownedIngredientIds`
already satisfied so nothing else gates it. This is precisely the exploit the task warns against,
and it is avoidable by construction: **EP4's grant must key off `ownedIngredientIds` gaining a new
id for the first time** (i.e., fire only once per ingredient id ever entering
`ownedIngredientIds`, via its own dedicated tracking — e.g. a persisted `starterStockGrantedIds: Set
<string>` alongside `inventory`, independent of `dex`) — a boundary Achievement Reset (which never
touches `ownedIngredientIds`) can never cross, no matter how many times it runs. This is a design
requirement to hand to EP4's own implementation slice, not something to build in this session (EP4
doesn't exist yet), but it must be decided *before* EP4 ships, or UX-5 and EP4 will conflict at
runtime the moment both exist. Recorded here as the resolution to EP4's own still-open design
question (`Fresh-Design.md:518-521`, quoted in §1.5).

### Broader Test Utilities menu (future candidates, not all built now)

| Candidate | Deletes | Keeps | Confirm dialog? |
|---|---|---|---|
| **実績だけクリア** (this slice's actual scope) | `dex` only | everything else | Yes — required (see below) |
| Inventory reset | `inventory` only | `dex`/`ownedIngredientIds`/`pitzBalance`/`missionBest` | Yes |
| Pitz reset | `pitzBalance` only (→ 0) | everything else | Yes |
| 全進行初期化 (full progression reset) | `dex` + `ownedIngredientIds` (→ Starter Set) + `inventory` + `pitzBalance` (→ 0) | `missionBest`/`missionRuns` (arguable — could go either way, §8) | Yes, with stronger wording |
| Save完全削除 | Everything, via the already-existing `clearSave()` | nothing | Yes, strongest wording |

Recommend implementing **only "実績だけクリア"** in the first slice (it's the one the task's own
stated purpose actually needs), leaving the other four as named, designed-but-not-built future
candidates — consistent with the task's own "将来的なTest Utilities候補" framing.

### Confirmation dialog

Required, per the task's own instruction ("誤操作防止の確認dialogを必須候補とする") — treat this as a
hard requirement, not optional: a native `window.confirm` (the same mechanism `GO_HOME_CONFIRM_MESSAGE`
already uses, `App.tsx:91-92,401`) is sufficient and consistent with existing UI conventions; no new
modal component is required for this slice.

### "Public Demo でもテスト可能" placement

Recommend a small, clearly-labeled dev/test entry point reachable from HOME (e.g., a low-emphasis
"テスト用" affordance, gated behind nothing build-flag-specific — the task explicitly wants this
testable in the public demo, not hidden behind a dev-only env flag) rather than folding it into
`ShopOverlay` or any other EP3-touched surface (see §7 — `ShopOverlay.tsx` is EP3's single most
heavily modified file; adding UX-5's UI there would create an unnecessary, avoidable merge conflict
with an unrelated in-flight PR).

---

## 7. EP3 conflict matrix

PR #83 (`claude/ep3-shop-inventory-restock-7nu0ao`, base = this audit's own SHA `c374181`) touches
exactly these files (`git diff --stat`, confirmed directly against `main`):

```
src/App.css                            |  39 ++
src/App.test.tsx                       |  82 +++++
src/App.tsx                            |   8 +
src/components/ShopOverlay.tsx         |  79 +++-
src/data/ingredients.ts                |  35 +-
src/logic/economy.test.ts              | 174 +++++++++
src/logic/economy.ts                   |  78 ++++
src/state/gameReducer.restock.test.ts  | 239 +++++++++++++
src/state/gameReducer.test.ts          |  12 +-
src/state/gameReducer.ts               |  78 ++++
src/state/inventory.test.ts            |  60 ++++
src/state/inventory.ts                 |  42 +++
src/state/persistence.test.ts          |  17 +
```

| UX slice | Files it needs | Overlaps EP3's files? | Verdict |
|---|---|---|---|
| **UX-1** (Lunch Rush continuous progression) | `App.tsx` (handler only), `screens/GameScreen.tsx`, `mission/lunchRush.ts` | `App.tsx` — **yes, but minimally**: EP3's own `App.tsx` change is only +8 lines (almost certainly Shop-open wiring); UX-1's change is a few lines inside `handleMissionServeNext`, an unrelated function. | **Parallel with EP3, low risk.** Diff regions won't collide; still worth rebasing after EP3 merges if both land close together, purely to avoid a manual 3-way merge headache, not because of a real logic conflict. |
| **UX-2** (Making-step tabs) | `screens/GameScreen.tsx`, `components/IngredientTray.tsx`, possibly `App.tsx` (if the tab needs a new prop), `App.css` | None of EP3's files listed above include `GameScreen.tsx` or `IngredientTray.tsx`. `gameReducer.ts` is touched by EP3 (+78/-lines) but in restock/placement-gate logic (Shop 2.0), a structurally distant region from `CONFIRM_MAKING_STEP`/`MakingStep`. | **Parallel with EP3.** If UX-2 needs zero reducer changes (the minimal design in §3 needs none — it only wires an existing action to a new tab onClick), there is no `gameReducer.ts` touch at all, eliminating even the low residual risk. |
| **UX-3** (Lunch Rush ranking) | `state/persistence.ts` (schema v3), `mission/lunchRush.ts`, `App.tsx` (effect only) | EP3 touches `persistence.test.ts` only, not `persistence.ts` itself. Zero file overlap. | **Fully parallel with EP3.** |
| **UX-4** (Pizza Select pager) | `screens/PizzaSelectScreen.tsx`, `state/pizzaSelect.ts`, `App.css` | Zero overlap with EP3's file list. | **Fully parallel with EP3.** |
| **UX-5** (Test Achievement Reset) | `state/persistence.ts` (new reset fn), a new small UI surface (recommend: new component, NOT `ShopOverlay.tsx`), `App.tsx` (wiring) | If UX-5's UI is placed in `ShopOverlay.tsx` (EP3's most heavily touched file, +79 lines), real conflict. If placed in a new standalone component per §6's own recommendation, zero overlap. | **Parallel with EP3, conditional on following §6's placement recommendation** (do not add UX-5's entry point inside `ShopOverlay.tsx`). |

**Overall: all five UX slices can start in parallel with EP3 today**, none is blocked waiting for
EP3 to merge first. The only file-level caution is `App.tsx`/`gameReducer.ts`, both touched by EP3
in small, structurally distant regions from what UX-1/UX-2 need — real conflict risk is low, but
whichever of EP3/UX-1/UX-2 merges second should rebase onto the first rather than assuming a clean
auto-merge, since GitHub's merge UI can't see "distant region" the way this audit's diff-review did.

---

## 8. Implementation slices

Each sized for a single ~30min–2h Claude Code session, independently reviewable/revertable, chosen
to minimize file overlap between slices themselves (not just against EP3).

### Slice UX-1: Lunch Rush continuous progression

- **Product Goal**: remove the redundant 「ピザを作る！」 tap between one Lunch Rush pizza's result
  and the next order, without touching FREE, BAKE confirmation, or scoring.
- **Scope**: `App.tsx`'s `handleMissionServeNext` dispatches `BEGIN_PREPARE` immediately after
  `MISSION_NEXT_ORDER`.
- **Out of scope**: FREE mode, `MissionServePanel`'s own score/stars display and its "next" tap
  (kept, per §2's recommendation), BAKE, `missionRunReducer`, Mission's clock model.
- **Files likely touched**: `src/App.tsx`, `src/App.test.tsx` (or a new focused test file).
- **Dependencies**: none.
- **Acceptance criteria**: a full Lunch Rush run of ≥3 pizzas requires no 「ピザを作る！」 tap between
  pizzas; FREE mode's own ORDER→PREPARE gate is provably unchanged (existing FREE tests still pass
  unmodified); Mission's timer/expiry behavior is bit-for-bit unchanged (existing `lunchRush.test.ts`
  suite passes unmodified).
- **Tests**: one new `App`-level test asserting phase goes straight to `PREPARE` after
  `handleMissionServeNext`, reusing existing Mission test scaffolding.
- **Mobile verification**: 390×844 Review Playthrough of 3+ consecutive Lunch Rush pizzas, confirm
  no visible flash of an ORDER screen.
- **Estimated time**: 30–45 min.
- **Parallelizable**: yes (with everything else, and with EP3).

### Slice UX-2: Making-step tabs (minimal, forward-only)

- **Product Goal**: give DOUGH/SAUCE/CHEESE/TOPPING (+ a non-interactive BAKE indicator) a unified,
  always-visible tab strip; tapping the active tab performs the same forward action as today's
  「次へ」/「焼く！」 CTA, which is kept.
- **Scope**: a new tab-strip presentation (either extending `IngredientTray`'s existing
  `category-tabs` concept to also render during DOUGH, or lifting an equivalent strip to
  `GameScreen.tsx` so it's visible even while `IngredientTray` itself is hidden for DOUGH); wire the
  active tab's `onClick` to the same `onConfirmMakingStep`/`onStartBake` handlers the CTA already
  calls; respect the existing `doughShapeComplete` disabled-gate on DOUGH's own tab.
- **Out of scope**: any backward navigation/re-edit capability (see §3's "bigger option"); any
  reducer change (none needed for the minimal design).
- **Files likely touched**: `src/screens/GameScreen.tsx`, `src/components/IngredientTray.tsx` (or a
  new small component if lifted out), `src/App.css`.
- **Dependencies**: none (does not depend on UX-1/3/4/5).
- **Acceptance criteria**: all 4+1 steps visible as tabs at every point in PREPARE/BAKE; tapping the
  active tab advances exactly like the existing CTA; completed/locked tabs remain non-interactive;
  DOUGH's tab (and CTA) both stay disabled until `doughShapeComplete`; existing one-way flow tests
  (`onewayFlow.test.ts`) pass unmodified.
- **Tests**: new `GameScreen`/`IngredientTray` tests for tap-to-advance parity with the existing CTA
  across all 4 steps; disabled-state tests for locked/completed tabs.
- **Mobile verification**: 390×844 Review Playthrough making one full pizza via tab-taps only (no
  CTA taps), then again via CTA-only, confirming identical resulting pizza/score either way.
- **Estimated time**: 1–1.5h.
- **Parallelizable**: yes.

### Slice UX-3: Lunch Rush local ranking (schema v3 + display)

- **Product Goal**: give Lunch Rush a bounded local run history (top-N), building on the existing
  single-BEST persistence without any online component.
- **Scope**: `PersistentSaveV3` (`schemaVersion: 3`) adding `missionRuns: Record<string,
  MissionRunRecord[]>`; `migrateV2toV3`; `sanitizeMissionRuns`; a write path alongside the existing
  `persistMissionBest` effect; a small display surface (recommend extending
  `MissionResultOverlay`, or a new lightweight view) showing the top-N runs.
- **Out of scope**: any online/cross-device ranking (§4 — explicitly deferred, no placeholder
  fields).
- **Files likely touched**: `src/state/persistence.ts`, `src/mission/lunchRush.ts` (if
  `MissionRunRecord`'s shape is defined there alongside `MissionMetrics`), `src/App.tsx` (effect),
  `src/components/MissionResultOverlay.tsx` (or a new component).
- **Dependencies**: none.
- **Acceptance criteria**: a v2 save loads correctly with `missionRuns` backfilled to `{}`; N+1
  runs never grow the array past its cap; a lower-scoring run never displaces a higher-scoring one
  already in the top-N; existing `missionBest` behavior is bit-for-bit unchanged.
- **Tests**: `persistence.test.ts` migration/sanitization coverage mirroring `migrateV1toV2`'s own
  existing test shape; a cap/ordering unit test for the ranking array itself.
- **Mobile verification**: 390×844 Review Playthrough of 3+ runs of varying quality, confirming the
  displayed ranking orders and caps correctly.
- **Estimated time**: 1.5–2h.
- **Parallelizable**: yes.

### Slice UX-4: Pizza Select single-screen pager (buttons only)

- **Product Goal**: replace the scrolling grid with a single-recipe pager fitting 390×844, reusing
  `recipeCardState` unchanged.
- **Scope**: `PizzaSelectScreen.tsx` rewrite to a single-card + ←/→ layout with a `currentIndex`
  local state; keep `RecipeSelectCard`'s existing per-kind rendering logic (COMPLETED/NEW/LOCKED)
  essentially as-is, just re-hosted inside the pager's single-card slot.
- **Out of scope**: swipe gesture (§4 — deferred as a follow-up enhancement), any change to
  `recipeCardState`/`isRecipeAvailable`/unlock logic, any change to `RECIPES`/mystery-lock data.
- **Files likely touched**: `src/screens/PizzaSelectScreen.tsx`, `src/screens/
  PizzaSelectScreen.test.tsx`, `src/App.css`.
- **Dependencies**: none.
- **Acceptance criteria**: every one of the 7 recipes reachable via ←/→ with no vertical scroll at
  390×844; fugazza's mystery-lock hint never reveals its name/ingredient via any new pager chrome
  (position counter, etc.) — the exact `pizzaSelect.test.ts:104-110` assertions still hold for
  whatever renders fugazza; 作る CTA still dispatches `onSelectRecipe` identically to today.
- **Tests**: extend `PizzaSelectScreen.test.tsx` for pager navigation (wraparound or clamp-at-ends,
  per the product decision in §8 below) and re-confirm the existing LOCKED/mystery/COMPLETED/NEW
  assertions render correctly inside the new single-card layout.
- **Mobile verification**: 390×844 Review Playthrough paging through all 7 recipes forward and
  backward, confirming no scroll and correct card content at each position.
- **Estimated time**: 1.5–2h.
- **Parallelizable**: yes.

### Slice UX-5: Achievement-only reset (Test Utilities, first entry)

- **Product Goal**: let a tester (including on the public demo) clear only `dex`, from a clearly
  labeled, confirmation-gated entry point, to re-test the Recipe Unlock chain from scratch without
  losing owned ingredients/inventory/Pitz.
- **Scope**: a new `resetAchievements(storage)` function in `persistence.ts` (patches `dex` back to
  `EMPTY_DEX`, leaves every other field untouched, mirroring `persistProgress`'s own
  read-current-then-patch-one-slice pattern); a small new UI entry point (own component, not inside
  `ShopOverlay.tsx` — see §7); a `window.confirm`-gated action wired to it.
- **Out of scope**: every other Test Utilities candidate in §6's table (Inventory reset/Pitz
  reset/full reset/full delete) — named as future candidates only; any EP4 code (EP4 doesn't exist
  yet — this slice only needs to leave the cross-cutting guard recorded in §6 as a note for EP4's
  own future implementation, not implement it now).
- **Files likely touched**: `src/state/persistence.ts`, a new small component (e.g.
  `src/components/TestUtilitiesOverlay.tsx` or folded into `HomeScreen.tsx` as a low-emphasis
  affordance), `src/App.tsx` (wiring), `src/screens/HomeScreen.tsx` (entry point).
- **Dependencies**: none technically, but **must land before or alongside EP4** (whichever EP4
  implementation session happens should read this report's §6 cross-cutting guard before deciding
  EP4's own grant-tracking mechanism).
- **Acceptance criteria**: after resetting, every recipe's Pizza Select card reverts to its
  from-scratch LOCKED/mystery state exactly as a fresh save would show; `ownedIngredientIds`/
  `inventory`/`pitzBalance`/`missionBest` are provably byte-identical before and after (diffed in
  the test); the confirm dialog blocks an accidental single-tap reset.
- **Tests**: a `persistence.ts` unit test asserting exactly `dex` changes and nothing else; a
  component test confirming the confirm-dialog gate.
- **Mobile verification**: 390×844 Review Playthrough: unlock Funghi normally, reset achievements,
  confirm Funghi is LOCKED again while owned ingredients/Pitz balance are visibly unchanged.
- **Estimated time**: 1–1.5h.
- **Parallelizable**: yes.

None of the five slices touch the same file in the same region as another (UX-1/App.tsx's handler
vs. UX-5/App.tsx's wiring are different functions; UX-3/persistence.ts's new schema fields vs.
UX-5/persistence.ts's new reset function are additive and non-overlapping) — all five can be
developed as five separate small PRs in any order or fully in parallel.

---

## 9. Roadmap integration

Economy 1.0's main line (EP3 → EP4 → Economy Human Feel) is unaffected and unblocked by any of this
report's recommendations — none of the five UX slices touch `economy.ts`, `inventory.ts`, or EP3's
restock/Shop 2.0 surface (per §7). The one real interaction is the EP4 cross-cutting guard recorded
in §6, which is a *note for EP4's own future design*, not a dependency that blocks EP4 from
proceeding on its own schedule.

Updated priority (this session's addition to the existing roadmap in `docs/PROJECT_HANDOFF.md`):

1. **EP3** (already in-flight, PR #83) — continues on its own track, unaffected.
2. **UX-4** (Pizza Select pager) and **UX-3** (Lunch Rush ranking) — recommended first among the
   five: zero file overlap with anything else in flight, self-contained, directly improve two
   screens the task flagged as the most template-ready (`recipeCardState` and `missionBest` are
   both already exactly the derived-data shape their respective slices need).
3. **UX-1** (Lunch Rush continuous progression) — smallest slice, high player-visible tempo win,
   no dependencies.
4. **UX-2** (Making-step tabs) — slightly larger (new tab-strip presentation), no dependencies,
   but recommended after UX-1 purely so Lunch Rush's own tempo fix ships independently and can be
   verified in isolation first (both touch Making-adjacent screens; sequencing, not blocking).
5. **UX-5** (Achievement reset) — lowest urgency of the five (a testing tool, not a player-facing
   feature) but **should land before EP4 begins implementation**, so EP4's own grant-tracking
   design incorporates §6's guard from the start rather than retrofitting it after EP4 ships.

This does not reorder Economy 1.0's own EP3→EP4→Human-Feel sequence — it interleaves the five UX
slices around it, all parallel-safe per §7.

## 10. Unresolved product decisions

1. **UX-3**: should "past-best records" be a separate log from "top-N run history," or is a single
   ranked top-N list sufficient for both (§4)? Recommendation given, not yet decided by the user.
2. **UX-4**: should ←/→ wrap around at the ends (recipe #7 → next → recipe #1) or clamp/disable at
   the ends? Either is a small, purely presentational choice inside the pager's own navigation
   logic.
3. **UX-5**: does "全進行初期化" (full progression reset, a *future* candidate, not this slice) also
   clear `missionBest`/`missionRuns`, or are Lunch Rush records considered a separate achievement
   axis kept even through a full reset? Not needed for the recommended first slice (Achievement-only
   reset never touches this), but worth deciding before that later candidate is ever built.
4. **UX-2**: whether a future "true edit-previous-steps" tab experience (§3's "bigger option") is
   ever wanted at all, or whether the forward-only minimal design is the permanent intended
   behavior. No evidence either way in the task text; recorded as open rather than assumed.
5. **EP4** (not this session's scope, but newly sharpened by §6): confirmed here that its
   "already-granted" exactly-once tracking must be `ownedIngredientIds`-keyed, not `dex`-keyed —
   recommend the EP4 implementation session treat this as a settled input rather than re-opening
   the question from scratch.

## Final verdict

**A. READY FOR IMPLEMENTATION.**

All five UX slices have a concrete, minimal-risk design that reuses existing architecture
(`recipeCardState`, the existing `category-tabs` pattern, `persistProgress`'s read-patch-write
schema pattern, the existing `MISSION_NEXT_ORDER`/`BEGIN_PREPARE` actions) rather than inventing new
systems, are confirmed parallel-safe against the one active in-flight PR (EP3, #83), and are sized
into five independently reviewable/revertable slices with no file-region overlap between them. The
only genuinely open items are presentational preferences (§10, items 1–4) that do not block starting
implementation — a reasonable default can be picked per-slice and revisited on Human Feel review,
consistent with this repo's own established "Fresh Audit → implementation → Human Feel" workflow.
Item 5 (the EP4 guard) is not a blocker for any of these five slices; it is a requirement to hand
forward to EP4's own future session.
