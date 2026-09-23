# Progression 2.0 Phase 3-1: Runtime Signature → Recipe Discovery Foundation (Fresh Audit + Result)

Issue #192 (parent #182). Branch `claude/phase-3-1-recipe-discovery-n1v7qc`, cut from `main`.
**Not merged. The PR stays open for review.**

| Item | Value |
|---|---|
| Audited `main` | `9c22ef2e58c73e76377b7cba018e5e868a78a75a`, the same SHA as the Phase-2 merge (PR #191) |
| Design inputs | `docs/design/TETO_PROGRESSION2_PHASE2_DESIGN.md`, `…_UNLOCK-GRAPH.md`, `…_DECISION-LEDGER.md`, `docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json` |
| Visible UI change | **None.** Screenshots record the unchanged flow; no UI was added for them. |
| Save schema | **Unchanged** (v2). No migration. |

---

## 1. Fresh Audit (done before implementation)

### 1.1 Production code

| Area | What the code does at `9c22ef2` | Consequence for P3-1 |
|---|---|---|
| Recipe selection | Recipe-first. `SELECT_RECIPE` → PREPARE → BAKE → (CUT) → RESULT → `REGISTER_TO_DEX` for `state.recipe.id` (`gameReducer.ts`). | No free cook exists, so every pizza is made under a selected recipe. |
| Ingredient tray | Shows **only the selected recipe's required ingredients** (`IngredientTray.tsx`, Issue #159). The reducer checks ownership and step category, not recipe membership. | In the real UI, a PASS pizza's ingredient set equals the selected recipe's set. A different recipe's signature, or an "original" PASS pizza, can only come from a direct dispatch (unit tests). |
| Completion gate | Recipe-relative: required ingredients, `minCount`, sauce amount and the recipe's bake window (`completionGate.ts`). | Discovery is evaluated only on a PASS pizza. The recipe-free completion rule (Phase-2 X-3) belongs to P3-2. |
| Sauce/base | `pizza.sauceIds`, one sauce per pizza (a new one replaces the old). `olive-oil` is a sauce. | Observable. There is exactly one spread layer. |
| Ingredients | `pizza.toppings[]`: cheese and topping pieces with `ingredientId` and position. | Observable. Order and position are not identity; count is recorded but is not identity. |
| Dough/style | One dough. `doughShape` holds 8 stretch radii, which describe size and silhouette, not style. | Dough is fixed at `standard`. Shape has **no classification rule**. |
| Pan / layering / folding | No pan. The reducer enforces DOUGH → SAUCE → CHEESE → TOPPING. FOLD/SEAL are reserved steps with no gameplay. | Fixed by the flow. |
| Cooking profile / method | BAKE only. The bake value is a quality input. | Fixed at `bake`. |
| Post-bake finishing | FINISH is reserved, with no gameplay. | Late additions are always empty. |
| Cut/serve | CUT exists for 14 recipes (`cutState`). | Phase 2 has **no cut identity dimension**, so cut is quality/presentation only. |
| Dex write path | `registerScoreToDex` is the only BEST writer. It runs from `REGISTER_TO_DEX` (FREE, guarded by `phase === "RESULT"`) and from `MISSION_NEXT_ORDER` (Lunch Rush). | The discovery write must reuse it, and the phase guard already makes it exactly-once. |
| Save | v2, `dex` sanitized to **known `RecipeId`s only**, with `bestStars` 1–5. | Only production recipes can be written to the Dex. A discovery entry needs a real score. |
| FREE vs Lunch Rush | FREE registers through `REGISTER_TO_DEX` (Pitz, Completion Gate). Lunch Rush registers through `MISSION_NEXT_ORDER`, which ignores the Completion Gate for the Dex. | Discovery is FREE-only, and Lunch Rush is left unchanged. |

### 1.2 Phase-2 signature axes against the runtime

| Issue axis | Phase-2 dimension | Runtime status | Why |
|---|---|---|---|
| ingredients | `ingredientSet` | **OBSERVED** | sauce and piece ids |
| sauce/base | `ingredientSet` (the base is included) and `sauceBase` | **OBSERVED** | `sauceIds` |
| dough/style | `dough` | FIXED_BY_FLOW = `standard` | there is one dough |
| shape/pan | `pan` | FIXED_BY_FLOW = `null` | there is no pan |
| shape/pan | `shape` | **UNAVAILABLE**, Phase-2 default `round` assumed | radii exist but there is no rule for classifying a shape |
| layering/folding | `layerOrder` | FIXED_BY_FLOW = `standard` | the reducer enforces the order |
| layering/folding | `spreadLayers` | FIXED_BY_FLOW = `null` | one sauce per pizza |
| layering/folding | `enclosure` | FIXED_BY_FLOW = `null` | FOLD/SEAL are not implemented |
| layering/folding | `zones` | **UNAVAILABLE**, Phase-2 default `[]` assumed | positions exist but there is no rule for classifying zones |
| cooking method/profile | `cook` | FIXED_BY_FLOW = `bake` | BAKE is the only method |
| cooking method/profile | `prep` | FIXED_BY_FLOW = `[]` | there is no prep step |
| cooking method/profile | `laminate` | FIXED_BY_FLOW = `false` | there is no laminate step |
| post-bake finishing | `late` | FIXED_BY_FLOW = `[]` | FINISH is not implemented |
| cut/serve | none | not identity | Phase 2 defines no cut dimension |

`RUNTIME_SUPPORTED_CAPABILITIES = []`: none of the 11 Phase-2 capabilities has gameplay yet.

### 1.3 Findings, and why none of them stopped implementation

1. **A-01…A-05 are still owner decisions** (P3-0). The runtime catalog contains only the 15
   production recipes, which already have Dex cards in `main`. Keeping them discoverable
   preserves current behaviour and does not decide A-01 for zero-recipe onboarding, which is out
   of scope. Switching profile later is a data change in `discoveryCatalog.ts`.
2. **The recipe-first UI makes original and cross-recipe PASS pizzas unreachable by tapping**
   (tray filter). The engine still handles them fully (unit-tested), so P3-2's free-cook tray can
   rely on it unchanged.
3. **Shape and zones are recorded but unclassifiable.** They are not guessed. They are marked
   UNAVAILABLE, and no target that needs a non-default value there can match. Today every such
   target also requires a capability the runtime lacks, so the rule is defence in depth.
4. **Dex entries require a known `RecipeId` and a 1–5 ★ score.** So 86 of the 101 Phase-2
   targets cannot be written to the Dex yet: they have no recipe, card or art. They stay out of
   the runtime catalog (see §6).

None of these is a dangerous design problem that would require guessing. Each one is contained
by an explicit rule below.

---

## 2. What was implemented

### 2.1 Runtime signature (`src/logic/discovery/signature.ts`)

`signatureOfPizza(pizza)` is a pure function of canonical `PizzaState` and never throws, because
malformed input goes through Scoring 2.0's boundary sanitizers. It builds:

- `ingredientSet`: sorted and de-duplicated, with the base sauce included;
- `sauceBase`;
- `ingredientCounts`, which is informative only;
- the 11 Phase-2 dimensions, each tagged `OBSERVED` / `FIXED_BY_FLOW` / `UNAVAILABLE` according to
  `RUNTIME_DIMENSION_OBSERVATION`.

**Quantity semantics:** identity is presence-only, as in Phase 2. Placing mozzarella 3 or 5
times gives the same identity. `minCount` remains the Completion Gate's question.

### 2.2 Deterministic matcher (`src/logic/discovery/matcher.ts`)

`matchDiscovery(signature, catalog)` returns one of three results:

- `NO_MATCH`, with any blocked look-alikes;
- `UNIQUE_MATCH`, with the dimensions that were only assumed;
- `AMBIGUOUS`, with sorted ids.

The rules:

1. Exact ingredient set, **the expected base** (every runtime target declares `sauceBase`, the recipe's sauce-category ingredients) **and** every dimension. There is no ingredients-only fallback.
2. A target that requires an unsupported capability is never a candidate.
3. On an UNAVAILABLE axis, only a target whose value is the Phase-2 default can match (the
   observation rule), and the assumption is reported.
4. A BLOCKED target is never discovered. If one shares an eligible target's signature, the result
   is AMBIGUOUS.
5. Ids are sorted, so the result never depends on catalog order.

`evaluateDiscovery(signature, catalog, discoveredIds)` maps the match to one of
`ORIGINAL | AMBIGUOUS | NEW_DISCOVERY | ALREADY_DISCOVERED`. It is pure and never writes.

### 2.3 Runtime catalog (`src/data/discoveryCatalog.ts`)

The catalog has one target per production recipe, derived from `RECIPES`, so it cannot drift from
what the game cooks. It is keyed by a `Record<RecipeId, targetId>`, so adding a recipe without an
identity is a type error. It maps 14 recipes to `shipped:<id>` and `tonno-e-cipolla` to its
corroborating PIZZA DB row. A test pins each target to the Phase-2 JSON.

### 2.4 Minimal Dex integration (`gameReducer.ts` REGISTER_TO_DEX, `src/state/discoveryRegistration.ts`)

For a FREE round whose pizza passed the Completion Gate:

1. `evaluateDiscovery` runs against the Dex **as it was before** this round.
2. The selected recipe is registered by the **unchanged** `registerScoreToDex` call. BEST, ★,
   timesMade, `justDiscovered`/`justGotNewBest`, Pitz, Efficiency and Starter Grant behave exactly
   as before.
3. `registerDiscoveryToDex` writes only one extra case: an exact, not-yet-discovered match to a
   **different** recipe. That recipe is scored as itself (its own Scoring 2.0 score, bake window
   and Completion Gate, following Phase-2 X-3) and written through the same
   `registerScoreToDex`. If it fails that recipe's gate, the outcome is `INCOMPLETE_MATCH` and
   nothing is written.
4. The outcome is stored in the transient `GameState.lastDiscovery`. It is reset every round,
   `null` for Lunch Rush, never persisted and not rendered yet.

The existing `phase === "RESULT"` guard makes the whole case exactly-once. A second
REGISTER_TO_DEX, from a repeated RESULT event or a re-render, returns the identical state object.

---

## 3. Discovery cases proven (Issue #192 test list)

| # | Case | Where |
|---|---|---|
| 1 | Exact single match (Margherita → `shipped:margherita`, assumed dims `zones`, `shape`) | `matcher.test.ts` |
| 2 | Ingredient-order invariance (3 placement orders plus a reversed catalog) | `matcher.test.ts`, `signature.test.ts` |
| 3 | Sauce/base distinction: Genovese's toppings on tomato, olive oil or no sauce, and Margherita's toppings on pesto, are all original. The right ingredients in the wrong roles (egg as the base, tomato sauce as a piece) or with two bases do not match either (PR #193 review). | `matcher.test.ts` |
| 4 | All 5 Phase-2 same-ingredient-set groups: margherita/cauliflower/al-taglio, salsiccia/chicago-stuffed, pepperoni/fathead/new-england-bar, jamón-serrano/pinsa-romana, ny-style/trenton. Each resolves to the capability-free member, or to **original** when every member needs a capability. With every dimension observed, each member matches only itself. | `matcher.test.ts` |
| 5 | Unavailable mechanic or axis: unsupported capability, non-default value on an UNAVAILABLE axis, non-default value on a FIXED axis, and all 30 capability targets are unmatchable today | `matcher.test.ts` |
| 6 | Blocked rows: a blocked look-alike alone gives NO_MATCH plus a report, and one sharing a signature gives AMBIGUOUS. None of the 85 blocked rows (fugazza/fugazzetta included) is a target or catalog entry. | `matcher.test.ts` |
| 7 | No match → ORIGINAL (superset, subset, empty); in the reducer, a Bismarck plus mushroom pizza gives ORIGINAL with only the legacy registration | `matcher.test.ts`, `gameReducer.discovery.test.ts` |
| 8 | Multiple matches → AMBIGUOUS, sorted and order-independent, never a discovery | `matcher.test.ts` |
| 9 | Already discovered → ALREADY_DISCOVERED, with BEST/timesMade equal to the legacy result | `matcher.test.ts`, `gameReducer.discovery.test.ts` |
| 10 | Duplicate REGISTER_TO_DEX returns the same state; timesMade and Pitz are unchanged | `gameReducer.discovery.test.ts` |
| 11 | Existing v2 save: loads unchanged, an already-discovered recipe stays idempotent, a save written after a discovery keeps the v2 key set and reloads identically | `gameReducer.discovery.test.ts` |
| 12 | All 15 shipped recipes: the reference pizza discovers itself only, and Dex/total★ equal the legacy computation | `discoveryCatalog.test.ts`, `gameReducer.discovery.test.ts` |
| + | Cross-recipe exact match (Bismarck + 3 bacon = Breakfast Pizza) is written as Breakfast, scored as Breakfast, idempotent on repeat, and becomes `INCOMPLETE_MATCH` with 1 bacon | `gameReducer.discovery.test.ts` |
| + | Parity with Phase 2 in TypeScript: 101 (SHIPPED_KEEP) and 87 (EVIDENCE_STRICT) targets, 0 signature collisions, and each matches only itself when fully observed | `discoveryCatalog.test.ts` |

## 4. Save compatibility

There is no schema change and no migration. `dex` entries written by discovery are ordinary
`DexEntry` records for known recipe ids, with a real 1–5 ★ score, so `sanitizeDex` accepts them
unchanged. `lastDiscovery` is transient and never persisted. Test 11 covers an existing v2 save,
and the existing `persistence.test.ts` suite (v1→v2 migration) passes unmodified.

## 5. Verification

| Check | Result |
|---|---|
| Focused tests (`src/logic/discovery`, `discoveryCatalog`, `gameReducer.discovery`) | 53/53 |
| Full unit suite | **2377/2377** (baseline at `9c22ef2`: 2324; 53 new; 0 changed or removed) |
| `tsc -b` | clean |
| `oxlint` | clean |
| `vite build` | OK. The Phase-2 JSON is not in the bundle: only test support imports it. |
| Chromium E2E (`iphone-390x844`, `iphone-360x800`, all specs) | **102/102** |
| WebKit E2E | Cannot launch in this sandbox (no WebKit binary). The PR's own `e2e-webkit.yml` CI job is the authority. |

## Human Verification Videos

This change has no visible UI. The videos show the unchanged real-browser flow that the new
discovery code now runs inside.

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `TETO_P3-1_Discovery_HV_390x844.mp4` | 390×844 | 35.7 s | 828 KB | H.264 High, yuv420p, 25 fps | PASS |
| `TETO_P3-1_Discovery_HV_360x800.mp4` | 360×800 | 36.4 s | 791 KB | H.264 High, yuv420p, 25 fps | PASS |

Download: both files were delivered in the session, not committed (`artifacts/` is gitignored).

Video Verification: PASS. Both files exist, are non-empty, decode fully with `ffmpeg -f null`,
record the full viewport, and show each state held for about 1–2 s.

What to check in each video:

1. A fresh save goes HOME → Pizza Select → Margherita → full DOUGH/SAUCE/CHEESE/TOPPING/BAKE/CUT →
   RESULT: 「✨マルゲリータを発見しました！」. This is the **successful discovery**. Save: margherita
   ×1.
2. 「もう一度つくる」 → Margherita **without basil** → RESULT 「失敗 / バジルが入っていません」, +0 Pitz.
   This is the **non-match**: nothing is registered, and the save is unchanged.
3. 「もう一度つくる」 → normal Margherita → RESULT, with no new discovery. This is the **regression
   check** for normal cooking: timesMade becomes 2, and BEST follows the unchanged legacy rule.
4. Dex: 発見 1 / 15, マルゲリータ 2回作成.

Recorder note: the bake needle is driven by Playwright's virtual clock and lands slightly
differently from run to run. In the committed 390×844 run, round 1 landed just under the window
(★2, 58点) and round 3 inside it (59点), so the Dex shows NEW BEST!. A baseline run of the same
script on unmodified `main` (both rounds 59点) shows the same screens without that badge. This is
the legacy BEST rule, not this change.

Screenshots (after only, since there is no UI change):
`docs/reports/screenshots/progression2-p3-1-discovery/{390x844,360x800}-{1-home-fresh,2-result-discovery,3-result-no-basil,4-result-repeat,5-dex}.png`.

An "original pizza" that **passes** the gate cannot be reached through today's recipe-filtered
tray (§1.3). It is proven at the reducer level (case 7), and its UI belongs to P3-2.

## 6. Remaining blockers and handoff for Phase 3-2

1. **Owner decisions A-01…A-05 (P3-0) are still open.** The runtime catalog assumes SHIPPED_KEEP
   for the 15 production recipes only. Onboarding must not ship until A-01 is decided.
2. **There is no free-cook entry point.** The tray still filters to the selected recipe, and the
   Completion Gate is recipe-relative. P3-2 needs:
   - a recipe-free round;
   - the X-3 recipe-free completion rule (dough, at least 1 item, a generic bake window);
   - a decision on what the legacy "register the selected recipe" step means when no recipe is
     selected.
3. **Legacy selected-recipe registration on a superset pizza.** Today a PASS pizza with extra
   ingredients (not reachable through the UI) still registers the selected recipe, as before this
   change. Under Phase 2 it is an original pizza. Retiring or keeping that path is a P3-2 decision.
4. **Only 15 of 101 targets are recordable.** The other 86 have no `RecipeId`, Dex card or art,
   and most use ingredients the game does not have. Four capability-free ones use only existing
   ingredients: aussie, brazilian-calabresa, pesto-tonno and portuguesa. Content work has to add
   them as recipes before they can be discovered. Until then they would read as ORIGINAL.
5. **Shape and zones need classification rules** before DOUGH_SHAPE_TARGET or ZONED_PLACEMENT
   ship. Until then they stay UNAVAILABLE.
6. **Only the reducer sees the outcome.** `lastDiscovery` is not rendered. The 「発見した！」 /
   「オリジナルピザ」 ceremony, Teto hints and the Pitz discovery bonus belong to P3-2/P3-3.
7. **Lunch Rush does not run discovery.** C-06 (a pool drawn from discovered recipes only) is
   still open.
8. **Save v3** (discovered-target set, ⭐ ledger, owned items/stock, from the Phase-2 P3-1 row)
   was deliberately not introduced. It is needed once a discovery target is no longer a
   production `RecipeId`.
