# Batch 25 統合 — 全 Vitest 失敗の分類（再開用）

- 測定: HEAD 01f9db52（#857 `dabfa4c3` + #858 `871616c4` 統合 + 型修正 + E2E 再生成）。`npx vitest run`、1978 秒（約 33 分、4 コア）。
- 結果: 12,640 件中 PASS 12,474 / **FAIL 144（66 ファイル）** / skip 20 / todo 2。#857 が更新済みのファイルでの失敗は 0（全件が追従未実施のファイル）。
- 長時間の原因: 全件走査系（researchAttempt.sim* 570–600 秒、deductionGuard.gate 245 秒）が主。停止ではない。

## 分類
- **A 件数・位置・新しい行の追従**（ordinary 74→81、late 移動、pinned ID 数、総数、技法 allowlist 等）: Train Kit §1-9（sweep）の対象。
- **B 仕様ゲート違反（期待値を変えず報告）**: kebab-sauce vs buffalo-sauce ΔE 20.4 < 25（expansionBatch22）／buffalo-cauliflower vs buffalo-chicken Jaccard 0.6 ≥ 0.4（expansionBatch22）。
- **C 挙動の判断が必要**: pizza-salad の 2 ソース（1 ソース不変条件・allowlist）、SAUCE ヒントが mozzarella より先に yogurt を促す（hints.multiSauce）。

## ファイル別（先頭メッセージ）
- `src/logic/researchAttempt.sim.sweepFull.test.ts` (12)
  - tray-order sensitivity sweep (NONE, FULL, seed 1): completed, no violations, min Pitz >= 0 — AssertionError: NONE seed 1: expected [ Array(1) ] to deeply equal []
  - tray-order sensitivity sweep (NONE, FULL, seed 2): completed, no violations, min Pitz >= 0 — AssertionError: NONE seed 2: expected [ Array(1) ] to deeply equal []
  - tray-order sensitivity sweep (NONE, FULL, seed 3): completed, no violations, min Pitz >= 0 — AssertionError: NONE seed 3: expected [ Array(1) ] to deeply equal []
- `src/logic/researchAttempt.sim.sweepOne.test.ts` (12)
  - tray-order sensitivity sweep (NONE, ONE, seed 1): completed, no violations, min Pitz >= 0 — AssertionError: NONE seed 1: expected [ Array(1) ] to deeply equal []
  - tray-order sensitivity sweep (NONE, ONE, seed 2): completed, no violations, min Pitz >= 0 — AssertionError: NONE seed 2: expected [ Array(1) ] to deeply equal []
  - tray-order sensitivity sweep (NONE, ONE, seed 3): completed, no violations, min Pitz >= 0 — AssertionError: NONE seed 3: expected [ Array(1) ] to deeply equal []
- `src/logic/catalog/recipeBatch.validator.test.ts` (8)
  - Expansion Batch 10 PR-1 (five ordinary recipes) is LANDED and consistent: appended tail, a — AssertionError: expected [ …(2) ] to deeply equal []
  - B11 S1 (boscaiola / porcini-pizza / pescatore) is LANDED and consistent: appended tail, ap — AssertionError: expected [ …(2) ] to deeply equal []
  - B12 (jamaican-jerk-chicken-pizza) is LANDED and consistent: appended tail, no ladder step  — AssertionError: expected [ Array(1) ] to deeply equal []
- `src/logic/researchAttempt.sim.test.ts` (5)
  - reaches the full Dex with the Contract invariants intact on every attempt (NONE q80 FULL) — AssertionError: NONE q80 FULL: expected [ Array(1) ] to deeply equal []
  - reaches the full Dex with the Contract invariants intact on every attempt (NONE q65 FULL) — AssertionError: NONE q65 FULL: expected [ Array(1) ] to deeply equal []
  - reaches the full Dex with the Contract invariants intact on every attempt (NONE q30 FULL) — AssertionError: NONE q30 FULL: expected [ Array(1) ] to deeply equal []
