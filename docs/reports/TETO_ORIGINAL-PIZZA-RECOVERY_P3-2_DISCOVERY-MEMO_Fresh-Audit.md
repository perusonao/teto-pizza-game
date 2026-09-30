# Original Pizza Recovery P3-2 — Discovery Memo (発見メモ) Fresh Audit / Pure Display Model design

- **Audited `origin/main` SHA:** `d7270303b0bb5837119ed00ae75f621ee10e57d0` (fresh fetch; unchanged since P1 merged).
- **Precondition met:** P3-1 is **A. P3-1 PURE MODEL COMPLETE** (branch `claude/p3-1-trial-notebook-model`, `e1d66d1`; REVIVE is the only retry behaviour; OD-P3-13..15 applied; full Vitest 268 files / 5 219 passed).
- **Branch:** `claude/original-pizza-discovery-p3-audit` (docs + read-only tooling). **No `src/` change, no PR.** P3-2 is **not implemented**; P3-3 and every production wiring are not started.
- **Authority:** Owner decisions OD-P3-1..15 (`docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P3_DISCOVERY-ASSISTANCE_Fresh-Audit.md`, "Owner Authority"); Hint 5.0 H5-INV-1..7; current code on main.
- **Companion files**
  - `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_FACT-DISPLAY-MATRIX.json`: the proposed fact → display matrix, machine-readable (gates, four fixed rows, 13 fact rows, 14 invariants).
  - `tools/original_pizza_p3_2_fact_display_audit.mjs`: read-only; checks the matrix against current main (Vite SSR, real Hint 5.0 authority). Output: `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_FACT-DISPLAY_Audit.json`.
- **Verification Policy:** not triggered (audit only, no UI / UX / gameplay change). P3-4 (the Dex wiring) will trigger it.
- **Verdict:** **A. P3-2 PURE DISPLAY MODEL READY** (§12), with two default scope choices to confirm later (§11). No Owner decision blocks the pure model.

## 0. Summary

1. **The memo can be a pure function of the existing Hint 5.0 presentation, and of nothing else.** `hint5Presentation(...)` already builds the privacy-safe view model (board of COMPLETED rungs only, sub-topping classes as families only, legacy owned names, the fixed "complete" line). The memo reads three of its fields and nothing more; it has **no input** for a recipe, a description, a P2 feedback, a Trial Notebook row, a matcher result, a candidate list, a technique ledger or a Pitz balance. So OD-P3-6 / 7 / 8 / 9 are satisfied by construction, not by filtering.
2. **The proposed matrix holds on current main.** The audit tool walked all 25 production recipes through the real ladder authority one rung at a time (151 states), plus forged, legacy and hostile ledgers, and checked 14 invariants: **all PASS, 0 failures** (e.g. 898 prefix cases, 1 172 privacy cases, 547 metamorphic pairs, 66 hostile-ledger cases). The tool is sensitive: deliberately breaking `hint5Ladder.ts` (dropping the STRUCTURE guard, or leaking all rung subjects) makes MX-SUB / MX-PREFIX / MX-PRIVACY fail; the source was restored.
3. **What can be shown, per purchase state** (matrix §9): sauce / cheese / key names (or 「なし」) once their own rung is bought; the ingredient total once STRUCTURE is bought; a family chip per bought SUB_CLASS rung, only after STRUCTURE; the fixed "ここまでのヒントで、推理してみよう！" line once every rung is bought; the names the player already owns from earlier hint versions. **Never:** an unbought rung's content, a sub-topping slot or count before (or without) a bought rung, `next` / price, free-text legacy lines, any recipe identity, any technique, any attempt-derived fact.
4. **Three facts the audit adds that the Owner should know** (none blocks): (a) the memo disappears while a card is not 🎨, because the gate is DISCOVERABLE only; the facts stay in the ledger and return; (b) after STRUCTURE, "ladder complete" vs "a next rung exists" tells the player whether any sub-topping exists, exactly as the HintSheet already does (paid by the 5-Pitz STRUCTURE rung); (c) a full memo is tall (estimate, §10).

