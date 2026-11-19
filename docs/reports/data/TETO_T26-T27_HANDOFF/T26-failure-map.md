# T26 scratch: 67 failing tests → cause → fix target (base: main 6954a874 + T26 apply + honey type)

Classes: N = count / position / new-row follow-up; D = Owner decision based (26-2, C-3, D1-D5); G = golden/derived measurement; W = wiring contract; M = hand-kept manifest (followedBy); S = staged promotion (rows leave staged).
"Precedent" = what Batch 25 (59e34e0e) did to the same file.

| # | file (failing) | class | cause | fix target (no expectation loosened) |
|---|---|---|---|---|
| 2 | components/IngredientGlyph.test.tsx | N,W | dedicated-visual table lacks nduja; RESULT list 64→65 | add `nduja: "nduja-dollops"` row; length 65 (precedent +2 lines) |
| 2 | components/stagedGlyphs/StagedGlyphs.test.tsx | W | #873 "unwired" contract now wired | WIRED list +nduja-dollops (20th); replace the unwired test by the wired contract; keep importer test |
| 3 | data/cookingProfiles.test.ts | N | eligibility table, CUT eligibility, dynamic steps: no rows for 2 recipes | add 2 rows (default eligible; Nashville/nduja-pizza use the ordinary SAUCE→CHEESE→TOPPING steps) |
| 1 | data/discoveryCatalog.test.ts | N,D | Phase-2 SHIPPED_KEEP target of nashville now exists | include the 2 ids in the shipped-target list |
| 2 | data/expansionBatch18.test.ts | D | "unspecified-sauce rows are not shipped" and Research approved scope include nashville | Owner 26-2/C-3: move nashville out of the unshipped pin; list is a hand record, history kept |
| 1 | data/expansionBatch19.test.ts | N | manifest LANDED tail grows | extend tail/followedBy |
| 4 | data/expansionBatch20.test.ts | N | tail / ladder count / chapter | counts +2 / +1 |
| 1 | data/expansionBatch21.test.ts | N | measured changes pin (approved record + 4) | exclude T26 ids from the measurement (T25 pattern) |
| 1 | data/expansionBatch22.test.ts | N | Research measure: 35 pinned IDs, now 36 | append T26 ids + `nduja` to the existing "later batch" exclusion list (verified in scratch: Research pins pass, pinned 35 unchanged) |
| 3 | data/expansionBatch23.test.ts | N | same exclusion pattern; ordinary length 81→82 | exclusion list +2 ids (verified); length 82 |
| 2 | data/expansionBatch23b.test.ts | N | same | same |
| 4 | data/expansionBatch24.test.ts | N | same; approved 43 pinned | exclusion list +2 ids, ingredient list +nduja, ordinary length 82 — approved 43 UNCHANGED (verified: 4/4 pass with manifest edit) |
| 1 | data/expansionBatch25.test.tsx | N | "ordinary 81" pin | 82 (T26 key step appended) |
| 2 | data/recipes.test.ts | N | total counts | +2 recipes |
| 1 | data/referencePizza.test.ts | N,D | set of sauces used as mechanical target gains honey | Owner D1 (honey PAINT): add honey to the pinned set |
| 3 | data/staged/stagedCatalog.test.ts | S | 61→59 staged recipes, structural checks | counts −2 recipes (rows removed from staged) |
| 1 | data/staged/stagedIsolation.test.ts | S | staged id still present in shipped | remove the 2 rows from `staged/testSupport/stagedRecipes.ts` (precedent: T25 removed 6) |
| 1 | data/staged/stagedOwnerDecisions.test.ts | S,G | dependencies / exceptions measured | numeric −/+ per staged removal (derived) |
| 1 | data/staged/stagedRejudge.test.ts | S,G | golden | regenerate; review |
| 1 | data/staged/stagedWhatIf.research.test.ts | G | golden | regenerate; review |
| 1 | data/staged/stagedWhatIf.research19.test.ts | G | golden | regenerate; review |
| 2 | dev/DiscoveryProgressionInspector.test.tsx | N | step list / pool text gains the new step | add new step row text |
| 2 | dev/discoveryProgressionModel.test.ts | N | newly-discoverable ≥2 step list and pool +1 | append derived values |
| 8 | logic/catalog/recipeBatch.validator.test.ts | M | `followedBy` tails in `testSupport/recipeBatchManifest.ts` end at old tail | append the 2 ids to each of the 23 followedBy lists (verified: 8/8 pass) |
| 1 | logic/discovery/deductionHint.audit.test.ts | G | DH4-1 audit json counts +1 | regenerate; numeric +1 only — see golden table |
| 1 | logic/discovery/hint5Ladder.alphaReport.test.ts | G | alpha metrics golden | regenerate; values change (see golden table) |
| 2 | logic/discovery/hint5Ladder.baseCompat.test.ts | N | key-free population 91→93, 51→53 | counts |
| 1 | logic/discovery/hint5Ladder.golden55.test.ts | G | ladders55 golden | +362 lines, insertion only |
| 1 | logic/discovery/matcher.test.ts | D | nashville Phase-2 row no longer "blocked" | Owner 26-2/C-3 |
| 1 | logic/discovery/researchLabels.batch8a.test.ts | N | credited / ladder keys count | counts |
| 1 | logic/discovery/selectableHint.test.ts | N | 3-level recipe set gains nduja-pizza | list +1 |
| 1 | logic/discoveryLadder.test.ts | W | bridges list | add `../preview/t26HvSeeds.ts` |
| 5 | logic/materialShop.test.ts | N,D | contract row for nduja; pickles k 1→2, pack 10→20; exhaustive lists | rows/values per Owner SHOP_PACK approval |
| 1 | mission/lunchRush.exclusion.test.ts | N | opt-out total 32→34 | +2 ids |
| 1 | state/discoveryExpansion2.wave2.test.ts | N | credited list +1 | count |
| 1 | state/progression.test.ts | N | recipe list in isRecipeAvailable | +2 ids |

Total: 67 tests / 36 files.  Not failing, so not part of the follow-up: `expansionBatch11–17`, `lateCatalog.*`, `recipeChapters.test.ts`, `catalogLedger.test.ts` (composed from landed specs).

## Golden diff check (regenerated in an isolated worktree)
| file | result |
|---|---|
| hint5.ladders55.json | +362 lines, **insertion only** |
| hint5.alphaFamilyOnly.json | −4/+6: derived metric values change (e.g. wasabi-beef-pizza 897→947) |
| docs/reports/data/…DH4-1_AUDIT.json | −25/+25: category / family / group pool counts change; +1 pool member (nduja) |
| staged/__golden__/decisions.json | −9/+21: dependencies 327→328, EXCEPTION_REVIEW 68→69, totals +1 |
| staged/__golden__/rejudge.json | −5/+14: one key `OWNER_DECISION:OWNER_RULE:R-1` replaced |
| staged/__golden__/stagedGate.json | −8/+22: `SAUCE_UNSPECIFIED:nashville-hot-chicken-pizza` removed (row leaves staged), hit counters change |
| staged/__golden__/whatIf.research.json | −52/+55: sampled Research letter strings per shipped recipe change (seeded sampling over a changed candidate set) |
| staged/__golden__/whatIf.research19.json, whatIf.hint5.json | not regenerated/changed in this pass |
Only 1 of 7 is insertion-only; the others are derived measurements and cannot be insert-only. → Owner decision needed (see report).
