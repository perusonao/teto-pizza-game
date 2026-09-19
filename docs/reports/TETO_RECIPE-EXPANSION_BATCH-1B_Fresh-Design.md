# Recipe Expansion Batch 1B — Fresh Design Audit

Status: **READ-ONLY design audit. No production code, recipe data, ingredient data, or Issue
was changed by this task.** Everything below is a design proposal for a *future* implementation
task, not an implementation.

Audited `main` SHA (via `git fetch origin && git rev-parse origin/main`, fresh this session):
`2ae37f1e022acb9fcf4bac644e38bd00fb1ff5f7` — top of `main`, includes Human Feel Tuning 1A (#103),
Cooking Time CT2 (#101), Completion Gate Phase 1 (#102), **Recipe Expansion Batch 1A (#100,
7 → 11 recipes)**, Cooking Time CT1 (#99), Economy Tuning 1 (#98).

## 0. Fresh GitHub / Duplicate Gate

- `git fetch origin` run fresh at session start; no local uncommitted work found
  (`git status` clean on `claude/batch-1b-design-audit-92elmc`).
- Open PRs (`list_pull_requests`, state=open): **#105** (Dev Automation A1 — Claude Issue-worker
  infra, unrelated), **#72** (docs status-sync, unrelated), **#46** (Issue #33 Dough D0 audit,
  unrelated), **#34** (Issue #32 Phase 1 reference visuals, unrelated), **#3** (old Pages infra
  doc, unrelated). **No open PR touches recipe data, ingredient data, or a "Batch 1B"/recipe
  expansion topic.**
- `search_pull_requests`/`search_issues` for `batch 1b` / `batch 1B recipe expansion`: **0
  results**, both lexical.
- Open Issues (14 total, `list_issues` state=open): #104 (dev automation), #89 (Full Game
  Reset), #88 (Pizza Select pager — already implemented per PR #93 in the git log, issue
  likely stale/uncleaned), #87 (Lunch Rush Online Ranking), #47 (Making UX Cleanup), #39, #38,
  #37, #33, #32, #30, #27, #24, #22 (SSOT roadmap). **None is a Batch 1B / recipe-expansion
  tracking issue.**
- `git log --all --oneline | grep -i "batch 1b"`: no match, across every remote branch fetched.
- **Conclusion: no duplicate Batch 1B design or implementation work exists anywhere in this
  repository's fresh GitHub state.** This audit proceeds as new work. Fresh `main` (not any
  prior chat) is the SSOT used throughout.

## 1. Current Production Baseline (fresh from code, not from any doc)

`src/data/recipes.ts`: **11 recipes** (re-confirmed by reading the file directly — the doc
comment inside `recipes.ts` itself already narrates the Batch 1A addition, 7 → 11).

| # | id | ingredients (id ×minCount) | bakeTarget | unlockCondition | mysteryLock | baseRewardPitz |
|---|---|---|---|---|---|---|
| 1 | margherita | tomato-sauce×1, mozzarella×3, basil×2 | 60–80 | *(none — always unlocked)* | — | 100 |
| 2 | marinara | tomato-sauce×1, garlic×3, oregano×2 | 45–65 | requiresRecipeId: funghi | — | 100 |
| 3 | quattro-formaggi | olive-oil×1, mozzarella×2, gorgonzola×2, parmigiano×2, fontina×2 | 65–85 | requiresRecipeId: genovese, minTotalStars: 8 | — | 100 |
| 4 | genovese | pesto×1, mozzarella×2, cherry-tomato×3 | 50–70 | requiresRecipeId: bismarck | — | 100 |
| 5 | bismarck | tomato-sauce×1, mozzarella×3, egg×1 | 55–75 | requiresRecipeId: marinara | — | 100 |
| 6 | funghi | tomato-sauce×1, mozzarella×2, mushroom×3 | 58–78 | requiresRecipeId: margherita | — | 100 |
| 7 | fugazza | olive-oil×1, onion×4, oregano×1 | 63–83 | requiresRecipeId: quattro-formaggi, minTotalStars: 12 | **true** | 100 |
| 8 | salsiccia | tomato-sauce×1, mozzarella×2, sausage×3 | 62–82 | requiresRecipeId: fugazza, minTotalStars: 16 | — | 100 |
| 9 | pepperoni | tomato-sauce×1, mozzarella×2, pepperoni×4 | 60–80 | requiresRecipeId: salsiccia, minTotalStars: 20 | — | 100 |
| 10 | napoletana | tomato-sauce×1, mozzarella×2, anchovy×3, oregano×1 | 48–68 | requiresRecipeId: pepperoni, minTotalStars: 24 | — | 100 |
| 11 | tonno-e-cipolla | tomato-sauce×1, mozzarella×2, onion×2, tuna×3 | 55–75 | requiresRecipeId: napoletana, minTotalStars: 28 | — | 100 |