## 1. Hint 5.0 fact authority on current main

| Piece | Where | What it is |
|---|---|---|
| Ladder | `hint5Ladder.ts` `buildHint5Ladder` | 1 SAUCE → 2 CHEESE → 3 KEY_TOPPING → 4 STRUCTURE → 5.. SUB_CLASS ①..ⓝ; strictly linear; fail closed when a recipe has no valid roles / taxonomy row |
| Completion records | `HINT5_RUNG_MARKER` + `cls:<id>` | `h5:sauce`, `h5:cheese`, `h5:key`, `h5:structure`; `cls:<ingredientId>` is the SUB_CLASS record. **A rung is COMPLETED by these records only** (OD-H5-M3); legacy facts never complete a rung |
| Answer content | `ladder.rungs[i].subjectIds` | the answer of a rung; shown only for a completed rung. A name-rung board entry is built from the **completion marker**, not from `ing:` ids |
| View model | `hint5Presentation` | `{ kind, onboarding, board, legacyKnownIngredientIds, next, completeText, pitzBalance }`. `board` = COMPLETED rungs only, in ladder order; SUB_CLASS entries only after STRUCTURE is completed even if a `cls:` record exists; a SUB_CLASS entry carries a family view only (`family / symbol / labelJa / lineJa`), never an ingredient id |
| Flag | `hint5Flag.ts` `HINT5_LADDER_ENABLED` | **ON in production**; rollback = `HINT5_LADDER_PRODUCTION_DEFAULT = false` (then the pre-5.0 sheet) |
| Price / purchase | `requestHint5Rung` | SAUCE 10, CHEESE 10, KEY 10, STRUCTURE 5, SUB_CLASS 5; `ALREADY_KNOWN` completes for 0 Pitz when the legacy facts already cover the rung |

Invariants inherited (H5-0): INV-1 (no sub-topping name / glyph unless it is a legacy owned name), INV-2 (class labels never derived from names), INV-3 (**no recipe name / id / description / image**), INV-4 (no undiscovered technique; no rung says "no sauce" while P4-SAUCE is reserved), INV-5 (FREE LEAK: before a purchase the presentation depends only on constants and owned facts), INV-6 (charging), INV-7 (fail closed on taxonomy).

## 2. Purchase / reveal state

