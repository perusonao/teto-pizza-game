# Sauce Remaining Gauge — Fresh Audit and Implementation Plan

Read-only audit (docs only). No runtime, CSS, E2E, scoring, save, economy or inventory change.
Audited main: `cbf3e37`. Not touched: PR #487, #488, #468.

## 0. Verdict

- **Nothing shows the player the sauce limit today.** The limit exists (`SAUCE_MAX_QUANTITY = 1.0`, one "bottle" per sauce application) and silently turns further holding into a no-op.
- **GO for a visual-only gauge** that reads data the app already holds. No new state, no scoring/save/economy/inventory change.
- **Recommended: Option B** (a slim vertical gauge in the stage's side margin, SAUCE step only, zero layout cost). Fallback: Option A (share the existing live-message row).
- Implementation waits for Owner approval (Section 9).

## 1. Duplicate check (latest main + GitHub)

| Item | Relation |
|---|---|
| Issue search "ソース 残量 / ゲージ / remaining / gauge / 消費" (issues and PRs) | **No existing issue or PR covers a remaining gauge.** |
| #475 Sauce Painting Human Feel 2.0 (open, READ-ONLY Fresh Audit) | Scope is 塗りムラ / 耳境界 / 焼成表現. Its Phase 0 lists 厚み・ムラ・塗布修正 but not remaining amount. PR #480 (its Slice 1) changed only the display rasterizer. **Related, not a duplicate; this audit keeps clear of the rasterizer.** |
| #474 Dough Shaping (DOUGH step) | Different step. |
| #37 / PR #66 Sauce Free Boundary (MERGED) | Defined overflow as conserved data (Section 2). The gauge builds on that. |
| #487, #488, #468 (mozzarella / Canvas) | Untouched. |

Decision: a **new issue** is the right home (a gauge is neither a painting-feel nor a mozzarella concern). It links #475 for context.

## 2. How sauce amount works today

All units are a normalized internal value, not grams (`sauceQuantity.ts` header).

- Tick: `SAUCE_TICK_MS = 50`, `SAUCE_RATE_PER_TICK = 0.02`; `SAUCE_MAX_QUANTITY = 1.0` (`src/logic/sauceQuantity.ts:28,33`).
  Continuous holding empties the bottle in 1.0 / 0.02 = **50 ticks ≈ 2.5 s**. Time-based, independent of pointer events or frame rate.
- Cap is on the **running total of every deposit, inside the dough and overflow together** (`tickDepositAmount`, `sauceQuantity.ts:96`). Once reached, `SauceDispenseController.step()` deposits nothing (`sauceDispenseController.ts`, `amount <= 0 → break`).
- Running total = `committedTotalRef` (all committed strokes of this application, `PizzaStage.tsx:305,319`) + `pendingTotalRef` (current uncommitted stroke, `:300-330`). `getTotalDispensed` returns the sum (`:603`).
- Commit: `COMMIT_SAUCE_DISPENSE` appends deposits to `pizza.sauceDeposits`. A **fresh application** (a different sauce than `sauceIds[0]`) clears the log, so switching sauce refills the bottle (`gameReducer.ts:951-985`). `RESET_PIZZA` empties it (`:1086`). Continuing the same sauce across strokes keeps accumulating toward the same cap.
- Deposits outside the dough still count toward the cap and are conserved as `overflowAmount`; `quantity + overflowAmount` = total dispensed (`sauceField.ts:278-320`).
- The dispense path is entered for **any** `placement === "spread"` ingredient (`isPaintMode`, `PizzaStage.tsx:270`), not only the Reference recipe. Tomato, pesto and olive oil share it.

## 3. How the amount is scored (read-only, unchanged)

- Scoring 2.0 reads `computeSauceMetrics(sauceDeposits)`: `quantity` (inside-dough part only), `coverage`, `evenness`, `edgeRatio` (`scoringV2/sauceComponent.ts`; weights 30/30/20/20).
- Reference target (Margherita and the mechanical derivation for the others): `quantity 0.92`, `coverage 0.72` (`referencePizza.ts:175`).
- Completion Gate floor: `SAUCE_MIN_RATIO = COVERAGE_POOR_RATIO / 2 = 0.275`; below it for quantity or coverage → `INSUFFICIENT_SAUCE` → FAILED (`completionGate.ts:95,134`).
- **A full bottle is not a perfect score**: overflow also drains the bottle, and the ideal quantity (0.92) leaves ~8% unused even with zero overflow. This is why the gauge must not look like a score.

## 4. How remaining amount is managed today

It is **not managed as a quantity at all.** There is no "remaining" field. The cap is enforced implicitly by `tickDepositAmount(total)`; the player gets no signal (no UI, no copy, no haptic) when it is reached. The existing `SauceMetricsPanel` shows 広さ / 均一さ / ふち tiers and a live message, none of which is remaining amount (`SauceMetricsPanel.tsx`).

Inventory is separate and **per pizza, not per amount**: a sauce costs 1 unit at `CONFIRM_BAKE` (`consumePizzaInventory`); APPLY/COMMIT only run a reservation check (`canPlaceIngredient`). No shipped sauce is finite. Painting more or less never changes stock.

## 5. What the number means (do not mix these three)

| Candidate meaning | Is it the gauge? | Why |
|---|---|---|
| **塗布可能量** = `1 − totalDispensed / SAUCE_MAX_QUANTITY` | **Yes — this and only this** | It is exactly the headroom `tickDepositAmount` enforces, per sauce application. |
| 在庫 (inventory units) | No | Per pizza (1 unit), consumed at CONFIRM_BAKE; unrelated to amount. |
| 塗布率 (coverage % / quantity score) | No | Scoring metrics; `quantity` excludes overflow, coverage is area. Showing them as a "remaining" bar would imply a target. |

Proposed label: **「ソース」 with a bar that drains from full to empty**, aria name 「ソース残量」. Visual rules: full at the start of each sauce application, drains while painting (including overflow), never refills by itself, refills only on switching sauce or やり直す. **No numeral** by default (a "%" would be misread as a score); expose `aria-valuenow` for assistive tech.

## 6. Display options

| | A. Share the live-message row | **B. Side-margin vertical gauge (recommended)** | C. Ring around the dough |
|---|---|---|---|
| Where | Right end of `.sauce-metrics-panel__live-row` (under the pizza, in the dock) | Absolute child of `.pizza-stage`, in the margin beside the dough | Arc on the dough rim |
| Layout cost | 0px (row is already reserved, 18px) | 0px (absolute, `pointer-events: none`) | 0px |
| Visible while the finger is on the pizza | Low: eyes leave the pizza | **High: next to the finger's work area** | High, but collides with the target ring / crust / heatmap |
| Works with no Reference panel | No: the panel only mounts for `referencePizza && !Mission` | **Yes**: independent of the panel | Yes |
| Conflicts | Message copy, Preview-only 🧪 toggle share the row; message "厚いところを広げよう" is ~140px of ~304px | Needs ≥ 12px free side margin (see §7) | Dough-shape-dependent geometry (D3A 8-point), Canvas mozzarella overlap |
| Risk | Row is crowded in Preview; dock height pinned by DM-3R-0 | Edge case: very wide dough (technical max 58 radius) | High; rejected |

Why not add a new row inside the dock: it would raise `--readout-block` (62px) and so the dock's min-height. At 390×844 / 360×800 the stage has room (§7), but on the short profiles (390×664 / 360×620) the pizza is already squeezed to 279 / 235 and the DM-3R-0 contract is "pizza size never changes between steps". A taller dock breaks that contract.

## 7. Layout design (390×844 and 360×800)

Numbers come from `TETO_COOKING-STAGE-SIZE-STABILITY_DM-3R-0_Result.md` (post-fix table) and `App.css`; the side margin is derived, to be re-measured in the implementation PR.

| Profile | Pizza | Stage container | Side margin each side (derived) |
|---|---|---|---|
| 390×844 | 290 | 358 | (390 − 290) / 2 = 50px (stage padding is 16px) |
| 360×800 | 274 | 328 | (360 − 274) / 2 = 43px |
| 390×664 (short) | 279 | 322 | 55px |
| 360×620 (short) | 235 | 278 | 62px |

Option B spec:
- Vertical bar, **14px wide × ~96px tall**, track with a 1px border, fill drains downward, placed in the **right** margin with 8px inset from the screen edge and vertically centered on the dough. Safe on all four profiles (≤ 43px available at the narrowest).
- Label 「ソース」 as a 10–11px caption above or below the bar (below preferred, so the bar top stays aligned with the dough). Total footprint ≤ 40px wide, ≤ 120px tall, inside the stage's own box; **stage and dock heights stay unchanged**.
- `pointer-events: none`, no tab stop, `role="meter"` + `aria-valuemin=0` + `aria-valuemax=100` + `aria-valuenow` + `aria-label="ソース残量"`. It must never intercept a stroke: PizzaStage owns pointer capture on the dough element.
- Visible only while `makingStep === "SAUCE"` and the active ingredient is a spread (the same condition as `isPaintMode` plus the SAUCE step). Hidden in DOUGH / CHEESE / TOPPING / BAKE / CUT / RESULT and for NO_SAUCE recipes (no SAUCE step).
- States: full → draining (colour = the sauce's own tint, no red/green judgment) → empty (bar empty plus the caption changes to 「からっぽ」 for ~1 s; no shake, no sound, no haptic).
- Both of the player's hands: the right margin is under a right-handed thumb only when painting the far right of the dough; the bar is outside the dough, so the stroke area itself is never occluded. Left-handed occlusion is accepted; the bar is a glance indicator, not a control. Owner may choose left placement.
- Reduced motion: no transition on the fill.

Option A fallback layout: bar 72px × 8px + caption on the right of the live row; the message keeps `flex: 1; min-width: 0` and ellipsizes; the Preview 🧪 toggle is unchanged. Only if B fails the 360×800 measurement.

## 8. Minimum implementation, tests, impact

### Minimum implementation (after approval)
1. `sauceQuantity.ts`: one pure helper `sauceRemainingFraction(totalDispensed)` = `clampQuantity(1 − total / SAUCE_MAX_QUANTITY)`, built on `SAUCE_MAX_QUANTITY` so the gauge and the cap cannot drift.
2. `PizzaStage.tsx`: render the gauge from `committedTotalRef.current + pendingTotalRef.current`. The component already calls `forceRender()` on every appended deposit, so it updates live with no new state or effect.
3. `App.css`: one small block for the gauge (class `.sauce-gauge`), nothing else touched.
Not needed: reducer, save, `PizzaState`, new props through `GameScreen`.

### Test plan
- Unit (`sauceQuantity.test.ts`): 0 → 1, MAX → 0, monotone, clamped, `fraction == remaining headroom of tickDepositAmount` for sampled totals (pins the helper to the cap).
- Component (`PizzaStage.sauceGauge.test.tsx`): present only on the SAUCE step with a spread ingredient; `aria-valuenow` follows a pending stroke; stays after commit; refills on sauce switch and on `RESET_PIZZA`; absent for DOUGH / CHEESE / TOPPING and NO_SAUCE; `pointer-events: none` and no tab stop.
- Regression (unchanged, must pass as-is): `sauceQuantity`, `sauceDispenseController`, `sauceField`, `sauceEvaluation`, `completionGate`, `scoringV2.*`, `PizzaStage.sauceParity`, `PizzaStage.sauceReset`, `inventory`, reducer sauce tests. No golden or reference fixture may change.
- E2E (Chromium, 390×844 and 360×800 plus the two short profiles, added to the existing layout-contract spec): pizza size and dock height identical with and without the gauge across DOUGH → SAUCE → CHEESE (extends the DM-3R-0 invariance); gauge fully inside the viewport and not overlapping the dough rect or the tray; a held stroke drains it to empty in ≈2.5 s and a further hold changes nothing. WebKit full run not required; at most one WebKit smoke at implementation time.
- Human Verification per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`: 390×844 video (delivered to the Owner, not committed), 360×800 secondary, before/after screenshots under `docs/reports/screenshots/sauce-remaining-gauge/`.

### Impact on existing features
- Scoring 2.0, Completion Gate, Pitz, Dex, save (`schemaVersion 2`), inventory/economy, Research privacy: **none** (read-only derived value; no reference data used, so no Anti-Oracle exposure).
- Lunch Rush / Free Cooking / Research / Mission SAUCE steps: gauge appears the same way; it carries no recipe information.
- Performance: no extra render (already `forceRender` per tick); one small DOM node.
- #475 Slice work (rasterizer): untouched; the gauge sits outside the heatmap canvas.

## 9. Open decisions for the Owner

1. Placement: B (recommended) or A.
2. Side: right (default) or left.
3. Show a target mark on the bar (e.g. ideal 0.92)? Default **no** (it would turn the gauge into a hint toward the scoring target; the existing 広さ tier already covers that).
4. Numeral: none (default) or 「あと○%」.
5. Scope: every spread-sauce SAUCE step (default) or Free Cooking / Guided only.
6. Empty feedback: caption text only (default) vs adding a haptic/animation.

Implementation and merge wait for the Owner's approval.
