# Batch 6 PR-2 — 4 materials, 2 recipes, Ladder steps 50 / 51 (Result Report)

Branch `claude/batch6-pr2-prep-hz15rr` (base `dd221a0` = main after PR #435, the starGate foundation). No PR yet (Preview Owner HV first).
Authority: Issue #420 OD-420-1 (nothing re-designed), PR #435's `starGates`, and the read-only PR-2 investigation. Scope: PR-2 only — **no unlock-notice UI and no 「⭐あと○個」 copy (PR-3)**.

## 1. What shipped

| Step | ingredient | how it unlocks | glyph |
|---|---|---|---|
| 50 | `avocado` (topping, vegetable) | Ladder alone | 🥑 |
| 50 | `goat-cheese` (cheese) | step 50 reached **AND** cumulative stars ≥ **120** | 🧀 |
| 51 | `artichoke` (topping, vegetable) | Ladder alone | 🌱 |
| 51 | `spinach` (topping, vegetable) | step 51 reached **AND** cumulative stars ≥ **130** | 🍃 |

| No. | recipe | sauce | counts (bake) |
|---|---|---|---|
| 54 | `california-style-pizza` (カリフォルニアスタイルピザ) | NO_SAUCE | goat-cheese 2 / fresh-tomato 2 / arugula 2 / avocado 2 (56-76) |
| 55 | `spinach-artichoke-pizza` (スピナッチアーティチョークピザ) | NO_SAUCE | mozzarella 2 / cream-cheese 1 / parmigiano 1 / spinach 2 / artichoke 2 (54-74) |

Both: 8 non-sauce pieces (the full 8-slot ring), `ladderCredit` on, `lunchRush:false`, no CUT, permanently key-free Hint, T4 economy (existing tier rule: pack 20 / 120 Pitz, refill 60), no new mechanic. Evidence: `california-style-pizza-pizzadb-p2` / `spinach-artichoke-pizza-pizzadb-p4` (172 matrix). Counts / bake windows are GAMEPLAY CALIBRATION (not source). Steps 1-49 (and the W1 fixed 24) are frozen.

The star gates live on the Ladder step (`starGates`, PR #435), **not** on `Ingredient.unlockCondition.minTotalStars` (still inert `0`).

**SSOT notes.** OD-REC04-1's "stars are never a material unlock condition" is amended **only for goat-cheese and spinach** (comment in `src/data/discoveryLadder.ts`). The earlier 140-star placement of `spinach` / `avocado` / `goat-cheese` in `docs/design/TETO_PROGRESSION2_PHASE34_UNLOCKS.md` is superseded by OD-420-1's 120 / 130 (note added at the top of that doc; the generated matrix is left as history).

Totals (code-derived; `catalogLedger.test.ts` is the one ledger): **55 recipes / 61 ingredients (toppings 47, cheeses 11; vegetable shelf 20) / 51 ladder steps / credited 53 / chapter sizes 6, 11, 16, 22 / Lunch Rush pool 25 / NO_SAUCE 12.** Save schema v2 unchanged.

## 2. Existing-save compatibility
No new save field. `resolveShopEntitlement` derives `totalStars(dex)` on every load and every Dex change, so an existing save that already has ≥ 50 discoveries and ≥ 120 / 130 stars receives goat-cheese / spinach on load, exactly once, and never re-locks (the E2E seeds a save that does **not** list the step-51 materials and checks both appear as NEW).

## 3. Verification
- `tsc -b`: clean. `oxlint`: 0 errors (pre-existing warnings only).
- One full Vitest run after the change (the walks were the only place the new gates mattered): see §5 for what moved; final run **green**.
- New `src/state/materialEntitlement.batch6.test.ts` (9): the pinned steps / gates / key recipes; frozen steps 1-49; 49 → nothing; 119 / 120 and 129 / 130 boundaries; stars alone never unlock before the step; retroactive + idempotent + no re-lock; stars not spent; both recipes require the gated material.
- E2E `e2e/expansion-batch6.spec.ts` (renamed from batch5, `iphone-390x844`): PASS ×2 — (1) step 51 played end to end (Shop NEW artichoke + spinach via the retroactive gate → purchase → Research with no identity leak → cook with no sauce step → NEW DISCOVERY → Dex 55/55); (2) a 129-star save keeps spinach out of the Shop while artichoke is NEW.

## 4. Design observations for the Owner (no decision taken here)
- The gates ask for an average of **2.4★ at 50 discoveries** (120 / 50) and 2.55★ at 51 (130 / 51). A player who has only earned ★1-★2 on first discoveries cannot reach them by discovering alone: they must **replay** recipes to raise Dex BEST stars (the registration path re-resolves the entitlement). That is the intended OD-420-1 behaviour, but until PR-3's 「⭐あと○個」 hint exists the player is not told why the last two recipes are stuck. The existing generic 「新しい材料が入荷」 notice fires when the gate opens.
- 🌱 (artichoke) and 🍃 (spinach) were Owner-specified but are already the glyphs of `rosemary` and `oregano`. They are told apart by name / colour; no uniqueness test exists. **Owner HV should judge the glyphs.**

## 5. Snapshots / tests that moved (measured, assertions around them intact)
Counts and id lists (ledger, recipes, progression, chapters, cooking profiles, Lunch Rush opt-out 28 → 30, materialShop rows ×4); DH4-1 audit JSON (category / family / group counts only, regenerated); `deductionGuard.gate` legacy DH4-2A leak count 116 → **123** (the hardened `toEqual([])` held for every state); ladder derivation tests strip `starGates` (authored data the REC-04 rule does not derive) and pin them separately. The 100+-state Dex / Shop overlay sweeps got a 30 s timeout (they sat at the 5 s default).
The fresh-save walks (hint economy, Hint 5.0, research attempts, discovery-hint, W1 reachability) assume a player who reaches the gates: `src/logic/testSupport/starGateReplay.ts` replays recipes for stars only once step 50 is reached, so every earlier stage is unchanged; `discoveryLadder.test.ts` additionally pins that, without stars, **exactly the two Batch 6 recipes** wait on a gate.

## 6. Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `batch6-pr2-hv-390x844.mp4` (H.264, local Playwright capture of the E2E above) | 390×844 | 29.3 s | 0.63 MB | PASS |

Download: delivered directly in the session (never committed; `artifacts/` is gitignored).

Video Verification: PASS

What to check: step-51 Shop rows (🌱 / 🍃, 120 Pitz, NEW) → Research entry names only the unlock ingredient → no sauce step → tray glyphs (🥑 🧀 🌱 🍃) → NEW DISCOVERY → Dex 55/55.

## 7. Owner HV (Preview)
Screenshots in `docs/reports/screenshots/batch6-pr2/` (390×844). Check on the Preview: (a) the 🌱 / 🍃 glyphs next to 🌿 / 🍃 / 🌱 of rosemary / oregano; (b) the NEW 120 Pitz rows for the four materials (and that goat-cheese / spinach appear only at 120 / 130 stars); (c) both recipes have no sauce step; (d) 🥑 and 🧀 on the tray; (e) the Research entries name only the unlock ingredient (goat-cheese / spinach).
