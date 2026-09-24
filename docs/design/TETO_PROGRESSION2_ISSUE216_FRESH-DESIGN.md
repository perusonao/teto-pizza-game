# Progression 2.0 Issue #216 — Fresh Design

Audited latest `origin/main` `dff233c042d2df6ee1c3a92f2d2419830aa05460`. This report reuses PR #189/#191 artifacts byte-for-byte as read-only inputs; it does not recreate the 172-row matrix.

## Outcome

The five-state ingredient lifecycle, three-layer economy, monotonic non-star gates, and all three capability policies were modeled across 24 deterministic scenarios. Result: **0 deadlocks, 0 re-locks, 101/101 targets reachable in every scenario**.

This is a comparison design, not a fee/condition balance decision. `F2_BALANCED` and the mixed gate assignment are tested baselines only.

## Scope and inherited evidence

- Phase-1 rows reused: 172 (FULL 101 / PARTIAL 55 / NOT_REPRESENTABLE 16).
- Phase-2 reachable pool reused: 101 (87 evidence-ready + 14 shipped overlay). Blocked rows remain blocked; no evidence gap was filled.
- Inventory stays M4 pieces/counts. Completion/scoring behavior is unchanged and remains Issue #215.
- The old fixed 10/20/30/40/50 star ladder is not used.

## Ingredient lifecycle and save contract

`LOCKED -> AVAILABLE_TO_UNLOCK -> (one-time Pitz fee) -> AVAILABLE_TO_BUY -> (first stock purchase) -> OWNED -> REFILL`

`unlockedForShopIngredientIds` is a permanent entitlement set. Eligibility is recomputed only while LOCKED; once added it is never removed. OWNED is independent from stock, and OWNED with stock 0 stays OWNED and routes to REFILL. A transaction must write fee/purchase and state atomically.

Backward compatibility: a save without the set starts with an empty set plus starter ownership. Rollback must forward-preserve the unknown field (PR #206 pattern). A rolled-back build may ignore the entitlement but must not erase it on write.

## Non-star achievement candidates

Allowed facts are monotonic: discovered count, a specific prior discovery, cumulative completed pizzas, recipe BEST reached, Dex count, cumulative Lunch Rush serves, and cumulative Pitz earned. The generated comparison profile uses discovered count, completed count and earned Pitz alongside the authority star gates. Each threshold is bounded by supply reachable before its row, so the validator rejects circular gates.

BEST and Lunch Rush conditions are valid only with a proven fallback path; they are retained as per-row authoring options, not blanket gates. Spending, current balance, stock, mission streaks and capability-dependent future recipes are forbidden eligibility facts.

When a non-star gate replaces the authority star gate, every `PREREQUISITE_OWNED` conjunct is retained. The validator checks every selected condition and every candidate condition against its source prerequisites.

## Three-layer economy

- Unlock fee: one-time, candidate curves F0/F1/F2/F3 = 0%/25%/50%/100% of first-stock price (rounded to 10 with candidate minima). No value is final.
- First stock purchase: inherited tier price 60/100/140/180 Pitz.
- Refill: inherited `ceil(purchase price × 0.5)`.
- M4 quantity: PR #214 verifies 19 rows. 83 authority-only ingredient rows remain `NOT_FOR_SALE` until `k=max minCount` is authored; then purchase/refill is fixed `10 × k` pieces.

## Capability policy comparison

| Policy | Pitz | Strength | Risk |
|---|---:|---|---|
| A — condition then purchase | candidate fee | economy lever | double-charge pressure with ingredient fee; highest grind |
| B — condition then auto | 0 | predictable and simplest persistence | teaching moment can be weak |
| C — first eligible target/tutorial | 0 | strongest contextual teaching | trigger must occur before target matching to avoid circularity |

Recommended decision shape (not final): B for foundational DOUGH_VARIANT/PAN_BAKE prerequisites; C for interaction-heavy mechanics; do not apply A to all 11. LAMINATE remains dormant because it covers 0 of the 101 target pool.

C is simulated from target/tutorial encounters, not schedule rows. In C, STEP_ORDER is taught from `trenton-tomato-pie-pizzadb` in the starter state (before any bake). DOUGH_VARIANT is taught at the `dough:material-cauliflower` gateway only after the row's non-prerequisite gate and every other cauliflower target item are available, but before buying the prerequisite-gated dough. B instead unlocks those capabilities at scheduled rows 23 and 16. The matrix records per-trigger bakes/discoveries/stars/Pitz and a per-node timeline; equal final totals in some rows are a consequence of the linear reward/spend totals, not identical execution.

| Capability | 172 rows | 101 targets | Incremental gain | Prerequisite |
|---|---:|---:|---:|---|
| DOUGH_VARIANT | 33 | 13 | 8 | none |
| MULTI_SPREAD_LAYER | 17 | 9 | 9 | none |
| LATE_ADDITION | 12 | 3 | 3 | none |
| PAN_BAKE | 8 | 3 | 2 | none |
| DOUGH_SHAPE_TARGET | 5 | 1 | 1 | none |
| ENCLOSE | 5 | 3 | 3 | none |
| PREP_STEP | 3 | 1 | 1 | none |
| STEP_ORDER | 2 | 1 | 1 | none |
| ZONED_PLACEMENT | 1 | 1 | 1 | none |
| LAMINATE | 1 | 0 | 0 | none |
| FRY_COOK | 1 | 1 | 1 | none |

## Reachability

The starter trio first reaches shipped Margherita. Every row transition is followed by at least one previously reachable bake or a positive-Pitz original bake, so fees and purchases never require spending a fact they unlock. All scenarios finish with permanent entitlements and no mechanic deadlock. The detailed totals are in the simulation report.

## Required changes to open work

### PR205

- add AVAILABLE_TO_UNLOCK and permanent unlockedForShopIngredientIds input/output
- split one-time unlock fee from first-stock purchase price and refill price
- replace one-pizza-use APIs with M4 piece quantities; keep missing quantity fail-closed
- do not freeze fee/eligibility until owner selections below

### PR206

- forward-preserve unlockedForShopIngredientIds with valid unknown ids
- keep schemaVersion 2 and M4 inventory unchanged; test downgrade/write/reload entitlement survival

### PR211

- replace old 3-state flow with 5-state flow and add entitlement transition tests
- replace use migration sections with M4/no-migration; add unlock-fee atomicity and rollback cases

### PR214

- retain D-2 M4, D-3 #215 split, D-4 fixed 10*k
- supersede remainingProductDecisions=0: fee curve, per-row non-star policy, capability A/B/C, and 83 k values remain owner/content decisions
- do not start former TG-1 until Issue #216 selections are made

## Validation

Run `python tools/progression2_issue216_fresh_design.py --check`. It rebuilds all outputs, verifies input row counts/hashes, state ordering, M4 quantity provenance, 101/101 reachability, zero deadlocks/re-locks, and byte drift.
