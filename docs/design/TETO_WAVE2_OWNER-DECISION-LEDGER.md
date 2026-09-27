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
| **OD-W2-5** | **APPROVED (scoped)** | The 7 topping categories W2-A needs are in scope now (arugula / bell-pepper / zucchini = vegetable, chicken / prosciutto-crudo = meat, shrimp = seafood, parsley = herb), subject to a fresh consistency check with PR #255 (done in the Authoring Gate report §2.1: consistent). |
| **OD-W2-6** | **APPROVED** | W2-A recipe values and ingredient art are fixed in a dedicated Authoring Gate before implementation. Undecided values are never guessed into production. |
| **OD-W2-7** | **APPROVED** | All 5 review items take option (a): brazilian-calabresa black-olive; vongole olive oil as the base (PAINT_TEMPORARY, fugazza / New Haven style); prosciutto-funghi kept as `prosciutto-funghi`; jamon-serrano adopted with the pinsa-romana reservation (DOUGH_VARIANT required later); prosciutto-crudo / arugula placed before BAKE. |
| **OD-W2-8** | OPEN | Sauce-less scoring policy — decided in W2-C. |
| **OD-W2-9** | OPEN | Multi-spread second-layer gesture — decided in W2-D. |
| **OD-W2-LC** | **APPROVED** | LC-2 / LC-3 are not required before W2-A. Large Catalog UX continues as a parallel lane; large-catalog tray support should be complete before Wave 3. |

## W2-A Authoring decisions (Owner, 2026-09-27)

Evidence: `docs/reports/TETO_WAVE2_W2A_AUTHORING-GATE.md` §12–§13. The approved values live in
`tools/wave2-w2a/w2a_authoring_candidates.json` (every former OWNER_REQUIRED field is now
`APPROVED_OWNER`). W2-A0 is complete.

| ID | Status | Decision |
|---|---|---|
| **A1** | **APPROVED** | Recommended minCount (flammkuchen bacon 3 / onion 2; ratatouille-pizza eggplant 2 / zucchini 2 / bell-pepper 2; pesto-vegetariana zucchini 2 / bell-pepper 2 / eggplant 2; prosciutto-funghi prosciutto-crudo 2 / mushroom 3). No W2-A-specific scoring rule; consistency with W1 is kept. |
| **A2** | **APPROVED** | Recommended bakeTarget (flammkuchen 56–76, pesto-pollo 50–70, pesto-vegetariana 50–70, prosciutto-funghi 58–78). No W2-A-specific bake rule. |
| **A3** | **APPROVED** | The 9 Japanese description drafts. Human Verification checks display, line breaks and natural meaning. |
| **A4** | **APPROVED** | 「ブラジリアン・カラブレーザ」 is the official name, never shortened. W2-A2 Layout Contract keeps every recipe name within 2 lines at 390×844 / 360×800 (and 390×664 / 360×640 where possible). |
| **A5** | **APPROVED** | White sauce colour `#eef1f4`. No extra CSS / outline in W2-A; an outline is a follow-up only if Human Verification finds a visibility problem. |
| **A6** | **APPROVED** | The 6 emoji (arugula 🥬, shrimp 🦐, chicken 🍗, bell-pepper 🫑, zucchini 🥒, fromage-blanc chip 🥛). Prosciutto-crudo and parsley get dedicated in-code visuals like capers / clam; no new external asset dependency. |
| **A7** | **APPROVED** | No special move to the front of the tray; the deterministic INGREDIENTS order is kept. Up to 3 taps to the first new ingredient is accepted in W2-A. Navigation for large catalogs stays in Large Catalog UX. |
| **A8** | **APPROVED** | The phase2 tool drift is added to Issue #260 as a separate scope; #260 never blocks W2-A. |
