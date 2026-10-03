# Large Catalog UX — LC-R6-c Result (Preview Hand / Pin UI) and OD-5 record

Issue #371 (child of #369) · PR #372 · base `main` `4250767` (#319, LC-R6-b merged). Authority: the R6-a Owner Decisions (OD-R5e-1, OD-R5e-3 / OD-R6a-4, OD-R5c-5 / OD-R6a-5; history `7727cdc`) and OD-5 below.

## 1. OD-5 — Owner Decision (2026-10-03): the hand's capacity is **12**

> 手元（HAND）の正式容量は「12個」を採用します。

Decided by the Owner after a real-device ABBA comparison (A = HAND 9, B = HAND 12, B, A) on an iPhone at 390×844. The decision is final: 9 vs 12 is **not** re-evaluated. HAND 9 is not kept as a production value; it stays only as a supported Preview-variant value / test parameter (`HAND_CAPACITY_CANDIDATES`). The decision is pinned by `src/logic/catalog/handPolicy.capacity.test.ts`.

### Evidence (what was actually checked)
Preview variants (disposable HV commits, one line `LC_HAND_PREVIEW_CAPACITY`, never merged; both children of the R6-c head `cf9cd30`):

| Variant | Commit | Branch |
|---|---|---|
| HAND 9 | `33fe17b0102138f1ed5c4044661b1531c3beb01c` | `hv/lc-hand-9-r6c-cf9cd30` |
| HAND 12 | `da17f12fcdd1c6edb7bb5a71390b3a9ca7e6b346` | `hv/lc-hand-12-r6c-cf9cd30` |

Deployed to the single Preview URL in sequence (ABBA) through the existing two-step pipeline (`Build & deploy a source PR/branch`, then `Deploy Preview to GitHub Pages`; Preview repo `perusonao/teto-pizza-game-preview`): A `33fe17b` (Preview main `a3a4ffc`, runs 37135777877 / 37135857296) → B `da17f12` (`f65baea`, 37136729812 / 37136806500) → A `33fe17b` (`aef10be`, 37137129794 / 37137192217). After each deploy the served `site/` bundle was read: source SHA, badge capacity (`Or(9)` / `Or(12)`), Preview save key, Preview `start_url`, `noindex`. (The Pages host itself is not reachable from the authoring sandbox.) Production was untouched (main `4250767`; the last Production deploy #266 belongs to the #319 merge).

**Owner-reported, confirmed on the real iPhone (390×844-class screen):**
- HAND 9: badge HAND 9; 9 ingredients (page 1 = 6, page 2 = 3); full hand; the 10th pin refused with 「手元がいっぱいです。使わない食材のピンを外してね」; unpin → pin another; the change shows on the cooking screen; no blocker. Returned to HAND 9 at the end and re-confirmed.
- HAND 12: badge `PREVIEW · PR#372 · da17f12 · HAND 12`; 12 ingredients (page 1 = 6, page 2 = 6); full hand; the capacity-full notice; no visible layout breakage; no noticeable pressure on the pizza / controls area with 6 chips on page 2.
- Owner Decision: HAND 12.

**Not reported as verified on a real device (not claimed here):** search → pin keyboard behavior (OD-R5c-5 initial behavior) and Japanese IME on iPhone, VoiceOver, standalone / PWA start, 360×800 hardware, the Research Target trial and shelf-chip switching on a real device. These were exercised only by the automated Chromium e2e below.

## 2. What LC-R6-c changed (Preview hand ON only; production Hand OFF)
1. **Pin UI only for an active hand (OD-R5e-1)**: `GameScreen` `handEditing = HAND_ENFORCEMENT_ENABLED && trayHand?.ids != null`.
2. **Capacity-full notice (OD-R5e-3 / OD-R6a-4)**: a refused NEW pin writes nothing and shows 「手元がいっぱいです。使わない食材のピンを外してね」 (no number) as an overlay at the sheet's bottom edge for 3 s, mirrored in an always-mounted `role="status"` polite region; any next pin action clears it. The region exists only while pin editing is on.
3. **Keyboard kept on pin during search (OD-R5c-5 / OD-R6a-5, initial)**: while the search field has the focus a tile press does not take it (`pointerdown` `preventDefault`).

Not changed: `lcHandPreview.ts` mechanism, production Hand OFF, save / schema (hand / pins stay session-only), Dinner, Hint 5.0, taxonomy; favorites / recently-used are out of scope.

## 3. Verification (automated)
Component `IngredientPantry.pinNotice.test.tsx` (10); App `App.handPinUi.handOn.test.tsx` and re-based `App.handPins.handOn.test.tsx` in `hand-on-9` / `hand-on-12`; mutation probe `tools/large-catalog-ux/r6c-pin-ui-mutants.mjs` 11/11 killed; Chromium e2e `e2e/lc-hand-pin-ui.spec.ts` on a real Preview build at 390×844 and 360×800 (full hand / pin / unpin / notice, shelf chips + pin, search → pin keeps the field focused, hand → selection → placement, no pin UI on sauce / cheese, Research Target trial through the pantry, the Owner's seed `?hv=calabresa-key-free`); production DOM golden byte-identical (`lc-hand-preview-activation`). Required CI on `cf9cd30`: 9/9 success.

OD-5 follow-up in the same PR: capacity wording (no "undecided" in code / config comments), `handPolicy.capacity.test.ts` pinning 12, the e2e restricted to the HAND 12 build.

## 4. Open / next
R6-e (production activation, a separate Issue / PR) is the only slice that turns the production switch on; it keeps the formal capacity 12 and the session-only design. This PR leaves `HAND_ENFORCEMENT_PRODUCTION = false`.
