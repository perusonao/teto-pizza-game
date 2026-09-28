# Discovery Hint 5.0 — H5-4 Round-6 Enablement behind the Flag: Result

- **Issue:** #292.
- **Authority:** `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md`, rounds 1–6. Round 6
  (§2, §5.3) records the Owner Decisions taken after the H5-4 Fresh Gate (`5eadb96`).
- **Base:**
  - `main` is `86b48fd`, re-fetched and unchanged;
  - H5-3 head is `1ec4253`;
  - the Fresh Gate commit is `5eadb96`.

**Goal of H5-4.** Production behaviour with the flag OFF stays exactly as it is. With the flag ON,
every one of the current 25 recipes completes the Hint 5.0 ladder safely.

**Not in scope, and not done:**
- the production flag stays **OFF**, and production activation is not implemented;
- no no-sauce hint;
- no TQ authority, recipe, ingredient, taxonomy or Cooking Steps change;
- PR #275 / #293 / #295 are unchanged, and nothing is merged.

## 1. Owner Decisions applied (round 6)

| ID | Implemented as |
|---|---|
| **OD-H5-P4-CHEESE** | An empty CHEESE rung is a normal OPEN / COMPLETED rung.<br>• A request is `ANSWERED` at 10 Pitz and stores `h5:cheese` only (no `ing:`).<br>• The board entry carries `none: true`, and the sheet renders the row 「チーズ」 with a 「なし」 chip.<br>• **M3:** the only legacy fact that states the absence is the Economy 1.0 count line (「…チーズは使わないみたい」, `legacyOwnsIngredientTotal`). With it the request is `ALREADY_KNOWN` at 0 Pitz; otherwise 10. |
| **OD-H5-P4b** | The same for KEY_TOPPING: `h5:key`, the row 「キートッピング」 with 「なし」. No legacy fact makes it already known, so it always costs 10. |
| **OD-H5-P4-SAUCE** (reserved) | Only an empty **SAUCE** rung keeps status `EMPTY` → `RESERVED_EMPTY_RUNG` (0 Pitz, no fact, never 「なし」). A stray `h5:sauce` never completes it. `hint5ReservedRungs()` lists it; the new production gate B requires `[]`, and G7 is unchanged. |
| **OD-H5-M2 = all 25** | There is no per-recipe enable list. The flag-ON target set is every production recipe, protected by gates A–C (§5) plus G7, T-COV and the M3 sweeps. |
| **OD-H5-RETIRE** | With the flag ON, `PURCHASE_SELECTABLE_HINT` is refused (H5-2), and the ladder replaces the 材料 / 構成 / 特徴 body (H5-3).<br>**New in H5-4: fail closed.** When the ladder is active but has no view for the target (e.g. a missing taxonomy row), the sheet offers nothing, instead of showing the old body with dead buttons. |

## 2. Changes

| File | Change |
|---|---|
| `src/logic/discovery/hint5Ladder.ts` | Round-6 empty rungs:<br>• `hint5ReservedRungs()`;<br>• EMPTY status only for an empty SAUCE rung;<br>• the M3 known check for an empty CHEESE / KEY rung;<br>• `none` on name-rung board entries. |
| `src/state/discoveryHint.ts` | `hint5LadderActive(state)`: flag ON, a DISCOVERABLE target, and not the Dex-0 onboarding |
| `src/components/HintSheet.tsx` | The 「なし」 chip (no glyph) and its live-region text 「チーズ：なし」; the `hint5Active` prop and the fail-closed body |
| `src/screens/GameScreen.tsx` | Passes `hint5Active={hint5LadderActive(state)}` (one import line and one prop) |
| `src/App.css` | `.hint-sheet__chip--none` |
| `src/logic/discovery/hint5Flag.ts` | Doc only (M2 / RETIRE; the flag stays OFF) |
| `src/logic/testSupport/hint5EconomySim.ts` | Round-6 totals, plus `hint5LadderTotalBeforeRound6` for the comparison |
| Tests | `hint5Ladder.test.ts`, `hint5Ladder.migration.test.ts`, `hint5Production.gate.test.ts`, `gameReducer.hint5*.test.ts`, `hint5Economy.sim.test.ts`, `HintSheet.hint5.test.tsx`, `e2e/discovery-hint5-ladder.spec.ts` |
| Docs | Final Design round 6 (§2, §5.3, §12, §15, §16), this report, PROJECT_HANDOFF, screenshots under `docs/reports/screenshots/hint-5-h5-4/` |

