# Expansion Batch 8 — DATA_ONLY candidate selection (docs only)

Track B of the 3-track session. **Docs only: no recipe, ingredient, ladder, taxonomy or test change.** Nothing here is an Owner Decision;
every count / bake window is a provisional proposal in the style of Batch 7a ("GAMEPLAY CALIBRATION, Owner confirms on Preview").
Base: `main` `d0da093` (57 recipes / 64 ingredients / 53 ladder steps, after #492 Batch 7a).

## 1. How the 42 were narrowed

Source: `docs/reports/data/TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION.json` (class `DATA_ONLY` = 42 of 172), cross-checked
against `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX_ROWS.md` (canonical ingredient identity, status, blockers),
`TETO_PIZZADB_172_MASTER-EVIDENCE.json` (source rows) and the live `RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` on `main`.

| bucket | n | what |
|---|---|---|
| already a runtime recipe at the audit | 16 | `runtimeRecipeId` set in the classification (vongole, aussie, bacalhau, … porchetta) |
| shipped since by #492 (Batch 7a) | 2 | `eggplant-ricotta-pizza` (row 71), `new-zealand-lamb-pizza` (row 75) — **excluded, done** |
| **still unshipped** | **24** | the pool below |

Of the 24: 15 are `READY` / `READY_WITH_REVIEW` with no matrix blocker (one of them, `bianca`, is an exact duplicate of a shipped recipe, and three — currywurst, cuban, peking-duck — need ≥3 new materials), 9 are `BLOCKED_PRODUCT_DECISION`.
Hard facts that shape the ranking (all verified on `main`):

- **Sauce kinds are a closed set of three.** `RecipeSauceProfile.ingredientId` is `"tomato-sauce" | "pesto" | "olive-oil"`
  (`src/data/recipeSauceProfiles.ts`); Batch 7a states "no new sauce type". Every "listed sauce" row (tahini, miso, doubanjiang,
  yuzu-kosho, fromage-blanc, curry-ketchup, mustard, sweet-bean) is therefore a **new sauce kind** project, not a recipe batch.
  B1 (#498) / B2 (#500) give multi-sauce *state and rendering*, not new sauce *kinds*.
- **The ladder gives a recipe a step only through a new material.** `DISCOVERY_LADDER` is append-only and each step's `keyRecipeId` is the recipe
  it completes; the Batch Validator manifest requires `keyIngredientId` per recipe (`recipeBatchManifest.ts`). A recipe made only of
  materials the player can already own has no natural step / cohort key (see §4, OD-B8-2).
- **Identification is by exact ingredient set**, so near-duplicates (1 swap) are legal but confusable; identical sets are not.

## 2. Selected candidates (13)

Legend: **new** = materials not in the 64; "profile" = `RECIPE_SAUCE_PROFILES` entry (`null` = NO_SAUCE technique).
Counts / bake windows follow the nearest shipped recipe and are **provisional**. All: `baseRewardPitz` 100 (every recipe has 100), `lunchRush:false`,
no CUT, `ladderCredit` true, key-free Hint (the Batch 7a defaults). Evidence "corr" = `corroborationCount` in the master evidence (0 = a single PIZZA DB row).

### Tier 1 — recommended next batch (8a = the already-announced "7b" pair + 1)

| # | recipe (evidence id) | materials · new | profile | provisional counts · bake | conflicts | evidence | unlock proposal |
|---|---|---|---|---|---|---|---|
| 1 | **ikura-salmon-pizza** いくらとサーモンのピザ (`ikura-salmon-pizza-pizzadb-p1`) | cream-cheese, salmon, **salmon-roe, shiso** | `null` | cream-cheese 2 / salmon 3 / salmon-roe 2 / shiso 1 · 54–74 (cf. pesto-salmone, jalapeno-popper) | none (no identical / subset / 1-swap in the 57) | 日本 thin; PIZZA DB p1, corr 0; matrix READY | one ladder step `[salmon-roe, shiso]` (two new in one step: precedent steps 28/37/50/51); T4 120/60 Pitz precedent; key = salmon-roe |
| 2 | **shirasu-pizza** しらすピザ (`shirasu-pizza-pizzadb-p3`) | mozzarella, lemon, **shiso**, **whitebait** | `null` | mozzarella 2 / whitebait 3 / shiso 1 / lemon 1 · 54–74 | none | 湘南・駿河湾沿岸 thin; PIZZA DB p3, corr 0; READY | step `[whitebait]` after #1 (shiso already owned); key = whitebait. If #2 ships first the step is `[shiso, whitebait]` — re-derive with `buildAppendOnlyLadder` at G0 |
| 3 | **tsukimi-pizza** 月見ピザ (`tsukimi-pizza-pizzadb-p14`) | bacon, egg, mozzarella, **green-onion** | `null` | bacon 2 / egg 1 / green-onion 2 / mozzarella 2 · 50–70 (= aussie) | **1-swap near-duplicate** of `aussie` (onion→green-onion) and `breakfast-pizza`; not blocked by the matrix (READY) | 日本 thin; p14, corr 0 | one step `[green-onion]`; shares green-onion with #8. **Owner call:** ship as a distinct dish (月見 = egg yolk motif) or hold |

### Tier 2 — no new material (needs OD-B8-2 before it can be a batch)

| # | recipe | materials | profile | provisional counts · bake | conflicts | evidence |
|---|---|---|---|---|---|---|
| 4 | **frango-catupiry** フランゴ・コン・カトゥピリ (`…-p10`) | catupiry, chicken, mozzarella, oregano | `null` | catupiry 3 / chicken 3 / mozzarella 2 / oregano 1 · 56–76 (cf. brazilian-catupiry-corn) | none | ブラジル/サンパウロ thin; p10, corr 0; READY |
| 5 | **spanish-chorizo-pizza** (`…-p4`) | sausage, bell-pepper, onion, mozzarella | `null` | sausage 3 / bell-pepper 2 / onion 2 / mozzarella 2 · 58–78 | 1-swap of `polish-kielbasa` (sauerkraut→bell-pepper); source lists ソーセージ (not チョリソ) — name / canonical `sausage` mismatch to settle | スペイン thin; p4, corr 0; READY |
| 6 | **chilean-napolitana** チリアンナポリターナ (`chilean-napolitana-pizzadb`) | fresh-tomato, mozzarella, oregano | `null` | fresh-tomato 3 / mozzarella 2 / oregano 1 · 50–70 (cf. pesto-caprese) | none by set; matrix review item NC-1 (Napoletana 3-way naming cluster, vs shipped `napoletana`) → needs a disambiguated display name | original sample batch, corr 1; READY_WITH_REVIEW |

### Tier 3 — blocked on a new sauce kind (OD-B8-1); ranked by cost

| # | recipe | materials · new | sauce | provisional counts · bake | notes |
|---|---|---|---|---|---|
| 7 | **flammkuchen** タルトフランベ | bacon, onion, **fromage-blanc-sauce** | white sauce (new kind) | bacon 2 / onion 3 + sauce 1 · 58–78 | cheapest of the group: 1 new material in total; corr 1 |
| 8 | **sichuan-eggplant-pizza** 四川風ナスピザ | eggplant, garlic, mozzarella, **doubanjiang, green-onion** | hot sauce (new kind) | eggplant 3 / garlic 1 / green-onion 1 / mozzarella 2 + sauce 1 · 58–78 | corr 1 (own page); shares green-onion with #3 |
| 9 | **yuzu-shrimp-pizza** 柚子えびピザ | mozzarella, shrimp, **shiso, yuzu-kosho** | seasoning paste (new kind) | shrimp 3 / shiso 1 / mozzarella 2 + paste 1 · 56–76 | corr 1; shares shiso with #1/#2 |
| 10 | **eggplant-dengaku-pizza** ナス田楽ピザ | eggplant, mozzarella, **miso-sauce, white-sesame** | miso (new kind) | eggplant 3 / mozzarella 2 / white-sesame 1 + sauce 1 · 58–78 | eggplant saturation (see below) |
| 11 | **eggplant-tahini-pizza** ナスとタヒニのピザ | eggplant, parsley, **tahini, pomegranate** | tahini (new kind) | eggplant 3 / parsley 2 / pomegranate 1 + sauce 1 · 62–82 (cf. baba-ganoush) | eggplant saturation |

*Eggplant saturation:* 6 shipped recipes already use eggplant (melanzane, parmigiana, pesto-vegetariana, ratatouille, baba-ganoush, eggplant-ricotta); the evidence rows carry an explicit
"fourth distinct eggplant dish" note for sichuan. Recommend **at most one** of #8 / #10 / #11 in any batch.

### Tier 4 — high value but `BLOCKED_PRODUCT_DECISION` (needs the composition decision first)

| # | recipe | new | blocker | why it is still listed |
|---|---|---|---|---|
| 12 | **porcini-pizza** ポルチーニ茸のピザ | porcini | `COMPOSITION_CONFLICT_CANDIDATE` — DIVERGENT vs catalog candidate `ai-funghi-porcini` | one new material, no sauce; `porcini` already PROPOSED (vegetable) in the 62-ingredient taxonomy snapshot |
| 13 | **speck-e-brie** スペックエブリー | brie, walnut | `COMPOSITION_CONFLICT_CANDIDATE` — DIVERGENT vs catalog candidate `speck-e-brie`; naming cluster NC-5 | `walnut` PROPOSED (other); brie needs its own family |

## 3. Explicitly not selected

| row | reason |
|---|---|
| `bianca-pizzadb-row` | **IDENTICAL** ingredient set to shipped `pizza-bianca-ricotta` (mozzarella, olive-oil, ricotta, rosemary) — duplicate |
| `currywurst`, `cuban`, `peking-duck` | ≥3 new materials each plus a new sauce kind (peking-duck also a prepared-composite flag) |
| `boscaiola`, `pizza-alla-norma`, `frutti-di-mare`, `diavola` | `COMPOSITION_CONFLICT_CANDIDATE` (diavola also an unresolved ingredient) |
| `thai-chicken`, `philly-cheesesteak`, `hokkaido-cheese` | `UNRESOLVED_INGREDIENT` (赤唐辛子 / チーズソース / チーズ) |

## 4. Owner decisions this list needs (none taken here)

- **OD-B8-1 — new sauce kinds.** Tier 3 cannot start until the closed `ingredientId` union, sauce colours/rendering, stock/inventory per kind and Research/Hint exposure are decided (B1/B2 are the multi-sauce foundation, not the kind catalogue). Recommend deciding the *mechanism* once (data-driven sauce kind) before any Tier 3 recipe.
- **OD-B8-2 — zero-new-material recipes.** The ladder and the Batch Validator assume a key material per recipe. Options: (a) extend the manifest/ladder so a recipe may be "free" (no step, Dex credit only); (b) pair each with a new material; (c) skip. Must also confirm it does not move an existing recipe's Research cohort (`COHORT_LETTER_SHIFT` 0 is a 7a gate).
- **OD-B8-3 — taxonomy for new materials.** Like OD-B7-1: `salmon-roe`, `shiso`, `whitebait` (already named as "need their own decision" in `TETO_EXPANSION-BATCH-7_OWNER-DECISIONS.md`), and later `green-onion` etc. `porcini` / `walnut` are PROPOSED in PR #255 only.
- **OD-B8-4 — near-duplicates.** #3 tsukimi, #5 chorizo (1-swap of shipped dishes): distinct dish or hold.

## 5. Duplicate / overlap check

- **#492 (Batch 7a, merged):** removed `eggplant-ricotta` / `new-zealand-lamb` from the pool. Its Result Report and OD-B7-1 name Batch 7b = `ikura-salmon` + `shirasu` — Tier 1 #1/#2 *are* that batch; this file adds a ranking, not a competing proposal.
- Open PR / issue search for 7b, ikura, shirasu, "Expansion Batch 8": **none**. Open PRs touching recipe authority are docs-only (#255, #293, #296); none edits `recipes.ts` / `ingredients.ts` / `discoveryLadder.ts`.
- **#494** (sauce gauge) and the FINISH track (Track C) do not touch recipe data. FINISH D2 only matters for recipes with a late addition (`LATE_ADDITION` mechanic key) — none of the 13 above has one (all `mechanicKeys` are empty or `NO_SAUCE`).

## 6. Recommended order

1. **Batch 8a = #1 + #2 (+ optional #3)** — READY, existing sauce mapping (`null`), materials `salmon-roe / shiso / whitebait (/ green-onion)` need OD-B8-3 only.
2. Decide OD-B8-2, then Tier 2 (#4–#6) as a materials-free batch.
3. Decide OD-B8-1, then Tier 3 starting with #7 flammkuchen.
4. Tier 4 after the composition decisions.

Implementation of any of this (recipes, ingredients, ladder, Reference pizza, goldens, E2E) is **not started** and out of this track's scope.