- **Per card, not per session.** Facts live in `discoveryHintFacts[recipeId]`. The HintSheet works on one session target at a time (a Dex 🎨 card pins its recipe via `onShowHint(recipeId)`), but every card's ledger accumulates independently. `hint5Presentation` needs only `{ recipeId, discoveredCount, storedFactIds, legacyPurchases, pitzBalance }`, so a memo for any 🎨 card can be built from that card's own ledger without opening its sheet.
- **Today `DexOverlay` receives none of these inputs** (no ledger, no legacy ledger, no discovered count). Threading them is wiring (P3-4), not P3-2.
- **Dex-0 Margherita onboarding** is free and session-only (`onboarding: true`); nothing is persisted, so the memo is empty and must not show (gate G4).
- **`hint5SheetView` (the sheet's own wrapper)** returns null unless the flag is on, the session target is DISCOVERABLE and it is not the onboarding; the memo adopts the same three conditions (G1, G2, G4) plus "is a ladder target" (G3).

## 3. Dex card state (Discovery 2.0)

`recipeDiscoveryState`: `DISCOVERED > DISCOVERABLE > KNOWN_BUT_MISSING_MATERIAL > UNKNOWN`. Owner authority for the memo: **DISCOVERABLE only**; DISCOVERED keeps the formal card; KNOWN_BUT_MISSING_MATERIAL and UNKNOWN show nothing new. The gate takes the state as an input, so the model cannot be wrongly enabled by a caller that forgets the check (matrix G1).

## 4. `discoveryHintFacts` ledger kinds (and what the memo may read)

| Kind | Source | Memo |
|---|---|---|
| `h5:sauce|cheese|key|structure` | Hint 5.0 completion records | via the board only |
| `cls:<ingredientId>` | Hint 5.0 SUB_CLASS record (the id lives in the save only) | via the board's family view only; the id is never read by the memo |
| `ing:<id>` | Hint 3.0 names and Hint 5.0 name rungs | only as `legacyKnownIngredientIds` (owned names not already on the board) |
| `meta:ingredient-total` | Hint 4.0 / Hint 5.0 STRUCTURE | only as the board's STRUCTURE line |
| `attr:group|category|family:*` | Hint 4.0 | not read (coarse facts count for nothing, E3b); their text lines are out of the memo (§11) |
| unknown / future kinds | forward compatibility | ignored, never thrown on (MX-ROBUST: 66 hostile cases) |

## 5. Description privacy invariant

H5-INV-3 forbids displaying a recipe's name, id, **description** or image through a hint surface, and OD-P3-9 forbids partial masking. The memo therefore has no path to `recipe.description` at all (no input), and the P3-2 implementation gate must pin that (MX-INPUT): the module may import only hint5 *types* / the presentation type and the card-state type. The first lane audit showed why masking cannot work (25/25 descriptions name an ingredient, 22/25 carry other clues); that finding stands.

## 6. STRUCTURE / sauce / cheese / key topping / sub-topping family facts

| Fact | Completed by | Shown as | Before purchase | Notes |
|---|---|---|---|---|
| sauce | `h5:sauce` | ingredient chips of the sauce rung | `ソース：？` constant row (or hidden by the screen) | never "no sauce": an empty sauce rung is RESERVED, its row stays UNKNOWN and is indistinguishable from any other (H5-INV-4). Unreachable in production (gate G7) |
| cheese | `h5:cheese` | chips, or 「なし」 when the rung is empty | `チーズ：？` | 「なし」 is paid information |
| key topping | `h5:key` | one chip, or 「なし」 | `キートッピング：？` | |
| STRUCTURE | `h5:structure` | the board's total line (「材料は全部で N 種類」) | `構成：？` | |
| sub-topping family | `cls:<id>` **and** STRUCTURE completed | `サブトッピング①：🥬 野菜・きのこ系` etc., ladder order | **no row, no placeholder, no slot count** | never the id, name, glyph or initial |
| ladder complete | every rung completed | the fixed 「ここまでのヒントで、推理してみよう！」 | absent | |

Why no UNKNOWN sub-topping slot even after STRUCTURE: the number of sub-toppings is `total − sauces − cheeses − 1`, which the player can compute only once those are known; a system-drawn slot would hand that count over earlier (and OD-P3-9 says never before STRUCTURE). The sheet likewise offers one next rung at a time and never the slot total.

## 7. Technique boundary

The memo has no technique input. `discoveredTechniqueIds` is a separate ledger (INV-TQ-NB: discovery code never reads it), the no-sauce technique is revealed only from an ORIGINAL once its affordance is open (INV-TQ-6) and is inert in production (INV-TQ-4). The memo never names a technique and never says a recipe has no sauce (H5-INV-4); the UNKNOWN-row rule for a reserved sauce rung above is what keeps that true.

## 8. The machine-testable matrix

Full form: `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_FACT-DISPLAY-MATRIX.json`.

**Inputs (exhaustive):** `cardState`, `hint5Enabled`, `presentation: Hint5Presentation | null` for the card's own recipe. **Projection:** `board`, `legacyKnownIngredientIds`, `completeText` only.

| Gate | Rule |
|---|---|
| G1 | `cardState !== DISCOVERABLE` → no memo |
| G2 | Hint 5.0 flag off → no memo |
| G3 | not a ladder target (`presentation === null`) → no memo |
| G4 | Dex-0 onboarding → no memo |

| Fact | Ledger record | Bought state that unlocks it | Output | Forbidden |
|---|---|---|---|---|
| sauce names | `h5:sauce` | SAUCE completed | fixed row KNOWN + ids | any id earlier; "no sauce" ever |
| cheese names / none | `h5:cheese` | CHEESE completed | KNOWN ids or NONE | any id or "none" earlier |
| key name / none | `h5:key` | KEY completed | KNOWN id or NONE | any id or "none" earlier |
| total | `h5:structure` | STRUCTURE completed | total line | total earlier; any sub slot / ordinal / count earlier |
| sub family | `cls:<id>` | STRUCTURE + that rung completed | ordinal + family view | id / name / glyph / initial; a slot placeholder; a candidate list, elimination result or count |
| complete line | derived | all rungs completed | fixed text | while any rung is open |
| legacy names | `ing:<id>` | owned | "earlier hints" name chips | a name not owned; completing a rung |
| legacy text lines | `discoveryHintPurchases`, `attr:*` | owned | **not in the Phase 1 memo** | any free-text line |
| `next`, price, Pitz | derived | any | never | all |
| P2 feedback / Trial Notebook | none | n/a | never (OD-P3-6/8) | any attempt-derived fact |
| technique | `discoveredTechniqueIds` | n/a | never | any |
| recipe name / id / description / image | n/a | n/a | never while undiscovered | all |
| unknown / future / malformed | anything | n/a | ignored | throwing; rendering it |

**Audit result against current main** (`…FACT-DISPLAY_Audit.json`): MX-GATE-CARD / FLAG / TARGET (26 cases) / ONBOARDING, MX-PREFIX (898), MX-SUB (241), MX-COMPLETE (151), MX-LEGACY (34), MX-PROJECTION (151), MX-PRIVACY (1 172), MX-FREELEAK (25: nothing bought ⇒ byte-identical for every recipe), MX-METAMORPHIC (547 pairs: equal completed content ⇒ equal projection), MX-ROBUST (66), MX-INPUT (1): **14 / 14 PASS**. One false positive was found and fixed in the tool itself (a recipe id equal to a legitimately bought ingredient id, pepperoni's key topping).

The matrix is the test plan: the P3-2 implementation turns each row into Vitest cases, and each invariant into a property test.

## 9. Proposed pure display model (P3-2, unwired)

Shape (types only; not implemented):

```
memoOf(input: { cardState, hint5Enabled, presentation }): DiscoveryMemo | null
DiscoveryMemo = {
  fixed: [ { row: 'SAUCE'|'CHEESE'|'KEY_TOPPING'|'STRUCTURE',
             state: 'UNKNOWN' }                                    // constant, no id
        | { row, state: 'KNOWN', ingredientIds } | { row, state: 'NONE' }   // CHEESE / KEY only
        | { row: 'STRUCTURE', state: 'KNOWN', lineJa } ],
  subToppings: [ { ordinal, family: { symbol, labelJa, lineJa } } ],   // completed only, ladder order
  earlierHintNames: ingredientIds[],                                   // legacyKnownIngredientIds
  completeLineJa: string | null
}
```

- The four fixed rows are always emitted (constants when UNKNOWN); a screen decides whether to draw UNKNOWN rows. `subToppings` holds only completed entries.
- `null` for any gate failure. No field carries `next`, a price, a recipe, a description, a technique, an attempt or a candidate.
- Module boundary (MX-INPUT, a gate in P3-2): imports limited to the presentation / board *types* and the card-state type; no P2, no Trial Notebook, no matcher, no recipe data, no technique module, no save.
- Tests: the matrix rows and invariants as Vitest + property / fuzz (random prefixes, hostile ledgers, random recipe pairs for the metamorphic property), a serialised-output privacy scan, and a mutation harness in the P1 / P3-1 style.

## 10. UI sizing notes for P3-4 (estimates, not measurements)

From the measured Dex (390×844): locked card 51 px (UNKNOWN) / 99 px (🎨 with its CTA); discovered card 134–183 px. A memo on a 🎨 card adds up to 4 fixed rows + up to 3 sub-topping rows (today's maximum is 3; `maxBoardRows` over the 25 recipes is 7) + one line. At roughly 26 px per row that is about 100–180 px, i.e. a fully revealed 🎨 card could be taller than a discovered card. Recommendations for P3-4: render chips inline (several facts per row), draw UNKNOWN rows only when at least one fact is known (cards without facts keep 51 / 99 px), and consider a collapsed one-line summary with an expander. Only 🎨 cards ever carry a memo, and a typical save has very few of them (the measured seed has 1 of 25).

## 11. Findings, risks and default scope choices

| # | Finding | Severity | Handling |
|---|---|---|---|
| F-1 | The memo vanishes whenever the card is not DISCOVERABLE (e.g. a finite material runs out and the card becomes 🏪). Facts stay in the ledger and the memo returns when the card is 🎨 again; the HintSheet already works only for DISCOVERABLE targets. | low | consequence of the Owner's OD-P3-5 child decision; noted so HV expects it |
| F-2 | After STRUCTURE, the memo shows the "complete" line for a recipe with no sub-toppings and nothing for one that still has rungs, so a player learns whether a sub-topping exists. The HintSheet already discloses this (it offers the next rung or the complete line). Paid by the 5-Pitz STRUCTURE rung. | info | parity with the sheet; the metamorphic check treats "complete" as part of the completed content |
| F-3 | Legacy owned names: `ing:` facts of a card's ledger can include any catalog id the player was sold under Hint 3.0; they are shown by the sheet already (H5-INV-1 legacy exception). | info | included in the memo as "earlier hints" names (default D-2) |
| F-4 | `DexOverlay` has no access to the ledger, the legacy ledger or the discovered count. | wiring | P3-4 |
| F-5 | Rollback (`HINT5_LADDER_PRODUCTION_DEFAULT = false`) must hide the memo too. | low | gate G2 + a flag-off test |
| F-6 | A recipe id can equal a legitimately bought ingredient id (pepperoni). | test hygiene | privacy scans must compare against the set of *unbought* ids (done in the tool) |
| F-7 | Sauce-less recipes are unreachable today (production gate G7). If one ships, its sauce row must stay an ordinary UNKNOWN row. | future | matrix F-SAUCE forbids "no sauce" in any state |

**Default scope choices (recommended; confirm when convenient, none blocks P3-2):**

- **D-1 Legacy free-text lines** (Hint 2.0 grandfathered steps, Hint 4.0 attribute / structure lines) are **not** in the Phase 1 memo: free text cannot be tested as structured rows, and they stay in the HintSheet archive. Adding them later is additive.
- **D-2 Legacy owned names** **are** in the memo as an "earlier hints" list (the same names the sheet shows).

## 12. Implementation slices

| # | Slice | Nature | Depends |
|---|---|---|---|
| **P3-2** | `discoveryMemo` pure display model + matrix-driven tests + property / fuzz + mutation + import / wiring gates | pure, unwired, no HV | this audit |
| P3-3 | Notebook wiring (RESULT notice, Notebook screen, entry points) | UI, HV | P3-1 |
| P3-4 | Dex card memo block (thread the ledger / discovered count into the Dex) | UI, HV | P3-2 |

## 13. Final verdict

**A. P3-2 PURE DISPLAY MODEL READY.** The matrix is proposed, machine-checkable, and holds on current main (14 / 14 invariants, 0 failures). No Owner decision is required to implement the pure model; D-1 / D-2 are recommended defaults. Nothing was implemented; P3-3 and every production wiring were not started.
