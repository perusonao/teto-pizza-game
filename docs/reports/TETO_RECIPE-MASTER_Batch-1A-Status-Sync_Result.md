# TETO Recipe Master Catalog — Batch 1A Status Sync (Result Report)

Status: **data-only fix, complete.** No production code, gameplay, economy, unlock condition,
scoring, or UI changed.

## 0. Trigger

`docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B_Fresh-Design.md` (Batch 1B Fresh Design Audit,
commit `b856a6a`, branch `claude/batch-1b-design-audit-92elmc`) flagged a stale-data finding:
the Recipe Master Catalog's own `verificationStatus`/`gameDesignStatus`/`currentGameRecipe`
fields for `salsiccia`/`pepperoni`/`napoletana`/`tonno-e-cipolla` still read
`game_design_candidate`/`"candidate"`/`false`, even though these 4 recipes shipped to
production in PR #100 (Recipe Expansion Batch 1A). This report re-verifies that finding
against fresh `main` and applies the minimal fix.

## 1. Audited main SHA

`c95036b5543be527ab004d7eb4f6b73dea60931c` (confirmed via `git fetch origin` immediately before
this audit; no open PR duplicates this scope — see §6 below).

## 2. Production recipe count (from source)

`src/data/recipes.ts`'s `RECIPES` array: **11 recipes**, confirmed by direct read of the file.
The 4 in question are present and shipped:

| id | requiredIngredients (verbatim) | bakeTarget | unlockCondition |
|---|---|---|---|
| `salsiccia` | tomato-sauce×1, mozzarella×2, sausage×3 | 62–82 | `fugazza`, minTotalStars 16 |
| `pepperoni` | tomato-sauce×1, mozzarella×2, pepperoni×4 | 60–80 | `salsiccia`, minTotalStars 20 |
| `napoletana` | tomato-sauce×1, mozzarella×2, anchovy×3, oregano×1 | 48–68 | `pepperoni`, minTotalStars 24 |
| `tonno-e-cipolla` | tomato-sauce×1, mozzarella×2, onion×2, tuna×3 | 55–75 | `napoletana`, minTotalStars 28 |

`src/data/ingredients.ts`: **18 ingredients**, confirmed by direct read — the original 14 plus
`sausage`/`pepperoni`/`anchovy`/`tuna` (Batch 1A's 4 new ingredient rows).

## 3. Master recipe count

`data/recipes/pizza_master_catalog.json`: **53 entries** (`catalogEntryCount`, unchanged by
this fix — no entries added/removed, only status fields on 4 existing entries corrected).

## 4. Stale records found (re-verification confirms the Batch 1B audit's finding, still
accurate as of fresh main)

Before this fix, the catalog's 4 entries for `salsiccia`/`pepperoni`/`napoletana`/
`tonno-e-cipolla` all read:

