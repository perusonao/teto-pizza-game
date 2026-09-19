# Teto Pizza Game — Recipe Expansion Batch 1A: Implementation Result

## 0. Audited main SHA / duplicate PR gate

- Fetched `origin` fresh at task start. `origin/main` was at
  `5df955575fd01ea7b27f4e7cf01f7205f5af0d18` ("Economy Tuning 1: Shop TARGET prices, shared
  Starter Grant floor, Starter Grant notice (#98)") — matches the task's own "known latest
  main," confirmed via `git fetch origin main` / `git log`, not assumed.
- **Duplicate PR gate (before implementation):** listed every OPEN PR
  (`mcp__github__list_pull_requests`, state=open — #72 docs status fix, #46 Dough Shaping D0
  audit, #34 Reference-visual unification, #3 Phase 2 infra report) and ran
  `search_pull_requests`/`search_issues` for `recipe`, `batch`, `expansion`, `salsiccia`,
  `pepperoni`, `napoletana`, `tonno`, `ingredient`, and "Recipe Master Catalog". **No open PR
  or issue overlaps this task's scope.** The only matches were already-**closed** docs/research
  PRs (#77, #79, #81, #90, #95 — Economy & Progression design docs, Recipe Master Catalog
  research, Ingredient Economy audit, Ingredient Tray Scalability) that had already merged their
  useful output into `main` as `docs/design/TETO_RECIPE-MASTER-CATALOG.md` and
  `data/recipes/*.json` — read as background, not blockers.
- **Duplicate PR gate (re-run immediately before PR creation):** re-ran the same
  `list_pull_requests`/`search_pull_requests` queries; the open PR set was unchanged. No
  duplicate — proceeded to create the PR.
- Also checked branches: `claude/teto-recipe-expansion-20-0x9ykd` and
  `claude/recipe-master-catalog-1j9jrb` exist but have no open PR and are unrelated to Batch 1A
  (the "20" branch is a stale exploration of a different, larger-scope expansion; the catalog
  branch's content is already merged into `main`'s `docs/design/TETO_RECIPE-MASTER-CATALOG.md`).

## 1. Catalog Data Gate

Read `data/recipes/pizza_master_catalog.json` (Fresh Recipe Master Catalog v2.1, 53-entry
foundation) and `data/recipes/ingredient_master_catalog.json` directly as SSOT — **not** the
task prompt's own assumed values — and cross-checked against production `src/data/recipes.ts`/
`src/data/ingredients.ts` (7 recipes, 14 ingredients before this change).

### 1.1 Recipe table (catalog ground truth)

| Catalog id | nameJa | ingredients (catalog) | bakeProfile | mechanics | new ingredient | implementationClass | verificationStatus |
|---|---|---|---|---|---|---|---|
| `salsiccia` | サルシッチャ | mozzarella, sausage, tomato-sauce | 62–82 | spread, scatter | sausage | **B** | game_design_candidate |
| `pepperoni` | ペパロニ | mozzarella, pepperoni, tomato-sauce | 60–80 | spread, scatter | pepperoni | **B** | game_design_candidate |
| `napoletana` | ナポリ | anchovy, mozzarella, **oregano**, tomato-sauce | 48–68 | spread, scatter | anchovy | **B** | game_design_candidate |
| `tonno-e-cipolla` | トンノ・エ・チポッラ | mozzarella, **onion**, tomato-sauce, tuna | 55–75 | spread, scatter | tuna | **B** | game_design_candidate |

**Discrepancies found vs. the task prompt's assumptions (repository data took priority, per
instruction):**

- **Canonical id is `tonno-e-cipolla`**, not `tonno`. Used verbatim throughout.
- **`napoletana` requires 4 ingredients, not 3** — the catalog's own `ingredients` array
  includes `oregano` (an *existing* ingredient) alongside the new `anchovy`, not anchovy alone.
  Implemented as-is (no invented simplification).
- **`tonno-e-cipolla` requires 4 ingredients, not 3`** — includes `onion` (existing, shared
  with fugazza) alongside the new `tuna`.
- **`implementationClass` is `"B"` for all four, not `"A"`.** Per
  `docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` §9's own table, **Class A
  means "zero new ingredient, zero new mechanic" and is reserved exclusively for the 7 already-
  shipped Chapter-1 recipes — no catalog candidate qualifies for Class A "for free."** Class B
  means "new ingredient(s) only, existing `spread`/`scatter` mechanics" — exactly what the task
  prompt's own §3 ("各レシピにつき新材料1種類を想定") and §6 ("既存unlockConditionの範囲で実現")
  describe. This is a terminology mismatch in the task prompt, not a blocking data gap: the
  *substantive* requirement ("existing mechanics only, production-ready bakeProfile") holds for
  all 4, confirmed directly against the catalog's own `mechanics: ["spread", "scatter"]` field
  (both already used by every one of the 7 shipped recipes) and `bakeProfile` ranges (all within
  ~20-point spans matching production recipes, e.g. margherita 60–80, funghi 58–78).

No blocking data gap. `minCount` (not fixed by the 53-entry foundation for any candidate, per
the catalog's own `schemaNote`) is a Batch 1A-original decision — see §4.

## 2. Recipe table (as implemented)

| id | nameJa | description | existing ingredients used | new ingredient | bakeProfile | mechanics | source/status | production suitability |
|---|---|---|---|---|---|---|---|---|
| `salsiccia` | サルシッチャ | ゴロッとしたソーセージをのせた食べ応えのある一枚 | tomato-sauce, mozzarella | sausage | 62–82 | spread, scatter | catalog Batch 1 candidate, Class B | ✅ existing mechanics only |
| `pepperoni` | ペパロニ | 定番のペパロニピザ | tomato-sauce, mozzarella | pepperoni | 60–80 | spread, scatter | catalog Batch 1 candidate, Class B | ✅ |
| `napoletana` | ナポリ | 塩気のきいたアンチョビとオレガノの本格派ピザ | tomato-sauce, mozzarella, **oregano** | anchovy | 48–68 | spread, scatter | catalog Batch 1 candidate, Class B | ✅ |
| `tonno-e-cipolla` | トンノ・エ・チポッラ | ツナとたまねぎのさっぱりピザ | tomato-sauce, mozzarella, **onion** | tuna | 55–75 | spread, scatter | catalog Batch 1 candidate, Class B | ✅ |

`baseRewardPitz: 100` for all 4 (matches every existing recipe — Issue #38 V1: no
difficulty-based reward differentiation).

## 3. minCount design (Batch 1A-original decision)

The catalog's 53-entry foundation does not fix production `minCount` for any candidate (its own
`schemaNote`). Decided per-recipe against: existing recipes' own scatter density (2–4 per
topping, e.g. funghi's mushroom×3, quattro-formaggi's cheeses×2, fugazza's onion×4),
Ingredient Tray operability (no new placement mechanic, no scatter cap raised), and visual
balance on the pizza thumbnail (`getPlayerReferencePizza`'s 8-slot ring, confirmed no recipe
exceeds it — see §3.1).

| Recipe | requiredIngredients (id: minCount) | Total non-sauce pieces |
|---|---|---|
| salsiccia | tomato-sauce:1, mozzarella:2, sausage:3 | 5 |
| pepperoni | tomato-sauce:1, mozzarella:2, pepperoni:4 | 6 |
| napoletana | tomato-sauce:1, mozzarella:2, anchovy:3, oregano:1 | 6 |
| tonno-e-cipolla | tomato-sauce:1, mozzarella:2, onion:2, tuna:3 | 7 |

### 3.1 Scoring V2 Reference fixtures (required, not optional)

Discovered mid-implementation that `computeScoringV2` (`src/logic/scoringV2/index.ts`) returns
`available: false` / `totalScore: null` for any recipe with no `getReferencePizza` entry — i.e.
without authoring these, BAKE→RESULT could never produce a real score for the 4 new recipes.
This is load-bearing production data, not polish. Authored one `ReferencePizza` per new recipe
in `src/data/referencePizza.ts`, following the exact same visual-balance criteria the existing
7 recipes' (ChatGPT-reviewed, per B2) entries already use: positions spread within the dough's
radius-48 interior, no in-group collisions, standard 8/22 full/zero-credit tolerance (no
special-casing — none of these ingredients has an established physical-size difference from
mushroom/onion/etc., all render via the same generic emoji-chip path), `HEAVY_SQUASH` landing
style for every meat/fish group, `LIGHT_LEAF` reused for napoletana's oregano group (matching
its existing fugazza treatment). No external (ChatGPT/human) review ran for these — flagged as
a remaining risk in §16.

## 4. New ingredients table

| id | nameJa | emoji | category | placement | unlockCondition | starterGrantOnly | pricePitz | restockQuantity |
|---|---|---|---|---|---|---|---|---|
| `sausage` | ソーセージ | 🌭 | topping | scatter | `{ minTotalStars: 0 }` | true | **140** | **9** |
| `pepperoni` | ペパロニ | 🔴 | topping | scatter | `{ minTotalStars: 0 }` | true | **130** | **12** |
| `anchovy` | アンチョビ | 🐟 | topping | scatter | `{ minTotalStars: 0 }` | true | **110** | **9** |
| `tuna` | ツナ | 🐠 | topping | scatter | `{ minTotalStars: 0 }` | true | **120** | **9** |

- **`unlockCondition`/`starterGrantOnly`**: identical pattern to 9 of the 10 EP4 rows
  (mushroom/garlic/oregano/egg/pesto/cherry-tomato/gorgonzola/parmigiano/fontina) — `0` is inert
  (the Shop row is unconditionally hidden by `starterGrantOnly` until owned, see
  `ingredients.ts`'s own EP4 doc comment); first unit is always free via the governing recipe's
  Starter Grant, restock is the only paid transaction.
- **No new visual pipeline**: emoji-only, rendered via the existing generic
  `IngredientPieceVisual` topping path (toppings never use the `color` field — only cheese does,
  for its CSS custom property). No exact Unicode glyph exists for any of these foods; each
  reuses the closest distinct existing glyph, exactly like `pesto`/`basil` already sharing the
  herb emoji. Visually distinct from each other and from every existing topping (confirmed in
  the 11-topping Ingredient Tray screenshot, §11).

### Pricing rationale (no formula exists in this codebase — judgment call, stated explicitly)

Economy Tuning 1's own TARGET price table (`docs/reports/TETO_ECONOMY-TUNING-1_Implementation-Result.md`
§1) was hand-tuned per ingredient with no derivable formula (per-unit price ranges 6.1–35
Pitz/unit across existing ingredients with no pattern tied to category or minCount).
`restockQuantity`, by contrast, *does* follow an exact, already-established formula —
**`minCount × 3`** ("~3 recommended plays' worth per restock," confirmed against every existing
ingredient: mushroom 3×3=9, garlic 3×3=9, onion 4×3=12, cherry-tomato 3×3=9, gorgonzola/
parmigiano/fontina 2×3=6 each) — applied identically here (sausage 3×3=9, pepperoni 4×3=12,
anchovy 3×3=9, tuna 3×3=9).

For `pricePitz`, absent a formula, these 4 are priced in the **same upper-middle tier as the
existing "premium" flavor toppings** (mushroom 150, onion 170) rather than the cheaper produce
tier (garlic/oregano/cherry-tomato 55–90), since introducing meat/fish toppings is the same
kind of catalog-expanding event those two ingredients represented. Sausage/pepperoni priced
slightly higher (140/130) than anchovy/tuna (110/120) reflecting their higher per-recipe reuse
potential in the wider 53-entry catalog (sausage: 5 future recipes, pepperoni: 4; anchovy: 3,
tuna: 1 — `ingredient_master_catalog.json`'s own `usedByRecipeCount`). A 30-play sanity
simulation was not re-run for this batch (Economy Tuning 1's own simulation already validated
that the pricing philosophy doesn't soft-lock at these Pitz magnitudes; no scenario here departs
from that range) — flagged as a remaining risk in §16.

## 5. Starter Grant quantities

| Ingredient | minCount (governing recipe) | Starter Grant = minCount × 10 | restockQuantity |
|---|---|---|---|
| sausage | 3 (salsiccia) | **30** | 9 |
| pepperoni | 4 (pepperoni) | **40** | 12 |
| anchovy | 3 (napoletana) | **30** | 9 |
| tuna | 3 (tonno-e-cipolla) | **30** | 9 |

`mozzarella` (required by all 4) has no `unlockCondition` — it is a Starter (permanently
unlimited) ingredient exactly like `tomato-sauce`/`basil`, so `starterGrantForRecipe` correctly
skips it (no inventory entry ever created for it) — confirmed by a dedicated new test (§13) and
by the real-browser playthrough (mozzarella shows `∞` in Inventory, §14).

Shared-ingredient floor cases (Economy Tuning 1's P0b `Math.max(current, grantAmount)` rule,
proven general in that report's §2 and pre-declared "Batch 1A ready" in its §11):

- `napoletana`'s own `oregano` grant is `1 × 10 = 10`; marinara's own untouched grant (`20`)
  already exceeds it, so the floor leaves it unchanged at 20 (never stacks to 30).
- `tonno-e-cipolla`'s own `onion` grant is `2 × 10 = 20`; fugazza's own untouched grant (`40`)
  already exceeds it, so the floor leaves it unchanged at 40 (never stacks to 60).

Both cases pinned by dedicated tests (§13) and confirmed live in the browser playthrough (§14:
discovering salsiccia immediately cross-triggered pepperoni's own unlock gate in the same
`REGISTER_TO_DEX` call, producing a real Starter Grant notice for pepperoni — see the RESULT
screenshot).

## 6. Shop restock verification

All 4 new ingredients appear in the Shop **only once owned** (matching every other
`starterGrantOnly` row's suppression rule), with correct restock batch/price, confirmed live
(390×844, `docs/reports/screenshots/batch1a-20260919/shop-scrolled-new-ingredients-2.png`):

```
ソーセージ  在庫30  +9   140 Pitz
ペパロニ    在庫40  +12  130 Pitz
アンチョビ  在庫30  +9   110 Pitz
ツナ        在庫30  +9   120 Pitz
```

Atomic restock transaction (`restockIngredient`, `src/logic/economy.ts`) is unmodified generic
code — no new branch needed for these 4 ingredients (data-driven).

## 7. Unlock progression — "Batch 1A暫定progression"

No canonical post-フガッサ unlock specification exists anywhere in this repository (confirmed
by search — the catalog's own §11 "Batch 1" grouping is an *analysis-derived, alphabetical*
ROI ranking for a future Chapter, not a play-order). The following is a **Batch 1A暫定
progression** — a minimal, clear, linear extension of the existing 7-recipe chain, using only
the existing `unlockCondition` shape (no Chapter/Tier system):

```
margherita (always) → funghi → marinara → bismarck → genovese → quattro-formaggi → fugazza
  → salsiccia (requires fugazza discovered + 16 total★)
  → pepperoni  (requires salsiccia discovered + 20 total★)
  → napoletana (requires pepperoni discovered + 24 total★)
  → tonno-e-cipolla (requires napoletana discovered + 28 total★)
```

Thresholds continue the existing chain's own progression rate (quattro-formaggi:8 →
fugazza:12, Δ4) at the same or a slightly widening cadence (16→20→24→28, Δ4 each), reachable in
normal play (11 recipes × avg 2.5★ ≈ 27–28, well within a skilled player's reach, confirmed
live: a ★4-average playthrough crossed the pepperoni gate after only 8 discoveries). None of the
4 sets `mysteryLock` — fugazza's "big reveal" stays a deliberate one-off, not a new default
(matches the task's own Scope Guard against inventing new UX patterns).

- Margherita: unchanged, always available. ✅
- Recipes #2–#7 (marinara…fugazza): **zero fields changed**, unlock chain byte-identical to
  before this PR. ✅ (confirmed by a dedicated regression test, §13)
- New recipes don't unlock all at once from a fresh save — confirmed live (fresh-card-08/11
  screenshots, §14: salsiccia and tonno-e-cipolla both show real LOCKED cards with correct
  chain hints on a brand-new save).
- Starter Grant fires on each new unlock — confirmed live (§14 RESULT screenshot, §5/§13).
- Exact-once ledger — generic, unmodified `applyStarterGrants`/`starterGrantClaimedRecipeIds`
  code already handles any number of recipes; pinned per-recipe by new tests (§13).
- Recipe Select locked/mystery display — confirmed correct for all 4 (§14).
- Lunch Rush candidate selection — `availableOrders`/`getNextOrder`
  (`src/data/orders.ts`) already filters strictly by `availableRecipeIds`
  (`isRecipeAvailable`-derived); adding one `Order` entry per new recipe (with Mito dialogue
  lines matching the existing tone) is the only change needed, and a locked recipe is
  automatically excluded by the existing filter (generic code, no new logic).

## 8. Starter Grant UX

Reused PR #98's exact notice mechanism (`buildStarterGrantNotice`,
`src/state/starterStock.ts`) with **zero new code** — it already derives its message purely
from `grantedRecipeIds` and `getRecipe(id).nameJa`, so it works for any recipe automatically.
Confirmed live: `🎁「ペパロニ」の材料を最初の10回分プレゼントしました！` rendered on the RESULT
screen in the exact same card position/style as PR #98's own screenshots (see
`390x844-10-result-discovered.png`).

## 9. Recipe Select — 11-recipe Gate evaluation

**Existing single-screen pager (Issue #88) required zero changes.** It was already built
recipe-count-agnostic:

- `pagerIndicatorKind(total)` already switches from dot-row to a `"N / total"` counter above
  `PAGER_DOT_INDICATOR_MAX = 10` — 11 recipes crosses this threshold automatically. Confirmed
  live: `11 / 11` counter shown, **zero** `.pizza-select-dot` elements rendered (no 11-dot row).
- Confirmed at **390×844** and **360×800**:
  - No horizontal overflow at any point in either viewport (`scrollWidth <= clientWidth`
    checked programmatically after every navigation step — always `false`).
  - Locked/mystery display correct for the new recipes (real name + chain hint, e.g.
    「フガッサを1枚完成させると解禁」for salsiccia on a fresh save — see
    `fresh-card-08.png`/`fresh-card-11.png`).
  - Pager fully navigable end-to-end (前へ/次へ disabled correctly at both ends, tested up to
    and including recipe 11/11).
  - Current page / page count always visible (`N / 11`).
  - Recipe card never clipped/cut off at either viewport.
  - CTA (「このピザを作る！」) always reachable and correctly enabled/disabled.
  - 11-recipe selection did not feel materially more tedious than 7 in this pass — a full
    front-to-back traversal is 10 taps, matching the pre-existing pager's own linear-scan
    design; no usability blocker found.
- **Conclusion: existing pager is sufficient. No changes made.** (No Chapter UI, search, or
  favorites — Scope Guard held.)

## 10. Ingredient Tray evaluation

**Existing Recommended/Other split + "Other" pagination (Issue #86/PR #95) required zero
changes.** Confirmed live with all 11 toppings owned, preparing napoletana (anchovy + reused
oregano):

- "このピザにおすすめ" correctly shows exactly napoletana's own non-cheese requirements owned in
  the active category: オレガノ×20, アンチョビ×30 (mozzarella correctly excluded — it's a CHEESE-
  category Recommended item on that step, not TOPPING's).
- "その他" now holds 9 owned-but-not-recommended toppings (basil, garlic, cherry-tomato, egg,
  mushroom, onion, sausage, pepperoni, tuna) → correctly paginates at
  `MAX_INGREDIENT_PALETTE_SLOTS = 6`: page 1/2 shows 6, page 2/2 shows the remaining 3
  (sausage/pepperoni/tuna), confirmed via screenshot (`tray-topping-11-items-page1/2.png`).
- New ingredient visuals (🌭🔴🐟🐠) render distinctly, each with its correct finite stock count
  (`×30`/`×40`/etc.).
- Stock-0 disabled state: unmodified generic code path (`canPlaceIngredient`), not
  ingredient-specific — no separate test needed beyond the existing suite's coverage.
- FREE creativity unaffected — "その他" still exposes every owned ingredient regardless of the
  active recipe's requirements (confirmed: basil/garlic/cherry-tomato appear in salsiccia's own
  "その他" even though unrelated to salsiccia).
- Lunch Rush: `recipe` prop flows through identically for Mission play (Issue #86's own
  design — no mode branching exists to test).
- **Conclusion: no redesign needed.**

## 11. Inventory / Shop verification

- **Inventory**: all 4 new ingredients appear once owned, correct category (トッピング), correct
  `×N` stock, category tabs unaffected (generic `CATEGORY_ORDER`-driven code). Confirmed:
  `所持 16/18種` mid-playthrough, `18/18種` once all owned (see §13's test update and
  `inventory-scrolled.png`).
- **Shop**: all 4 restock successfully with correct price/quantity (§6); Pitz-insufficient
  disables the restock button (unmodified generic `restockIngredient`/`ShopOverlay` gate,
  price-agnostic); atomic transaction unchanged; the pre-EP4 manual-purchase path stays
  correctly retired for these 4 (`starterGrantOnly: true` suppresses their Shop row entirely
  until owned — confirmed no LOCKED/AVAILABLE_TO_BUY row for any of them on a fresh save).
- PR #97's shared Global Overlay shell rendering identically for both panels — no regression
  (same `.dex-overlay__panel` chrome, unmodified).

## 12. Visuals

No new visual pipeline, no SVG redesign, no Reference-visual overhaul (Scope Guard held). Each
new ingredient renders via the existing generic emoji-chip path
(`IngredientPieceVisual`/`ingredient-chip__emoji`) — the same path every non-cheese topping
already uses. Chosen emoji (🌭🔴🐟🐠) are visually distinct from every existing topping and from
each other, confirmed in the 11-topping tray screenshot. No exact-fidelity food emoji exists for
any of these four dishes in Unicode; this is noted as a minor visual-fidelity gap, not a
functional one (same category of approximation the existing catalog already accepts for
basil/pesto sharing one herb glyph).

## 13. Tests

Full new/updated test coverage, all passing:

- **Recipe data** (`src/data/recipes.test.ts`): 11 recipes total, ids unique, Batch 1A's 4
  validated for required-ingredients presence, valid bakeTarget, `baseRewardPitz: 100`, and a
  real chain `unlockCondition`. Pre-existing Starter-6 + fugazza assertions preserved unchanged.
- **New ingredients** (`src/data/ingredients.test.ts`): 4 new ingredients exist, TARGET prices
  and restockQuantity pinned by fixed-value assertions, total count 18, `starterGrantOnly`
  coverage assertion extended.
- **Sauce profiles** (`src/data/recipeSauceProfiles.test.ts`): all 11 recipes covered
  (`Record<RecipeId,...>` — a missing entry is a compile error, not just a test failure).
- **Progression** (`src/state/progression.test.ts`): "every other recipe unavailable on a fresh
  save" extended to all 10 non-margherita recipes with all-ingredients-owned isolation.
- **Starter Grant** (`src/state/starterStock.test.ts`): dedicated new `describe` block covering
  all 4 new recipes' exact grant amounts (mozzarella correctly excluded as Starter/unlimited),
  the two shared-ingredient floor cases (oregano vs. marinara, onion vs. fugazza), exact-once
  re-grant rejection for all 4 (parameterized), and `buildStarterGrantNotice` message content
  for all 4 (parameterized).
- **Recipe Select** (`src/screens/PizzaSelectScreen.test.tsx`): dot-mode test narrowed to an
  explicit 7-recipe subset (its original subject); new dedicated test confirms full production
  RECIPES (11) switches to counter mode with zero dots; fugazza-mystery navigation test fixed
  to navigate to fugazza's own index (no longer the last card) rather than
  `RECIPES.length - 1`. Every other pager test in the file was already recipe-count-agnostic
  and needed no change.
- **Ingredient Tray** (`IngredientTray.palette.test.tsx`): the "exactly 6 Other owned" boundary
  test's fixture explicitly pinned to the original 6 pre-Batch-1A toppings (was silently
  computing 10 via "every topping except onion" once the catalog grew).
- **Inventory/App** (`InventoryOverlay.test.tsx`, `App.test.tsx`): count assertions updated
  from 7/14 to 11/18 throughout.
- **Regression:** full existing suite re-run and green after every change.

**Full suite: 1479 tests passed (72 files)** — up from the pre-existing 1467 (12 net new
assertions folded into extended `describe.each`/`it.each` blocks, 0 removed).

## 14. Mobile Human Verification

Ran the real dev server (`npm run dev`) and drove it with headless Chromium (Playwright,
pre-installed browser) at both **390×844** and **360×800**, seeding `localStorage` saves that
place the player at realistic points in the new chain (rather than hand-waving through UI).

**Full flow, both viewports:** HOME → 「ピザを作る」 → Recipe Select (paged to サルシッチャ, shown
`NEW`) → PREPARE (radial dough stretch → sauce paint → mozzarella/sausage placement, all via
real pointer gestures, not scripted state injection) → 焼く！ → BAKE (waited for a real doneness
window) → 取り出す！ → RESULT/DISCOVERED → HOME → Inventory → Shop.

Key confirmed outcomes (screenshots in `docs/reports/screenshots/batch1a-20260919/`):

- Salsiccia's own Reference fixture (authored in §3.1) produced a **real score** (★2, 55点),
  proving the new Scoring V2 fixtures are functionally correct, not just non-crashing.
- `✨サルシッチャを発見しました！` (discovery) and `🎁「ペパロニ」の材料を最初の10回分プレゼント
  しました！` (a same-transaction chained Starter Grant, since this playthrough's totalStars
  crossed pepperoni's own gate the instant salsiccia was discovered) both rendered correctly —
  live proof the exact-once ledger and chain design generalize correctly, not just in unit
  tests.
- Pitz reward `+50` (100 base × 0.5 for ★2) — economy formula unaffected, works with the new
  recipe's `baseRewardPitz: 100`.
- Inventory: `ソーセージ ×27` (30 granted − 3 consumed by the bake) confirmed exact consumption
  bookkeeping; `レシピ 8/11` header count correct.
- Shop: all 4 new ingredients' restock rows correct (§6).
- **Zero console errors, zero page errors, at either viewport, across the entire flow.**
- **Zero horizontal overflow** (`document.documentElement.scrollWidth > clientWidth` checked
  after every navigation step — always `false`) at either viewport.
- Recipe Select pager usability and locked-card correctness confirmed separately on a fresh
  save across all 11 cards (§9).
- Ingredient Tray "Other" pagination confirmed with all 11 toppings owned (§10).

## 15. Save impact

**None.** No `PersistentSaveV2` field, schema version, or migration touched. Every new recipe/
ingredient is picked up automatically by the existing generic sanitization
(`sanitizeOwnedIngredientIds`/`sanitizeInventory`/`starterGrantClaimedRecipeIds` fallback-to-`[]`)
and the existing load-time `applyStarterGrants` catch-up call in `App.tsx` — confirmed live: a
save seeded with `starterGrantClaimedRecipeIds` stopping at fugazza correctly auto-granted
salsiccia's Starter Stock the instant it loaded, with no code change to the catch-up call site
itself.

## 16. Changed files

```
src/App.test.tsx                               |   7 +-   (recipe count 7->11 in 2 assertions)
src/components/IngredientTray.palette.test.tsx |   9 +-   (6-owned fixture pinned explicitly)
src/components/InventoryOverlay.test.tsx       |   8 +-   (14->18 count assertions)
src/data/ingredients.test.ts                   |  14 +-   (4 new TARGET price/restock rows)
src/data/ingredients.ts                        | +69      (4 new ingredients)
src/data/orders.ts                             | +24      (4 new Lunch Rush orders)
src/data/recipeSauceProfiles.test.ts           |   4 +-   (7->11 coverage count)
src/data/recipeSauceProfiles.ts                | +22      (4 new sauce profiles)
src/data/recipes.test.ts                       |  53 +-   (7->11 recipes, new Batch 1A suite)
src/data/recipes.ts                            | +76      (4 new recipes)
src/data/referencePizza.ts                     | +190     (4 new Scoring V2 Reference fixtures)
src/screens/PizzaSelectScreen.test.tsx         |  29 +-   (dot/counter mode split, fugazza index fix)
src/state/progression.test.ts                  |  11 +-   (6->10 "others" count)
src/state/starterStock.test.ts                 | +146     (Batch 1A Starter Grant test suite)
docs/reports/screenshots/batch1a-20260919/*    | 14 PNGs  (mobile verification evidence)
docs/reports/TETO_RECIPE-EXPANSION_BATCH-1A_Implementation-Result.md  (this file)
```

14 files changed in `src/`, +635/−27 lines. No files touched outside `src/` and `docs/`.

## 17. Remaining risks

- The 4 new Scoring V2 Reference fixtures (§3.1) were authored directly (visual-balance
  criteria only) with **no external ChatGPT/human review pass**, unlike the existing 7 recipes'
  B2-reviewed geometry. They are functionally correct (produce real, non-null scores — confirmed
  live) but their specific point placements are a first-pass judgment call, not a reviewed
  design artifact. Recommend a lightweight review pass in a follow-up if scoring "feels off" for
  these recipes in broader playtesting.
- `pricePitz` for the 4 new ingredients (§4) has no formula backing (matching the fact that no
  formula exists for *any* ingredient in this codebase) — a tier-based judgment call, stated
  explicitly, not derived from a fresh Human Feel pass or a 30-play sanity simulation specific
  to this batch.
- The Batch 1A unlock chain/thresholds (§7) are explicitly provisional — no canonical
  specification exists for post-フガッサ ordering. A future canonical Chapter 2 design could
  reorder or re-threshold these 4 without touching any ingredient/mechanic data.
- `RECIPE_HINTS` (`src/data/hints.ts`) was deliberately left unchanged for all 4 new
  recipes — this matches existing precedent (フガッサ itself has no dedicated hint set either,
  falling back to generic copy), not an oversight.

## 18. Recommendation for next Batch

Per the catalog's own §11 roadmap, **Batch 1's remaining 15 recipes** (of the original 19
zero-new-mechanic candidates) are the natural next slice — same `implementationClass: "B"`
economics (new ingredient data only), no new mechanic investment needed until Batch 2's
`postBakeFinishing`. Recipe Select's pager and Ingredient Tray's pagination are both already
proven to scale past 11 with zero component changes (§9/§10), so the next batch is purely a
data-authoring exercise plus the same Scoring V2 Reference-fixture authoring this batch
required (§3.1) — worth flagging that fixture authoring, not data entry, is now the actual
bottleneck per new recipe.

## FINAL VERDICT

**A. BATCH 1A COMPLETE — READY FOR MERGE REVIEW**
