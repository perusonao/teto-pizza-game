# Discovery Hint 3.0 — H3-1 Pure Logic: Implementation Result (Issue #238)

H3-1 adds the **Selectable Hint pure layer only**. It is **unwired**: nothing in the reducer, the
save, the hint sheet, near-miss or routing imports it. Hint 2.0 / Economy 1.0 remains the runtime
authority.

- Authority: `docs/reports/TETO_DISCOVERY-HINT-3_SELECTABLE_Fresh-Design.md` §20 (OD-H3-1..12), §22
  (OD-H3-13..16) and §23 (restart-gate recheck: PASS).
- Base `main`: `4bf098f` (Merge PR #240, DM-2). No Dinner Mission file is touched.

**Verdict: B. READY WITH CONDITIONS.** The one condition, C-1 in §12, needs an Owner acknowledgment.

## 1. Changed files

| File | Change |
|---|---|
| `src/logic/discovery/selectableHint.ts` | **new**: the pure layer (unwired) |
| `src/logic/discovery/selectableHint.test.ts` | **new**: 56 tests (fact model, Rule W, free key, fallback, pricing, validation, privacy, mutation) |
| `docs/reports/TETO_DISCOVERY-HINT-3_SELECTABLE_Fresh-Design.md` | §22 OD-H3-13..16 (verbatim), §23 restart-gate recheck, status note |
| `docs/reports/TETO_DISCOVERY-HINT-3_H3-1_Result.md` | this report |

Read-only reuse, unchanged: `DISCOVERY_HINT_PRICES`, `MAX_PURCHASABLE_HINT_LEVEL` and
`isHintOnboardingFree` (`hintPurchase.ts`); `buildHintSteps` and `hintKeyIngredientId`
(`hintSteps.ts`).

## 2. Fact model

- **Fact** = one positive ingredient of the target. The id is `ing:<ingredientId>`: stable,
  content-based, and never a position (OD-H3-3).
- **No negative fact of any kind exists**: no `none:`, no "not tomato", no count, no "that's all"
  (OD-H3-7, OD-H3-15). No fact is created to reach a price total.
- **Free**: the key ingredient (`hintKeyIngredientId`), for every paid target (OD-H3-6 / OD-H3-13).
- **Reserved (Rule W)**: never a fact, never shown, and ignored even if a save carries it.
- **Sellable** = distinct − key − reserved = `distinct − 2` for every paid target.
- **Internal reveal order**: category (sauce, cheese, topping), then `requiredIngredients` order. It
  is never displayed.
- **Display order** of revealed chips is the ingredient catalog order, independent of purchase
  order and recipe order.
- **Onboarding** (Dex 0 Margherita, OD-H3-8): all 3 ingredients free, no reserve, and results carry
  `persist: false`.
- **Untrusted input** fails closed. Unknown or hostile recipe ids give `null`. Purchased ids that
  are not a well-formed `ing:` id of this recipe's sellable set are ignored: future kinds
  (`tech:`, `shape:`...), `__proto__`, `constructor`, the key, the reserve and duplicates. Lookups
  use arrays and Sets only, never object keys.

Per recipe (from the module itself):

| Recipe | Free key | Reserved (W) | Sellable sauce | Sellable cheese | Sellable topping | n | Full cost | Cap |
|---|---|---|---|---|---|---:|---:|---:|
| margherita | — | basil | tomato-sauce | mozzarella | — | 2 | 15 | 35 |
| marinara | garlic | oregano | tomato-sauce | — | — | 1 | 5 | 35 |
| quattro-formaggi | gorgonzola | fontina | olive-oil | mozzarella, parmigiano | — | 3 | 35 | 75 |
| genovese | cherry-tomato | mozzarella | pesto | — | — | 1 | 5 | 35 |
| bismarck | egg | mozzarella | tomato-sauce | — | — | 1 | 5 | 35 |
| funghi | mushroom | mozzarella | tomato-sauce | — | — | 1 | 5 | 35 |
| fugazza | olive-oil | oregano | — | — | onion | 1 | 5 | 35 |
| salsiccia | sausage | mozzarella | tomato-sauce | — | — | 1 | 5 | 35 |
| pepperoni | pepperoni | mozzarella | tomato-sauce | — | — | 1 | 5 | 35 |
| napoletana | anchovy | oregano | tomato-sauce | mozzarella | — | 2 | 15 | 75 |
| tonno-e-cipolla | tuna | onion | tomato-sauce | mozzarella | — | 2 | 15 | 75 |
| pizza-bianca | rosemary | olive-oil | — | — | — | 0 | 0 | 35 |
| breakfast-pizza | bacon | egg | tomato-sauce | mozzarella | — | 2 | 15 | 75 |
| capricciosa | oregano | black-olive | tomato-sauce | mozzarella | mushroom, ham | 4 | 75 | 75 |
| meat-lovers | ham | sausage | tomato-sauce | mozzarella | bacon, pepperoni | 4 | 75 | 75 |
| melanzane-pizza | eggplant | basil | tomato-sauce | mozzarella | — | 2 | 15 | 75 |
| parmigiana-pizza | parmigiano | basil | tomato-sauce | mozzarella | eggplant | 3 | 35 | 75 |
| bambino | corn | ham | tomato-sauce | mozzarella | — | 2 | 15 | 75 |
| hawaiian | pineapple | ham | tomato-sauce | mozzarella | — | 2 | 15 | 75 |
| pizza-portuguesa | onion | black-olive | tomato-sauce | mozzarella | ham, egg | 4 | 75 | 75 |
| pesto-tonno | pesto | onion | — | — | tuna, black-olive | 2 | 15 | 75 |
| new-haven-apizza | clam | garlic | olive-oil | parmigiano | — | 2 | 15 | 75 |
| pesto-caprese | fresh-tomato | basil | pesto | mozzarella | — | 2 | 15 | 75 |
| pesto-patate | potato | bacon | pesto | mozzarella | — | 2 | 15 | 75 |
| puttanesca-pizza | capers | garlic | tomato-sauce | — | anchovy, black-olive | 3 | 35 | 75 |

The margherita row is the Dex ≥ 1 model. It is never a paid target, because it is always the first
discovery; at Dex 0 it is the free onboarding.

## 3. Category preference / fallback (OD-H3-14)

A category is a **preference**. Each preference in a batch resolves to the next unrevealed fact of
that category. If that category has none, it resolves to the next unrevealed fact in the fixed
fallback order **sauce → cheese → topping**. If nothing is left, it stops.

The result is always a positive fact, and never the key, the reserve, an owned fact or a repeat.
This is pinned exhaustively: every preference sequence on every recipe.

Examples:
- marinara: `topping` → tomato-sauce
- pesto-tonno (the key is the sauce): `sauce` → tuna

The presentation never states whether a category has anything left.

## 4. Pricing (OD-H3-4 / OD-H3-15)

- The k-th paid fact of a recipe costs **5 / 10 / 20 / 40** (40 thereafter).
- **Cap** = the recipe's current full H1..H4 cost, derived from `buildHintSteps` +
  `DISCOVERY_HINT_PRICES`: **35** for the 9 recipes whose last level is H3, **75** for the 16 at H4.
  No new 3-vs-4 rule was introduced.
- **Batch price = the sum of the same facts bought one by one.** The price depends only on the
  paid count. Pinned for every recipe, paid count 0–5, batch 1–6, and every split of the batch.
  Through the purchase rule, 3 facts at once cost 35, and the same 3 one by one cost 35 and return
  the same facts.
- Affordability is decided on the **requested** batch before anything resolves, so a refusal never
  depends on what is left. A batch larger than what is left charges only for the facts revealed.
- **The cap never binds before a target is exhausted** (pinned). No displayed price can reveal the
  cap.

## 5. Measured 25-recipe total (OD-H3-15: measurement, not authority)

- 24 paid targets: **515 Pitz** (pizza-bianca 0; 7 recipes at 5; 10 at 15; 3 at 35; 3 at 75).
  Hint 2.0 total: 1480.
- 515 is pinned in the tests only as a drift snapshot, labelled "not an economy authority". Economy
  tuning is deferred to after UI and Human Verification (OD-H3-11 / OD-H3-15).

## 6. Rule W (OD-H3-5)

The reserved ingredient equals the ingredient Hint 2.0's H4 withholds, for **25/25** (pinned
against `buildHintSteps` itself, not against a copied table). It is never the key.