**Not touched:**
- `gameReducer.ts`, the save schema and persistence;
- `recipes.ts`, `ingredients.ts`, `ingredientTaxonomy.ts` and `recipeHintRoles.ts`;
- techniques and Cooking Steps.

## 3. Results for the required gates (A–O)

| Gate | Result | Where |
|---|---|---|
| **A.** All 25 recipes walk the ladder from start to end | **PASS, 25 / 25.** Every recipe is walked at its own ladder step and at Dex 25, and margherita also at the Dex-0 onboarding. Every request is `ANSWERED` at the P-C price, `next` ends null with the complete line, and each completion record is stored exactly once. | `hint5Production.gate` A, `gameReducer.hint5` (all 24 paid targets through the reducer) |
| **B.** Production recipes that can reach RESERVED_EMPTY_RUNG | **0.** `hint5ReservedRungs` is `[]` for all 25. No reachable request state returns RESERVED, with or without an Economy 1.0 ledger. | gate B; `hint5Ladder.test` "RESERVED gate" |
| **C.** Purchase order sauce → cheese → key → structure → SUB_CLASS ①..ⓝ | **PASS.** Every recipe is offered exactly that sequence at the kind price. The ±1 index is STALE at every state. | gate C |
| **D.** M3-D ALL / PARTIAL / NONE | **PASS.** See §6. | migration, reducer, App, E2E |
| **E.** The last unresolved sub-topping shows its classification only | **PASS.** AC-1 now covers ≥ 46 cases, including the no-cheese targets. meat-lovers ③ shows 🥩 肉系, and no name appears. | G4, DOM, E2E |
| **F.** A single-candidate family shows its classification only | **PASS** (breakfast-pizza egg → ✨ ちょっと変わった材料) | G / DOM / E2E |
| **G.** Reload keeps the bought state and Pitz | **PASS** (§8) | reducer, E2E |
| **H.** A repeated purchase is not charged again | **PASS.** The same index is STALE and returns the same state, for 「なし」 rungs too. | reducer, `hint5Ladder.test` |
| **I.** Full Reset parity | **PASS.** Round-6 records are cleared too. | reducer |
| **J.** Unknown / forward-compatible facts are kept | **PASS** (unchanged: `tech:` / `shape:` / foreign `cls:` survive) | reducer |
| **K.** Flag OFF parity | **PASS.** `hint5LadderActive` is also false. | `gameReducer.hint5.flagOff`, E2E flag-OFF |
| **L.** The production bundle cannot use the DEV opt-in | **PASS.** 0 occurrences of `teto.dev.hint5Ladder` in `dist/assets/*.js`. | build |
| **M.** The legacy purchase path can be neither shown nor run with the flag ON | **PASS.**<br>• Reducer refuses `PURCHASE_SELECTABLE_HINT` (every family).<br>• E2E: no 「ヒントをもらう」, `.hint-sheet__prefs` or `[data-hint-family]`.<br>• DOM: the fail-closed sheet has only 閉じる. | reducer, E2E, DOM |
| **N.** Missing taxonomy fails closed, with no fallback | **PASS.**<br>• Pure / reducer: NOT_A_TARGET, 0 Pitz.<br>• UI (new): `data-hint-ladder="hint5-closed"`, nothing to buy, never the old body. | `invalidTaxonomy`, DOM |
| **O.** No recipe / ingredient / Technique identity leak | **PASS.** G6 (view model) and the DOM sweep (text + every attribute) now run over all 25 at every purchase state. The Technique regex (「ソースなし」, 「チーズなし」, 「使わない」 …) still passes on every view model: 「なし」 is rendered from a boolean, only for a bought rung. E2E `expectNoUndiscoveredIdentity` passes. | gates, DOM, E2E |

## 4. No cheese (OD-H5-P4-CHEESE)

**Targets:** marinara, fugazza, pizza-bianca, pesto-tonno, puttanesca-pizza.

