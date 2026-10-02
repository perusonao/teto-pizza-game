# Discovery 3.0 No.27 Vertical Slice — pesto-pollo + chicken — Result

Issue: #342. Branch: `claude/discovery-3-no27-vertical-slice-0tq2rx`. Implementation (not an audit).

## 1. Base

| | |
|---|---|
| Base `origin/main` (fresh fetch, unchanged during the task) | `064873e6f7aef471386780baf32443fd0812badb` |
| Authority (read only, not merged) | `claude/discovery-3-no27-reconciliation-2b1z8v` → `docs/reports/TETO_DISCOVERY-3_NO27_AUDIT_RECONCILIATION.md` + its step-25 harness/JSON; audit branches `claude/discovery-3-172-recipe-readiness-audit`, `claude/discovery-3-no27-audit-2w9mpn`. The 172 recipes were not re-audited. |

**Duplicate Gate.** Open PRs mentioning pesto-pollo/chicken: #218, #255, #293, #296 — all docs/data/tools audits, none implements No.27. Branches: only the audit branches above. Issues: no open issue for No.27 / pesto-pollo / chicken (semantic search: 0 results). No duplicate implementation exists.

## 2. Owner decisions applied

No.27 = `pesto-pollo`; display name `ペストポッロピザ` (existing authority: `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` / 172 matrix `nameJa`); new ingredient `chicken`; Hint family `meat`; ladder step 25 unlocks chicken; steps 1–24 untouched; `ladderCredit` true; `lunchRush` false; key-free Hint; no new mechanic; no CUT; save schema unchanged (v2); No.28 not implemented.

## 3. Final recipe data (`src/data/recipes.ts`, appended as No.27)

```ts
{ id: "pesto-pollo", nameJa: "ペストポッロピザ",
  requiredIngredients: [pesto×1, mozzarella×2, fresh-tomato×2, chicken×3],
  bakeTarget: { start: 50, end: 70 }, baseRewardPitz: 100, lunchRush: false }   // ladderCredit absent = true
```

Source-authoritative (172 matrix `pesto-pollo-pizzadb-p12`, status READY, FULL, no capability): name, sauce base **pesto** (family-derived バジル), ingredient set **チキン / トマト / モッツァレラ** (= chicken / fresh-tomato / mozzarella), cheese present (mozzarella), canonical id `pesto-pollo`. Companion rows: `RECIPE_SAUCE_PROFILES` (pesto, PAINT), `RECIPE_DISCOVERY_TARGET_IDS` (`pesto-pollo-pizzadb-p12`), `RECIPE_HINT_ROLES` (`{ keyFree: true }`), `ORDERS` (`order-pesto-pollo`), `PESTO_POLLO_REFERENCE` (7 pieces in the RT-01 ring: mozzarella 2 / fresh-tomato 2 / chicken 3). Not CUT-eligible (no CUT this slice, same as calabresa).

## 4. Final chicken data (`src/data/ingredients.ts`, 30th ingredient, appended last)

```ts
{ id: "chicken", category: "topping", nameJa: "チキン", color: "#d9a066", emoji: "🍗" (U+1F357),
  placement: "scatter", unlockCondition: { minTotalStars: 0 } }
```

A finite ladder material exactly like the W1 seven: no `pricePitz` / `restockQuantity` / `starterGrantOnly` / `pieceVisual` (no new display mechanic). Taxonomy `["chicken","meat"]`. Shop (derived, not authored): step 25 → tier T3, k = 3 → pack 30 (10 pizzas), first pack 100 Pitz, refill 50. Existing ingredients' `minCount` / pack unchanged (pesto k 1, fresh-tomato k 3 — pinned).

## 5. Calibration values and rationale (gameplay calibration, NOT source authority)

Surveyed from the existing 26 production recipes (`recipes.ts`):

