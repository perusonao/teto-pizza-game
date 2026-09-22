# TETO Recipe Discovery Progression 2.0 — Draft (Issue #182, Phase 0)

Status: **Draft — comparison/candidate document only. Does NOT overwrite
`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`, which remains the current production SSOT.**
No unlock threshold, no Pitz price, no final ingredient/recipe roster is confirmed by this
document. Nothing here is implemented in `src/**`.

Companion audit: `docs/reports/TETO_PROGRESS2_PHASE0_FULL-CATALOG_FRESH-AUDIT.md`
Companion machine-readable data: `docs/reports/data/TETO_PROGRESS2_PHASE0_analysis-output.json`
Companion tooling: `tools/progression2_phase0_analysis.py`

---

## 1. What Progression 2.0 changes vs. the current (1.x) Progression SSOT

| | Current Progression SSOT (`PIZZA_GAME_PROGRESSION_SSOT.md` + EP1–EP4) | Progression 2.0 (this draft) |
|---|---|---|
| Starting recipes | `margherita` always unlocked (`RecipeUnlockCondition` absent); 14 more chain-unlock via `requiresRecipeId`/`minTotalStars` | **0 recipes known at start.** Every recipe, including Margherita, must be *discovered* by free-form crafting the right ingredient combination. |
| Starting ingredients | 3 permanently-unlimited Starter ingredients (`tomato-sauce`/`mozzarella`/`basil`) + up to 19 more, each `starterGrantOnly`-granted the moment its *governing recipe* unlocks | **Same 3 starting ingredients** (per Issue #182's explicit initial state), but every other ingredient's path to OWNED is driven by ★/achievement + Pitz shop purchase, not a recipe-linked free grant |
| Recipe unlock mechanism | `requiresRecipeId` + `minTotalStars` chain, authored per-recipe, order fixed at design time | **Derived, not authored per-recipe**: a recipe becomes discoverable the moment its full ingredient set is OWNED (exactly like current §10 "Recipe availability derived from owned ingredients" — this principle is *kept*, not changed) |
| Ingredient unlock mechanism | `minTotalStars` threshold → `AVAILABLE_TO_BUY` → Pitz purchase → OWNED (kept) | **Same 3-state model kept** (`LOCKED`/`AVAILABLE_TO_BUY`/`OWNED`), but thresholds are diversified (see §5) rather than a single ever-increasing `totalStars` ladder |
| ★ vs. Pitz role split | ★ (`totalStars`) gates `LOCKED→AVAILABLE_TO_BUY`; Pitz is the purchase currency `AVAILABLE_TO_BUY→OWNED`. Never mixed. | **Unchanged** — this is a load-bearing principle from the current SSOT (§7) that Progression 2.0 explicitly keeps (Issue #182: "★とPitzの役割が混ざっていない") |
| Population | 15 shipped recipes / 22 shipped ingredients | Analyzed against the existing 51-viable / 62-ingredient Fresh Recipe Master Catalog as working population (see audit §1.2 for why not literally 172) |

**What does NOT change**: the 5-phase game state machine (ORDER/PREPARE/BAKE/RESULT/
DISCOVERED — `PIZZA_GAME_SSOT.md` §5), the Quality ★1–5 scoring model, the "recipe availability
derives from ingredient ownership, never a separate flag" principle, and the strict ★-gates-
availability / Pitz-gates-ownership split.

## 2. Core loop (per Issue #182)

```
1. 所有材料から自由にピザを作る (free crafting from OWNED ingredients)
2. 登録レシピ条件と一致すれば NEW PIZZA / 発見 (exact-set match against a candidate recipe)
3. Dex へ追加、BEST ★ を記録
4. ★・実績条件で新材料が AVAILABLE_TO_BUY
5. Pitz で恒久購入し OWNED
6. 新材料を含め自由に組み合わせ、次のレシピを発見
```

This is compatible with the existing `LOCKED`/`AVAILABLE_TO_BUY`/`OWNED` ingredient state
machine and the existing Dex BEST model — Progression 2.0's actual delta is **(a)** recipes
start undiscovered instead of chain-pre-unlocked, and **(b)** the unlock ladder for ingredients
diversifies beyond a single `totalStars` number (§5).

### 2.1 Recipe-identity matching — an open question this Phase 0 surfaces, not resolves

The audit (§5.1) found that with only the 3 starting ingredients, **more than one** catalogued
recipe is ingredient-subset-satisfied simultaneously (`margherita` cleanly; `ny-style`/
`greek-style` ambiguously; `mezza-e-mezza`/`stuffed-crust` only once their mechanic exists).
Progression 2.0's discovery rule must therefore be **exact required-ingredient-set match**
(matching the current production matching rule in `PIZZA_GAME_SSOT.md` §8 — "配置した食材の種類
の集合" vs. "レシピが要求する食材の種類の集合" — not a loose "owns enough" superset check), and
the catalog's already-`deferred` ambiguous entries (`ny-style`, `greek-style`, and the
Marinara/Genovese/Napoletana/Romana/etc. naming-ambiguity ledger in
`TETO_RECIPE-MASTER-CATALOG.md` §6) must stay deferred until each has a distinguishing
ingredient or is merged/renamed. **Not resolved in this Phase 0** — flagged for the reviewer
per Issue #182's "初回マルゲリータのみソフトヒントを許可し、答えを常時提示しない" principle,
which implies exact-match discovery was already the intended model.

## 3. Canonical ingredient categorization (summary)

Full data: `docs/reports/data/TETO_PROGRESS2_PHASE0_analysis-output.json` →
`ingredientRecipeReach` (62 rows) and `initialState.marginalUnlockTable`.

| Category | Reuse tier | Count | Notes |
|---|---|---|---|
| sauce/cheese/topping (existing 22) | high (8) + medium/low (14) | 22 | Already shipped; all 8 `high`-reuse (recipeReach ≥5) ingredients in the whole 62-entry canonical set are already among these 22 — confirms current Chapter 1/Batch choices already captured the best-reuse items |
| New candidate (40) | medium (mostly) + low (mostly) | 40 | From the existing Fresh Recipe Master Catalog; not yet in production |

`mechanicDependency` (from `ingredient_master_catalog.json`, carried unchanged): a handful of
new ingredients (e.g. those used only by `postBakeFinishing`-tagged recipes) are inert until
that mechanic ships — tracked per-recipe (§6 of the audit), not duplicated here.

## 4. Dependency graph / marginal unlock — method note

`tools/progression2_phase0_analysis.py` computes, for any owned-ingredient state, two distinct
numbers per not-yet-owned ingredient:

- **recipeReach**: total recipes (in the 51-viable population) that use this ingredient at all.
- **marginalUnlockCount**: recipes that become *newly* fully-ingredient-complete the instant
  this one ingredient is added to the current owned set (accounts for recipes needing
  *combinations* of still-missing ingredients — a high-recipeReach ingredient can have
  marginalUnlockCount 0 at a given state if every recipe using it also needs something else not
  yet owned).

Both are always reported together (never conflated) — see the audit report §5 for the concrete
numbers and the full initial-state ranking.

## 5. Unlock-tree candidates (comparison, not finalized)

Issue #182 explicitly forbids finalizing thresholds/prices in this Phase 0. The following are
**mechanisms to compare**, each already representable by the existing `IngredientUnlockCondition`
data shape or a small, additive extension of it — no candidate here requires a new save-schema
field beyond what §7 sketches:

| Mechanism | Description | Strength | Risk |
|---|---|---|---|
| **totalStars threshold** (current model, kept as one lever) | Single ever-increasing ★ sum gates the next tier | Simple, already implemented, easy to explain ("あと★◯で入荷") | Becomes a single linear path if used alone — Issue #182 explicitly asks to avoid "★一本道" mid-game |
| **Discovery-count achievement** | "Discover N distinct recipes" (any recipes, not just high-★ ones) | Rewards breadth/exploration, not just score-grinding | Needs a new derived counter (`dex.filter(discovered).length`) — trivial to compute, not yet modeled in `mastery.ts` |
| **Sauce-family discovery achievement** | "Discover N recipes sharing a sauce family (e.g. tomato-sauce-based)" | Encourages systematic exploration within a family before jumping tiers; pairs naturally with `sauce` field already in the catalog schema | Needs a small "family" tag per recipe — the catalog's `sauce` field already provides this for free |
| **Quality achievement** | "Reach ★4+ on N different recipes" | Rewards mastery depth, not just breadth | Already representable via Dex BEST — no new state |
| **Region/style achievement** | "Discover N recipes tagged a given `regionOrStyle`" | Thematic, ties into the catalog's existing `regionOrStyle` field, good Late/Master-tier flavor | `regionOrStyle` today is free text, not a controlled taxonomy — would need light normalization before being achievement-worthy |

**Recommended shape** (comparison, not final): use `totalStars` for the *early* tiers (where the
audit's greedy walk shows dense, immediate payoff — see §6), and mix in discovery-count /
sauce-family / quality achievements from the *mid* tier onward specifically to avoid the
single-ladder feel Issue #182 warns against. This mirrors the existing catalog's own
`progressionTier` (`starter`/`early`/`mid`/`late`/`master`) field, reused rather than replaced.

## 6. Recommended Progression skeleton (Draft — candidate tiers, not final numbers)

Built from the audit's greedy marginal-unlock walk (§6 of the audit), re-grouped into 5 tiers
using each recipe's existing `progressionTier` field as a cross-check, restricted to the 28
baseline-mechanic (`spread`/`scatter`-only) recipes that are actually reachable without a new
mechanic build:

| Tier | Ingredients (candidate order, baseline-mechanic reachable only) | Recipes unlocked in this tier |
|---|---|---|
| **Starter** | tomato-sauce, mozzarella, basil (given) | margherita |
| **Early** | egg, mushroom, sausage, pepperoni, ham, garlic, oregano | bismarck, funghi, salsiccia, pepperoni, capricciosa, marinara, breakfast-pizza (bacon also needed) |
| **Mid** | anchovy, onion, olive-oil, tuna, rosemary | napoletana, tonno-e-cipolla, pizza-bianca |
| **Late** | (new candidates: nduja, porcini, black-olive, artichoke, ricotta, breadcrumb, arugula, …) | boscaiola, calabrese, hawaiian, ai-funghi-porcini, supreme, pugliese, fugazza, ricotta-bianca, ai-carciofi |
| **Master** | remaining low-reuse / regionally-specific new candidates | remaining `verification_pending`/`game_design_candidate` entries; all 23 mechanic-gated recipes wait here regardless of ingredient tier, pending their own mechanic build (see audit §6) |

**This table is illustrative sequencing derived from the audit's computed data, not a final
authored unlock chain** — exact per-ingredient thresholds/prices are explicitly out of scope
for this Phase 0 (Issue #182). A future implementation phase should re-run
`tools/progression2_phase0_analysis.py` at the point real thresholds are being authored, the
same way the existing Batch 1/1A/1B-A/1B-B/1B-C implementations each re-derived their own slice
from this same catalog.

## 7. Migration impact from Progression 1.x

- **Existing players' saved state** (`PersistentSaveV1`-shaped: Pitz, Dex, `ownedIngredientIds`,
  `completedMissionIds`) is not addressed by this Phase 0 — a real migration plan is
  implementation-phase work, not Phase 0 design work. Flagged here so it isn't forgotten: if
  Progression 2.0 ships, an existing save's `dex` (which currently has `margherita` and others
  pre-discovered via the 1.x chain) needs an explicit decision — grandfather existing Dex
  entries as already-discovered under 2.0, or reset discovery state. This document does not
  decide that; it is a required input to whatever implementation-phase Result Report eventually
  ships Progression 2.0.
- **Starter Grant mechanism** (`starterGrantOnly`, EP4): Progression 2.0's "buy via Pitz, no
  free per-recipe grant" model is a step *back* from EP4's own free-first-unit design. This is a
  deliberate scope note, not an oversight — EP4's Result Report should be re-read before
  implementation to confirm the product owner intends this reversal (Issue #182's body implies
  yes: "Pitz で恒久購入" with no grant language), but it is called out explicitly here since it
  reverses a fairly recent, deliberate design decision.

## 8. UX direction (see audit §7 for the full comparison)

Recommended (not implemented): keep the existing fixed no-scroll category-tab tray as the
PREPARE-time surface; add horizontal paging within a category past
`MAX_INGREDIENT_PALETTE_SLOTS` (6); add a small recent/favorite strip; move full-catalog
search/browse into a separate overlay reusing the existing Shop/Inventory overlay pattern. Full
rationale and rejected alternatives: audit report §7.

## 9. Unresolved product decisions (carried into any future implementation phase)

1. Recipe-identity exact-match disambiguation for `ny-style`/`greek-style` and the rest of the
   naming-ambiguity ledger (§2.1) — must be resolved before those specific entries can leave
   `deferred`.
2. Which achievement mechanisms (§5) to actually mix into the Mid/Late tiers, and in what ratio.
3. Existing-save migration policy for Dex/ownership state (§7).
4. Whether `starterGrantOnly`'s free-first-unit model is intentionally retired by Progression
   2.0 or whether it should be preserved for some ingredient tier (§7).
5. The 51→172 population gap (audit §1.2/§8) — requires either restored PIZZA DB access or
   further general-culinary-knowledge research passes under the same no-copying/no-padding
   discipline.
6. Exact tier boundaries / thresholds / Pitz prices for §6's skeleton — explicitly deferred past
   this Phase 0 per Issue #182.