- **Before the purchase:**
  - 「ヒント2: チーズ」 with 「このピザのチーズを教えるよ」 and 10 Pitz;
  - the DOM is byte-identical to every other target's (G15 DOM sweep);
  - no 「なし」 anywhere.
- **After the purchase:**
  - −10 Pitz;
  - the save gains `h5:cheese` only; e.g. marinara's ledger is `["ing:tomato-sauce","h5:sauce","h5:cheese"]`;
  - the board row reads 「チーズ」 | 「なし」;
  - the next offer is 「ヒント3: キートッピング」.
- **Reload:** the same row, the same balance, no recharge.
- **Full ladder totals:** marinara 40, fugazza 40, pizza-bianca 35, pesto-tonno 45, puttanesca 50.

## 5. No key topping (OD-H5-P4b, quattro-formaggi)

- The offer is 「ヒント3: キートッピング」 at 10 Pitz, with no 「なし」.
- After the purchase: 「キートッピング」 | 「なし」, and `h5:key` is stored.
- Then STRUCTURE (5) → the complete line. There is no SUB_CLASS (0 sub-toppings, P3).
- Total 35 = 10 + 10 + 10 + 5. The E2E walks all of it on both viewports.

## 6. M3-D

| Case | Result |
|---|---|
| **ALL** (name rungs, STRUCTURE, sub-toppings) | Unchanged from H5-3: 0 Pitz, told only after the request |
| **ALL** with a 「なし」 rung | A legacy Economy 1.0 count line 「チーズは使わないみたい」 → `ALREADY_KNOWN`, 0 Pitz, `h5:cheese` only, told after the request. Tested on all 5 no-cheese targets (pure), marinara (reducer, E2E). |
| **PARTIAL** (parmigiana) | Unchanged: 10 Pitz, both cheeses shown |
| **NONE** | 10 Pitz. This covers the 「なし」 rung when the line was never seen: a fresh save, only `meta:ingredient-total` (DH4 states a total only), all names known, or a lower legacy level. The key 「なし」 is always 10. |
| **Before any request** | The same next rung, price and board as a fresh save, for every legacy set (pure sweep > 500 comparisons, DOM sweep of 24 targets). The balance check uses the normal price first. |

## 7. FREE LEAK gates

- **G15** (pure and DOM): after 0–3 rungs every target's offer is identical, and **no target stops
  early any more**. In H5-3, 6 targets were skipped as "stuck"; now all 24 are compared at every
  prefix.
- **「なし」 is never in an offer:** DOM, for every target at k = 0..3, the next card never contains
  「なし」. In the pure layer, `none: true` appears only on the board entry of a COMPLETED rung.
- **No SUB_CLASS before STRUCTURE**, and no later rung, count or kind visible (E2E): unchanged.
- **The legacy archive:** 「以前のヒント」 may show the player's own old line 「…チーズは使わないみたい」.
  That is the player's own purchase, and it is independent of the ladder's offer (M3 archive rule).

## 8. Save / reload / reset

- **No schema bump and no migration.** The new ids are existing grammar (`h5:cheese`, `h5:key`).
- **Reload** (reducer and E2E): the 「なし」 row, the balance and the next rung are restored, and the
  old index is STALE.
- **Full Reset** clears everything; the ladder restarts at rung 1.
- **Older builds** keep `h5:` ids verbatim (H3-2).

## 9. Economy re-run (P-C, round 6)

### Static totals (24 paid targets, margherita onboarding excluded)

| | H5-2 | **H5-4** |
|---|---:|---:|
| Total | 910 | **970** |
| Mean | 37.9 | **40.4** |
| Min / max | 25 / 50 | **35 / 50** |

The 6 changed recipes (all others unchanged):

| Recipe | H5-2 | H5-4 |
|---|---:|---:|
| marinara | 30 | 40 |
| fugazza | 30 | 40 |
| pizza-bianca | 25 | 35 |
| pesto-tonno | 35 | 45 |
| puttanesca-pizza | 40 | 50 |
| quattro-formaggi | 25 | 35 |

- **OD-H5-E2 (no cap):** marinara and fugazza exceed their old 35 cap by 5. No other recipe exceeds
  its old cap.
