# New Sauces Phase A — flammkuchen + fromage-blanc-sauce (Result Report)

Issue #578 (tracking; claim posted). Branch `claude/resume-dev-work-issues-zl9pht`, base `e1b4ec1` (main after #630). **Not merged, not deployed, no shared Preview touched.** Production ON happens only when the Owner merges.
Authority: Owner approval of 2026-10-23 for Phase A (design: `docs/design/TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md` §10, NS-1..NS-10; the 172 matrix row `flammkuchen-pizzadb`).
Scope: **Flammkuchen alone** — no miso / yuzu-kosho / tahini, no new gesture, no new non-sauce ingredient (NS-9: the first slice needs none).

## 1. What shipped

| item | value |
|---|---|
| recipe | `flammkuchen` (タルトフランベ), No.62, Chapter 4; evidence id `flammkuchen-pizzadb` (`discoveryCatalog.ts`) |
| composition | fromage-blanc-sauce 1 / onion 3 / bacon 3 (the sauce first; the 172 matrix set is exactly bacon / fromage-blanc-sauce / onion) |
| sauce | `fromage-blanc-sauce` (フロマージュブランソース), `category: "sauce"`, `placement: "spread"`, color `#fffdf8`, existing **PAINT** (`RecipeSauceProfile.ingredientId` union widened by one member) |
| ladder | ordinary appended **step 55**, no star gate, key recipe `flammkuchen`; steps 1-54 unchanged |
| price / refill | **none per ingredient**: T4 tier rule (`materialShop.ts`): pack 120 Pitz = 10 uses (k = 1), refill 60 |
| Hint / Lunch Rush / credit | permanently key-free; `lunchRush: false`; ladder-credited (58 credited) |
| tables | `recipes`, `recipeSauceProfiles`, `discoveryCatalog`, `referencePizza` (6 pieces = the first 6 ring slots), `recipeHintRoles`, `orders`, ladder, validator manifest (`new-sauces-a`) |
| not touched | scoring, economy, save format (schema v2), CUT, `matcher.ts`, FINISH / late catalog, `ingredientTaxonomy` (sauces carry no topping family), `SAUCE_KINDS` fixture (stays the three original sauces), any #577 / #584 / #631 branch |

Totals (derived; `catalogLedger.test.ts` is the one ledger): **62 recipes / 67 ingredients (toppings 52, sauces 4) / 55 ladder steps / credited 58 / chapter sizes 6, 11, 18, 27 / Lunch Rush pool 25**.

## 2. PROVISIONAL values (Owner confirms; none of these is source authority)