- `verificationStatus: "game_design_candidate"` (should be `"verified_internal"`, the value
  the catalog's own schema note defines as "id/ingredients/bakeProfile cross-checked against
  `src/data/recipes.ts`" — true for all 4 since Batch 1A shipped)
- `gameDesignStatus: "candidate"` (should be `"shipped"`, matching the other 7 production
  recipes)
- `currentGameRecipe: false` (should be `true`)
- `sourceReferences: ["general_culinary_knowledge (unverified...)"]` (should follow the
  established `"internal://src/data/recipes.ts#<id>"` convention already used by all 7
  previously-shipped entries — a direct consequence of `verificationStatus` becoming
  `verified_internal`, not a separate/incidental change)

Top-level `statusBreakdown.verified_internal` was `7` (should be `11`);
`statusBreakdown.game_design_candidate` was `21` (should be `17`). Sum unchanged (53).

## 5. Changed fields

### `data/recipes/pizza_master_catalog.json`

For each of `salsiccia`, `pepperoni`, `napoletana`, `tonno-e-cipolla`:
- `verificationStatus`: `"game_design_candidate"` → `"verified_internal"`
- `gameDesignStatus`: `"candidate"` → `"shipped"`
- `currentGameRecipe`: `false` → `true`
- `sourceReferences`: → `["internal://src/data/recipes.ts#<id>"]`

Top-level `statusBreakdown`: `verified_internal` 7→11, `game_design_candidate` 21→17
(`deferred`/`verification_pending`/`rejected_duplicate` unchanged; sum still 53 =
`catalogEntryCount`).

No factual field (`id`, `nameJa`, `ingredients`, `bakeProfile`, `mechanics`, `difficulty`,
`progressionTier`, `implementationClass`, etc.) was touched — only the 4 records' shipped-status
flags, exactly as the triggering audit recommended.

### `data/recipes/ingredient_master_catalog.json`

Per §6 (ingredient master check), the same class of stale-status finding also existed for the
4 ingredients Batch 1A introduced. For each of `sausage`, `pepperoni`, `anchovy`, `tuna`:
- `existingInGame`: `false` → `true`
- `implementationCost`: `"new ingredient data row"` → `"none (shipped)"`
- `reusePotential`: `"medium"` → `"n/a (already shipped)"`
- `visualDistinctiveness`: (a number) → `null`
- `mechanicDependency` / `notes` fields removed

This exactly matches the existing schema convention already used by all 14 previously-shipped
ingredients in this same file (verified by direct comparison before editing — every
`existingInGame: true` entry in the file has this identical key set and these identical
`implementationCost`/`reusePotential`/`visualDistinctiveness` values; none invented).

Top-level: `existingIngredientCount` 14→18, `newIngredientCount` 48→44 (`totalIngredientCount`
62 unchanged; 18+44=62).

`usedByRecipeIds`/`usedByRecipeCount` on these 4 ingredients were **not** changed — those
fields count all catalog recipes (including non-shipped candidates like `meat-lovers`,
`supreme`, `romana`) that reference the ingredient, not just shipped ones, and were already
correct.

## 6. Ingredient master check result

Checked all 4 Batch-1A-introduced ingredients (`sausage`, `pepperoni`, `anchovy`, `tuna`)
against `src/data/ingredients.ts` directly. All 4 are present in production but were still
flagged `existingInGame: false` in the ingredient master catalog — the same class of stale-ship-status
finding as the recipe catalog, so it was fixed under the same task scope (§3 of the task
explicitly asks to check for and, if found, fix this). No other ingredient entries were
inspected/changed.

## 7. Tests

- `python3 tools/validate_recipe_catalog.py` → **All checks passed** (53 recipe entries, 62
  ingredient entries, 11 mechanic entries; 0 failures), run after the fix.
- `npm test` (vitest) → **1630 passed** (83 test files), 0 failed.
- `npx tsc -b` → exit 0, no errors.
- `npx oxlint` → exit 0, no errors/warnings.
- `npm run build` → succeeded (`vite build` produced `dist/` with no errors).

## 8. Production behavior change

**None.** No file under `src/**` was touched. `data/recipes/*.json` is documented as
"research/data artifact only; NOT wired into `src/**`" (see the catalog's own `schemaNote`) —
confirmed by `tools/validate_recipe_catalog.py` being the only consumer of these files, and by
`npm test`/`tsc -b`/`oxlint`/`npm run build` all passing unchanged.

## 9. Batch 1B implementation readiness

**Not evaluated by this task and out of scope.** This fix only removes the specific stale-data
caveat the Batch 1B Fresh Design Audit flagged about the catalog's own status bookkeeping for
Batch 1A's 4 shipped recipes. It does not add, review, or endorse any Batch 1B candidate data,
and does not constitute a go/no-go decision on Batch 1B implementation.

## 10. Final Verdict

**Sync complete and verified.** The Master Catalog's `verified_internal`/`shipped`/
`currentGameRecipe: true` records now match the 11 recipes actually in
`src/data/recipes.ts`, and the ingredient master's `existingInGame` flags now match the 18
ingredients actually in `src/data/ingredients.ts`. All requested verification (data validator,
unit tests, typecheck, lint, build) passes. No scope beyond the Master Catalog status sync was
touched.