Authored-order note: which ingredient is reserved, and on a ladder-step tie which one is the key,
follow `requiredIngredients` order. These are the existing H4 / `hintKeyIngredientId`
authorities. The ties are quattro-formaggi (fontina / gorgonzola) and capricciosa
(black-olive / oregano). Fact ids stay content-based.

## 7. Free key

Every paid target, pizza-bianca included, shows exactly its key as one free chip in its own
category row. Categories: topping 20, cheese 2, sauce 2. A key id in a save is not counted as
paid.

## 8. Privacy tests

**FREE LEAK: rejected (OD-H3-16).** Before purchase, all 24 paid targets have **one identical
structure** once the free key chip is stripped: 3 fixed rows, 3 preferences, price 5,
`paidCount` 0. The FREE LEAK check also scans every field name for
remain / avail / empty / complete / count / reserved / slot / total / left / more / max, and scans
the whole serialized presentation for any unrevealed or reserved ingredient.

Pinned:
- pizza-bianca has 0 paid facts, and its structure is the shared one.
- puttanesca and all 5 slot-count leak recipes share the structure.
- 3 rows and 3 preferences for every target, with a fixed key set. No position fields and no
  ①②③.
- The remaining fact count is not exposed at paid count 0 or 1.

**PAID INFERENCE: allowed.** After buying every fact, the next attempt is `NOTHING_TO_REVEAL`
(no charge, no negative fact). The presentation shows the paid facts plus the key, and never the
reserve.

