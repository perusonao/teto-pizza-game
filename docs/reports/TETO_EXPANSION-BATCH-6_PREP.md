# Expansion Batch 6 — PREP (docs-only)

Audited `origin/main` `dfe80d2f53b4d23cbb0603941f2f03e4607b0752` (2026-10-09). **Docs-only: no `src/**`, test, save, price or CUT-branch change.**
Authority: Issue #420 (OD-420-1), Issue #422 (OD-DISPLAY-1 / 2), the Owner Decisions of 2026-10-09 (§1), the 172 matrix rows `california-style-pizza-pizzadb-p2` / `spinach-artichoke-pizza-pizzadb-p4`.

**Test environment:** none (`node_modules` absent). **No Vitest / Playwright / `tsc` was run.** Numbers marked *(script)* come from read-only Node scripts that import the production data (`--experimental-strip-types`) and, where a candidate recipe or ingredient did not exist yet, from in-memory synthetic objects that were never written to the repo. They must be re-run as real tests in the implementation PRs.

**Revision 2 (Owner Decision round 2 reflected).** The §2 `minCount`, `requiredIngredients` order and bake windows are now **Owner-approved** (§1). They are still documentation: no `src/**` change has been made, and an implementation PR must copy them from here. The goat-cheese 🧀 and artichoke 🌱 glyphs are approved as **provisional** display only.

## 0. Fresh Gate

| item | state |
|---|---|
| `origin/main` | `dfe80d2f` (unchanged since the Expansion Fresh Audit) |
| #420 | open. OD-420-1 final: goat-cheese = Step 50 AND 累計⭐120, spinach = Step 51 AND 累計⭐130; ⭐ is non-consumed and derived from Dex `bestStars`; retroactive for existing saves; no relock / double unlock; first implementation candidate = per-ingredient `starGate` on the ladder step (案α), the old `Ingredient.unlockCondition.minTotalStars` path is not reused |
| #418 | closed by PR #425 (merged). PR #425 body records **Owner HV PASS (approved SHA `cb29b4b`)**; the merged head `2420952` differs from it only in one E2E spec (per the PR's own comment). #427 / #426 / #429 (post-HV CUT defects) are open and are a separate track |
| #422 | open. PR-A (Dex generic silhouette), PR-B (Shop LOCKED all-items), PR-C (⭐ gate + remaining-count display, integrated in Batch 6). **No branch or PR exists for PR-A / PR-B** |
| CUT track | #427 / #426 implementation is in another session; nothing in this document touches it |

## 1. Owner Decisions applied

