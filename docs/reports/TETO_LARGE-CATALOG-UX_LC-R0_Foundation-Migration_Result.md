# Large Catalog UX — LC-R0 Result (fresh-main migration foundation)

Pure, **unwired** logic + tests + one data file + one tool. No production code, UI, CSS, e2e, save, economy, scoring, Hint, Shop, Inventory or Dinner change. No PR.
Human Verification: not applicable (no visible / interaction change; policy §2).
Authority: `docs/PROJECT_HANDOFF.md` "Large Catalog UX — current SSOT" and `docs/reports/TETO_LARGE-CATALOG-UX_Fresh-Rebase-Revision-Gate.md` (§3, §13, §17: OD-1 / OD-2 / OD-4).

1. **Source main:** `2d3357e7cf222646624c8ec49e4930472c0083b1` (fresh fetch; unchanged).
2. **Branch:** `claude/lc-r0-fresh-main-foundation` (from `origin/main`; the two docs-only Gate/Decision commits are cherry-picked so the SSOT travels with it). Porting source PR #272 `f5b0ab5` is frozen: not rebased, changed, force-pushed or merged.
3. **HEAD:** see the branch tip (`git rev-parse claude/lc-r0-fresh-main-foundation`).

## Migrated (`src/logic/catalog/`, all new; nothing on main imports it)
| File | Change vs #272 |
|---|---|
| `workingSet.ts` (+test) | as-is except: no `family` on descriptors; hints = named ids only |
| `catalogQuery.ts` (+test) | **revised**: `category` / `families` filters and `familyCounts` removed; keeps OWNED-only, text, favorites / recent / in-stock, sorts, zero-stock-last. Exports exactly `ownedCatalog`, `queryCatalog` (pinned by a test) |
| `catalogTypes.ts` | **revised**: `family`, `CatalogFamilyId`, `CatalogFamilyTable` removed. `CatalogCategory` stays (working-set step category, not membership) |
| `catalogSource.ts` | **revised**: no injected `familyOf`; reads `INGREDIENTS` only |
| `catalogText.ts` (+test) | as-is (descriptor without `family`) |
| `usageSignals.ts` (+test) | as-is |
| `dexActionSummary.ts` (+test) | as-is (permanent-ownership basis, imports nothing) |
| `hintDisclosure.ts` (+test) | **trimmed**: only `disclosedHintsFromSheetView` / `NO_DISCLOSED_HINTS` (named ingredients the sheet showed). `attributeFactIds`, `withDisclosedAttributes`, `libraryFilterForAttribute`, `LibraryFilter` removed |
| `catalogBoundary.test.ts` | **revised**: value imports allow `data/ingredients` and `data/ingredientShelf` (the "taxonomy is injected / ingredientShelf forbidden" rule is retired); taxonomy, `hintClassDisplay`, recipes, matcher, hint model, state, mission stay forbidden; B-6 "no production importer" kept |
| `catalogScale.test.ts`, `largeCatalogFixtures.test.ts`, `testSupport/largeCatalogFixtures.ts` | fixtures kept (29 / 37 / 37-mixed / 40 / 62 / 105×101 / 105×172 / 179); descriptors carry no membership; PR #255 proposed family proportions kept as fixture-only `familyById` beside the catalog |
| `tools/large-catalog-ux/mutation-check.mjs` | ported; retired M4 / M5 (family mapping); added M5r (search ignored), M17 (Hint 5 display import), M18 (counts function reappears) |
| `docs/reports/data/TETO_LARGE-CATALOG-UX_SCALE-MODEL.json` | ported unchanged (data the fixture test pins against) |

## Intentionally not migrated (left on the frozen #272 SHA as history)
Owner-Decision-Gate / Fresh-Design / LC-1 Gate / LC-1 Result docs (contain counts wireframes, tray "family タブ", 棚バー-with-🔎, Shop/Inventory-as-library-modes; superseded by the current SSOT), the 39 screenshots (pre-Phase 3/4/#304 UI), `PROJECT_HANDOFF` #272 addendum, `UI-MEASUREMENTS` / `GATE-MEASUREMENTS` JSON, `measure.spec.ts` / `gate.measure.spec.ts` / `playwright.measure.config.ts` (measure the old UI), `tools/large_catalog_ux_scale_model.py` (generator needs those measurement files; the committed model JSON is ported instead), Owner-decisions JSON (the handoff SSOT is the authority).

## Stale authority removed
category + family two-axis filter; free-string `CatalogFamilyId`; injected taxonomy membership; the `ingredientShelf` import prohibition; `familyCounts`; counts wireframes; old screenshots; stale handoff addendum; Builder tray family chips (never present in the code).

## Status
- **workingSet:** ported, pure, unwired; `capacity` remains an argument (9 vs 12 undecided, Human Feel at the hand slice); equivalence with `trayIngredientsFor` tested on the real catalog; **not connected to runtime; production not limited**.
- **catalogQuery:** OWNED-only foundation without any membership axis; LC-R1 adds a single `shelves` input backed by `ingredientShelf`.
- **privacy:** the #272 regressions carry over (extra keys — target / matcher / near-miss / answer / reserve / Dinner target — cannot change the working set; unrevealed facts and Rule W reserve never appear; deduction lines never become named ingredients; Dex summary never reads stock; static import boundary). Hint 5.0 ladder view fields are **not yet audited** against `hintDisclosure` (deferred to LC-4; OD-B5, no new k>=2 rule).
- **scale fixtures:** all 8 populations reproduce and match the committed model; one full pass is deterministic and under the ceiling.

## Verification (on this branch)
- `vitest run src/logic/catalog`: 9 files / 51 tests pass.
- Full `vitest run`: **242 files, 4776 passed, 1 skipped**.
- `tsc -b`: clean. `oxlint`: 0 findings in the new files (2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts`, untouched).
- `vite build`: OK; no catalog symbol in `dist/`.
- Mutation gate `node tools/large-catalog-ux/mutation-check.mjs`: **20/20 killed**; sources restored (clean tree).
- CI: no PR was opened, so GitHub CI has not run on this branch.

## Diff scope
Added only: `src/logic/catalog/**` (9 modules/tests + `testSupport`), `tools/large-catalog-ux/mutation-check.mjs`, `docs/reports/data/TETO_LARGE-CATALOG-UX_SCALE-MODEL.json`, this report, one handoff status line; plus the two cherry-picked docs commits. No existing file edited except `docs/PROJECT_HANDOFF.md`.

## R1 prerequisites (all met)
`ingredientShelf` on main and unchanged; catalog descriptors have no membership; boundary test already allows `data/ingredientShelf`; fixtures expose `familyById` to derive synthetic `shelf` values; tests to add are listed in the Gate report §13 (shelf-equivalence with `filterByShelf` on production / 62 / harness fixtures, unclassified only under 「すべて」, no counts symbol).

## Remaining risks
- 62 catalog: 23 of 42 toppings unclassified (fail-closed); pantry chips need HCG (#293 / #296) before 62 is activated.
- Hint 5 ladder × `hintDisclosure` unaudited (LC-4).
- The ported scale-model JSON embeds pre-Phase 3/4 UI projections; only its `gate.fixtureTrayMatrix` / dex chapter data are used.
- No CI run until a PR exists (Owner decides).
