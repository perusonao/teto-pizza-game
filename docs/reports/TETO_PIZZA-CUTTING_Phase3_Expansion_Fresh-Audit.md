# Pizza Cutting — CUT全レシピ展開 Fresh Audit (docs-only)

**Status:** docs-only Fresh Audit. No `src/`, CSS, test, Firebase, or recipe-data change in this
branch — `git diff --stat origin/main` shows only this report added.

**Audited `origin/main` SHA:** `f8e461ae4f632c1480e1a71432719817172867c3`
(PR #160, "Issue #159: Cooking UI 1-Screen Polish", merged 2026-09-21T14:56:10Z — the current tip
of `main` at the time this audit was run). Re-confirmed via `git fetch origin` immediately before
this audit started (Duplicate Gate #1) and again before this report was written (Duplicate Gate
#2) — unchanged both times.

**Branch:** `claude/teto-pizza-cut-phase3-audit-rjo5pu`, created directly on top of that SHA.

## 0. Naming disambiguation (read this first)

The task brief calls this work "Phase 3" ("CUT全レシピ展開 Phase 3"). **That number collides with
this repo's own existing Pizza Cutting 1.0 phase sequence**, which already used 1–4A for different,
already-merged work:

| Existing phase | PR | What it shipped |
|---|---|---|
| Phase 0 (Fresh Design) | #123 | `docs/design/TETO_PIZZA-CUTTING_1.0.md` |
| Phase 1 | #126 | Pure geometry/evaluation engine (`src/logic/cut/*`) |
| Phase 2 | #128 | Reducer/UI wiring, activated on **margherita only** |
| **Phase 3** | **#132** | RESULT-screen CUT evaluation card (already merged, already shipped) |
| Phase 4 (Fresh Audit) | #136 | Human Feel audit (docs-only) |
| Phase 4A | #138 | Duplicate-line gate, Lunch Rush CUT feedback, RESULT copy fix |

So "Phase 3" already means something else here (RESULT UI, done). This audit's actual content —
**full-recipe CUT rollout** — is sequentially the next undone slice, i.e. **Phase 4B** in the
existing numbering. This report is filed at the exact path the task requested
(`docs/reports/TETO_PIZZA-CUTTING_Phase3_Expansion_Fresh-Audit.md`), but the body below refers to
the work as **"CUT Full-Recipe Expansion"** / **Phase 4B** to avoid perpetuating the collision into
the next implementation session. Any implementation Issue/PR title should say "Phase 4B" or "Full
Recipe Expansion", not bare "Phase 3".

## 1. Duplicate Gate

- `mcp__github__search_pull_requests` / `search_issues` for `CUT`, `cutting`, `カット` in title:
  no open issue or PR matches this scope. The 6 PRs matching "cutting" are #123/#126/#128/#132/
  #136/#138, all merged, all covered above.
- `list_issues` (state=OPEN, 16 total) and `list_pull_requests` (state=open, 6 total): no item
  concerns CUT rollout to non-margherita recipes.
- Issue #157 ("Lunch Rush結果画面への🏠ホームへCTA追加") is open, being implemented on
  `claude/lunch-rush-result-home-ln82nn` (PR #158, currently open). Confirmed scope: `App.tsx`
  Home-navigation wiring + `MissionResultOverlay` CTA layout only — **zero overlap** with
  `cookingProfiles.ts`, `src/logic/cut/*`, `ResultPanel.tsx`'s CUT card, or `MissionServePanel.tsx`'s
  CUT line (PR #158's own stated scope excludes CUT explicitly). Not touched by this audit; no file
  this audit's design would touch is shared with #158's diff.
- PR #160 (Issue #159, Cooking UI 1-Screen Polish) is merged and is `origin/main`'s current tip —
  this audit is built on top of it, not in conflict with it.

**Result: no duplicate. Proceeding.**

## 2. Current CUT architecture (Fresh, from code — not from memory of prior reports)

### 2.1 `CookingProfile` / `COOKING_PROFILES` / default profile (`src/data/cookingProfiles.ts`)

```ts
export interface CookingProfile {
  steps: readonly MakingStep[];
  stepTimeLimits?: Partial<Record<MakingStep, { maxMs: number }>>;
  cutConfig?: CutConfig;
}

export const DEFAULT_COOKING_PROFILE: CookingProfile = {
  steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
};

const COOKING_PROFILES: ReadonlyMap<RecipeId, CookingProfile> = new Map([
  ["margherita", {
    steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"],
    cutConfig: { requestedSliceCount: 6 },
  }],
]);

export function getCookingProfile(recipeId: RecipeId): CookingProfile {
  return COOKING_PROFILES.get(recipeId) ?? DEFAULT_COOKING_PROFILE;
}
```

- **Exactly one** `COOKING_PROFILES` entry exists today: `margherita`. All other 14 recipes resolve
  to `DEFAULT_COOKING_PROFILE` (absent-entry fallback, the same contract `getReferencePizza` already
  established for this codebase).
- `postBakeSteps`/`preBakeSteps` classify by a **fixed, step-level** `POST_BAKE_STEPS = {"CUT",
  "FINISH"}` set — never a per-recipe decision. `isPostBakeStep` is the single source of truth for
  "does this step run before or after BAKE."
- `requestedSliceCount` absent on `cutConfig` (or `cutConfig` itself absent) resolves through
  `resolveRequestedSliceCount` (`src/logic/cut/types.ts`) to `DEFAULT_REQUESTED_SLICE_COUNT = 6` —
  never an undefined slice count.

### 2.2 CUT routing (`src/state/gameReducer.ts`)

- `CONFIRM_MAKING_STEP` branches on `state.phase` (`"PREPARE"` → `preBakeSteps`, `"POST_BAKE"` →
  `postBakeSteps`) and is otherwise **identical machinery** for both — CUT gets no special-cased
  transition path, just a `isConfirmingCut` guard that (a) blocks confirm below `requiredCutCount`
  and (b) calls `evaluateCutState` exactly once when CUT actually is being confirmed.
- `ADD_CUT_LINE` / `UNDO_CUT_LINE` are reducer-level backstops (`state.phase === "POST_BAKE" &&
  state.makingStep === "CUT"` guard on both), independent of the gesture-layer's own checks in
  `App.tsx`/`PizzaStage.tsx` — never trusts the UI alone, matching `COMMIT_SAUCE_DISPENSE`'s own
  precedent.
- `CONFIRM_BAKE` computes `postBakeSteps(state.cookingProfile)` and starts `POST_BAKE` timing on
  `postBake[0]` only if `postBake.length > 0` — **for all 14 non-CUT recipes today this is always
  empty**, so `phase` stays `"RESULT"` directly, byte-identical to pre-Phase-1A behavior. This is
  the mechanism a wider CUT rollout activates for the other 14, not a new one.
- `requiredCutCount(n) = n / 2` ("N full lines → 2N wedges"); the `ADD_CUT_LINE` line cap is
  `requiredCutCount + 2` (design doc §8.4), independent of recipe.
- `REGISTER_TO_DEX` orchestration in `App.tsx` already fires once CUT's own confirm reaches
  `"RESULT"`, not tied to `CONFIRM_BAKE` — already recipe-agnostic (Phase 2's own §12 relocation).

### 2.3 `requestedSliceCount` / geometry / evaluation (`src/logic/cut/*`)

- `evaluateCut(lines, config)` (`evaluation.ts`) is **fully generic**: it reads only `lines` and
  `config.requestedSliceCount`, has no recipe/ingredient/dough-shape awareness, and is scored
  against the dough's own ideal circle (`DOUGH_CENTER`/`DOUGH_RADIUS`, `../pizzaCoordinates.ts`) —
  the same coordinate space every recipe's DOUGH/SAUCE/TOPPING gestures already share. Weights:
  `countCorrectness 0.20 / completeness 0.20 / centerAccuracy 0.10 / uniformity 0.50`
  (`CUT_SCORE_WEIGHTS`), unchanged since Phase 1.
- `GRID_RESOLUTION = 96` grid-sampling geometry (`geometry.ts`) is likewise recipe-agnostic —
  candidate-point classification against committed chords, no per-recipe branch anywhere in
  `src/logic/cut/`.
- **Nothing in this module hard-codes `margherita`.** The single-recipe activation is 100% a
  `cookingProfiles.ts` data decision, not an engine constraint. This is the key fact the
  architecture recommendation in §5 rests on.

### 2.4 ResultPanel CUT display (`src/components/ResultPanel.tsx`)

- `cutEvaluation?: CutEvaluation | null` prop, rendered only when truthy (`{cutEvaluation && (...)}`
  — no fabricated/zero card for a non-CUT recipe or a round that never confirmed CUT). Shows
  `cutScore`, actual/requested slice count, uniformity/centerAccuracy/completeness — **no recipe id
  or recipe-specific branching anywhere in this component.** Already recipe-agnostic; extending CUT
  to more recipes requires zero `ResultPanel.tsx` changes.
- A one-line "※総合スコアとは別の評価です" disclaimer (Phase 4A/#138) prevents the
  "カット100点なのに総合59点" confusion regardless of which recipe produced it.

### 2.5 Step Timing CUT (`src/logic/cookingTiming.ts`)

- **Zero CUT-specific code.** `perStepElapsedMs: Partial<Record<MakingStep, number>>` is keyed
  generically by `MakingStep` — CUT accumulates elapsed ms exactly like DOUGH/SAUCE/CHEESE/TOPPING
  do, through the same `advanceStepTiming` call sites already wired in `gameReducer.ts`'s
  `CONFIRM_MAKING_STEP`/`CONFIRM_BAKE`. No engine change needed for rollout.

### 2.6 Scoring boundary

- `src/logic/cut/evaluation.ts`'s own header states the contract explicitly and it is upheld by
  every call site checked: `cutScore` is **never** added to `state.score.total` /
  `ScoringV2Result.totalScore`. `src/logic/completionGate.ts` has **zero** references to CUT/
  `cutState`/`cutScore` — completion is evaluated once, at `CONFIRM_BAKE`, strictly before
  `POST_BAKE` even starts; CUT cannot affect PASS/FAILED, ★ rating, Dex BEST, or Pitz reward
  (`../logic/pitzReward.ts` reads only `scoringV2Result`/`completion`, never `cutState`).

### 2.7 Lunch Rush boundary

- `MissionServePanel.tsx` reads `state.cutState.evaluation` the same optional-guard way
  `ResultPanel.tsx` does (`cutEvaluation &&` — never renders a CUT row for a non-CUT recipe),
  display-only, "✂️ カット N点（N切れ）" — confirmed **not** added to `missionScore`/ranking
  anywhere in this file or `App.tsx`'s `handleMissionServeNext`.
- `MissionClock` is unaffected by CUT's existence one way or the other; CUT genuinely costs
  real mission-clock seconds today for margherita already (this is pre-existing behavior, not
  something the rollout introduces) — Phase 4A's own audit already flagged and fixed the
  "payoff invisible" gap for the one recipe that has it today.

### 2.8 Recipe 一覧 / 15 recipes 現在状態

All 15 recipes (`src/data/recipes.ts`, `RECIPES` array, order = unlock-chain order):

| # | `id` | CUT active today? | Sauce mode | Non-sauce ingredient types | Notes relevant to CUT |
|---|---|---|---|---|---|
| 1 | `margherita` | **Yes** (only one) | spread (tomato-sauce) | 2 (mozzarella, basil) | Baseline/reference recipe for CUT Phase 1–4A |
| 2 | `marinara` | No | spread (tomato-sauce) | 2 (garlic, oregano) | No cheese — CUT geometry doesn't care |
| 3 | `quattro-formaggi` | No | spread (olive-oil) | 4 cheeses | 8-piece reference-ring recipe, unrelated to CUT ring capacity (CUT doesn't use `PIECE_RING_POSITIONS`) |
| 4 | `genovese` | No | spread (pesto) | 2 | — |
| 5 | `bismarck` | No | spread (tomato-sauce) | 2 (+ egg) | Used as a non-CUT fixture in several existing tests (see §6 risk) |
| 6 | `funghi` | No | spread (tomato-sauce) | 2 | **Used as the explicit non-CUT control fixture** in `gameReducer.cutStep.test.ts` (see §6) |
| 7 | `fugazza` | No | spread (olive-oil) | 2 (onion, oregano) | `mysteryLock: true` — unrelated to CUT |
| 8 | `salsiccia` | No | spread (tomato-sauce) | 2 | — |
| 9 | `pepperoni` | No | spread (tomato-sauce) | 2 | — |
| 10 | `napoletana` | No | spread (tomato-sauce) | 3 | — |
| 11 | `tonno-e-cipolla` | No | spread (tomato-sauce) | 3 | — |
| 12 | `pizza-bianca` | No | spread (olive-oil) | 1 (rosemary) | No tomato-sauce (same pattern as fugazza) — CUT is post-BAKE/geometry-only, unaffected |
| 13 | `breakfast-pizza` | No | spread (tomato-sauce) | 3 | — |
| 14 | `capricciosa` | No | spread (tomato-sauce) | 5, 8 total pieces (reference-ring ceiling) | Ring-ceiling recipe; irrelevant to CUT (see quattro-formaggi note) |
| 15 | `meat-lovers` | No | spread (tomato-sauce) | 5, 8 total pieces (reference-ring ceiling) | Same |

**All 15 use the identical circular-dough contract** (`DOUGH_CENTER`/`DOUGH_RADIUS` via
`../pizzaCoordinates.ts`, DOUGH-step stretch + spread/scatter placement) — confirmed by reading
`src/data/recipes.ts`, `src/data/referencePizza.ts`, and the `MakingStep` union itself. None of the
15 uses `FOLD`/`SEAL`/`EDGE_FILL` (those three labels exist only as reserved i18n strings in
`MakingStepTabs.tsx` and a `MakingStep` union member — **zero recipe or reducer wiring reads them
today**, confirmed by grep: no `FOLD`/`SEAL`/`EDGE_FILL` outside that label map, the type union
itself, and three doc-comment mentions).

**CUT対象:** all 15 (every shipped recipe is a standard round, single-piece, single-bake pizza; the
CUT engine's own ideal-circle scoring is valid for every one of them without modification).

**CUT非対象:** none among the 15 shipped recipes.

**将来特殊形状として除外候補** (not yet designed or shipped — `FOLD`/`SEAL`/`EDGE_FILL` are the
existing reserved hook for exactly this): calzone, fugazzeta, mezza-e-mezza, siciliana, square
pizza — any recipe whose finished shape is not a single round disc (a folded/sealed calzone, a
non-circular pan pizza, a half-and-half). None of these can safely reuse the current CUT geometry
engine unmodified (`GRID_RESOLUTION`/`DOUGH_CENTER`/`DOUGH_RADIUS` all assume a circular dough), so
each would need its own future design pass before ever being added to a CUT-eligible list — this is
exactly why §5's recommendation is an **explicit allowlist**, not an implicit "all recipes" default.

## 3. Files audited this session (read directly, not from memory)

`src/data/cookingProfiles.ts`, `src/data/cookingProfiles.test.ts` (names only, via grep), 
`src/data/recipes.ts`, `src/logic/cut/types.ts`, `src/logic/cut/evaluation.ts`,
`src/logic/cut/geometry.ts` (header/exports via grep), `src/state/gameReducer.ts` (full
`CONFIRM_MAKING_STEP`/`ADD_CUT_LINE`/`UNDO_CUT_LINE`/`CONFIRM_BAKE` bodies, `MakingStep` union,
`GameState.cutState` field), `src/logic/completionGate.ts` (full failure-reason/priority logic),
`src/components/ResultPanel.tsx` (CUT card block), `src/components/MissionServePanel.tsx` (CUT
line block), `src/logic/cookingTiming.ts` (full type/step-timing surface),
`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` (full), `docs/PROJECT_HANDOFF.md` (CUT
references via grep), plus GitHub: PR #160 (get), Issue #157 (get) + its closing PR #158 (get,
scope-checked), PRs #123/#126/#128/#132/#136/#138 (search results, bodies read), open
issues/PRs lists (16 issues, 6 PRs).

## 4. Design question: how to add CUT to the other 14 recipes with minimal, safe change

### Option A — 14 individual `CookingProfile` entries in `COOKING_PROFILES`

```ts
const COOKING_PROFILES: ReadonlyMap<RecipeId, CookingProfile> = new Map([
  ["margherita", { steps: [...DEFAULT_COOKING_PROFILE.steps, "CUT"], cutConfig: { requestedSliceCount: 6 } }],
  ["marinara",   { steps: [...DEFAULT_COOKING_PROFILE.steps, "CUT"], cutConfig: { requestedSliceCount: 6 } }],
  // ...12 more, byte-identical shape
]);
```

- **Safety:** fully explicit and opt-in — a future recipe (calzone etc.) is never silently included;
  someone has to add its own line.
- **Cost:** ~14 × 4-line near-identical entries (~60–90 lines of pure repetition), a large diff for
  zero new information content, real copy-paste-typo risk (an entry with the wrong step order, or a
  missing `cutConfig`, would only be caught by a reviewer or a test — not by the type system, since
  `steps` is just `readonly MakingStep[]`).
- Matches the existing pattern exactly (lowest "does this look like our code" risk), but does not
  reduce future maintenance: recipe #16 still needs its own hand-written entry, indistinguishable
  in form from every other one — nothing marks "these 15 are all just the standard round-CUT case."

### Option B — bake CUT into `DEFAULT_COOKING_PROFILE` itself

```ts
export const DEFAULT_COOKING_PROFILE: CookingProfile = {
  steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"],
  cutConfig: { requestedSliceCount: 6 },
};
```

- **Rejected.** This is a 2-line diff, but it inverts the safety property the task explicitly asks
  for: any recipe added to `RECIPES` in the future **with no `COOKING_PROFILES` entry** — which is
  the normal, expected way every recipe has been added so far (see `recipes.ts`'s own Batch
  1A/1B-A/1B-B/1B-C history: none of those additions touched `cookingProfiles.ts`) — would silently
  inherit CUT. This is precisely the "全ピザ強制CUT" failure mode named in the task brief
  (calzone/fugazzeta/mezza-e-mezza/siciliana/square pizza would all need their own future opt-*out*,
  which is easy to forget, instead of an opt-*in* which is impossible to forget because it's the
  default absence of an action).

### Option C — explicit CUT-eligibility allowlist + derived profile (recommended)

```ts
/** Pizza Cutting — CUT Full-Recipe Expansion (Phase 4B): every recipe listed here is a standard
 *  round, single-bake, single-piece pizza (confirmed against ../data/recipes.ts + the circular
 *  DOUGH_CENTER/DOUGH_RADIUS contract every one of them already shares) and gets the exact same
 *  CUT treatment Margherita already shipped in Phase 2. A future non-round recipe (calzone,
 *  fugazzeta, mezza-e-mezza, siciliana, square pizza) is NEVER included here automatically --
 *  adding it to RECIPES alone leaves it on DEFAULT_COOKING_PROFILE (no CUT) until a human
 *  deliberately adds its id below, after confirming its shape is actually compatible with this
 *  engine's ideal-circle scoring (../logic/cut/geometry.ts's own DOUGH_RADIUS assumption).
 */
const CUT_ELIGIBLE_RECIPE_IDS: ReadonlySet<RecipeId> = new Set([
  "margherita", "marinara", "quattro-formaggi", "genovese", "bismarck", "funghi",
  "fugazza", "salsiccia", "pepperoni", "napoletana", "tonno-e-cipolla",
  "pizza-bianca", "breakfast-pizza", "capricciosa", "meat-lovers",
]);

function withCut(steps: readonly MakingStep[], cutConfig: CutConfig): CookingProfile {
  return { steps: [...steps, "CUT"], cutConfig };
}

const STANDARD_CUT_CONFIG: CutConfig = { requestedSliceCount: 6 };

/** Per-recipe override map -- reserved for a recipe that needs something OTHER than the standard
 *  6-slice CUT (e.g. a future 8-slice large-format recipe), checked before the allowlist below.
 *  Empty today: no shipped recipe needs a non-standard CutConfig yet. */
const COOKING_PROFILE_OVERRIDES: ReadonlyMap<RecipeId, CookingProfile> = new Map([]);

export function getCookingProfile(recipeId: RecipeId): CookingProfile {
  const override = COOKING_PROFILE_OVERRIDES.get(recipeId);
  if (override) return override;
  if (CUT_ELIGIBLE_RECIPE_IDS.has(recipeId)) {
    return withCut(DEFAULT_COOKING_PROFILE.steps, STANDARD_CUT_CONFIG);
  }
  return DEFAULT_COOKING_PROFILE;
}
```

- **Safety:** identical to Option A — still a fully explicit, opt-in allowlist. A future recipe not
  listed in `CUT_ELIGIBLE_RECIPE_IDS` resolves to `DEFAULT_COOKING_PROFILE` (no CUT), exactly as
  Option A guarantees, with the exact same "must be deliberately added" property.
- **Cost:** ~20 lines total (one `Set` literal + one tiny derivation function) instead of Option A's
  ~60–90 lines of repeated structure. One point of truth if the standard slice count (`6`) ever
  needs to change for every round pizza at once. No copy-paste-typo surface: every CUT-eligible
  recipe gets the exact same `steps`/`cutConfig` shape by construction, not by 14 independent
  hand-typed literals.
- Preserves an explicit override escape hatch (`COOKING_PROFILE_OVERRIDES`) for the one case Option
  A's flat Map already implicitly supports and this design must not lose: a future recipe that wants
  CUT with a *different* `requestedSliceCount` (4 or 8) than the shared default.
- A single, cheap regression test becomes possible that Option A doesn't naturally offer:
  `CUT_ELIGIBLE_RECIPE_IDS` can be asserted to be a subset of `RECIPES.map(r => r.id)` (catches a
  stale/typo'd id immediately, at data-authoring time, rather than only via a missed manual review).

**Recommendation: Option C.** It has the identical safety property Option A has (explicit,
opt-in, never-implicit CUT), at roughly a quarter of the line count and with a stronger built-in
regression test than a flat Map naturally provides. Option B is rejected outright — it is the one
option that actually creates the "全ピザ強制CUT" risk the task explicitly asked to avoid.

## 5. Implementation estimate scope (for the next, implementation-phase session)

**Files expected to change** (implementation phase only — not touched in this audit):

- `src/data/cookingProfiles.ts` — the allowlist + derivation (Option C above)
- `src/data/cookingProfiles.test.ts` — exhaustive coverage: every `RecipeId` in `RECIPES` resolves
  to a CUT-bearing profile except any future explicitly-excluded id; `CUT_ELIGIBLE_RECIPE_IDS ⊆
  RECIPES.map(id)` regression test
- `src/state/gameReducer.cutStep.test.ts` — **must change its own non-CUT control fixture.**
  `funghi` is used today (lines ~77–137) as the explicit "non-CUT recipe" proof (`expect(profile
  .steps).not.toContain("CUT")`, `ADD_CUT_LINE` rejection when `makingStep !== "CUT"` is
  unreachable, etc.) — once `funghi` becomes CUT-eligible this fixture no longer demonstrates the
  default-profile path. Needs either (a) a synthetic id (`"non-existent" as RecipeId`) exercising
  `DEFAULT_COOKING_PROFILE`/`getCookingProfile` directly rather than through a real recipe, or (b) a
  reserved recipe deliberately *not* added to the allowlist for exactly this testing purpose. Same
  concern applies to any other test file using `funghi`/`bismarck`/`marinara` specifically as a
  "the other 14 recipes are unaffected" control (see below).
- `src/state/gameReducer.cookingSteps.test.ts`, `gameReducer.scoringV2Authority.test.ts`,
  `gameReducer.completionGate.test.ts`, `App.test.tsx`, `screens/GameScreen.makingStepNav.test.tsx`
  — each references `funghi`/`bismarck`/`marinara` in a comment or assertion tied to "the non-CUT
  regression path" (confirmed via grep, 5 files). Each needs re-auditing at implementation time to
  confirm whether its specific assertion still holds once every recipe carries CUT, or needs its own
  fixture swap.
- `src/components/ResultPanel.test.tsx`, `MissionServePanel` tests — extend cross-recipe coverage
  (component logic itself is already generic, per §2.4/§2.7 — this is coverage-only, not a behavior
  change)
- Playwright e2e (`PizzaStage.cutGesture.test.tsx` and any dedicated CUT e2e spec) — extend beyond
  margherita to at least one topping-heavy recipe (capricciosa or meat-lovers, 8 reference pieces)
  to catch any touch-target/visual-overlap issue the CUT gesture layer might have on a
  denser-looking baked pizza (the gesture itself operates on dough-percent coordinates, independent
  of topping density, but this has not been played on a topping-heavy recipe yet and is worth a real
  check, not just an assumption)
- `docs/reports/TETO_PIZZA-CUTTING_Phase4B_Expansion_Result.md` (implementation-phase Result Report)

**No expected change:** Firebase / Cloud Functions / Firestore / `.github/workflows/*` / save
schema (`CURRENT_SCHEMA_VERSION`) / Scoring 2.0 / `completionGate.ts` / Pitz reward / economy /
progression / `docs/design/TETO_PIZZA-CUTTING_1.0.md` (its own architecture is already general
enough; no design amendment needed, only a data change) / any file in Issue #157 / PR #158's scope.

**Estimated implementation time:** 2–3h for the `cookingProfiles.ts` change + exhaustive data test
itself; **4–6h total** including the non-trivial test-fixture migration described above (5+ files
whose "non-CUT recipe" control fixture needs auditing/replacing) and a real-device/Playwright pass
across at least 2 non-margherita recipes (one simple, one topping-heavy) plus the FAILED-bake path
(Completion Gate boundary, §2.6) on a non-margherita recipe. This is larger than the
`cookingProfiles.ts` diff alone suggests, because the test suite's own choice of `funghi`/
`bismarck`/`marinara` as "the non-CUT example" throughout the codebase is a direct, structural
consequence of margherita being the *only* CUT recipe today — that assumption breaks everywhere at
once, not just in one file.

## 6. Risks

1. **Non-CUT regression-fixture loss (real, sizable).** Detailed in §5 — at least 5 test files use
   a specific non-margherita recipe id as their "this recipe has no CUT" proof. Once all 15 carry
   CUT, none of the 15 shipped `RecipeId`s can serve that role anymore; a synthetic/reserved
   fixture id is required. This is a test-authoring cost, not a production-behavior risk, but it is
   real effort, sized above at 4–6h total rather than the 2–3h the pure data change would suggest in
   isolation.
2. **Lunch Rush tempo cost, now on every recipe.** Phase 4A's audit already found CUT costs real
   `MissionClock` seconds for margherita and fixed the "payoff invisible" gap for it
   (`MissionServePanel`'s CUT line). Rolling CUT out to all 15 means every Lunch Rush order now
   costs this extra time, not just a margherita order — worth a real Lunch Rush playthrough at
   implementation time (not just FREE mode) to confirm the existing Phase 4A fix reads clearly
   across a topping-heavy recipe too, not only margherita.
3. **FAILED-bake + CUT interaction, currently only exercised for margherita.**
   `gameReducer.pitzReward.test.ts`'s own comment (`requiredForCompletion` is false, a FAILED pizza
   still walks through CUT) is currently proven for margherita only. Once every recipe can FAIL its
   bake *and* still reach CUT, this needs at least one non-margherita FAILED+CUT walkthrough to
   confirm RESULT still shows both the FAILED state and (if confirmed) a CUT card without visual
   conflict.
4. **Reference-ring-ceiling recipes (capricciosa, meat-lovers) untested against CUT's gesture
   layer.** Both already sit at the 8-piece `PIECE_RING_POSITIONS` visual ceiling pre-BAKE; CUT
   itself operates post-BAKE on the dough's own coordinate space (unrelated data), but this
   specific combination (busiest-looking baked pizza + CUT drag gesture) has literally never been
   played, per §5's e2e note.
5. **Phase-numbering confusion carried forward (documentation risk, not code risk).** See §0 — if
   the next session's task brief also says "Phase 3" without reading this report first, it will
   collide with PR #132 in any search/duplicate-gate step. Recommend the implementation task
   explicitly cite this report and use "Phase 4B" or "Full Recipe Expansion" in its own title.

## 7. Out of scope (this audit, and unchanged by it)

`src/` (all), CSS, tests, Firebase/Firestore/Cloud Functions, `.github/workflows/*`, recipe data
(`src/data/recipes.ts`), `CookingProfile`/`COOKING_PROFILES` themselves (Option C above is a design
proposal for the next session to implement, not applied here), Issue #157 / PR #158, `main`
merges, auto-merge, any Human Verification video/screenshot capture (per
`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §2's own "Audit-only tasks are exempt from
Preview deployment and video capture" — this task is read-only/docs-only).

## 8. Human Verification plan for the *implementation* phase (designed now, not executed)

Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` (authority viewport 390×844, secondary
360×800, MP4/H.264, screenshots committed under `docs/reports/screenshots/<task-name>/`, video
delivered directly to the user — never committed):

**390×844 (authority), minimum 4 scenarios:**
1. **Margherita regression** — full PREPARE→BAKE→POST_BAKE/CUT→RESULT walkthrough, confirming
   zero behavior change from Phase 4A's already-shipped margherita CUT flow (duplicate-line
   rejection, undo, RESULT card, MissionServePanel CUT line in a Lunch Rush order).
2. **Non-margherita recipe CUT (simple)** — e.g. `funghi` or `marinara`: PREPARE→BAKE→POST_BAKE/
   CUT→RESULT, confirming the CUT bottom bar/gesture/RESULT card now appear identically to
   margherita's.
3. **Topping-heavy recipe CUT** — `capricciosa` or `meat-lovers` (8 reference pieces): same flow,
   specifically watching for any visual/touch-target conflict between the baked topping layer and
   the CUT drag gesture or angle guide.
4. **RESULT CUT score across recipes** — a short montage/cut confirming the RESULT card's CUT
   score line reads correctly (no "0点"/`NaN`, correct actual/requested slice count) for at least 2
   different non-margherita recipes back to back, plus one FAILED-bake + CUT round (risk #3 above).

**360×800 (secondary), minimum 1 scenario:**
5. **Non-margherita CUT layout** — one non-margherita recipe's CUT step at 360×800, confirming no
   horizontal overflow / no CTA clipping (the same class of bug PR #160 just fixed for the
   PREPARE/BAKE tab strip, now re-checked for POST_BAKE/CUT specifically, since the tab strip work
   in #160 explicitly widened its own scope to include POST_BAKE/CUT mounting).

Total: 5 scenarios, all newly designed for this expansion (not a rerun of Phase 2/3/4A's own
margherita-only scenarios) — this session does not record video/screenshots per §7 (docs-only).

## 9. Final Verdict

**READY FOR IMPLEMENTATION**, using Option C (§4) as the architecture, scoped and sized per §5,
with the non-CUT fixture migration (§6 risk 1) planned for up front rather than discovered
mid-implementation. No blocker found. No conflict with Issue #157 / PR #158. No Firebase impact.