| # | Decision | Where reflected |
|---|---|---|
| R1-1 | #422 PR-A / PR-B land **before** Batch 6 Production | §5 |
| R1-2/3 | both recipes NO_SAUCE; california = goat-cheese only (no mozzarella); steps `DOUGH > CHEESE > TOPPING` | §2 |
| R1-4 | avocado = fruit, 🥑 | §2.5 |
| R1-5/6 | goat-cheese = cheese 🧀, artichoke = vegetable 🌱: **provisional display**; dedicated SVG is handled by Ingredient Icons 2.0 (#417), not by Batch 6 | §1.1, §2.5 |
| R1-8 | both: `cut:false`, `lunchRush:false`, `ladderCredit:true` | §2.5 |
| R1-9 | Research cohort keeps the purchase-order dependence | §6 |
| R1-10 | Batch 5 HV unconfirmed items are not treated as PASS | §7 |
| **R2-1** | **spinach = vegetable, 🍃. The Hint 5.0 vegetable class symbol 🥬 and gate G18 are NOT changed** (option B of the previous revision) | §1.1 |
| **R2-2** | minCount / order / bake windows approved: california `goat-cheese 2 / fresh-tomato 2 / arugula 2 / avocado 2`, 56–76; spinach-artichoke `mozzarella 2 / cream-cheese 1 / parmigiano 1 / spinach 2 / artichoke 2`, 54–74 | §2 |
| **R2-3** | NO_SAUCE, `cut:false`, `lunchRush:false`, `ladderCredit:true` for both | §2.5 |
| **R2-4** | goat-cheese 🧀 / artichoke 🌱 approved as provisional display; dedicated SVG → Ingredient Icons 2.0 | §1.1 |
| **R2-5** | purchase-order dependence kept; the effect on the 7 existing recipes is pinned by a **formal regression test** (mandatory, not optional) | §6, §10 |
| **R2-6** | a ⭐-gate crossing **during Lunch Rush also shows the normal unlock notice**; no blocking modal; no duplicate notice | §5, §10 |
| **R2-7** | Batch 3 / Batch 5 HV stay "record unconfirmed"; no PASS is written | §7 |
| **R2-8** | implementation order: #422 PR-A → PR-B → ⭐ gate foundation → Batch 6 recipes → PR-C | §5 |

### 1.1 Spinach glyph (resolved by R2-1) and a collision to know about
`src/data/familyDisplay.ts` uses 🥬 as the vegetable **class** symbol; G18 / H5-INV-2 (`hint5Taxonomy.gate.test.ts`, `familyDisplay.test.ts`) forbids a class symbol equalling any ingredient emoji. Owner chose 🍃 for spinach, so 🥬 and G18 stay untouched.

**Correction of the previous revision:** it said 🍃 was "free in the current catalog". That was wrong. `oregano` (herb) already uses 🍃 (`src/data/ingredients.ts`, `\u{1F343}`). Consequences, stated without changing the decision:
- G18 compares class symbols with ingredient emoji only, and 🍃 is not a class symbol (herb = 🪴, vegetable = 🥬), so **G18 stays green**.
- No test found requires ingredient emoji to be unique (the catalog already shares 🧀 ×10, 🍅 ×3, 🌿 ×2), so no gate fails. The code comments do describe a "closest distinct existing glyph" convention, which this breaks for spinach / oregano.
- Practical effect: oregano and spinach look identical on the tray, Shop and reference pizza until Ingredient Icons 2.0 gives them dedicated art. Batch 6 Preview HV should check that the two are still distinguishable by name and position. If that proves a problem the Owner can pick another glyph or pull spinach forward in Icons 2.0; this document does not reopen the decision.
- Provisional: goat-cheese 🧀 (same as 10 cheeses), artichoke 🌱 (no other ingredient uses 🌱 today; 🥑 is also unused, and does not equal the fruit class symbol 🍇).

## 2. Composition (Owner-approved values, R2-2)

Design rules behind the approved values: (a) every existing ingredient keeps `minCount` ≤ its current catalog maximum k, so no existing pack size changes (§3); (b) at most 8 non-sauce pieces, so the reference layout stays on the exact 8-slot ring (`getReferenceSlots(n ≤ 8)`); (c) bake window from the nearest shipped NO_SAUCE / cheese-led recipes; (d) key / reserve placement is derived, not chosen (§2.3).

### 2.1 california-style-pizza (ID per 172 matrix; evidence: dough 薄めのナポリ風, sauce family チーズ = none)
| position | ingredient | minCount | note |
|---|---|---|---|
| 1 | goat-cheese (new, cheese) | 2 | the only cheese; k becomes 2 → pack 20 |
| 2 | fresh-tomato | 2 | existing k = 3, unchanged |
| 3 | arugula | 2 | existing k = 2, unchanged |
| 4 | avocado (new, fruit) | 2 | k = 2 → pack 20 |

Bake window **56–76** (approved) (thin Neapolitan, no sauce; same as `bacalhau` / `brazilian-catupiry-corn-pizza`). 8 non-sauce pieces. Steps `DOUGH > CHEESE > TOPPING`. Alternative if the Owner wants a more cheese-forward pizza: goat-cheese 3 (9 pieces, multi-ring reference layout, already used by `pizza-portuguesa` at 10).

### 2.2 spinach-artichoke-pizza (evidence: 薄め, sauce family チーズ = none)
| position | ingredient | minCount | note |
|---|---|---|---|
| 1 | mozzarella (starter) | 2 | |
| 2 | cream-cheese | 1 | existing k = 2, unchanged (`jalapeno-popper-pizza` also uses 1) |
| 3 | parmigiano | 1 | existing k = 2, unchanged |
| 4 | spinach (new, vegetable) | 2 | k = 2 → pack 20 |
| 5 | artichoke (new, vegetable) | 2 | k = 2 → pack 20 |

Bake window **54–74** (approved) (cream-cheese-led thin pizza; same as `jalapeno-popper-pizza` / `palmito-pizza`). 8 non-sauce pieces. Steps `DOUGH > CHEESE > TOPPING`.

### 2.3 Why this order (derived by existing code, *(script)*)
- **Hint key** = the ingredient of the latest ladder step; on a tie the **first in `requiredIngredients` order** (`hintKeyIngredientId`). Both new ingredients of a step share one step number, so listing the ⭐-gated one first makes it the key: goat-cheese (california) and spinach is listed **before** artichoke (spinach-artichoke). The gated ingredient is also the one a player acquires last in the natural flow.
- **Rule W reserve** = the last non-key ingredient of the highest category present (topping > cheese > sauce): avocado (california), artichoke (spinach-artichoke).
- Both are permanently key-free Hint recipes (`{ keyFree: true }`, as Batches 1–5), so no KEY_TOPPING rung exists; the key/reserve only matter for the legacy Hint 2.0 / 3.0 / 4.0 paths and Rule W tests.

### 2.4 Ladder (derived, *(script)*)
Running the production append-only derivation (`buildAppendOnlyLadder`, fixed = the 49 current steps) over the 53 recipes plus these two gives **exactly** step 50 `[avocado, goat-cheese]` key `california-style-pizza` and step 51 `[artichoke, spinach]` key `spinach-artichoke-pizza` (ingredient order is alphabetical, so the data must list them in that order for the existing equality test). `validateDiscoveryLadder` and `validateLadderProgression` return no problem for it (no softlock, no unused material, no unreachable recipe). The result is independent of the order the two candidates are passed in.

### 2.5 Other declared values
| item | value |
|---|---|
| ladderCredit / lunchRush / CUT / Hint | `true` / `false` / `false` / key-free |
| glyphs | avocado 🥑, goat-cheese 🧀 (provisional), artichoke 🌱 (provisional), spinach 🍃 (shares oregano's glyph, §1.1). Dedicated SVG: Ingredient Icons 2.0 |
| tier / price | step 50, 51 → **T4**, first pack 120 Pitz, refill 60 (existing tier table; no new price) |
| chapter | 4 (T4) → chapter sizes 6 / 11 / 16 **22** |
| Dex No. | appended after `pizza-overload`: 54, 55 |
| taxonomy rows (OD-T7) | avocado `fruit`, goat-cheese (category cheese, no family row, like the other cheeses), artichoke `vegetable`, spinach `vegetable` |
| `Ingredient.unlockCondition` | `{ minTotalStars: 0 }` as finite marker (the star gate itself lives on the ladder, 案α) |
| expected ledger | recipes 55 / credited 53 / ingredients 61 (toppings 47, cheeses 11) / ladder steps 51 / lunchRush pool 25 / NO_SAUCE 12 |
| shelf distribution | the family totals depend on the avocado / spinach / artichoke classification (fruit 2→3, vegetable 17→19); to be re-derived by the ledger test |

## 3. Existing k / price / pack: unchanged *(script)*
With the §2 counts: arugula k 2→2 (pack 20), fresh-tomato 3→3 (30), cream-cheese 2→2 (20), parmigiano 2→2 (20), mozzarella (starter) unchanged. New packs: avocado / goat-cheese / artichoke / spinach k = 2, pack 20. Price tier T4 for both steps. The rule that preserves this: **no new recipe may exceed an existing ingredient's current k** (a failing test should pin it for the batch).

## 4. Validation requirements (what the implementation PRs must keep green)

| area | requirement |
|---|---|
| Recipe Batch Validator (`recipeBatchValidator.ts`, `recipeBatchManifest.ts`) | replace `NEXT_RECIPE_BATCH` with a new manifest (the current one is `batchId: "expansion-batch-8"`, `status: "landed"`): `afterRecipeId: "pizza-overload"`, two recipes with `ladderCredit:true / lunchRush:false / cut:false / hint:"key-free"`. **Gap:** `keyIngredientId` is one id per recipe and the validator checks only that id (`PLANNED_INGREDIENT_EXISTS`, `LADDER_MATERIAL`). Use `goat-cheese` / `spinach` (the gated, last-acquired ones) and extend the check to **all** new finite materials of a step, and to the `starGate` field (the validator also assumes one ladder step per recipe, which still holds here) |
| validator cohort check | it compares Research letters in **ladder-order ownership** only; the purchase-order cases are not covered, hence §6 |
| append-only ladder | `discoveryLadder.appendOnly.test.ts` compares the shipped ladder with the derived one using `toEqual`; a `starGate` field on a step breaks that equality → compare the derived fields only (explicit, reviewed test change) |
| catalog ledger | `catalogLedger.test.ts` is the only hand-maintained total (§2.5) |
| DH4 / DH4-PROD | privacy sweep incl. the OD-DH4-2-9 "その他 is unreachable" test and the independent-attacker test must stay at 0 leaks. None of the 4 new ingredients is family `other` (avocado is `fruit` by Owner decision) — if any were `other`, the Batch 3 `tsukimi` precedent applies and the batch would stop |
| G7 / G17 / G18 | G7: NO_SAUCE set is derived from `RECIPE_SAUCE_PROFILES` (`null` entries) → 12, no hard-coded pin. G17 (key-free / hint roles): add `{ keyFree: true }` for both. **G18: spinach 🍃 (R2-1) is not a class symbol, so it stays green; oregano shares the glyph, §1.1** |
| Rule W walk | `gameReducer.selectableHint.test.ts` already has `60_000` ms; 55 recipes are expected to fit (6.5 s at 53 → ~6.8 s). Not re-run |
| tables the batch edits (Batch 5 template, 30 files) | `recipes.ts`, `ingredients.ts`, `ingredientTaxonomy.ts`, `discoveryLadder.ts`, `discoveryCatalog.ts` (evidence ids), `orders.ts`, `recipeHintRoles.ts`, `recipeSauceProfiles.ts` (`null` for both), `referencePizza.ts` (NO_SAUCE reference; sauce `null`), `catalogLedger.test.ts`, `recipeBatchManifest.ts`, DH4-1 audit JSON (regenerate), count snapshots, E2E spec, screenshots |
| composition collision | no existing recipe set equals / contains / is contained in either candidate (checked against all 53 recipes, *(script)*); the matcher / `dinnerResultDetection` unique-signature test still has to run |
| 172 matrix | `progression2_mechanic_matrix.py --check` still FAILS on main (#260: the committed matrix has 15 `shippedRecipeIds`). Re-confirmed read-only. Not part of Batch 6; do not "fix" it inside this batch |

## 5. Dependencies and order (fixed)

```
#422 PR-A (Dex generic silhouette + shared locked-slot component)
  → #422 PR-B (Shop LOCKED all-items, anonymity tests)         [no star gate yet]
    → Batch 6 PR-1: ⭐ gate foundation (ladder data/logic/entitlement, no recipe)   [behaviour-neutral for current data]
      → Batch 6 PR-2: 4 ingredients + 2 recipes + steps 50/51 (+ validator/ledger/DH4)
        → #422 PR-C = Batch 6 PR-3: ⭐ remaining-count display (OD-DISPLAY-2) + notices
```
- PR-A / PR-B need no Batch 6 data. PR-1 needs no PR-A/PR-B code but must follow them (Owner decision #1). PR-2 needs PR-1. PR-3 needs PR-B (the LOCKED section is where "⭐あと○個" lives) and PR-2.
- Each PR: separate branch from the then-current `main`, focused Vitest, `tsc -b`, `oxlint`, `vite build`, Layout Contract Gate, WebKit all shards; UI PRs (A, B, 3) also need the Human Verification package of `TETO_HUMAN-VERIFICATION-POLICY.md` (390×844 video delivered directly, before/after screenshots under `docs/reports/screenshots/<task>/`). PR-2 follows the Batch 5 shape (representative E2E at 390×844 and 360×800, Preview HV).
- **PR-1 scope (design):** an optional `starGate` per ingredient on an appended ladder step; `resolveShopEntitlement` (which already receives the Dex) removes a reached-step ingredient whose gate is not met, then unions with the persisted ledger. Three call sites exist: `App.tsx:181` (load), `gameReducer.ts:1449` (REGISTER_TO_DEX), `gameReducer.ts:1584` (MISSION_NEXT_ORDER); all already pass the Dex. `validateDiscoveryLadder` additions: gate is a positive integer, belongs to an ingredient of its step, at most one gated ingredient per step, at least one ungated ingredient per step. No save-schema change (the `unlockedForShopIngredientIds` ledger is the memory). Also needed: `nextMaterialHint` handles discovery-count hints only → a separate ⭐-shortfall helper; `discoveryProgressionModel.ts` (DEV inspector) walks the ladder without ⭐ and needs a star input.
- **Lunch Rush ⭐ notice (Owner R2-6, decided):** crossing a ⭐ gate during Lunch Rush shows the **normal unlock notice** (same wording `MATERIAL_UNLOCK_NOTICE_LEAD_JA` + names). It must be **non-blocking** (no modal, no required tap, no timer pause) and **never duplicated**. Facts found by reading: `lastMaterialUnlockNotice` is built only in REGISTER_TO_DEX and rendered only by `ResultPanel` (FREE); `MISSION_NEXT_ORDER` changes `bestStars` and the ledger but builds no notice, and its next-order step rebuilds fresh round state, so a plain state field would be lost. PR-3 therefore needs a run-scoped transient pending notice (never persisted) rendered inline in the Lunch Rush HUD / serve panel, and cleared when shown. Layout (390×844 / 360×800) and wording placement are settled in PR-3 and verified by Owner HV; this document does not fix the UI.
- **No-duplicate rule:** a material is announced only in the call whose ledger union first adds it (`newlyUnlockedMaterialIds` is empty on every later call); the pending Lunch Rush notice and the FREE `lastMaterialUnlockNotice` are fed from that same value, so a crossing is announced by exactly one of them. Load (`App.tsx:181`) announces nothing, as today; reload never replays (transient state).
- **CUT file conflicts (checked by reading, `dfe80d2`):** #427 plans `src/logic/cut/*`, `geometry.ts`, `evaluation.ts`, `state.ts`, `pieces.ts`, `PreviewBadge.tsx`, `CutDebugPanel.tsx` and one line (`~1127`) of `gameReducer.ts`. Batch 6 touches `gameReducer.ts` only at the two entitlement call sites (≈1449 / ≈1584) and does not touch `cookingProfiles.ts` (`cut:false`). Textual conflict risk is low; re-check when PR-1 starts.

## 6. Research cohort: purchase-order characterization (design + measured baseline)

Mechanism (read from `researchEntry.ts`): a recipe's Research unlock fact is the finite ingredient acquired **last** in `ownedIngredientIds` (the player's purchase order, not the ladder order); recipes sharing it form a cohort and get letters in hash order. This is existing behaviour (e.g. step 28 `bell-pepper + zucchini`, step 37 `cream-cheese + lemon + salmon`), and the Owner has kept it.

Measured *(script, in-memory synthetic recipes/ingredients, 53 → 55 recipes)*:
| scenario | result |
|---|---|
| natural order (all older materials owned before the 4 new ones) | **0** pre-existing recipe letters move; both new recipes are single-member cohorts (no letter) |
| the 4 older shared materials (arugula, fresh-tomato, cream-cheese, parmigiano) owned first, then the 4 new ones in any of the 24 orders | 0 moves |
| exactly one older material bought **after** all four new ones (24 orders each) | arugula → `jamon-serrano-pizza`; fresh-tomato → `pesto-pollo`, `pesto-trapanese`, `veggie-supreme-pizza`, `pizza-feta-eliniki`; cream-cheese → `pesto-salmone`; parmigiano → `parmigiana-pizza`. Moves in 24/24 orders |
| worst case: all 8 materials (4 new + 4 older) bought last, all 40,320 orders | 30,240 orders move at least one pre-existing letter; the affected recipes are exactly the 7 above |

**Mandatory regression tests (R2-5)** (new file, e.g. `researchCohort.batch6.order.test.ts`; none exists yet; the 7-recipe join set below is pinned as an explicit expectation):
1. **Natural-order invariance:** ladder-order ownership with the 4 new materials appended in each of 24 orders → no pre-existing letter changes; both new recipes unlettered.
2. **Pin the join set:** for each older shared material X bought last (after the new ones), assert the moved-letter recipe set equals the table above (an explicit, reviewed expectation, so a future recipe change cannot silently widen it).
3. **Exhaustive worst case** (8! = 40,320 orders; the measuring script ran within one tool call, runtime in CI not measured): the union of affected pre-existing recipes is exactly those 7; no other recipe ever moves; new recipes' unlock fact is always one of their own finite materials.
4. **Gate-order case:** goat-cheese / spinach acquired later than their sibling (the star-gated flow) is a subset of test 1 and must give the same result.
5. **Privacy:** the label carries only the unlock ingredient name and the letter (INV-B7); no count / hash; nothing persisted.
6. **Validator extension:** keep the existing ladder-order letter-identity check and add a pointer to this test file.
The Owner contract (OD-R2-2: a catalog revision may change letters; re-audit before 53 / 172) already accepts the delayed-purchase cases; the tests make the accepted set explicit instead of changing the mechanism.

## 7. HANDOFF and unconfirmed HV results

Verified against git/GitHub (not copied from older prose):
- #409 (speed-up Phase 1), #410 (Batch 1), #412 (Batch 2), #413 (Batch 3), #414 (Batch 4), #415 (Scale Audit docs), #416 (Batch 5) are all **merged into main** (merge commits `b67723bf`, `2c9dc281`, `c8b6bd76`, `a8184ca7`, `1d601b86`, `4956bb8c`, `b9ca1fa8`); #407 (Slice 3) and #408 (All-Owned Tray) too. The HANDOFF still calls Batch 3, 4, 5, Slice 3 and the Tray "branch only, no PR yet" / "PR pending".
- HV records found: Batch 4 — "Owner Preview HV PASS" recorded in commit `31b53bcc`. **Batch 5 — no PASS record anywhere** (Result Report §3 is a checklist; PR #416 has only a Codex summary and a CI note). **Batch 3 — no HV record found.** The Owner's merge is not a recorded HV result; this PREP does not fill them in.
- Other stale statements verified: #75 (RESULT 2.0 Slice 1) is merged but its addendum says "PR #75 OPEN"; #163 (Phase 4B audit) is merged; #68 is already corrected inside the document. The remaining "PR OPEN / PR pending Final Gate" addenda (Sept 21–23 and Oct 4–6 entries) were **not** individually verified here.
- `Updated: 2026-09-18` (line 3) predates ~20 later addenda; the addenda sit above and below it in non-chronological order.
- Not in HANDOFF at all: #418 / PR #425, #420, #422, #427 / #426 / #429, Batch 6.
- Treatment in this branch: one new sync addendum at the top of the addenda list, plus a short inline pointer on the Batch 3 / 4 / 5 lines. No old line was rewritten and no HV result was added.

## 8. Remaining blockers / open items
No Owner question from round 1 remains open. Remaining blockers:
1. **#422 PR-A / PR-B are not started** (no branch or PR). PR-1 onward waits for them (R2-8).
2. **PR-3 notice UI** for Lunch Rush has no host component today (§5); its layout needs Owner HV.
3. **Glyph follow-ups, not blockers:** spinach 🍃 equals oregano's glyph (§1.1); goat-cheese / artichoke stay provisional until Ingredient Icons 2.0.
4. **Batch 3 / Batch 5 HV:** unconfirmed and stays that way (R2-7); nothing in Batch 6 depends on it.
5. **#260** (matrix `--check` fails on main) is unrelated and stays out of this batch.
6. **Unmeasured:** real-player ⭐ pace against 120 / 130; no test was run in this docs-only work (§9).

## 9. Not done / not verifiable here
No test, build or E2E was run. ⭐ distribution of real players is unknown (120 / 130 against a 255 maximum at 51 credited recipes is ≈47% / 51%; reachability is not a deadlock because ⭐ can be raised by replaying, but the pace is unmeasured). Glyph uniqueness for spinach alternatives was only checked by reading `ingredients.ts` / `familyDisplay.ts`, not by the G18 test.

## 10. Acceptance criteria and test items for the implementation PRs

Common to every PR: separate branch from the then-current `main`; focused Vitest of the touched areas, `tsc -b`, `oxlint`, `vite build`, Layout Contract Gate, WebKit all shards green; no CUT file touched; save schema stays v2 (no new persisted field); UI PRs ship the Human Verification package of `TETO_HUMAN-VERIFICATION-POLICY.md` (390×844 video delivered directly and not committed; before/after screenshots under `docs/reports/screenshots/<task>/`; 360×800 checked).

**#422 PR-A (Dex silhouette):** an undiscovered slot shows one shared generic silhouette; chapters, No., discovered counts and D-2 aggregation unchanged; no name, glyph, id or family of an undiscovered recipe in DOM / aria / data attributes; existing Dex tests updated only where they assumed the old locked rendering.
**#422 PR-B (Shop LOCKED all-items):** every finite purchasable ingredient listed as NEW → OWNED → LOCKED, LOCKED in a section after the category tabs; each LOCKED row = 🔒 + 「？？？」 + the shared silhouette only (no real name, glyph / emoji, family, price, pack size, button, id in DOM / aria / data); purchase guard unchanged; the aggregate "あとNつ発見" line kept; anonymity regression test; old tests that assumed LOCKED rows hidden are revised deliberately.

**Batch 6 PR-1 (⭐ gate foundation, no recipe, no new ingredient):**
- With no gated step in the data, every existing ladder / entitlement / shop test passes **unchanged** (byte-identical behaviour).
- `starGate` is optional per ingredient on an appended step; `validateDiscoveryLadder` rejects: non-positive or non-integer gate, a gate on an ingredient not in its step, more than one gated ingredient in a step, a step with no ungated ingredient.
- Unit tests of the entitlement bridge with a synthetic ladder: step not reached → locked; step reached and ⭐ < gate → locked; ⭐ ≥ gate → unlocked; ⭐ is not consumed (a later purchase leaves `totalStars` unchanged); gate crossed by a re-registered known recipe; gate crossed in MISSION_NEXT_ORDER; load of a save that already satisfies the gate unlocks retroactively with stock 0 and no `ownedIngredientIds` change; a ledger entry never disappears when ⭐ or the Dex later shrink (Dex reset) and the call is idempotent; unknown ids kept.
- ⭐-shortfall helper (for PR-3) returns the smallest remaining ⭐ among step-reached gated items and `null` when the step is not reached (OD-DISPLAY-2: no ⭐ line before the step).
- `discoveryProgressionModel.ts` (DEV inspector) takes a ⭐ input and stays consistent with the bridge.
- Append-only test compares the derived fields only (explicit, reviewed edit).

**Batch 6 PR-2 (4 ingredients + 2 recipes, steps 50 / 51):**
- Data exactly as §2 / §2.5 (values copied from this document), `starGate` goat-cheese 120 at step 50 and spinach 130 at step 51, ladder ingredient order `[avocado, goat-cheese]`, `[artichoke, spinach]`.
- `catalogLedger.test.ts` expected totals (§2.5), batch manifest + validator extension (all new finite materials of a step, the gate field), `recipeSauceProfiles` `null` ×2, `recipeHintRoles` `{ keyFree: true }` ×2, `discoveryCatalog` evidence ids, `orders.ts` lines, NO_SAUCE reference pizzas, taxonomy rows (avocado fruit, artichoke / spinach vegetable, goat-cheese cheese), DH4-1 audit JSON regenerated.
- Gates stay green without relaxing any assertion: G7 (NO_SAUCE set derived = 12), G17, **G18 (spinach 🍃)**, DH4-PROD privacy incl. OD-DH4-2-9, Rule W walk (60 s timeout), dinner unique-signature, Lunch Rush exclusion (pool stays 25), CUT: neither recipe is CUT-eligible, Dex numbering 54 / 55, chapter 4 size 22.
- Economy: a test pins existing k / packs (§3) so no new recipe can raise an existing ingredient's k; both steps price T4.
- Representative E2E at 390×844 and 360×800: reach step 50 / 51 → Shop NEW (and ⭐ shortfall once PR-3 exists) → buy → Research entry shows only the unlock ingredient → cook the NO_SAUCE flow (no SAUCE tab) → NEW DISCOVERY → Dex. Preview HV package.
- **Mandatory Research cohort regression (R2-5):** the tests of §6 (natural-order invariance; the exact join set: arugula → `jamon-serrano-pizza`; fresh-tomato → `pesto-pollo`, `pesto-trapanese`, `veggie-supreme-pizza`, `pizza-feta-eliniki`; cream-cheese → `pesto-salmone`; parmigiano → `parmigiana-pizza`; exhaustive 8! worst case = exactly those 7; new recipes' unlock fact always one of their own materials; label privacy). A change in that set must fail the test.

**Batch 6 PR-3 (= #422 PR-C: ⭐ remaining-count display + notices):**
- Shop LOCKED section shows the two aggregate lines **at the same time** when both conditions hold (OD-DISPLAY-2): 「あとNつ発見で新しい材料が入荷」 and, only when the target step is reached and ⭐ is short, 「⭐あとN個で新しい材料が入荷」; the smallest attainable shortfall is aggregated; no name, id, family, price or per-row mapping.
- Notices: FREE ResultPanel notice fires on a ⭐ crossing (also on a known-recipe re-registration); **Lunch Rush shows the same notice non-blockingly (no modal, no input required, clock not paused)**; exactly one notice per material across FREE, Lunch Rush, reload and load; a test drives crossing in REGISTER_TO_DEX then MISSION_NEXT_ORDER and asserts a single announcement; no notice when nothing is newly entitled.
- 390×844 / 360×800: notice and ⭐ line do not overflow or overlap the HUD, serve panel or fixed buttons; WebKit shards green.