| value | choice | rationale |
|---|---|---|
| pesto / mozzarella / fresh-tomato / chicken counts | 1 / 2 / 2 / 3 | Sibling `pesto-caprese` has the same pesto + mozzarella + fresh-tomato skeleton (1 / 2 / 3); mozzarella 2 copied, tomato lowered 3→2 so the headline meat carries the weight and the 7-piece total fits the ring. Existing meat counts are 2–4 (sausage 3,2,3; pepperoni 4,1; bacon 3,2,2; ham 1–3; tuna 3,3), the usual headline count is 3 → chicken 3. Fresh-tomato k stays 3 (its max is still `pesto-caprese`), so no existing pack size moves. |
| non-sauce pieces | 7 | ≤ 8-slot RT-01 reference ring (like caprese 7, calabresa 8). |
| bakeTarget | 50–70 | Same window as the sibling `pesto-caprese` (6 recipes use 50–70, 7 use 58–78); no new window. |
| baseRewardPitz | 100 | All 26 existing recipes are 100 (Pitz Reward V1). |
| chicken emoji / color | 🍗 / `#d9a066` | Distinct from `ham` 🍖; plain-emoji convention used by corn / eggplant / pineapple / potato. |

Quantities are not part of the Discovery identity (the matcher uses the ingredient set), so these only affect scoring/Completion Gate/shop packs.

## 6. Step 25 pool verification (real production functions, no mock)

`src/state/discoveryNo27.pestoPollo.test.ts` (16 tests; same functions as the reconciliation harness: `resolveShopEntitlement`, `recipeDiscoveryState`, `selectHintTarget`, `hintSheetView`):

| state | pool | result |
|---|---|---|
| Case A: calabresa undiscovered, chicken unlocked, **not bought** | calabresa only | `TARGET:brazilian-calabresa`; pesto-pollo = `KNOWN_BUT_MISSING_MATERIAL` |
| Case A, chicken **bought** | calabresa + pesto-pollo | **`OPEN_POOL`**; sheet = `{ kind: "OPEN_POOL" }` (no candidate) |
| Case B: calabresa discovered, chicken not bought | ∅ | `SHOP_NEW` |
| Case B, chicken **bought** | pesto-pollo only | `TARGET:pesto-pollo` (auto) |
| both discovered | ∅ | `COMPLETE` |
| steps 1–24 | pesto-pollo `UNKNOWN` at every step; chicken not entitled at 24 | steps 1–24 byte-identical to `W1_25_DISCOVERY_LADDER` |

The Inspector (`src/dev`) now reads step 25 as `OPEN_POOL_POSSIBLE` (calabresa carried + pesto-pollo new), as the reconciliation audit predicted.

## 7. ladderCredit verification

pesto-pollo credited (`countsTowardLadder` true): 25 W1 found → 25; + pesto-pollo → 26; calabresa stays `ladderCredit:false` (25 → 25). Pinned in the focused test and the existing calabresa test.

## 8. Hint verification (key-free)

`RECIPE_HINT_ROLES["pesto-pollo"] = { keyFree: true }`; key-free recipes are exactly calabresa + pesto-pollo; **no `KEY_TOPPING` added** (Migration A contract kept). Rungs actually applicable: `SAUCE` (pesto), `CHEESE` (mozzarella), `STRUCTURE`, `SUB_CLASS`×2 (chicken, fresh-tomato) — no KEY_TOPPING, no empty rung. The lone-target sheet JSON contains no recipe name/description and no distance / similarity / candidate / Near / Far wording (test). HV: the Hint sheet for the lone target shows only "わかっていること" (the existing newest-material known line) + the paid-hint CTA.

## 9. Lunch Rush exclusion

`lunchRush:false` → `participatesInLunchRush` false; `missionOrderRecipeIds` with every recipe discovered + every ingredient owned/in stock excludes pesto-pollo and calabresa (pool = 25). Updated `lunchRush.exclusion.test.ts` (originals = 25 participate; opt-outs = calabresa + pesto-pollo).

## 10. Notebook N2 / Near-Far anti-leak

