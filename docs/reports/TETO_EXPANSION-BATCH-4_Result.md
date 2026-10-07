# Expansion Batch 4 — four recipes (Result Report)

Branch `claude/batch-4-recipe-impl-jtshec` (base `a8184ca` = Production after Batch 3, Deploy #297). No PR yet (Preview Owner HV first).
Authority: Batch 4 PREP / Owner Decisions (candidates and Fresh Audit not redone). The 53-recipe Scale Audit is NOT part of this batch; it runs after Batch 4 Production, before the next recipe addition.

## 1. What shipped

| No. | recipe | key material (ladder step, T4 120 / 60 Pitz) | sauce | counts |
|---|---|---|---|---|
| 48 | `brazilian-catupiry-corn-pizza` | catupiry (44, cheese) | NO_SAUCE | mozzarella 2 / catupiry 3 / corn 2 |
| 49 | `jalapeno-popper-pizza` | jalapeno (45, vegetable) | NO_SAUCE | mozzarella 2 / cream-cheese 1 / bacon 2 / jalapeno 2 |
| 50 | `pizza-feta-eliniki` | feta (46, cheese) | **olive-oil, PAINT_TEMPORARY (not NO_SAUCE)** | olive-oil 1 / feta 3 / black-olive 1 / fresh-tomato 2 / oregano 1 (no mozzarella, as in the source) |
| 51 | `pizza-moscow` | sardine (47, seafood) | NO_SAUCE | mozzarella 2 / onion 1 / salmon 1 / sardine 2 / tuna 2 (8 = the ring) |

All: `lunchRush:false`, no CUT, `ladderCredit` true, permanently key-free Hint, T4 economy (existing tier; no price invented), one dedicated new key material each, a single-member Research cohort. Source compositions are the PIZZA DB rows of the 172 matrix; counts / bake windows are GAMEPLAY CALIBRATION (not source). Order = the append-only ladder's own derived order (recipe-id tie-break): catupiry 44, jalapeno 45, feta 46, sardine 47. Steps 1-43 frozen. No new mechanic, no cheese subdivision (catupiry / feta use the shared 🧀 cheese-category convention).

Taxonomy: jalapeno = vegetable, sardine = seafood, feta / catupiry = cheese (category). Glyphs: jalapeno 🟩, sardine 🎏 (G18-checked, no new Hint class symbol) — **final judgement is the Owner's, on Preview HV**.

Totals (derived from the code; `catalogLedger.test.ts` is the one ledger): **51 recipes / 55 ingredients (toppings 43, cheeses 9) / 47 ladder steps / credited 49 / chapter sizes 6, 11, 16, 18 / Lunch Rush pool 25.** Save schema v2 unchanged.

## 2. Verification (budget respected: no full Vitest, one E2E, no WebKit)

- Batch Validator (manifest declared `planned` first, then `landed` with explicit declarations) + catalog ledger: GREEN.
- Focused Vitest (101 files / 2220 tests): `src/data`, `src/logic/catalog`, `src/logic/discovery` (Hint 5.0 G7, G18, DH4-PROD privacy sweep, DH4-1 audit), materialShop, hint5Economy.sim, ladder append-only, techniques, scoringV2, Lunch Rush exclusion, progression, recipe chapters, w1Activation, dinner collision: GREEN. Only count / list snapshots moved; no gate was relaxed (below).
- `tsc -b`: clean. `oxlint`: 0 errors (the pre-existing warnings only).
- Representative E2E `e2e/expansion-batch4.spec.ts` (pizza-moscow, `iphone-390x844`): PASS — Shop NEW → purchase → Research (no identity leak) → cook with no sauce step → NEW DISCOVERY → Dex. (The first run failed on the spec's own chip name `玉ねぎ` vs the displayed `たまねぎ`; spec fixed, no product change.)

Snapshots that moved (measured values, with the assertions around them intact): DH4-1 audit JSON (category / family / group counts only, regenerated); `deductionGuard.gate` re-measured count of the legacy DH4-2A leak model 95 → 136 (the hardened-guard `toEqual([])` held for every state); `selectableHint` 35-Pitz-cap list gains `brazilian-catupiry-corn-pizza` (3-level recipe); materialShop rows for the four materials; Lunch Rush opt-out list 22 → 26; per-batch id lists (recipes / progression / chapters / cooking profiles).

## 3. Owner HV (Preview)
Screenshots in `docs/reports/screenshots/expansion-batch4/` (390×844). The 390×844 Review Playthrough video is delivered directly, never committed. Check on Preview: the 🟩 (jalapeno) and 🎏 (sardine) glyphs, the feta recipe's olive-oil sauce step, the three NO_SAUCE recipes' lack of a sauce step.
