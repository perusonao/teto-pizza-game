# Expansion Batch 5 — two recipes (Result Report)

Branch `claude/batch-5-screening-prep-k0nzzy` (base `4956bb8` = main after PR #415, which is docs-only on top of Production `1d601b8`). No PR yet (Preview Owner HV first).
Authority: Batch 5 Candidate Screening + Owner Decisions + the final PREP (candidates, PREP and the 53 Scale Audit are not redone). Scope: 51 -> 53 recipes, exactly these two.

## 1. What shipped

| No. | recipe | key material (ladder step, T4 120 / 60 Pitz) | sauce | counts (bake) |
|---|---|---|---|---|
| 52 | `pizza-bianca-ricotta` (ピッツァ・ビアンカ・リコッタ) | ricotta (48, cheese, 🧀, no cheese subdivision) | olive-oil, PAINT_TEMPORARY (existing mapping) | olive-oil 1 / mozzarella 2 / ricotta 3 / rosemary 2 (54-74) |
| 53 | `pizza-overload` (ピザオーバーロード) | hot-dog (49, topping, family meat, 🍢) | tomato-sauce, PAINT | tomato-sauce 1 / mozzarella 2 / pineapple 2 / ham 1 / bacon 1 / hot-dog 2 (58-78) |

Both: `lunchRush:false`, no CUT, `ladderCredit` true, permanently key-free Hint, one dedicated new key material, a single-member Research cohort, `requiredIngredients` order as fixed in the PREP (key last for pizza-overload: Rule W reserve = bacon; reserve of pizza-bianca-ricotta = rosemary). Evidence: `bianca-pizzadb-row` / `pizza-overload-pizzadb-p7` (172 matrix). Counts / bake windows are GAMEPLAY CALIBRATION (not source). Ladder order is the append-only rule's own derivation (recipe-id tie-break): ricotta 48, hot-dog 49. Steps 1-47 frozen. No new mechanic, no new sauce ingredient / type, no Research or economy change.

Totals (code-derived; `catalogLedger.test.ts` is the one ledger): **53 recipes / 57 ingredients (toppings 44, cheeses 10; shelf meat 9) / 49 ladder steps / credited 51 / chapter sizes 6, 11, 16, 20 / Lunch Rush pool 25 / NO_SAUCE 10.** Save schema v2 unchanged.

## 2. Verification (budget respected: no full Vitest, one E2E, no WebKit)

- Batch Validator (`planned` was clean on main in the PREP; now `landed`) + catalog ledger: GREEN.
- Focused Vitest (88 files / 1845 passed, 1 skipped as before): `src/data`, `src/logic/catalog`, `src/logic/discovery` (Hint 5.0 G7 / G17 / G18, DH4-PROD, DH4-1 audit), materialShop, ladder append-only, Lunch Rush exclusion, progression, recipe chapters, dinner collision: GREEN. Only count / list snapshots moved; no gate was relaxed.
- `tsc -b`: clean. `oxlint`: 0 errors (pre-existing warnings only).
- Representative E2E `e2e/expansion-batch5.spec.ts` (pizza-overload, `iphone-390x844`): PASS — Shop NEW -> purchase -> Research (no identity leak) -> cook with the tomato-sauce step -> NEW DISCOVERY -> Dex.

Snapshots that moved (measured, assertions around them intact): DH4-1 audit JSON (category / family / group counts only, regenerated); `deductionGuard.gate` legacy DH4-2A leak count 136 -> **116** (the hardened `toEqual([])` held for every state; matches the PREP's prediction); materialShop rows for the two materials; Lunch Rush opt-out list 26 -> 28; per-batch id lists (recipes / progression / chapters / cooking profiles). The 35-Pitz-cap list is unchanged (both recipes are 4-level, cap 75).

## 3. Owner HV (Preview)
Screenshots in `docs/reports/screenshots/expansion-batch5/` (390x844). The 390x844 Review Playthrough video is delivered directly, never committed. Check on Preview: the 🍢 glyph (hot-dog) and its 肉系 class, the NEW 120 Pitz rows for ricotta / hot-dog, the Research entries naming only the unlock ingredient, the olive-oil sauce step of pizza-bianca-ricotta, the tomato-sauce step of pizza-overload, and the distinct names of the two Bianca recipes.