N2 (#340) untouched: `diffCombination` is still a pure function of two of the player's own combinations; tests show `＋チキン` / `−チキン` diffs and that the diff/notebook JSON never contains pesto-pollo, pool, hint, candidate, distance or Near/Far words. Near/Far neutralization (#338) untouched: a real free-cook "near miss" (everything but chicken) records `feedback: null`; the full recipe is `NEW_DISCOVERY` and does not enter the notebook. HV Notebook screenshots show "前回からの変更 ＋ チキン".

## 11. Save compatibility

`schemaVersion` still 2; default save field list unchanged; no persistence code changed. Existing saves: chicken is simply an additional ladder-reachable id (the entitlement ledger is a union, unknown ids already survive — `persistence.forwardCompat` tests unchanged and green). A W1-complete save (25 credited) reaches step 25 and chicken is entitled on next resolve.

## 12. Changed files

**Production (9 data files):** `src/data/{recipes,ingredients,ingredientTaxonomy,discoveryLadder,discoveryCatalog,recipeSauceProfiles,recipeHintRoles,orders,referencePizza}.ts` (9 files; `discoveryLadder.ts` adds `POST_W1_APPENDED_STEPS`). No reducer / persistence / component / mechanic changes.

**Tests:** new `src/state/discoveryNo27.pestoPollo.test.ts`, `e2e/discovery3-no27-pesto-pollo.spec.ts`, fixture `src/logic/scoringV2/__fixtures__/scoreParity.no27-pesto-pollo.json` (own fixture, frozen 25 + calabresa fixtures untouched), regenerated `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` (only +1 catalog-comparison candidates for chicken/meat/protein/topping). ~55 existing tests had count/ladder pins migrated 26→27 / 29→30 / 24→25 steps / chapters 6·10·10→6·10·11 (pesto-pollo is chapter 3, T3); where a test models "the W1 population" it now excludes the appended-step recipe (`W1_RECIPES`, `PRODUCTION_W1`) instead of weakening an assertion. DH4 guard gate: the synthetic-family DH4-2A leak count is a snapshot of the production TOPPINGS shape (84 → 76); the hardened guard still leaks 0. 9 e2e specs: dex pill `N/26` → `N/27`, RT-01 case count 27.

## 13. Focused tests (local)

Full unit suite once on the final tree: **304 files / 5691 tests pass, 1 skipped** (base: 5674 tests). `tsc -b` clean, `oxlint` 0 new warnings. The required list: recipe 26→27 ✔, ingredient 29→30 ✔, No.1–26 numbering ✔, pesto-pollo = No.27 ✔, chicken = step 25 ✔, steps 1–24 ✔, before/after purchase pools ✔, calabresa discovered/undiscovered ✔, OPEN_POOL ✔, ladderCredit true + calabresa false ✔, lunchRush false ✔, key-free Hint ✔, Near/Far ✔, N2 anti-leak ✔, save compatibility ✔. WebKit was not run locally (left to the required `e2e-webkit` gate).

## 14. Human Verification evidence

`e2e/discovery3-no27-pesto-pollo.spec.ts` (Chromium, 390×844 and 360×800, both pass; real Shop purchase, real FREE rounds, anti-spoiler sweep, no overflow, no console errors). Screenshots (committed, `docs/reports/screenshots/no27-pesto-pollo/`, each at both widths):

| file | shows |
|---|---|
| `no27-shop-chicken-new` | Shop: チキン NEW, 10ピザ分（30個）, 初回 100 Pitz (**before** purchase) |
| `no27-shop-chicken-bought` | after purchase: 在庫 30 (**after**) |
| `no27-hint-key-free` | Hint sheet, key-free, no recipe name/count |
| `no27-trial-without-chicken` | FREE: chicken-less trial = ORIGINAL result, nothing about the hidden recipe |
| `no27-notebook-chicken-diff` | Notebook: 試作 #2 前回からの変更 ＋ チキン |
| `no27-new-recipe-discovered` | NEW RECIPE DISCOVERED: ペストポッロピザ |
| `no27-dex-no27` | Dex: No.11 of 第3章 (11/11), overall 27 / 27 = recipe No.27 |

Video: not produced — the Owner allowed screenshots / minimal evidence when existing CI + e2e evidence suffices; the e2e spec above is committed and runs in the required CI gates. Video Verification: N/A (no video).

## 15. Final Gate (CI / Codex / threads / mergeability)

Recorded on the PR (#PR_NUMBER) at merge time — see the PR's final Result comment. Merged only if every Final Gate item is PASS; STOP after the post-merge automatic checks (no No.28 / IP-2 / R6).
