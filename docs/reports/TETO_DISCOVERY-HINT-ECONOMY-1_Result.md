# Discovery Hint Economy 1.0 — Implementation Result (Issue #232)

Status: **HE-1..HE-5 implemented.** Owner UI Review (HE-3): **PASS** (HE-UI-1..4).
Branch: `claude/discovery-hint-economy-1-wjqjov`, based on `main` `42ce428` (unchanged during the
work) + Fresh Audit `23fadc2`.
Authority: `docs/reports/TETO_DISCOVERY-HINT-ECONOMY-1_FRESH-AUDIT.md`, Issue #232 (OD-HE-1..10).

## 1. What changed

| Slice | Commit | Content |
|---|---|---|
| Fresh Audit | `23fadc2` | Audit + 25-recipe simulation harness (test-only) |
| HE-1 | `f7f1210` | `discoveryHintPurchases` in save v2 (no schema bump), carried on `GameState` |
| HE-2 | `977d369` | Candidate B price table, pure `purchaseDiscoveryHint`, `PURCHASE_DISCOVERY_HINT` (replaces the free `REVEAL_NEXT_HINT`), ledger-driven sheet view, harness production mode + parity |
| HE-3 | `59f681a` | HintSheet CTA 「🔒 次のヒントを解除　N Pitz」 + 「所持 N Pitz」, neutral disabled state, free onboarding (✨) |
| HE-4 | `7761478` | HE-UI-4 purchased-target preference, Dex / Result / Free Cooking integration, timer-pause regression for purchases |
| HE-5 | `00c52bf`… | Final economy gate on production, full test gate, Codex P2 fix (onboarding exemption = Dex 0 + Margherita) |

## 2. Owner decisions implemented

- **OD-HE-1 Candidate B:** H0 0 / H1 5 / H2 10 / H3 20 / H4 40 (75 per recipe). `DISCOVERY_HINT_PRICES`.
- **OD-HE-2/3:** paid once per recipe × level, the first time it is unlocked; re-reading is free forever.
  H4 is one level (one purchase shows every H4 line, still n-1 capped).
- **OD-HE-4:** `discoveryHintPurchases: Record<recipeId, highestPurchasedHintLevel>` in the save.
- **OD-HE-5:** Dex 0 **and** target Margherita (the onboarding): H1–H4 free, session-only, nothing written, no
  Pitz shown. Any other recipe DISCOVERABLE at Dex 0 (possible on a migrated save) is priced normally — fixed
  after the Codex review on PR #233 (the first version exempted every Dex-0 target).
- **OD-HE-6:** short Pitz disables the CTA only; 閉じる / backdrop / Escape and cooking always work.
- **OD-HE-7:** no H5 (`discoveryHintPrice(5)` throws; level 5 is rejected by the authority).
- **OD-HE-8:** OD-HINT-5 stays OFF (near-miss untouched).
- **OD-HE-9:** Lunch Rush untouched (a Mission round rejects the purchase action; no `mission/*` change).
- **OD-HE-10:** ★1 economy not tuned (see §6 follow-up).
- **HE-UI-1:** all levels bought → no balance line, 「ヒントはここまで！」; header Pitz unchanged.
- **HE-UI-2:** short-Pitz copy 「たまったら解除できるよ。このまま作ってもOK！」 (two lines at 390px).
- **HE-UI-3:** onboarding line uses ✨, never 🎁 / retired gift wording (existing source guard kept green).
- **HE-UI-4:** a DISCOVERABLE recipe with purchased levels stays the target on re-open, including after a
  reload (no session); a Dex pin still wins; when it is no longer DISCOVERABLE the deterministic order decides.

## 3. Transaction authority

`PURCHASE_DISCOVERY_HINT { level }` → `unlockNextHint` (`src/state/discoveryHint.ts`) →
`purchaseDiscoveryHint` (`src/logic/discovery/hintPurchase.ts`). The reducer re-validates: sheet open in a
Free Cooking PREPARE, session target still DISCOVERABLE (a stale / discovered / out-of-stock target is
rejected), purchased level, requested level = purchased + 1 (no skip, no re-buy: a double tap or stale
event is a no-op), level ≤ the recipe's max and ≤ 4, price, balance (never negative), Dex-0 exemption.
The debit and the ledger raise land in one state transition. The UI only reports the offered level.
Free Cooking 「ヒント」, Result 「💡 ヒントを見る」 and Dex 「💡 ヒントを見る」 all open the same sheet and dispatch
the same action.

## 4. Save compatibility

