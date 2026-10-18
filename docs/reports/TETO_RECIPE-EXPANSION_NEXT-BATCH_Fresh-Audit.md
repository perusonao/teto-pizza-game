# Recipe Expansion — Next Batch Fresh Audit (docs-only)

Audited base: `origin/main` `d611839` (#548, Square Dough F2), 2026-10-18. Branch `claude/recipe-expansion-next-batch-mdk2rm`.
Scope: audit + implementation plan only. **No code, no PR, no merge** (waiting for an Owner GO). #546 / #553 / #540 and the shared Preview were read (file lists only) and not touched.
Method limits: `node_modules` is absent in this environment, so no Vitest / ladder derivation was run; every number below is read from `src/data/*.ts`, `DISCOVERY_LADDER`, `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` and the earlier batch reports. `pizzadb.jp` was not re-read (agent proxy 403, same as the Grandma S3 report); source = the repo's 172 evidence rows.

## 1. Current state (main `d611839`)

| item | value | source |
|---|---|---|
| implemented recipes | **57** (No.1-57; last = `new-zealand-lamb-pizza`) | `recipes.ts`, `catalogLedger.test.ts` |
| ingredients | **64** (3 sauce-like: tomato-sauce / pesto / olive-oil; 50 toppings; 11 cheeses) | `ingredients.ts`, Batch 7a report |
| ladder | 53 steps (frozen 1-51, 52-53 = Batch 7a); credited 55; non-credit: `brazilian-calabresa`, `aussie` | `discoveryLadder.ts` |
| chapters | 6 / 11 / 16 / 24 (chapter = price tier of the key step: T1 1-5, T2 6-14, T3 15-29, T4 30+) | `recipeChapters.ts`, `materialShop.ts` |
| "172" | the PIZZA DB **source** list (not shipped). 172 matrix rows: 1 corroborated-shipped at generation, 67 READY, 19 READY_WITH_REVIEW, 85 BLOCKED_PRODUCT_DECISION | candidate matrix `summary` |

Matrix caveat: it was generated when 15 recipes were shipped, so its `newContentIngredientIds` and `shippedRecipeIds` are stale. All "new ingredient" counts below were **recomputed against the current 64 ingredients** (e.g. `fresh-tomato`, `lemon`, `chicken` are no longer new). Batch 7b (`salmon-roe` / `shiso` / `whitebait`) is recorded as "not started".

## 2. Priority candidates

Shared facts for all four: FULL representability (DOUGH round → optional SAUCE → CHEESE → TOPPING → BAKE → optional CUT), cheese base / `NO_SAUCE` (existing TQ-1D mechanic), thin standard dough (no DOUGH_VARIANT), no prep, no post-bake, no blocker in the matrix, no identity-set collision with any of the 57 shipped recipes (checked against every shipped ingredient set incl. sauce).

| candidate (matrix id) | identity set | new ingredients | new mechanic / step | duplicates | class |
|---|---|---|---|---|---|
| **チリアンナポリターナ** (`chilean-napolitana-pizzadb`) | fresh-tomato, mozzarella, oregano | **0** (fresh-tomato step 20, oregano step 11) | none | none; shares naming cluster NC-1 "Napoletana family" with shipped `napoletana` and the matrix-only Argentine row | **追加可能** (READY_WITH_REVIEW: naming, see §6-Q1) |
| **スパニッシュチョリソピザ** (`spanish-chorizo-pizza-pizzadb-p4`) | bell-pepper, mozzarella, onion, sausage | **0** (bell-pepper step 28; chorizo = existing `sausage`, source token canonicalised to `sausage` in the matrix) | none | none (nearest: `polish-kielbasa`, `salsiccia`, `brazilian-calabresa`: all different sets) | **追加可能** (READY; Q2: chorizo shown as the generic sausage) |
| **フランゴ・コン・カトゥピリ** (`frango-catupiry-pizzadb-p10`) | catupiry, chicken, mozzarella, oregano | **0** (catupiry step 44, chicken step 25) | none | none (`brazilian-catupiry-corn-pizza` = catupiry/corn/mozzarella) | **追加可能** (READY) |
| **しらすピザ** (`shirasu-pizza-pizzadb-p3`) | lemon, mozzarella, shiso, whitebait | **2** (`shiso`, `whitebait`; lemon exists, step 37) | no new mechanic; **new ladder step 54** (2 materials, like steps 28 / 37 / 53) | none | **要判断** (Owner Decision for shiso / whitebait taxonomy + glyphs, §6-Q3) |

## 3. Other candidates (existing materials, recomputed)

Zero-new, FULL, READY: only the three above. Everything else that is makeable with current materials falls into:

| class | candidate | reason |
|---|---|---|
| **要判断** (1 new material) | `tsukimi-pizza-pizzadb-p14` 月見ピザ (bacon, egg, green-onion, mozzarella) | FULL / READY, one new topping `green-onion` (credited step 54+, T4). Reserve/5th slot; needs family-row decision for `green-onion` |
| **要判断** (new sauce) | `flammkuchen-pizzadb` タルトフランベ | new sauce-like ingredient `fromage-blanc-sauce` (sauce profile + paint colour, sauce visual); no recipe uses it elsewhere |
| **要判断** (1 new) | `burrata` family, `pescatore` (mussel), `hot-honey-pepperoni` (honey), `pizza-alla-norma` (ricotta-salata) | 1 new material each, but also MULTI_SPREAD / LATE_ADDITION / COMPOSITION_CONFLICT (see next rows) |
| **依存待ち** (#540 Multi-Sauce Design Lock) | `burrata-pizza`, `pesto-burrata`, `pizza-alla-crudaiola`, `pescatore`, `sfincione`, `marinara`/`margherita` PIZZA DB variants | need >1 spread sauce; `grandma-pizza` (#540, Draft/HOLD) is the first such recipe and its Design Lock §8 items are still open |
| **依存待ち** (DOUGH_VARIANT / PAN_BAKE / ENCLOSE / FRY / ZONED / LATE_ADDITION not runtime-supported) | `pinsa-romana`, `piadina`, `ny-style`, `fathead`, `new-england-bar`, `montreal`, `pizza-al-taglio`, `cauliflower-crust`, `trenton-tomato-pie`, `quattro-stagioni`, `pizza-fritta`, calzone/stuffed family | the set is either identical to a shipped recipe (`pinsa-romana` = `jamon-serrano-pizza`; `fathead` / `new-england-bar` = `pepperoni`; `cauliflower-crust` = `margherita`) or differs only by a missing capability. Several are also Square Dough territory (tray / PAN_BAKE) |
| **見送り** (BLOCKED_PRODUCT_DECISION) | 85 rows: BASE_SAUCE_UNSPECIFIED (33), COMPOSITION_CONFLICT (27), UNRESOLVED_INGREDIENT (21), MECHANIC_INTERPRETATION (11) … | e.g. `pizza-zucchine-menta` (all ingredients exist, but "raw" mechanic interpretation is open) |

## 4. Impact assessment (per kind of recipe)

### A. Zero-material recipes (chilean / chorizo / frango)
They add **no ladder step** and no Shop row, so they must be `ladderCredit: false` non-credit branches (precedent: `brazilian-calabresa`, `aussie`, `grandma-pizza` #540). They are makeable as soon as their last material is owned, and — like grandma — stay in every later Research pool until found.

| recipe | makeable from | chapter | Research cohort effect (visible) |
|---|---|---|---|
| chilean-napolitana | step 20 (fresh-tomato) | 3 | joins `pesto-caprese`'s cohort → that Research entry gains an A/B letter (before: bare) |
| spanish-chorizo | step 28 (bell-pepper) | 3 | joins the step-28 cohort (`pesto-vegetariana`, `ratatouille-pizza`) → 2 → 3 entries |
| frango-catupiry | step 44 (catupiry) | 4 | joins `brazilian-catupiry-corn-pizza`'s cohort → gains an A/B letter |

- **Dex**: +3 recipes (57 → 60), Chapter 3 grows 16 → 18 (No.17-18), Chapter 4 +1 (24 → 25); ledger derived by `catalogLedger.test.ts`. Credited count stays 55; saves stay schema v2 (additive Dex ids).
- **Hint**: permanently key-free (`recipeHintRoles`, Hint 5.0 golden is append-only: Batch 7a added 405 lines / 0 deletions). The key-free population and the "sauce + cheese / cheese only" base-compat counts move by +3 (cheese-only for all three: NO_SAUCE).
- **Research**: letters change for existing entries (as the Grandma S3 report flagged for marinara) — needs Owner confirmation and `research-stable-identity` style E2E; Anti-Oracle gates (DH4 / Hint 5.0 production gate) must be re-run with the new recipes in `GATE_STATES`, no leak expected (no sauce, no multi-sauce).
- **Economy**: 0 Pitz spent on materials (nothing to buy beyond what a player owns at that step); no ladder shift; reward = `baseRewardPitz` (precedent 100; Owner calibrates). Because they are non-credit they cannot accelerate the ladder. `lunchRush: false` (precedent) → Lunch Rush pool stays 25 (opt-out list +3).
- **Counts / windows** (e.g. chilean fresh-tomato 3 / mozzarella 2 / oregano 1, bake ~56-76) are **gameplay calibration, not source**, to be confirmed by the Owner on Preview.

### B. しらすピザ (2 new materials)
- New ladder step **54** `["shiso","whitebait"]`, key recipe `shirasu-pizza`, T4 (first purchase 240 Pitz total, packs 120 / refill 60), credited (ladder 53 → 54 steps, credited 55 → 56), Chapter 4 +1. Research cohort key = last-unlocking material (single member, bare label).
- Needs OD-B7-1-style Owner Decision for the two ingredients: L1 family + glyph (`shiso` = herb, `whitebait` = seafood proposed in PR #255 as PROPOSED/NEEDS_REVIEW), G18 glyph-uniqueness check (class symbols 🥩🌊🥬🪴🧂🍇✨ must differ), dedicated icon optional (Ingredient Icon 2.0). B-1 of PR #293 blocks every topping id until its own decision, so this cannot ride on OD-B7-1.
- `TETO_PROGRESSION2_PHASE34_UNLOCKS.md` had sketched shiso / whitebait at 140 stars; Batch 6 already used star gates only for goat-cheese / spinach (OD-420-1). Whether shirasu gets a star gate is part of the Owner decision (default proposed: none, like Batch 7a).
- Overlaps with **Batch 7b** (ikura-salmon + shirasu): 7b is "not started" and its `salmon-roe` is out of this audit; shirasu is the only 7b recipe that is FULL/READY in the matrix.

## 5. OPEN PRs and Square Dough conflict check

Recipe-related OPEN PRs: **only #540** (`grandma-pizza`, Draft / HOLD, waits for Square Dough A-D, F). No open PR adds these four recipes or the materials shiso / whitebait / green-onion. Other OPENs are unrelated (#553 Square F3 result copy, #546 Square B2 tap/long-press, #478 placement drag, #468 mozzarella melt, #391 Lunch Rush v2 infra, taxonomy docs #255 / #293 / #296 which only *propose* classes, etc.).

| area | Square Dough files (#546 #553 #540 + merged D1/F1/F2) | next batch files | conflict |
|---|---|---|---|
| runtime | `src/logic/pan/*`, `SquareDoughLayer/Gauge`, `PizzaStage.tsx`, `App.tsx/css`, `ResultPanel.tsx`, `GameScreen.tsx`, `state/panShapeNotice.ts`, techniques / Dex gate tests | **none** (data-only: `recipes.ts`, `recipeSauceProfiles` (not needed: NO_SAUCE), `referencePizza.ts`, `discoveryCatalog.ts`, `orders.ts`, `recipeHintRoles.ts`, `hints.ts`, `ingredients.ts` (shirasu only)) | none |
| shared textual hot spots | #540 edits `recipes.ts` tail (No.58), `discoveryCatalog.ts`, `orders.ts`, `recipeHintRoles.ts`, `hints.ts`, `referencePizza.ts`, `recipeSauceProfiles.ts`, `hvSeeds.ts`, `catalogLedger.test.ts`, Hint 5.0 golden, Lunch Rush opt-out pin, many `e2e/*` "discovered" lists, `PROJECT_HANDOFF.md` | same files (additive tail edits) | **textual rebase conflicts** with #540 whoever lands second; semantic pins (counts, chapter slots, `NEXT_RECIPE_BATCH.afterRecipeId`) must be re-derived |
| Square candidates | `pizza-al-taglio`, `sicilian`, `detroit`, `new-england-bar`, `montreal`, `focaccia`… | **excluded** from this batch by design | none |

Conclusion: no functional conflict with the Square Dough work; one sequencing dependency with #540 (shared data/test files), plus grandma is placed after No.57 — Chapter 2 slot is unaffected by this batch (our recipes are in Chapters 3 / 4).

## 6. Proposed minimal batch

**Batch 8 (proposal): 4 recipes, 2 PRs.**

| PR | content | prerequisite |
|---|---|---|
| **PR-8a** | `chilean-napolitana`, `spanish-chorizo-pizza`, `frango-catupiry` (3 non-credit, 0 new ingredients, 0 ladder change) | Owner GO + answers to Q1, Q2, Q4, Q5 |
| **PR-8b** | `shirasu-pizza` + `shiso` + `whitebait` (ladder step 54, credited) | Owner GO + Owner Decision Q3 (and Q6 star gate) |

Reserve (5th slot): `tsukimi-pizza` (+ `green-onion`), requires its own family-row decision; not planned unless the Owner asks.

### Owner questions
- **Q1 name/identity**: matrix name is チリ**アン**ナポリターナ (Chile the country; no chili ingredient is involved). Your note says 「チリ風」 — confirm the display name; it shares naming cluster NC-1 with 「ナポリターナ」 (matrix-only Argentine variant is **not** in this batch).
- **Q2 chorizo**: use the existing `sausage` material (generic sausage glyph) rather than adding a chorizo ingredient? Recommended: yes (same as calabresa / kielbasa).
- **Q3 shiso / whitebait**: approve L1 families and glyphs (proposal: herb / seafood, glyphs to be checked by G18) as a batch-scoped OD, or defer PR-8b.
- **Q4 credit**: non-credit (`ladderCredit:false`) for all three, as the precedents? Recommended: yes — otherwise they shift later ladder steps.
- **Q5 Research letters**: accept that `pesto-caprese`, the step-28 pair and `brazilian-catupiry-corn-pizza` entries gain/lose letters (Grandma S3 precedent).
- **Q6 star gate for shiso / whitebait**: none (recommended).

## 7. Tests required (per PR) and implementation order

Order for PR-8a (same recipe as Batch 7a, `docs/reports/TETO_EXPANSION-BATCH-7A_Result.md`):
1. Re-verify G0 on current main (ladder derivation `buildAppendOnlyLadder` unchanged for steps 1-53; frozen prefix; `COHORT_LETTER_SHIFT` documented for the three cohorts; Hint 5.0 golden append-only).
2. Data: `recipes.ts` (append No.58-60 — or after #540 if it lands first), `referencePizza.ts` (8-slot ring, `LIGHT_LEAF` for oregano), `discoveryCatalog.ts` (target ids from the 172 evidence ids), `recipeHintRoles.ts` (key-free), `hints.ts`, `orders.ts`; no `recipeSauceProfiles` (NO_SAUCE), no `ingredients.ts`, no taxonomy rows.
3. Manifest `NEXT_RECIPE_BATCH` → `batch-8a`, `ladderCredit:false`, `lunchRush:false`, `cut:false`, `hint:"key-free"`; Lunch Rush opt-out list.
4. Update the single ledger `catalogLedger.test.ts` and pins that move (recipe tail, Dex/chapter sizes, key-free counts, cohort/Research labels, saves "discovered" lists in e2e seeds, hvSeeds).
5. Run: Recipe Batch Validator; `catalogLedger`; `discoveryLadder*` (appendOnly, ladderCredit); `hint5Ladder.golden`, `hint5Production.gate`, `deductionProduction.gate` (DH4), G7 / G17 / G18; `finalizeRound.test.ts` (needs Reference pizzas); `recipeChapters`; Research stable-identity; `cookingProfiles`; Lunch Rush exclusion; `tsc -b`, `oxlint`, `npm run build`.
6. E2E (iPhone 390×844 and 360×800): representative `e2e/expansion-batch8a.spec.ts` (cook each recipe in the normal flow → NEW DISCOVERY → Dex No., Research label letters before/after); fix `layout-contract` `ALL_RECIPES`-style lists; WebKit via CI only.
7. Human Verification per `TETO_HUMAN-VERIFICATION-POLICY.md`: 390×844 video delivered to the Owner (not committed) + before/after screenshots under `docs/reports/screenshots/expansion-batch8a/`; Owner confirms counts / bake windows and the Research letters.

PR-8b additionally: OD record (`docs/decisions/TETO_EXPANSION-BATCH-8_OWNER-DECISIONS.md`), `ingredients.ts` (pack size, `bakeRoastResistant` as appropriate for shiso as a leaf), `ingredientTaxonomy.ts` L1 rows with `OD-B8-1` comment, ladder step 54 (`POST_W1_APPENDED_STEPS`), materialShop rows / `nextMaterialHint`, Shop NEW rows + anonymous LOCKED section assertions (see the `batch6-pr3-hv` fix in the 7a report), G18 re-run, ladder golden append.

Recommended sequence: Owner answers → PR-8a → (OD) → PR-8b; coordinate with #540 (rebase whichever lands second; keep recipe tail order deterministic).

## 8. Not done

No code, no PR, no merge, no deploy; shared Preview, #546, #553, #540 untouched. Live PIZZA DB re-check, local test runs and WebKit were not possible in this environment.
