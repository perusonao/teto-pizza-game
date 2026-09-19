# TETO Recipe Expansion — Chapter 2 / 20-Recipe Fresh Design

> **STATUS UPDATE (same session): superseded in structure, not in content.**
> Partway through this task, the task owner changed the primary goal from "design the next 20
> recipes" to **data-first**: build the fullest honest Recipe Master Catalog possible across
> many more candidates, analyze ingredient/mechanic reuse, and let that analysis determine
> implementation order — rather than pre-deciding a fixed batch of 20.
>
> **Nothing below was deleted or discarded.** Every recipe candidate, mechanic classification,
> naming-ambiguity note, and implementation-class judgment in this document was carried
> forward into the new, larger catalog. The current SSOT candidates are:
>
> - `docs/design/TETO_RECIPE-MASTER-CATALOG.md` (schema/policy — supersedes this document's
>   catalog *structure*)
> - `docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` (the data-derived
>   implementation roadmap — supersedes this document's §10–12 "expansion strategy," which is
>   now backed by actual computed analysis instead of design judgment alone)
> - `data/recipes/pizza_master_catalog.json` / `ingredient_master_catalog.json` /
>   `gameplay_mechanic_master.json` (machine-readable, includes every candidate below plus ~30
>   more)
>
> This document remains valuable as the **original per-recipe design rationale** for the 13
> selected + 3 deferred Chapter-2-era candidates below (§5–§9 in particular: the mechanic
> subsystem clustering analysis, the Bismarck `eggCenter` retrofit recommendation, and the
> ring-placement gap identification are all still current and are cited directly by the new
> report). Read this document for *why* a given recipe/mechanic decision was made; read the
> new report for *where it now sits in the full, data-derived implementation order*.

Status: **design candidate, READ-ONLY task — no `src/**` changes**
Audited `main` SHA: `8918fe4bd93816b0acefe4a35106fa1a4e8653e2`
Companion matrix: superseded by `docs/design/TETO_RECIPE-MASTER-CATALOG.md` (see status update above)
Companion report: superseded by `docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md`
Companion data: superseded by `data/recipes/pizza_master_catalog.json` (see status update above)

This document does not change `docs/design/PIZZA_GAME_SSOT.md`, Chapter 1's 7 recipes, or the
Economy & Progression 1.0 design. It is a parallel design track for **Chapter 2** (recipes
#8–#20), running independently of the EP1 Recipe Unlock foundation implementation in progress
in another session. Nothing here is wired into `src/**`.

---

## 1. Why this document exists (background, verified against current `main`)

- `docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md` (verdict D) confirmed the
  historical "160 canonical pizzas / 181 unique ingredients" figures were **never committed**
  to this repository as structured data — only a two-line prose summary survived in
  `docs/PROJECT_HANDOFF.md`, and that too was later deleted. The figures cannot be
  reconstructed from git history.
- PR #79 (`claude/recipe-master-catalog-1j9jrb`, open, base SHA
  `5d28c5dc996c0ea76aa6428f158a766165477213`) attempted fresh PIZZA DB (pizzadb.jp) research
  and found the site (and every other external domain tested) blocked at the network-egress
  layer this session. It catalogued the current 7 recipes / 14 ingredients as a
  source-tracked baseline instead, using the field `researchStatus:
  existing_game_data_unverified_against_pizzadb`. **This session inherited the same
  constraint** (see §2) and follows the same honesty discipline: no fabricated pizzadb.jp
  citations, no reconstruction of the 160/181 figures.
- This task's explicit goal is **not** to reach 160 in one step. It is to design a Recipe
  Master Catalog structure that scales `7 → 20 → 40 → 80 → ~160` safely, and to lock in the
  first 13 additions (recipes #8–#20) with enough design rigor (mechanic diversity,
  ingredient economy, implementation cost) to hand to a future implementation slice.

## 2. Source access status (this session)

