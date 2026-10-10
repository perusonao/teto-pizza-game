# TETO Post-W1 Cooking Steps — Next-Phase Design (docs-only)

Status: **Design complete — STOP before implementation.** No `src/**`, `e2e/**`, CSS, runtime,
tooling or test change. No merge. Nothing here is an Owner Decision; every open question is listed
in §8 with options, and nothing is decided on the Owner's behalf.

> **Re-baseline note (Phase 2 PR-A, 2026-10-10, `main` `e0397ae`).** This file is imported unchanged
> from PR #295 (audit snapshot `86b48fd`, 25 runtime recipes) except for the items below. The
> snapshot body in §1 (audit tables, D1–D7, §1.3 tab counts) is **history**; current values are:
>
> | Item | At `86b48fd` (snapshot) | At `e0397ae` |
> |---|---|---|
> | Runtime recipes | 25 | **55** (derive from `RECIPES`; never pin) |
> | 172-row classes (CURRENT / DATA / SMALL / MAJOR / GAP) | 15 / 59 / 19 / 30 / 49 | **32 / 42 / 19 / 30 / 49** (regenerated; §3.2) |
> | PR #275 (#256 CUT skip) | open, CS-1b blocker | **merged**; `bakeCompletionFailure` is on `main` |
> | Undo (#270 / #449) | none | **merged** (#451); `UNDO_LAST_PLACEMENT` on `main` |
> | TQ-1D (no-sauce production) | not shipped; gated every no-sauce recipe | **shipped** (Aussie live; further no-sauce recipes already on `main`). The 29 no-sauce DATA_ONLY rows are **data-only, not blocked** (no engine or technique gate) |
> | `GameScreen` CUT sites | 6 | 6 (unchanged; CS-1a target) |
> | Tab counts | 18 × 6, 7 × 5 | max 6 still holds; the per-count split is measured by the PR-B derived gate (FINISH-Pilot §2.2 measured 18 × 6 / 19 × 5 on `44879be`) |
>
> Authority order and what each document is: `docs/design/TETO_COOKING-STEPS-2.0_AUTHORITY-INDEX.md`.
> Nothing in this note is a new Owner Decision.

| Item | Value |
|---|---|
| **Audited `main` SHA** | `86b48fd51423a8f76db5398ab88ecfd944e2ae10` (Merge PR #291, DH4-PROD) — fresh `git fetch origin` on 2026-09-28 |
| Branch | `claude/post-w1-cooking-steps-design-2nomy3` (cut from the SHA above) |
| Authority re-read | **Post-W1 Cooking Steps Phase 1 Fresh Audit** — `docs/reports/TETO_POST-W1_COOKING-STEPS_PHASE1_FRESH-AUDIT.md`, commit `0d7b489` on `claude/teto-cooking-steps-audit-vyx88k` (audited `12a09de`, never PR'd). Imported **unchanged** into this branch so this design has no dangling reference. |
| Other authorities read | `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md`; `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md` + JSON; `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`, `..._OWNER-DECISION-GATE.md`, `..._FINAL-IMPLEMENTATION-GATE.md`; `docs/design/TETO_PIZZA-CUTTING_1.0.md`; Hint 5.0 Final Design (`claude/hint-5-0-fresh-audit-cdgm9e`, read only); Issues #292, #288, #256, #216, #176; PR #275 (read only) |
| Derived data (this design) | `docs/reports/data/TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION.json`, the per-row table `docs/reports/TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION_ROWS.md`, and the read-only classifier `docs/reports/data/TETO_POST-W1_COOKING-STEPS_classify.py` |
| Not touched | Hint 5.0 / #292, PR #291, PR #255 taxonomy authority, W1 activation, I5b-3 / I5b-4, Progression 3-4C (#214), TQ-1D, PR #275 / #256, #260, #288, #216 |

---

## 0. Executive summary

1. **The authority audit's code findings still hold on `86b48fd`**, with four deltas since `12a09de`
   (§1.2). The two that matter most:
   - **No-sauce scoring is solved.** TQ-1B shipped the `NO_SAUCE` weight profile. The audit's
     OD-8 is closed. Shipping a no-sauce recipe is now a **Techniques** question (TQ-1D), not a
     scoring one.
   - **Late addition and multi-spread are Techniques now.** The Techniques Owner Decision Gate
     (OD-TQ-2, APPROVED) classifies 後乗せ (late addition) and 複数 spread (multi-spread) as
     *techniques*, and schedules them as **TQ-2** and **TQ-3**, after TQ-1D. The authority audit's
     "Phase 1 = LATE_ADDITION with production content" can therefore **not** ship as a Cooking
     Steps PR on its own. The *engine* can; the *content and identity* belong to TQ-2.
2. **The authority audit's representative recipe (prosciutto e rucola) has no late-addition
   evidence.** Its matrix row (`rucola-e-grana-pizzadb-p13`) is FULL, with no late capability.
   OD-TQ-12 forbids promoting inference-only late rows. The evidence-backed representative is
   **BBQ チキン** (`bbq-chicken-pizzadb`, READY, cilantro post-bake, `catalog_design_tag`), which is
   also the content OD-TQ-2 already names for TQ-2.
3. **172-row classification** (§3), by what the engine must gain:
   **CURRENT_ENGINE 15 · DATA_ONLY 59 · SMALL_ENGINE 19 · MAJOR 30 · AUTHORITY_GAP 49** at `86b48fd`
   (re-run at `e0397ae`: **32 · 42 · 19 · 30 · 49**, see §3.2).
4. **Recommended next slice: CS-1, "Post-bake seam" — technique-neutral, inert, no visible
   change** (§6): a ≤6-tab invariant test, the six hard-coded `makingStep === "CUT"` checks in
   `GameScreen` generalized to a post-bake step view, and a pure `finalizeRound` extraction of the
   CONFIRM_BAKE finalization with golden pinning. It verifies nothing new for players by design;
   it is the shared prerequisite for late addition (TQ-2), CUT scoring (#288 CUT-S4) and every
   later post-bake step.
5. **CS-2 (FINISH engine) is the first mechanic slice**, still inert in production: it is verified
   end-to-end on a **test-only BBQ-chicken-shaped fixture**, exactly as TQ-1C was verified on a
   synthetic catalog. Production content waits for TQ-2.
6. **Hard couplings found** (new since the authority audit): Dinner fixes identity at START_BAKE
   (`planDinnerBake`), so a late recipe is unidentifiable in Dinner and a recipe-specific FINISH
   step would leak identity (OD-R6); PR #275 skips post-BAKE steps on a bake failure; the
   BBQ-chicken tab count is 6 only because it has no dough evidence (REC-02 / OD-W2-4 → no CUT).

---

## 1. Fresh audit of `86b48fd`

### 1.1 Re-verified (unchanged since the authority audit)

| Area | Evidence on `86b48fd` |
|---|---|
| Phase machine | `GamePhase = ORDER \| PREPARE \| BAKE \| POST_BAKE \| RESULT \| DISCOVERED` (`gameReducer.ts:111`); `MakingStep` 9 members incl. reserved `FOLD/SEAL/EDGE_FILL/FINISH` (`:128`). |
| Step walk | `CONFIRM_MAKING_STEP` walks `preBakeSteps` / `postBakeSteps` forward only; last POST_BAKE confirm → RESULT (`:1038-1100`). |
| Post-bake steps | `POST_BAKE_STEPS = {CUT, FINISH}` is a property of the step (`cookingProfiles.ts`). |
| Profile derivation | `deriveCoreSteps` from ingredient categories; `COOKING_PROFILE_OVERRIDES` **empty**; `stepTimeLimits` read by nothing. |
| Finalization point | `CONFIRM_BAKE` computes `computeScoringV2`, `evaluatePizzaCompletion`, `consumePizzaInventory` and `resolveFreeCookPizza` **once** (`:1144-1253`). |
| Placement | `PLACE_TOPPING` requires `phase === "PREPARE"`, category-gated to CHEESE / TOPPING, `isInsideDough` + `findOpenSpot` are circle-based (`pizzaCoordinates.ts:46`, `pizzaState.ts:102`). `RESET_PIZZA` is PREPARE-only. |
| Bake visuals | per-ingredient `bakeRoastResistant` only (`ingredients.ts:78`, `PizzaStage.tsx:941`); no per-placement exemption. |
| CUT | circle geometry; `CutEvaluation.cutScore` outside the Scoring 2.0 total. |
| Timing | `completedMs` ends at `START_BAKE`; `perStepElapsedMs` covers any `MakingStep`, so FINISH would be timed for free; FREE-only (`cookingTiming` null in Lunch Rush). |
| Discovery axes | `late`, `spreadLayers`, `pan`, `enclosure`, `layerOrder`, `dough`, `cook`, `laminate`, `prep` are `FIXED_BY_FLOW`; `shape`, `zones` are `UNAVAILABLE` (`signature.ts:96-105`). |
| Save | `GameState` / `PizzaState` are not persisted. |

### 1.2 Deltas since `12a09de` (that change the design)

| # | Delta | Where | Design consequence |
|---|---|---|---|
| D1 | **25 runtime recipes** (W1 +10), 29 ingredients. 18 recipes at **6 visible tabs**, 7 at 5 (§1.3). | `recipes.ts`, `cookingProfiles.ts` | The ≤6 ceiling now binds 18 recipes (was 11). |
| D2 | **`NO_SAUCE` weight profile** (TQ-1B): Sauce 52 → Pieces; ruleset unchanged. `ReferencePizza.sauce` is still non-null; nullable in TQ-1D. | `scoringV2/index.ts` | Authority audit OD-8 closed. No-sauce = TQ-1D gate. |
| D3 | **Techniques runtime** (TQ-1A/1C): registry `["no-sauce"]`, detection from signature, REGISTER_TO_DEX usage/recipe paths, inert while no production recipe requires a technique (INV-TQ-4). OD-TQ-2 names late / multi-spread as future techniques (TQ-2 / TQ-3). | `data/techniques.ts`, `logic/techniques/*` | Late addition and multi-spread content is **owned by the Techniques track**. |
| D4 | **Dinner Stage A**: identity is resolved from the composition at **START_BAKE** and picks the post-BAKE steps. | `gameReducer.ts:1858` `dinnerStartBake`, `mission/dinner/dinnerResultDetection.ts:88` | A late ingredient is not on the pizza at Stage A → a late recipe can't be identified in Dinner; a FINISH step shown only for it would reveal identity. |
| D5 | `GameScreen` hard-codes `phase === "POST_BAKE" && makingStep === "CUT"` at **6** sites (325, 423, 509, 626, 641, 674), not 5. | `GameScreen.tsx` | CS-1 scope. |
| D6 | Open PR **#275** (#256): the base CONFIRM_BAKE **skips post-BAKE steps** when the Completion Gate reports UNDERBAKED / OVERBAKED. | PR #275 (read only) | Whether FINISH is skipped too is an Owner Decision (OD-CS-7). CS-1 must start after #275 is resolved to avoid a CONFIRM_BAKE / GameScreen conflict. |
| D7 | No ≤6-tab unit invariant exists; only the E2E capricciosa scenario (`e2e/dynamic-cooking-steps.spec.ts`). | — | CS-1 adds it. |

### 1.3 Current tab count (pre-bake steps + 焼く + post-bake steps)

| Tabs | Runtime recipes |
|---|---|
| **6** (D·S·C·T·焼く·カット) | margherita, genovese, bismarck, funghi, salsiccia, pepperoni, napoletana, tonno-e-cipolla, breakfast-pizza, capricciosa, meat-lovers, melanzane-pizza, parmigiana-pizza, bambino, hawaiian, pizza-portuguesa, pesto-caprese, pesto-patate (**18**) |
| 5 | marinara, fugazza, pizza-bianca, pesto-tonno, puttanesca-pizza (no cheese); quattro-formaggi (no topping); **new-haven-apizza** (D·S·C·T·焼く, no CUT) (**7**) |

Exact per-recipe derivation (from `deriveCoreSteps` + the CUT allowlist on `86b48fd`): 18 × 6 tabs,
7 × 5 tabs, max = 6. Any added step on a 6-tab recipe gives 7 ("tight" at 360 px per I5b-4).

---

## 2. Current mechanic coverage

| Mechanic | Engine today | Scoring today | Identity axis | Status |
|---|---|---|---|---|
| Round dough stretch | ✅ | not scored | — | shipped |
| One spread layer (tomato / pesto / olive oil) | ✅ one field pipeline | Sauce 52 | `sauceBase` OBSERVED | shipped |
| No cheese / no topping | ✅ (`deriveCoreSteps`) | ✅ | ✅ | shipped |
| **No sauce** | ✅ steps / completion / discovery | ✅ `NO_SAUCE` profile (TQ-1B) | `sauceBase` OBSERVED; technique `no-sauce` registered | **live — TQ-1D shipped (Aussie); more no-sauce recipes are data-only** |
| Single bake window | ✅ | Bake 20 | — | shipped |
| CUT 4/6/8 slices | ✅ (all use 6) | separate `cutScore` | excluded | shipped |
| No CUT | ✅ (allowlist) | — | — | shipped (new-haven) |
| POST_BAKE phase + FINISH walk | reducer only (tested) | ✗ | `late` FIXED_BY_FLOW | reserved |
| Late addition / multi-spread / pan / shape / enclose / prep / fry / laminate / zones / step order / dough variant | ✗ | ✗ | FIXED_BY_FLOW / UNAVAILABLE | not built |

---

## 3. 172-recipe mechanic classification

Source rows: the 172 evidence rows of `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`
(evidence-derived fields only). Its header fields that are derived from `src` (`shippedRecipeIds`,
15) are stale after W1; that drift is Issue **#260** and is **not** touched here — runtime facts
are read from `src` at the audited commit instead (`e0397ae` for the regenerated outputs, recorded as `auditedMainSha` in the JSON; the PR #295 snapshot read `86b48fd`, kept as history in §1). The classifier is read-only and deterministic.

### 3.1 Class rules

| Class | Rule |
|---|---|
| **CURRENT_ENGINE** | No required capability; sauce is tomato-sauce / olive-oil / pesto; every ingredient already in `src/data/ingredients.ts`; CUT by the existing allowlist rule. Needs only a recipe row + reference fixture. |
| **DATA_ONLY** | No engine change: new ingredient ids, one new sauce id on the shared paint path, a no-sauce reference (engine, scoring and the TQ-1D technique are shipped; **not gated**), or a CUT opt-out. |
| **SMALL_ENGINE** | Reuses an existing phase / step / gesture and existing score components; adds a data field plus a guard: `DOUGH_VARIANT`, `STEP_ORDER`, `ZONED_PLACEMENT`, `LATE_ADDITION post_bake` (after the one-time finalization prerequisite). |
| **MAJOR** | New gesture, new score component, new geometry, split bake or new phase type: `MULTI_SPREAD_LAYER`, `LATE_ADDITION mid_bake`, `PAN_BAKE`, `DOUGH_SHAPE_TARGET`, `ENCLOSE`, `PREP_STEP`, `LAMINATE`, `FRY_COOK`. |
| **AUTHORITY_GAP** | Recipe data alone cannot decide: a `MECHANIC_INTERPRETATION` / `EVIDENCE_GAP` / `SCOPE_QUESTION` / `BASE_SAUCE_UNSPECIFIED` blocker, an unresolved sauce, or an unresolved late mode. |

Precedence: AUTHORITY_GAP > MAJOR > SMALL_ENGINE > DATA_ONLY > CURRENT_ENGINE. Content blockers
that are not about mechanics (`UNRESOLVED_INGREDIENT`, `COMPOSITION_CONFLICT_*`,
`DISCOVERY_COLLISION`) are kept per row but do not change the class.

**Why MULTI_SPREAD_LAYER is MAJOR, not small** (the authority audit said "small–medium"): it needs a
multi-entry `sauceIds`, a second field or layer in the heatmap, a new score component or bonus, a
reference with two layers, a Hint 5.0 SAUCE rung change (sauce count ≠ 1 trips G7) and a
technique (TQ-3). That is more than one data field plus a guard.

### 3.2 Result

| Class | Rows | Notes |
|---|---:|---|
| CURRENT_ENGINE | **32** (was 15 at `86b48fd`) | 29 are runtime recipes already (W1 and every later batch); 3 are not yet shipped: `supreme-pizzadb`, `pizza-baiana`, `pizza-chilena-pizzadb-p8` |
| DATA_ONLY | **42** (was 59) | 29 of them only because of **no sauce** (data-only; TQ-1D already shipped); 16 are already runtime recipes; the rest are new ingredients / new sauces. The 17 rows that left this class moved to CURRENT_ENGINE because their ingredients shipped |
| SMALL_ENGINE | **19** | 13 dough variant (incl. **piadina**), 4 late post-bake (**BBQ chicken**, wasabi-beef, nutella-dessert, black-truffle), 1 step order (Trenton), 1 zoned (quattro stagioni) |
| MAJOR | **30** | 14 multi-spread, 8 pan, 5 shape (incl. **pide boat**), 4 enclose, mid-bake, prep, fry |
| AUTHORITY_GAP | **49** | 33 unspecified sauce base, 11 mechanic interpretation (8 page-8 salad rows, taco, lahmacun, eel), 3 unresolved sauce, 2 scope, 2 evidence gap. Underlying class if resolved: CURRENT 3 · DATA 29 · SMALL 9 · MAJOR 7 · (still gap) 1 |

Full per-row table: `docs/reports/TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION_ROWS.md`.

### 3.3 Focus families

| Family | Rows | Class split | What the engine lacks | Notes |
|---|---:|---|---|---|
| **Late addition** (required) | 12 | SMALL 4 · MAJOR 3 · GAP 5 | FINISH action, per-piece stage, round-end (re)finalization, fresh visuals, `late` axis | post_bake 8 · mid_bake 3 · unresolved 1 (eel). Of the post-bake ones, 4 are scatter-only; buffalo / detroit / teriyaki late items are **spreads** (drizzle). 11 more rows are candidate-only (OD-TQ-12: not promoted). |
| **Multi-spread** | 17 | MAJOR 14 · GAP 3 | multi-layer sauce model + score + gesture | 10 include olive oil (8 are exactly tomato + olive oil). Layer timing (pre vs post-bake drizzle) is **not** in the evidence — see OD-CS-14. |
| **Multiple topping timing** | 12 + prep 3 | — | per-requirement `applicationPhase` | Every late row also has pre-bake items (OD-TQ-2 C5). Mixed post-bake scatter + spread: teriyaki (mayo + nori). Three timings in one recipe: lomo saltado (prep + mid-bake), detroit (pan + post-bake sauce). |
| **Boat shape** | 1 (pide) | MAJOR (+ unresolved ingredients) | non-circle dough target, placement bounds, shape-aware CUT, thumbnails | Only boat row; blocked on 2 unresolved ingredients. |
| **Pan / vessel** | 8 pan + fry 1 | MAJOR | pan bake curve, press-in-pan gesture, square geometry (4 of 8) | Round-pan rows without a shape change: montreal (deep), new-england-bar (shallow), greek (pan), chicago-deep-dish. Piadina's *testo* griddle is **not evidenced** (OD-CS-13). |
| **Piadina** | 1 | SMALL (dough variant + no sauce) | dough variant; no sauce (TQ-1D shipped) | OD-TQ-2 C3: piadina = dough (材料) × no-sauce (technique). Real-world griddle cooking, post-cook filling and fold-to-serve are **not in the evidence**. |
| **No-sauce family** | 44 | DATA 29 · SMALL 5 · MAJOR 1 · GAP 9 | nothing (TQ-1B, TQ-1D shipped) | Production is live (Aussie first, more on `main`). Hint 5.0 keeps these targets on Hint 3/4 until OD-H5-P4. |
| **Bake-dependent step change** | late 12 + mid-bake 3 + fry 1 | — | post-bake step content; split bake | FINISH changes what follows BAKE; mid-bake changes BAKE itself. |
| **CUT relation** | 7 no-CUT / unspecified; 5 shape-aware | — | allowlist exists; shape-aware CUT missing | REC-02 / OD-W2-4: no dough evidence → no CUT. |

---

## 4. Dependency graph

### 4.1 Current flow (all 25 runtime recipes)

```
ORDER/SELECT
  └─ PREPARE  (makingStep walks preBakeSteps: DOUGH → [SAUCE] → [CHEESE] → [TOPPING])
       │   Step Timing: perStepElapsedMs per step (FREE only)
       └─ START_BAKE ── Step Timing: completedMs finalized (Cooking Time / efficiency end here)
            │           Dinner: Stage A (identity → bake window + post-BAKE steps)   [D4]
            └─ BAKE (needle)
                 └─ CONFIRM_BAKE ── FINALIZATION (once):
                      │               scoreV2 · Completion Gate · inventory consume · free-cook match
                      │               (#275: bake failure → skip post-BAKE)          [D6]
                      ├─ no post-bake steps ─────────────────────────────┐
                      └─ POST_BAKE (makingStep walks postBakeSteps: CUT)  │
                           Step Timing: perStepElapsedMs[CUT]             │
                           CUT evaluation on the CUT confirm (separate)   │
                           └─ last confirm ───────────────────────────────┤
                                                                          └─ RESULT
                                                                               └─ REGISTER_TO_DEX
                                                                                  (Dex · BEST · Pitz ·
                                                                                   techniques, one transition)
```

### 4.2 Per mechanic: where the order differs

| Mechanic | Order | Differs from 4.1 at | Finalization implication |
|---|---|---|---|
| Late addition (post-bake) | … BAKE → CONFIRM_BAKE → **FINISH** → CUT → RESULT | a POST_BAKE step changes the pizza **after** the finalization point | score / completion / inventory / free-cook match must be **(re)done after FINISH** (OD-CS-2). Dinner Stage A cannot see late pieces (D4). |
| Late spread (buffalo, detroit, hot-honey) | … → FINISH(drizzle) → CUT | same, plus a spread after bake | as above + a 2nd spread layer (MULTI_SPREAD). |
| Mid-bake | PREPARE → BAKE₁ → **IN-OVEN step** → BAKE₂ → … | BAKE is split | bake score split; M3A guide; Step Timing must not count oven time (BAKE is excluded today). |
| Step order (cheese → sauce) | DOUGH → CHEESE → SAUCE → TOPPING | pre-bake order | none (layerOrder axis only). |
| Zoned placement | unchanged | placement rule | Pieces by zone (reference layout). |
| Prep step | DOUGH → SAUCE → CHEESE → **PREP** → TOPPING | new pre-bake step | none, but prep state per ingredient. |
| Pan bake | DOUGH(**press into pan**) → … → BAKE(pan curve) → CUT(shape) | DOUGH gesture, BAKE curve, CUT geometry | Bake component parameterized. |
| Boat / square shape | DOUGH(**shape target**) → … → CUT(**shape-aware**) or no CUT | dough target, placement bounds, CUT | dough / shape conformity score (unscored today). |
| Enclose (calzone) | DOUGH → fill → **FOLD → SEAL** → BAKE → RESULT (**no CUT**) | new pre-bake steps; CUT removed | Completion Gate reasons (unsealed), visuals hide the fill the score reads. |
| Fry | … → **FRY** (instead of BAKE) | the cook phase itself | Bake component replaced. |
| No sauce | DOUGH → [CHEESE] → [TOPPING] (SAUCE absent) | step absent | `NO_SAUCE` profile. |
| Piadina (as evidenced) | DOUGH(unleavened) → CHEESE → TOPPING → BAKE → CUT | dough variant only | none. **If** griddle + post-cook fill were decided (OD-CS-13): DOUGH → COOK(griddle) → FILL → FOLD — every topping after cook, which no evidenced row does today (OD-TQ-2 C5). |

### 4.3 Cross-system dependencies

```
                   ┌──────────────────── Techniques (TQ-1D → TQ-2 late → TQ-3 multi-spread)
                   │                          │ owns: technique id, late/spread axis OBSERVED,
                   │                          │       near-miss privacy, content, HV
Cooking Steps ─────┼─ CS-1 post-bake seam ────┤
 (engine, inert)   │    └─ CS-2 FINISH engine ┘ (TQ-2 activates it)
                   │
Step Timing ───────┤  FINISH timed for free; Cooking Time boundary = OD-CS-8
Bake ──────────────┤  mid-bake / pan / fry change BAKE itself (later phases)
Post Bake ─────────┤  FINISH → CUT order fixed by Cooking Steps 1.0 §1.1
CUT ───────────────┤  #275 skip (OD-CS-7); #288 CUT-S4 also needs round-end finalization (CS-1 seam)
Result/Scoring ────┤  (re)finalization after FINISH; no new component for scatter-late
Dinner ────────────┤  Stage A at START_BAKE → late recipes excluded or Stage A redesigned (OD-CS-5)
Lunch Rush ────────┤  FINISH costs serve time → ruleset / ranking question (#224, OD-CS-6)
Hint 5.0 / DH4 ────┘  tripwires G7 / deductionProduction.gate must stay red until re-audit (§10)
```

---

## 5. Proposed Phase breakdown

Each phase is its own PR, reverts on its own, and ships nothing visible until its activation phase.

| Phase | Scope | Production-visible? | Depends on | Owner |
|---|---|---|---|---|
| **CS-0** | This design (docs only) | no | — | Cooking Steps |
| **CS-1 Post-bake seam** | (a) unit invariant: max visible tabs over `RECIPES` ≤ 6; (b) `GameScreen` 6 CUT sites → one post-bake step view (CUT the only consumer); (c) pure `finalizeRound()` extracted from CONFIRM_BAKE, called from the **same** place, golden-pinned for every recipe in `RECIPES` (derived, never a fixed count; 55 at `e0397ae`) × FREE / Lunch Rush / Dinner × bake bands | **no** (byte-identical) | #275 merged or closed; OD-CS-9 (a) | Cooking Steps |
| **CS-2 FINISH engine (inert)** | `RecipeRequirement.applicationPhase?` (absent = pre-bake); `deriveCoreSteps` appends FINISH for post-bake requirements; FINISH placement (+ last-piece undo); per-piece `stage`; fresh (un-roasted) late-piece visuals; (re)finalization per OD-CS-2; reducer guards. Verified on a **test-only** BBQ-chicken-shaped fixture using existing ingredients. No production recipe gets FINISH. | **no** (INV: no production requirement has `applicationPhase: POST_BAKE`, pinned by test) | CS-1; OD-CS-1, 2, 3, 11 | Cooking Steps |
| **CS-3 = TQ-2 activation** | Late technique id, `late` axis OBSERVED, near-miss DIMENSION + k-rule, Free Cooking FINISH (OD-CS-4), content (BBQ chicken: bbq-sauce, chicken, cilantro; ladder append per LAD-1), Dinner / Lunch Rush policy, Hint re-audit, HV | **yes** | CS-2; **TQ-1D shipped**; OD-CS-4..8, 10 | Techniques (TQ-2) |
| **CS-4 Tab strip for 7+** | T2 (grouped phase strip) or T3 (compact chips) UI audit then implementation | yes | OD-CS-9 (b) | Cooking Steps / UI |
| **CS-5 FINISH → CUT on a 6-tab recipe** | e.g. wasabi-beef (7 tabs) | yes | CS-3, CS-4 | TQ-2 content |
| **CS-6 Multi-spread = TQ-3** | 2-layer sauce model, drizzle gesture, score, Hint SAUCE rung | yes | CS-3; OD-CS-14; Hint OD-H5-P4 / G7 re-audit | Techniques (TQ-3) |
| **CS-7 Dough variant** | dough as 材料 (OD-TQ-2 C2), selection UX, `dough` axis, collision split (pinsa / jamon-serrano) | yes | OD-CS-12 (#216, PR #255 taxonomy, Hint 5.0 ladder) | Cooking Steps + Progression |
| **CS-8 Small pre-bake variants** | STEP_ORDER (Trenton), ZONED (quattro stagioni) | yes | own Fresh Audit | Cooking Steps |
| **CS-9+ Major** | PAN_BAKE → DOUGH_SHAPE_TARGET (+ shape-aware CUT; pide, al taglio) → ENCLOSE → PREP → mid-bake → FRY → LAMINATE | yes | a Fresh Audit per mechanic; OD-CS-16..18 | tbd |

**Why this order.** CS-1 is the one change every post-bake mechanic (FINISH, drizzle, #288 CUT
score) needs, and it can be proven byte-identical. CS-2 carries the reducer-complexity risk
without any product exposure, like TQ-1C did. Activation (CS-3) joins the technique loop, which the
Owner already assigned to TQ-2. Tabs (CS-4) are needed as soon as a post-bake step lands on a
recipe with pre-bake toppings **and** CUT. Majors wait for their own audits.

---

## 6. Recommended next implementation slice: **CS-1 Post-bake seam**

| Condition (task) | How CS-1 meets it |
|---|---|
| W1 を壊さない | No recipe, ladder, catalog, allowlist or data change. Golden covers all 10 W1 recipes. |
| current recipes を壊さない | Byte-identical: `finalizeRound()` is a pure extraction called at the same CONFIRM_BAKE point; GameScreen view returns CUT exactly where `makingStep === "CUT"` held. Existing E2E unchanged and green. |
| 巨大 PR にしない | 3 commits, each revertible: (a) tab invariant test, (b) GameScreen view, (c) finalizeRound + golden. |
| representative recipe で検証 | Golden fixtures pin margherita (6 tabs + CUT), marinara (no cheese), quattro-formaggi (olive-oil, no topping), new-haven-apizza (no CUT), capricciosa (max pieces). The mechanic itself is verified in CS-2 on the BBQ-chicken-shaped fixture. |
| 172 へ再利用可能 | The seam is what FINISH (12 late rows), drizzle (17 multi-spread), CUT-S4 and shape-aware CUT plug into. |
| mobile 390×844 / 360×800 | No layout change; `layout-contract`, `dynamic-cooking-steps`, `pizza-cutting-phase4b` must stay green unmodified. |
| reducer / state machine の複雑化を最小限 | No new phase, action, state field or step. |

**Not in CS-1:** FINISH, `applicationPhase`, any content, any timing / scoring / completion change,
Dinner / Lunch Rush change, tab UI change.

**Entry conditions:** PR #275 merged or closed (it edits CONFIRM_BAKE and the post-BAKE skip);
OD-CS-9 (a) = keep ≤6 as a test invariant. **STOP gate (§11) applies.**

**First mechanic slice after it: CS-2**, verified on a test-only fixture shaped like BBQ チキン:
pre-bake `tomato-sauce, mozzarella, onion` + post-bake `basil` (existing ingredients only, so no
catalog change) → D·S·C·T·焼く·仕上げ = 6 tabs with no CUT. The fixture never enters `RECIPES`.

---

## 7. Representative recipes

| Mechanic | First representative | Why | Tabs | Status / caveat |
|---|---|---|---:|---|
| Post-bake seam (CS-1) | margherita, new-haven-apizza, marinara, quattro-formaggi, capricciosa | cover CUT / no-CUT / no-cheese / olive-oil / max pieces | 6/5/5/5/6 | runtime, byte-identical |
| **Late addition (scatter)** | **BBQ チキン** `bbq-chicken-pizzadb` | Evidence counted REQUIRED (`catalog_design_tag`, cilantro); READY; scatter-only; one new single sauce (bbq-sauce) on the shared paint path; already named as TQ-2 content by the Techniques gate; dough evidence absent → no CUT (REC-02 / OD-W2-4) → **6 tabs** | 6 | 2 new ingredients (`bbq-sauce`, `cilantro`; `chicken` already exists at `e0397ae`; classifier `newIngredientCount: 2`); TQ-2 |
| Late → CUT order | wasabi-beef `wasabi-beef-pizza` | strongest evidence (`source_profile_text`: 焼き上がり後に添える); thin dough → CUT | **7** | needs CS-4 |
| Late + no sauce | black-truffle | 1 new ingredient; 5 tabs | 5 | **two techniques** in one recipe; composition conflict; after TQ-2 (TQ-1D shipped) |
| ~~Prosciutto e rucola~~ | `rucola-e-grana-pizzadb-p13` | — | — | **Not a late representative:** FULL, no late evidence; OD-TQ-12 forbids promotion (supersedes the authority audit §11 default; OD-CS-10) |
| Multi-spread | burrata-pizza `burrata-pizza-pizzadb-p10` | READY; tomato + olive oil (both runtime sauces); 1 new ingredient (burrata); neapolitan dough → CUT; 6 tabs if the oil layer stays inside the SAUCE step | 6 (7 if FINISH drizzle) | layer timing unevidenced (OD-CS-14). Runner-up: grandma (0 new ingredients, but real-world sheet-pan form unevidenced) |
| No sauce | Aussie `aussie-pizzadb` | Techniques authority's own choice | 4 | shipped in **TQ-1D** (live), not Cooking Steps |
| Dough variant | pinsa-romana `pinsa-romana-pizzadb-p9` | READY; its only collision partner (jamon-serrano) differs by dough alone → tests the identity split | 6 | OD-CS-12 |
| Piadina | piadina-romagnola | the only piadina row; dough × no-sauce junction (OD-TQ-2 C3) | 5 (D·C·T·焼く·CUT) | CS-7 + OD-CS-13 (TQ-1D shipped) |
| Step order | trenton-tomato-pie | 2 existing ingredients only; pure order change | 5 | READY_WITH_REVIEW |
| Zoned | quattro-stagioni | only zoned row | 6 | 1 new ingredient (artichoke) |
| Pan (round) | montreal-style | deep pan **without** a shape change; all 4 ingredients already runtime | 6 | isolates PAN from SHAPE |
| Square + pan | al-taglio-romana | tray + square; READY_WITH_REVIEW | — | after PAN |
| Boat | turkish-pide | only boat row | — | 2 unresolved ingredients → authority first |
| Enclose | calzone | canonical fold, no CUT | — | composition conflict; runner-up scacciata (READY) |
| Mid-bake | mentaiko-cream | READY; "added in the final few minutes" | — | split BAKE |
| Prep | yakiniku | READY; stir-fry before topping | — | |
| Fry | pizza-fritta | only fry row; READY | — | |

---

## 8. Authority gaps / Owner Decisions

None of these is decided here. "Recommended" is advice only. *(Status 2026-10-10: OD-CS-1, OD-CS-2, OD-CS-9 (a) and OD-CS-20 are decided in §13, which supersedes this table for those IDs; every other row stays open.)*

| ID | Question | Options | Downstream impact | Recommended |
|---|---|---|---|---|
| **OD-CS-1** | Who ships late addition? | (a) Cooking Steps builds CS-1/CS-2 inert, TQ-2 activates; (b) everything waits and ships inside TQ-2; (c) Cooking Steps ships late content without a technique (**contradicts OD-TQ-2**) | (a) splits risk; (b) one big PR; (c) needs an OD-TQ-2 re-decision | (a) |
| **OD-CS-2** | Finalization with a post-bake step | (A) move all finalization to round end; (B) keep CONFIRM_BAKE as provisional and re-finalize **only** for profiles containing FINISH; (C) forbid post-bake requirements from counting | (A) changes abandon-during-CUT inventory, #275's verdict point, Dinner `preConsumptionInventory`, LR serve timing; (B) byte-identical for every FINISH-less recipe by construction, adds one delta-consume; (C) makes late pieces meaningless | (B) |
| **OD-CS-3** | Where "applied after bake" lives | recipe-level `RecipeRequirement.applicationPhase` vs ingredient-level flag / new category | ingredient-level leaks via `attr:category` / `attr:group` hint facts (§10 H5) and blocks the same ingredient being pre-bake elsewhere | recipe-level |
| **OD-CS-4** | Free Cooking and FINISH | (a) FREE always has 仕上げ, tray = all owned toppings; (b) FINISH only in guided; (c) tray in FINISH = only late-capable items | (b) late recipes are undiscoverable by free cooking; (c) leaks which items are late (affordance vs identity, OD-TQ-16) | (a) — FREE is D·S·C·T·焼く·仕上げ = 6 tabs |
| **OD-CS-5** | Dinner and late recipes | (a) exclude late recipes from Dinner targets; (b) move Stage A after FINISH; (c) always show FINISH in Dinner | (b) reworks DM-3R / DM-4 settlement invariants; (c) adds a tab to every Dinner pizza | (a) until a Dinner audit |
| **OD-CS-6** | Lunch Rush and late recipes | include / exclude in the order pool | FINISH costs serve time → `lunch-rush-v1` ranking comparability (#224) | decide with #224 |
| **OD-CS-7** | #275 skip and FINISH | on a bake failure skip FINISH too / keep FINISH | keeping it lets players place on a failed pizza; skipping keeps #275's single verdict | skip, consistent with #275 (only after #275 lands) |
| **OD-CS-8** | FINISH time and Cooking Time | count / don't count in `completedMs` | efficiency and Pitz time bands | don't count (mirror CUT) |
| **OD-CS-9** | Tab ceiling | (a) ≤6 unit invariant now; (b) when to build T2 / T3 | (b) gates CS-5, multi-spread drizzle and every 7-tab recipe | (a) yes; (b) before CS-5 |
| **OD-CS-10** | Late representative | BBQ チキン / wasabi-beef / keep the audit's prosciutto e rucola | rucola has no late evidence (OD-TQ-12) | BBQ チキン |
| **OD-CS-11** | Scoring of late pieces | structural only (existing Pieces / Q / Recipe) / new FINISH bonus | a bonus needs a ruleset bump and #288 alignment | structural only |
| **OD-CS-12** | Dough variant model | dough as a 材料 (tray / Shop item) / DOUGH-step choice / recipe-fixed (not player-chosen) | 材料 → PR #255 taxonomy, #216 unlocks, Hint 5.0 has no dough rung (hidden identity dimension); recipe-fixed → pinsa / jamon-serrano collide | Fresh Audit first |
| **OD-CS-13** | Piadina | as evidenced (dough + no sauce, baked) / griddle vessel + post-cook fill + fold-to-serve | the latter is unevidenced and makes every topping post-cook (no row does that today) | as evidenced; re-check evidence first |
| **OD-CS-14** | Multi-spread layer timing and gesture | 2nd layer inside SAUCE (pre-bake) / FINISH drizzle (post-bake) / both by row; `PAINT_TEMPORARY` meaning (authority audit OD-9) | FINISH drizzle adds a tab (7) on CUT recipes; Hint SAUCE rung reveals ≥2 sauces | decide in TQ-3 design |
| **OD-CS-15** | Shipped recipes whose matrix row has more mechanics (margherita / marinara: tomato + oil; fugazza: dough variant; QF: no sauce) | leave runtime compositions as shipped / upgrade | an upgrade changes existing BEST comparability and Hint facts | leave as shipped |
| **OD-CS-16** | Pan / vessel | pan as a tool item / recipe-fixed; PAN before SHAPE (matrix) | Shop / unlock (#216); bake component | Fresh Audit per mechanic |
| **OD-CS-17** | Boat / square CUT | shape-aware CUT / no CUT for non-round | CUT geometry rewrite vs allowlist opt-out | no CUT first, shape-aware later |
| **OD-CS-18** | Are pan / shape / enclose techniques? | OD-TQ-2 lists them as 後段 (later), undecided | technique ledger, Hint privacy | defer |
| **OD-CS-19** | Capability unlock policy | #216 D options (Pitz / automatic / tutorial) vs OD-TQ-1 (techniques are never bought) | late / multi-spread fall under OD-TQ-1 | reconcile in #216 |

**Authority gaps in the data** (recipe data cannot decide): 33 unspecified sauce bases; 11 mechanic
interpretations (page-8 salad rows: raw-salad-after-bake vs baked; taco; lahmacun serve form; eel
mid vs post); 2 scope questions (focaccia, feteer); 2 evidence gaps; piadina vessel / fill;
multi-spread layer timing; grandma / sfincione form; no written SSOT for the "≤6 / 7 tight /
8 impossible" I5b-4 finding.

---

## 9. Test matrix

✅ required · ◐ targeted subset · — not needed.

| Phase | Pure logic | Reducer | Component | App-level | Chromium E2E | WebKit Gate | Human Verification |
|---|---|---|---|---|---|---|---|
| CS-0 (docs) | — | — | — | — | — | — | — (audit-only exemption) |
| **CS-1** | ✅ tab invariant over `RECIPES`; `finalizeRound` golden (`RECIPES`-derived × FREE / LR / Dinner × raw / perfect / burnt) | ✅ CONFIRM_BAKE result deep-equal before/after; POST_BAKE walk unchanged | ✅ GameScreen post-bake view (CUT only); MakingStepTabs unchanged | ◐ `App.test`, `App.dinner`, `App.techniques` unchanged | ✅ existing `pizza-cutting-phase4b`, `dynamic-cooking-steps`, `making-ui-1screen`, `layout-contract`, `dinner-mission` **unmodified** at 390×844 + 360×800 | ✅ (src change) | — no visible change; state so in the Result Report, with before/after screenshots proving identity |
| **CS-2** | ✅ `applicationPhase` derivation, FINISH step derivation, stage-aware completion / consume / score on the fixture | ✅ FINISH placement guards (phase, step, ownership, category, stock), undo, re-finalization, "no production requirement is POST_BAKE" invariant, Dinner / LR untouched | ✅ late piece renders fresh (no `bakeHeat` frame); tray in FINISH | ◐ fixture round through App reducer wiring | ◐ none in production (inert); existing suites unmodified | ✅ | — inert; screenshots of the fixture only if a harness exists |
| **CS-3 / TQ-2** | ✅ late detection, `late` axis OBSERVED, near-miss k-rule | ✅ technique usage / recipe paths, REGISTER_TO_DEX one transition, Dinner exclusion | ✅ Dex 調理法, RESULT | ✅ Free Cooking discovery loop | ✅ new `finish-step` spec: FREE + guided + LR, 390×844 + 360×800, ≤6 tabs, pieces fresh after bake | ✅ | ✅ **required** (390×844 video + before/after screenshots) |
| CS-4 tabs | ◐ | — | ✅ | ◐ | ✅ 7-tab fixture at 360×800 | ✅ | ✅ |
| CS-6 / TQ-3 multi-spread | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ + Human-Feel rounds (new gesture) |
| CS-7 dough | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CS-8+ | per own audit | | | | | | ✅ per mechanic |

Plus, from CS-3 onward: Hint 5.0 G7 and `deductionProduction.gate.test.ts` must be re-run with
the new recipes and **fail until the re-audit is done** (never weakened).

---

## 10. Hint 5.0 / TQ-1D interaction notes (identification only)

Nothing here decides TQ-1D or Hint 5.0. These are the points where a Cooking Steps mechanic could
leak Technique identity through a hint.

| # | Leak point | Mechanic | Existing guard |
|---|---|---|---|
| H1 | Hint 5.0 **SAUCE rung reveals every sauce** in one rung → "2 sauces" = multi-spread identity; a post-bake spread (buffalo, detroit, hot-honey) counted as a sauce also reveals it | multi-spread, late spread | G7 tripwire (sauce count ≠ 1); `deductionProduction.gate` "exactly one sauce" |
| H2 | An empty SAUCE rung = no-sauce identity (piadina, black-truffle, 44 rows) | no sauce | `RESERVED_EMPTY_RUNG`; OD-H5-P4 reserved |
| H3 | A new ingredient **category** (e.g. "finish" / "garnish") would leak "後乗せ" via `attr:category` / `attr:group` facts | late | none yet → OD-CS-3 (keep phase recipe-level) |
| H4 | A classification family label that encodes timing (「仕上げの…系」) | late | OD-TAX-6: families are identity only; C4 labels go to the Owner |
| H5 | STRUCTURE counts: if late items were excluded or counted separately, the total differs from the ingredient list | late | STRUCTURE = distinct ingredient total (`meta:ingredient-total`) — keep late items inside it |
| H6 | Free-cook tray showing some items only in FINISH | late | none → OD-CS-4 (all owned items in FINISH) |
| H7 | Dinner showing FINISH only when the identity is a late recipe | late | OD-R6 → OD-CS-5 |
| H8 | Near-miss "焼いた後" / DIMENSION class | late | OD-TQ1C-2 k-rule, enabled in TQ-1D; TQ-2 extends to the late axis |
| H9 | Dough variant has **no hint rung** → a hidden identity dimension (pinsa vs jamon-serrano), and if dough becomes a 材料 the STRUCTURE total changes | dough | none → OD-CS-12 |
| H10 | Two techniques in one recipe (black-truffle: no-sauce + late; piadina with post-cook fill) | combined | INV-TQ-4 inertness only; needs TQ-2 audit |
| H11 | Technique tripwires must be re-run by the recipe PR that ships the mechanic, never by a Cooking Steps engine PR | all | `deductionProduction.gate.test.ts`; Hint 5.0 G7 |

---

## 11. Explicit STOP gate before implementation

**STOP.** No implementation starts from this document.

> Pre-start Fresh Check (Owner Decision prep, same `main` `86b48fd`): `docs/reports/TETO_POST-W1_COOKING-STEPS_CS-1_PRE-START-GATE.md` — CS-1 start = **WAIT**.

| Gate | Condition to pass |
|---|---|
| G-CS-A | The Owner has read this design and answered **OD-CS-1, OD-CS-2, OD-CS-9 (a)** *(satisfied: §13)*. |
| G-CS-B | PR #275 is merged or closed, and this design's §1.2 D6 is re-checked on the new `main` *(#275 merged; the D6 re-check is PR-B's)*. |
| G-CS-C | Fresh `git fetch origin main`; the CS-1 branch is cut from the new SHA; the audit table in §1 is re-verified (tab counts, GameScreen CUT sites, CONFIRM_BAKE shape). |
| G-CS-D | No change to Hint 5.0 / #292, PR #291, PR #255, W1 activation, I5b-3 / I5b-4, 3-4C, TQ-1D, #275, #260 is needed by the slice. If one is, stop and ask. |
| G-CS-E (CS-2 only) | OD-CS-3 and OD-CS-11 answered; CS-1 merged. |
| G-CS-F (CS-3 only) | TQ-1D shipped; OD-CS-4..8, 10 answered; Hint re-audit plan agreed. |

---

## 12. Summary for the Owner

**次に実装可能な Phase (after G-CS-A..D):** CS-1 Post-bake seam (inert, byte-identical).

**まだ実装してはいけない Phase:** CS-2 (needs CS-1 + OD-CS-2/3/11); CS-3 = TQ-2 (needs TQ-1D);
CS-4 tabs (needs OD-CS-9 b); CS-5; CS-6 = TQ-3; CS-7 dough; CS-8 small variants (own audit);
every MAJOR mechanic (pan, shape / boat, enclose, prep, mid-bake, fry, laminate); any
no-sauce production recipe is no longer blocked (TQ-1D shipped); add them as data under the normal recipe gates.

**Owner Decision の状態 (2026-10-10 re-baseline; authority = §13 and the Authority Index §2):**
- **決定済み:** OD-CS-1 = A, OD-CS-2 = B, OD-CS-9 (a), OD-CS-20 (§13). CS-1 の決定ゲートは満たされている。
- **未決定のまま:** OD-CS-3..8, 10..19 (§8) と OD-CS-9 (b)。ここでは決定しない。
- **phase 別ゲート:** CS-1a / CS-1b は上記の決定済み項目と PR #275 merged で着手可能。CS-2 (FINISH) は OD-CS-3 / OD-CS-11 の回答が必要。CS-3 = TQ-2 は OD-CS-4..8, 10 の回答と Hint 再監査計画が必要 (TQ-1D は shipped)。CS-4 は OD-CS-9 (b)。

---

## 13. Owner Decisions (2026-09-28) — authority

Recorded from the Owner. These supersede the "recommended" columns in §8 for the IDs below.

| ID | Decision | Authority for |
|---|---|---|
| **OD-CS-1** | **A.** Cooking Steps owns only the late-addition **engine foundation**, inert in Production. Production enablement of late-addition recipes is **TQ-2's** authority. | CS-2 scope; CS-3 = TQ-2 |
| **OD-CS-2** | **B.** Normal recipes finalize at CONFIRM_BAKE as today. Only future late-addition recipes are **provisional at CONFIRM_BAKE → final after FINISH completes**. **Not implemented in CS-1a.** Recorded as the authority for the CS-1b `finalizeRound` design and its golden tests. | CS-1b, CS-2 |
| **OD-CS-9 (a)** | **Adopted.** Current Production is fixed at **max 6 visible tabs** by a test invariant. When 7+ tabs are needed, the test is **not** relaxed; it is the gate that requires **CS-4** first. | CS-1a gate; CS-4 |
| **OD-CS-20** | **Adopted.** CS-1 is split. **CS-1a:** Production max-6-tab invariant (Free Cooking profile included); GameScreen post-bake rendering generalized; current CUT display and behaviour fully preserved; no new non-CUT post-bake UI. **CS-1b:** `finalizeRound` extraction; 25-recipe golden tests over guided / FREE / Lunch Rush / Dinner and raw / good / burnt bakes *(re-baseline 2026-10-10: the golden is derived from all of `RECIPES`, 55 at `e0397ae`; the recorded "25" was the count at decision time and is not pinned)*; starts only after PR #275 is resolved. | CS-1a / CS-1b |
| PR #275 | Not changed, merged or closed by this track. Stays on Owner Human Verification. *(Update 2026-10-10: #275 has since been merged by the Owner; the CS-1b blocker is cleared.)* | CS-1b blocker |

**Out of CS-1a / CS-1b (Owner):** the FREE-mode POST_BAKE / CUT HOME gap (`isRoundInProgress()` does not
include POST_BAKE, so no confirm dialog) is **not** mixed into CS-1. It is recorded as an independent
Issue candidate (Pre-start Gate §10) and is not fixed here.

## 14. Phase status

| Phase | Status |
|---|---|
| CS-0 | ✅ design + pre-start gate (docs) |
| **CS-1a** | ✅ implemented, not merged — `docs/reports/TETO_POST-W1_COOKING-STEPS_CS-1A_Result.md` (tab gate `MAX_VISIBLE_COOKING_TABS`; `renderedPostBakeStep()` in `src/screens/postBakeView.ts`) |
| CS-1b | ▶ not started — PR #275 **merged** (blocker cleared); waits on PR-A merge (this PR). Authority: OD-CS-2 = B |
| CS-2 … | not started |
