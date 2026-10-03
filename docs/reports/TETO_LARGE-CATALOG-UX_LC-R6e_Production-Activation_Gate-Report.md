# LC-R6-e — Production Hand activation: Fresh Audit + Gate Report (pre-activation)

Issue #375 · PR #376 (draft, **not merged**) · parent #369 · authority: OD-5 (HAND capacity = **12**).
Status: implemented, CI-gated, **waiting for Owner Production-activation approval**. Merging this PR is the activation.

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
