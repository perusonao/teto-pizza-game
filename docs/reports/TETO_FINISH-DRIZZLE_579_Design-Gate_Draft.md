# #579 FINISH liquid / DRIZZLE — Design Gate (draft, docs-only)

Status: DESIGN DRAFT / NO IMPLEMENTATION GO. Baseline main: `0016222145c4c88253380d53d5df40607f58e655` (PR #743). Authority: Issue #579; related #495, #604, #608, #294, #518, #521. This report is based on issue specifications; current runtime call paths and save serialization have NOT yet been independently verified.

## 1. Scope and constraints
- Goal: allow a post-bake sauce/paste application within FINISH, initially in Free Cooking / Research.
- Out of scope: Dinner, Lunch Rush, production enablement, new recipe release, rebalancing Scoring 2.0 (52/16/12/20), globally unified dragging, existing PR #738.
- Keep the existing solid POST_BAKE topping flow unchanged; preserve six-tab maximum and avoid a new permanent tab.
- Production OFF, shared Preview unchanged, no save schema or reducer change at this gate.

## 2. Candidate UX (not approved)
- FINISH tray presents eligible liquid/paste items only when explicitly enabled in Preview/DEV.
- Primary gesture: short continuous drizzle stroke over the dough; render a visible trail. Alternative: tap a point to apply a deterministic short drizzle mark, with equal resource cost and scoring semantics. Do not require precise dragging.
- Preserve cancel, reset, insufficient inventory, duplicate placement, stage transition, accessibility, 390x844 and 360x800 one-screen behavior.
- Do not reuse the pre-bake PAINT field without checking its bake-state coupling; POST_BAKE liquid must not acquire bake coloration.
- Candidate first material is undecided: compare honey, tahini, mayo, and dressing against existing catalog identities and real recipe requirements. No invented ingredient IDs or recipe entitlements.

## 3. Required technical investigation before implementation
1. Trace `PLACE_TOPPING` FINISH category guard, `canPlacePostBakeIngredient`, `sauceIds`, inventory debit and duplicate protections.
2. Trace `PlacedTopping` / sauce deposit representations, transient stroke geometry, persistence serialization, unknown-schema compatibility, reload and reset. Prefer existing v2 data shape only if semantically correct; otherwise propose an explicit migration gate, not a silent type overload.
3. Trace `computeScoringV2`, recipe Reference validation and provisional vs FINAL evaluation (#495). Define which existing component accounts for post-bake liquid, and ensure each physical application counts exactly once. No weight changes.
4. Trace signature/late-axis observation, Research anti-oracle, Hint, Dex and technique behavior. Confirm post-bake liquid is not mistakenly counted as pre-bake sauce.
5. Trace render layering, CUT/FINISH transitions, #518 filter isolation and how liquid trails behave on irregular dough and pizza slices.
6. Confirm Free Cooking / Research eligibility, failure skip, no inventory loss on cancel, and Dinner/Lunch Rush isolation.
7. Verify actual latest main and duplicate/claim gates again before editing any runtime file.

## 4. Proposed implementation slices (conditional)
- D0: independent code-path audit and Owner decisions, docs-only.
- D1: pure data model and geometry prototype behind Preview/DEV opt-in, unit tests; no production or save writes.
- D2: FINISH UI + tap fallback, render and accessibility, with Chromium/WebKit two-viewport E2E and Human Verification per policy.
- D3: scoring/persistence/Research integration only after explicit model decision, with regression and compatibility tests.
- D4: production activation is a separate Owner Gate; keep OFF until approved.

## 5. Owner decisions required
- OD-DZ-1: first target sauce and a concrete recipe/Free-only use case.
- OD-DZ-2: post-bake liquid representation: existing placement shape vs dedicated type/migration.
- OD-DZ-3: Scoring 2.0 component and Reference rules; #495 provisional scoring behavior.
- OD-DZ-4: primary stroke plus tap fallback; whether tap draws a short mark or a dot.
- OD-DZ-5: Preview/DEV HV entry and permission to update shared Preview (default: do not update).
- OD-DZ-6: whether post-bake liquid should participate in the existing late technique/signature axis.
- OD-DZ-7: first release scope (Free/Research only recommended), Dinner/Lunch Rush excluded.

## 6. Gate
DESIGN DRAFT ONLY. No source/test/CI/Preview/Production modifications. Next action: inspect the seven technical paths above on fresh main, report exact files/functions and compatibility implications, then request Owner's decisions. No PR or merge authorization implied.

## 7. Fresh main code-path findings (read-only inspection, 2026-11-04)

- `src/state/gameReducer.ts:1083-1126`: `PLACE_TOPPING` accepts FINISH only in POST_BAKE with `roundRunsFinish`, explicitly rejects all categories other than `topping` at line 1112. Its stock path calls `canPlacePostBakeIngredient`; ordinary sauce dispense is a separate `COMMIT_SAUCE_DISPENSE` path at ~1049-1074. A sauce cannot be enabled merely by adding a FINISH tray button.
- `src/state/gameReducer.ts:1097-1101`: the mayo squeeze `trail` is normalized only when `!inFinish`, so the current squeeze gesture cannot be reused in FINISH without explicit redesign.
- `src/state/finishEngine.ts:57-81`: `postBakePieces` and `pizzaForFinalEvaluation` filter `pizza.toppings` with `stage === "post"`; they do not phase-filter sauce deposits. A post-bake sauce written to the ordinary sauce ledger would bypass this phase separation.
- `src/logic/discovery/signature.ts:133-146,157-184`: late axis is already `OBSERVED`, but `lateOf` reads only staged toppings; `sauceIds` contribute to `sauceBase` and `ingredientSet` independently. A post-bake sauce in `sauceIds` would be misidentified as pre-bake sauce unless identity rules change.
- `src/logic/scoringV2/index.ts:250-274,333-363`: Reference validation separates sauce targets from piece groups; `sauceDeposits` is the canonical pre-bake paint log and sauce component evaluates deposits against the reference sauce. DRIZZLE is not a simple additive scoring extension. A dedicated post-bake role and Reference contract require Owner decision.
- `src/data/recipeSauceProfiles.ts:1-18`: supported sauce interactions remain `PAINT | PAINT_TEMPORARY`; DRIZZLE is explicitly deferred.

### Revised risk classification
**BLOCKED ON DATA/IDENTITY DESIGN.** Existing sauce ledger reuse is NOT recommended as a default. A separate transient prototype is safe, but persistent FINISH liquid needs coordinated reducer, phase-aware scoring, Reference, signature, inventory and save compatibility design. The earlier preference for existing v2 representation remains only a hypothesis pending actual save serialization audit. Do not assert save compatibility or implement until that audit is complete.

### Remaining investigation
- Find `canPlacePostBakeIngredient` implementation and all inventory debit/undo call sites.
- Inspect `PizzaState` persistence and schema v2 serialization/restore, including pendingRound.
- Inspect `scoreRecipeComponentV2` and `finalizeRound` to determine post-bake sauce role and provisional scoring.
- Confirm recipe data for a real first target and Free/Research gates. Verify latest main again.

## 8. Save / inventory / settlement audit (2026-11-04, main `00162221`)

- `src/state/persistence.ts:145,528-602`: persisted progression uses schema v2; the root is not a general serialization of GameState. A schema bump is not automatically necessary for an in-round liquid, but the pending-round journal must round-trip it safely.
- `src/state/pendingRound.ts:29-32,109-120,160-168,197-246`: journal pizza currently captures toppings (including optional `stage`), `sauceIds`, `sauceDeposits`, and validates them on read. There is no dedicated post-bake liquid collection. An added field would require explicit journal writer, reader, size cap and recovery behavior.
- `src/state/inventory.ts:134-156,165-188`: pre-bake debit includes `sauceIds`. Post-bake placement and debit count only `pizza.toppings` with `stage === "post"`, then call `consumePizzaInventory` with `sauceIds: []`. A post-bake sauce would not be charged through this path.
- `src/state/finalizeRound.ts:89-140`: PROVISIONAL/SINGLE consumes baked inventory, FINAL consumes post-bake pieces. Free Cooking identification is deferred until FINAL. The #495 provisional Reference behavior remains a separate scoring issue.
- `src/state/pendingRoundSettle.ts:35-99`: journal settlement replays `finalizeRound` and intentionally preserves the base inventory (already consumed). A new FINISH liquid must have its debit committed before journal settlement, or carry an explicit idempotent consumption record; otherwise recovery can lose or double-charge stock.
- `src/logic/scoringV2/recipeComponent.ts:60-115`: used ingredient types are the union of `sauceIds` and toppings, with no timing distinction for sauces. Existing recipe scoring would need an explicit phase-aware liquid role.

### Recommended minimal architecture (proposal, NOT approved)
1. Prototype DRIZZLE gesture and drawing as **transient Preview/DEV-only visual state**, with no stock debit, save writes, recipe credit or scoring claims.
2. For gameplay, design a **separate phase-tagged post-bake liquid placement model**, rather than putting it into `sauceIds` or treating it as an ordinary topping. Decide the exact field and journal versioning only after Owner approves a concrete recipe.
3. Keep `schemaVersion:2` only if pendingRound forward/backward compatibility and unknown-field preservation can be proven by tests. Otherwise require an explicit migration/compatibility Gate; do not assume compatibility.
4. Define atomic and idempotent post-bake stock debit, including interrupted rounds and `pendingRoundSettle`; then phase-aware identity and Reference scoring.
5. Regression matrix: pre-bake PAINT/NO_SAUCE, late toppings, Free/Research deferred identification, failed bake skip, cancel/reset/undo, save reload before and after FINISH, unknown schema, interrupted writes, and Dinner/Lunch Rush unchanged.

### Gate verdict
**D0 partially complete / implementation HOLD.** Runtime source audit confirms the current model is insufficient for persistent DRIZZLE. Remaining before design approval: exact recipe/material selection, pendingRound compatibility strategy and tests, transactional debit and settlement design, and scoring/Reference contract. This is not a claim that schema v2 must change; it is a requirement to prove whether it can stay unchanged.
