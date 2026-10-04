# LC-R6-e — Production Hand activation: Fresh Audit + Gate Report (pre-activation)

Issue #375 · PR #376 (**MERGED** `b8617ac`, 2026-10-03) · parent #369 · authority: OD-5 (HAND capacity = **12**).
Status: **COMPLETE on the Owner-confirmed scope** — Owner approved the activation, Production deploy #269 succeeded, Owner iPhone Production HV PASS on the checks listed in section 8. Section 7 items the Owner did not report are listed in section 8 as NOT recorded (not claimed). Sections 1–7 are the pre-activation Gate Report as delivered.

## 1. Activation diff (the whole behavioral change)

`src/logic/catalog/handPolicy.ts`: `HAND_ENFORCEMENT_PRODUCTION = false` → `true`. Nothing else in `src/` changes behavior
(comments only). Capacity stays `DEFAULT_HAND_CAPACITY_PRODUCTION = 12`. The Preview variant (`LC_HAND_PREVIEW_CAPACITY`,
main = `null`) is unchanged and, with production ON, no longer affects enablement (capacity override only, 9/12).

## 2. What changes for players (FREE Cooking incl. Research trials, `isLargeCatalogEligible` only)

- TOPPING tray shows the hand (≤ 12; 23 toppings → 2 pages) + 食材庫 button; pantry tiles pin/unpin (R6-c UI, capacity-full notice).
- Unchanged: Dinner / guided / Lunch Rush (excluded), SAUCE / CHEESE trays (catalog < 12), small collections (inactive hand = OFF).
- Hand / pins are session-only (`HandSession` in App state).

## 3. Save / schema impact: **none**
No save key, `schemaVersion`, or persisted field added/changed; no migration. Pins are never written.

## 4. Preview ↔ Production parity
`e2e/lc-hand-preview-activation.spec.ts` (real `vite build`s, Chromium + WebKit in CI): production (as committed) = Hand ON/12, no badge;
production + variant 12 + query/storage decoys = production; Preview (variant null) DOM = production DOM; Preview + variant 12 = same hand.

## 5. Rollback
1. One line: `HAND_ENFORCEMENT_PRODUCTION = false` (or revert the single squash commit) → push to main → `deploy.yml` redeploys.
2. Proof: the same spec builds production with that line rewritten and asserts the DOM equals the committed pre-activation golden
   (`docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6b_PRODUCTION-DOM-GOLDEN.json`) byte-for-byte; the `hand-off` Vitest project
   (`*.handOff.test.*`) keeps the OFF behavior tested with the flag rewritten to false. No data cleanup needed (nothing persisted).

## 6. Test adaptation (intended consequences of ON, no weakened guards)
- Vitest: default / hand-on-9 / hand-on-12 / **hand-off**; production tests pin capacity 12 and the literal flag.
- e2e: `discovery-research-rows`, `free-cooking-phase3-2` (tray = 12 of 15, 2 pages), `large-catalog-pantry-shell/shelves` (any hand chip instead of basil),
  `large-catalog-pin-dormant` → `large-catalog-production-pantry` (pin UI live + keyboard floors), activation spec rewritten (above).
- Mutants: M28 / V13 now "activation lost"; V3/V3b/V7/V9 retired as equivalent under ON.

