# Cooking Steps 2.0 — FINISH D2-1 / D2-2: spec and dependencies (docs only)

Track C of the 3-track session. **Docs only: no runtime change, no new Issue/PR, TQ-2 not enabled.** Base: `main` `d0da093`.
Authority: `docs/decisions/TETO_COOKING-STEPS-2.0_FINISH-ENGINE_OWNER-DECISIONS.md` (OD-CS-3/7/11), Issue #294, the FINISH Pilot design
(`docs/reports/TETO_COOKING-STEPS-2.0_FINISH-Pilot_Pre-Implementation-Design.md`), D1a #491, D1b #497.

> **Naming note.** The repo defines only one slice, **D2 = "Render / UI (`PizzaStage`, `GameScreen`, tray) — after #468 / #487 / #478 settle; Human
> Verification required; not started"**. "D2-1 / D2-2" is not defined anywhere in the repo or in #294/#465. This file *proposes* the split below;
> if the Owner meant a different split, only §2 changes.

## 1. State today (verified on `main`)

| fact | where |
|---|---|
| Engine is complete and **inert**: no `RECIPES` entry has `applicationPhase: "POST_BAKE"`; only a test fixture does | `src/data/recipes.ts` header, `src/state/testSupport/finishFixture.ts` |
| A late requirement makes `deriveCoreSteps` append `FINISH` (after TOPPING); the post-bake order is FINISH → CUT | `src/data/cookingProfiles.ts` |
| The reducer places `stage: "post"` pieces only when `phase === "POST_BAKE" && makingStep === "FINISH" && roundRunsFinish(state)`; toppings only; stock = post-bake stock | `gameReducer.ts` `PLACE_TOPPING` |
| `roundRunsFinish` = not Lunch Rush, not Dinner, **not Free Cooking/Research** (D1b-6: FREE has no FINISH UI, UD-B open, finalizes in one pass) → only **Guided** runs FINISH | `finishEngine.ts` |
| CONFIRM_BAKE judges PROVISIONALLY (late reqs removed); leaving FINISH runs the one FINAL pass; failed bake skips FINISH (OD-CS-7) | `gameReducer.ts`, `finalizeRound.ts` |
| FINISH-only Undo exists (takes back a `post` topping) | `undoPlacement.ts` |
| **No UI renders FINISH**: `renderedPostBakeStep` returns `"CUT"` or `null`; the tray block is `phase === "PREPARE"`; `STEP_CATEGORY` has no FINISH; the reducer leaves the hint as-is ("FINISH has no hint yet (D2)"); `PizzaStage` never reads `isPostBakePiece` | `postBakeView.ts`, `GameScreen.tsx:829`, `prepareDock.ts`, `gameReducer.ts:1084` |
| Tab ceiling is 6 (OD-CS-9 (a)); CS-4a (#499) added the 7-tab compressed chips **for fixtures only** | `MakingStepTabs`, CS-4a Result |

## 2. Proposed spec

### Display policy (maintained, applies to both slices)

FINISH is shown **only when the round's profile contains `FINISH`**, i.e. a **Guided** round whose recipe has a `POST_BAKE` requirement (UD-E
recommended option, kept per Owner instruction). Consequences, each to be pinned by test:

