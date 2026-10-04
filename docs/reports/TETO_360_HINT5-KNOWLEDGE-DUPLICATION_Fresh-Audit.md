# #360 — Hint 5.0 knowledge duplication: Fresh Audit (docs-only authority)

- Audited main: `cd7f82de18c5c4508c173f98db6a113df9b0c9df` (Contract 2.1 RESULT identification Production ON; #377 / #378 COMPLETE).
- Status: **S1 (this record)**. No runtime / test / save / schema change. Implementation slices S2 / S3 are separate PRs (§9).
- Method: read-only reading of `hint5Ladder.ts`, `recipeHintRoles.ts`, `state/discoveryHint.ts`, `HintSheet.tsx`, `researchEntry.ts`, Contract 2.1, H5-0 design; read-only scripts over the real pure functions (`buildHint5Ladder`, `requestHint5Rung`, `hint5Presentation`, `ingredientUnlockStep`); focused tests PASS (7 files / 127 tests: hint5Ladder, keyFree, Production.gate, researchEntry, researchResultRows, gameReducer.hint5, HintSheet.hint5).

## 1. Current Hint 5.0 ladder (Production flag ON)

Linear: SAUCE -> CHEESE -> KEY_TOPPING -> STRUCTURE -> SUB_CLASS ①…ⓝ. Price by rung kind only: SAUCE 10 / CHEESE 10 / KEY 10 / STRUCTURE 5 / SUB_CLASS 5.

| rung | discloses | stored facts | completion record |
|---|---|---|---|
| SAUCE | the recipe's sauce name | `ing:<sauce>` | `h5:sauce` |
| CHEESE | every cheese; 0 cheese -> 「なし」 after purchase only | `ing:<cheese…>` (none: completion only) | `h5:cheese` |
| KEY_TOPPING | `hintKeyToppingId` (legacy recipes only); none -> 「なし」 | `ing:<key>` | `h5:key` |
| STRUCTURE | 「全部で N 種類」 | `meta:ingredient-total` | `h5:structure` |
| SUB_CLASS ① | family of one sub-topping (never its name) | `cls:<id>` | `cls:<id>` |

Key-free recipes (brazilian-calabresa, pesto-pollo) have no KEY rung and no inapplicable rung (indices are consecutive). A no-sauce recipe is `RESERVED_EMPTY_RUNG` (TQ-1D; no production recipe).

Three names that must not be confused:

| name | meaning | Hint 5.0 |
|---|---|---|
| `hintKeyIngredientId` (`hintSteps.ts`) | Hint 3.0 free key = latest-unlocked ingredient | unused (M1); flag-OFF rollback, `nearMiss`, `deductionGuard` only |
| `hintKeyToppingId` (`recipeHintRoles.ts`) | subject of the paid KEY rung, authored | legacy 24 recipes only |
| Research `unlockIngredientId` | finite material owned last (`ownedIngredientIds` append order), derived, never stored | request-time known `ing:` for a Research Target only |

## 2. Knowledge Overlap Matrix

| knowledge | RESULT ○ | Research / Dex card | Notebook | Hint rung | persistent | overlap |
|---|---|---|---|---|---|---|
| sauce is X | every used unknown sauce (1 per attempt) | `✓ Xを使う` | `ソース: X○` (session only) | SAUCE | `ing:` | **complete** (category public; every production recipe has exactly one sauce) |
| cheese Y exists | every used unknown cheese | same | same | CHEESE | `ing:` | conditional: **closure** ("that's all" / "none") is not given by RESULT (INV-D7) |
| topping T exists | only if unknown toppings <= 3 | same | same | KEY / SUB_CLASS | `ing:` | conditional: the **role** ("T is the key / a sub-topping") remains Hint-only |
| unlock material | no (ownership-derived) | `✓` | no | request-time known | **no** (derived) | same as above |
| total N | never (OD-RB-6) | after STRUCTURE only | no | STRUCTURE | `meta:ingredient-total` | none |
| family of a sub-topping | never | `△ family` (`cls:`), already de-duplicated against exact-known | no | SUB_CLASS | `cls:` | complete for an already-known ingredient (family is taxonomy-deterministic) |
| "no cheese" | never directly; only inferable from all-× | no | `×` rows | CHEESE 「なし」 | `h5:cheese` | Hint is the only direct source (6 recipes) |

The Trial Notebook is session-only attempt history; it holds no knowledge SSOT.

## 3. Rung classification

| rung | class | reason |
|---|---|---|
| SAUCE | **C** complete duplicate once ○ | sauce category is public; one sauce per recipe and per pizza |
| CHEESE | **B** conditional | closure value remains; single-cheese recipe becomes 0 Pitz with closure on ○ (accepted, OD-360-5) |
| KEY_TOPPING | **B** + **D** | name duplicates; role bit remains; legacy-compat only (24 recipes) |
| STRUCTURE | **A** no overlap | RESULT never exposes a count |
| SUB_CLASS | **C** for a known ingredient / **A** for unknown | class of a known ingredient is deterministic |
| Hint 3.0 free key | **D** | flag-OFF rollback only |
| "no sauce" | **E** insufficient authority | TQ-1D reserved; no production recipe |

## 4. Measured overlap (26 recipes with a finite material; margherita is onboarding)

Unlock material by production ladder order (`ingredientUnlockStep`): KEY topping = 17 legacy recipes (marinara garlic, genovese cherry-tomato, bismarck egg, funghi mushroom, salsiccia sausage, pepperoni, napoletana anchovy, tonno-e-cipolla tuna, pizza-bianca rosemary, breakfast-pizza bacon, meat-lovers ham, melanzane eggplant, bambino corn, hawaiian pineapple, new-haven clam, pesto-caprese fresh-tomato, pesto-patate potato); CHEESE = 2 (quattro-formaggi fontina, parmigiana parmigiano); SAUCE = 2 (fugazza olive-oil, pesto-tonno pesto); SUB_CLASS = 5 (capricciosa black-olive, pizza-portuguesa onion, puttanesca capers, brazilian-calabresa onion, pesto-pollo chicken).

Caveat: the unlock fact is the material **owned last** (purchase order), not ladder order. Multi-finite recipes can therefore land on a different rung (e.g. capricciosa: KEY mushroom only if mushroom was bought last). Overlap is player-order dependent, not recipe-fixed. The Issue's capricciosa example holds only in that order.

Authority recipes with no cheese rung subject: marinara, fugazza, pizza-bianca, pesto-tonno, puttanesca, brazilian-calabresa (CHEESE sells only the 「なし」 closure at 10 Pitz).

## 5. Player-impact scenarios (measured with the real pure functions)

| # | state | result |
|---|---|---|
| 1 | no ○ | all rungs normal price |
| 2 | sauce ○ | SAUCE 0 Pitz (ALREADY_KNOWN); pre-purchase label still `10 Pitz` (M3) |
| 3 | cheese ○ | CHEESE 0 Pitz (funghi: with closure) |
| 4 | topping ○ = key | KEY 0 Pitz |
| 5 | sauce + cheese | both 0 Pitz; KEY+ normal |
| 6 | several + Research Target | all name rungs 0 Pitz; STRUCTURE 5 |
| 7 | Hint first | later RESULT excludes stored `ing:` from known(T); no duplicate ○ |
| 8 | RESULT first | known rung 0 Pitz; partly known rung charges full price and discloses only the unknown part (e.g. quattro-formaggi 2/4 ○ -> 10 Pitz for the rest) |
| 9 | legacy recipe | KEY rung present; unlock/KEY overlap depends on purchase order |
| 10 | key-free | no KEY rung; SUB_CLASS overlap only |

**No double payment exists**: a fully known rung is 0 Pitz, a partly known rung buys the unknown part. Real harm is presentation and friction:

1. Redundant tap-through of 0-Pitz rungs (linear ladder).
2. Duplicate display: Research card, Hint archive, then the board.
3. The archive mislabels RESULT ○ names. `hint5Ownership.knownNameIds` takes every stored `ing:`, so a ○ name is shown pre-purchase under 「以前のヒント／前のヒント方式でわかっていたこと」. (The derived unlock fact is not in the archive; only after completion on the board.)
4. A fully known rung is rejected with `INSUFFICIENT_PITZ` when balance < normal price (balance gate precedes the known check, M3).
5. Provenance is not recorded: a RESULT ○ and a purchase both end as stored `ing:` (+ `h5:*`), so they are indistinguishable afterwards. An unlock-derived fact is **not** persisted as `ing:` (request-time input only): an unlock-only ALREADY_KNOWN rung stores only its `h5:*` completion marker, and the unlock source stays derivable from ownership. ALREADY_KNOWN itself is a transient `hintOutcome`.

## 6. Privacy findings

- H5-INV-5 / M3 (FREE LEAK): the pre-purchase view may depend only on owned facts and constants. A "known" pre-mark compares a rung's content with the player's facts, so it is content-dependent.
- Only SAUCE is derivable from public invariants today (one sauce per recipe). CHEESE (closure), KEY and SUB_CLASS (role) would leak. The SAUCE invariant also breaks for future no-sauce / multi-sauce recipes -> not adopted (OD-360-1).
- ALREADY_KNOWN already exposes closure / role at 0 Pitz after a request (accepted, OD-I-14). Nothing new is disclosed by S2 / S3.
- No hidden recipe name, hidden ingredient, match count, distance, candidate count, similarity, or direct "no sauce / no cheese" is newly exposed by the adopted slices.

## 7. Owner Decisions (recorded)

| id | decision |
|---|---|
| **OD-360-1** | **Option A.** Keep Hint 5.0 ladder order, prices and knowledge contract; tidy display duplication first. **Not adopted:** B (SAUCE pre-mark / auto-skip; conflicts with future no-sauce / multi-sauce Expansion authority, no Production-27-only exception) and C (dynamic ladder). |
| **OD-360-2** | Change the archive wording that asserts origin (「以前のヒント／前のヒント方式でわかっていたこと」). First candidate **「これまでにわかったこと」**; must be source-neutral (RESULT ○ / Hint / existing stored fact). |
| **OD-360-3** | A fully known rung whose effective cost is 0 Pitz is completable even when balance < normal price. This changes the M3 balance-gate order, so it is a **separate implementation slice** from display. Partly known rungs charge as before; economy unchanged. |
| **OD-360-4** | No provenance persistence: no new save fact / schema / source provenance. Any needed display is derived from existing facts or session-transient. |
| **OD-360-5** | CHEESE closure unchanged: single-cheese recipe becomes 0 Pitz via RESULT ○ as today; INV-D7 (no direct "no cheese" from RESULT) kept. |
| **OD-360-6** | New recipes are permanently key-free. `hintKeyToppingId` / KEY_TOPPING stay only as existing-legacy compatibility; kept distinct from `hintKeyIngredientId` (Hint 3.0 free key / rollback). |

## 8. Privacy / contract invariants kept

Contract 2.1 unchanged (K = 3, known ✓ excluded from K, only positive ○ persisted as `ing:`, no negative persistence, targetless = no membership, membership independent of cooking quality, no direct "no sauce / no cheese", no ingredient-count correctness in RESULT). Hint 5.0 order / prices / M3 pre-purchase view / H5-INV-5 unchanged by S1.

## 9. Implementation slices

- **S1** (this PR): docs-only authority record. No runtime / test / save / schema change.
- **S2** (separate branch / PR after S1 merge): HintSheet archive source-neutral wording and removal of needless knowledge duplication on the board. Out of scope: ladder order, prices, reducer, persistence, save schema, Contract 2.1 RESULT rules, SAUCE auto-skip. UI change -> HV policy applies (390×844 video delivered directly + before/after screenshots under `docs/reports/screenshots/`).
- **S3** (separate from S2): fully known / effective-cost-0 rung completes under insufficient balance; partly known unchanged. M3 contract change -> focused regression required. S3 is not only a reducer / `requestHint5Rung` gate reorder: today `hint5Presentation` sets `next.affordable = false` when balance < normal price and `HintSheet.tsx` disables the button, so the request never reaches the gate. S3 must also define and test a **privacy-safe** presentation / CTA behaviour for the low-balance state (the pre-purchase view must not reveal whether the rung is fully known, H5-INV-5 / M3), and because it changes visible CTA behaviour it carries the UI HV requirement (390×844 video delivered directly + before/after screenshots) in addition to the focused regression.

## 10. Explicitly deferred (re-audit when Expansion needs them)

SAUCE pre-mark / auto-skip; dynamic ladder reconstruction; persistent provenance; no-sauce / multi-sauce Hint redesign (Expansion Gate A, Contract §13.1).
