# TETO Post-W1 Cooking Steps — Phase 1 Fresh Audit (READ-ONLY, docs-only)

Status: **Fresh Audit complete — STOP.** No implementation, no `src/**` / `e2e/**` / CSS / runtime
change, no PR, no merge. Future design only.

| Item | Value |
|---|---|
| Audited `main` SHA | `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5` (Merge PR #228, W1 I5a) — fresh `git fetch origin main` |
| Branch | `claude/teto-cooking-steps-audit-vyx88k` (cut from the SHA above; `merge-base --is-ancestor` passes) |
| Parallel work, not touched | I5b-3 Production Integration (separate session/branch — not read, not fetched, not referenced beyond its known scope). I5b-4 Fresh UI/UX Audit (its "6 tabs OK @360px / 7 tight / 8 impossible" finding is taken as given input from the owner). |
| Method | Every claim below is re-derived from code on the audited SHA. Prior design docs are cited only as "what was planned", and each plan item is re-checked against what the code actually contains. |

---

## 0. Executive summary

- The **step machine is already generic** (`CookingProfile.steps`, `PREPARE`/`BAKE`/`POST_BAKE`, 9-member
  `MakingStep`, `CONFIRM_MAKING_STEP` walking pre-/post-bake sub-sequences). The only post-bake step
  with gameplay is **CUT**. `FINISH`/`FOLD`/`SEAL`/`EDGE_FILL` are reserved union members with **zero
  gameplay**. The reducer walk `FINISH → CUT → RESULT` is already unit-tested.
- **Per-recipe variation today is data only:** which of SAUCE/CHEESE/TOPPING appear (derived from
  ingredient categories), which sauce ingredient (tomato / pesto / olive-oil), CUT on/off (allowlist,
  all 15 on), slice count (4/6/8 supported, all 6), bake window, piece reference layout.
  **Everything else is shared:** round dough, one sauce layer, one bake, circle-based CUT, fixed Scoring
  2.0 weights.
- **Scoring, completion, inventory use and free-cook matching all happen once, at `CONFIRM_BAKE`.** That is
  before `POST_BAKE`. This is the biggest hidden prerequisite for any post-bake mechanic. CUT gets away
  with it only because CUT is scored separately and never enters the total.
- **Recommended first mechanic: LATE_ADDITION, `post_bake` mode, scatter-only.** It is the reserved
  `FINISH` step, shown to the player as "仕上げ". It reuses POST_BAKE, the existing scatter placement,
  the pieces/quantity components and the tested reducer walk. It gives a gameplay difference players
  can see ("焼いた後にのせる"). Its prerequisites are **score finalization moving to round end** and
  **POST_BAKE no longer meaning "CUT"** in `GameScreen`. Phase 1 recipes must stay at **≤ 6 visible tabs**.
- **Olive oil stays a SAUCE variant** (`PAINT_TEMPORARY`) in Phase 1. A separate oil step only pays off
  as a *second* spread layer (tomato + oil drizzle), and that is Phase 2 (DRIZZLE mode on FINISH).
- **No-sauce already works for steps, completion and discovery, but not for scoring.**
  `ReferencePizza.sauce` is mandatory and the sauce weight is fixed at 52/100. No-cheese and no-topping
  recipes already ship and work end to end.
- **Shapes (oval / boat / rectangular / pan / folded) are all major.** Several shared parts assume a
  circle: `isInsideDough`, `findOpenSpot`, CUT geometry, the reference ring and the thumbnails. Defer them.

---

## 1. Current Cooking architecture (as coded on `12a09de`)

### 1.1 Flow

```
ORDER → PREPARE ──(START_BAKE)──> BAKE ──(CONFIRM_BAKE)──> POST_BAKE? ──> RESULT → DISCOVERED
        makingStep walks                 score / completion /            makingStep walks
        preBakeSteps(profile)            inventory / free-cook match     postBakeSteps(profile)
                                         ALL computed here               (only CUT has gameplay)
```

- `GamePhase = ORDER | PREPARE | BAKE | POST_BAKE | RESULT | DISCOVERED` (`src/state/gameReducer.ts:75`).
- `MakingStep = DOUGH | SAUCE | CHEESE | TOPPING | FOLD | SEAL | EDGE_FILL | CUT | FINISH` (`gameReducer.ts:92`).
- `GameState.cookingProfile` is snapshotted once per round (`gameReducer.ts:433`) and is never persisted.
- `CONFIRM_MAKING_STEP` walks `preBakeSteps` during PREPARE and `postBakeSteps` during POST_BAKE, forward
  only. Confirming the last post-bake step moves to RESULT (`gameReducer.ts:845-905`).
- `POST_BAKE_STEPS = {CUT, FINISH}` is a fixed property of the step, never a per-recipe choice
  (`src/data/cookingProfiles.ts`, `isPostBakeStep`).
- FREE's `REGISTER_TO_DEX` is already deferred to the end of POST_BAKE (`App.tsx:486-508`).

### 1.2 Step-by-step: variable vs. common

| Step / aspect | Per-recipe variable (data) | Common to all recipes (code) |
|---|---|---|
| **DOUGH** | nothing | Always present. 8-point radial `doughShape`, bidirectional stretch, circle guide `DOUGH_RADIUS=48`, completion threshold 0.75, `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS=58`. Dough is **not scored**. |
| **SAUCE** | Present only if a `category:"sauce"` ingredient is required (`deriveCoreSteps`). Which ingredient: `tomato-sauce` / `pesto` / `olive-oil` (`recipeSauceProfiles.ts`). Interaction label `PAINT` vs `PAINT_TEMPORARY`. | One field-based dispenser / heatmap pipeline for all three. `PAINT_TEMPORARY` has **no behavioural consumer**: grep finds only a comment in `scoringV2/index.ts:88`. **One** sauce per pizza: a new sauce replaces the old (`sauceIds: [id]`). Reference target is `computeMechanicalSauceReference(recipeId)`. |
| **CHEESE** | Present only if a cheese is required. Which cheeses, and minCount. | Scatter via `PLACE_TOPPING`, gated to `makingStep === "CHEESE"`. |
| **TOPPING** | Present only if a topping is required. Which toppings, and minCount. | Scatter via `PLACE_TOPPING` (phase must be **PREPARE**). `findOpenSpot` clamps to the **circle**. 8-slot `PIECE_RING_POSITIONS` reference ceiling. `MAX_INGREDIENT_PALETTE_SLOTS=6`. |
| **BAKE** | `bakeTarget {start,end}` | One needle-tap minigame, `classifyBake` raw/perfect/burnt, M3A guide fade, continuous `bakeHeat` visuals. `bakeRoastResistant` is an **ingredient** flag, not a recipe flag. There is no mid-bake interaction. |
| **CUT** | On/off via `CUT_ELIGIBLE_RECIPE_IDS` (all 15 on). `cutConfig.requestedSliceCount` 4/6/8 (all 6; `COOKING_PROFILE_OVERRIDES` is empty). | Rim-to-rim lines against the **ideal circle** (`cut/geometry.ts` uses `DOUGH_CENTER/DOUGH_RADIUS`). Required count, limit +2, duplicate rejection, undo. `CutEvaluation.cutScore` is shown **separately** ("※総合スコアとは別の評価です", `ResultPanel.tsx:417`) and is **not** part of Scoring 2.0 total. |
| **postBakeSteps** | Whatever CUT/FINISH the profile lists | Only `CUT` has UI. `GameScreen.tsx` hard-codes `phase === "POST_BAKE" && makingStep === "CUT"` at lines 241, 377, 449, 464 and 496. A FINISH step would render nothing usable today. |
| **cookingProfiles** | `steps` (derived), `cutConfig` | `stepTimeLimits` is reserved and read by nothing. FREE-cook sentinel → `DEFAULT_COOKING_PROFILE` (D/S/C/T, **no CUT, no FINISH**). |
| **Step timing** | nothing | `perStepElapsedMs` per MakingStep (Phase 1A-T). BAKE is excluded. FREE-only (`cookingTiming` is null in Lunch Rush). No per-step timeout anywhere. |
| **Scoring 2.0** | Reference fixture per recipe | Fixed weights Sauce 52 / Pieces 16 / Recipe 12 / Bake 20, × quantity factor Q. Ruleset `phase-4a-2-shadow-4-quantity`. Computed **once, at CONFIRM_BAKE**. |
| **Completion Gate** | Required ingredients, sauce reference | 5 fixed reasons. Sauce check runs only if the reference sauce ingredient is a required ingredient. Computed at CONFIRM_BAKE. |
| **Inventory** | — | `consumePizzaInventory` runs at CONFIRM_BAKE only. |
| **Discovery identity** | — | `signature.ts`: `late`, `spreadLayers`, `pan`, `shape`, `enclosure`, … are `FIXED_BY_FLOW` / `UNAVAILABLE`. |

### 1.3 Visible tab count per shipped recipe (tabs = pre-bake steps + 焼く + post-bake steps)

| Tabs | Recipes |
|---|---|
| 6 (D·S·C·T·焼く·カット) | margherita, genovese, bismarck, funghi, salsiccia, pepperoni, napoletana, tonno-e-cipolla, breakfast-pizza, capricciosa, meat-lovers |
| 5 (no cheese) | marinara, fugazza, pizza-bianca |
| 5 (no topping) | quattro-formaggi |

Today's ceiling is **6**, and 11 of the 15 recipes are already at it. So **any new step added to a
"full" recipe gives 7 tabs**, which I5b-4 rates as tight at 360px.

---

## 2. Existing foundations (re-verified in code, not from memory)

| Foundation | Where | State on `12a09de` |
|---|---|---|
| Recipe Cooking Steps 1.0 design | `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` | Phase 1A (profile / POST_BAKE / widened union) and 1A-T (step timing) are **built**. 1B/4B (CUT) are **built**. 2A FINISH, 2B REGION and 3A FOLD/SEAL are **not built**. |
| `CookingProfile` + `getCookingProfile` + `deriveCoreSteps` | `src/data/cookingProfiles.ts` | Live. Step skipping is data-driven, including SAUCE. |
| `COOKING_PROFILE_OVERRIDES` | same | Live, but **empty**. This is the hook for a non-derived profile (for example one with FINISH). |
| `POST_BAKE` phase + FINISH walk | `gameReducer.ts`, `gameReducer.cookingSteps.test.ts:167-210` | Reducer supports `…TOPPING → FINISH → CUT → RESULT` and has tests for it. **No UI and no action for FINISH.** |
| `MakingStepTabs` `postSteps` / `currentPhase` | `src/components/MakingStepTabs.tsx` | Renders any post-bake steps generically. Label `FINISH: "仕上げ"` already exists (`makingStepLabels.ts`). |
| Step Timing | `src/logic/cookingTiming.ts` | `perStepElapsedMs` covers any MakingStep, so FINISH would be timed at no extra cost. |
| `stepTimeLimits` | `CookingProfile` | Type only. No reader. Challenge-Mode hook. |
| Pizza Cutting 1.0 | `src/logic/cut/*`, `docs/design/TETO_PIZZA-CUTTING_1.0.md` | Complete on all 15 recipes. Circle-only. Slice count 4/6/8 is typed and validated. |
| `SauceInteractionKind = PAINT \| PAINT_TEMPORARY` | `recipeSauceProfiles.ts` | Label only. `// TODO: olive-oil -> DRIZZLE candidate` on 3 recipes. |
| `bakeRoastResistant` | `ingredients.ts:78` | Precedent for an ingredient-level bake-visual exemption. A late piece needs a similar (per-placement) exemption. |
| 172-recipe Mechanic Matrix | `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md` + JSON | 11 capabilities. Recommended order is DOUGH_VARIANT → MULTI_SPREAD_LAYER → LATE_ADDITION → … |
| Discovery signature axes | `src/logic/discovery/signature.ts:94-106` | `late` is `FIXED_BY_FLOW` ("FINISH is a reserved step with no gameplay"). `spreadLayers`, `pan` and `enclosure` are also `FIXED_BY_FLOW`. `shape` and `zones` are `UNAVAILABLE`. |
| E2E coverage of steps | `e2e/dynamic-cooking-steps.spec.ts` (6 tabs fit), `e2e/pizza-cutting-phase4b.spec.ts` | Guards the ≤6-tab layout and the POST_BAKE/CUT flow in FREE and Lunch Rush. |

**Where the design and the code have drifted apart (important for Phase 1):**

1. Cooking Steps 1.0 §10 recommended **"core score + per-step bonus"**. CUT did not follow this: it
   ships as a **separate evaluation that is not part of the total**. There is still no per-step bonus
   anywhere, so a FINISH step has no scoring slot waiting for it.
2. §12 recommended `RecipeRequirement.applicationPhase?: "PRE_BAKE" | "POST_BAKE" | "EDGE_FILL"`. **It does not
   exist.** `RecipeRequirement` is still `{ ingredientId, minCount }`.
3. §13 recommended `ReferencePizza.finishGuide?`. **It does not exist.**
4. §8 assumed POST_BAKE would host CUT and FINISH generically. `GameScreen` instead hard-codes CUT at five sites.

---

## 3. Candidate mechanics — classification

Legend: **✅ Already** = expressible with data only; **🟡 Small** = extends existing seams, with no new
geometry or phase; **🔴 Major** = new geometry, a new phase type or structural changes to shared
assumptions.

| # | Mechanic | Class | Why (code evidence) |
|---|---|---|---|
| A | Olive-oil **as the base** (New Haven, Fugazza, Bianca, QF) | ✅ Already | `RECIPE_SAUCE_PROFILES` → `olive-oil` / `PAINT_TEMPORARY`, on the same paint path as tomato. |
| A′ | Olive-oil as an **own step / drizzle layer** on top of another sauce | 🟡 Small–Medium | Needs a second spread layer: `PizzaState.sauceIds` is a single-element list and a new sauce replaces the old. Reusing FINISH (post-bake drizzle) avoids a pre-bake multi-layer model. The DRIZZLE gesture is new. |
| B | **No-sauce** recipe | 🟡 Small | Steps ✅ (`deriveCoreSteps` skips SAUCE). Completion ✅ (the sauce check is skipped when not required). Discovery ✅ (`sauceBase` compare is conditional). **Scoring ✗**: `ReferencePizza.sauce` is mandatory and `SAUCE_WEIGHT=52` is fixed. No sauce scores ≈0 on 52% of the total. Reference thumbnail / heatmap also always draws a sauce. |
| B′ | No-cheese / no-topping | ✅ Already | Shipped: marinara, fugazza, pizza-bianca (no cheese); quattro-formaggi (no topping). |
| C | **Late / post-bake topping** | 🟡 Small (seams exist) — medium effort | FINISH is reserved and the reducer walk is tested. Needs: a FINISH placement action (`PLACE_TOPPING` requires PREPARE), per-piece stage marking, **score / completion / inventory / free-cook finalization moved to round end**, no bake tint on late pieces, `GameScreen` generalized beyond CUT, and discovery `late` axis made OBSERVED. |
| D | Special pizza **shape** (oval, rectangle) | 🔴 Major | Circle assumptions in `isInsideDough`, `findOpenSpot`, CUT geometry (`CIRCLE_AREA`, rim-to-rim), `PIECE_RING_POSITIONS`, sauce `SAUCE_TARGET_RADIUS`, thumbnails and the DOUGH guide ring. |
| E | **Pan / tray** cooking | 🔴 Major | No pan concept. Bake is a single scalar. Round pan alone = medium (bake curve + visual). Rectangular pan = D + E. Matrix: `PAN_BAKE` is structural. |
| F | **Boat** (pide) | 🔴 Major | D + the dough gesture changes (pinched ends). Matrix: `DOUGH_SHAPE_TARGET` (L). |
| G | **Piadina** (flatbread) / **folded** (calzone) | Piadina 🟡 Small (DOUGH_VARIANT, data + visual; the matrix row needs only `DOUGH_VARIANT`) / Folded 🔴 Major (ENCLOSE: FOLD+SEAL, must disable CUT, hides fillings in visuals / thumbnails, new completion reasons) |
| H | **No-cut** recipe | ✅ Already | Leave the recipe out of `CUT_ELIGIBLE_RECIPE_IDS`. POST_BAKE is then skipped. All 15 shipped recipes are opted in; W1's choice belongs to I5b-3. |
| I | **Special cut** | Slice count 4/8: ✅ Already (`COOKING_PROFILE_OVERRIDES` + `CutConfig`) / Grid or square cut: 🔴 Major (circle geometry) |
| J | **Mid-bake operation** | 🔴 Major | BAKE is one tap → `CONFIRM_BAKE`. Mid-bake means splitting the bake into two segments plus an in-oven step, splitting bake scoring, reworking the M3A guide fade and adding a mid-bake visual state. The matrix merged it into LATE_ADDITION `mid_bake` mode, but the runtime cost is much higher than `post_bake`. |
| K | **Ingredient timing difference** | Pre vs. post bake = C (🟡). Mid-bake = J (🔴). "Order within PREPARE" (cheese before sauce, `STEP_ORDER`) = 🟡 Small (a profile override, but the reducer's category/step gate and `layerOrder` identity need to follow). |

---

## 4. First mechanic — comparative analysis

The candidates that are realistic for a first vertical slice are C, B, A′ and K/STEP_ORDER. D, E, F,
G-folded and J are ruled out as first moves (major).

| Axis | **C. Late topping (post-bake, scatter)** | B. No-sauce | A′. Oil drizzle layer | STEP_ORDER |
|---|---|---|---|---|
| Gameplay difference visible to the player | **High**: a new phase moment, "焼いてからのせる", fresh-looking pieces on a baked pizza | Low: a missing tab | Medium: a new gesture, but "more sauce" | Low–Medium: the same tabs in a different order |
| Implementation size | Medium (see §7) | **Small** | Medium–Large (DRIZZLE gesture + layer model) | Small |
| Mobile operation | **Reuses** the existing tap/drag placement | Nothing new | New gesture that needs Human-Feel tuning (the paint path took many fix rounds) | Nothing new |
| Reuse of existing architecture | **High**: POST_BAKE, FINISH, `postSteps` tabs, scatter, pieces/quantity components, step timing | High | Medium: sauceField is reused, but `sauceIds` single-layer must change | High |
| Scoring impact | Existing Pieces + Q + Recipe components. **Finalization point moves.** | **Changes the core formula** for that recipe (52% re-normalization) → ruleset bump, Dex BEST comparability question | New sub-score or multi-layer sauce score | None, or `layerOrder` |
| Save impact | None (GameState not persisted). New ingredient ids → catalog / ladder only. | None | None | None |
| E2E impact | New spec. `GameScreen` CUT hard-codes → regression on the cutting specs. | Small | New gesture specs | Small |
| Reuse for recipe expansion | **12 required + 11 candidate** rows in the 172 matrix, plus authenticity upgrades (prosciutto crudo, rucola, basil-after) | **44 "none" + 33 "unspecified"** sauce rows (content unlock, not a mechanic) | 17 required + 10 candidate | 2 rows |
| UI tab count | +1 (仕上げ). **Must stay ≤6**, which constrains recipe choice (§9) | −1 | +1 if its own step; 0 if a FINISH mode | 0 |

**Trade-off in short:**

- **B (no-sauce)** is the cheapest and unlocks the most *content*. But it is not a cooking mechanic,
  and it touches Scoring 2.0's core weights. It is a recipe-variation enabler: better scheduled next
  to other scoring work than presented as "the first new mechanic".
- **A′ (drizzle)** is the most "on theme" for the olive-oil TODO. But it brings a new gesture with
  Human-Feel risk *and* a layer-model change: two unknowns in one slice.
- **C (late topping)** has the best balance between how much the player notices and how much risk it
  carries. Its real cost is not the UI but the **finalization move** (score / completion / inventory
  / free-cook match from CONFIRM_BAKE to round end). That move is a *one-time* prerequisite that
  every later post-bake mechanic also needs: drizzle-as-FINISH, cheese-after, and finishing oil.
  Paying it first de-risks A′.

**Recommendation: C, LATE_ADDITION `post_bake`, scatter-only, as the first mechanic.**

---

## 5. Olive oil — SAUCE variant vs. dedicated step

| | Keep as SAUCE variant (today) | Dedicated "オイル" Cooking Step |
|---|---|---|
| Recipes where oil **is** the base (Fugazza, Bianca, QF, New Haven) | Correct: the oil *is* the base layer and one step reads naturally | Adds a tab and leaves SAUCE empty (so the SAUCE tab disappears). Net 0 tabs but a renamed step, for no gameplay gain. |
| Recipes with **tomato + oil** (margherita-pizzadb, marinara-pizza, burrata, crudaiola, grandma, pesto-burrata per matrix `spreadLayers`) | Not expressible (single `sauceIds`) | Expressible, but +1 tab before BAKE → 7 on full recipes |
| Real-world timing | Base oil: pre-bake ✔ | Finishing oil ("a crudo"): **post-bake**, which is a FINISH drizzle, not a PREPARE step |
| UI tabs | 0 | +1 (7 on the 11 recipes already at 6) ✗ |
| Scoring | Existing sauce component | Needs a second spread score |

**Verdict:** keep olive-oil as a **SAUCE variant** for base oil (no change). Model finishing oil as a
**FINISH `drizzle` mode** (Phase 2), reusing the Phase 1 finalization work and the `sauceField` paint
pipeline. There should **never** be a standalone PREPARE "オイル" tab. `PAINT_TEMPORARY` is still
behaviour-less; either give it meaning in Phase 2 or collapse it into `PAINT`. That is an Owner
Decision (OD-9).

---

## 6. No-sauce (and no-cheese / no-topping)

| Layer | No cheese | No topping | **No sauce** |
|---|---|---|---|
| Steps / tabs (`deriveCoreSteps`) | ✅ shipped | ✅ shipped | ✅ SAUCE skipped (data-driven, not hard-coded) |
| Tray (only the recipe's own ingredients) | ✅ | ✅ | ✅ |
| Completion Gate | ✅ | ✅ | ✅ `checkSauceQuantity` returns null when the reference sauce is not required |
| Discovery matcher | ✅ | ✅ | ✅ `target.sauceBase &&` is conditional; signature `sauceBase` = `[]` |
| `ReferencePizza` type | ✅ | ✅ (QF) | ✗ `sauce: ReferenceSauce` is **required** |
| Scoring 2.0 | ✅ | ✅ | ✗ Sauce 52% compares against a reference sauce. With no deposits, `presenceGate` → ≈0 on 52 pts. |
| Reference visuals (`SauceHeatmapCanvas`, thumbnails) | ✅ | ✅ | ✗ always paints the ideal sauce fixture |
| FREE-cook | ✅ | ✅ | ✅ the SAUCE step can be skipped ("次へ" has no sauce gate) |

**So, with no new mechanic:** "no cheese" and "no topping" are pure recipe variations today.
**"No sauce" is not.** It needs a small scoring extension: `ReferencePizza.sauce` becomes optional,
and a documented re-normalization rule applies, for example Pieces/Recipe/Bake re-scaled to 100
keeping their ratio, which is the same method B1 used. The reference visuals must also skip sauce
when it is absent. It needs **no new step, UI or save change**. Because it changes the core formula
for those recipes, it needs a ruleset bump and an Owner Decision on BEST comparability (OD-8).
Content pool: 44 matrix rows with sauce status `none` and 33 `unspecified`.

---

## 7. Late topping (post-bake) — can `postBakeSteps` express TOPPING after BAKE?

**Short answer:** the *step sequence* can be expressed today. For example, a
`COOKING_PROFILE_OVERRIDES` entry with `["DOUGH","SAUCE","CHEESE","FINISH","CUT"]` walks correctly in
the reducer, and the tabs render "仕上げ". **The step would be empty, though.** There is no action,
no UI, no scoring and no finalization for it. `TOPPING` itself can never be post-bake
(`POST_BAKE_STEPS` is fixed), and that is the right choice. **FINISH is the post-bake topping step.**

Required changes (design only):

| Area | Change needed | Notes |
|---|---|---|
| **Data** | `RecipeRequirement.applicationPhase?: "PRE_BAKE" \| "POST_BAKE"` (absent = PRE_BAKE; Cooking Steps 1.0 §12). `deriveCoreSteps` appends `FINISH` when any requirement is POST_BAKE, and excludes those requirements when deciding whether CHEESE/TOPPING appear. | Zero migration for the existing recipes. Keeps "phase" recipe-scoped, so the same ingredient (basil, oil) can be pre-bake in one recipe and post-bake in another. |
| **State** | Each `PlacedTopping` carries `stage: "PRE_BAKE" \| "POST_BAKE"` (or a parallel `finishToppings[]`). `PizzaState` stays transient. | Per-piece stage keeps a single pieces list for scoring and rendering. |
| **Reducer** | New `PLACE_FINISH` (or widen `PLACE_TOPPING` to accept `phase==="POST_BAKE" && makingStep==="FINISH"` for POST_BAKE-phase requirements only). `RESET_PIZZA` is PREPARE-only, so FINISH needs its own undo (last-piece undo, like `UNDO_CUT_LINE`). | Same "never trust UI" guards as the existing cases. |
| **Finalization (key prerequisite)** | Move `computeScoringV2` / `evaluatePizzaCompletion` / `consumePizzaInventory` / `resolveFreeCookPizza` from `CONFIRM_BAKE` to **round end**: the last POST_BAKE confirm, or CONFIRM_BAKE when there is no POST_BAKE. Alternatively, recompute at round end and keep the CONFIRM_BAKE value as provisional. | Today a late piece would be unscored, would not count toward completion (**a recipe could FAIL for a "missing" ingredient that the player adds later**), and would not be consumed from stock. The Lunch Rush serve path reads `state.completion` and must see the final value. |
| **Scoring** | Late pieces join the existing **Pieces + Quantity + Recipe** components through the recipe's reference `pieceGroups`. No new weight. Correct phase is enforced structurally: a POST_BAKE requirement is offered **only** in FINISH, so "wrong timing" cannot happen and needs no score. | Keeps 52/16/12/20 byte-identical for all existing recipes. Only a new ruleset tag if the finalization move changes any number (it should not for recipes without FINISH, and a regression test must pin this). |
| **Visual** | A late piece must not take `bakeHeat` roast / cheese-melt (`toppingVisualFrame`, `cheeseVisualFrame`). It renders "fresh" on the baked pizza. RESULT hero, `PizzaThumbnail` and the reference should show it on top. | Per-placement version of `bakeRoastResistant`. |
| **UI** | Generalize `GameScreen`'s five `makingStep === "CUT"` sites to "current post-bake step". IngredientTray is mounted in FINISH with only POST_BAKE requirements. CTA: 「次へ」 → CUT, or 「できあがり」 when FINISH is last. Keep the roomy stage in FINISH (same tap-precision reasoning as CUT). | Tabs: +1 "仕上げ" (§9). |
| **Timing** | Nothing new: `perStepElapsedMs.FINISH` comes for free. FINISH time counts toward FREE Cooking Time only if the owner decides so. Today `completedMs` stops at START_BAKE and CUT time is outside it. | OD-6. |
| **Discovery** | `signature.late` goes from `FIXED_BY_FLOW` to OBSERVED (the set of POST_BAKE ingredient ids). The FREE-cook profile must include FINISH, or a late recipe **can never be discovered by free cooking**. Adding FINISH to every free-cook round costs 1 tab (D·S·C·T·焼く·仕上げ = 6, OK) and 1 extra tap. | OD-5. |
| **Save** | **None.** `GameState` / `PizzaState` are never serialized. New ingredient ids (for example `arugula`, `prosciutto-crudo`) go through the existing catalog + I0 forward-compat path. Dex is keyed by recipeId. | Scoring ruleset bump would be the only persisted-meaning change (BEST kept, never recomputed). |
| **E2E** | New `finish-step` spec (FREE + Lunch Rush, 390×844 + 360×800, ≤6 tabs, pieces visible after bake, FINISH → CUT → RESULT). Existing cutting and dynamic-steps specs must stay green unmodified. This is the guard for the `GameScreen` generalization. | WebKit gate applies (src change). |
| **Human Verification** | 390×844 video: select → PREPARE → BAKE → 仕上げ (place late pieces) → CUT → RESULT. Before/after screenshots in `docs/reports/screenshots/<task>/`. | Per `TETO_HUMAN-VERIFICATION-POLICY.md`. |

---

## 8. Shape mechanics (oval, boat, rectangular/pan, folded)

| Impact area | Oval | Boat (pide) | Rectangular / pan | Folded (calzone) |
|---|---|---|---|---|
| Dough interaction | 8-point radial model *can* approximate an ellipse, but the guide, completion (0.75 of circle) and the `DOUGH_RADIUS` target are circular | Pinched ends; the radial model fits poorly | Radial model cannot represent corners; a pan implies a fixed shape (press-to-fill gesture instead of stretch) | Circle dough + a new FOLD drag + SEAL trace |
| Reference layout | `PIECE_RING_POSITIONS` is a ring → needs per-shape layouts | same | Grid layout | Fillings hidden after fold |
| Scoring | Sauce `SAUCE_TARGET_RADIUS` (circle), pieces vs. ring, `findOpenSpot` clamps to the circle | same | same + bake curve | New completion reasons (unclosed / unsealed); visuals hide the pieces the score reads |
| Thumbnail | `PizzaThumbnail` / `ReferenceThumbnail` are circular | same | same | New closed silhouette |
| CUT | Circle geometry (`CIRCLE_AREA`, rim-to-rim, `perpendicularDistanceFromCenter`) → must be disabled or rewritten | same | Grid cut → new geometry | **Must be disabled** (no CUT on a calzone) |
| Ingredient placement | `isInsideDough` is circle-based on the reducer boundary | same | same | Placement happens before fold (OK) |

**Judgement: not Phase 1.** Every shape touches at least six shared circle assumptions. Oval is the
cheapest, but its gameplay payoff is low: pinsa and piadina only need `DOUGH_VARIANT` per the matrix,
not a shape. Order: shape work waits until a PAN_BAKE design exists (the matrix notes that 4 of 5
shape rows also need PAN_BAKE). The first shape slice should be **one** of rectangular-pan or
calzone, decided by content demand. Neither should come before Phase 3.

---

## 9. Cooking tabs — keeping "steps ≠ always tabs"

Constraint (I5b-4): **≤6 OK at 360px, 7 tight, 8 impossible.** Today there are 11 recipes at 6.

| Option | What it is | + | − | When |
|---|---|---|---|---|
| **T0. ≤6 invariant (recipe choice)** | Pick Phase-1 recipes whose total visible tabs stay ≤6. Examples: a recipe with no *pre-bake* TOPPING (all its toppings are late) → D·S·C·焼く·仕上げ·カット = 6; a no-cheese oil-base recipe + late → D·S·T·焼く·仕上げ·カット = 6. Add a unit test asserting max visible tabs ≤ 6 over all recipes. | Zero UI work; enforceable | Limits which recipes can use FINISH | **Phase 1** |
| T1. Recipe-specific visible steps | Already done (`deriveCoreSteps`) | ✅ | Doesn't help full recipes | Live |
| T2. Grouped / phase strip | Strip shows `準備 ▸ 焼く ▸ 仕上げ` groups; the active group expands to its sub-steps and the others collapse to one chip (✓準備) | Bounds the strip at about 5 items whatever the step count; matches the 3-phase model already in code (`currentPhase`) | Loses the at-a-glance full sequence; a new visual pattern needing Human Verification | Phase 2, before any recipe needs 7 |
| T3. Compact completed / locked chips | Completed tabs → "✓" icon chips; the active and next tabs keep labels (Cooking Steps 1.0 §9's original proposal) | Small change inside `MakingStepTabs` | Icons must be legible; 8 still hard | Phase 2 alternative to T2 |
| T4. Contextual phase header + horizontal progress dots | A single header "仕上げ (5/6)" + dots | Fixed width | Loses tab-tap affordance; `MakingStepTabs` is also the next-step CTA surface | Later, only if T2/T3 fail |
| T5. Hide BAKE indicator | Remove "焼く" from the strip (BAKE has its own full-screen CTA) | −1 tab immediately | BAKE is the phase boundary players orient on | Not recommended |

**Recommendation:** Phase 1 = **T0** (hard invariant + test). Design T2 (with T3 as fallback) as a
separate UI audit **before** Phase 2, because DRIZZLE or FINISH on full recipes will need 7.

---

## 10. Scoring architecture impact (Scoring 2.0)

Current total = (Sauce 52 + Pieces 16 + Recipe 12 + Bake 20) × Q. CUT = separate `cutScore`, not in the total.

| Mechanic | Existing component(s) | New component needed? | Formula / version impact |
|---|---|---|---|
| Olive-oil base (A) | Sauce | No | None |
| No-cheese / no-topping (B′) | Pieces / Q / Recipe | No | None (shipped) |
| **Late topping (C)** | **Pieces + Q + Recipe** (late pieces are just reference piece groups) | **No** (phase correctness is enforced structurally) | Finalization point moves; totals for non-FINISH recipes must stay byte-identical (pin with test) |
| No-sauce (B) | Sauce → N/A | No new component, but **re-normalization** | Core formula changes for those recipes → ruleset bump, OD-8 |
| Oil drizzle / 2nd spread (A′) | Sauce (2nd layer) | **Yes**: a spread-layer sub-score, or a FINISH bonus (Cooking Steps 1.0 §10 "core + step bonus") | New weight or bonus rule |
| Slice-count variants (I) | CUT (separate) | No | None |
| Special cut pattern / shape-aware CUT | CUT | Rewrite of CUT evaluation | CUT stays outside the total unless OD decides otherwise |
| STEP_ORDER | Recipe (or none) | No | None |
| Pan bake (E) | Bake | Bake curve variant | Bake scorer parameterized |
| Shapes (D/F) | Sauce, Pieces (layout) | **Yes**: dough / shape conformity (dough is unscored today) | New weight |
| Mid-bake (J) | Bake | **Yes**: split bake / timing component | New weight |
| Fold (G) | Completion Gate | Completion reasons + likely a closure score | New weight or bonus |

**Rule to carry forward:** a mechanic that can be enforced **structurally** (which step offers which
ingredient) should not get a score component. Score only what the player can do *well or badly*
inside the step.

---

## 11. Recommended Post-W1 Cooking Steps Phase 1 (minimum vertical slice)

**Mechanic:** LATE_ADDITION, `post_bake` mode, **scatter only** (no drizzle, no mid-bake), on the
reserved `FINISH` step ("仕上げ").

**Recipes (1–2, Owner picks, OD-2):** each must (a) have ≤6 visible tabs and (b) have a late-only
requirement. Candidates:

| Candidate | Pre-bake | Late (FINISH) | Tabs | New ingredients | Note |
|---|---|---|---|---|---|
| **Prosciutto e rucola**-type (matrix: `rucola-e-grana`, `READY`, FULL today with everything pre-bake) | tomato-sauce, mozzarella | prosciutto-crudo, arugula | D·S·C·焼く·仕上げ·カット = **6** | 2 (arugula, prosciutto-crudo) | Clearest "fresh on hot pizza" read. Needs 2 catalog rows + visuals + a ladder slot. |
| **Bianca + late** (e.g. oil base, rosemary pre-bake, arugula late) | olive-oil, rosemary | arugula | D·S·T·焼く·仕上げ·カット = **6** | 1 | Cheapest content, but weak real-world evidence → owner judgement |
| Existing-ingredient only (e.g. basil late on a new recipe) | — | basil | ≤6 | 0 | **Not recommended**: same ingredient set as margherita and differs only on the `late` axis → confusing discovery collision |

Default recommendation: **1 recipe, Prosciutto e rucola-type, 2 new late-only ingredients.** If the
owner wants zero new materials, defer Phase 1 content until the ingredient pipeline slot is available.
Do not use the basil-late collision.

**In scope:**
1. `RecipeRequirement.applicationPhase` + `deriveCoreSteps` FINISH derivation + max-6-tabs unit test.
2. Round-end finalization of score / completion / inventory / free-cook match, with a regression test
   that all 15 + W1 recipes produce identical results.
3. FINISH placement action + undo + reducer guards.
4. `GameScreen` post-bake generalization (CUT sites) + IngredientTray in FINISH.
5. Late-piece visuals (no roast), RESULT / thumbnail / reference rendering.
6. Discovery `late` axis OBSERVED + FREE-cook profile gains FINISH (if OD-5 = yes).
7. The recipe(s) + reference fixture + ladder / Shop placement (content bits per the existing pipeline).
8. Tests: unit (reducer / scoring / completion / signature / tabs) + E2E `finish-step` spec (FREE + Lunch
   Rush, 390×844 / 360×800) + WebKit gate.
9. Human Verification: 390×844 video + before/after screenshots.

**Out of scope:** drizzle / oil layer, mid-bake, no-sauce scoring, tab regrouping (T2/T3), shapes,
pan, fold, CUT changes, Challenge-Mode `stepTimeLimits`, Lunch Rush server-side scoring.

**Suggested slicing (each PR-sized):** P1-a finalization move (no behaviour change, pure refactor +
pinning tests) → P1-b FINISH step engine (fixture profile only, no recipe) → P1-c content: recipe +
ingredients + visuals + discovery → P1-d Human Verification / polish.

---

## 12. Roadmap

| Phase | Mechanic | Representative recipe type | Architecture prerequisite | UI impact | Scoring impact | Verification |
|---|---|---|---|---|---|---|
| **Phase 1** | LATE_ADDITION `post_bake` (scatter) | Prosciutto e rucola-type (fresh greens / cured meat after bake) | Round-end finalization; `applicationPhase`; POST_BAKE ≠ CUT in `GameScreen`; `late` identity axis | +1 tab "仕上げ", recipes limited to ≤6 (T0) | None new (Pieces / Q / Recipe); byte-identical for existing recipes | Unit + E2E finish spec + WebKit + HV video 390×844 |
| **Phase 2** | (a) FINISH `drizzle` mode = finishing oil / honey (MULTI_SPREAD_LAYER-lite); (b) **No-sauce scoring** (optional reference sauce + re-normalization); (c) **tab regrouping** T2/T3; (d) slice-count overrides 4/8 (data) | Margherita / marinara "a crudo" oil, burrata, hot-honey pepperoni; `none`-sauce rows (vongole, aussie, bianca-style) | Phase 1 finalization; 2nd spread layer in `PizzaState`; `ReferencePizza.sauce?`; UI audit for 7+ tabs | Drizzle gesture (Human Feel); strip redesign | Drizzle sub-score or FINISH bonus; no-sauce ruleset bump | Human-Feel rounds on drizzle; 360px tab audit; HV video |
| **Phase 3** | DOUGH_VARIANT (data: pinsa, piadina-flat, thin / thick); STEP_ORDER (cheese → sauce); ZONED_PLACEMENT (half / quadrant) | Pinsa romana, Trenton tomato pie, quattro stagioni | Identity axes `dough` / `layerOrder` / `zones` observed; profile overrides | Minimal (variant visuals; zone guides) | Mostly none; zones → pieces-by-zone | Unit + E2E + HV |
| **Later** | Mid-bake (LATE_ADDITION `mid_bake`); PAN_BAKE; DOUGH_SHAPE_TARGET (oval / rect / boat) + shape-aware CUT; ENCLOSE (calzone / folded); special cut patterns; PREP_STEP; FRY_COOK; LAMINATE | Mentaiko / natto, Detroit / Sicilian / al taglio, pide, calzone | Split BAKE; non-circle geometry everywhere (dough / placement / sauce / CUT / thumbnails); FOLD / SEAL; completion reasons | New gestures and new phases; likely T2 mandatory | New components (dough / shape, split bake, closure) | Full Human-Feel cycle per mechanic |

---

## 13. Owner Decisions required

| ID | Decision | Recommended default |
|---|---|---|
| OD-1 | First mechanic | LATE_ADDITION post_bake, scatter-only |
| OD-2 | Phase 1 recipe(s) and whether new late-only ingredients (arugula, prosciutto-crudo) enter the catalog / ladder | 1 recipe, Prosciutto e rucola-type, 2 new ingredients |
| OD-3 | Where "phase" lives: `RecipeRequirement.applicationPhase` (recipe-level) vs. an ingredient-level flag | Recipe-level (Cooking Steps 1.0 §12) |
| OD-4 | Move score / completion / inventory / free-cook finalization to round end (FREE and Lunch Rush) | Yes (prerequisite), shipped as its own no-behaviour-change slice |
| OD-5 | Does FREE cooking get a FINISH step? (otherwise late recipes cannot be discovered by free cooking) | Yes; the step can be skipped with 「次へ」 |
| OD-6 | Does FINISH time count toward FREE Cooking Time / efficiency? | No (mirror CUT: outside `completedMs`), revisit after HV |
| OD-7 | Lunch Rush: include late-topping recipes in the order pool in Phase 1? | Yes (shared flow), with E2E coverage |
| OD-8 | No-sauce scoring re-normalization rule + ruleset bump (Phase 2) | Keep the Pieces:Recipe:Bake ratio, re-scale to 100 |
| OD-9 | `PAINT_TEMPORARY`: give it DRIZZLE meaning in Phase 2 or collapse into `PAINT` | Decide in Phase 2 design |
| OD-10 | Enforce "≤6 visible tabs" as a test invariant until T2/T3 ships | Yes |

## 14. Blockers

- **None for this audit.**
- For implementation: (1) **I5b-3 must land first**, because W1 recipes touch the same files: `recipes.ts`,
  `referencePizza.ts`, `recipeSauceProfiles.ts`, `cookingProfiles.ts` (CUT allowlist) and the discovery
  ladder. Phase 1 must re-audit W1's final tab counts and CUT eligibility on the post-I5b `main`.
  (2) OD-1…OD-5 before P1-a. (3) The I5b-4 UI audit's findings should be merged or referenced so the ≤6
  invariant has a written SSOT.

## 15. Verification of this report

Docs-only. No `src/**`, `e2e/**`, CSS or runtime file changed (`git diff --stat` = this file only).
No tests needed or run.
