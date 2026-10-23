# FIN-E4b-ikura Result Report (Issue #621)

Base: `main` `aecf867` (#615 merged). Production switches are **unchanged**: `LATE_CATALOG_PRODUCTION = false`, `FREE_COOK_FINISH_PRODUCTION` untouched. Nothing in this PR is reachable in Production.

## What was added (all behind the build-time late catalog)
- `src/data/lateCatalog.ts`: `LATE_RECIPES` (`ikura-salmon-pizza`: cream-cheese 2 / salmon 3 / salmon-roe 2 `POST_BAKE` / shiso 1 `POST_BAKE`, NO_SAUCE, no CUT, `lunchRush:false`, bake 58-78), `LATE_INGREDIENTS` (`salmon-roe`, `unlockCondition` present), `LATE_DISCOVERY_TARGET_IDS` (`ikura-salmon-pizza-pizzadb-p1`), `LATE_LADDER_STEPS` (`salmon-roe` keyed to ikura, **no number, no star gate**), plus `LATE_ORDERS`, `LATE_TAXONOMY_ROWS` (seafood) and `LATE_TOPPING_SIZE_CLASS` (xs). The order, the taxonomy row and the size class join their tables **only when the catalog is enabled**, so an OFF build has no orphan row and `ORDERS` cannot hand Production an order for a recipe that does not exist.
- Type-keyed tables (`RecipeId` includes the late id, types only) carry a row in every build: `recipeSauceProfiles` (null), `recipeHintRoles` (key-free). `noSauceRecipeIds()` ignores a late id while OFF (`isInactiveLateRecipeId`). `referencePizza` holds the 8-piece Reference (inert while OFF).
- `salmon-roe-grains` dedicated art (copied from the held #584; #584 itself is untouched) + the local CSS size correction; reference SVG under `docs/design/references/ingredient-icons-2.0/`.
- `techniques.ts`: PLACEHOLDER comment removed; 後乗せ / D1 / R1 as decided by the Owner on 2026-10-22. The D1 description is Dex-only (after discovery); the riddle (R1) names neither the action nor the moment.

## Source honesty (AC-0)
Only the roe and the shiso are post-bake, from their individual PIZZA DB page citations (Owner confirmation on #614 is the source of record). Salmon and cream cheese before the bake is a **PROVISIONAL game-design default (Owner Q-1), not confirmed by the original source**. Counts and the bake window are GAMEPLAY CALIBRATION. Independent re-fetch of pizzadb.jp (#527 D4) is still open.

## Verification (HEAD of this PR)
- Vitest full: 507 files / 9341 tests pass (2 skipped, 4 todo); `tsc -b`, `oxlint` (only pre-existing warnings), `npm run build` pass.
- New: `lateCatalog.ikura.test.ts` (OFF isolation, ON merge, append-only ladder, an ordinary batch appended later moves only the late step's number (+1) and nothing already reached, structural validators, identification incl. shirasu-pizza / all-pre-bake / missing pieces, privacy of the Hint ladder / recipe text, ring measurement); `lateCatalog.test.ts` pins the shipped content; `IngredientGlyph.test.tsx` covers the roe art from `LATE_INGREDIENTS`.
- Existing OFF goldens (4 faces, Hint 5.0 ladder golden, `finishD2Inert`) pass **unmodified**. Seventeen "table keys == RECIPES" style tests were adapted with `withoutInactiveLate` / `activeRows` (test support `lateIds.ts`) instead of loosening any assertion: they ignore only late rows while OFF.
- Chromium 390x844 E2E (expansion-batch8b, hint5 ladder, research Dex, free-finish, finish-flow): 30/30. WebKit and the CI run are checked on the PR head.
- AC-5 ring measurement (recorded, no limit or threshold changed): the Reference is 8 non-sauce pieces (3 post-bake) on exactly the 8-slot ring, pairwise distinct.

## Not done / needs the Owner
- **AC-8 (roe in 3 states on a post-bake, un-baked look) was NOT measured in a browser.** Needs the late catalog ON build; no shared Preview was touched. Required before E5 together with the video (Q-8).
- No E2E with the late catalog ON (a build-time constant; E5).
- Q-5: the ring cap for post-bake pieces is decided by the Owner from the measurement above.

## E5 note: late step numbers
The late step number is `ordinary length + 1` and moves +1 whenever an ordinary batch appends (tested above; reached steps never move). Options before the catalog goes ON: (A, recommended) keep numbers derived and never pinned (today's contract: only unreached steps need one more discovery); (B) freeze ordinary batches while ON; (C) reserve a stable number range for late steps (touches save/entitlement semantics, needs its own Issue).