## 9. Mutation / adversarial tests

**In-test mutants (16).** The privacy, resolver, Rule W and bypass checks run against deliberately
broken implementations, and each one is detected:
- remaining-count field
- per-row availability flag
- empty rows omitted
- preferences filtered by availability
- disabled when nothing to buy
- price shows the cap
- reserve leaked
- unrevealed facts pre-rendered
- slot placeholders
- fallback returns the reserve
- returns an owned fact
- sells the key
- no fallback
- absence fact
- Rule W "first instead of last"
- batch-size pricing (5 + 5 + 5 ≠ 30)

**Source mutants of `selectableHint.ts` (8).** Each was applied temporarily, the suite was run, and
the file was restored (diff-verified). **All 8 were killed:**

| Mutant | Tests failed |
|---|---:|
| reserve sellable | 13 |
| Rule W picks first | 8 |
| no fallback | 6 |
| key not free | 6 |
| affordability on what is left | 1 |
| batch-relative rungs (bypass) | 6 |
| price reveals a zero-fact recipe | 5 |
| onboarding not free | 1 |

## 10. Test counts / gate

| Check | Result |
|---|---|
| Focused `selectableHint.test.ts` | **56 / 56** |
| Full Vitest | **180 files, 3810 passed, 1 skipped** (3754 + 1 skipped at base, +56) |
| `tsc -b` | exit 0 |
| `oxlint` | exit 0 |
| `vite build` | exit 0 (only the pre-existing chunk-size warning) |
| e2e / WebKit | not run: no UI or runtime path changed. The module is not imported by any production file. |
| Human Verification | not required (no UI change, per the policy) |

## 11. Scope verification

`git diff origin/main` touches only the two new `src/logic/discovery/selectableHint*` files and
two docs files. Nothing else changed:
- persistence / save schema
- `discoveryHintPurchases` or any migration
- reducer
- actual Pitz deduction
- HintSheet
- App routing
- CSS
- Shop
- reward / pack sizes
- recipe or ingredient catalogs
- matcher
- near-miss
- Dinner Mission
- Lunch Rush
- #234
- Cooking Steps
- Cutting

No production file imports `selectableHint`.

## 12. Conditions and residual risks

| # | Item | Status |
|---|---|---|
| **C-1** | **pizza-bianca, first purchase attempt.** With 0 sellable facts, a player with ≥ 5 Pitz who tries to buy gets `NOTHING_TO_REVEAL` at 0 Pitz. Every other target reveals a fact. That is a zero-cost signal at the first *action*. It is not the pre-purchase presentation (the gate items all pass), and it cannot be removed without making pizza-bianca a special case (OD-H3-13 forbids that) or selling a non-positive fact (OD-H3-7 forbids that). | **Owner acknowledgment needed** before H3-3/H3-4 wire the outcome. Options: (a) accept it as the consequence of OD-H3-13; (b) decide in H3-4 how the "nothing more" outcome is worded. |
| R-1 | Paid inference is cheap on small recipes. The 7 three-ingredient targets sell 1 fact (5 Pitz), after which "nothing more" follows. | Allowed by OD-H3-16. Revisit in economy tuning. |
| R-2 | Fallback lets a buyer infer "no more in my preferred category" after paying. | Allowed (paid inference). Only positive facts are shown. |
| R-3 | Rule W and key ties depend on authored order. | Existing authorities, pinned (reserve = H4 withheld, 25/25). |
| R-4 | The 515 snapshot will change whenever recipes change. | Test comment marks it as a measurement. Update it with the data. |

## 13. H3-2 plan (not started)

Persistence only, still unwired to UI:

- A new optional top-level `discoveryHintFacts: Record<recipeId, string[]>` under
  **schemaVersion 2**. Formally verify that 2 can be kept (OD-H3-9).
- The sanitizer reuses this module's fail-closed `ing:` parsing. Forward-compat: unknown recipe ids
  and future fact kinds are kept verbatim. Merge is a per-recipe set union.
- Migration from `discoveryHintPurchases` (read-only legacy):
  - **Grant**: every positive fact the old levels showed (H1 key: already free; H2 sauce; H4
    named ingredients).
  - **Never charge again** for a granted fact.
  - **Never roll back** the price rung: the paid count starts at `max(legacy level, granted
    facts)`.
  - The old H3 count / cheese line has no positive fact equivalent, so it has no fact. It still
    counts toward the rung, so nothing is lost and nothing is re-sold.
- Full Reset, old builds and downgrade are checked against the existing `extractForwardCompatExtras`.
