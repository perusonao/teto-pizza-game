# T25-R2c preflight / Batch 24 cleanup — Result Report

- Audit base: `main` `3c5b433a8041faa3317979fe4c11418d240b6b17` (Batch 24 / PR #848 merge commit)
- Scope: docs/data only. No Batch 25 runtime implementation, Gate relaxation, Preview/Production change, or merge.
- `chicken-tikka-pizza`: **HOLD maintained** and excluded from T25-R2c.

## Batch 24 cleanup

- T24 claim `session_016YrGhzuoNid1g1M2WgobU1` was still live after merge. It was released once on Issue #780: comment `6881000820`.
- WebKit #1628 / run `43616314876`: **completed success** at 2026-11-14 16:56:29Z. All six WebKit shards, `layout-chromium`, Layout Contract Gate, and WebKit Gate succeeded on attempt 1. The apparent pause was four shards legitimately executing their heavier `Run WebKit e2e` selections in parallel; the slowest completed in about 21m16s, below the unchanged 35-minute job timeout. Installation/cache had already succeeded, and there is no evidence of a runner or Gate stall. No cancel, rerun, timeout extension, skip, or Gate change was performed.

## Ledger sync

The existing generator was run against the real catalog. The first run correctly measured recipes 110, ingredients 130, and methods IMPLEMENTED 7, but failed two reconciliation checks because T24 shipped matrix row `diavola-pizza-pizzadb-p5` under runtime id `diavola-pizza`. The generator now records that alias and the current main SHA; regeneration passes all 43 checks.

| line | shipped / target | remaining | staged / reserved |
|---|---:|---:|---:|
| recipes | 110 / 177 | 67 | 67 staged |
| ingredients | 130 / 170 | 40 | 39 staged + `nduja` reserved |
| methods / processes | 7 / 27 | 20 | PARTIAL 7 / UNIMPLEMENTED 4 / HOLD 1 / ADOPTION_UNDECIDED 6 / DUPLICATE 2 |

## Fresh T25-R2c preflight

The committed R2c spec was first passed unchanged to the preflight and stopped with `new ingredient is already shipped: cucumber`. T24 shipped `cucumber`, so the fresh measurement treats it as reuse and removes it only from the temporary `newIngredients` input. Recipe composition is unchanged.

| check | fresh result |
|---|---|
| shipped baseline | 110 recipes / 130 ingredients / 95 ladder steps |
| verdict | READY 0 / NEEDS_OWNER 6 / BLOCKED 0 |
| canonical Research | 0 changed shipped IDs |
| non-canonical Research | **42 IDs** (old 40 is obsolete) |
| T24 impact | `peking-duck-pizza` via cucumber: later by at most 1; `thai-chicken-pizza` via cilantro: later by at most 1 |
| Duplicate Gate | `pizza-salad` vs `bambino` Jaccard 0.429; `buffalo-cauliflower-pizza` vs `buffalo-chicken` ONE_DIFF/Jaccard 0.6; `pizza-asparagi-limone` vs `quattro-formaggi` Jaccard 0.429 |
| Hint 5.0 | all six retain SAUCE → CHEESE → STRUCTURE → SUB_CLASS... rungs; no Gate change |
| staging | six recipes remain staged; seven truly-new ingredients remain staged; `cucumber` is shipped reuse |
| count pins | 110 recipes / 130 ingredients / 95 steps before T25; a T25 implementation must re-pin from these values, not 104 / 122 / 89 |

The preflight does not author ladder placement. With five recipes still specified as late and only `buffalo-cauliflower-pizza` ordinary, ladder step placement and every simultaneous unlock remain Owner decisions for implementation planning; no step/floor was changed here.

## Owner decision table (all unapproved / HOLD)

| item | measured proposal / finding | status |
|---|---|---|
| `swedish-kebab-pizza` | late; new `kebab-sauce`; non-canonical Research impact | HOLD — Research and all authored values unapproved |
| `pizza-salad` | late; `cucumber` is reuse, new `yogurt-sauce`; Jaccard exception vs `bambino` | HOLD — exception and Research unapproved |
| `banh-mi-pizza` | late with no POST_BAKE piece; new `daikon` / `liver-pate` | HOLD — late placement and Research unapproved |
| `buffalo-cauliflower-pizza` | ordinary; new `cauliflower`; ONE_DIFF vs `buffalo-chicken` | HOLD — exception and Research unapproved |
| `mexican-elote-pizza` | late; new `lime` | HOLD — Research unapproved |
| `pizza-asparagi-limone` | late; new `asparagus`; Jaccard exception vs `quattro-formaggi` | HOLD — exception and Research unapproved |
| `asparagus` | topping / vegetable in the proposal | HOLD — quantity, family, display name, colour, SVG unapproved |
| `cauliflower` | topping / vegetable in the proposal | HOLD — quantity, family, display name, colour, SVG unapproved |
| `cucumber` | already shipped by T24; proposed T25 use is reuse | HOLD — T25 quantity/use and any visual change unapproved |
| `daikon` | topping / vegetable in the proposal | HOLD — quantity, family, display name, colour, SVG unapproved |
| `kebab-sauce` | sauce; spread behaviour implied by category | HOLD — base sauce, colour, application, display name, SVG unapproved |
| `lime` | topping / fruit, POST_BAKE in the proposal | HOLD — quantity, family, display name, colour, SVG unapproved |
| `liver-pate` | proposal conflicts with staged classification (`sauce/null` in R2c vs staged composite topping/meat) | HOLD — category/family/application/quantity/display/SVG unapproved |
| `yogurt-sauce` | sauce; spread behaviour implied by category | HOLD — colour, application, quantity, display name, SVG unapproved |
| all six recipes | fresh non-canonical Research bound is 42 IDs | HOLD — the additional T24 IDs and the full per-ID table are not approved |
| `chicken-tikka-pizza` | excluded from R2c | HOLD maintained |

No Jaccard/one-diff exception, late placement, Research change, source colour/application, quantity/family/name/SVG, or Owner decision is approved by this report.

## Verification

- Master ledger generator: 43/43 checks PASS after the T24 alias reconciliation.
- T25-R2c preflight: exit 0; one tool test PASS; canonical 0 / non-canonical 42.
- Generated packet: `docs/reports/data/TETO_T24-T26_PREP/T25-R2c.main-3c5b433a.preflight.md`.
