# Inventory Screen — Implementation Result Report

## 0. Summary

Adds a new, structurally READ-ONLY **Inventory Screen** (`InventoryOverlay.tsx`) reachable
from HOME's sub-navigation ("材料"), showing what ingredients the player currently owns and
how much stock remains, grouped by category with a `すべて`/`ソース`/`チーズ`/`トッピング` tab
filter. Shop (purchase/restock) and Inventory (view) are now two separate global overlays with
non-overlapping responsibilities, both reusing the same `.dex-overlay` modal chrome/z-index
pattern DexOverlay/ShopOverlay already established.

**FINAL VERDICT: A. INVENTORY SCREEN COMPLETE — READY FOR MERGE REVIEW**

## 1. Fresh GitHub Gate

- **Audited main SHA (task brief's known SHA):** `c647dcce629f9beaf9fc8bb36c4520afd8e1af39`
  (PR #95, Issue #86 UX-2: Making Step Tabs + Ingredient Tray Scalability)
- **origin/main at session start:** confirmed identical, `c647dcce629f9beaf9fc8bb36c4520afd8e1af39`
  (verified via `list_commits`/`git fetch origin main` — no newer commit exists upstream).
- **Base branch used:** `origin/main` @ `c647dcce629f9beaf9fc8bb36c4520afd8e1af39`, confirmed
  with `git merge-base HEAD origin/main` before any code was written.
- **OPEN PR gate:** 4 OPEN PRs existed repo-wide at gate time — #72 (docs), #46 (Dough Shaping
  D0 audit), #34 (Issue #32 Phase 1 visuals), #3 (docs) — none related to Inventory/stock/
  material or the Inventory Screen.
- **Duplicate-work gate:** searched all PRs (open+closed) and branches for "inventory". Found
  6 historical PRs, **all closed/merged**, all scoped to the *InventoryState SSOT foundation*
  (Save v2 schema, `GameState.inventory` wiring, EP2 atomic consumption at CONFIRM_BAKE) — none
  of them an Inventory *Screen*/UI:
  - #53/#70 "Save v2 / Inventory Fresh Audit / InventoryState Fresh Audit" (docs-only)
  - #56 "Save v2 / Inventory E0: safe v1→v2 persistence migration"
  - #78 "Save v2 / Inventory E1: wire InventoryState into GameState (foundation only)"
  - #73 "docs: Inventory E1 Implementation Preflight"
  - #82 "Economy & Progression 1.0 EP2: Inventory atomic consumption at CONFIRM_BAKE"

  A handful of stale remote branches with "inventory" in the name (e.g.
  `claude/inventory-e1-production-28q492`, `claude/inventory-e2-atomic-consumption-3uknx2`)
  correspond 1:1 to these same already-merged/closed PRs — confirmed via
  `search_pull_requests(head:<branch>)` for each. **No open PR or in-flight branch targets an
  Inventory Screen/UI.** No duplicate-work risk found; proceeded.
- **Re-checked immediately before opening the PR** (see §11) — no new Inventory-titled PR
  appeared during implementation.

## 2. Audit document

`TETO_INVENTORY-SCREEN_Fresh-Audit.md` was **not found** in the repository (checked via glob
across the whole tree) and is not referenced by any commit reachable from `main`. Proceeded
directly from the task brief's own summary of that audit's findings, cross-verified live
against the current codebase (all findings below were independently re-confirmed, not assumed):
`Ingredient.category` exists (`sauce`/`cheese`/`topping`), `InventoryState`/`remainingStock`/
`ownedIngredientIds` are all real and unchanged, Shop/Inventory responsibility separation is
architecturally clean, the `.dex-overlay` global-overlay pattern is reusable as-is, and no Save
schema change was needed.

## 3. PR #95 confirmation (Making Step Tabs / Ingredient Tray Scalability)

Confirmed present and untouched on the branch this work is based on:
`MakingStepTabs.tsx`, `IngredientTray.tsx`'s "このピザにおすすめ"/"その他" split,
`ingredient-chip__stock` (`×N`/`∞`), zero-stock `disabled` chips, and the
`MAX_INGREDIENT_PALETTE_SLOTS`-based pagination for >6 owned "Other" ingredients. **None of
these files were modified** by this change — `git diff origin/main --stat` shows only
`App.tsx`, `App.css`, `HomeScreen.tsx` touched, plus new files. Full regression run (§8)
confirms all of PR #95's own tests still pass unchanged.

## 4. Architecture

- **New component:** `src/components/InventoryOverlay.tsx` — props are
  `{ ownedIngredientIds: readonly string[]; inventory: InventoryState; onClose: () => void }`
  only. **No `onPurchase`/`onRestock`/dispatch prop of any kind exists in the type** — this is
  a structural (compile-time), not conventional, guarantee that the component cannot mutate
  game state. It renders `INGREDIENTS` filtered to owned ids, grouped/filterable by
  `Ingredient.category` via `CATEGORY_ORDER`/`CATEGORY_LABEL` (both reused, unmodified, from
  `../data/ingredients.ts`), with per-item stock from `remainingStock()` (reused, unmodified,
  from `../state/inventory.ts`).
- **Reused, not duplicated:** `remainingStock`, `INGREDIENTS`, `CATEGORY_ORDER`,
  `CATEGORY_LABEL`, `IngredientPieceVisual` (cheese physical visual) — the exact same functions/
  components ShopOverlay and IngredientTray already use for stock/visual display.
- **Overlay pattern reuse:** root markup is
  `<div className="dex-overlay"><div className="dex-overlay__panel inventory-overlay__panel">`,
  exactly mirroring how `ShopOverlay` reuses `DexOverlay`'s own container class for the shared
  bottom-sheet chrome and `z-index: 20` stacking — no new z-index layer was introduced.
- **App.tsx wiring:** a third `useState` (`isInventoryOpen`), toggled from a new HOME card,
  folded into `isGlobalOverlayOpen={isDexOpen || isShopOpen || isInventoryOpen}` exactly like
  the existing two flags — no reducer action, no new action type, no dispatch path added
  anywhere for Inventory.

## 5. Shop / Inventory responsibility split

| | Shop | Inventory |
|---|---|---|
| Purpose | purchase / restock | view owned + remaining stock |
| Mutates state? | yes (`PURCHASE_INGREDIENT`/`RESTOCK_INGREDIENT`) | **no — cannot, structurally** |
| Props | `onPurchase`, `onRestock`, `pitzBalance`, `dex`, ... | `ownedIngredientIds`, `inventory`, `onClose` only |
| Shows LOCKED/AVAILABLE_TO_BUY | yes | no (owned-only, no unlock/purchase UI) |

Verified with a dedicated test (`App.inventoryOverlay.test.tsx`, "never renders a purchase or
restock control") that no `購入`/`補充する` button exists anywhere inside `InventoryOverlay`'s
rendered output, even when the same onion fixture that produces those exact buttons in
`ShopOverlay` is used.

## 6. Navigation

HOME's `home-menu` grid gained a 4th card ("🧺 材料", sub-label `所持 N/14種`) between ショップ
and the disabled 実績 card. Opens `InventoryOverlay` via the same local-`useState` +
conditional-render pattern as ピザ図鑑/ショップ — a modal over HOME, not a screen navigation
(HOME stays mounted underneath, confirmed by test).

## 7. Category design

Tabs: `すべて` / `ソース` / `チーズ` / `トッピング` — driven entirely by
`IngredientCategory`/`CATEGORY_ORDER`/`CATEGORY_LABEL`, the existing SSOT. No ingredient-id
hardcoding of any kind. `ALL`-prefixed tab list (`["ALL", ...CATEGORY_ORDER]`) means adding a
4th real category to the game later requires zero changes here — the tab bar and grid both
grow automatically.

## 8. Stock SSOT

Every stock number shown comes from `remainingStock(ingredient, inventory)` — the identical,
unmodified function `IngredientTray`/`ShopOverlay` already call. `"UNLIMITED"` → `∞`;
otherwise → `×${n}` (including `×0` for an owned-but-depleted finite ingredient, never hidden).
No second inventory calculation was written. `starterGrantClaimedRecipeIds` is never read or
referenced by this component — confirmed by grep (only `gameReducer.ts`/`starterStock.ts`
touch it) and by the fact `InventoryOverlay`'s props don't even carry it.

## 9. Read-only guarantee

Structural, not just behavioral: `InventoryOverlayProps` has no dispatch-shaped field, so no
future edit to this file's JSX could wire up a mutation without first widening the prop type
(a visible, reviewable diff). Verified by test that clicking anything inside the overlay other
than a category tab or 閉じる has no observable effect on `ownedIngredientIds`/`inventory`.

## 10. Save impact

**None.** No `PersistentSaveV2` field was added, changed, or read differently. No new
localStorage key. No migration logic touched. Confirmed by full regression suite (§13, all
persistence/migration tests still pass) and by inspection: `InventoryOverlay.tsx` imports
nothing from `../state/persistence`.

## 11. Duplicate-PR re-check (immediately before opening the PR)

Re-ran the OPEN PR search across the repo immediately before PR creation: still only the same
4 pre-existing OPEN PRs (#72, #46, #34, #3), none Inventory-Screen-related. No new duplicate
appeared during implementation. Proceeded to open the PR.

## 12. Scalability (14 / 30 / 62)

- **~14 (current, real data):** `InventoryOverlay.test.tsx` renders every real owned ingredient
  across all 3 categories with the actual, unmocked `../data/ingredients` module — 14/14 render
  correctly, confirmed count assertion (`INGREDIENTS.length === 14`).
- **~30 (mocked):** `InventoryOverlay.scalability.test.tsx` mocks `INGREDIENTS` to a synthetic
  62-entry catalog (mirroring Issue #86's own `IngredientTray.scalability.test.tsx` fixture) and
  owns a 30-item subset — renders without crashing, correct summary count.
- **62 (mocked, full catalog):** same file, all 62 owned — renders without crashing; a category
  tab still bounds the visible grid to just that category's items (never dumps all 62 at once).
- **UI strategy for scale:** category tabs + a compact 3-column grid + the overlay panel's
  existing `overflow-y: auto` scroll (inherited from `.dex-overlay__panel`, unchanged) — no new
  scroll container was invented. No search was added (per task scope — flagged as a future
  candidate past ~80 ingredients, matching the task brief's own note).

## 13. Mobile verification

Playwright (Chromium, pre-installed) against the real Vite dev server, at both required
viewports, seeded via `localStorage` fixtures covering unlimited/finite/zero-stock/full-14-owned
states. Screens captured: HOME, Inventory `すべて` (mixed owned set), each category
(ソース/チーズ/トッピング), and the full current 14-ingredient catalog owned at once (this
repo's real "long list" ceiling — the 30/62 *scalability behavior* itself is verified by the
automated mocked-catalog tests in §12, since production data only has 14 real ingredients to
render live).

- **390×844:** horizontal overflow = **0px** on every screen (HOME, Inventory ALL/each
  category/full-14). Console errors = **0**.
- **360px:** horizontal overflow = **0px** on every screen. Console errors = **0**.
- **HOME 4-card layout:** switched `.home-menu` from a 3-column to a 2×2 grid (rather than a
  cramped 4-across row) specifically for this change — confirmed visually at both widths that
  ピザを作る/ランチラッシュ CTAs and all 4 sub-navigation cards (ピザ図鑑/ショップ/材料/実績)
  remain fully on-screen with no card being pushed off-frame or truncated.

Screenshots saved during verification (not committed — session scratch space):
`390x844-{01..06}-*.png`, `360px-{01..06}-*.png` covering HOME, Inventory ALL/category
filters, and the full 14-ingredient view at both breakpoints.

## 14. Tests

71 → 74 test files, 1368 → 1397 tests, all passing. New coverage:

- `src/components/InventoryOverlay.test.tsx` (16 tests, real data): owned/unowned filtering,
  ∞/×N/×0 stock display, absent-key-reads-as-0 convention, category tab filter + switching,
  empty-category state, `onClose` wiring, read-only guarantee (no 購入/補充 control anywhere),
  cheese physical-visual reuse, per-card category label, live owned/total summary, Starter
  Grant reflection, post-`consumePizzaInventory` (CONFIRM_BAKE) consumption reflection, full
  real 14-ingredient catalog render.
- `src/components/InventoryOverlay.scalability.test.tsx` (3 tests, mocked catalog): ~30 mocked,
  full 62 mocked, category-bounded grid under the 62-mocked catalog.
- `src/App.inventoryOverlay.test.tsx` (10 tests, end-to-end through real `App`): HOME entry
  point exists, opens over HOME without replacing it, closes via 閉じる, default owned-only
  display hides an unowned ingredient, category filter through real UI, no purchase/restock
  control end-to-end, **Shop restock is reflected in Inventory once reopened** (real
  `RESTOCK_INGREDIENT` dispatch → real state → Inventory reads the same `state.inventory`),
  an already-persisted Starter Grant is reflected exactly, and two regression checks confirming
  Dex/Shop overlays still open correctly after the wiring change.
- Full existing suite (all 71 pre-existing files, including every PR #95 Ingredient Tray test
  and every Economy & Progression 1.0 EP1-4 test) re-run and passing unchanged — see §15.

## 15. Typecheck / lint / build

- `npx tsc -b` — **clean, 0 errors.**
- `npx oxlint` — **clean, 0 warnings/errors.**
- `npm run build` (`tsc -b && vite build`) — **succeeded**, `dist/` produced
  (`index-CrjKkk1i.js` 336.99 kB / gzip 105.69 kB, `index-DjVJPtWQ.css` 39.61 kB / gzip 8.24 kB).
- `npx vitest run` (full suite) — **1397/1397 passing, 71 files** (68 pre-existing + 3 new).

## 16. Changed / added files

```
M  src/App.tsx                                        (+useState, +prop wiring, +render block)
M  src/App.css                                         (+Inventory CSS block, home-menu 2x2)
M  src/screens/HomeScreen.tsx                          (+onOpenInventory prop, +4th card)
A  src/components/InventoryOverlay.tsx
A  src/components/InventoryOverlay.test.tsx
A  src/components/InventoryOverlay.scalability.test.tsx
A  src/App.inventoryOverlay.test.tsx
A  docs/reports/TETO_INVENTORY-SCREEN_Implementation-Result.md
```

No file under PR #95's own scope (`MakingStepTabs.tsx`, `IngredientTray.tsx`, their tests) was
touched. No file under `src/state/` (reducer, inventory, persistence, progression, economy)
was touched.

## 17. Limitations / follow-ups (none blocking)

- The 30/62-ingredient scalability claim is verified via mocked-catalog automated tests
  (matching this repo's own established convention from Issue #86), not a live-browser
  screenshot, since production data currently has only 14 real ingredients — there is nothing
  larger to actually screenshot yet. This mirrors exactly how PR #95 itself validated its own
  30/62 scalability.
- Per task scope, explicitly **not** implemented: search, favorites, sort customization,
  recipe-specific "何枚作れるか" count, Shop redesign, Chapter/Tier, Save schema changes. No
  blocker was hit that required any of these — none needed for this task's scope.

## 18. Risks

Low. Change is additive (one new component, one new prop chain, one new HOME card, one CSS
block); nothing in `src/state/` or `src/logic/` was touched, so the Economy/Progression/Save
guarantees listed in the task brief are structurally unaffected (verified by full regression
suite, §14-15).

## 19. HEAD SHA

To be recorded after commit (see PR description for the exact pushed SHA).

## FINAL VERDICT

**A. INVENTORY SCREEN COMPLETE — READY FOR MERGE REVIEW**