- Every one of today's 57 `RECIPES` renders **byte-identically** (DOM golden over all recipes × Guided/FREE/Research/Dinner/Lunch Rush, the same oracle style D1a used for `deriveCoreSteps`). No FINISH tab, tray page, CTA, hint or label appears anywhere in Production.
- FREE / Research / Dinner / Lunch Rush never show FINISH (engine already refuses them; D2 must not add a FREE tab — that is UD-B, separate).
- No technique id, Dex entry, near-miss axis or hint category is added. **TQ-2 stays off.** A FINISH step must not be inferable from anything outside the active Guided profile (OD-CS-3's reason for putting it on the recipe).
- The provisional score is **not displayed** (#495 stays untouched).

### D2-1 — flow and controls (`GameScreen`, tray, tabs, hint, CTA, Undo)

1. `renderedPostBakeStep` returns `"FINISH"` for `phase === "POST_BAKE" && makingStep === "FINISH"` (one decision site, as CS-1a intended) → the six layout sites (roomy stage, cooking layout, tabs, stage interactivity) follow.
2. Tray: the topping page is shown in FINISH, listing only toppings whose requirement is `POST_BAKE` for Guided (`trayIngredientsFor` with the recipe's late requirements); `STEP_CATEGORY` gains `FINISH → topping` **for the tray only** (not for the pre-bake placement gate).
3. Tabs: `MakingStepTabs` gets `postSteps` containing `FINISH` (before `CUT`); the 6-tab ceiling is **not** raised (§3 constraint).
4. Primary CTA in FINISH = confirm → `CONFIRM_MAKING_STEP` (the FINAL evaluation). Skipping with zero pieces is allowed by the engine but yields a FAILED result for a recipe whose late requirement is unmet (`finishEngine` guarantee); the UI copy for that is an Owner item (UD-G-style), not decided here.
5. Hint line in FINISH: today none ("hint left as it was"). Spec: a single static line for the active step, authored with the recipe, no ingredient identity beyond what the recipe's own Guided screen already shows.
6. "1つ戻す" is shown in FINISH (already rule-complete in `undoPlacement`); Lunch Rush hides it as today.
7. Tray drag-and-drop (#476/#478): enabled in FINISH — see §3, this is the one hard dependency.

### D2-2 — stage rendering (`PizzaStage`)

1. A piece with `stage === "post"` is drawn **fresh** (not run through the bake colour/roast curves) in FINISH, CUT and RESULT: it was added after the oven. Uses `isPostBakePiece`; pre-bake pieces keep `cheeseStyle` / `toppingPieceStyle` exactly.
2. Stage geometry in FINISH = the BAKE/CUT "roomy" stage (already true for `postBakeStepRendered`); no new size.
3. Placement taps/drag in FINISH reuse `onTapPizza` / `onPhysicalDrop` unchanged; `activeIngredient` must be a late ingredient (reducer already rejects anything else).
4. Cut pieces (CUT after FINISH) render post pieces on every slice copy the same way (the `renderBody(piece)` path already used for toppings).

### Verification (both slices)

- Vitest: component tests with the fixture recipe/state only (**no `RECIPES` change**), the all-recipes DOM oracle above, and a "FINISH absent for Free/Research/Dinner/Lunch Rush" matrix.
- Human Verification (policy doc): needs a way to *see* FINISH on a device without a Production recipe — recommend a **Preview/DEV-only** fixture entry (the `CHEESE_CANVAS_ALLOWED = DEV || VITE_PREVIEW_MODE` pattern, folded out of production builds) → **OD-D2-1** (below). 390×844 video + before/after screenshots per the policy; WebKit runs in CI only.

## 3. Conflicts and dependencies (measured, not guessed)

Method: `git merge-tree --write-tree` of the open PR heads against current `main`, against the Track A branch (#494 rebased on B1/B2), and against a throw-away
probe branch carrying the *minimal* D2 edits (`GameScreen` tray gate + `PizzaStage` post-piece style; never pushed).

| pair | result | note |
|---|---|---|
| #478 (draft, `GameScreen`, `IngredientTray`, `pieceDrag`, `roundKind`) vs `main` | **clean** | but its base is `6b86798` (old); it needs a rebase before it can be reviewed against today's tree |
| #468 (`PizzaStage` + `App.css` + `bakeVisual`) vs `main` | **CONFLICT in `PizzaStage.tsx`** | the topping-piece render call-site, where #487 (merged) now wraps the cheese in the Canvas path. Independent of #494 and of D2 |
| #468 vs Track A (#494 on B1/B2) | same single conflict | #494 adds **no** new conflict |
| #494/Track A vs `main` | clean after Track A's merge | gauge hunks: one import line, a block after `fieldSauceColor`, and the JSX tail after the paint-trail `</div>` |
| #478 vs Track A | clean | #494 does not touch `GameScreen` |
| D2 probe vs #478 | **textually clean** | D2-1's `GameScreen` edits (tray gate at `:829`, step flag near `:429`) are not in #478's hunks (`:76`, `:381-396`, `:866-870`) |
| D2 probe vs Track A | clean | |
| D2 probe vs #468 | **conflict in `PizzaStage.tsx`** | the *same* call-site #468 changes (the per-piece `style`); D2-2 and #468 both edit it |

### Semantic dependencies (merge-tree cannot see these)

- **#478 → D2-1 (hard).** #478's new `pieceDragEnabled` is `allowsPieceDragInRound(state) && state.phase === "PREPARE" && …`. In FINISH the phase is `POST_BAKE`, so tray drag would stay off. D2-1 must widen that line (`|| renderedPostBakeStep(...) === "FINISH"`) — so D2-1 should be written **on top of #478**, not in parallel. #478 is a draft: if it is not going to land soon, D2-1 would have to carry its own copy of the gate.
- **#468 → D2-2 (hard, ordering).** Both change how an individual piece's `style` is computed. #468 must be rebased onto `main` (resolving the #487 Canvas branch) **first**; D2-2 then adds the "post piece = fresh" branch beside it. Doing D2-2 first would put the same conflict onto D2.
- **#494 → D2: none.** Gauge is SAUCE-only (`makingStep === "SAUCE"`); no shared lines, no shared state.
- **#487 (merged):** already in `main`; it is the reason #468 now conflicts.
- **CS-4a (#499, merged) → D2-1:** FINISH + CUT recipes would need 7 tabs. The ceiling stays 6 (OD-CS-9 (a)), so the D2 fixture must be ≤ 6 tabs (DOUGH, SAUCE, CHEESE, TOPPING, BAKE, FINISH). A recipe with both CUT and FINISH is **not shippable** until the Owner lifts the ceiling.
- **#495 (provisional score):** not a dependency as long as D2 never displays the provisional score.
- **`App.css`:** #468, #494 and D2 each append rules in different regions; low risk, resolve by keeping both.

### Recommended order

1. **#478**: rebase onto `main`, review, merge (Owner).
2. **#468**: rebase onto `main` (resolve the #487 Canvas call-site), merge (Owner).
3. **#494 / Track A**: independent of 1–2; any time.
4. **D2-1** on top of #478, then **D2-2** on top of #468 (D2-1 and D2-2 touch different files, so they can be one PR or two; split keeps `GameScreen` and `PizzaStage` reviews separate).

## 4. Owner decisions needed before D2 starts (none taken here)

- **OD-D2-1 — how to see/verify FINISH without a Production recipe:** Preview/DEV-only fixture entry (recommended) vs component tests only (no device HV possible).
- **OD-D2-2 — FINISH hint/CTA copy** (static line, skip-with-zero-pieces wording).
- **OD-D2-3 — #478 vs D2-1 sequencing** (D2-1 waits for #478, or carries its own gate).
- Still open from the Owner record and **not** to be pre-empted by D2: UD-B (FREE finish UI), UD-D (TQ-2 ownership), UD-F, UD-G, UD-I, OD-CS-4..6, 8, 10, 12..19.

## 5. Explicitly out of scope

TQ-2 (technique id, Dex, near-miss, `LATE_ADDITION` support flag), any Production recipe with a late requirement (the BBQ-style recipe, `bbq-sauce`, `cilantro`, ladder append), a FREE/Research FINISH tab, Dinner/Lunch Rush handling, a 7-tab UI, scoring/provisional-score display, merge, deploy.

## 6. Duplicate check

No open Issue/PR is titled for FINISH D2 (searches: "FINISH D2", "PizzaStage GameScreen post-bake" → #294 parent, #465 tracker, #495 follow-up, #37; all existing). **No Issue or PR was created**; D2 is tracked under #294 / #465 item 10.
