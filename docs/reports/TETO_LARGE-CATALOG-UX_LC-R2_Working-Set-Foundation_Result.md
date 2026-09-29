# Large Catalog UX — LC-R2 Result (Working Set / Hand Foundation)

Pure logic + tests + one manual measurement harness + its committed numbers. **No runtime wiring**: nothing outside `src/logic/catalog/` imports it. No Builder / IngredientTray / pantry / ShelfChips / search / counts / sticky / capacity enforcement / Dinner / save / CSS / e2e-suite change. #295, taxonomy, 62 activation, Phase 5, `CATEGORY_ORDER` and the frozen #272 (`f5b0ab5`) untouched. No PR.
Human Verification: not applicable (no visible / interaction change; policy §2).

1. **Source:** `origin/main` `2d3357e7cf222646624c8ec49e4930472c0083b1` (unchanged); LC-R1 HEAD `3c408eabb2c529a9cf0d4483fd40da3fbcc49954` (unchanged; main…R1 = 0 behind / 4 ahead; tree clean; `ingredientShelf` authority identical to main).
2. **Branch:** `claude/lc-r2-working-set-foundation` (from the LC-R1 HEAD).

## What was added (`src/logic/catalog/`)
| Module | Purpose |
|---|---|
| `freeEligibility.ts` | `isLargeCatalogEligible(round)` = `isFreeCookingRound(round)` (`roundKind === "FREE_COOK"`) **and** `round.dinner === null` (OD-1). Never `freeCook` alone, never `recipeFreeTray`; absent / unknown `dinner` fails closed |
| `handPolicy.ts` | `HAND_CAPACITY_CANDIDATES = [9, 12]`, `HAND_ENFORCEMENT_ENABLED = false`, `handCapacityFor()` → while enforcement is off the capacity always fits every owned ingredient, so the hand is inactive (= today's tray) |
| `handSession.ts` | `HandSession` (per-category pins, session-only) with `addToHand` / `removeFromHand` / `replaceHand` / `pruneHand` / `sanitizeHandSession`; `resolveHand()` (returns `null` = feature OFF, keep the current paged tray); `selectionAfterVisibleChange()` (PR #197 as a pure rule); `recentlyAcquiredIds()` |
| `workingSet.ts`, `usageSignals.ts` | unchanged (no `shelf`, no taxonomy, no Hint authority) |
| tests | `hand.test.ts` (27 tests), boundary additions |
| harness | `tools/large-catalog-ux/hand-capacity.measure.spec.ts` + `playwright.hand-capacity.config.ts` (manual; not in CI) → `docs/reports/data/TETO_LARGE-CATALOG-UX_HAND-CAPACITY-COMPARISON.json` |

## Contracts
- **FREE eligibility / Dinner exclusion:** tested on real reducer states: FREE (`START_FREE_COOK`) eligible; Dinner (`DINNER_START`, `freeCook:false`, `roundKind:"DINNER"`) **not** eligible even though the tray's `recipeFreeTray` is true there; guided, Lunch Rush, forged flags, FREE-kind with a dinner session, and missing `dinner` are all ineligible. `resolveHand` returns `null` for them, so the existing paged tray (guided recipe-only, FREE / Dinner all-owned 22 toppings) is untouched. Note (finding): `createInitialGameState` with an empty Dex is itself a `FREE_COOK` round in phase `ORDER`, so the R3 wiring must combine this gate with the cooking (PREPARE) screen.
- **Capacity 9 / 12:** `selectWorkingSet` supports both (active on 22 toppings, 9 or 12 items, catalog-order fill, deterministic). **Production enforcement: OFF** — with `handCapacityFor`, the hand equals today's tray for every category and both candidates (tested against `trayIngredientsFor`), `overflowIds` empty; no owned ingredient can become unreachable.
- **Inventory 0:** explicit pins stay on the hand at zero stock; automatic sources (fill / recent / new / favorite / hint) skip zero stock (LC-OD-17); starters are `UNLIMITED` and included.
- **Initial hand (no recommendation engine):** order = placed > pinned (previous hand) > hint (none yet) > favorite > recent > new > catalog fill, OWNED only, deterministic; unowned pins ignored; first launch = catalog-order fill of owned; after "reload" (session not persisted) the same deterministic fill.
- **Selection safety (#197):** `selectionAfterVisibleChange(selected, before, after)` clears only a selection that was visible and no longer is; other-category selection is left alone. It is independent of the pantry's picks (OD-2): the hand API has no picks state.
- **Save impact:** none. No save field, no migration, no read of persistence in production code. (Tests read `loadSave` only to prove acquisition order.)
- **Boundary:** `state/roundKind` may be value-imported only by `freeEligibility.ts`; `workingSet` / `handSession` / `handPolicy` / `freeEligibility` contain no `shelf`, taxonomy or `ATTRIBUTE_FAMILIES`; the gate contains no `freeCook` / `recipeFreeTray`.

## Human Feel readiness (measured, Chromium emulation; seeds the first N toppings = the tray a hand of N shows)
Harness numbers (`TETO_LARGE-CATALOG-UX_HAND-CAPACITY-COMPARISON.json`), TOPPING step of FREE Cooking:

| viewport | stage Ø | dock / tray panel | chip (w×h) | page 1 | page 2, hand 9 | page 2, hand 12 | today's tray (22) |
|---|---|---|---|---|---|---|---|
| 390×844 | 290 | 174 / 170 | 118×64 | 6 chips, 2 rows, pager 1/2 | 3 chips, 1 row | 6 chips, 2 rows | pager 1/4 |
| 360×800 | 273.6 | 174 / 170 | 108×64 | same | same | same | 1/4 |
| 390×664 | 269.1 | 162 / 158 | 118×58 | same | same | same | 1/4 |
| 360×640 | 245.1 | 162 / 158 | 108×58 | same | same | same | 1/4 |

Finding: **stage diameter, dock height, tray height, chip size and pager row are identical for 9, 12 and today's 22** at all four viewports (no page scrolls), because the dock already reserves two chip rows plus the pager whenever a step has more than 6 items. The difference is purely content: 9 → page 2 holds 3 chips and leaves 3 free grid cells (room for an in-grid 食材庫 tile, no extra row); 12 → two full pages (the pantry entry would sit in the existing pager row, Δ 0px). Still needs a real-device thumb / accidental-tap check; the harness is re-runnable.

## Verification
- `vitest run src/logic/catalog`: 11 files / 98 tests. Full Vitest **244 files, 4823 passed, 1 skipped** (run before the final test-data tweak; the tweak re-ran green in its file).
- `tsc -b` clean; `oxlint` no findings in changed files; `vite build` OK; no hand / eligibility symbol in `dist/`.
- Mutation gate: **34/34 killed** (27 + M26 Dinner-eligible, M27 dinner-null ignored, M28 enforcement on, M29 gate ignored, M30 unowned accepted, M31 selection never clears, M32 order re-sorted; M32 initially survived on sorted test data and was fixed by a stronger test).
- Harness run: 1 passed (Chromium).

## Runtime diff
None. Changed/added: `src/logic/catalog/{freeEligibility,handPolicy,handSession,hand.test,catalogBoundary.test}.ts`, `tools/large-catalog-ux/{hand-capacity.measure.spec.ts,playwright.hand-capacity.config.ts,mutation-check.mjs}`, the comparison JSON, this report, one handoff line.

## Persistence audit (OD-R2-3 input)
| Option | What | Cost |
|---|---|---|
| A. session / round-local | pins live in App / GameScreen state; lost on reload, kept across FREE rounds in a session | none; matches LC-OD-5 |
| B. existing save field | nothing to store pins in; but **`ownedIngredientIds` is already acquisition-ordered** (purchase appends; load keeps the order after starters), so a "recently acquired" tier can be *derived* without any schema change (`recentlyAcquiredIds`, tested with the real purchase + load path) | none; semantics = recently acquired, not "never used" |
| C. new save field | persist pins | schema version bump / migration / forward-compat; deferred to LC-9 |

## Remaining risks
- Enforcement flag must flip only with R3–R5; a test pins it `false`.
- Initial-state gotcha: an empty-Dex initial state is `FREE_COOK` in `ORDER` (R3 must require the cooking screen).
- Reload loses pins under option A; the hand then reverts to the deterministic fill.
- 62 catalog: 23 unclassified toppings (HCG #293 / #296); Hint 5 ladder → hand (LC-4) undesigned.

## Owner Decisions (not blocking R3)
- **OD-R2-1 capacity 9 vs 12** (LC-OD-4, open): geometry is identical; 9 leaves an in-grid entry cell on page 2, 12 gives full second page and keeps the entry in the pager row. **Recommendation: 12**, entry in the existing pager row (Δ 0px, more items within reach: 12 of 22 toppings) — final call after a real-device check with the harness numbers; needed before enforcement is enabled (R5/R6), not before R3.
- **OD-R2-2 initial hand:** already decided by the approved LC-OD order (placed > pinned > hint > favorite > recent > new > fill; no Dinner seeding; zero stock only by explicit pin). Not re-asked. One small confirmation: derive the "new" tier from save acquisition order (no schema change, "recently acquired") — **Recommendation: adopt.**
- **OD-R2-3 persistence:** already decided by LC-OD-5 (session-only; LC-9 revisits). Not re-asked; **Recommendation: A + derived B**, C only at LC-9.

## R3 prerequisites
All logic prerequisites met (FREE gate, hand ops, selection rule, capacity policy). R3 needs: the pantry-sheet shell design per the #304 contract, wiring the gate together with the cooking screen, and keeping `HAND_ENFORCEMENT_ENABLED = false`.

**Recommended next action:** Owner review of this branch (PR only on request); answer the OD-R2-1 / OD-R2-2 confirmation when convenient; then R3 on Owner go.
