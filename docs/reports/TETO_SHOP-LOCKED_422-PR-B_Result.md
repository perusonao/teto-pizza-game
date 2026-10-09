# #422 PR-B — Shop anonymous LOCKED section (Result)

Base: `main` `3f5bcbfdd0c014b0d38f3e408ecc8281eb12c05f` (PR #433, PR-A). Authority: Issue #422 (OD-DISPLAY-1 / 2).

## Change
- `ShopLockedSection.tsx` (new): takes a **count only** and renders one `AnonymousLockFrame` per LOCKED material in its own
  2-column grid (`.shop-locked__grid`), outside the category tabs and below the NEW / OWNED list. Renders nothing for 0.
- `ShopOverlay.tsx`: LOCKED count = `materialShopState === "LOCKED"` only (a material without a `materialOffer` still counts;
  starters / UNLIMITED never do). NEW / OWNED rows, tabs, feedback, "あとNつ発見" hint unchanged.
- `anonymousLockHints.ts`: one fixed line `SHOP_LOCKED` (「入荷前の材料」). `App.css`: `.shop-locked*` rules only.
- A LOCKED slot shows 🔒 silhouette, 「？？？」 and the fixed line. No name, id, emoji, family, price, pack size, button, or
  `data-ingredient-id`; React keys are indices; the only data attribute is `data-shop-state="LOCKED"`.
- Not touched: purchase / refill / reducer, hint logic, save schema, economy, Dex, CUT, Batch 6 (⭐ line is PR-C).

## Tests (local, focused)
- `ShopOverlay.locked.test.tsx` (new, 10): independent population count, unlock removes one slot, 0 -> section absent,
  anonymity (no ids / names / emoji / price / buttons, identical slot markup, whitelisted data attributes), source has no
  catalog imports, reducer still refuses `PURCHASE_INGREDIENT` for a LOCKED id.
- `ShopOverlay.test.tsx`: the old "no 🔒" assertion now says "no 🔒 outside the LOCKED section".
- `e2e/shop-locked-422.spec.ts` (new, Chromium 390x844 + 360x800): 2 columns, cells >= 44px, no overflow, NEW/OWNED single
  column and above LOCKED, last slot reachable, tabs do not affect the section. `ingredient-shelf-shop` e2e unchanged and green.
- Related vitest 204 passed; `tsc` clean. Full Vitest / WebKit / Layout Gate are left to the PR CI.

## Screenshots
`docs/reports/screenshots/shop-locked-422/` (before / after-locked / after-end, 390 and 360). "before" hides the section from the same
save, not an old build.

## Owner iPhone Human Verification — PASS
Preview source `82044341826d9bc3724ea3371cd08c2d722a2b66` (`deploy-from-source.yml` run 37916695477, Pages run 37917686297);
PREVIEW badge `8204434` matched.

| Item | Result |
|---|---|
| Existing NEW / OWNED display | PASS |
| LOCKED 2-column grid | PASS |
| Anonymous display | PASS |
| Scroll to the last LOCKED slot | PASS |
| No horizontal overflow / bottom clipping | PASS |
| PREVIEW badge = 8204434 | PASS |

The video was delivered to the Owner directly and is not committed (HV policy). The commit after `8204434` is docs-only (this report).
