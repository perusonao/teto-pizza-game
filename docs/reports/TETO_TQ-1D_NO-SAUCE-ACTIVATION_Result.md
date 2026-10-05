# TQ-1D / NO_SAUCE Production Activation — Result Report

Base: main `28fcabbab119a71d4c7338aca6ee66d931097f45` (#392 merged; Production Deploy run 282 success, post-merge WebKit run 543 success).
Authority: `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md` (§7 adds OD-TQ1D-1 / 2 / 3), `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md` (synced; Expansion Gate A **CLOSED**).
Follows `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`.

## 1. What shipped

Production recipe **No.32 `aussie`** (オージーピザ) — the first NO_SAUCE recipe — and the surfaces that make the Technique `no-sauce` (「ソースなし」) playable:

| Item | Value (Owner authority, unchanged) |
|---|---|
| Aussie | mozzarella 2 / bacon 2 / egg 1 / onion 2, **sauce none**, bake 50–70 (GAMEPLAY CALIBRATION), `ladderCredit:false`, `lunchRush:false`, CUT none, Hint key-free (no SAUCE rung, no KEY_TOPPING, no RESERVED), no new ingredient, no new ladder step, onion step 12 affordance |
| Technique | 「ソースなし」; discovered from the finished pizza's actual composition (usage path, Free Cooking) or by discovering Aussie (recipe path); never from a target identity |
| RESULT | technique stage (① Technique → ② Recipe) via the existing `lastTechniqueDiscovery` / `discoveryRevealOrder`; **no** 「ソース：なし」 row, no zero-point sauce row |
| Dex | 「調理法」 section: 「？？？」 + riddle until discovered (and only once the affordance is open), the name afterwards |
| Save | schema v2 unchanged; the existing `discoveredTechniqueIds` ledger; legacy / seeded saves repaired by the existing INV-TQ-1 backfill |
| Not done (Owner prohibitions) | near-miss production wiring (stays the single neutral line), RESERVED, schema bump, new ingredient / ladder step, Lunch Rush change, Wave 3, #394 / #391 |

## 2. Fresh Check drift (main `48152b9` → `28fcabb`)

Only #392 (Pantry / Inventory / Shop, `familyDisplay`, goldens) landed. No TQ-relevant production file drifted (`techniques/`, `scoringV2`, `referencePizza`, `recipes`, `completionGate`, `ResultPanel`, `DexOverlay`, `gameReducer` unchanged). Everything the Fresh Check found stayed valid; its three findings are the three Owner decisions below.

## 3. Population (recomputed mechanically from `28fcabb`, then after Aussie)

| | main `28fcabb` | this branch |
|---|---:|---:|
| recipes | 31 | **32** |
| ingredients | 34 | 34 |
| toppings | 27 | 27 |
| ladder steps | 28 | 28 |
| credited (counts toward the ladder) | 30 | 30 |
| `ladderCredit:false` | 1 (calabresa) | **2** (+ aussie) |
| `lunchRush:false` (Lunch Rush pool) | 6 (25 participate) | **7** (25 participate) |
| chapters | 6 / 10 / 15 | 6 / **11** / 15 (Aussie: key step = onion 12, T2 → chapter 2, No.11) |
| Research Entry pool at step 12 | 2 | **3** (portuguesa + calabresa + aussie) |

Mechanical counts come from `RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` / `buildRecipeChapters` (OD-TQ1D-3); stale docs / comments (the "6 / 9 / 10", "25-recipe", "Production-27") were not used as authority and are annotated.

## 4. Changed production files

`src/data/recipes.ts` (+aussie), `discoveryCatalog.ts` (+id), `recipeHintRoles.ts` (key-free), `orders.ts` (+order line), `recipeSauceProfiles.ts` (`aussie: null`, nullable getter), `referencePizza.ts` (`ReferencePizza.sauce: ReferenceSauce | null`, `AUSSIE_REFERENCE`, overloaded `computeMechanicalSauceReference`), `techniques.ts` (comments) ·
`src/logic/scoringV2/index.ts` (`approvedSauceTargets` skips null), `types.ts` (comment) · `src/logic/completionGate.ts` (no sauce check for a null sauce) · `src/logic/techniques/runtime.ts` (**affordance fix**), `dexView.ts` (new) · `src/state/materialEntitlement.ts` (`creditedDiscoveredCount`), `discoveryReveal.ts` / `gameReducer.ts` (comments) ·
`src/components/TechniqueReveal.tsx` (new), `ResultPanel.tsx`, `DexOverlay.tsx`, `ReferencePreview.tsx`, `DinnerGameUi.tsx`, `src/screens/GameScreen.tsx`, `src/App.tsx`, `src/App.css` ·
comment-only: `hint5Ladder.ts`, `HintSheet.tsx`, `researchResultRows.ts` · Preview-only (compiled out of production): `src/preview/hvSeeds.ts`.
Untouched: Pantry / Inventory / Shop, `familyDisplay` / `hintClassDisplay`, the #392 DOM golden, persistence schema, Lunch Rush.

## 5. Gate A resolution (OD-TQ1D-1: not waived, CLOSED)

The standard Research RESULT panel was already target-independent: rows come only from the **player's own** placed ingredients (`researchResultRows`). The resolution therefore needs **no Aussie-specific code** — it fixes the design and pins it:

- INV-D4: a sauce row exists only because the player used a sauce; a sauce-free pizza has no sauce row for **any** target (Aussie is not singled out); a sauce on Aussie is an ordinary ×.
- INV-D7 kept: no 「ソースなし」 / 「ソース不要」 / 「ソース：なし」 in the rows, Notebook feedback, stored facts, Research Entry card, Hint 5.0 view or near-miss line. The name is shown only by the technique stage / Dex, after the technique was discovered from the actual pizza.
- RESERVED stays retired: Aussie is key-free, so its ladder has **no SAUCE rung** (first rung CHEESE, no KEY_TOPPING); `hint5ReservedRungs` is empty for all 32.
- Contract 2.1 §0 / §3 / §10-table / §13.1 / §15 updated; the gate tripwires (G7 / RESERVED / DH4 `deductionProduction`) were updated to pin **exactly `aussie`** as the one technique recipe — they still fail on any other.
- Pinned by: `researchResultRows.test.ts` (Gate A), `gameReducer.techniques.privacy.test.ts` (7 tests: per-target rows / Notebook / persisted facts / Research Entry / Hint 5.0 / near-miss absence sweeps, and "technique derived from the pizza, identical for every target"), `hint5Production.gate.test.ts`, `deductionProduction.gate.test.ts` (the DH4 privacy sweeps now include Aussie).

## 6. Affordance fix (OD-TQ1D-2)

`runtime.ts` counted every discovered recipe (`discoveredRecipeIds(dexBefore).length`). It now uses `creditedDiscoveredCount` (`materialEntitlement.ts`, the same `discoveredRecipeCount(dex, countsTowardLadder)` the ladder uses). `TechniqueRuntimeContext.countsTowardLadder?` is injectable and defaults to the production rule. No new progression rule. Effect: 11 credited + calabresa (12 raw) no longer opens the technique early. Verified by mutation (reverting to the raw count fails `gameReducer.techniques.aussie.test.ts`).

## 7. Verification

| Check | Result |
|---|---|
| `tsc -b` | clean |
| `oxlint` | 0 errors; 2 warnings, both pre-existing on main (`scoringV2.noSauceProfile.test.ts:167-168`) |
| `npm run build` | OK |
| Vitest (full) | **345 files, 6244 passed, 1 skipped** (main after #392: 341 files / 6181; +4 files, +63 tests; no test skipped, retried or loosened) |
| Playwright Chromium 390×844 + 360×800 + layout-chromium (full) | **434 passed / 43 project-gated skips / 1 failed** in the last full run (3 workers; the 1 failure was `layout-contract` LC-5's own pin `26 → 27` cards, fixed and re-run green); all other previously-failing specs were re-run green after their pin / seed edits (incl. the new `e2e/tq-1d-no-sauce.spec.ts`, 4 scenarios × 2 widths, green on both) |
| WebKit | not run locally (no WebKit browser in this environment); the PR's `e2e-webkit` CI job is the authority |
| Scoring parity | the original 25 + calabresa / pollo / gamberi / Wave 2 fixtures unchanged; new own fixture `scoreParity.tq1d-aussie.json` (9 variants, NO_SAUCE profile) |
| Mutations | affordance raw-count (killed), riddle shown as name (killed) |

E2E notes (honest): after the first full run, 10 specs needed edits that follow from the intended changes — count pins (`/31` → `/32`, chapter 2 = 11, Research Entry pool 2 → 3 at step 12) and seeds that say "calabresa found" now also need `aussie` found, otherwise Aussie is an extra Research Entry. One Chromium spec (`layout-contract` LC-S3 FREE) failed because its "everything found" seed left Aussie as an entry (adds the 研究中 line, −23 px stage); it passes on main and passes again with `aussie` in its seed. Two specs (`discovery-hint-sheet:437`, `original-result-duplicate-notice:241`) hit the 30 s timeout once under 4-worker load and passed on re-run and in the later full 3-worker run; no timeout was raised, nothing was retried automatically or skipped.

## 8. Privacy verification

- Dex before discovery: 「？？？」 + riddle only, and only once the affordance (12 credited discoveries) is open; never the name, id or Aussie identity (`expectNoUndiscoveredIdentity` + attribute scan on the Dex, RESULT, Notebook).
- Research RESULT / Notebook feedback / Research Entry / Hint 5.0 view / near-miss: no absence wording and no technique word, for every target (unit sweep + E2E).
- **OD-TQ1D-4 (Owner, applied):** the Notebook's per-attempt entries are covered by INV-D7 too. An attempt made without a sauce now has **no sauce row / 「ソース: なし」 chip**, and a change to or from "no sauce" in the diff is shown as an ordinary ＋ / − of the sauce that changed (never 「ソース：… → なし」). Attempts that used a sauce, the membership feedback, RESULT rules, Technique discovery, persistence and the schema are unchanged. Pinned by `TrialNotebookSheet.test.tsx` (DOM text + aria). Contract 2.1 INV-D7 now reads as one simple rule across the Research panel / aria / Notebook / persistence.
- Near-miss: production RESULT shows the single neutral line (`resultNearMiss`), so there is no directional / SAUCE_ONLY line to leak; the k ≥ 2 pure code is **not** wired (Owner prohibition).

## 9. Technique reveal verification

`gameReducer.techniques.aussie.test.ts` (real production catalog, nothing mocked): Aussie by composition records `no-sauce` in the same REGISTER_TO_DEX write, reveal order `["TECHNIQUE","RECIPE"]`; a known technique is not revealed again; score / Pitz / Dex row are identical with or without it (no ★, no Pitz); a sauced Aussie-pieces pizza is not Aussie and records nothing; Lunch Rush / mission rounds record nothing; the usage path opens at 12 credited discoveries and not at 11 (nor at 11 + a non-credit recipe). `TechniqueUi.test.tsx` / `App.techniques.test.tsx`: the technique block precedes the recipe banner and appears once.

## 10. Dex verification

`dexView.test.ts` (pure) and `TechniqueUi.test.tsx` / E2E: no section before the affordance; 「？？？」 + riddle (no name, no id, no 「ソースなし」, whole-DOM attribute scan) when open and undiscovered; the name once discovered; Aussie's card is Chapter 2 No.11 with four ingredient chips and no sauce.

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `tq-1d-no-sauce-hv-390x844.mp4` (H.264, 25 fps) | 390×844 | 46.1 s | 1.1 MB | PASS |

Download: delivered directly in the session (not committed; `artifacts/review/` is gitignored).

What to check in the video (four scenarios, human pace, 1–3 s holds):
1. Dex: 「調理法」 shows only 「？？？」 + riddle (no name); Aussie is one anonymous Research card.
2. Research a sauce-free pizza that is **not** Aussie: the RESULT's technique stage 「新しい調理法を発見！ 「ソースなし」」, the result rows have no sauce row; the Notebook line has no absence wording.
3. Cook Aussie (mozzarella 2 / bacon 2 / egg 1 / onion 2, no sauce): NEW PIZZA オージーピザ, no second technique reveal, no ソース row; Dex now names 「ソースなし」 and shows Aussie as Chapter 2 No.11.
4. Fresh path: discovering Aussie first shows the technique **before** the recipe (once). Before the affordance (7 recipes) there is no technique section and a sauce-free pizza reveals nothing. Guided Aussie: no ソース step tab, the Reference popover shows pieces only.

Video Verification: PASS (ffprobe: h264 390×844, 46.08 s, 1,144,614 bytes; frames sampled across all four scenarios).

Screenshots (committed): `docs/reports/screenshots/tq-1d-no-sauce/` — `before-01…03` (main `28fcabb`: Dex without 調理法 / sauce-free original RESULT / Aussie-shaped pizza = ORIGINAL) and `tq1d-01…10` (after), at 390×844 and 360×800.

## 11. Residual risks

- WebKit is CI-only here.
- Step 12 now offers three Research Entries; a player who has found portuguesa and calabresa but not Aussie sees a lone entry whose research line appears (as it did for calabresa) — intended, but it changes the vertical budget of that state (layout contract seed updated, passes).
- The riddle copy 「いつもの“ぬるもの”がなくても…？」 is the Owner-approved working copy; the section heading 「調理法」 itself shows that a technique category exists once the affordance opens (P6).
- Calibration values (counts / bake 50–70 / Reference slots) are GAMEPLAY CALIBRATION, as for every recent recipe.

## 11b. Main sync and #397 integration (HEAD update)

- Main moved to `960bb3e` (#397 Cooking Tray family filter). `origin/main` was **merged** into the branch (no rebase / force push); the only conflict was `docs/PROJECT_HANDOFF.md` (both addenda kept). `App.tsx` / `App.css` / `GameScreen.tsx` auto-merged with no production conflict. #397's code and its tests were not modified.
- #397 integration: on the merged head the **full** Vitest (349 files, 6265 passed, 1 skipped) and the **full** Chromium E2E (390×844 + 360×800 + layout-chromium: 441 passed, 0 failed, 49 project-gated skips) passed, including #397's `cooking-tray-family-filter` spec (tray / HAND on-off / family filter / Pantry), the Research flows, Aussie Research / RESULT / technique reveal, the Dex and the layout contract. No timeout, retry or skip was used. The Research-screen family-filter gap seen in Production HV is #398-out-of-scope and is not touched.

## 12. FINAL GATE readiness

READY for the Final Gate review pending: CI (incl. WebKit) on the PR head, one Codex review on the exact head, and the Owner's Human Feel pass on the video. Not merged, no auto-merge.