## 7. Required Production Human Verification (Owner, after merge-approval decision)
Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`: Production URL, iPhone Safari: FREE cooking → TOPPING shows 2 pages + 食材庫; pin/unpin; capacity-full
notice; search→pin; Research trial reaching an off-hand ingredient; Dinner / Lunch Rush unchanged; reload loses pins (session-only) with save intact.
Screenshots (before = rollback build, after = production): `docs/reports/screenshots/lc-r6e-production-activation/` (390×844, Chromium).
360×800 / hardware / VoiceOver / PWA remain NOT claimed (as in the R6-c result).

## 8. Production Human Verification record (post-activation)

Production deploy: Deploy to GitHub Pages #269 for `b8617ac0218bf20eb53f68ed12dea09db20e3fa8` (success); main E2E WebKit #505 success. Codex review was not run on PR #376 (recorded as a fact; no blocking finding, unresolved threads 0, CI all green at merge).

**First Owner HV attempts (FAIL, then explained / unresolved):**
1. Research trial with only 4 toppings owned (basil / egg / mushroom / bacon): no 食材庫, no pin UI. Explained by design, not a defect: the hand is inactive while a category holds <= 12 owned, and the 食材庫 entry needs more than one tray page (> 6 owned) (`workingSet.ts`, `pantryAvailability.ts`). HV authority: owned <= 6 = no 食材庫 / hand inactive; 7-12 = 食材庫 shown / hand inactive; >= 13 = hand 12 active.
2. With 30/30 owned the Owner saw tray 1/4 and a 食材庫 whose tiles could not be pinned (= the flag-OFF UI). Local reproduction on a real production build of `b8617ac` (27/27 discovered, 30/30 owned, Free Cook and Research via Dex and via HOME) showed tray 1/2 and working pin/unpin, so main's build was not at fault. **The root cause of the 1/4 symptom was not determined**; it is NOT recorded as "stale build / cache". It no longer reproduces.

**Owner iPhone re-verification on the latest Production (PASS):** HOME レシピ 27/27, 所持 30/30種; レシピ発見 → 具材, topping tray 1/2 and 2/2; 食材庫 opens; card pin / unpin works; 「📌 選択中」 strip; 📌 badges on several ingredients; at capacity 「手元がいっぱいです。使わない食材のピンを外してね」; pinned hand appears on the tray after closing. UI matches expected: YES. Pin event / hand update / capacity guidance: PASS. Rollback not needed; no code fix needed. Not claimed: VoiceOver, standalone / PWA, 360x800 hardware.

**Separate follow-up candidate (NOT a #376 blocker):** before anything is pinned, nothing shows that a 食材庫 card is tappable (in hand mode the whole card is the pin toggle; the 📌 badge and the 「選択中」 strip appear only after a pin). Duplicate Gate: no existing issue covers it (#369 scope = Dinner shelves, counts, LC-4, favorites / recents; #377 / #378 are Discovery routing / stock deadlock). Recorded on #369 as a follow-up candidate; no UX work started.

**Section 7 checklist vs what the Owner reported (nothing below is claimed as Owner-verified unless listed above):**
- Owner-confirmed PASS: tray pages 1/2 and 2/2, 食材庫 opens, pin / unpin, 「📌 選択中」 strip and 📌 badges, capacity-full notice, pinned hand reflected on the tray, 所持 30/30種 / レシピ 27/27.
- NOT reported / not recorded as Owner-verified on the Production iPhone: search → pin (keyboard), reaching an off-hand ingredient in a Research trial, Dinner / Lunch Rush unchanged, reload dropping the pins with the save intact, HOME / Dex / Research routing regression pass, horizontal-scroll / layout check.
- Automated coverage that exists for those items (CI green on `f11120a` / `b8617ac`; this is test evidence, NOT an Owner HV claim): `discovery-research-rows` (Research trial reaching an off-hand ingredient through the 食材庫), `e2e/home-research-entry-parity` (HOME routing coexistence), the Dinner / guided / Lunch Rush exclusion unit tests (`isLargeCatalogEligible`), session-only hand / pins (no save change), `lc-hand-pin-ui` (search → pin, Preview build) and the layout-contract / WebKit shards.
- Per the Owner's instruction (2026-10-04) the Production HV is treated as PASS on the Owner-confirmed scope above. The unreported items were not explicitly waived; they stay open as optional Owner spot-checks.

**Status:** HAND 12 Production activation (R6-e) COMPLETE on the Owner-confirmed scope. Save / schema impact: none.
