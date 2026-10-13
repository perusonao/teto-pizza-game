# Expansion Batch 7 — Owner Decisions

Status: Owner-approved. Records decisions only; the Batch 7a implementation and its Result Report are
`docs/reports/TETO_EXPANSION-BATCH-7A_Result.md`. Batch 7b (ikura-salmon / shirasu) is **not** covered by this file.

## OD-B7-1 — Batch-scoped production family rows for the three Batch 7a materials

**Decision (Owner).** The three new Batch 7a topping materials may be added to the production topping-family table
(`TOPPING_FAMILY_ROWS`, `src/data/ingredientTaxonomy.ts`) with exactly these L1 families and glyphs:

| ingredient id | nameJa | family | glyph |
|---|---|---|---|
| `mint` | ミント | `herb` | 🍀 |
| `lamb` | ラム | `meat` | 🐑 |
| `sweet-potato` | さつまいも | `vegetable` | 🍠 |

**Basis.** PR #255 lists these three as PROPOSED (the class follows from the canonical identity alone), not NEEDS_REVIEW.
Batches 3-6 added their topping family rows the same way: by a batch-scoped Owner Decision, recorded in the batch's
Result Report. G18 (`hint5Taxonomy.gate`) was re-checked with the three glyphs added: no class symbol equals an
ingredient glyph, no family label contains an ingredient name or id, and the three glyphs / ids / names are unique.

**Scope and non-effects.**

- Applies to `mint`, `lamb` and `sweet-potato` only, and only to Batch 7a. Batch 7b's materials (`salmon-roe`, `shiso`,
  `whitebait`) need their own decision.
- L2 (subfamily) classification is **not** added (no `herb.leaf`, `meat.fresh`, `vegetable.root`).
- It does **not** approve PR #255 / #293 / #296 as a whole, does not promote any other PROPOSED row to production
  authority, and does **not** mean the Human Classification Gate (OD-TAX-7) is complete. B-1 of PR #293 keeps blocking every
  other topping id until its own decision.
- `🍀` is a provisional glyph for `mint` (no unused, apt emoji exists; a dedicated SVG may follow under Ingredient Icons 2.0).
  Owner Human Verification on Preview confirms the glyphs.

**Where it is cited in code.** The three `TOPPING_FAMILY_ROWS` entries carry a comment `OD-B7-1`; the Batch 7a Result Report
repeats this decision in its Taxonomy section.
