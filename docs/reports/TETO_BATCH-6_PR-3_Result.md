# Batch 6 PR-3 (#420) — ⭐ unlock notice and 「⭐あと○個」: Result Report

- Base: `main` @ `4f320dd` (PR #437 squash-merged). Branch `claude/batch6-pr3-star-notice` (branch only, **no PR**; Owner iPhone HV pending).
- Authority: Issue #420 OD-420-1, the PR-3 Fresh Audit and Owner Decisions OD-B6-PR3-1..6. Nothing re-audited.

## What changed
| OD | Behaviour | Where |
|---|---|---|
| PR3-1 | Lunch Rush: a star gate crossed by a serve (`MISSION_NEXT_ORDER`'s `newlyUnlockedMaterialIds`) is announced **on the run result overlay** (message only, one notice, no Shop CTA). Recorded run-scoped in the transient `GameState.missionMaterialUnlockIds` (never persisted; emptied by a new run and by every non-Mission round; deduplicated; kept when the run ends early). Free Cooking's existing notice is untouched. | `gameReducer.ts`, `MissionResultOverlay.tsx`, `GameScreen.tsx`, `App.css` |
| PR3-2 | load / restore / StateEditor: unchanged path (`resolveShopEntitlement` result discarded for notice purposes) → retroactive unlock, **no** notice. Pinned by tests. | no code change |
| PR3-3/4 | Shop: one aggregated 「⭐ あと○個で新しい材料が入荷」 line above the tabs, outside `.shop-locked`; only the smallest shortfall; applies only when the gated step is reached and the material is not entitled. Step not reached keeps the existing 「あと○つ発見…」 line (both can show). LOCKED slots are unchanged and identical. | `materialShop.ts` (`nextStarGateHint`, number only), `ShopOverlay.tsx` |
| PR3-5 | No name/id/gate appears anywhere new; Dex / Research / Hint untouched (Dex pinned by a test). | tests |
| PR3-6 | No save field/schema change; stars from the Dex, "already announced" = the existing ledger. | — |

Design note (Lunch Rush): registration happens on 「次の注文へ」 and the next order goes straight to PREPARE, so there is no RESULT screen to carry the notice at that moment; the run result overlay is the one place that shows it without touching the in-run layout. If the player abandons a run before its result, the notice is not shown (the Shop's NEW badge still is).

## Tests
- Focused: `materialShop.starGateHint.test.ts` (119/120, 129/130 boundaries, smallest shortfall, entitled, NaN/negative, number-only), `gameReducer.batch6StarNotice.test.ts` (Lunch Rush 119→120 announced, no duplicate, already-met save silent, run reset, early end, load silent + ledger idempotence), `ShopOverlay.starGate.test.tsx` (line placement, step-not-reached, anonymity, Dex, run result overlay).
- Full Vitest (before the final two edits): 368/370 files; the 2 failures were my fallback change in `MISSION_RESET_ORDER` (reverted) — the affected suites and all of `src/state` pass afterwards. `tsc -b`, `npm run build` clean; oxlint: no errors (existing warnings only).
- E2E `e2e/batch6-pr3-star-notice.spec.ts` (3 tests × 390×844 and 360×800: 6 PASS) plus `shop-locked-422`, `lunch-rush-result-ranking-phase4`, `expansion-batch6` (18 PASS). The panel stays inside the viewport and no horizontal overflow at both sizes.

## Human Verification (Owner iPhone, pending)
Screenshots: `docs/reports/screenshots/batch6-pr3/` (before / after, 390×844 and 360×800). The video is delivered directly and not committed. To check on a device: (1) Shop with 119 stars at step 50 → one ⭐ line, anonymous LOCKED slots; (2) a save already past 120 → goat-cheese appears as NEW with no notice; (3) Lunch Rush crossing 120 → the run result shows the notice once; Free Cooking notice still works.

## HV walkthrough automation (test-only)
`e2e/batch6-pr3-hv.spec.ts` + `e2e/support/starGateSave.ts` seed only the e2e dev server's starting save (no game, Production or StateEditor change) and record one continuous real-browser video per viewport: A step 50 / 119⭐ (Shop 「⭐あと1個」, anonymous LOCKED) → B step 50 / 120⭐ (silent retroactive unlock, goat-cheese NEW) → C step 51 / 129⭐ → D step 51 / 130⭐ (spinach NEW, no LOCKED slots left) → E Lunch Rush crossing 120⭐ (notice on the run result once, then Shop). Run: `HV_OUT_DIR=artifacts/hv HV_VIDEO_SIZE=390x844 npx playwright test e2e/batch6-pr3-hv.spec.ts --project=iphone-390x844` (and `360x800` / `iphone-360x800`). Screenshots: `docs/reports/screenshots/batch6-pr3-hv/`. Videos are not committed. Lunch Rush note: the serve's star result decides the final total (a PASS margherita lands at 120 or above); the run is 119 → ≥120.