| Check | Result | Test |
|---|---|---|
| schemaVersion stays 2 | ✅ | `persistence.discoveryHintPurchases.test.ts` |
| Old v2 save (no field) → `{}` | ✅ | same |
| v1 save migration → `{}` | ✅ | same |
| Current save round-trip | ✅ | same, `persistence.test.ts` |
| Malformed values dropped per entry, never the whole save | ✅ | same |
| Unknown well-formed recipe id preserved by persistProgress / persistDex / persistMissionBest | ✅ | same |
| Future numeric level (e.g. 6) preserved; gameplay clamps to max | ✅ | same, `hintPurchase.test.ts` |
| Monotonic `max` merge (stale snapshot never lowers / drops) | ✅ | same |
| No-op write when unchanged | ✅ | same |
| Record retained after the recipe is discovered | ✅ | same, reducer + walk tests |
| Full Game Reset clears the ledger | ✅ | same |
| Reload persistence (App / e2e) | ✅ | `discovery-hint-sheet.spec.ts` |

## 5. Economy — Final Gate on production (Candidate B)

The Fresh Audit harness (`simulateHintEconomy`) runs with `transaction: "production"`: every hint level is
bought through the real reducer (START_FREE_COOK → SHOW_HINT → PURCHASE_DISCOVERY_HINT → CLOSE_HINT).
Because the real sheet shows REFILL for an out-of-stock target, the production walk refills such a
material before buying (`refillBeforeHint`); the parity run turns the same rule on for the simulated
walk, so the two differ only in the transaction path.

- **Price parity:** Candidate B curve == `DISCOVERY_HINT_PRICES` ✅
- **Transaction / Pitz balance / refill-before-hint parity:** production result deep-equals the simulated
  result, stage by stage, for all 18 runs ✅
- **Dex 25 reached:** 18/18 ✅ — **hard deadlock = 0** ✅ — min Pitz ≥ 0 everywhere ✅
- Every paid stage spends a prefix sum of 5/10/20/40 (0/5/15/35/75); Dex 0 spends 0.

| ★ | Profile | Hint spend | Shop spend | Earned | Ending | Min Pitz | Refused hints | Experimental | Replays | Total bakes | Hard deadlock |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| ★4 (Q80) | P0 | 0 | 5650 | 5850 | 200 | 0 | 0 | 416 | 11 | 427 | no |
| ★4 (Q80) | P1 | 120 | 5730 | 6050 | 200 | 0 | 0 | 391 | 23 | 414 | no |
| ★4 (Q80) | P2 | 350 | 5510 | 6050 | 190 | 0 | 1 | 306 | 23 | 329 | no |
| ★4 (Q80) | P3 | 660 | 4430 | 5250 | 160 | 0 | 2 | 233 | 15 | 248 | no |
| ★4 (Q80) | P4 | 1480 | 2920 | 4550 | 150 | 0 | 0 | 101 | 8 | 109 | no |
| ★4 (Q80) | P5 | 1180 | 3380 | 4750 | 190 | 0 | 4 | 167 | 10 | 177 | no |
| ★3 (Q65) | P0 | 0 | 5650 | 5810 | 160 | 0 | 0 | 416 | 22 | 438 | no |
| ★3 (Q65) | P1 | 115 | 5900 | 6210 | 195 | 0 | 1 | 414 | 32 | 446 | no |
| ★3 (Q65) | P2 | 360 | 5500 | 6050 | 190 | 0 | 0 | 303 | 35 | 338 | no |
| ★3 (Q65) | P3 | 610 | 5060 | 5810 | 140 | 0 | 4 | 285 | 32 | 317 | no |
| ★3 (Q65) | P4 | 1120 | 3950 | 5250 | 180 | 0 | 9 | 174 | 25 | 199 | no |
| ★3 (Q65) | P5 | 1140 | 3420 | 4690 | 130 | 0 | 7 | 163 | 18 | 181 | no |
| ★1 (Q30) | P0 | 0 | 5650 | 5730 | 80 | 0 | 0 | 416 | 189 | 605 | no |
| ★1 (Q30) | P1 | 95 | 5730 | 5910 | 85 | 0 | 5 | 391 | 208 | 599 | no |
| ★1 (Q30) | P2 | 195 | 5720 | 5990 | 75 | 0 | 15 | 414 | 202 | 616 | no |
| ★1 (Q30) | P3 | 190 | 5630 | 5890 | 70 | 0 | 20 | 392 | 202 | 594 | no |
| ★1 (Q30) | P4 | 195 | 5720 | 5990 | 75 | 0 | 24 | 413 | 202 | 615 | no |
| ★1 (Q30) | P5 | 260 | 5440 | 5770 | 70 | 0 | 28 | 323 | 201 | 524 | no |

Note: P5 ★3 needs 181 total bakes here versus the audit's 216. The difference comes from refilling before a hint
(audit tables had that off). Relative ordering and all conclusions of the audit are unchanged.

## 6. Anti-spoiler