| value | provisional choice | basis |
|---|---|---|
| counts | onion 3 / bacon 3, sauce 1 (6 pieces ≤ the 8-slot ring) | the matrix records no counts. Neighbours: `aussie` bacon 2 / onion 2, `fugazza` onion 4 |
| bake window | 58-78 | = the generic Free Cooking window, so the median-derived `FREE_COOK_BAKE_TARGET` stays 58-78 (as for shirasu-pizza) |
| CUT | **none** | the original is a thin rectangular tart; the CUT allowlist assumes a standard round dough. Added to `EXPECTED_NOT_CUT_ELIGIBLE` |
| color | `#fffdf8` | measured against the dough `#f3d9a4`→`#e2b876`: ΔE 13.7-20.7 at alpha 0.46, 24.8-36.9 at alpha 0.85 (olive-oil's `#e9d9a0` is 2.2-7.6 / 3.9-14.1 and needed its oil filter). No filter added. **Real-device HV decides.** |
| chapter 4 | 26 → 27 recipes | derived (§4) |
| source | the original page was not reachable from the build environment; the set comes from the 172 matrix only | AC-0 style: composition = matrix, everything else = calibration |

## 3. Verification (automated)

- Vitest: **508 files passed / 9368 tests passed** (1 file skipped as before); `tsc -b`, `npm run build` pass; `oxlint` only the existing warnings.
- New: `src/data/newSaucesA.flammkuchen.test.ts` (13 tests: sauce shape / no per-ingredient price / T4 offer, PAINT profile and Reference, no CUT, bake window, unique ingredient set, ladder step 55, chapter-4 behaviour).
- Existing-recipe regression: the three original sauces' render goldens (`PizzaStage.sauceRender.golden`), the Hint 5.0 production-25 golden and every existing recipe row are **unchanged**; `hint5.ladders55.json` gains 158 lines and **removes none** (append-only); `hint5.alphaFamilyOnly.json` adds the `flammkuchen` key; the DH4 audit JSON changes `category` 3 → 4 only. Ladder rule tests keep the wider steps 52-54 derivation and freeze 1-54 for the new step.
- Updated count / list tests (no assertion weakened): catalog ledger, shelf recounts (sauce 3 → 4), recipe lists, Lunch Rush opt-out (37), progression list, key-free population (37; sauce-only 7), selectable-hint 3-level list, material shop (step 55 row, hint chain), batch-6 ladder length, reachability baseline (below).
- **Reachability baseline (a ratchet in the allowed direction).** With 62 recipes a uniform-★2 profile reaches 124 stars, which meets goat-cheese's 120-star gate, so at ★2 only spinach-artichoke is gated (was both). Gate values are unchanged; ★1 still gates both; collateral and blocked steps stay empty; the slack stays 1 (58 − 55 − 2). Caused by catalog growth, not by a rule change.
- E2E (Chromium 390×844 and 360×800): `e2e/new-sauces-a.spec.ts` 4/4 (Shop NEW → purchase → Research without identity leak → paint → no cheese step → onion / bacon → bake → NEW DISCOVERY → Dex chapter 4 = 27; and the 26/27 save case). Related specs on both viewports, **74/74 passed**: `expansion-batch7a` / `8a` / `8b` (the 8b spec now pins its own `LAST_STEP = 54`), `expansion3-pesto-trapanese`, `tq-1d-no-sauce`, `sauce-layers-b2`, `sauce-gauge-489`, `ingredient-shelf-shop`, `ingredient-shelf-inventory`, `inventory-modal-stable-bounds`. The full E2E suite and WebKit are left to CI.

## 4. Chapter 4 and existing saves

- **A chapter has no persisted "cleared" flag and no reward.** `recipeChapters.ts` derives `discovered / total` from the Dex on every read; the save (schema v2) stores Dex entries, not chapter state.
- Effect of this change for a player who had discovered all 26 earlier chapter-4 recipes: **no Dex entry is touched**; the display reads 26/27 until flammkuchen is made, then 27/27 (tested in unit and E2E, including that opening the Dex rewrites nothing).
- Proposal (for Owner): **keep the derived display; do not add a persisted clear flag or a migration now.** The ladder entitlement ledger is a union and never re-locks, so no owned material is lost either. If a "cleared" reward is ever introduced, it must be recorded at the moment of clearing (so later growth cannot un-clear it); the unit test `chapter 4 for a save that had discovered all 26 …` is the case such a change must keep.
- The next ordinary step will not shift this: only the **late** catalog (ikura, OFF) is ordered after the ordinary steps, so its number moves from 55 to 56 when E5 enables it (the known E5 pre-decision in `lateCatalog.ts`, not new here).

## 5. #584 (not merged, not closed, not touched) — what carries over

Compared with `origin/pr584` (read-only):

| #584 item | effect on #578 |
|---|---|
| ordinary ladder step 55 (ikura) | **same slot as this PR's step 55**; only one can be the ordinary step 55. #627 made ikura a late (OFF) entry, so on main step 55 is free |
| `hint5.ladders55.json` (+202), DH4 JSON, `catalogLedger` / `recipes` / `progression` / batch-6 / material-shop / manifest edits | the same files and the same lines this PR edits; the later PR to land re-derives them (golden is mechanical: `vitest -u` on `hint5Ladder.golden55` and `alphaReport`) |
| `ladderReachability.starGate` ★2 split | **identical change** needed (confirmed independently here, 122 stars at 58 credited vs 124 at 62) |
| `selectableHint` whole-id matcher | specific to `salmon` ⊂ `salmon-roe`; not needed here (no id-prefix collision) |
| not on main: `e2e/expansion-batch8c.spec.ts`, screenshots, `TETO_EXPANSION-BATCH-8C_Result.md`, HANDOFF / Owner-decisions lines | independent of #578; keep or drop with the #584 decision |
| `salmon-roe.svg` / CSS | already on main via #627 |

Conclusion: #584 does not block this PR's content, but **whichever of #584 and this PR merges second must rebase its step 55 and counts**. Owner decides #584's fate; nothing was done to it.

## 6. Human Verification (UI / gameplay change — `TETO_HUMAN-VERIFICATION-POLICY.md`)

- Screenshots (committed): `docs/reports/screenshots/new-sauces-a/` — Shop NEW, Research entry, sauce chip on the tray, sauce painted on the dough, topped, NEW DISCOVERY, Dex; each at 390×844 and 360×800. No "before" set exists: the sauce, recipe and chapter slot are new (the other chapters' screens are unchanged and covered by the existing specs).
- Video (**not committed**; delivered directly to the Owner in the session): `new-sauces-a-flammkuchen-390x844.mp4`, H.264, 390×844, 23.2 s, 502 KB. It shows the purchase, the research round, painting the sauce, the cook, the discovery and the Dex. `Video Verification: PASS` (file exists, size > 0, plays to the end, whole viewport, the sauce is visible on the dough).
- **Owner real-device (iPhone Safari) HV is still open**: the colour on a real display, the painted look after baking (raw / perfect / burnt), the gauge fill, tap feel.
- AC-8 (salmon-roe 3-state re-measurement in the late look) and Q-5 (ring upper bound) are **unchanged and remain required before E5**; this PR does not touch them.

## 7. Owner decisions still open

1. Colour `#fffdf8` after the real-device HV.
2. Counts (onion 3 / bacon 3), bake window 58-78 and "no CUT" (all provisional).
3. Original-page confirmation of the composition (not reachable from this environment).
4. The chapter-4 proposal in §4 (derived display, no flag).
5. #584: close / keep / port the remainder; and which of #584 and this PR merges first.
6. Merge, and any shared Preview update (not done).