External network access (pizzadb.jp, Wikipedia, or any other reference site) was not
exercised as part of this design pass — this was a deliberately offline, read-only design
session scoped to internal repo state plus general, independently-corroborated culinary
knowledge (see §3 for how that's used and labeled). This is consistent with PR #79's finding
that external access has been unreliable in this environment, and it means:

- Every recipe candidate below is checked against **general, widely-documented Italian/
  international pizza-menu knowledge** (multiple independent, well-established culinary
  facts — e.g. that Marinara pizza is traditionally cheese-free, that Calzone is a folded
  pizza, that "metà e metà"/half-and-half is a standard pizzeria practice) rather than a
  single named external source.
- No claim in this document is presented as "verified against pizzadb.jp." Every catalog
  entry's `researchStatus` field (§7, and in the JSON data file) says explicitly whether it
  is `general_culinary_knowledge_unverified_against_external_source` or
  `naming_ambiguous_needs_external_verification`. Nothing is marked as externally verified
  in this session.
- This does **not** block the game-design portion of the work (mechanic classification,
  tier placement, ingredient economy, catalog schema) — that work is possible and complete
  using existing repository conventions and general culinary classification, and is kept
  explicitly separate from source-verification status per the task's own instruction.

## 3. Source policy compliance (PIZZA DB)

Per `PIZZA_GAME_SSOT.md` §1: PIZZA DB (pizzadb.jp) is *inspiration/reference for UX and
world-view only*. Its text, images, and structured data are never copied into this game.
This design:

- Does not copy any PIZZA DB text, image, or structured data (none was even accessible this
  session — see §2).
- Treats every recipe candidate as **independently designed game data**, checked against
  general/independent culinary classification (the kind of fact available in most general
  pizza-cuisine references — regional origin, standard ingredient sets, standard
  preparation), not against any single proprietary catalog.
- Flags every real-world naming ambiguity explicitly (§5.3) rather than silently picking one
  interpretation.

## 4. Existing Chapter 1 (unchanged)

The 7 shipped recipes and their ingredients are **not modified** by this document. Restated
here only for cross-reference:

1. Margherita — tomato-sauce, mozzarella, basil
2. Funghi — tomato-sauce, mozzarella, mushroom
3. Marinara — tomato-sauce, garlic, oregano (no cheese)
4. Bismarck — tomato-sauce, mozzarella, egg
5. Genovese — pesto, mozzarella, cherry-tomato
6. Quattro Formaggi — olive-oil, mozzarella, gorgonzola, parmigiano, fontina
7. Fugazza — olive-oil, onion, oregano (no cheese, no tomato)

14 existing ingredients: tomato-sauce, olive-oil, pesto (sauce); mozzarella, gorgonzola,
parmigiano, fontina (cheese); basil, garlic, oregano, cherry-tomato, egg, mushroom, onion
(topping).

Economy & Progression 1.0's Chapter 1 `starterStockPlays = 10` value and its `requiresRecipeId`
unlock chain for recipes #1–#7 are unchanged by this document.

## 5. Selecting the next 13 (methodology)

### 5.1 What "mechanic diversity" means here

Per the task's explicit priority, candidates were **not** ranked by fame alone. Each
candidate from the required-consideration pool (and one addition, §5.4) was scored against
all 14 evaluation axes the task specifies (sauce action, scatter, center placement, ring
placement, half-and-half, quadrant placement, finishing ingredient, bake timing, ingredient
density, visual identity, difficulty progression, existing-ingredient reuse, new-ingredient
introduction, character/gameplay compatibility). The goal was to avoid a set of 13 recipes
that all just add "one more scatter topping on a tomato-mozzarella base" — that pattern
already exists 4 times in Chapter 1 (Margherita/Funghi/Bismarck family) and adding more of it
would not grow the *game*, only the *data*.

### 5.2 Required-consideration pool: full disposition

| Candidate | Disposition | Why |
|---|---|---|
| Pepperoni | **Selected** | Iconic onboarding recipe for Chapter 2; reuses 2/3 existing ingredients; deliberately kept Class B/simple as a "soft start" after the Chapter 1 → 2 transition. |
| Prosciutto | **Selected** | Real-world prosciutto crudo is added *after* baking to stay uncooked/fresh — this is the flagship for a genuinely new `postBakeTopping` mechanic (see §6.1), not a reskinned scatter recipe. |
| Prosciutto e Funghi | **Deferred (Class E)** | A straight combination of the Prosciutto post-bake mechanic and the already-shipped Funghi scatter pattern. Adds no mechanic beyond Prosciutto alone; would violate the "don't just multiply the same operation" instruction. Good 40-tier filler once `postBakeTopping` ships and needs a second low-effort recipe to exercise it. |
| Diavola | **Selected** | Real-world Diavola is frequently finished with a post-bake chili-oil drizzle (`olio piccante`) — a second, distinct `postBakeTopping` sub-case (drizzle vs. scatter). Selected specifically to diversify the finishing-ingredient axis, not merely to add another spicy-salami scatter recipe. |
| Capricciosa | **Selected** | High-topping-density "everything" pizza (ham, mushroom, olive). Chosen over a strict quadrant interpretation (see Quattro Stagioni below) to keep it Class B/C and to introduce `ham`/`black-olive`, both of which are reused by Quattro Stagioni and Hawaiian — good ingredient economy. |
| Quattro Stagioni | **Selected — flagship quadrant recipe** | The task explicitly asks this to be evaluated as the new 4-quadrant-placement candidate. Selected as the single Class D quadrant-placement recipe (see §6.2); deliberately *not* duplicated by also making Capricciosa quadrant-based. |
| Napoli / Napoletana | **Selected** | Simple, fast-bake, anchovy-driven recipe; reuses tomato-sauce/mozzarella/oregano. Naming ambiguity flagged (§5.3). |
| Romana | **Deferred (Class E)** | "Romana" most commonly distinguishes a *thin/crisp crust style*, not a fixed topping set — in some usages it is topping-identical to Napoletana with only a dough-thickness difference. The current game has no dough-thickness gameplay dimension (Chapter 1/2A froze that as out of scope), so this candidate cannot be meaningfully differentiated from Napoletana with the mechanics available. Deferred rather than fabricating a distinguishing topping set. |
| Ortolana / Vegetariana | **Selected as "Ortolana"** | Garden-vegetable pizza; introduces `zucchini`/`bell-pepper`, both high-reuse for future vegetable-family expansion. "Vegetariana" kept as a flagged alias, not the primary name (§5.3 — "Vegetariana" is a broad category term, not a specific dish). |
| Tonno e Cipolla | **Selected** | Reuses `onion` (already introduced by Fugazza) plus one new ingredient (`tuna`) — strong existing-ingredient reuse, distinct flavor/visual identity from every other Chapter 2 recipe. |
| Salsiccia | **Selected** | Simple sausage-topped recipe; keeps the "easy tier" well-populated without duplicating Pepperoni's exact visual (coiled/chunk sausage vs. pepperoni discs). |
| Frutti di Mare | **Selected, ingredient-simplified** | Full traditional seafood mix (clams, mussels, shrimp) would need 3+ new ingredients for one recipe (cost warning territory). Simplified to a `shrimp` + `parsley`-garnish version, olive-oil base, no cheese (reuses the `noCheese` pattern already shipped by Marinara/Fugazza) and a distinctly *shorter* bake window (seafood overcooks fast) — genuinely different bake-timing identity, not just another topping swap. |
| Calzone | **Selected — explicitly Class D, fold mechanic** | Per the task's own instruction, kept in its own implementation class, not treated as equivalent to a placement-only recipe. See §6.4. |
| Hawaiian | **Selected** | High visual distinctiveness (pineapple), reuses `ham` (introduced by Capricciosa). Deliberately positioned as **Early** tier — it's mechanically simple (Class B) even though culturally "controversial"; difficulty tier tracks mechanic complexity, not debate intensity. |
| Fugazzeta | **Deferred (Class E)** | Fugazzeta is a *stuffed* variant of Fugazza (cheese folded/stuffed between two dough layers) — structurally the same family of problem as Calzone's fold mechanic. Including both now would pay the "new structural mechanic" design cost twice for one axis (fold/stuff) at the 20-recipe stage. Deferred to the 40-tier, once Calzone's fold subsystem exists and can be reused/extended rather than redesigned. Also explicitly distinct from Fugazza per the task's own naming note — recorded, not merged. |

### 5.3 Naming ambiguities flagged (not resolved by fiat)

- **Marinara** (already shipped): "marinara sauce" in Italian-American usage usually means a
  tomato-garlic-herb *pasta* sauce, not the pizza. Carried over from PR #79's finding,
  unchanged here (Chapter 1 recipe, not touched).
- **Genovese** (already shipped): "alla Genovese" in Naples usually names a slow-cooked
  onion ragù (unrelated to Ligurian basil pesto). Carried over from PR #79, unchanged here.
- **Quattro Formaggi vs. Quattro Stagioni** (already shipped vs. new #18): unrelated dishes
  that share the "Quattro ___" naming pattern; flagged so a future session never merges them.
- **Napoletana vs. Romana**: overlapping topping sets in some regional usages; the
  distinguishing factor (crust thickness) isn't a game mechanic today. See §5.2's Romana
  disposition.
- **Vegetariana vs. Ortolana**: "Vegetariana" is a broad category label (any meat-free pizza
  qualifies), not one specific topping set — could later collide with Marinara or Fugazza,
  which are also meat/cheese-free. "Ortolana" (garden-style: zucchini, bell pepper, onion,
  cherry-tomato) is used as the specific, disambiguated recipe identity; "Vegetariana"
  recorded only as an alias.
- **Prosciutto (crudo) vs. ham (cotto)**: "Prosciutto" alone is ambiguous in English —
  *prosciutto crudo* (raw-cured, added post-bake, recipe #15) and *prosciutto cotto* (cooked
  ham, added pre-bake like an ordinary scatter topping, used by Hawaiian/Capricciosa/Quattro
  Stagioni) are different ingredients with different mechanics. Modeled as two separate
  ingredient ids (`prosciutto-crudo`, `ham`) specifically so this ambiguity can't silently
  collapse into one ingredient later (see §7).
- **Fugazza vs. Fugazzeta**: distinct dishes (unstuffed vs. cheese-stuffed onion focaccia);
  see §5.2's Fugazzeta disposition. Not merged.
- **Diavola's spicy salami vs. Pepperoni**: visually and conceptually close (both are cured,
  scattered, round meat toppings). Flagged explicitly rather than pretending they're more
  different than they are — the two recipes are differentiated primarily by Diavola's
  post-bake chili-oil finishing step, not by the meat topping alone. If a future review
  judges this insufficient differentiation, Diavola is the more replaceable of the two
  (Pepperoni's onboarding role is harder to substitute).

### 5.4 One addition outside the required-consideration pool: Mezza e Mezza (Half-and-Half)

The task lists "half-and-half" as a required evaluation axis, but no candidate in the
required-consideration pool is a half-and-half dish. Rather than force an artificial
half-and-half variant onto an unrelated named pizza (which would misrepresent that dish),
this design adds **Mezza e Mezza** ("half and half") as its own catalog entry — the
well-established, general pizzeria practice of splitting one pizza into two different
recipes' worth of toppings, one per half. This is not a single fixed named dish; it's a
*serving format* layered on top of two already-catalogued recipes, which is exactly why it
needs its own mechanic (see §6.3) rather than its own fixed ingredient list. Flagged
`general_culinary_knowledge_unverified_against_external_source` like every other entry, and
flagged separately as a **product-design decision, not a menu-fact question** (§9).

## 6. New gameplay mechanics introduced (clustered, not per-recipe)

A key finding of this design pass: **6 of the 13 new recipes are Implementation Class D, but
they only require 4 distinct new subsystems**, because 3 of them share one mechanic. This
matters for sequencing a future implementation slice — build each subsystem once, and it
unlocks every recipe that depends on it.

### 6.1 `postBakeTopping` (shared by Prosciutto #15, Diavola #16, Frutti di Mare #17)

A new PREPARE-adjacent step after BAKE and before RESULT: certain ingredients (flagged
`finishingOnly: true` in a future `Ingredient` schema extension) can only be placed in this
new step, never before baking. Two placement sub-styles both need to be covered by this one
subsystem:

- **Scatter finishing** (Prosciutto's raw ham + arugula; Frutti di Mare's parsley garnish) —
  reuses the existing scatter placement UI, just gated to fire after BAKE.
- **Drizzle finishing** (Diavola's chili-oil) — reuses the existing spread/paint mechanic
  (`sauceField.ts`), also gated to after BAKE, rather than requiring new interaction code.

Because both sub-styles reuse existing placement primitives (scatter, spread) and only need a
new *phase gate*, this is the cheapest of the 4 new subsystems to build, despite unlocking 3
recipes.

### 6.2 `quadrantPlacement` (Quattro Stagioni #18 only, for now)

The single biggest scoring-model change: today, per `PIZZA_GAME_SSOT.md` §8, "配置した位置
や個数は自由" — placement location is deliberately *not* scored, only ingredient-type
presence/absence and bake timing are. Quattro Stagioni requires the opposite: 4 different
toppings, each restricted to one quadrant (divided by angle from `DOUGH_CENTER`, using the
existing `pizzaCoordinates.ts` coordinate space — `distanceFromCenter`/angle math already
exists for the dough-radius clamp, so quadrant math is a natural extension, not a new
coordinate system). This is a genuinely new *scoring* dimension, not just a new ingredient,
which is why it's Class D and reserved for **Master** tier.

### 6.3 `halfAndHalfSplit` (Mezza e Mezza #19 only)

Requires the `Recipe` data shape itself to gain an optional "composite" form (two
`RecipeId`s instead of one flat `requiredIngredients` list), a split-canvas PREPARE UI (left/
right half independently painted/topped), and a scoring change that judges each half against
its own recipe and combines the two results. This is a **product decision**, not just an
engineering task — see §9 for the open question (which two recipes can be combined, and
whether it's player-chosen or ORDER-randomized).

### 6.4 `foldDough` (Calzone #20 only)

Per the task's explicit instruction, kept in a class of its own. Requires: a new Making-flow
step (fold the prepared dough closed before BAKE), a way to represent "hidden" interior
toppings (mozzarella/ricotta/ham placed before the fold are no longer individually visible or
correctable afterward — a real risk/commitment mechanic that doesn't exist anywhere else in
the game today), and a different baked-visual state (closed dough, egg-wash-style sheen
instead of visible toppings). Explicitly **not** merged with Fugazzeta (§5.2) at this stage.

### 6.5 Axes evaluated but not covered by any of the 13 (explicit gap, not silently dropped)

- **Ring placement** (e.g. a stuffed-crust ring, cheese piped around the cornicione): no
  candidate in the required-consideration pool cleanly maps to this without inventing a
  fictional dish. Recorded as an **open gap for the 40-tier**, not forced into Chapter 2.
  A stuffed-crust-style dish is the natural future candidate once a `foldDough`-adjacent
  crust-modification subsystem exists (see §10).
- **Center placement** (`eggCenter`): already identified by PR #79 as an implementation gap
  on the *existing, unchanged* Bismarck recipe (#4) — the real dish's whole-egg-in-center
  presentation isn't currently distinguished from ordinary scatter placement. This design
  deliberately does **not** introduce a second, new center-placement recipe to duplicate
  that axis. Recommendation: a future slice should build `centerPlacement` as a small,
  focused extension and retrofit it onto Bismarck (non-breaking — Chapter 1's recipe data
  doesn't change, only its scoring/visual treatment gains precision), rather than treating
  center placement as unaddressed. This reuses an existing recipe instead of manufacturing a
  duplicate one, consistent with the task's "don't just add the same operation repeatedly"
  instruction.

## 7. Ingredient Master (new ingredients only — see MATRIX doc for full per-recipe detail)

17 new ingredients are introduced across the 13 recipes (14 existing + 17 new = **31 total**
ingredients at the 20-recipe stage). *(Superseded count: the full Master Catalog widened this
to 48 new / 62 total ingredients — see `data/recipes/ingredient_master_catalog.json` and
`docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` §5–7 for the current,
computed per-ingredient usage/reuse data.)

**Cost-warning flags** (per the task's instruction to flag ingredients added for only one
recipe with low reuse potential):

| Ingredient | Recipes using it | Cost note |
|---|---|---|
| `artichoke` | Quattro Stagioni only | Single-recipe-bound today; kept because Quattro Stagioni's quadrant mechanic genuinely needs a 4th visually distinct topping and the other 3 quadrant slots (ham, mushroom, black-olive) are already reused elsewhere. Reuse potential at 40-tier: moderate (other Italian "four seasons"-adjacent or antipasto-style dishes). |
| `chili-oil` | Diavola only | Single-recipe-bound today. Justified by being the concrete mechanism that differentiates Diavola from Pepperoni (§5.3) rather than a pure flavor variant. Reuse potential: moderate (future spicy-pizza sub-family). |
| `ricotta` | Calzone only | Single-recipe-bound today, but Calzone is intentionally a one-off Class D showcase at this stage; ricotta is the traditional filling cheese and has moderate reuse potential once a stuffed/white-pizza sub-family grows at 40-tier. |
| `tuna` | Tonno e Cipolla only | Single-recipe-bound today. Reuse potential: moderate (future seafood-adjacent recipes alongside `shrimp`). |
| `pineapple` | Hawaiian only | Single-recipe-bound today. Kept for maximum visual distinctiveness/cultural recognizability; reuse potential is low outside a "Hawaiian family" unless one is deliberately built at 40-tier. |

No ingredient in this batch required adding *more than 2* new ingredients to unlock a single
recipe, and the two heaviest recipes by new-ingredient count (Ortolana: zucchini + bell-pepper;
Prosciutto: prosciutto-crudo + arugula) both introduce ingredients with above-average reuse
potential, so neither is flagged.

## 8. Progression tiers

| Tier | Recipes | Count |
|---|---|---|
| Starter (existing) | Margherita, Marinara | 2 |
| Early (existing: 2, new: 4) | Quattro Formaggi, Genovese, **Pepperoni, Napoletana, Hawaiian, Salsiccia** | 6 |
| Mid (existing: 2, new: 3) | Bismarck, Funghi, **Tonno e Cipolla, Ortolana, Capricciosa** | 5 |
| Late (existing: 1, new: 3) | Fugazza, **Prosciutto, Diavola, Frutti di Mare** | 4 |
| Master (new: 3) | **Quattro Stagioni, Mezza e Mezza, Calzone** | 3 |

(Existing-recipe tier labels above follow PR #79's already-catalogued `gameDesign.
progressionTier` values, carried over for consistency — not newly assigned here.) Master
tier is introduced for the first time in Chapter 2, reserved exclusively for the 3 recipes
that need a wholly new subsystem beyond `postBakeTopping` (§6.2–6.4).

## 9. Connection to `starterStockPlays` tiering (design-only, no new values confirmed)

Economy & Progression 1.0's matrix (`TETO_ECONOMY-PROGRESSION-1_MATRIX.md` §4) already
carries a **forward note, not a Chapter 1 decision**: once the catalog grows past Chapter 1,
`starterStockPlays` is expected to become tier-scoped rather than a single global `10`, with
an *illustrative* table (`starter: 10, early: 10, mid: 5, late: 3, master: 0–3`). This design
maps Chapter 2's 13 recipes onto that same illustrative tiering **for connection purposes
only** — no concrete number is being confirmed or implemented here, and Chapter 1's existing
`starterStockPlays = 10` value and its 10-play semantics are unchanged:

| Tier | Chapter 2 recipes | Illustrative `starterStockPlays` (unconfirmed) |
|---|---|---|
| Early | Pepperoni, Napoletana, Hawaiian, Salsiccia | 10 (same as Chapter 1) |
| Mid | Tonno e Cipolla, Ortolana, Capricciosa | 5 |
| Late | Prosciutto, Diavola, Frutti di Mare | 3 |
| Master | Quattro Stagioni, Mezza e Mezza, Calzone | 0–3 (open question — see §11) |

This table exists so a future EP2/EP3-style implementation slice has a starting point to
debate, not so it can be implemented directly. The exact `requiresRecipeId` unlock chain
(linear like Chapter 1's #1→#7, vs. a branching per-tier structure) is also **not decided
here** — flagged as an open product decision in §11.

## 10. 20 → 40 → 80 → 160 expansion strategy

The goal at this stage is a **schema and a set of classification axes**, not 140 more
recipes. Every future batch should be classified along the same axes used here:

1. **Mechanic-subsystem-first sequencing.** Before adding a recipe, ask "does this need a
   subsystem we don't have yet, or does it reuse one we just built?" Chapter 2's own
   `postBakeTopping` subsystem (§6.1) is deliberately sized to unlock 3 recipes at once — the
   40-tier batch should look for the next 2–4 recipes that share a not-yet-built subsystem
   (ring placement is the leading open candidate, §6.5) before reaching for more single-off
   Class A/B recipes.
2. **Ingredient-reuse-first ingredient budget.** Track a running ratio of
   `new ingredients added / new recipes added` per batch. Chapter 2's ratio is
   17/13 ≈ 1.3. A future batch that pushes this ratio materially higher (e.g. many
   single-recipe regional specialty ingredients) should be treated as a cost signal requiring
   explicit justification per ingredient, exactly as §7's cost-warning table does here — not
   as an automatic block, since some genuinely novel recipes will need it, but as a forcing
   function to ask the reuse question every time.
3. **Naming-ambiguity ledger.** §5.3's table should be extended, not restarted, at each
   batch. Recipes with unresolved regional-naming disputes (à la Romana, §5.2) should default
   to deferral over fabricated disambiguation.
4. **Tier ceiling per batch.** Chapter 2 introduces Master tier for the first time. Each
   future batch (40, 80, 160) should introduce at most one *genuinely new* difficulty/tier
   concept beyond extending existing tiers with more recipes — avoid runaway tier
   proliferation that dilutes the 5-tier structure this design establishes.
5. **Duplicate-prevention validation** (schema-level, for `data/recipes/*.json`, mirroring
   and extending PR #79's own validation script, not replacing it):
   - Every `id` (recipe and ingredient) must be globally unique — enforced by a script check,
     not just convention.
   - Every `nameJa`/`nameOriginal` pair must be checked against the existing catalog for
     near-duplicates (Levenshtein or simple substring match) before being added; a match
     must be resolved as either an `alias` of an existing entry or a flagged ambiguity
     (§5.3's table), never silently merged or silently duplicated.
   - Every new ingredient's `usedByRecipeCount` must be derived (cross-referenced from the
     recipe list), never hand-maintained, exactly as PR #79's schema already requires.
   - Every recipe/ingredient must carry a verification-status field (implemented as
     `verificationStatus` in the current Master Catalog, see
     `data/recipes/pizza_master_catalog.json`) that is never silently upgraded to "verified"
     without an actual external-source check being performed and logged.
   - A future validation script should also check the **mechanic-subsystem clustering ratio**
     from point 1 above and flag a batch that introduces "1 subsystem : 1 recipe" too many
     times in a row, as a design-review prompt (not a hard block).

## 11. Unresolved product decisions (not decided by this design)

1. **Mezza e Mezza's recipe-pairing rule**: which two recipes can be combined (any two
   unlocked recipes? a curated subset? player-chosen at ORDER time vs. randomized?), and how
   its `bakeTarget` is derived when the two component recipes have non-overlapping bake
   ranges (e.g. a fast-bake seafood recipe paired with a dense Calzone-adjacent one — this
   specific pairing should probably be disallowed, but the general rule needs product input).
2. **Chapter 2's unlock chain shape**: continue Chapter 1's strict linear `requiresRecipeId`
   chain (#8 requires #7, #9 requires #8, …) or move to a branching/tier-gated structure now
   that Master tier exists. This directly affects how `starterStockPlays` tiering (§9) would
   actually be wired in.
3. **`postBakeTopping` UI feel**: whether the new post-bake step should feel like "one more
   required phase" (risk: adds friction to every recipe using it) or an optional flourish
   with its own light feedback moment — a Human-Feel-style playtesting question, not
   something this design session can answer alone.
4. **`quadrantPlacement` tolerance**: how strict the angle-based quadrant boundaries should
   be (hard boundary vs. soft/weighted scoring near the border) — a balance question that
   needs either playtesting or an explicit product call, since it directly affects how
   frustrating/rewarding Quattro Stagioni feels.
5. **Whether "Vegetariana" should exist as a second, later catalog entry** distinct from
   Ortolana (e.g. a broader meat-free tag applied across several existing recipes) rather
   than being fully absorbed as an alias — flagged in §5.3 but not resolved.

## 12. PR #79 recommendation (superseded — see current recommendation below)

*(Superseded: this section's original "update and reuse" recommendation was based on a
13-recipe-scale comparison. Once the catalog widened to 53 entries, the recommendation
changed to "close PR #79 in favor of the new catalog" — see
`docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` §13 for the current reasoning.
Original text kept below for traceability.)*

See `docs/reports/TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` §13 ("PR #79 disposition
recommendation") for the current reasoning. Original (superseded) summary: **update and
reuse**, not supersede-and-abandon or close. PR #79's schema (`pizza_master_catalog.json` /
`ingredient_master_catalog.json` field shapes) is sound and this design's JSON data file
follows it closely with one addition
(`sourceVerificationStatus`, made a required field per this task's explicit instruction). The
cleanest continuation is for a future session to merge this design's 13 new candidates into
PR #79's existing catalog files (or a follow-up PR built on top of it) once the product
decisions in §11 are resolved — not to redo PR #79's already-sound baseline cataloguing of
the current 7 recipes.