#229 Final Gate invariants unchanged and re-checked: the HintSheet DOM sweep (25 recipes × every shown
step, text + every attribute, now including the price / balance footer; "Pitz" is the only ASCII word
allowed), the e2e whole-document sweep (`expectNoUndiscoveredIdentity`, hidden/offscreen text and all
attributes) on the paid CTA, purchased H4, insufficient state, Dex → Hint and Result → Hint. The CTA text
is only 「🔒次のヒントを解除 N Pitz」 / 「🔒次のヒント N Pitz」 — no ingredient, recipe, remaining count or total.
No recipe id is placed in any `data-*` / `aria-*`. The ledger stores undiscovered recipe ids in
localStorage (same exposure as `unlockedForShopIngredientIds`, accepted in the audit §12).

## 7. Mobile / Layout

`e2e/discovery-hint-sheet.spec.ts` (all 7 Layout Contract profiles on Chromium: N390 390×844, N360 360×800,
S390 390×664, S360 360×640, P390i / E390i / E360i safe-area): before purchase (H1 CTA), purchased up to the
longest H4 (capricciosa, 7 lines), insufficient Pitz, onboarding free, SHOP_NEW / REFILL / COMPLETE — each
checks no horizontal overflow, sheet ≤ 45dvh and inside the viewport, CTA above the bottom safe-area
inset, 閉じる inside the sheet, background rects identical to the closed state, and focus return to
「ヒント」. Dex → Hint (`discovery-dex-hint.spec.ts`) and Result → Hint (`discovery-near-miss-result.spec.ts`)
buy through the reducer and check the save. Reload persistence is covered in the purchase test.

## 8. Timer pause (#229 regression)

`App.cookingTimingBackground.test.tsx`: reading **and buying** hints is never billed — Dex CTA → new Free
Cooking → buy (0:08 exact), Result CTA → new Free Cooking → buy two levels (0:06 exact), in-round
「ヒント」, and a 0-Pitz round (CTA disabled, still cooks to RESULT, 0:04 exact).

## 9. Tests

Local (sandbox, final code). After the Codex P2 fix, Vitest / typecheck / lint / build were re-run in full and the
affected e2e (hint sheet, Dex → Hint, Result → Hint, onboarding, Layout Contract; 26 passed / 11 width-guard skips) re-ran green:

| Gate | Result |
|---|---|
| Vitest (full) | **3596 passed / 1 skipped** (170 files) |
| Typecheck (`tsc -b`) | PASS |
| Lint (`oxlint`) | PASS (0 findings) |
| Build (`npm run build`) | PASS (pre-existing chunk-size warning only) |
| Full Chromium E2E (`iphone-390x844`, `iphone-360x800`, `layout-chromium`) | **154 passed / 0 failed / 19 skipped** (skips = the existing per-width `runOnlyOnWidth` guards) |
| Layout Contract (`layout-chromium`, 7 profiles) | **7 / 7 passed** (inside the 154) |
| WebKit | not available in the sandbox — run by `.github/workflows/e2e-webkit.yml` on the PR (see the PR for the exact-HEAD CI result) |

New / changed focused suites: `hintPurchase.test.ts` (pure rule), `gameReducer.hintPurchase.test.ts`
(transaction, double tap, stale, skip, insufficient, Dex-0, pin, HE-UI-4), `persistence.discoveryHintPurchases.test.ts`
(save), `discoveryHint.walk.test.ts` (25-recipe Final Gate walk paying every level), `discoveryHintEconomy.sim.test.ts`
(parity + HE-5 gate), `HintSheet.test.tsx`, `App.cookingTimingBackground.test.tsx`, App / e2e hint flows.

## 10. Human Verification

HE-3 (the only visual change) — Owner UI Review PASS.

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `TETO_HINT-ECONOMY-1_HE3_390x844.mp4` (H.264) | 390×844 | 37 s | 654 KB | PASS |

Download: delivered directly in the session (not committed, per policy).
Video Verification: PASS

The video shows: A. H1 before purchase (5 Pitz, 所持 120), B. H1 purchase → H2 CTA (10 Pitz, 所持 115),
C. H3 shown + H4 CTA, F. close/re-open and reload keep the bought lines at no cost, D. insufficient Pitz
(H4 40 vs 所持 25, disabled, calm copy), E. Dex-0 Margherita free. Screenshots:
`docs/reports/screenshots/discovery-hint-economy-1-he3/` (`before-*` = main `42ce428`).
HE-4/HE-5 changed no visuals, so no new recording was made.

## 11. Scope guard

No change to the recipe ladder, recipe / ingredient definitions, Shop prices, discovery reward, scoring,
Lunch Rush, matcher / signature, near-miss (`resultNearMiss`), H5 or ★1 tuning (`git diff 42ce428` touches
none of `src/data/*`, `src/mission/*`, scoring, `pitzReward`, `materialShop`, matcher, signature,
`resultNearMiss`).

## 12. Follow-up candidates (not done here)

- ★1 economy deficit (Fresh Audit §9.4, OD-HE-10): P0 ★1 needs ~189 Margherita replays with or without hints.
- REFILL copy could mention that purchased hints return after a refill (audit R-4 / its OD-HE-9 idea) — not
  in the Owner decisions, left as is.
