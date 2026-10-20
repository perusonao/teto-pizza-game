# Expansion Batch 8 (8b / 8c) — Owner Decisions

Status: Owner-approved 2026-10-20 (Recipe Expansion Fresh Audit approved; implementation and PR creation approved,
**merge waits for the Owner**). Records decisions only. The audit is
`docs/reports/TETO_RECIPE-EXPANSION_NEXT-BATCH_Fresh-Audit.md`; Batch 8a (chilean-napolitana / spanish-chorizo-pizza /
frango-catupiry) is already on main (#557) and is **not** covered here. Tracking Issue: #527 (Batch 8 plan; no new Issue).

## OD-B8-0 — Scope

- The five candidates that already ship on main are **not** added again: `eggplant-ricotta-pizza`,
  `new-zealand-lamb-pizza` (Batch 7a, #492), `chilean-napolitana`, `spanish-chorizo-pizza`, `frango-catupiry`
  (Batch 8a, #557).
- New targets are exactly two: `shirasu-pizza` (PIZZA DB `shirasu-pizza-pizzadb-p3`) and `ikura-salmon-pizza`
  (PIZZA DB `ikura-salmon-pizza-pizzadb-p1`).
- Two PRs, in order: **Batch 8b** (shirasu), then **Batch 8c** (ikura-salmon). 8c starts only after 8b is merged.
- The existing 60 recipes and the 53 ladder steps stay compatible (append-only; Hint 5.0 golden entries unchanged;
  no scoring / economy / Lunch Rush change).

## OD-B8-1 — Ladder (plan A)

| step | materials | key recipe | batch |
|---|---|---|---|
| 54 | `shiso` + `whitebait` | `shirasu-pizza` | 8b |
| 55 | `salmon-roe` | `ikura-salmon-pizza` | 8c |

- Both steps are T4 (120 Pitz first purchase / 60 refill per material), `ladderCredit` true: credited 56 -> 57 (8b),
  57 -> 58 (8c).
- **No star gate** on any of the three materials (they unlock on the Ladder alone). The Batch 6 star gates (OD-420-1)
  are not extended.
- `ikura-salmon-pizza` needs `shiso` (step 54) and `salmon-roe` (step 55): its Research cohort key is `salmon-roe`.

## OD-B8-2 — Production family rows and glyphs (batch-scoped)

The three new topping materials may be added to `TOPPING_FAMILY_ROWS` with exactly these L1 families:

| ingredient id | nameJa | family | glyph (provisional) |
|---|---|---|---|
| `shiso` | 大葉 | `herb` | 🍁 |
| `whitebait` | しらす | `seafood` | 🦑 |
| `salmon-roe` | いくら | `seafood` | 🟠 |

- Glyph basis: Owner direction = shiso leaf / small fish / roe grain, keeping G18 (`hint5Taxonomy.gate`) uniqueness:
  every ingredient glyph, id and name is unique and never equals a class symbol (🥩🌊🥬🪴🧂🍇✨). The natural candidates
  are already taken (🌿🍃🌱☘️🍀 by basil/pesto/oregano/spinach/rosemary/artichoke/parsley/mint; 🐟🐠🐡🎏🍣🍥🦐🦪 by the
  existing fish and shellfish), so the three glyphs are **provisional** emoji, like 🍀 for `mint` (OD-B7-1). 🟠 follows the
  coloured-dot convention (🔴 pepperoni, ⚫ olive, 🟢 capers, 🟤 salami). 🦑 is the weakest fit for 「しらす」.
  A dedicated SVG may follow under Ingredient Icons 2.0 (Style Lock v2); Owner Human Verification on Preview confirms or replaces the glyphs.
- L2 (subfamily) classification is **not** added.
- Scope: `shiso`, `whitebait`, `salmon-roe` only. It does not approve PR #255 / #293 / #296 as a whole, does not promote any
  other PROPOSED row, and is not the Human Classification Gate (OD-TAX-7).
- Where cited in code: the `TOPPING_FAMILY_ROWS` entries carry an `OD-B8-2` comment.

## OD-B8-3 — Process

- Counts and bake windows of the new recipes are GAMEPLAY CALIBRATION (provisional); the Owner confirms them on Preview.
- PIZZA DB live re-check (Issue #527 D4) is still blocked by the network policy (`pizzadb.jp` CONNECT 403); the composition
  is the repository's 172-matrix evidence row and stays provisional until the Owner re-confirms it.
- Merge, Production deploy and any shared-Preview update remain Owner-gated. D2-b, #540 (Draft / HOLD) and the shared
  Preview are not touched.