- In H5-2 the 6 recipes could reach only their pre-「なし」 prefix (10 / 20), because the ladder stopped
  at the RESERVED rung.

### Progression walk

The walk runs the real reducer with the flag ON: fresh save → Dex 25, profiles NONE / FIXED4 (rungs
1–4) / FULL (every rung).

| Quality | Profile | Hint spend | Grind bakes | Unaffordable rungs | RESERVED stops | Ending Pitz | Hint share of the discovery reward (mean / max) |
|---|---|---|---|---|---|---|---|
| ★4 (q80, reward 150) | NONE | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 1550 → 1550 | – |
| ★4 | FIXED4 | 700 → **840** | 0 → 0 | 0 → 0 | 6 → **0** | 850 → 710 | 19 / 23 % → 23 / 23 % |
| ★4 | FULL | 795 → **970** | 0 → 0 | 0 → 0 | 6 → **0** | 755 → 580 | 22 / 33 % → 27 / 33 % |
| ★3 (q65, reward 130) | NONE | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 1050 → 1050 | – |
| ★3 | FIXED4 | 700 → **840** | 0 → 0 | 0 → 0 | 6 → **0** | 350 → 210 | 22 / 27 % → 27 / 27 % |
| ★3 | FULL | 795 → **970** | 0 → **1** | 0 → 0 | 6 → **0** | 255 → 160 | 25 / 38 % → 31 / 38 % |
| ★1 (q30, reward 70) | NONE | 0 → 0 | 26 → 26 | 0 → 0 | 0 → 0 | 70 → 70 | – |
| ★1 | FIXED4 | 240 → 240 | 38 → 38 | 24 → 24 | 0 → 0 | 70 → 70 | 14 / 14 % → 14 / 14 % |
| ★1 | FULL | 240 → 240 | 38 → 38 | 24 → 24 | 0 → 0 | 70 → 70 | 14 / 14 % → 14 / 14 % |

**Findings:**
- **No deadlock:** every profile × quality reaches Dex 25, and the balance is never negative.
- **RESERVED stops:** 0 everywhere; H5-2 had 6 per run.
- **★3 FULL** now needs **1** Margherita replay, at the last stage (quattro-formaggi). Its peak hint
  share is unchanged (38 %).
- **★1** is unchanged: after each stage's Shop pack only the first rung is affordable. This is the
  same soft friction as H5-2 and Economy 1.0.

## 10. E2E and checks

| Suite | Result |
|---|---|
| Full Vitest | **225 files · 4614 passed · 1 skipped** (pre-existing; H5-3 had 4599) |
| `tsc -b` / `vite build` | clean / OK |
| `oxlint` | 0 errors; 2 pre-existing warnings (`scoringV2.noSauceProfile.test.ts`) |
| E2E Chromium `iphone-390x844` + `iphone-360x800`: `discovery-hint5-ladder`, `discovery-hint-sheet`, `discovery-hint-facts-save`, `discovery-dex-hint` | **26 passed**, 8 skipped (pre-existing per-engine skips) |
| E2E `layout-contract` (`layout-chromium`) | **12 / 12** |

**New E2E tests (both viewports):**
- the no-cheese case (marinara) with reload;
- the no-key case (quattro-formaggi) to the complete line;
- the legacy 「チーズは使わないみたい」 line → 0 Pitz;
- RETIRE: no legacy purchase UI.

## 11. Human Verification

**Screenshots**, committed under `docs/reports/screenshots/hint-5-h5-4/`, in `390x844-*` and
`360x800-*` pairs.

*Before (the H5-3 build, `1ec4253`):*

| File | Shows |
|---|---|
| `before-h5-3-cheese-none-offer` | The cheese offer |
| `before-h5-3-cheese-none-tap-does-nothing` | After a tap: nothing changed, still 989 Pitz |
| `before-h5-3-key-none-tap-does-nothing` | The same on quattro-formaggi's key rung |

*After (H5-4):*

| # | Shows |
|---|---|
| 00 | Flag OFF |
| 01 / 02 / 03 | A normal recipe: initial, after STRUCTURE, the last SUB_CLASS classified |
| 04 / 05 | M3 ALL: before, then 「もう知っていた」 |
| 06 | M3 PARTIAL |
| 07 | Candidate = 1 |
| 08 / 09 | No cheese: before, then 「チーズ」 \| 「なし」 |
| 10 | No key: 「キートッピング」 \| 「なし」, then complete |
| 11 | Legacy 「チーズは使わないみたい」 → 0 Pitz |

