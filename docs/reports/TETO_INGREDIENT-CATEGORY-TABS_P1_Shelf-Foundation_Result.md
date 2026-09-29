# Ingredient Category Tabs 1.0 — Phase 1 Result (shared pure shelf foundation)

Audited `origin/main`: **`ec7d9a20087de55040d2c66b4c2832dc90d1aa30`** (PR #297 merged; Hint 5.0 label / taxonomy authority is now on main).
Fresh Audit + Design: branch `claude/ingredient-category-tabs-audit` (`docs/reports/TETO_INGREDIENT-CATEGORY-TABS_1.0_Fresh-Audit-Design.md`), audited at `86b48fd`. Re-audited here against `ec7d9a2`: `ingredientTaxonomy.ts` differs only by a doc comment; `ingredients.ts` unchanged; `hintClassDisplay.ts` is now on main.

## Owner Decisions applied (2026-09-29)
OD-CT-1 conditional adopt (Builder tabs only in FREE Cooking with > 6 candidate toppings; none for recipe-specified trays) · OD-CT-2 order 1→3→4→2→5 · OD-CT-3 UI shelf label 「その他」 (Hint keeps 「ちょっと変わった材料」; ids shared, labels per context) · OD-CT-4 REPLACE 「トッピング」 later · OD-CT-5 display filter only (PR #197 contract to be re-audited before the Builder phase; unchanged here) · OD-CT-6 counts deferred to Phase 5 · OD-CT-7 no new family, unclassified fails closed.

## Scope
Pure, unwired. No UI, CSS, e2e, Shop, Ingredients or Builder change.

- `src/data/ingredientShelf.ts` — shelf ids, order, UI labels, `ingredientShelf()`, `filterByShelf()`, `shelvesPresent()`, `auditShelfAuthority()`. Stores no ingredient → shelf table; a topping's shelf is its DH4-1 family, a sauce / cheese's shelf is its category. Imports only `./ingredients` and `./ingredientTaxonomy` (gated).
- `src/data/ingredientShelf.test.ts` — 38 tests, the ten required gates + 62-catalog expansion detection + purity boundary.
- `src/logic/discovery/deductionHint.test.ts`, `deductionGuard.test.ts` — the existing "who imports the taxonomy" allow-lists gain `../../data/ingredientShelf.ts` as a sanctioned read-only reader (test-only edit; no Hint production code touched).

## Shelves
| order | id | kind | UI label | Hint 5.0 label (not imported) |
|---|---|---|---|---|
| 1 | sauce | category | ソース | – |
| 2 | cheese | category | チーズ | – |
| 3 | meat | family | 肉 | 肉系 |
| 4 | seafood | family | 魚介 | 魚介系 |
| 5 | vegetable | family | 野菜・きのこ | 野菜・きのこ系 |
| 6 | fruit | family | 果物 | 果物系 |
| 7 | herb | family | ハーブ・香味 | ハーブ・香味系 |
| 8 | spice | family | スパイス・薬味 | スパイス・薬味系 |
| 9 | other | family | その他 | ちょっと変わった材料 |

「すべて」 is the filter `"all"`, not a shelf (it also returns ingredients that have no shelf).

## Behaviour
- Unknown / hostile id (`""`, `__proto__`, non-string, object with a non-string id) → no shelf. The caller's own `category` is never trusted.
- A topping without a family row → no shelf; `auditShelfAuthority` reports it (`unclassified`), plus duplicate rows, orphan rows, sauce / cheese rows and unknown categories. A shipped catalog must give `ok: true`.
- `filterByShelf(items, "all")` → copy of all items; a shelf → items of that shelf; anything else → `[]`. Input order kept, input never mutated.
- 62 catalog: the gate audits it against the production taxonomy and asserts the reported set equals "toppings with no row". Nothing is guessed; the 23 unclassified toppings stay unclassified until HCG (#293 / #296).

## Not done (by design)
Counts (OD-CT-6), chip component, any screen wiring, ownership filter, PR #197 selection-contract change.
