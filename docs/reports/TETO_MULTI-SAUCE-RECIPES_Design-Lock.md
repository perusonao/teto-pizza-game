# Multi-Sauce Recipes — Design Lock (grandma-pizza first)

> **Addendum (2026-10-17, proposal):** the square-pan dough decision for grandma-pizza amends §2 (dough form) and S3's prerequisites — see `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md` (#533, Epic #532). No text below is changed.

> **Owner decision (2026-10-18, Issue #544, OD-544-3): §8 item 3 is formally approved** — for `grandma-pizza`, the Hint 5.0 SAUCE rung names **both** sauces (tomato sauce and olive oil). The approval is **scoped to `grandma-pizza`** and to item 3 only; it does **not** approve §8 as a whole. See the per-item status table under §8 below. Nothing else in this document is changed.

> **Status update (2026-10-17, main `d7fa990`) — read this first.** This document is the *design record* written on `d69e43e`; the body below is kept as written.
> - **S1 (#524) is merged** (`b7cdb14`): oil-over-sauce overlap factor is **`SAUCE_OIL_OVERLAP_ALPHA_FACTOR = 0.3`**, *not* the ≈0.45 of §3/§7 (0.45 measured too faint through the per-pixel path; see `TETO_MULTI-SAUCE_S1_OIL-OVERLAP-519_Result.md`, "Value of the factor"). The #502 heatmap-fallback test is merged. The iPhone-Safari follow-up (per-canvas staging surface) is recorded in that Result report; its device mechanism is a hypothesis.
> - **S2 (#525) is merged** (`d7fa990`): `buildHintLine` checks every required sauce (§5.1) and the 2-sauce guard tests exist.
> - **S3 (`grandma-pizza`) is NOT implemented and is on hold.** §2 and §6 are plans only; §8 items 1–4 and the live PIZZA DB check are still open. No 2-sauce recipe exists in production yet.
> - Screenshots in `screenshots/multi-sauce-recipes-design/` show `d69e43e` (before S1). The S1 before/after images are in `screenshots/multi-sauce-s1-oil-overlap/`.
> - Related: `TETO_MULTI-SAUCE-RECIPES_Fresh-Audit-and-Plan.md`, `TETO_MULTI-SAUCE_S1_OIL-OVERLAP-519_Result.md`.

Status: **design only.** No `src/**`, recipe data, ingredient data, CSS or tests were changed; nothing merged or deployed.
Follows `TETO_MULTI-SAUCE-RECIPES_Fresh-Audit-and-Plan.md` (Issue #521). Base: `origin/main` = `d69e43e`.
Untouched: #503, #518, #520 (and #517, #468, #478).

Experiments in this session were **throw-away** (a scratch vitest file and a scratch Playwright spec, both deleted before commit; no repo
file other than docs/screenshots changed). Their results are quoted below with the exact numbers.

## 0. Owner policy (2026-10-17, recorded)

1. First implementation candidate: **グランマピザ**. tomato-sauce + olive-oil is the first verification target of the multi-sauce feature.
2. **スフィンチョーネ**: on hold until its evidence is confirmed.
3. Recipes that combine two *different base* sauces stay on the roadmap as later candidates.
4. Secondary-sauce scoring starts as **used / not used** (presence).
5. **Lunch Rush: excluded at first.**
6. **No new FINISH step** in this scope.
7. **CUT is excluded** from the initial scope, but the normal flow must be shown to be consistent.
8. #519's real-device condition (tomato → olive oil, the earlier sauce looks gone) is a **mandatory regression condition**.
9. #502 stays open until a real test confirms it.

## 1. Corrections to the first audit (found while re-checking)

| First audit said | Actual (verified) |
|---|---|
| olive-oil is owned "from ladder step 10" | The production ladder is `DISCOVERY_LADDER` = frozen W1 steps 1–24 + appended steps. In it **olive-oil = step 13 (key `fugazza`), garlic = step 14 (key `marinara`)**. Step 10 was the legacy 15-recipe ladder. grandma becomes makeable at **step 14**. |
| #519: "no repro on main" (issue's own result) | **Reproduced on `d69e43e`** for the pair the issue did not test: **tomato → olive oil** (§3). The issue's runs were tomato→pesto and oil→tomato→pesto→tomato, and its E2E reads **canvas pixels**, which do not include the oil canvas's CSS filter. |
| #502: "fix appears to be in main, untested" | Behaviour **confirmed by a scratch test** (§4), but **no committed test covers that branch** → stays open. |
| Gates: only hints/scoring touched | The **DH4 privacy gate** (`deductionProduction.gate.test.ts`) and several "exactly one sauce" fixtures fail by design the moment a 2-sauce recipe exists (§5.4). |
| FINISH/liquids only | OD-CS-14 and OD-TQ-2 (docs) already name multi-spread as a future **Technique (TQ-3)**; §5.5 says how this scope relates. |

## 2. Grandma pizza — source re-check

| Item | Evidence in repo | Verdict |
|---|---|---|
| Row | `grandma-pizza-pizzadb` (PIZZA DB comparison table, Phase 0B original sample, page 3), `sauceFamily` トマトソース | real PIZZA DB row |
| Ingredients | `tomato-sauce, mozzarella, garlic, olive-oil` — all four in the Phase 0B **canonical** list (not family-derived) | listed |
| `doughStyle` | `null` (not recorded) | open (see below) |
| Pre-/post-bake use of the oil | **not recorded** anywhere (matrix `postBakeFinish: []`, no `LATE_ADDITION` evidence; the only evidence is `MULTI_SPREAD_LAYER` / `source_ingredient_field`) | **unevidenced either way** |
| Real-world form (sheet pan) | `docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md` §"Multi-spread": grandma = *runner-up*, "real-world sheet-pan form unevidenced" | not modelled |
| Matrix status | READY, no blockers, no collision with a shipped identity | OK |
| Live pizzadb.jp | unreachable from this environment (403); not re-fetched | **Owner check pending** |

**Decision recorded for this scope (resolves OD-CS-14 for this one recipe only):** the oil is modelled as the game already models olive oil in 9 shipped
recipes — a **pre-bake `PAINT_TEMPORARY` layer inside the SAUCE step**. No FINISH. The game does **not** claim that the real dish is pre-bake;
the recipe description must be worded so it does not assert a timing (e.g. "トマトソースとオリーブオイルのシンプルな一枚", not "オイルを塗った生地に").
Dough form (round, not sheet pan) is a documented simplification, same as every other round recipe whose dough is unrecorded.
**Owner action:** open the live PIZZA DB grandma page and confirm (a) ingredient list unchanged, (b) nothing there contradicts a pre-bake oil.
If it does, grandma goes back on hold; the engine work (S1/S2) is unaffected.

## 3. #519 — reproduction and root cause

Setup: Chromium 390×844, Free Cooking, same flow as `e2e/sauce-layers-b2.spec.ts`; tomato 25→52 %, then olive oil 40→70 % (same row). Real
**page screenshot** pixels (CSS filters included), sampled on the dough box.

| Sample | RGB | Meaning |
|---|---|---|
| tomato only (centre) | 202, 70, 54 | saturated red |
| tomato edge | 211, 103, 77 | |
| **overlap after oil on top** | **215, 185, 87** | red almost gone: `r−g` 132 → **30** (≈ 23 %) |
| oil alone | 220, 213, 100 | |
| oil first, tomato on top (overlap) | 204, 111, 57 | tomato stays visible (`r−g` ≈ 93) |

Images: `docs/reports/screenshots/multi-sauce-recipes-design/` (`01` tomato only, `02` tomato→oil on `d69e43e`, `03` oil→tomato, `04` what-if).

**Root cause (display only):** the oil canvas carries `.pizza-sauce-heatmap--oil` (`blur(3px) saturate(2.1) contrast(1.4) brightness(0.82)`), which turns the
pale swatch into an opaque lime-yellow; the per-pixel overlap dimming (`SAUCE_OVERLAP_ALPHA_FACTOR = 0.7`, `sauceDisplay.ts:308`) leaves it ~70 % opaque over the tomato.
Data is intact (ledger, deposits, canvases' own pixels are all kept) — which is exactly why the issue's canvas-pixel E2E passed. So #519 is **not** a data-loss bug
and **not** the legacy `APPLY_SAUCE` path; it is *oil drawn over another sauce looks like it replaced it*. It is the dominant case for grandma (tomato first, oil second is the natural order).

What-if (scratch, CSS `opacity` on the whole oil canvas over tomato; overlap RGB / `r−g`): 1.0 → (215,185,87)/30 · 0.6 → (209,138,74)/71 · **0.45 → (208,121,68)/87** · 0.3 → (205,104,64)/101.
Image `04` shows 0.45: tomato clearly present, oil a soft yellow sheen.

**Design (S1, render only):** for an **olive-oil run laid over other sauce**, use a stronger overlap factor than the generic 0.7:
`SAUCE_OIL_OVERLAP_ALPHA_FACTOR ≈ 0.45` *(initial candidate; shipped value is 0.3, see the status update)*, passed as the existing `factor` argument of `dimWhereOverlapping` (own canvases: `SauceHeatmapCanvas`; flattened groups: `runRaster` in `SauceMergedCanvas`).
- Non-overlapped oil keeps today's look; single-sauce pizzas never take the layered path (`under` empty) → **the 9 shipped oil recipes and the B2 single-source golden stay byte-identical**.
- Non-oil upper layers (tomato/pesto) keep 0.7 (Owner decision, PR #494).
- Value to be fine-tuned in S1 against the acceptance numbers below, with before/after screenshots for Owner HV (UI change ⇒ HV policy).
- Not changing: ledger, caps, reducer, scoring, inventory, save.

**Mandatory regression condition (S1, E2E at 390×844 and 360×800):** a test that reproduces the Owner's order **tomato → olive oil** and reads the **rendered page pixels**, not canvas pixels:
1. overlap `r−g` ≥ 0.6 × tomato-centre `r−g` (today 0.23; what-if 0.45 gives 0.66);
2. overlap is not within ΔRGB 40 of the oil-alone colour (tomato not replaced);
3. oil-alone region stays ≥ 30 (sum of channel differences) away from bare dough (oil not invisible);
4. the same three checks after SAUCE → CHEESE → BAKE start (bake-state classes) and in RESULT;
5. oil → tomato order and tomato → pesto (existing) unchanged; canvas count and DOM unchanged;
6. a unit test on `dimWhereOverlapping`/`runRaster` pinning the oil factor and that non-oil runs stay 0.7.
Thresholds are the measured baseline + margin and are calibrated in S1; the **condition** (rendered-pixel tomato→oil check, both viewports, through RESULT) is fixed now.
Also keep the legacy `APPLY_SAUCE` replace-all defensive fix as an optional separate micro-PR (unreachable today).

## 4. #502 — real test result

- `npx vitest run src/components/SauceCanvasFallback.test.tsx`: **22/22 pass** (main).
- That file's merged-heatmap fallback test uses **no oil** and no `bakedOil`; the oil case is only tested for the *overflow* canvas. So the **heatmap** fallback with `bakedOil` is **untested**.
- Scratch probe (deleted): `SauceMergedHeatmapCanvas` with a refused 2D context, runs `[olive-oil, tomato]`, `bakedOil`: first fallback dot is `rgb` of `bakeOilHex(#e9d9a0)` (not the raw `rgb(233, 217, 160)`). **Negative control** (same render without `bakedOil`) fails with the raw colour → the probe discriminates.
- Conclusion: **behaviour is correct on main, but not pinned by a committed test.** #502 is **not closed**. S1 adds the one regression test (heatmap fallback, mixed oil group, `bakedOil` true/false); #502 closes only after that test is merged and green.

## 5. Engine design for two required sauces

Scratch experiment (deleted): a synthetic recipe `{tomato-sauce 1, mozzarella 3, garlic 2, olive-oil 1}` evaluated with the real functions (Reference/profile borrowed from `margherita`).

### 5.1 Hint (needs a fix — S2)
Observed: tomato painted, everything else placed → **"いい感じ！「焼く！」を押してみよう。"** (false "ready"); oil only → "トマトソースを塗ろう" (correct).
`buildHintLine` (`data/hints.ts`) looks only at the first sauce requirement and `missingReq` skips every sauce.
**Design:** evaluate **all** sauce requirements in `requiredIngredients` order; the first one not in `pizza.sauceIds` produces the "sauce missing" line
(`empty`/`emptyHint` for the first sauce, `missing[ingredientId]` — default "〇〇も塗ってみよう！" — for later sauces); non-sauce logic unchanged. Single-sauce recipes: byte-identical (golden over all 57).
Copy for grandma: `empty` "指でなぞってトマトソースを塗ろう！", `missing["olive-oil"]` "オリーブオイルも塗ってみよう！", `ready` unchanged. Tests: both orders, either missing, 57-recipe parity.

### 5.2 Discovery (no code change)
`RECIPE_DISCOVERY_CATALOG` derives `sauceBase = [olive-oil, tomato-sauce]` automatically. Observed: both sauces → `UNIQUE_MATCH`; tomato only → `NO_MATCH`; exact set, no collision with fugazza/napoletana/marinara (checked by set comparison).
Research rows (`researchResultRows`) already list every sauce (observed: tomato POSITIVE, a non-member oil NEGATIVE) and disclose nothing about the target's sauce count.
Near-miss: tomato-only vs a `{tomato, oil}` target gives `SAUCE_ONLY/CHANGE` (wording would be imprecise) — but production no longer shows directional near-miss lines (Near/Far Neutralization: one generic line), so **no production effect; no change**. Internal tests (`discoveryHint.walk`) may need a fixture note.
Hint 5.0: SAUCE rung is "every sauce" → one rung naming **both** sauces (H1 note in the cooking-steps design); recipe is **key-free** (no KEY_TOPPING), like recent additions. Owner already accepted "SAUCE rung reveals ≥2 sauces" as the multi-spread consequence in OD-CS-14's description; confirm in §8.

### 5.3 Completion Gate and scoring (no code change; Owner policy = presence)
Observed: tomato only → **FAILED `MISSING_REQUIRED_INGREDIENT` (olive-oil)**; tomato ideal + **one tick** of oil → **PASS**; one tick of tomato + ideal oil → **FAILED `INSUFFICIENT_SAUCE` (tomato)**.
So: the **primary** (Reference) sauce keeps its quantity/coverage floor; the **secondary** is presence-only — exactly the Owner policy. Scoring: Sauce component = primary's own deposits; the oil adds to the Recipe component's required-type presence (1/4 here) and never to Sauce.
Rule to freeze: **primary = the recipe's `RECIPE_SAUCE_PROFILES` entry (tomato-sauce, PAINT)**; the secondary has no profile entry and no Reference target. A later per-sauce target (S5) is a separate decision.
Known caveat to state in the Result report: a single dab of oil satisfies the oil requirement.

### 5.4 Gates that must be deliberately updated in S3 (they currently *forbid* a 2-sauce recipe)
| Test | Why it fails | Required handling |
|---|---|---|
| `logic/discovery/deductionProduction.gate.test.ts` "exactly one sauce except NO_SAUCE" and INV-TQ-4 "technique-requiring = NO_SAUCE" | its own text: "re-run the DH4 privacy gate for Technique recipes" | S3 first re-runs the **whole gate and the DH4 privacy sweeps with grandma in `GATE_STATES`** (ladder states + seeded random orders), shows no new leak (esp. `meta:ingredient-total`, `attr:category` facts, sauce-side guard), **then** relaxes the assertion to an explicit allowlist (`multiSauceRecipeIds()` derived from the profile authority, like `noSauceRecipeIds()`), never a blanket removal |
| `logic/discovery/researchResultRows.test.ts` ("every recipe uses exactly one sauce… no multi-sauce") | production fixture assertion | extend to allowlist; add a grandma row test |
| `state/discoveryExpansion2.wave2.test.ts`, `data/recipes.test.ts` sauce-count assertions, `state/gameReducer.techniques.privacy.test.ts` ("exactly one sauce row") | one-sauce assumptions | update only the production-fixture assertions; the privacy meaning is kept |
| Count-pinned tests (recipes 57→58, ladder/appendOnly, `catalogLedger`, `recipeBatchManifest`, hint5 goldens, B1 consume-hash "finite set") | pin counts | regenerate per the Batch 7a precedent |

### 5.5 Techniques
Docs (OD-TQ-2) classify multi-spread as a future Technique (TQ-3: Dex 調理法 entry, detection from signature). **This scope does not register a technique**: `TechniqueId` stays `"no-sauce"`, INV-TQ-3/4 stay untouched, no Dex/RESULT technique UI.
A technique is "never a precondition for a recipe" (OD-TQ-1), so shipping the recipe first is allowed; TQ-3 can later add the discovery label without touching the recipe. **Confirm in §8.**

### 5.6 Cooking steps, stock, save, CUT, Lunch Rush
- `deriveCoreSteps` → `DOUGH, SAUCE, CHEESE, TOPPING` (+ BAKE) = 5 tabs; both sauces are painted in the one SAUCE step (tray shows both because Guided tray = required ingredients).
- Stock/ownership: reducer rejects an un-owned sauce; olive-oil owned from the step-13 Shop entitlement + purchase. `consumePizzaInventory` charges one unit per distinct sauce id (existing).
- Save: pizza state is not persisted; only the Dex's recipe id is new (additive, as in Batch 7a).
- **CUT: not in `CUT_ELIGIBLE_RECIPE_IDS`** (opt-in). Round ends BAKE → RESULT like `eggplant-ricotta-pizza`. Normal-flow consistency is checked in S3 by an E2E: SAUCE (tomato → oil) → CHEESE → TOPPING → BAKE → RESULT, both viewports, both layers visible at RESULT (rendered-pixel check from §3). Multi-sauce under CUT remains covered only by the existing component test (4 pieces × 3 runs); enabling CUT later needs its own E2E and the #467 Android check.
- **Lunch Rush: `lunchRush: false`.** Only `mission/lunchRush.ts` reads the flag (`participatesInLunchRush`); `orders.ts` has no sauce logic. Whether the Dinner Mission draws from `RECIPES` by another path is **not verified here** — S3 must check and, if it does, apply the same exclusion.

## 6. Recipe data and unlock chain (S3, concretised)

| Field | Value |
|---|---|
| id / nameJa | `grandma-pizza` / グランマピザ (Owner to confirm, §8) |
| description | timing-neutral, e.g. "トマトソースとオリーブオイルに、モッツァレラとにんにくをのせた、シンプルな一枚。" |
| `requiredIngredients` | `tomato-sauce 1`, `olive-oil 1`, `mozzarella 3`, `garlic 2` — counts are **gameplay calibration, not source** (same disclaimer as other recipes); 5 non-sauce pieces ≤ the 8-slot ring |
| `bakeTarget` | `{ start: 56, end: 76 }` (calibration; between marinara 45–65 and the 54–76 recent range — final value from the S3 balance check) |
| `baseRewardPitz` | 100 (shared value) |
| Flags | `ladderCredit: false` (no new material; precedent `brazilian-calabresa`) — **Owner to confirm**; `lunchRush: false` |
| Unlock | no `unlockCondition` (recent recipes use the ladder). Makeable when **tomato-sauce, mozzarella, olive-oil (step 13), garlic (step 14)** are owned → effectively from **ladder step 14**, a branching pool with `marinara` (precedent: calabresa + portuguesa). No new ladder step; frozen steps 1–53 untouched (`appendOnly` test stays green). |
| `RECIPE_SAUCE_PROFILES` | `"grandma-pizza": { ingredientId: "tomato-sauce", interaction: "PAINT" }` (primary only) |
| Reference (`referencePizza.ts`) | `sauce: computeMechanicalSauceReference("grandma-pizza")` (tomato); pieceGroups: mozzarella 3 + garlic 2 positions on the existing 8-slot geometry; same tolerances as peers |
| Discovery target id | `grandma-pizza-pizzadb` (the matrix evidence id, per convention) |
| Hint roles | key-free marker (`keyFree: true`) |
| Other registries | `orders.ts`, `toppingSizeClass.ts` (garlic already classed), `ingredientTaxonomy` (no new ingredient → no new family row), `cookingProfiles` (no CUT entry) |
| Not added | no new ingredient, glyph, icon, CSS, technique, ladder step, Lunch Rush entry |

## 7. PR split — S1 / S2 / S3

| PR | Scope | Files (expected) | Tests / evidence | HV | Parallel with #503 / #518 / #520 |
|---|---|---|---|---|---|
| **S1 — #519 render + #502 test** | oil-over-sauce overlap factor (§3); committed regression: rendered-pixel E2E tomato→oil (+oil→tomato, bake, RESULT), unit pins, **#502 heatmap-fallback test** | `logic/sauceDisplay.ts`, `components/SauceHeatmapCanvas.tsx`, `components/SauceMergedCanvas.tsx`, `SauceCanvasFallback.test.tsx`, `e2e/sauce-oil-over-519.spec.ts`, `sauceDisplay.test.ts` | B2 single-source golden **unchanged**; existing `sauce-layers-b2` still passes (pesto-over-tomato numbers unchanged; its third-layer oil assertions are inequalities that a stronger oil dim still satisfies — to be re-run, not assumed) | **Yes** (visual change): 390×844 video + before/after screenshots, Owner review | **Yes**: no `PizzaStage.tsx`, no bake-filter CSS, no icon files. Closes #502 and the #519 visual after merge. |
| **S2 — multi-sauce engine guards** | `buildHintLine` all-sauces fix; guard tests with a synthetic 2-sauce fixture (hint both orders, completion, discovery, research rows, inventory per kind, `deriveCoreSteps`, caps); optional `APPLY_SAUCE` defensive change as its own commit/PR | `data/hints.ts`, new `*.multiSauce.test.ts` files | 57-recipe hint parity golden; no production recipe changes | No (no visible UI for existing recipes; logic only) — evidence by tests | **Yes** |
| **S3 — grandma-pizza** | recipe + data (§6), DH4 gate re-run and allowlist (§5.4), count-pinned tests/goldens, E2E normal-flow (§5.6), Result report | `recipes.ts`, `recipeSauceProfiles.ts`, `referencePizza.ts`, `discoveryCatalog.ts`, `recipeHintRoles.ts`, `orders.ts`, gate/fixture tests, goldens, `e2e/expansion-grandma.spec.ts`, handoff + Result doc | all gates green; DH4 privacy sweeps with grandma; Scoring parity for the 57 existing recipes byte-identical | **Yes**: new recipe is a gameplay change → 390×844 video + before/after screenshots | Needs S1 and S2 merged first. Textual conflicts only in shared count-pinned test lists vs #503 (rebase); touches neither `ingredients.ts` nor glyph code, so no semantic overlap. |

Order: **S1 → S2 → S3** (S1/S2 independent, can run in parallel). S3 is blocked by: Owner confirmation of §8 items 1–4 and the live PIZZA DB check.
Merge/deploy/Production: none of these are done or implied here.

## 8. Owner decisions still needed (small)

1. Live PIZZA DB check for grandma (ingredients unchanged; nothing contradicts a pre-bake oil) — **gates S3 only**.
2. `ladderCredit: false` for grandma (recommended, precedent calabresa) vs credited.
3. Accept that the Hint 5.0 SAUCE rung names **both** sauces for this recipe (SAUCE rung is "every sauce").
4. Accept shipping a 2-sauce recipe **before** a multi-spread Technique (TQ-3) exists, with no technique registration in this scope.
5. Accept S1's oil-over factor as a **visual** change to *all* multi-sauce pizzas in Free Cooking/Research that lay oil over another sauce (single-sauce and non-oil layers unchanged); value to be reviewed on the S1 screenshots.
6. id/name: `grandma-pizza` / グランマピザ.
7. Sfincione: stays on hold (no action).
8. Two-different-base-sauce recipes (e.g. tomato + pesto): no 172 row evidences one → "later candidates" only; none is selected.

### §8 per-item status (added 2026-10-18; the items above are kept as written)

Each row cites the record it rests on. This PR approves nothing beyond item 3.

| § | Item | Status | Record |
|---|---|---|---|
| 8-1 | Live PIZZA DB check (ingredients, oil before/after bake, pan form) | **Open** (still blocks E) | Issue #521 comment 6247267082 ("未完了（E をブロック）"); not re-verified here |
| 8-2 | `ladderCredit: false` | Recorded as decided in #521 (not re-verified here) | #521 comment 6247267082 (Owner decision record, 2026-10-18; the prep audit it cites lives on branch `claude/grandma-pizza-recipe-prep-0qh3qu`, not on main at the time of writing) |
| **8-3** | **SAUCE rung names both sauces** | **Approved — OD-544-3** (Issue #544, 2026-10-18), **scoped to `grandma-pizza`** | #544 comment 6247310535 (Owner decision record); also listed as decided in #521 comment 6247267082 |
| 8-4 | Ship a 2-sauce recipe before TQ-3 | Recorded as decided in #521 (not re-verified here) | #521 comment 6247267082 |
| 8-5 | S1 oil-over factor (current `0.3` kept) | Recorded as decided in #521 (not re-verified here) | #521 comment 6247267082 |
| 8-6 | id / name `grandma-pizza` / グランマピザ | Recorded as decided in #521 (not re-verified here) | #521 comment 6247267082 |
| 8-7 | Sfincione on hold | Recorded as decided in #521 (not re-verified here) | #521 comment 6247267082 |
| 8-8 | Two-different-base-sauce recipes | Recorded as decided in #521 (later candidates; none selected) | #521 comment 6247267082 |

Rows other than 8-3 are copied from the cited Issue comment so that this document does not contradict it; they are **not** approved by this edit. When the prep audit lands on main, its record supersedes this table. Until then, the earlier statement above ("§8 items 1–4 … are still open") is historical.