Ingredient count in `src/data/ingredients.ts`: **18** — `tomato-sauce`, `olive-oil`, `pesto`
(sauces), `mozzarella`, `gorgonzola`, `parmigiano`, `fontina` (cheeses), `basil`, `garlic`,
`oregano`, `cherry-tomato`, `egg`, `mushroom`, `onion`, `sausage`, `pepperoni`, `anchovy`,
`tuna` (toppings). Only `tomato-sauce`/`mozzarella`/`basil` are unconditional Starter ingredients
(`STARTER_INGREDIENT_IDS`); the other 15 are `starterGrantOnly: true` finite ingredients gated
by `unlockCondition.minTotalStars` (mostly inert — `starterGrantOnly` suppresses the Shop
LOCKED/AVAILABLE_TO_BUY row entirely; first unit always arrives via a recipe's Starter Grant).

Finite-ingredient / interaction pattern per recipe: every recipe uses only the two shipped
placement mechanics, `spread` (sauce, one-tap full coverage) and `scatter` (topping, point-by-
point). No recipe uses more than one sauce-category ingredient. No recipe requires anything
beyond pre-bake placement — no post-bake finishing, no half-and-half, no fold, no stuffed
crust, no deep dish exist in production today.

**Batch 1A's 4 recipes (`salsiccia`/`pepperoni`/`napoletana`/`tonno-e-cipolla`) are excluded
from all candidate consideration below, per instruction.**

## 2. Recipe Master Fresh Read

Read fresh this session: `data/recipes/pizza_master_catalog.json`,
`data/recipes/ingredient_master_catalog.json`, `data/recipes/gameplay_mechanic_master.json`,
`docs/design/TETO_RECIPE-MASTER-CATALOG.md`.

**Important stale-data finding (fresh-audit catch):** the Master catalog's own
`currentGameRecipe`/`gameDesignStatus` fields for `salsiccia`/`pepperoni`/`napoletana`/
`tonno-e-cipolla` still read `false`/`"candidate"` and `verificationStatus:
"game_design_candidate"` — **the catalog JSON was never updated when Batch 1A shipped to
production.** `statusBreakdown` still shows only 7 `verified_internal` entries, not 11. This
audit does **not** treat the catalog's `gameDesignStatus`/`currentGameRecipe` fields as
authoritative for "what's shipped" — `src/data/recipes.ts` (§1 above) is the sole SSOT for
that. The catalog remains reliable for everything else used in this audit (ingredient sets,
mechanics, implementation class, verification status, reuse data), since only the 4 specific
records' shipped-status flags are stale, not their factual content. **Recommendation for a
future task:** update `data/recipes/pizza_master_catalog.json`'s 4 Batch 1A entries'
`gameDesignStatus`/`currentGameRecipe`/`verificationStatus` in the same change that next
touches this catalog, so this drift doesn't compound.

Catalog scale, confirmed fresh: **53 entries, 51 viable** (2 `rejected_duplicate`:
`bufalina`, `contadina`). Status breakdown (as stored, stale-flag caveat above noted):
`verified_internal`: 7, `game_design_candidate`: 21, `verification_pending`: 18,
`deferred`: 5, `rejected_duplicate`: 2. **This 53/51 foundation is explicitly not treated as
a finished 160-recipe list** — its own document (§1/§8) states the same, and this audit
follows that framing throughout: candidates are drawn only from the entries that actually
exist today, `rejected_duplicate` entries (`bufalina`, `contadina`) are excluded outright, and
every `verification_pending` candidate considered below carries its risk flag forward rather
than being silently treated as verified.

## 3. Current Gameplay Coverage (from the 11 shipped recipes)

| Pattern | Example recipe(s) |
|---|---|
| Simple 3-ingredient, sauce+cheese+herb | margherita |
| No-cheese, sauce-based | marinara |
| Multi-cheese (4 cheeses), no tomato | quattro-formaggi |
| Non-tomato sauce (pesto) | genovese |
| Egg centerpiece | bismarck |
| Single vegetable topping (mushroom) | funghi |
| Sauceless, oil-base, onion-heavy | fugazza |
| Meat topping, dense single-topping | salsiccia, pepperoni |
| Fish/cured topping + herb | napoletana (anchovy+oregano) |
| Fish + allium combo | tonno-e-cipolla (tuna+onion) |

**Missing gameplay patterns not yet experienced anywhere in production:**

1. **Extreme minimalism** — the fewest ingredients ever shipped is 3 (margherita, marinara,
   funghi, salsiccia). Nothing at 2 ingredients exists.
2. **High-density "everything" pizza** — the most ingredients ever shipped is 5
   (quattro-formaggi). Nothing at 6–8 ingredients (crowded placement, more tray paging, denser
   sauce-coverage judgment against many overlapping toppings) exists.
3. **Sweet/savory contrast (fruit topping)** — every existing topping is savory (vegetable,
   herb, meat, fish, cheese, egg). No fruit-category ingredient exists.
4. **Multi-meat combination on one pizza** — sausage and pepperoni each currently appear
   alone, never combined with another meat on the same pie.
5. **A fully vegetarian, multi-vegetable, non-monochrome pizza** — funghi/fugazza are each a
   single dominant vegetable; nothing combines 2+ distinct vegetables with a cheese for a
   visually "colorful garden" identity.

Batch 1B, per the goal in §16 below, deliberately closes **(1) and (2)** — the two patterns
that are cheapest to add (zero new mechanic, existing ingredients do most of the work) and
that read as genuinely new to a returning player (a 2-ingredient pizza *feels* different from
an 8-ingredient one, even using the exact same spread/scatter interactions).

## 4. Candidate Pool

Master-catalog entries with `implementationClass: "B"` (new ingredient rows only, zero new
mechanic — see §4 of the catalog doc) and *not* already shipped, *not* `rejected_duplicate`,
*not* `deferred`:

`hawaiian`, `ortolana`, `capricciosa`, `boscaiola`, `pugliese` (verification_pending),
`calabrese` (verification_pending), `ai-carciofi`, `ai-funghi-porcini` (verification_pending),
`pizza-bianca`, `meat-lovers`, `supreme`, `ricotta-bianca`, `breakfast-pizza`, `alla-norma`
(verification_pending).

All 10 of the task's suggested "at least evaluate" candidates were checked: `Hawaiian`
(candidate above), `Ortolana` (candidate above), `Capricciosa` (candidate above), `Boscaiola`
(candidate above), `Ai Carciofi` (candidate above), `Pizza Bianca` (candidate above), `Meat
Lovers` (candidate above), `Supreme` (candidate above), `Ricotta Bianca` (candidate above),
`Breakfast Pizza` (candidate above) — every one is genuinely `implementationClass: "B"` and
un-shipped, so none was dropped from consideration. Beyond that list, this audit also pulled in
`ai-funghi-porcini`, `pugliese`, `calabrese`, and `alla-norma` (all Class B) as additional pool
members, and reviewed every Class C/D/E entry to confirm none belongs in a Class-B-only batch
(`prosciutto`, `diavola`, `frutti-di-mare`, `quattro-stagioni`, `mezza-e-mezza`, `calzone`,
`siciliana`, `al-tartufo`, `speck-e-brie`, `wurstel-e-patatine`, `bbq-chicken`,
`buffalo-chicken`, `philly-cheesesteak`, `chicago-deep-dish`, `detroit-style`, `stuffed-crust`,
`shrimp-mayo`, `teriyaki-chicken`, `potato-bacon`, `nutella-dessert`, `honey-fig` are all Class
C/D — see §8 for why they're excluded).

## 5. Candidate Evaluation Matrix

| Recipe | Status | Existing-ingredient reuse | New ingredients | Ingredient count | New gameplay value | Visual differentiation | Difficulty | Economy impact | Progression fit | Impl. complexity | Verification risk |
|---|---|---|---|---|---|---|---|---|---|---|---|
| pizza-bianca | game_design_candidate | HIGH (olive-oil shipped) | rosemary | 2 | **HIGH** — first sub-3-ingredient recipe, new minimalist identity | MEDIUM (pale, sparse) | LOW | LOW | Natural "intro-in-a-later-chapter" slot | LOW | LOW (well-established Roman dish) |
| breakfast-pizza | game_design_candidate | HIGH (egg, mozzarella, tomato-sauce shipped) | bacon | 4 | LOW–MEDIUM (egg already used by bismarck; bacon is new) | MEDIUM | LOW–MEDIUM | LOW (0–1 new ingredient depending on batch order) | Easy slot, low risk | LOW | LOW–MEDIUM (a real, common American diner dish; "pizza" framing is casual but well-attested) |
| capricciosa | game_design_candidate | MEDIUM (tomato-sauce, mozzarella, mushroom, oregano shipped) | ham, black-olive | 6 | **HIGH** — first 6-ingredient "everything" pizza | HIGH (olive + ham visually distinct) | MEDIUM | MEDIUM | Good mid-late slot | MEDIUM | LOW (canonical Italian dish) |
| meat-lovers | game_design_candidate | MEDIUM (tomato-sauce, mozzarella, pepperoni, sausage shipped) | bacon, ham | 6 | MEDIUM — first multi-meat combination pizza | HIGH (dense meat visual) | MEDIUM | MEDIUM | Good late slot | MEDIUM | LOW (generic, extremely well-attested US style) |
| supreme | game_design_candidate | HIGH (6 of 8 ingredients shipped once bell-pepper/black-olive exist) | bell-pepper, black-olive | 8 | **HIGH** — first 8-ingredient max-density recipe | HIGH (most crowded pizza yet) | MEDIUM–HIGH (label says 3, but 8-ingredient density is a de facto complexity jump) | MEDIUM | Natural capstone slot | MEDIUM (density, not mechanic) | LOW (generic, extremely well-attested US style) |
| hawaiian | game_design_candidate | MEDIUM (tomato-sauce, mozzarella shipped) | ham, pineapple | 4 | **HIGH** — first sweet/fruit topping | **HIGH** (visualDistinctiveness 5/5 in catalog) | LOW–MEDIUM | MEDIUM (pineapple has low future reuse) | Good early-mid slot | LOW | LOW (extremely well-attested, if debated, dish) |
| ortolana | game_design_candidate | MEDIUM (tomato-sauce, mozzarella, cherry-tomato, onion shipped) | bell-pepper, zucchini | 6 | MEDIUM — first multi-vegetable "garden" pizza | HIGH (colorful) | MEDIUM | MEDIUM (zucchini is single-use in this batch) | Good mid slot | MEDIUM | LOW–MEDIUM (name itself flagged as alias-prone vs. "Vegetariana" — kept distinct per catalog §6) |
| boscaiola | game_design_candidate | **HIGH — zero new ingredients** (all 4 shipped) | *(none)* | 4 | LOW (mushroom+sausage combo — pattern already partly covered) | LOW–MEDIUM | LOW | **NONE** | Trivial slot, any position | **LOWEST** | LOW (canonical Italian "woodsman" dish) |
| ai-carciofi | game_design_candidate | MEDIUM (garlic, mozzarella, tomato-sauce shipped) | artichoke | 4 | MEDIUM (new vegetable, but single-purpose in this batch) | MEDIUM | LOW–MEDIUM | LOW–MEDIUM | Fine mid slot | LOW | LOW |
| ricotta-bianca | game_design_candidate | MEDIUM (garlic, mozzarella, olive-oil shipped) | ricotta | 4 | MEDIUM (second "white pizza," after fugazza/quattro-formaggi's own no-tomato precedent) | MEDIUM | LOW–MEDIUM | LOW–MEDIUM | Fine mid slot | LOW | LOW–MEDIUM (explicitly disambiguated from Pizza Bianca by the catalog — same-batch collision risk if both shipped without careful naming) |
| pugliese | **verification_pending** | HIGH (mozzarella, onion, oregano, tomato-sauce shipped) | breadcrumb | 5 | LOW–MEDIUM | LOW–MEDIUM | LOW–MEDIUM | LOW–MEDIUM | Fine mid slot | LOW | **MEDIUM** — catalog itself flags Marinara/Napoletana naming ambiguity |
| calabrese | **verification_pending** | HIGH (mozzarella, tomato-sauce shipped) | nduja | 3 | MEDIUM (spicy spread ingredient, new flavor profile) | MEDIUM | MEDIUM | LOW–MEDIUM | Fine late slot | LOW | **MEDIUM** — regional specialty, not independently source-checked |
| ai-funghi-porcini | **verification_pending** | HIGH (mozzarella, tomato-sauce shipped) | porcini | 3 | LOW (visually close to funghi's existing mushroom) | LOW | LOW–MEDIUM | LOW (porcini is single-use, low reuse per catalog) | Fine late slot | LOW | **MEDIUM** |
| alla-norma | **verification_pending** | MEDIUM (basil, mozzarella, olive-oil shipped) | eggplant, ricotta-salata | 5 | MEDIUM (eggplant is a new vegetable) | MEDIUM | MEDIUM | MEDIUM | Fine late slot | LOW | **MEDIUM–HIGH** — catalog's own note: "primarily documented as a PASTA dish," pizza adaptation not canonically established |

## 6. Ingredient Reuse (against the 18 shipped ingredients)

Every candidate above reuses `tomato-sauce` and/or `mozzarella` and/or `olive-oil` as its base.
Cross-checked against the specific reuse list the task named:

| Existing ingredient | Reused by which evaluated candidates |
|---|---|
| tomato-sauce | capricciosa, meat-lovers, supreme, hawaiian, ortolana, breakfast-pizza, boscaiola, ai-carciofi, calabrese, ai-funghi-porcini, pugliese |
| olive-oil | pizza-bianca, ricotta-bianca, alla-norma |
| mozzarella | all 14 candidates |
| mushroom | capricciosa, boscaiola |
| onion | ortolana, pugliese |
| oregano | capricciosa, pugliese |
| egg | breakfast-pizza |
| pepperoni | meat-lovers, supreme |
| sausage | meat-lovers, supreme, boscaiola |
| garlic | ai-carciofi, ricotta-bianca |
| cherry-tomato | ortolana |
| basil | alla-norma |
| gorgonzola / parmigiano / fontina / anchovy / tuna / pesto | *not reused by any evaluated candidate* |

This confirms strong reuse of the tomato-sauce/mozzarella/mushroom/onion/oregano/sausage/
pepperoni core, and shows the four cheese/fish/pesto ingredients most tied to Chapter 1's own
identity (`quattro-formaggi`, `genovese`, `napoletana`, `tonno-e-cipolla`) simply have no
natural Class-B reuse target in the current 53-entry pool — not a gap this batch needs to fix.

## 7. New Ingredient Bundling

| Ingredient | Used by evaluated candidates (this batch's pool) | Placement | Future reuse (per Master Catalog, outside this batch) | Visual asset need | Economy note |
|---|---|---|---|---|---|
| **ham** | hawaiian, capricciosa, meat-lovers | scatter/piece | `calzone`, `quattro-stagioni` (both Class D, later) | New emoji/color row, same tier as sausage | reusePotential: high (catalog) |
| **bacon** | meat-lovers, breakfast-pizza | scatter/piece | `potato-bacon` (Class D, later) | New emoji/color row | reusePotential: high |
| **black-olive** | capricciosa, supreme | scatter/piece | `quattro-stagioni` (Class D, later) | New emoji/color row, small dark piece | reusePotential: high |
| **bell-pepper** | supreme, (ortolana if included) | scatter/piece | `ortolana`, `philly-cheesesteak` (Class D, later) | New emoji/color row, needs 2–3 colors ideally (design choice, not required) | reusePotential: high |
| **rosemary** | pizza-bianca | scatter/piece | `potato-bacon` (Class D, later) | Small green sprig, distinct from basil/oregano | reusePotential: medium |
| pineapple | hawaiian only | scatter/piece | *none catalogued* | High-distinctiveness (5/5), but single-recipe | reusePotential: low |
| zucchini | ortolana only | scatter/piece | *none catalogued* | New green disc/half-moon | reusePotential: high (catalog says high despite single current use) |
| artichoke | ai-carciofi only *(in this pool)* | scatter/piece | `quattro-stagioni` (Class D, later) | Distinct leafy shape | reusePotential: medium |
| ricotta | ricotta-bianca only *(in this pool)* | scatter/piece | `calzone` (Class D, later) | Soft white dollops, distinct from mozzarella | reusePotential: high |

The task's own bundling goal ("1 new ingredient unlocking multiple new recipes") is best met
by **ham** (3 of this batch's candidates), **bacon** and **black-olive** (2 each). `pineapple`,
`zucchini`, `artichoke`, and `ricotta` are each single-recipe within this batch's pool (their
catalogued reuse only shows up in Class D recipes not eligible this round), which is the
central design tension resolved differently by the Main vs. Alternative batch in §16/§17.

## 8. Interaction Diversity

Checked every candidate's `mechanics` field: **all 14 are `["spread", "scatter"]` only** — the
two mechanics already shipped. None requires `postBakeFinishing`, `halfAndHalfSplit`,
`stuffedDough`, `foldDough`, `specialShapePan`, `layeredReverseOrder`, or `ringPlacement`
(the Master's own `gameplay_mechanic_master.json` schema — verified these fields exist in that
file and are not invented for this audit). This is exactly why §4's Class-B filter was applied
first: it mechanically guarantees every candidate is buildable with zero Making-flow code
changes, only new `Ingredient` data rows plus new `Recipe` entries — identical in kind to how
Batch 1A shipped `salsiccia`/`pepperoni`/`napoletana`/`tonno-e-cipolla`.

**Explicitly excluded from Batch 1B on this basis** (real Master entries, not fabricated):
`prosciutto` (postBakeFinishing), `diavola` (postBakeFinishing, chili-oil drizzle),
`frutti-di-mare` (postBakeFinishing), `quattro-stagioni` (quadrantPlacement),
`mezza-e-mezza` (halfAndHalfSplit), `calzone` (foldDough), `siciliana`/`chicago-deep-dish`/
`detroit-style` (specialShapePan/layeredReverseOrder), `stuffed-crust` (ringPlacement, Class
C — smaller in scope but still a new operation), `speck-e-brie`/`al-tartufo`/`bbq-chicken`/
`buffalo-chicken`/`wurstel-e-patatine`/`philly-cheesesteak`/`shrimp-mayo`/`teriyaki-chicken`/
`potato-bacon`/`nutella-dessert`/`honey-fig` (all postBakeFinishing per their Class-D rating).
These remain valid **future** candidates once `postBakeFinishing` (flagged in the Master's own
analysis as "highest-value single mechanic investment," 15 dependent recipes) is actually
built — that is a **proposal for a later mechanic-investment task, not part of Batch 1B.**

## 9. Sauce / Finish Semantics

Checked every evaluated candidate's `sauce` field: each uses exactly one sauce-category
ingredient (`tomato-sauce` or `olive-oil`), matching every currently shipped recipe. **No
candidate in this batch needs `applicationRole`, `phase`, or `coverage` distinctions.** The
current game has no concept of `base`/`drizzle`/`finish` sauce roles or `preBake`/`postBake`
phases anywhere in `src/**` — this was confirmed by the same Class-B/mechanic filter in §8
(any recipe needing a drizzle-vs-base distinction, e.g. `diavola`'s chili-oil finish, is
already excluded as `postBakeFinishing`/Class D). Any future recipe needing that distinction
must go through the same proposal-not-current discipline the Master Catalog itself already
uses — **not introduced by this batch.**

## 10. Difficulty Curve

Existing 11 recipes span 3–5 ingredients, bake spans of 20 seconds, and a max of one
non-tomato sauce swap (pesto/olive-oil) per recipe. This batch is composed to sit across three
tiers rather than clustering at one density:

| Tier | Recipe | Ingredient count | Notes |
|---|---|---|---|
| Intro (new floor) | pizza-bianca | 2 | Below every existing recipe's floor of 3 |
| Easy–medium | breakfast-pizza | 4 | Matches existing recipes' typical 3–4 range |
| Medium | capricciosa | 6 | New density tier |
| Medium | meat-lovers | 6 | New density tier |
| Complex (new ceiling) | supreme | 8 | Above every existing recipe's ceiling of 5 |

This deliberately does **not** put every new recipe at the high end (the task's own §10
warning against "suddenly all Supreme-tier") — one recipe undercuts the existing floor, one
sits in the existing range, two establish a new mid-density tier, and only one pushes the
ceiling.

## 11. Progression Integration (provisional)

Fresh-read `src/state/progression.ts`/`src/data/recipes.ts`: `recipeUnlocked` is a pure AND of
`requiresRecipeId` (Dex-discovery chain) and an optional `minTotalStars` floor
(`totalStars` = sum of Dex BEST stars across every discovered recipe, 5-star max per recipe —
`src/logic/mastery.ts`/`scoring.ts`). Batch 1A's own chain extended the existing pattern with a
flat **+4 minTotalStars step per recipe** (16 → 20 → 24 → 28). This batch proposes continuing
that exact, already-established increment — **explicitly provisional**, pending a real
Progression Tuning pass:

| Recipe | requiresRecipeId | minTotalStars (provisional) | mysteryLock |
|---|---|---|---|
| pizza-bianca | tonno-e-cipolla | 32 | false |
| breakfast-pizza | pizza-bianca | 36 | false |
| capricciosa | breakfast-pizza | 40 | false |
| meat-lovers | capricciosa | 44 | false |
| supreme | meat-lovers | 48 | false |

No `mysteryLock` is proposed (fugazza's "big reveal" stays the one deliberate exception, per
the existing doc-comment convention in `recipes.ts`). Chain order here is a Batch-1B-original
design decision, not derived from any canonical source — exactly like Batch 1A's own chain was.
**This is not a final balance decision** — it is sized only to preserve the existing step
pattern until a dedicated Progression Tuning task (not yet scoped as an Issue, see §20)
re-evaluates the whole curve, likely once past 11–16 recipes.

## 12. Starter Grant Design (provisional)

Fresh-read `src/state/starterStock.ts`: `STARTER_STOCK_PLAYS_CHAPTER_1 = 10`; a `scatter`
ingredient grants `minCount × 10`; a shared ingredient across recipes is **floored**
(`Math.max(current, grantAmount)`), never additively stacked (Economy Tuning 1 P0b). Applying
the same formula to this batch's proposed `minCount`s (see §16 for the exact recipe
compositions):

| Ingredient | Governing recipe(s) in this batch | minCount used | Starter Grant (× 10) |
|---|---|---|---|
| rosemary | pizza-bianca | 3 | 30 |
| bacon | meat-lovers (2), breakfast-pizza (3) | max 3 | 30 (floored) |
| ham | capricciosa (2), meat-lovers (2) | max 2 | 20 (floored) |
| black-olive | capricciosa (3), supreme (2) | max 3 | 30 (floored) |
| bell-pepper | supreme | 2 | 20 |

All **provisional** — sized only to match the existing formula mechanically, not a finalized
Economy Tuning 2 decision.

## 13. Shop / Inventory / Dex / Recipe Select Impact

Main Batch (§16, 5 recipes / 5 new ingredients):

| Surface | Current rows | +Batch 1B | New total |
|---|---|---|---|
| Recipe Select | 11 | +5 | 16 |
| Pizza Dex | 11 | +5 | 16 |
| Shop (LOCKED/AVAILABLE_TO_BUY rows) | 0 (every non-Starter ingredient is `starterGrantOnly`, so Shop never lists an unlock row — restock rows only) | +0 unlock rows, +5 potential *restock* rows once each ingredient's Starter Grant is claimed | no structural change |
| Inventory screen | 15 finite rows (18 total − 3 unconditional Starter) | +5 | 20 |
| Ingredient Tray "Other" pagination (`MAX_INGREDIENT_PALETTE_SLOTS = 6`) | topping category already has 11 rows → already paginated today | +5 more topping rows (16 total) → one additional "Other" page in the topping category | Already-solved by existing pagination (`IngredientTray.tsx`'s per-page slice); **no new UI work required** — re-confirmed by reading the component directly, not assumed |

This directly answers the open Shop/Inventory/Dex scalability question the AI UI/UX Visual
Review raised: the Ingredient Tray's pagination already generalizes past 6 toppings (it already
does, today, at 11), so Batch 1B's 5 new toppings are additional pages, not a new problem.
Shop/Inventory/Dex are simple list growth (16/20 rows) with no evidence in the code of a
hard-coded row limit.

## 14. Economy Impact (provisional, not a final price table)

Following the exact tier convention Economy Tuning 1 and Batch 1A already established
(topping prices 55–170 Pitz, scaled to "how premium/flavor-defining" the ingredient is):

| Ingredient | Provisional pricePitz | restockQuantity (max minCount × 3) | Tier rationale |
|---|---|---|---|
| ham | 140 | 6 | Matches `sausage` (140) — premium meat topping |
| bacon | 140 | 9 | Matches `sausage` (140) — premium meat topping |
| black-olive | 90 | 9 | Matches `garlic`/`gorgonzola` (90) — mid-tier flavor topping |
| bell-pepper | 90 | 6 | Matches `garlic`/`gorgonzola` (90) — mid-tier vegetable topping |
| rosemary | 55 | 9 | Matches `oregano` (55) — herb tier |

`Recipe.baseRewardPitz: 100` for every new recipe, matching every existing recipe (Issue #38
V1: no difficulty-based reward differentiation without Human Feel evidence — unchanged
rationale, not revisited by this batch). **Overall Economy complexity added: 5 new ingredient
rows, 0 new price tiers (every price reuses an existing tier), 0 new mechanic.** This is a
materially smaller Economy footprint than Batch 1A (which also added 4 ingredient rows at a
comparable price tier) — not a step-change in Shop complexity.

## 15. Culinary Verification

Main Batch candidates (`pizza-bianca`, `breakfast-pizza`, `capricciosa`, `meat-lovers`,
`supreme`) are **all `verification_pending`-free** — every one carries `verificationStatus:
"game_design_candidate"` in the Master, meaning "real, well-established dish per general
culinary knowledge, not independently source-checked this session." This audit did **not**
attempt a fresh external verification pass (this session's own network egress is subject to
the same `EGRESS_BLOCKED` constraint the Master Catalog's own provenance notes describe for
prior sessions — not re-tested here since it wasn't necessary: none of the Main Batch
candidates carry `verification_pending` status requiring it). **No source-backed "this is
authentically X" claim is made anywhere in this report** — every dish description above is
presented as game-design classification, consistent with the Master Catalog's own discipline.

If a future implementation task substitutes any `verification_pending` candidate from the
Alternative Batch or elsewhere (`pugliese`, `calabrese`, `ai-funghi-porcini`, `alla-norma`),
**an external culinary source check should happen before that specific recipe ships** — this
is a pre-implementation requirement inherited from the Master Catalog's own §5 policy, not a
new rule invented here.

## 16. Batch Composition

### Main Batch (recommended) — 5 recipes, 5 new ingredients

**capricciosa · meat-lovers · supreme · breakfast-pizza · pizza-bianca**

| Recipe | Proposed ingredients (minCount) | Bake target (provisional) | Tier |
|---|---|---|---|
| pizza-bianca | olive-oil×1, rosemary×3 | 50–70 | Intro |
| breakfast-pizza | tomato-sauce×1, mozzarella×2, egg×1, bacon×3 | 56–76 | Easy–medium |
| capricciosa | tomato-sauce×1, mozzarella×2, mushroom×2, oregano×1, ham×2, black-olive×3 | 64–84 | Medium |
| meat-lovers | tomato-sauce×1, mozzarella×2, sausage×2, pepperoni×2, ham×2, bacon×2 | 62–82 | Medium |
| supreme | tomato-sauce×1, mozzarella×2, sausage×2, pepperoni×2, mushroom×2, onion×2, bell-pepper×2, black-olive×2 | 65–85 | Complex (capstone) |

Why this composition, as **one batch**, not five independent picks:

- **Existing-ingredient reuse**: every recipe anchors on `tomato-sauce`/`mozzarella` (already
  shipped); `mushroom`/`sausage`/`pepperoni`/`onion`/`oregano`/`egg` (all shipped) do most of
  the remaining ingredient-set work.
- **Exactly 5 new ingredients** (`rosemary`, `bacon`, `ham`, `black-olive`, `bell-pepper`),
  within the task's own "2–4 ideal" band plus one — justified because 3 of the 5
  (`ham`/`bacon`/`black-olive`) are each reused by 2+ recipes *inside this same batch* (§7),
  which is a tighter bundling ratio than spreading the same 5 recipes across 8+ new
  ingredients (the Alternative Batch's own tradeoff, §17).
- **Genuine simple/medium/complex spread** (§10): 2 → 4 → 6 → 6 → 8 ingredients.
- **Two new gameplay patterns** (§3): `pizza-bianca` is the first sub-3-ingredient recipe;
  `supreme` is the first 8-ingredient, maximum-density recipe. Both are reachable with zero new
  mechanic.
- **Visually distinct**: pale/minimal (pizza-bianca) vs. dense/crowded (supreme) vs.
  yellow-egg-and-bacon (breakfast) vs. dark-olive-studded (capricciosa) vs. all-meat
  (meat-lovers) — five recognizably different silhouettes, not five variations on one theme.
- **Implementable with current mechanics only** (§8/§9): every recipe is `spread`+`scatter`,
  one sauce, no finish/phase distinction.
- **Future reuse**: `ham`, `bacon`, and `black-olive` are each catalogued as feeding a *later*
  Class-D recipe (`calzone`/`quattro-stagioni`/`potato-bacon`) once `postBakeFinishing`/
  `quadrantPlacement` are eventually built — this batch is not a dead-end for those
  ingredients.

## 17. Alternative Batch — 5 recipes, visual/flavor-diversity focus

**hawaiian · ortolana · ricotta-bianca · ai-carciofi · boscaiola**

| Recipe | New ingredients | Ingredient count | Rationale |
|---|---|---|---|
| hawaiian | ham, pineapple | 4 | First sweet/fruit topping — highest single-recipe novelty value in the whole pool (visualDistinctiveness 5/5) |
| ortolana | bell-pepper, zucchini | 6 | First multi-vegetable "garden" pizza |
| ricotta-bianca | ricotta | 4 | Second no-tomato "white pizza" identity, distinct from fugazza/quattro-formaggi |
| ai-carciofi | artichoke | 4 | New vegetable, resolves artichoke's otherwise Class-D-only future use |
| boscaiola | *(none — zero new ingredients)* | 4 | Free/near-zero-risk "safety net" recipe, pure existing-ingredient reuse |

New ingredients required: `ham`, `pineapple`, `bell-pepper`, `zucchini`, `ricotta`, `artichoke`
— **6 new ingredients for 5 recipes** (vs. the Main Batch's 5-for-5), because this batch
optimizes for *each recipe introducing a visually/thematically new category* rather than for
tight in-batch ingredient sharing. `pineapple` and `zucchini` and `artichoke` and `ricotta` are
each single-recipe within this batch (no second Class-B recipe in the current 53-entry pool
reuses them) — a real cost the Master Catalog itself already flags per-ingredient
(`reusePotential: low` for pineapple).

**Comparison and recommendation:** the Main Batch is the lower-risk, tighter-reuse pick (5
ingredients doing double/triple duty, two genuinely new density-extreme play patterns, no
ingredient with `reusePotential: low`). The Alternative Batch buys more immediate visual/flavor
variety (fruit, multiple vegetables, a new cheese) at the cost of one extra new ingredient and
weaker in-batch reuse. **This audit recommends the Main Batch** — it satisfies the stated goal
list (§16 in the task) more completely without materially sacrificing visual distinctiveness
(pizza-bianca and supreme are each, in their own way, as visually distinct as hawaiian's
pineapple), and it keeps 3 of 5 new ingredients working double-duty inside the batch itself
rather than deferring their payoff to future Class-D recipes only.

If the product goal is explicitly "introduce a new flavor category (sweet) as soon as
possible" rather than "tightest possible reuse," swap `pizza-bianca` → `hawaiian` in the Main
Batch (keeps the batch at 5 recipes / 6 new ingredients, still zero new mechanic) — this is a
legitimate one-recipe substitution to flag for the product owner's own call, not a rejection of
either batch.

## 18. Implementation Slicing (Main Batch, if implemented)

Sized to 2–3 hour Claude Code sessions, following Batch 1A's own single-PR precedent but split
further here since this batch is one recipe larger and adds one more new ingredient:

- **Batch 1B-A** (2–3h): `pizza-bianca` + `breakfast-pizza` + their 2 new ingredients
  (`rosemary`, `bacon`) + Starter Grant/Shop price wiring for those two ingredients + recipe
  unit tests + Dex/Recipe-Select regression.
- **Batch 1B-B** (2–3h): `capricciosa` + `meat-lovers` + their 2 remaining new ingredients
  (`ham`, `black-olive`) + progression chain wiring (`requiresRecipeId` continuing from
  Batch 1B-A's `breakfast-pizza`) + Starter Grant floor tests (`ham` shared across both
  recipes).
- **Batch 1B-C** (2–3h): `supreme` + its one remaining new ingredient (`bell-pepper`) +
  final chain link + full-batch regression (all 16 recipes) + Human Feel pass (§19) for the
  whole batch, since `supreme`'s 8-ingredient density is the one recipe most likely to surface
  a tray/placement issue the earlier two slices wouldn't have hit.

No slice exceeds 2 recipes + shared ingredients, matching the task's own "no giant single PR"
instruction.

## 19. Human Feel Plan (for a future implementation task)

Per-recipe minimum, once implemented:

- careful / normal / sloppy placement pass for every one of the 5 new recipes
- Completion Gate boundary check (Completion Gate Phase 1 is FREE-only per its own merged
  scope — re-verify this still holds for the 5 new recipes specifically)
- Cooking Time (CT1/CT2) feedback check for each new `bakeTarget` range proposed in §16
- Starter Grant notice text/amount check for `pizza-bianca`'s (first recipe in the chain) and
  every ingredient-sharing pair (`ham` at capricciosa→meat-lovers, `bacon` at
  meat-lovers→breakfast-pizza, `black-olive` at capricciosa→supreme) to confirm the floor
  policy (§12) actually reads correctly in the in-game notice copy
- Economy: Shop restock flow for all 5 new ingredients once their Starter Grant is spent down
- 390×844 and 360×800 Ingredient Tray check specifically for `supreme` (8 ingredients — the
  recipe most likely to exercise the "Other" pagination + the full 8-slot required-ingredient
  row simultaneously) and `capricciosa`/`meat-lovers` (6 ingredients each)

## 20. Dependency Gate

Fresh-checked in-flight/parallel work (§0):

- **Issue #47 (Making UX Cleanup)**: open, P1 items unchecked in the issue body (HOME message
  clipping, duplicate FREE-mode button, Reference-for-non-Margherita, retry-same-recipe, "次へ"
  CTA thumb-reach). However, Batch 1A already shipped 4 more recipes (7 → 11) on `main` *after*
  this issue was opened, with a working Reference/Dex/Recipe-Select flow for all 11 (confirmed
  by `main`'s own merged history and the Batch 1A screenshots under
  `docs/reports/screenshots/batch1a-20260919/`) — so the specific "Reference doesn't generalize
  past Margherita" risk this issue names appears to already be resolved in practice, even
  though the issue itself remains open/unchecked. This is not a hard blocker for *data-only*
  recipe addition, but any Batch 1B implementation session should re-verify Reference/retry
  behavior for the 5 new recipes specifically, not assume it from Batch 1A alone.
- **Issue #89 (Full Game Reset)**: open, explicitly scoped to land "after the current 11-recipe
  Human Feel / tuning work" — which, per the merged `main` history (Human Feel Tuning 1A #103,
  Completion Gate Phase 1 #102, Cooking Time CT1/CT2 #99/#101), **appears to already be done**
  as of this audit's SHA. This makes Full Game Reset the *next* item the repository owner
  already signaled intent to prioritize, ahead of further recipe growth — a scheduling
  preference, not a technical blocker: Full Game Reset's own scope (§ in its issue body) already
  anticipates "recipe unlock progression" and "Starter Grant claimed state" growing over time,
  so it does not need Batch 1B to *not* exist first.
- **Issue #87 (Lunch Rush Online Ranking)**: open, Phase 0 only, explicitly gated on "the
  current 11-recipe Human Feel / Lunch Rush scoring semantics" being stable — unrelated to
  recipe *data* additions; a new recipe's score is computed identically to every existing one
  via Scoring 2.0 (confirmed authority-cutover complete per `PROJECT_HANDOFF.md`), so Batch 1B
  does not reopen this stability question.
- **Economy Tuning 2 / Progression Tuning**: **neither exists as a scoped Issue anywhere in
  this repository today** (confirmed by `grep` across `docs/` and the open-issue list) — they
  are referenced only as future intentions (e.g. `docs/reports/TETO_COMPLETION-GATE_PHASE1_Result.md`'s
  own forward-looking note). This is exactly why §11/§12/§14 above are marked provisional
  rather than final — there is no existing tuning target to conform to yet, only the existing
  Batch-1A-era formula/step pattern to extend consistently.

**Should Batch 1B implementation start now, or should design stay confirmed-and-waiting?**
Recipe-data expansion is structurally independent of the Making-flow UX cleanup (#47),
Full Game Reset (#89), and Lunch Rush Ranking (#87) — none of those tasks touches
`src/data/recipes.ts`/`src/data/ingredients.ts`, and Batch 1A's own successful 7→11 shipment
proves the pipeline (new ingredient rows + new recipe rows + chain-extend
`unlockCondition`/Starter Grant) works cleanly alongside exactly this kind of parallel work.
The one real caution is sequencing cost, not technical risk: implementing Batch 1B *before*
Full Game Reset means Full Game Reset's own implementation will need to account for 5 more
recipes' worth of Starter Grant/claimed-recipe state than it would today — a small, bounded
increase in that task's own scope, not a blocker to either task.

## 21. Final Verdict

**A. BATCH 1B DESIGN READY**

The Main Batch (§16: `pizza-bianca`, `breakfast-pizza`, `capricciosa`, `meat-lovers`,
`supreme`) is fully specified — ingredients, minCounts, bake targets, provisional progression,
provisional Starter Grant/pricing, Shop/Inventory/Dex impact, and a 3-slice implementation
plan — using only real, fresh-verified Master Catalog entries and zero new mechanics. Nothing
here requires Economy Tuning 2 or Progression Tuning to exist first; both are explicitly
provisional inputs this batch's own numbers are designed to be revisited by, exactly as Batch
1A's own numbers already were by Economy Tuning 1. The one open dependency worth resurfacing
at implementation time (not design time) is confirming Issue #47's Reference/retry findings
still hold for 5 more recipes specifically, and Full Game Reset (#89) is the repository owner's
own stated next priority — informational for sequencing, not a design blocker.
