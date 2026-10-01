# Discovery 3.0 PR-4b-B: brazilian-calabresa (No.26) — Result Report

Branch `claude/discovery-3-pr-4b-b-67iybv`, from `origin/main` `07cee0c` (#329 merged; #330 closed / not merged; post-merge Deploy + E2E WebKit success; no duplicate Issue / PR / branch).
Authority: Owner decisions D-1 … D-6 (PR-4b-A / this task) + Human Review decisions (placement approved; pool=2 continuing through W1 step 13–24 approved, no new target rule). **Not merged.**

## 1. What changed (production data)

| file | change |
|---|---|
| `src/data/recipes.ts` | No.26 `brazilian-calabresa` / ブラジリアン・カラブレーザ: tomato-sauce 1, sausage 3, onion 2, black-olive 2, oregano 1 (non-sauce 8), bake 58–78, `baseRewardPitz` 100, `ladderCredit: false`, `lunchRush: false`. No cheese (the source's ingredient list has none). olive = `black-olive` (likely_alias). Appended; existing No. unchanged. |
| `src/data/recipeSauceProfiles.ts` | tomato-sauce / PAINT |
| `src/data/discoveryCatalog.ts` | production-only target id (no Phase-2 row) |
| `src/data/recipeHintRoles.ts` | `{ keyFree: true }` → rungs SAUCE, STRUCTURE, 4 × SUB_CLASS; no KEY_TOPPING, no CHEESE, no empty rung |
| `src/data/orders.ts` | `order-brazilian-calabresa` (needed by guided Pizza Select) |
| `src/data/referencePizza.ts` | Reference = `getReferenceSlots(8)` consecutive in `requiredIngredients` order (**Human Review candidate**, see §5) |
| `src/preview/hvSeeds.ts` | Preview-only seeds `pool2-onion`, `calabresa-key-free` (absent from the production bundle: grep + the existing isolation gate) |

Not touched: save schema (v2, no migration), ingredients (29), `cookingProfiles` (no CUT / thin-crust; #295 untouched), Dinner Mission lists, Trial Notebook / Oracle neutralization, PR-4b-A logic.

## 2. 25 → 26 migration, classified

- **MECHANICAL** (count / population only): recipe & catalog counts, Dex `N/26`, chapters 6 / 9 / 10 → **6 / 10 / 10** (calabresa key step 12 = tier 2), Pizza Select sections, `largeCatalogFixtures`, completion gate, efficiency, `w1Activation`, `recipeDiscoveryState`, dinner D-P windows (26 → 27 windows, 10,452 → 10,854 cases), progression W1 list, DH4 gate (24 → 25 non-onboarding recipes).
- **AUTHORING**: cooking-step matrix (calabresa = DOUGH, SAUCE, TOPPING; not CUT-eligible), sauce profile, `RECIPE_HINT_ROLES` (25 keyed + 1 key-free), catalog-vs-Phase-2 (calabresa exempt), score-parity: **the frozen 25-recipe snapshot is untouched** (compared on the 25), the 26th row is a separate fixture `scoreParity.pr4bb-brazilian-calabresa.json`.
- **SEMANTIC** (pool 2 is real now): see §3.
- **Deliberately NOT incremented** (credited-population values): ladder 24 steps, ladder count 25, `discoveredRecipeCount` with `countsTowardLadder` = 25 (the raw default = 26 is pinned separately), appended ladder steps = none, W1 final ledger.

## 3. First production pool 2 (the core finding)

At the onion step (Dex 12, ladder 12) pizza-portuguesa **and** brazilian-calabresa are DISCOVERABLE: pool = 2 on real data. Verified (unit `discoveryHint.pool.production26.test.tsx`, e2e `discovery3-pool2-production.spec.ts`, 390×844 + 360×800):
- no auto-target (any `RECIPES` order, any pin); sheet = `OPEN_POOL` (`{kind}` only); Dex = exactly one aggregated unknown, no count / name / identity / slot number / per-candidate hint; FREE Cooking finds either (real matcher NEW_DISCOVERY);
- B→A: ladder stays 12, ledger identical, no olive-oil; portuguesa then is the lone target. A→B: ladder 13 as before.
- every insertion point of calabresa (after 12 … 25 W1 recipes) finishes at 26 discovered, no softlock (pool ≥ 1 until done), identical final ledger = the existing 25's ledger;
- played for real (FREE → incomplete trial recorded → retry → 「NEW PIZZA! ブラジリアン・カラブレーザ」 → Dex): the hint returns for portuguesa, aggregated card gone, W1 ladder unchanged, save v2.
- Reachability: for every pool member, the hint + near-miss still reaches it (T-20 rewritten as A→B / B→A); calabresa discovered with exactly one `NEW_DISCOVERY` hit.
- Lunch Rush: discovered + all ingredients owned + stocked → never in `missionOrderRecipeIds` / draws.

**Design observation for the Owner (no code change made):** because calabresa stays DISCOVERABLE until found, *every* later W1 step (13 … 24) is also a pool of 2 (calabresa + the new key recipe) and so has no hint target — until the player finds calabresa. A player who finds calabresa first gets the hint back for all later steps; one who takes the key recipe first stays hint-less until they do. No softlock (FREE Cooking + Trial Notebook always work), but this is where the D-1 rule bites on production. The economy simulations model the player finding the non-credit recipe first (blind, 0 hint spend).

## 4. Existing-25 parity

- Frozen 25-row score snapshot: byte-identical; Hint 5.0 golden / gates, W1 ladder / reachability, onboarding, Lunch Rush existing pool: all pass; ladder, `RECIPES[0..24]` order and No. unchanged.
- Economy simulations (hint5 P-C, Hint Economy 1.0 105 runs, both vs `main@07cee0c`): same recipe order and hint targets in all runs, Dex 0–11 stage rows identical, 0 deadlocks. **Not byte-identical** past Dex 12 by construction: the calabresa discovery pays Pitz (+100 / +50 first discovery) and consumes sausage / onion / olive / oregano stock, so `totalRefillSpend` / `totalHintSpend` differ in the runs where affordability / stock moves (hint5 totals at ★3 / ★4 identical; ★1 +50 Pitz of hints).

## 5. Reference placement — Human Review needed

Candidate = `getReferenceSlots(8)` consecutive in `requiredIngredients` order (the Meat Lovers precedent; literal == generator == player reference, pinned): sausage (50,24)(73,36)(76,63); onion (58,79)(38,79); black-olive (22,63)(25,36); oregano (50,52). Screenshots: `docs/reports/screenshots/discovery3-pr4b-b-calabresa/reference-*` (calabresa; Meat Lovers and Portuguesa beside it for comparison). Each ingredient occupies its own sector (sausage upper-right arc, onions bottom, olives left, oregano centre). If the Owner wants another assignment, only the `BRAZILIAN_CALABRESA_REFERENCE` literal, `playerReference` (derived) and the scoring fixture change. **Owner decision (Human Review): the candidate is APPROVED as-is** — as PR-4b-B GAMEPLAY / REFERENCE CALIBRATION, not source authority and not a claim about real plating; counts / quantity / reference mechanism unchanged.

## 6. Verification

Unit 5591 passed / 1 skipped (295 files); `tsc -b`, `vite build` OK; `oxlint` = the same 2 pre-existing warnings. Chromium e2e 390×844 + 360×800, whole suite: **300 passed, 42 skipped (existing guards), 0 failed** (incl. new pool-2 spec ×2 widths and the 26-case reference harness). WebKit / CI: this PR's CI. Checks: recipe count 26; No.1–25 unchanged; schema v2; ladder credited 25; calabresa `ladderCredit` / `lunchRush` false; no CUT; no new ingredient; key-free Hint (no KEY_TOPPING, no CHEESE); LR exclusion; pool-2 production; anti-leak; existing-25 parity.

## 7. Human Verification (Preview build, real UI)

Preview build (`VITE_PREVIEW_MODE`, `?hv=`) driven through the real UI at **390×844** and **360×800** (both PASS, same script); 390×844 video (H.264 MP4, 33.9 s, 1.3 MB, delivered directly, NOT committed). Screenshots: `docs/reports/screenshots/discovery3-pr4b-b-calabresa/hv/` (`hv-01 … hv-14`, `*-390x844` / `*-360x800`), plus the earlier `pool2-*` / `reference-*` set.

| # | item | result |
|---|---|---|
| 1 | onion step: portuguesa + calabresa production pool = 2 (`?hv=pool2-onion`, Dex 12/26) | PASS |
| 2 | candidate count / name / identity not leaked (Dex text has no ブラジリアン / カラブレ / ポルトゲーザ; aggregated card has no digit; sheet says only 「まだ発見できるピザがあるよ」) | PASS |
| 3 | Dex aggregated unknown = 1 | PASS |
| 4 | no per-candidate Hint (no 「ヒントを見る」, no 「ヒントをもらう」) | PASS |
| 5 | FREE Cooking trial | PASS |
| 6 | Trial Notebook: first trial no notice, same trial again 「試作#1」 | PASS |
| 7 | correct calabresa → NEW PIZZA! ブラジリアン・カラブレーザ | PASS |
| 8 | enters the Dex (13/26; 「第2章」, chapter slot) | PASS |
| 9 | calabresa discovery: Shop entitlement unchanged (no olive-oil), save v2 | PASS |
| 10 | after it: aggregated card gone, portuguesa's own 「ヒントを見る」, sheet offers 「ソース」 first | PASS |
| 11 | Lunch Rush: 12 starts with all 26 found + all materials stocked: never calabresa (plus 300 draws in unit) | PASS |
| 12 | `?hv=calabresa-key-free`: rungs = ソース → 構成 → サブトッピング①②③④; no KEY_TOPPING, no チーズ | PASS |
| 13 | reference placement (guided Making: 見本 + popover, Pizza Select card) natural at both sizes | PASS |
| 14 | horizontal overflow / clipping / overlap | none (`scrollWidth - clientWidth ≤ 0` at every checkpoint) |
| 15 | console errors | none |

**Observation item (Owner request, no spec change):** while calabresa stays undiscovered, every W1 step 13–24 is also a pool of 2, so the Hint is unavailable for a long stretch. In this HV the player who found calabresa first got the hint back immediately (item 10). Whether a long hint-less stretch is a problem for players who never find it is for the Owner to judge from play; no new rule (W1-first target, Margherita-style exception, calabresa-only target) was added.