**Videos** (delivered in the session, **not committed**):

| File | Viewport | Duration | Size | Codec |
|---|---|---:|---:|---|
| `hint5-h5-4-hv-390x844.mp4` | 390×844 | 102.0 s | 1,478,154 B | H.264 |
| `hint5-h5-4-hv-360x800.mp4` | 360×800 | 101.5 s | 1,494,934 B | H.264 |

**Scenarios in the video:**
1. flag OFF;
2. meat-lovers, the full ladder, where the last sub-topping shows 🥩 肉系;
3. marinara: the cheese offer, 「なし」 after the purchase, a reload that keeps it;
4. quattro-formaggi: 「なし」 for the key, then complete;
5. M3 ALL;
6. the legacy 「チーズは使わないみたい」 → 0 Pitz;
7. PARTIAL;
8. candidate = 1.

**Video Verification: PASS.**
- ffprobe: H.264 at 390×844 / 360×800, and both files decode to the end.
- A contact sheet (one frame per 5 s) and full frames at 35 / 50 / 80 s were checked:
  - 「チーズ」 | 「なし」 with the key offer at 10 Pitz and 180 Pitz;
  - quattro-formaggi's key offer with no 「なし」 before the purchase;
  - 「このヒントはもう知っていたよ！」 with 200 Pitz unchanged.

**Measurements** (Chromium DEV; sheet top / bottom and CTA top / bottom / height, in px):

| State | 390×844 | 360×800 |
|---|---|---|
| Normal, initial | sheet 604–844; CTA 765–809 (44) | sheet 560–800; CTA 721–765 (44) |
| Normal, last SUB_CLASS | sheet 365–844; no CTA | sheet 321–800; no CTA |
| No cheese, before | sheet 581–844; CTA 44 | sheet 537–800; CTA 44 |
| No cheese, after | sheet 536–844; CTA 44; 「なし」 chip 23 px | sheet 492–800; CTA 44; chip 23 px |
| No key, after | sheet 441–844; CTA 44 | sheet 380–800; CTA 44 |
| No key, complete | sheet 406–844; no CTA | sheet 362–800; no CTA |
| M3 ALL known | sheet 558–844; CTA 44 | sheet 514–800; CTA 44 |
| M3 PARTIAL | sheet 508–844; CTA 44 | sheet 464–800; CTA 44 |
| Candidate = 1 | sheet 421–844; no CTA | sheet 377–800; no CTA |

- In every state: the document scrollWidth equals the viewport width (no horizontal overflow),
  閉じる is 44 px, and no visible element is clipped.
- The E2E `expectLayout` asserts the same things at every checked state.

## 12. PR #295 / CS-1a

PR #295 is untouched. H5-4 changes the same `GameScreen.tsx` import line that H5-3 already
touched: it adds `hint5LadderActive`. So the textual conflicts are still adjacency-only (two import
lines in `GameScreen.tsx`, and new sections in `PROJECT_HANDOFF.md`), and keeping both sides
resolves them. There is no semantic overlap with Cooking Steps.

## 13. Remaining blockers and decisions

**Production activation blockers**, for a separate Owner go:
1. an Owner decision to turn `HINT5_LADDER_ENABLED` ON in production;
2. a Preview deployment;
3. the Owner's iPhone Human Verification on the Preview;
4. merge / release sequencing with PR #295.

There is no code blocker: gates A–O are green with the flag ON.

**The TQ-1D dependency (OD-H5-P4-SAUCE):**
- Any sauceless or Technique recipe fails G7 and gate B until TQ-1D decides "no sauce" (TQ P2 / P6,
  PR #293 K3).
- The runtime has none.
- 29 of the 172 complete rows are sauceless and stay out.

**Remaining Owner Decisions:**
- OD-H5-P4-SAUCE (at TQ-1D);
- the production activation go.

**STOP.** H5-4 is complete. The flag is OFF, nothing is merged, and H5-5 has not started.
