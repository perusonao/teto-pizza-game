# Large Catalog UX — LC-R1 Result (Catalog Shelf Authority Reconciliation)

Pure logic + tests + mutation gate. **No runtime wiring**: nothing outside `src/logic/catalog/` imports it; no Builder, IngredientTray, pantry, ShelfChips, search UI, hand capacity, `selectedIngredientId`, Dinner, save, CSS or e2e change. Hint 5, taxonomy, `CATEGORY_ORDER`, 62 activation, Phase 5 counts, #295 and the frozen #272 (`f5b0ab5`) are untouched. No PR.
Human Verification: not applicable (no visible / interaction change; policy §2).

1. **Source:** `origin/main` `2d3357e7cf222646624c8ec49e4930472c0083b1` (unchanged); LC-R0 HEAD `df5202e97f2e8b9206cb6b4fd4984a400c65f092` (unchanged, working tree clean, main…R0 = 0 behind / 3 ahead).
2. **Branch:** `claude/lc-r1-shelf-authority` (cut from the LC-R0 HEAD; the R0 branch is left as is).

## Authority
```
ingredientShelf  = ingredient -> shelf membership  (src/data/ingredientShelf.ts, unchanged)
catalogSource    = the ONLY value importer of ingredientShelf: copies ingredientShelf(id) into CatalogIngredient.shelf
catalogQuery     = OWNED / shelves / text / sort engine; compares the descriptor's `shelf`, classifies nothing
ShelfChips       = presentation (not connected)      workingSet = hand selection (not connected, ignores `shelf`)
```

## Representation and API
- `CatalogIngredient.shelf: IngredientShelfId | null` (type-only import in `catalogTypes.ts`). `null` = unclassified, fail-closed.
- `CatalogQuery.shelves?: readonly IngredientShelfId[]`: undefined / empty = no shelf filter (「すべて」: includes unclassified); otherwise only items whose `shelf` is listed; a `null` shelf never matches; ANDed with text / only / etc. `"all"` is not a shelf id (an `"all"` value matches nothing). No category or family filter, no counts.
- OWNED-only is unchanged (the shelf filter is applied after the owned scope, so LOCKED / NEW-only / unknown ids never appear).
- Sorting / ordering untouched: a shelf query equals the unfiltered result filtered by shelf, for every sort × `zeroStockLast`.
- Search: existing name / reading search, AND-composed with shelves. No new search spec; selection clearing stays LC-R5 runtime.

## Verification
- **29 production parity:** `runtimeCatalog()` shelf == `ingredientShelf(id)` for all 29, none null; independent recount sauce 3 / cheese 4 / topping 22; shelf distribution sauce 3, cheese 4, meat 4, seafood 3, vegetable 8, fruit 1, herb 4, spice 1, other 1 — matches the previous audit.
- **62 catalog (design target, not activated):** independent recount from the JSON + taxonomy table: sauce 10 / cheese 10 / topping 42, classified toppings **19**, unclassified **23** — identical to the previous audit, no drift. Nulls equal exactly `auditShelfAuthority(...).unclassified`. The test-only projection equals `ingredientShelf()` on every id production knows (so it is not a second authority). Unclassified rows appear with no shelf filter (62 rows) and under no shelf (39 rows for all shelves together).
- **Boundary (dependency direction):** only `catalogSource.ts` value-imports `data/ingredientShelf`; `catalogQuery.ts` / `catalogTypes.ts` import the id type only; no catalog module reaches the taxonomy, `hintClassDisplay`, Hint 5 modules or discovery code, and none calls `filterByShelf` / `shelvesPresent` / `auditShelfAuthority` / `ingredientAttributeFamily`; exactly one `ingredientShelf(` call exists in `catalogSource`.
- **ShelfChips future fit:** `shelvesPresent(queryCatalog(...))` and `filterByShelf(result, "all")` work on the output; per-shelf query results equal `filterByShelf` over the owned rows for all 9 shelves. Callers must not filter twice: the chip row derives shelves from the rows, the query applies the chosen shelf once.
- **Hint privacy audit (focused):** `hintDisclosure` reads only the `HintSheetView` SELECTABLE / TARGET shapes. The Hint 5.0 ladder view is a different type (`Hint5Presentation`, `hint5SheetView`) that it does **not** read, so adding `shelf` cannot leak a name or bypass the ladder (test: a ladder-shaped view yields `NO_DISCLOSED_HINTS`). The hand ignores `shelf` completely (scrambled / nulled shelves give an identical working set), and smuggled `shelf` / class keys in `disclosedHints` change nothing. **Open item for LC-4:** because it never reads `Hint5Presentation`, the hint -> hand path does not yet reflect the ladder at all; that needs its own design (OD-B5: re-show only what the ladder displayed, no new k>=2 rule). No Hint 5 change was needed here.
- **Tests:** catalog suite 10 files / 68 tests (new `catalogShelf.test.ts`, extended boundary / query / fixture tests; all LC-R0 tests kept). Full Vitest **243 files, 4795 passed, 1 skipped**.
- **Mutation gate:** **27/27 killed** (20 from R0 + M19 filter ignored, M20 fail-open null, M21 multi-shelf, M22 second membership authority in `catalogSource`, M23 query calls `filterByShelf`, M24 shelf bypasses ownership, M25 hand reads shelf).
- **tsc -b:** clean. **oxlint:** no findings in changed files (2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts`). **vite build:** OK, no catalog symbol in `dist/`.
- **Fixture change:** synthetic fixture ids (no production classification) now carry test-assigned `shelf` values (sauce / cheese category shelves, toppings in the PR #255 proportions, exact at 105 / 179); the LC-R0 `familyById` side table is gone. Fixture data only, never an authority.

## Changed files (all under `src/logic/catalog/`, plus the mutation tool and docs)
`catalogTypes.ts`, `catalogSource.ts`, `catalogQuery.ts`, `testSupport/largeCatalogFixtures.ts`, `catalogBoundary.test.ts`, `catalogQuery.test.ts`, `catalogText.test.ts`, `workingSet.test.ts`, `largeCatalogFixtures.test.ts`, new `catalogShelf.test.ts`, `tools/large-catalog-ux/mutation-check.mjs`, this report, one handoff status line. Runtime diff: none.

## Remaining risks
- 62 catalog: 23 of 42 toppings only reachable under 「すべて」 until HCG (#293 / #296).
- LC-4: hint -> hand for the Hint 5 ladder is undesigned (see above).
- `shelves` is an array while the chip UI is single-select; the multi-shelf input is future-proofing for group-level hints and is not exposed to any UI.
- Synthetic fixture shelves are test data; do not read them as production classification.

## R2 prerequisites
All met for the logic side: single membership authority; query / hand pure and tested; OD-1 gate authority (`roundKind === "FREE_COOK"` and `dinner === null`) specified. R2 still needs the capacity decision path (9 vs 12, Human Feel) and must keep capacity inert until R3–R5 exist.

**Recommended next action:** Owner review of this branch (open a PR only on request), then R2 on Owner go.
