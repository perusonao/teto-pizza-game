# Wave 2 — Owner Decision Ledger (Owner Authority)

Recorded 2026-09-27 from the Owner's approval of the W2-A Owner Decision Gate
(`docs/reports/TETO_WAVE2_W2A_OWNER-DECISION-GATE.md`). This file is the authority for these
decisions; the gate report is the evidence. Machine checks: `tools/progression2_wave2_w2a_gate.py --check`.

| ID | Status | Decision |
|---|---|---|
| **OD-W2-1** | **APPROVED** | W1 unlock steps 1–24 are frozen. Wave 2 ingredient unlocks are appended from step 25 onward. The next unlock of every existing W1 save must not change. (Verified: `checks.L-1..L-7`, W1 prefix sha256 `0e8f352b…d58f` in `TETO_WAVE2_W2A_OWNER-GATE.json`.) |
| **OD-W2-2** | **APPROVED** | Keep the current price / chapter rules (`MATERIAL_PRICE_TIERS` T1 1–5, T2 6–14, T3 15–29, T4 30+; chapter = price tier of the recipe's key step). |
| **OD-W2-3** | **APPROVED** | Wave 2 order: W2-A → W2-C → W2-D. |
| **OD-W2-4** | **APPROVED** | A recipe without dough evidence keeps no CUT, same as the New Haven rule. |
| **OD-W2-5** | **APPROVED (scoped)** | The 7 topping categories W2-A needs are in scope now (arugula / bell-pepper / zucchini = vegetable, chicken / prosciutto-crudo = meat, shrimp = seafood, parsley = herb), subject to a fresh consistency check with PR #255 (done in the Authoring Gate report §3.3: consistent). |
| **OD-W2-6** | **APPROVED** | W2-A recipe values and ingredient art are fixed in a dedicated Authoring Gate before implementation. Undecided values are never guessed into production. |
| **OD-W2-7** | **APPROVED** | All 5 review items take option (a): brazilian-calabresa black-olive; vongole olive oil as the base (PAINT_TEMPORARY, fugazza / New Haven style); prosciutto-funghi kept as `prosciutto-funghi`; jamon-serrano adopted with the pinsa-romana reservation (DOUGH_VARIANT required later); prosciutto-crudo / arugula placed before BAKE. |
| **OD-W2-8** | OPEN | Sauce-less scoring policy — decided in W2-C. |
| **OD-W2-9** | OPEN | Multi-spread second-layer gesture — decided in W2-D. |
| **OD-W2-LC** | **APPROVED** | LC-2 / LC-3 are not required before W2-A. Large Catalog UX continues as a parallel lane; large-catalog tray support should be complete before Wave 3. |

Authoring decisions still open for W2-A are listed in
`docs/reports/TETO_WAVE2_W2A_AUTHORING-GATE.md` §12 (OD-W2A-A1…A8).
