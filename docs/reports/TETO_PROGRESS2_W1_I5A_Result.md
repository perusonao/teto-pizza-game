# Progression 2.0 W1 Integration I5a — 7 W1 Materials: Catalog Registration (Result)

Status: **I5a-1..3 implemented and verified — STOP before PR** (no PR, no main merge, no I5b).
Base main: `0ba3302b84e53ad81dead91bc6c7113f92087688` (unchanged at start; fresh fetch).
Branch: `claude/teto-pizza-w1-i4a-j46ph0` (restarted from main after PR #227 merged).

Authority: the I5a Fresh Audit (approved in session) + its implementation defaults; the W1 Human
Visual Gate (7/7 HUMAN_PASS, `TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION.json`, commit
`3fc02a0` on the visual-preview branch). PR #221 was **not** merged or cherry-picked — its W1
ingredient matrix was read only for ids / display names / colors.

## 1. Commits

| Slice | Commit | Summary |
|---|---|---|
| I5a-1 | `a545755` | 7 rows appended to `INGREDIENTS`; visual mapping; catalog-count tests; IngredientGlyph tests |
| I5a-2 | `7a75a64` | Catalog-only guards: no offer / Shop row / notice / hint change / entitlement / purchase; save round-trip; Free Cooking |
| I5a-3 | `7760dec` | "所持 N/M種" total derived from obtainable ingredients (Home + Inventory, one SSOT) |

## 2. The 7 definitions (`src/data/ingredients.ts`, appended last)

All: `category: "topping"`, `placement: "scatter"`, `unlockCondition: { minTotalStars: 0 }`
(finite, never a starter). No legacy `pricePitz` / `restockQuantity` / `starterGrantOnly`.

| id | nameJa | Drawn as | `emoji` (text fallback) | `pieceVisual` | color |
|---|---|---|---|---|---|
| capers | ケッパー | dedicated SVG | 🟢 (never drawn) | `caper-cluster` | #6f7f35 |
| clam | あさり | dedicated SVG | 🦪 (never drawn) | `clam-valve` | #c9b89a |
| corn | コーン | emoji | 🌽 | — | #f5cf3a |
| eggplant | ナス | emoji | 🍆 | — | #62407b |
| fresh-tomato | トマト | dedicated SVG | 🍅 (never drawn) | `tomato-slice` | #d9432f |
| pineapple | パイナップル | emoji | 🍍 | — | #f3c623 |
| potato | じゃがいも | emoji | 🥔 | — | #d9b77e |

`IngredientGlyph` and the `DedicatedIngredientVisual` schema are unchanged. The HV Gate keys
`asari-valve` / `tomato-slice-final` are the drawings P1 already ported as `clam-valve` /
`tomato-slice`.

## 3. What stays unchanged in I5a

`RECIPES` (15) and `DISCOVERY_LADDER` (shipped-15, 14 steps) are untouched, so for every W1
material: k = 0, pack 0, no ladder step, `materialOffer` = null. Therefore no Shop row, no NEW
MATERIAL notice, no progress-hint change, no automatic entitlement, no Pitz purchase or refill
(reducer `PURCHASE_INGREDIENT` / `RESTOCK_INGREDIENT` return the state unchanged). The starter set
(tomato-sauce / mozzarella / basil) is unchanged. Out of scope and untouched: W1 recipes, ladder
15→25, 25-recipe tier, ham k=3, RT-01c, CUT, W1 scoring fixtures, stock-aware Lunch Rush,
piece/portion migration.

## 4. "所持 N/M種" denominator

`obtainableIngredientIds(ladder = DISCOVERY_LADDER)` = starters + current ladder materials, in
catalog order; `ingredientCollectionCount(owned, ladder)` gives `{ owned, total }` for Home and
Inventory. Both live in `src/state/materialEntitlement.ts` (an existing ladder bridge — the
I4b wiring-boundary guard is unchanged). Current total = **22** (parity-tested against the Shop
offers and the shipped recipe set); the 25-recipe ladder fixture yields **29** with no other
change. An owned id this build cannot unlock is not counted, so N ≤ M.

## 5. Save compatibility

schemaVersion stays 2; no new key. The 7 ids are now *known*: a future save carrying them in
`ownedIngredientIds` / `inventory` / `unlockedForShopIngredientIds` loads them into gameplay and
writes them back byte-identically; unknown ids (`calabresa`) and unknown top-level keys are still
preserved by the I0 forward-compat merge. Full Game Reset is unchanged (clears everything).

## 6. Free Cooking

Unchanged behavior: the tray lists owned ingredients (also at 0 stock). An owned W1 material
(future save) appears, is placed while stock remains and is stopped by the Stock Gate at 0; a
not-owned one cannot be placed. No production save can own one in I5a.

## 7. Verification

| Check | Result |
|---|---|
| Full Vitest | 142 files / 2912 tests PASS |
| typecheck (`tsc -b`) | PASS |
| lint (oxlint) | PASS (exit 0) |
| build | PASS |
| Chromium full e2e 390×844 + 360×800 | 142 / 142 PASS (4.3 min) |
| WebKit | classifier (local run on base…HEAD): `webkit_required=true` (src changes) → Full WebKit via `workflow_dispatch` on this branch (no PR yet) — result in the session report |

## 8. Visual regression evidence (before `0ba3302` / after `7760dec`)

`docs/reports/screenshots/progression2-w1-i5a/{before,after}/<viewport>-<scenario>-<screen>.png`,
production builds, Chromium, 390×844 and 360×800, animations disabled. Scenarios: `fresh` (no
save), `progress` (3 discoveries, egg owned ×7, bacon + mushroom NEW), `future-save` (progress +
clam ×6 / corn ×2 owned, clam / fresh-tomato in the ledger).

| Screen | fresh | progress | future-save |
|---|---|---|---|
| Home (`所持 N/M種`) | 3/22 → 3/22, **byte-identical** | 4/22 → 4/22, **byte-identical** | 4/22 → 4/22, **byte-identical** |
| Inventory | **byte-identical** | **byte-identical** | differs as intended: before dropped the then-unknown clam/corn from gameplay; after lists あさり (clam-valve SVG) ×6 and コーン 🌽 ×2, count still 4/22 |
| Shop | **byte-identical** (0 rows) | **byte-identical** (mushroom NEW, bacon NEW, egg OWNED) | **byte-identical** — no W1 row |

Both viewports gave the same results. No 22 → 29 anywhere; no W1 material leaks into the Shop.

## 9. Human Verification

Visible/runtime behavior is unchanged for every save this build can produce (byte-identical
screenshots above), so per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §2 no Human
Verification video is required. The W1 visuals get their in-game Human Verification when they
become obtainable (I5b+).

## 10. Blockers

None.