- `src/data/expansionBatch21.test.ts` (4)
  - B21_BATCH is LANDED and consistent over the FULL catalog (late batches are deliberately no — AssertionError: expected [ …(2) ] to deeply equal []
  - the approval-time measurement (10 seeded random orders over the ladder as it was approved, — AssertionError: expected [ 'baingan-bharta-pizza', …(19) ] to deeply equal [ 'baingan-bharta-pizza', …(16) ]
  - on the SHIPPED ladder (the six B21 materials included, the audit's default 40 seeded rando — AssertionError: expected [ 'baingan-bharta-pizza', …(19) ] to deeply equal [ 'baingan-bharta-pizza', …(16) ]
- `src/data/expansionBatch22.test.ts` (4)
  - the two new sauces stay at least dE 25 from every other sauce (late4 precedent; measured:  — AssertionError: buffalo-sauce vs kebab-sauce: expected 20.44954890398955 to be greater than or equal to 25
  - B22_BATCH (ordinary) and B22_LATE_BATCH (late) are LANDED and consistent over the catalog: — AssertionError: expected [ …(2) ] to deeply equal []
  - buffalo-chicken: no other recipe has the set, none is a subset or a superset, none differs — AssertionError: buffalo-chicken vs buffalo-cauliflower-pizza Jaccard: expected 0.6 to be less than 0.4
- `src/data/expansionBatch23.test.ts` (4)
  - ordinary steps become 74 (74 apple -> apple-cinnamon-dessert, no star gate); the thirteen  — AssertionError: expected [ { step: 1, …(3) }, …(80) ] to have a length of 80 but got 81
  - B23 adds no late material: the entitlement floors are unchanged (an ordinary step carries  — AssertionError: expected { 'salmon-roe': 57, …(37) } to deeply equal { 'salmon-roe': 57, …(31) }
  - B23_BATCH is LANDED and consistent over the catalog: credit, key ingredient, cohort identi — AssertionError: expected [ …(2) ] to deeply equal []
- `src/data/expansionBatch23b.test.ts` (4)
  - the ordinary ladder is unchanged (74); two new late steps are the tail (88 nutella, 89 smo — AssertionError: expected [ { step: 1, …(3) }, …(80) ] to have a length of 80 but got 81
  - the entitlement floors are the ladder numbers at the moment of shipping (88-89) and every  — AssertionError: expected { 'salmon-roe': 57, …(37) } to deeply equal { 'salmon-roe': 57, …(31) }
  - B23_LATE_BATCH is LANDED and consistent over the catalog: credit, key ingredient, cohort i — AssertionError: expected [ …(2) ] to deeply equal []
- `src/data/expansionBatch24.test.ts` (4)
  - the steps and their keys — AssertionError: expected [ { step: 1, …(3) }, …(80) ] to have a length of 80 but got 81
  - the batch manifest is LANDED and consistent: appended tail, append-only ladder, chapter /  — AssertionError: expected [ …(2) ] to deeply equal []
  - every measured ID is one of the approved 43 (the approval is a deterministic UPPER bound o — AssertionError: expected [ 'banh-mi-pizza', 'pizza-salad' ] to deeply equal []
- `src/logic/researchAttempt.sim.mainOne.test.ts` (4)
  - reaches the full Dex with the Contract invariants intact on every attempt (NONE q80 ONE) — AssertionError: NONE q80 ONE: expected [ Array(1) ] to deeply equal []
  - reaches the full Dex with the Contract invariants intact on every attempt (NONE q65 ONE) — AssertionError: NONE q65 ONE: expected [ Array(1) ] to deeply equal []
  - reaches the full Dex with the Contract invariants intact on every attempt (NONE q30 ONE) — AssertionError: NONE q30 ONE: expected [ Array(1) ] to deeply equal []
- `src/data/expansionBatch18.test.ts` (3)
  - Owner OD-B18-1 APPROVED order-specific shift (not canonical acceptedLetterShifts): bbq-sau — AssertionError: expected true to be false // Object.is equality
  - in non-canonical orders exactly the pinned 39 pre-existing recipes can change their letter — AssertionError: expected [ 'aussie', …(40) ] to deeply equal [ 'aussie', …(38) ]
  - reproduces the two Codex examples: every ladder material owned, mayo last -> potato-mayo-p — AssertionError: potato-mayo-pizza before: expected 'A' to be undefined
- `src/data/expansionBatch20.test.ts` (3)
  - the batch manifest is LANDED and consistent: appended tail, append-only ladder, chapter /  — AssertionError: expected [ …(2) ] to deeply equal []
  - in non-canonical orders exactly the 10 Owner-approved pre-existing recipes can change thei — AssertionError: expected [ 'buffalo-cauliflower-pizza', …(10) ] to deeply equal [ 'genovese', …(9) ]
  - each recipe shows exactly its approved letter changes (a different change is a STOP), all  — AssertionError: genovese: expected [ Array(7) ] to deeply equal [ Array(6) ]
- `src/data/lateCatalog.tahini.test.ts` (3)
  - one late step carries both materials (the sauce first, the pomegranate = the Research coho — AssertionError: expected { step: 90, kind: 'MATERIAL', …(2) } to be { step: 85, kind: 'MATERIAL', …(2) } // Object.is equality
  - the batch manifest validates on the full catalog: the new recipe is the tail (before Pinsa — AssertionError: expected [ …(2) ] to deeply equal []
  - the compatibility floors are FIXED at 60 for both materials (never later than the step the — AssertionError: expected { 'salmon-roe': 57, …(37) } to deeply equal { 'salmon-roe': 57, …(31) }
- `src/data/lateCatalog.test.ts` (3)
  - holds exactly ikura-salmon-pizza, yuzu-shrimp-pizza, eggplant-dengaku-pizza, eggplant-tahi — AssertionError: expected [ 'ikura-salmon-pizza', …(20) ] to deeply equal [ 'ikura-salmon-pizza', …(15) ]
  - the late ladder steps are keyed to ikura, yuzu-shrimp-pizza, eggplant-dengaku-pizza, eggpl — AssertionError: expected [ { …(2) }, { …(2) }, { …(2) }, …(17) ] to deeply equal [ { …(2) }, { …(2) }, { …(2) }, …(12) ]
  - the late ingredient is ladder-gated (never a Starter) and its order, taxonomy row and size — AssertionError: expected [ 'swedish-kebab-pizza', …(20) ] to deeply equal [ 'ikura-salmon-pizza', …(15) ]
- `src/data/staged/stagedCatalog.test.ts` (3)
  - registers all 67 recipes: the 87 unshipped plan rows minus the 19 owned by in-flight / shi — AssertionError: expected 183 to be 177 // Object.is equality
  - is structurally valid against the shipped catalog (ids, references, statuses, lanes) — AssertionError: expected [ …(13) ] to deeply equal []
  - duplicate gate and dependency ledger (measured; changes must be reviewed) — Error: Snapshot `Staged Catalog — WS-R / WS-I registration (Issue #780) > duplicate gate and dependency ledger (measured; changes must be reviewed) 1`
- `src/data/expansionBatch19.test.ts` (2)
  - the batch manifest is LANDED and consistent: appended tail, append-only ladder, chapter /  — AssertionError: expected [ …(2) ] to deeply equal []
  - in non-canonical orders exactly the 20 Owner-approved pre-existing recipes can change thei — AssertionError: expected [ 'baba-ganoush-pizza', …(20) ] to deeply equal [ 'baba-ganoush-pizza', …(19) ]
- `src/data/hints.multiSauce.test.ts` (2)
  - 57+ one-sauce / no-sauce recipes x 3 steps x sauce states x piece states x explicit/not — AssertionError: pizza-salad SAUCE tomato-sauce {} explicit=false: expected 'ヨーグルトソースも塗ってみよう！' to be 'モッツァレラをのせてみよう！' // Object.is equality
  - only the allowlisted recipes have two sauce requirements — AssertionError: pizza-salad: expected 2 to be less than or equal to 1
- `src/data/lateCatalog.bbq.test.ts` (2)
  - one late step carries the sauce alone (Expansion Batch 18: the cilantro moved to ordinary  — AssertionError: expected [ 'ikura-salmon-pizza', …(19) ] to deeply equal [ 'ikura-salmon-pizza', …(14) ]
  - the batch manifest validates on the full catalog: the new recipe is the tail (before Pinsa — AssertionError: expected [ …(2) ] to deeply equal []
- `src/data/lateCatalog.dengaku.test.ts` (2)
  - one late step carries both materials, keyed to the recipe, after the yuzu step, with no st — AssertionError: expected { step: 89, kind: 'MATERIAL', …(2) } to be { step: 84, kind: 'MATERIAL', …(2) } // Object.is equality
  - the batch manifest validates on the full catalog: the new recipe is the tail (before Pinsa — AssertionError: expected [ …(2) ] to deeply equal []
- `src/data/lateCatalog.ikura.test.ts` (2)
  - recipe, ingredient, order, taxonomy row and size class join; every ordinary entry is uncha — AssertionError: expected [ 'margherita', 'marinara', …(114) ] to deeply equal [ 'margherita', 'marinara', …(109) ]
  - the late steps are appended after every ordinary step (ikura's first, then yuzu's, then de — AssertionError: expected [ { step: 1, …(3) }, …(100) ] to have a length of 96 but got 101
- `src/data/lateCatalog.late4.test.ts` (2)
  - two late steps after the BBQ step, keyed to the recipes, no star gate, derived numbers (72 — AssertionError: expected [ 'ikura-salmon-pizza', …(19) ] to deeply equal [ 'ikura-salmon-pizza', …(14) ]
  - the batch manifest validates on the full catalog — AssertionError: expected [ …(2) ] to deeply equal []
- `src/data/lateCatalog.yuzu.test.ts` (2)
  - a late step keyed to the recipe sits after the roe step, with no star gate and a derived ( — AssertionError: expected { step: 88, kind: 'MATERIAL', …(2) } to be { step: 83, kind: 'MATERIAL', …(2) } // Object.is equality
  - the batch manifest validates on the full catalog: the new recipe is the tail (before Pinsa — AssertionError: expected [ …(2) ] to deeply equal []
- `src/data/recipes.test.ts` (2)
  - has exactly 31 recipes total (7 shipped + Batch 1A's 4 + Batch 1B-A's 2 + Batch 1B-B's 1 + — AssertionError: expected [ Array(23) ] to deeply equal [ Array(22) ]
  - the pre-Batch-1A Starter 6 + fugazza are unchanged — AssertionError: expected [ 'bismarck', …(6) ] to deeply equal [ 'bismarck', 'funghi', …(4) ]
- `src/components/IngredientTray.familyFilter.test.tsx` (2)
  - keeps the pager in the same row, idle when the filtered list fits one page — AssertionError: expected null not to be null
  - above: choosing a family returns to page 1, shows only that family, and the pager stays be — AssertionError: expected 'ingredient-page-nav ingredient-page-n…' to contain 'ingredient-page-nav--placeholder'
- `src/preview/b21HvSeeds.test.ts` (2)
  - b21-taco: a consistent save — no B21 material owned, no B21 recipe discovered, every disco — AssertionError: expected 103 to be 108 // Object.is equality
  - b21-okonomiyaki: a consistent save — no B21 material owned, no B21 recipe discovered, ever — AssertionError: expected 103 to be 108 // Object.is equality
- `src/logic/materialShop.test.ts` (2)
  - every landed new ingredient has a hand-recorded contract row, and nothing else does — AssertionError: expected [ 'aji-amarillo', 'apple', …(12) ] to deeply equal [ 'aji-amarillo', 'apple', …(19) ]
  - covers exactly the ladder materials, and every finite ingredient a shipped recipe uses is  — AssertionError: expected [ 'aji-amarillo', 'almond', …(125) ] to deeply equal [ 'aji-amarillo', 'almond', …(132) ]
- `src/logic/researchAttempt.replayAudit.test.ts` (2)
  - runs the ablations (FULL / NONE) and checks the structural facts — AssertionError: expected [ Array(1) ] to deeply equal []
  - runs the ablations (ONE / NONE) and checks the structural facts — AssertionError: expected [ Array(1) ] to deeply equal []
- `src/logic/discovery/deductionProduction.gate.test.ts` (2)
  - every production recipe has exactly one sauce except the NO_SAUCE (Technique) recipes of t — AssertionError: re-run the DH4 privacy gate for Technique / multi-sauce recipes: expected [ 'apple-cinnamon-dessert', …(33) ] to deeply equal [ 'apple
  - INV-TQ-4 on the runtime: the allow-listed recipes (NO_SAUCE + tray + dough) are the only p — AssertionError: re-run the DH4 privacy gate for Technique recipes (TQ-1D): expected [ 'apple-cinnamon-dessert', …(44) ] to deeply equal [ 'apple-cinna
- `src/logic/discovery/hint5Ladder.baseCompat.test.ts` (2)
  - the population is the 64 key-free recipes: sauce + cheese 32, sauce only 10 (Expansion Bat — AssertionError: expected [ { …(8) }, …(90) ] to have a length of 85 but got 91
  - 0 violations: BASE is COMPLETED exactly when the old SAUCE / CHEESE rungs are, and STRUCTU — AssertionError: expected 51 to be 46 // Object.is equality
- `src/logic/techniques/runtime.test.ts` (2)
  - T16 / INV-TQ-4 (TQ-1D): with the production context only the NO_SAUCE recipes' no-sauce is — AssertionError: expected { ledger: [ 'late-addition' ], …(1) } to deeply equal { ledger: [], newlyDiscovered: [] }
  - is a no-op for every production save without aussie; a save with aussie is backfilled (INV — AssertionError: expected [ 'late-addition' ] to deeply equal []
- `src/logic/techniques/techniques.test.ts` (2)
  - exactly the NO_SAUCE production recipes require no-sauce, grandma-pizza (E-2) the tray, an — AssertionError: banh-mi-pizza: expected [ 'no-sauce' ] to deeply equal [ 'no-sauce', 'late-addition' ]
  - is a no-op for every production Dex without a NO_SAUCE recipe, and adds no-sauce once one  — AssertionError: expected { ledger: [ 'late-addition' ], …(1) } to deeply equal { ledger: [], added: [] }
- `src/data/discoveryCatalog.test.ts` (1)
  - every target is identical to its Phase-2 SHIPPED_KEEP target (items, capabilities, dimensi — AssertionError: buffalo-cauliflower-pizza: expected undefined to be defined
- `src/data/discoveryLadder.test.ts` (1)
  - the production ladder equals the REC-04 key-recipe rule applied append-only to the product — AssertionError: expected { populationId: 'w1-25', …(1) } to deeply equal { populationId: 'w1-25', …(1) }
- `src/data/lateCatalog.pinsa.test.ts` (1)
  - the Pinsa batch manifest validates with exactly one accepted shift (jamon -->B); the valid — AssertionError: expected [ Array(1) ] to deeply equal []
- `src/data/referencePizza.test.ts` (1)
  - every recipe's mechanical target uses that recipe's own real sauce ingredient (never a fab — AssertionError: expected Set{ 'tomato-sauce', …(22) } to deeply equal Set{ 'tomato-sauce', 'pesto', …(20) }
- `src/components/HintSheet.hint5.test.tsx` (1)
  - at every purchase state of every target: no recipe identity, no unbought ingredient, no su — AssertionError: mexican-elote-pizza k=2: クリームチーズ: expected true to be false // Object.is equality
- `src/mission/lunchRush.exclusion.test.ts` (1)
  - the 25 original production recipes all participate; only brazilian-calabresa (PR-4b-B), No — AssertionError: expected [ 'brazilian-calabresa', …(69) ] to deeply equal [ 'brazilian-calabresa', …(68) ]
- `src/logic/discoveryLadder.appendOnly.test.ts` (1)
  - equals the append-only REC-04 rule over the production recipes — AssertionError: expected { populationId: 'w1-25', …(1) } to deeply equal { populationId: 'w1-25', …(1) }
- `src/logic/discoveryLadder.test.ts` (1)
  - the Discovery Ladder / material Shop pure layer is reached only through its intended bridg — AssertionError: expected [ …(15) ] to deeply equal [ …(13) ]
- `src/state/discoveryExpansion2.wave2.test.ts` (1)
  - vongole's olive-oil is its OWN sauce-slot mapping (PAINT_TEMPORARY, like pizza-bianca) --  — AssertionError: pizza-salad: expected [ { …(2) }, { …(2) } ] to have a length of 1 but got 2
- `src/state/e5.ikuraProduction.test.ts` (1)
  - the catalog ends with the late content: ikura-salmon-pizza + salmon-roe + its late ladder  — AssertionError: expected [ 'wasabi-beef-pizza', …(15) ] to deeply equal [ 'ikura-salmon-pizza', …(15) ]
- `src/state/pinsa.production.test.ts` (1)
  - Pinsa is the tail of the catalog after ikura, yuzu-shrimp-pizza, eggplant-dengaku-pizza an — AssertionError: expected [ 'wasabi-beef-pizza', …(15) ] to deeply equal [ 'ikura-salmon-pizza', …(15) ]
- `src/state/progression.test.ts` (1)
  - OD-I5B-2: the 10 W1 recipes (+ PR-4b-B's calabresa and No.27's pesto-pollo and Expansion S — AssertionError: expected [ 'apple-cinnamon-dessert', …(79) ] to deeply equal [ 'apple-cinnamon-dessert', …(78) ]
- `src/state/recipeChapters.test.ts` (1)
  - E5 (late catalog on in Production): the real chapter 4 holds the late recipe, and a player — AssertionError: expected 21 to be 16 // Object.is equality
- `src/data/staged/stagedIsolation.test.ts` (1)
  - the shipped catalog contains no staged id — AssertionError: expected [ 'swedish-kebab-pizza', …(5) ] to deeply equal []
- `src/data/staged/stagedOwnerDecisions.test.ts` (1)
  - measured: remaining dependencies, additional decisions, next promotable, and the D-1 per-r — Error: Snapshot `Staged Catalog — Owner decisions D-1..D-7 (Issue #780, 2026-11-08) > measured: remaining dependencies, additional decisions, next pro
- `src/data/staged/stagedPromotion.firstTrain.test.ts` (1)
  - the late ladder steps, key-free Hint roles, discovery target ids, families and size classe — AssertionError: expected [ { …(2) }, …(1) ] to deeply equal [ …(2) ]
- `src/data/staged/stagedRejudge.test.ts` (1)
  - measured verdicts, duplicate types, exceptions and the parallel mechanic plan (golden) — Error: Snapshot `Staged Catalog — re-judgement under the provisional blanket rules (Issue #780, 2026-11-08) > measured verdicts, duplicate types, exce
- `src/data/staged/stagedSaveSafety.test.ts` (1)
  - drops only staged ids on load and keeps shipped data — AssertionError: expected [ 'tomato-sauce', 'mozzarella', …(2) ] to not include 'asparagus'
- `src/data/staged/stagedWhatIf.hint.test.ts` (1)
  - every staged recipe is a key-free Hint 5.0 target (T-COV), with its rung shape recorded — Error: Snapshot `What-if: Hint 5.0 with all staged recipes > every staged recipe is a key-free Hint 5.0 target (T-COV), with its rung shape recorded 1
- `src/data/staged/stagedWhatIf.research.test.ts` (1)
  - measures letter changes of the shipped recipes (canonical order = stop condition; others n — Error: Snapshot `What-if: Research cohort letters with all staged recipes > measures letter changes of the shipped recipes (canonical order = stop con
- `src/data/staged/stagedWhatIf.research19.test.ts` (1)
  - ID, letter before -> after, cohort material, first prefix, and the staged recipes that cau — AssertionError: expected [ { id: 'aussie', …(4) }, …(24) ] to have a length of 19 but got 25
- `src/logic/catalog/catalogShelf.test.ts` (1)
  - matches an independent recount: sauce 8 / derived cheese / derived topping and the family  — AssertionError: expected { sauce: 25, cheese: 17, topping: 95 } to deeply equal { sauce: 23, cheese: 17, topping: 95 }
- `src/logic/catalog/finishCatalogGuards.test.ts` (1)
  - E5: the late recipe (when the catalog is on) is the only shipped recipe with a late additi — AssertionError: banh-mi-pizza: expected false to be true // Object.is equality
- `src/logic/catalog/largeCatalogFixtures.test.ts` (1)
  - runtime fixture is the real catalog: 13 sauces / every cheese / every topping, and the rea — AssertionError: expected { sauce: 25, cheese: 17, topping: 95 } to deeply equal { sauce: 23, cheese: 17, topping: 95 }
- `src/logic/discovery/deductionGuard.gate.test.ts` (1)
  - across the synthetic families DH4-2A leaks and the hardened guard never does — AssertionError: expected 325 to be 291 // Object.is equality
- `src/logic/discovery/deductionHint.audit.test.ts` (1)
  - matches the committed machine-readable report — Error: Snapshot `DH4-1 25-recipe information audit > matches the committed machine-readable report 1` mismatched
- `src/logic/discovery/hint5Ladder.alphaReport.test.ts` (1)
  - matches the report golden — Error: Snapshot `PR-B alpha metric, family-only baseline (report) > matches the report golden 1` mismatched
- `src/logic/discovery/hint5Ladder.golden55.test.ts` (1)
  - matches the 55-ladder golden (kinds, sub order, next offers and request facts per prefix) — Error: Snapshot `PR-B golden: the Hint 5.0 ladder of every production recipe > matches the 55-ladder golden (kinds, sub order, next offers and request
- `src/logic/discovery/hint5Production.gate.test.ts` (1)
  - exactly the NO_SAUCE recipes (sauce-profile authority) require a technique and lack a sauc — AssertionError: a new Technique recipe must re-audit Hint 5.0 privacy before shipping: expected [ 'apple-cinnamon-dessert', …(44) ] to deeply equal [ 
- `src/logic/discovery/lateAxis.test.ts` (1)
  - a target that declares a non-empty late value is the only one that requires the technique — AssertionError: expected [ 'ikura-salmon-pizza', …(19) ] to deeply equal [ 'ikura-salmon-pizza', …(15) ]
- `src/logic/discovery/matcher.test.ts` (1)
  - no blocked Phase-2 row (incl. fugazza / fugazzetta) is a target or a runtime catalog entry — AssertionError: swedish-kebab-pizza-pizzadb-p4: expected true to be false // Object.is equality
- `src/logic/discovery/researchLabels.batch8a.test.ts` (1)
  - credit / Lunch Rush opt-out / ladder keys of the earlier recipes are unchanged (credited 5 — AssertionError: expected [ { id: 'margherita', …(5) }, …(83) ] to have a length of 83 but got 84
- `src/logic/discovery/researchResultRows.test.ts` (1)
  - Production fixture: every recipe uses exactly one sauce, except the NO_SAUCE targets (TQ-1 — AssertionError: pizza-salad: expected 2 to be 1 // Object.is equality
- `src/logic/discovery/sauceKinds.research.test.ts` (1)
  - every target's sauceBase has at most one sauce, except the allowlisted two-sauce recipes,  — AssertionError: pizza-salad: expected 2 to be less than or equal to 1
- `src/logic/discovery/selectableHint.test.ts` (1)
  - the cap is the recipe's current full H1..H4 cost: 35 for the 3-level recipes, 75 for the 4 — AssertionError: expected [ 'bismarck', …(17) ] to deeply equal [ 'bismarck', …(16) ]
- `src/logic/techniques/dexView.test.ts` (1)
  - injected context: a technique no catalog target requires never appears — AssertionError: expected [ { id: 'late-addition', …(2) } ] to deeply equal []

## 進捗（継続セッション時点）

- 実測台帳（不変条件の確認）: ordinary 81 / 既存 late 82–96（+1 移動）/ 新規 late 97–101 / step 98 = daikon + liver-pate（2 食材同時）/ 全 101 step。
- 修正済み（件数・位置・新しい行の追従、期待値の緩和なし）:
  - 先行バッチの「LATER 除外リスト」と `followedBy` に T25 の recipe（6）と material（7）を追記（Research の測定系 B18/B20/B21/B22/B23b が復旧）。
  - late 系 manifest の `followedBy` に T25 late 5 recipe を pinsa の手前へ追記（validator 8 件が復旧）。
  - lateCatalog.* / e5.ikuraProduction の `steps.at(-N)` と `steps.length - K` を T25 late 5 step 分ずらした。
- 再測定（重い 6 ファイルを除く 58 ファイル）: 失敗 104 → 71。重い 6 ファイル分（researchAttempt.sim* 33、replayAudit 2、deductionGuard 1、deductionProduction.gate 2、hint5Production.gate 1、stagedWhatIf.research 1）は別枠で未再測定。

## 未解決の finding（期待値を変えずに報告）

- **C-1（不具合の疑い、最優先）**: `researchAttempt.sim*` の 33 件超は同一原因。`pizza-salad#2004: rows without a Notebook line`（profile NONE / seed 1 / explorePieces ONE で再現）。Research の行は出るのに Notebook 行が出ない。`gameReducer.researchAttemptResult` → `researchRowsFeedback` が `null` を返す経路（`labelJa` 空、または trial notebook の先頭が別 entry）を #856 の I-7 runtime 側で確認する必要がある。
- **C-2**: pizza-salad は 2 ソース（tomato + yogurt）。「1 ソース」不変条件のテスト（hints.multiSauce / researchResultRows / sauceKinds.research / discoveryExpansion2.wave2）が失敗。allowlist への追加は挙動の仕様判断（presence-dab 前提）なので Owner／Codex 確認待ち。
- **C-3**: hints.multiSauce は SAUCE ヒントが mozzarella より先に yogurt を促す（`ヨーグルトソースも塗ってみよう！`）。意図した挙動か要確認。
- **B-1**: kebab-sauce vs buffalo-sauce の ΔE 20.4 < 25（expansionBatch22）。色は著作物のため Owner／デザイン判断。
- **B-2**: buffalo-cauliflower vs buffalo-chicken の Jaccard 0.6 ≥ 0.4（expansionBatch22）。重複 Gate の例外承認が必要。
- 技法 allowlist: banh-mi が `late-addition` を要求する新規行（techniques / runtime / dexView）。「新しい行」の追従だが、技法の追加なので Owner の確認推奨。

## 次の再開手順

1. `git fetch && git checkout claude/teto-batch-25-continuation-mcuqyq`（HEAD は本文書の commit）。
2. golden / snapshot 系（staged*, hint5Ladder.*, deductionHint.audit, stagedWhatIf）は生成元から再生成し、差分を目視してからコミット。
3. 残りの固定値（recipes 総数、sauce 25、ladder 101 など）を実カタログ値へ。
4. 重い 6 ファイルを単独実行（researchAttempt.sim* は 570 秒級）。
5. 最後に全 Vitest（約 33 分、バックグラウンド・タイムアウト最大）。

---

# C-1 調査結果（原因確定）と Owner 判断一覧（継続セッション）

## C-1: `pizza-salad#2004: rows without a Notebook line` — 原因は実装側（カタログ規模の上限）

**再現**: `simulateResearchAttempts({ profile: "NONE", qualityTotal: 65, orderSeed: 1, explorePieces: "ONE" })`（`researchAttempt.sim.sweepOne` の seed 1。`vi.mock("./discovery/hint5Flag")` が必要）。pizza-salad を狙った Research 試行 #2004 で、探索が **sauce 全種を 1 枚のピザに置く**（placed 29 件、うち sauce 24 件）。

**経路（追跡済み）**:
1. `gameReducer.researchAttemptResult` が `researchResultRows` から行（sauce 24 行、NEGATIVE 23 / POSITIVE 1）を作る。→ ここは正常（`lastResearchRows.rows` が 24 件）。
2. `researchRowsFeedback` が `「？？？ピザ（ヨーグルトソース）」+ ソース: …×` の 1 行を作る。→ 正常（`null` ではない）。**長さは 225 文字**。
3. `recordTrialAttempt` → `recordAttempt` → `sanitizeFeedback`（`src/logic/discovery/trialNotebook.ts:182`）が `textJa.length > MAX_FEEDBACK_TEXT (= 200)` で `{ ok:false }` → `REJECTED("INVALID_FEEDBACK")`。**試行は Notebook に保存されず**、`lastTrialAttempt` も `null`。
4. 結果として Notebook 先頭は古い試行（#1887）のままで、sim の不変条件 `rows without a Notebook line` が成立しない。

**実測（label を固定、sauce 行数 n と文字数）**: 15→145 / 20→180 / 21→189 / 22→**199** / 23→207 / 24→215 / 25→225。
- T25 前は sauce 23 種。自分のソースが既知なら行は最大 22 → **199 文字で上限 200 にちょうど収まっていた**。
- T25 が sauce を 2 種足した（kebab-sauce・yogurt-sauce → 25 種）ため、同じ試行が 24 行 = 215 文字になり上限を超えた。**sauce を 1 種足すごとに再発**する（次のバッチでも必ず壊れる）。

**切り分け**: Notebook 生成 ＝ 原因（上限）。Research 行 ＝ 正常。2 ソース処理 ＝ 無関係（原因は pizza-salad の 2 ソースではなく、sauce 種数 25 と pizza-salad の label 長）。#856 の I-7 runtime ＝ 無関係。テスト側の誤りではない。

**影響（実プレイ）**: 1 枚に sauce を 23 種以上置いた Research 試行だけ、Notebook に残らず「試作 #n」も出ない（Research の RESULT パネルとヒント事実の保存は正常）。通常の遊びでは起きにくいが、sim の不変条件と今後のカタログ増加で確実に再発する。

### 修正案（変更前の影響範囲。**まだ実装していません**）
| 案 | 内容 | 影響 | リスク |
|---|---|---|---|
| **P（推奨）** | `researchRowsFeedback` が 200 文字を超えるとき、各カテゴリの NEGATIVE を「ほか N 件×」に畳む（POSITIVE は必ず全件残す）。上限は変えない。 | プレイヤーに見える文言が、極端なケース（行が多い試行）でだけ変わる。通常の行は byte 同一。変更ファイルは `researchResultFeedback.ts` と、その単体・カタログ規模ガードのテストのみ。Notebook の契約・保存形式は不変。 | 文言（Anti-Oracle）の確認が必要。畳み文言が情報を漏らさないこと（NEGATIVE の件数のみ）を確認する。 |
| Q | `MAX_FEEDBACK_TEXT` を 200 → 400 等へ引き上げる。 | Notebook の検証（読み書き両方）と保存互換に影響。古いビルドが新しい保存を `INVALID_FEEDBACK` で弾く。`trialNotebook.test.ts:211`（201 文字で REJECTED）の期待値変更が必要。 | 契約変更・後方互換。非推奨。 |
| R | sim 側で sauce 全種探索をやめる。 | 不変条件の緩和＝禁止。 | 不可。 |

**回帰テスト案（修正と同時に追加。今は赤になるため単独でコミットしない）**: `src/logic/discovery/researchResultFeedback.catalogScale.test.ts`
```ts
// カタログ規模ガード: 全 sauce が行になる最悪ケースでも、行は Notebook の上限内に収まる。
import { it, expect } from "vitest";
import { researchRowsFeedback } from "./researchResultFeedback";
import { INGREDIENTS } from "../../data/ingredients";
const NOTEBOOK_MAX = 200; // trialNotebook.ts MAX_FEEDBACK_TEXT（非公開のため値を固定して照合）
it("the longest possible sauce-only Research line fits the Notebook limit at the current catalog size", () => {
  const ids = INGREDIENTS.filter((i) => i.category === "sauce").map((i) => i.id);
  const rows = ids.map((id, k) => ({ ingredientId: id, category: "sauce" as const, verdict: k === 0 ? ("POSITIVE" as const) : ("NEGATIVE" as const) }));
  const label = "？？？ピザ（ヨーグルトソース）";
  expect(researchRowsFeedback({ labelJa: label, rows })!.textJa.length).toBeLessThanOrEqual(NOTEBOOK_MAX);
});
```
（現状 225 文字で FAIL。案 P の実装後に PASS。）

## 新 finding D: T25 late order の配置（`LATE_ORDERS` の先頭に 4 件）
- 実測 `LATE_ORDERS` 順: `swedish-kebab, banh-mi, mexican-elote, pizza-asparagi, ikura, …, smore, pizza-salad, pinsa`。
- #858 の仕様（既存 late order の後ろ、pinsa の直前）なら `…, smore, swedish-kebab, banh-mi, mexican-elote, pizza-asparagi, pizza-salad, pinsa`。4 件は #858 統合前に生成されたため先頭に入った（#857 本文の「late-order 挿入の欠陥」）。
- 失敗テスト: `lateCatalog.test.ts:98`、`lateCatalog.ikura.test.ts:77`（期待値は #858 の配置）。
- 修正案: `src/data/lateCatalog.ts` の `ALL_LATE_ORDERS` で 4 件を smore の後ろへ移動（データ順のみ）。**影響**: 注文の出現順に使われる場合、late の客の並びが変わる（late 全体は T25 で初出なので既存プレイヤーへの影響は late ON 時の新規注文のみ）。実装変更のため承認待ち。

## Owner 判断一覧（仕様・基準は変更していません）
| ID | 失敗 | 現行仕様 | 実測 | 修正案 | Owner 判断事項 |
|---|---|---|---|---|---|
| C-2 | hints.multiSauce:85 / researchResultRows:223 / sauceKinds.research:45 / discoveryExpansion2.wave2:278 | 2 ソース許可は `MULTI_SAUCE_RECIPE_IDS`（grandma-pizza, pesto-burrata-pizza, pizza-alla-crudaiola, pesto-noci-pizza, pizza-radicchio-noci）のみ。他は 1 ソース | pizza-salad は tomato-sauce + yogurt-sauce の 2 ソース（yogurt は #856 の presence-dab） | `testSupport/requiredSauces.ts` の allowlist に `"pizza-salad"` を追加（B19/B20 と同じ先例） | presence-dab の yogurt を「2 つ目の必須ソース」として allowlist に載せてよいか |
| C-3 | hints.multiSauce:70 | 非 allowlist レシピのヒントは旧実装と byte 同一 | pizza-salad の SAUCE ヒントが tomato 配置後に `ヨーグルトソースも塗ってみよう！`（mozzarella より先） | C-2 と同時に allowlist 追加。あわせて grandma のような pizza-salad 固有のヒント順の pin を追加 | yogurt を cheese より先に促すのが意図か（presence の 1 回タップを先に教える仕様か） |
| B-1 | expansionBatch22:138 | 新 sauce は他の全 sauce と ΔE 25 以上（late4 先例） | kebab-sauce `#d86a35` と buffalo-sauce `#ec5a12`: **ΔE 20.45** | 色は著作物のため案のみ: kebab-sauce を buffalo から離す色へ（例: より暗い赤茶）／または ΔE 基準の例外承認 | 色の変更（デザイン）か、基準例外か |
| B-2 | expansionBatch22:206 | 重複 Gate: 他レシピと Jaccard 0.4 未満、差分 2 以上（B22 は例外なしと明記） | buffalo-cauliflower-pizza と buffalo-chicken: 差は chicken↔cauliflower の 1 食材（対称差 2）、**Jaccard 0.6** | レシピ内容の変更、または重複 Gate の例外承認（承認済みの相手と完全一致が必要） | 派生バリエーションとして例外承認するか、cauliflower の構成を変えるか |
| T-1 | techniques.test:84 / lateAxis:233 | `late-addition` は late で POST_BAKE の工程を持つレシピに必要。late で POST_BAKE なしは banh-mi の 1 件のみ承認済み例外 | banh-mi は技法を要求しない（正しい）。テスト側の導出 `isLateRecipeId` は例外を考慮しない。lateAxis の一覧は banh-mi を含めて書いてしまっている（今回の私の追記） | techniques.test の expected を「late かつ POST_BAKE あり」から導出に。lateAxis の一覧から banh-mi を外す | 承認済み例外の扱いとして問題ないか確認 |
| T-2 | techniques: dexView:54 / runtime:115,143 / techniques:139 | `LATE_ADDITION_RECIPE_IDS`（`testSupport/techniqueAllowlists.ts`）は late-addition を要求するレシピの手書き一覧 | T25 の late 4 件（swedish-kebab, mexican-elote, pizza-asparagi, pizza-salad＝POST_BAKE あり）が未登録 | allowlist に 4 件を追加（新しい行の追従） | allowlist の追記の承認（banh-mi は追加しない） |
| T-3 | finishCatalogGuards:38 | late レシピは FINISH（POST_BAKE）を持つ | banh-mi は POST_BAKE なし（承認済み例外） | テストの例外リストに banh-mi を追加 | 同上 |

## 残り（非重量級 58 ファイル、本セッションの再測定）
- 失敗 **54**（71 から減少）。内訳: C/B/T（Owner 判断待ち）約 17、finding D 2、A 分類（件数・golden・snapshot）約 35。
- 重い 6 ファイルは未再測定: researchAttempt.sim* 33 件（原因は C-1 のみ）、replayAudit 2、deductionGuard.gate 1、deductionProduction.gate 2、hint5Production.gate 1、stagedWhatIf.research 1。

---

# 承認反映後の進捗と、B-1／B-2 の提案・測定（継続セッション 3）

## 実装した承認事項（各 1 コミット、skip・削除・期待値緩和なし）
| 項目 | 内容 | 検証 |
|---|---|---|
| C-1（案 P） | `researchRowsFeedback`: 200 字を超えるときだけ NEGATIVE を `ほかN件×` に集約。POSITIVE は保持、判定・保存形式は不変。`MAX_FEEDBACK_TEXT` を export し、builder の上限を test で一致固定 | researchResultFeedback 22 件 PASS（最悪ケース＝全 sauce 25 種、全 sauce+全 cheese も 200 字内、Notebook が NEW として記録）。sim の旧 FAIL シード（NONE/ONE/seed1）が PASS |
| D | `ALL_LATE_ORDERS` の T25 late 4 件を smore の後ろ・pizza-salad の前へ移動（文言は byte 同一） | lateCatalog* 175 件 PASS |
| C-2 | `MULTI_SAUCE_RECIPE_IDS` に `pizza-salad` を追加 | hints.multiSauce / researchResultRows / sauceKinds.research / wave2 の 78 件 PASS |
| C-3 | 実 reducer 操作とヒントの整合テスト `pizzaSalad.hintFlow.test.ts`（tomato を塗る → ヒントが yogurt → 1 タップ・0.02 で 2 種がそろう → ヒントが mozzarella。yogurt 単独では tomato を先に促す） | 3 件 PASS |
| T-1 | lateAxis の late-addition 一覧から banh-mi を除外。techniques の期待値は「late かつ POST_BAKE あり」から導出 | PASS |
| T-2/T-3 | `LATE_ADDITION_RECIPE_IDS` に 4 件（swedish-kebab, mexican-elote, pizza-asparagi-limone, pizza-salad）。finishCatalogGuards は banh-mi だけ「POST_BAKE も FINISH もない」ことを断言 | techniques 系 148 件 PASS |

## A 分類（件数・位置・新しい行）で追加修正したもの
sauce 数 25／key-free 90／both 50・cheeseOnly 28／credited ordinary 84／ordinary 95／chapter late 20(21)／b21 seeds／recipes 一覧／lunch-rush opt-out 69／progression／ladder bridge（t25 seed 2 件）／discoveryLadder 凍結 1–80／materialShop の契約行 7 件／B19 の除外／selectableHint の 35 上限（swedish-kebab-pizza）／IngredientTray の家族選択（fruit が lime で 7 件になり 1 ページ 6 枠を超えたため、1 ページに収まる家族を動的に選ぶ）。

## 保留（承認待ち）
- **M-1 `HintSheet.hint5.test.tsx:183`（mexican-elote k=2「クリームチーズ」）は誤検知**。画面は「サワークリーム（購入済み）」＋隣の見出し「チーズ」で、`surface()` が要素を区切りなしで連結するため「クリームチーズ」が偶然一致する。実際のヒント漏れではない。直し方は、名前漏れの判定だけをテキストノード単位にする（プライバシー検査の変更にあたるため、自動承認で拒否された。**あなたの明示承認が必要**）。
- **M-2 Phase-2 の BLOCKED 行の出荷記録**（`matcher.test.ts:278`、`discoveryCatalog.test.ts:80`）。T25 の 5 target（swedish-kebab-pizza-pizzadb-p4・banh-mi-pizza-pizzadb-p6・buffalo-cauliflower-pizza-pizzadb-p6・mexican-elote-pizza-pizzadb-p13：BLOCKED_EVIDENCE、pizza-asparagi-limone-pizzadb-p8：BLOCKED_MECHANIC_INTERPRETATION）を「Owner 承認済み」リストに記録する必要がある。根拠候補は T25 Owner 決定表（`codex/t25-preflight-ledger`、2026-11-15）の I-1〜I-7・D-1〜D-3・L-1〜L-3 だが、BLOCKED 行そのものの承認文言はない。承認記録の追加なので、明示承認を待つ。

## B-1: kebab-sauce の色（ΔE 25 は維持。**色は未変更**）
- Owner 決定表 I-4 は `#d86a35` を承認済み（ΔE 基準との衝突は決定表では検討されていない）。
- 実測（CIE76、`expansionBatch22.test` と同じ式）: `#d86a35` の最近傍は tomato-sauce 20.44／buffalo-sauce 20.45／curry-ketchup 20.70／peanut-sauce 24.04。**暖色域は 25 種で埋まっており、ΔE 25 以上を満たす暖色は 2 色だけ**: `#bd7470`（薄い赤茶、最小 25.1＝umeboshi-paste）と `#ff1413`（純赤、25.2＝buffalo-sauce）。
- 自然な色の候補（実測の最小 ΔE と最近傍）: tan `#b98a5e` 19.4(miso)／apricot `#f5c07a` 19.2(olive-oil)／sand `#d8b08a` 18.0(olive-oil)／terracotta `#c4623f` 16.6(miso)／cream-orange `#f2b88c` 15.3(peanut)／caramel `#c68642` 15.0(curry-ketchup)／brick `#b5422a` 9.5(tomato) — いずれも基準未満。
- 比較画像: `docs/reports/screenshots/b25-kebab-sauce-color/kebab-sauce-color-options.png`。
- 注意: 失敗しているのは「buffalo-sauce が他の全 sauce と ΔE 25 以上」の判定（B22 のテスト）。kebab-sauce 自身に対する ΔE ゲートは他にない。
- 選択肢: (1) `#bd7470` を採用（基準 PASS。ただし「ケバブソースらしい色」ではなく umeboshi に近い赤茶。Owner の色変更承認が必要）。(2) `#d86a35` を維持し、tomato／buffalo／curry-ketchup との識別を形（チップのマーク、塗りの質感）で担保する前提で、この ΔE の例外を承認（基準は維持）。(3) 既存 sauce の色変更は出荷済みの見た目を変えるため非推奨。

## B-2: buffalo-cauliflower の構成（Jaccard 0.4 未満は維持。**材料・数量は未変更**）
- 事実: Owner 決定表の **D-2（cauliflower vs chicken の重複例外）は「専用 floret SVG とチキンとの差別化を必須条件」として承認済み**（Jaccard 0.6 は提示済み）。B22 のテストは「この例外は不要」と書かれた過去の記述のまま、全レシピを対象に 0.4 を要求している。
- 構成変更案の実測（全 135 レシピに対する最大 Jaccard、対称差、部分集合・上位集合）:
  - 現行 {buffalo-sauce, mozzarella, gorgonzola, cauliflower}: buffalo-chicken と 0.6（違反 1 件）。
  - **gorgonzola → feta／ricotta／fontina／cheddar／goat-cheese／provolone／cream-cheese／ricotta-salata／swiss-cheese**: 最大 0.333、違反なし。**parmigiano**: black-truffle-pizza と 0.4（不可）。**brie**: speck-e-brie と 0.333。
  - 材料を 1 つ足す（celery／red-onion／garlic／green-onion／bacon）: 0.5（不可。0.4 未満には 3 材料の追加が要る）。
- 副作用の注意: gorgonzola を外すと Research の cohort が変わり、承認済みの non-canonical 42 ID と pesto-noci／quattro-formaggi／buffalo-chicken の「D-2 条件付き」の行を再測定・再承認する必要がある。
- 選択肢: (A) D-2 が承認済みなので、B22 のテストに「承認済み例外ペア（cauliflower vs chicken）のみ」を明示して基準 0.4 は維持（材料・数量は不変）。(B) 構成変更（上記）。(A) が決定表と整合し影響が最小。
