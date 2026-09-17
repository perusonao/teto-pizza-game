# Teto Pizza Game — Issue #47 Slice A — Navigation/Retry/HOME — Result

**Base SHA:** `f295904006ea639f0421e42e4d755be9be018749` (Merge PR #48: Issue #47 Making UX Fresh
Audit — the merged Fresh Audit doc, no production code). Confirmed via
`git fetch origin main && git rev-parse origin/main` at session start; the implementation branch
(`claude/teto-pizza-issue-47-slice-a-gr621p`) was created from this exact commit (working tree
clean, no drift in any file this slice touches between the Fresh Audit's audited SHA
`6e554918c42fc4d8ed267b715992e5ed5cf68e4f` and this base).

**Scope:** Issue #47 Slice A only — Findings A, B, C, D, E, K, per
`docs/reports/TETO_ISSUE-47_MAKING-UX_Fresh-Audit.md` §17. Reference UX (Slice B), Dough, and
Cheese/Topping gesture changes (Slice C, routed to Issue #37 M2) are explicitly out of scope and
untouched.

---

## 1. Root cause → fix mapping

### A — HOME message clipping

- **Root cause (audit):** `.home-hero__bubble` and `.home-hero__teto` were tied at `z-index: 1`;
  equal z-index falls back to DOM order, and `.home-hero__cast` (containing Teto's portrait)
  comes after the bubble in markup, so the portrait painted over line 2 of the bubble text. Not
  a text-clipping/overflow bug — the bubble's own box already fit its full 2-line content.
- **Fix:** `src/App.css` — raised `.home-hero__bubble`'s `z-index` from `1` to `5`, comfortably
  above `.home-hero__teto`'s `1`.
- **Live verification (Playwright/Chromium, 390×844 and 360×800):** `.home-hero__bubble`
  computed `z-index` is now `5` vs. `.home-hero__teto`'s `1`; the bubble's full text
  (`今日はどんなピザを作ろう？`) renders and is visually on top of Teto's portrait at both
  viewports (screenshots captured this session).

### B — Lunch Rush CTA wrapping

- **Root cause (audit):** `.cta-button--home` (flex: 1.3) vs. `.cta-button--home-secondary`
  (flex: 1) split the row 56.5%/43.5%, combined with the shared `.cta-button` base's fixed 20px
  horizontal padding — leaving 「⏱️ ランチラッシュ」 too little width, reproduced as an
  orphan-wrapped kana at 360×800.
- **Fix:** `src/App.css` — evened the split to `flex: 1` on both buttons, and gave
  `.cta-button--home-secondary` slightly tighter horizontal padding (`12px` vs. the shared
  `20px`) for extra margin. Font size unchanged (still 13px, not shrunk further).
- **Live verification:** at both 390×844 and 360×800, the secondary button's text renders as two
  `Range.getClientRects()` entries (one for the emoji glyph run, one for the rest) that share
  the same `y` — i.e. one line, not two. No wrap at either viewport.

### C — Redundant FREE-mode button after Pizza Select

- **Root cause (audit):** `SELECT_RECIPE` (Pizza Select's own dispatch) always built an
  ORDER-phase state via `buildOrderState`; FREE mode's ORDER screen then showed a button
  literally labeled 「🍕 フリープレイ」 — a leftover pre-Issue#39 mode-picker gate, now a pure
  extra tap with a confusing repeated "FREE" label once Pizza Select already picked the recipe
  explicitly.
- **Fix:** `src/state/gameReducer.ts` — added a `startPreparingRecipe` helper (shared with
  Finding D) that builds the same ORDER-phase state and immediately advances it to `"PREPARE"`
  the same way `BEGIN_PREPARE` does (hint built from the fresh empty pizza). `SELECT_RECIPE` now
  calls this instead of `buildOrderState` directly, landing straight on PREPARE.
  **Lunch Rush's own ORDER screen is untouched** — `MISSION_NEXT_ORDER`/`MISSION_RESET_ORDER`
  still go through the unmodified `buildOrderState`/`nextMissionOrderState` path and still show
  their own `"ピザを作る！"` ORDER CTA (verified by a new integration test).
- **Side-effect fix (navigation regression guard):** `App.tsx`'s `isRoundInProgress()` previously
  treated any `PREPARE`-phase state as "in progress" (worth a confirm dialog before leaving).
  Since `SELECT_RECIPE`/`RETRY_SAME_RECIPE` now land on PREPARE immediately (with an empty,
  untouched pizza), that check was refined to also require the round to have actually moved —
  past the SAUCE making step, or with sauce/toppings already placed — so picking a recipe and
  immediately leaving no longer shows a false "作りかけのピザは失われます" prompt, while genuine
  in-progress rounds (deep in PREPARE, mid-BAKE) still confirm exactly as before. Verified by
  both the pre-existing "nothing in progress" test (now passing again with its original
  semantics restored) and the pre-existing "confirms before discarding an in-progress pizza"
  test (still requiring confirmation once the player has actually advanced a step).

### D — Same-recipe retry

- **Root cause (audit):** `PLAY_AGAIN` explicitly calls `getNextOrder({ excludeRecipeId:
  state.recipe.id })`, deliberately excluding the just-played recipe — by design, not a bug —
  so the DISCOVERED phase's single 「もう一度作る」 button always started a *different* recipe
  despite reading like a retry.
- **Fix:**
  - `src/state/gameReducer.ts` — new `RETRY_SAME_RECIPE` action, reusing `startPreparingRecipe`
    keyed to `state.recipe.id` (the same helper Finding C's `SELECT_RECIPE` fix uses) — an
    explicit, first-class "retry this exact recipe" action, landing straight on a fresh PREPARE.
    `PLAY_AGAIN` itself is untouched (still used by Lunch Rush's exit-to-free path).
  - `src/screens/GameScreen.tsx` — DISCOVERED now renders two buttons: 「もう一度つくる」
    (→ `onRetrySameRecipe`, dispatches `RETRY_SAME_RECIPE`) and 「別のピザを作る」
    (→ `onBackToPizzaSelect`, returns to Pizza Select). The old single 「もう一度作る」 button
    and the now-unused `onPlayAgain` prop were removed (no dead prop left behind).
  - `src/App.tsx` — new `handleBackToPizzaSelectFromDiscovered` (mirrors
    `handleStartFreePlay`'s `setScreen("PIZZA_SELECT")`, named for its DISCOVERED-phase call
    site), wired alongside `RETRY_SAME_RECIPE`'s dispatch.
- **Progression preserved:** `startPreparingRecipe`'s `ProgressionCarry` parameter (dex,
  ownedIngredientIds, pitzBalance, lastClaimedMissionRunId) is threaded through unchanged, same
  as every other "start a new round" path — no Save schema change, Dex/BEST/stars/Pitz
  untouched.
- **Lunch Rush unaffected:** Mission play never reaches `DISCOVERED`
  (`MISSION_NEXT_ORDER` explicitly skips straight to the next Mission order — see
  `gameReducer.ts`'s own comment on that case), so the two new DISCOVERED buttons only ever
  render during FREE play. Verified live by a new integration test asserting Lunch Rush's own
  ORDER screen still shows `"ピザを作る！"`, never `RETRY_SAME_RECIPE`/`フリープレイ`.

### E — Next CTA touch target

- **Audit finding:** already correctly positioned/safe-area-aware (`.prepare-bake-bar`,
  `position: fixed`, safe-area-bottom padding) — the only gap was `.cta-button--bake`'s
  `min-height: 48px` vs. HOME's own primary CTA's `54px`.
- **Fix:** `src/App.css` — `.cta-button--bake` `min-height` bumped from the shared `.cta-button`
  base's 48px to 54px. No position/layout change.
- **Live verification:** PREPARE's 「次へ →」 button measured `height: 54px` at 390×844
  (Playwright `boundingBox()`), matching HOME's primary CTA; still bottom-anchored, no overlap
  with PizzaStage or the ingredient tray.

### K — Shop/Pizza Dex reachable from Making

- **Root cause (audit):** `GameScreen.tsx`'s `<header className="app-header">` was unconditional
  across every phase (ORDER/PREPARE/BAKE/RESULT/DISCOVERED) and included Shop/Dex buttons wired
  to the same `onOpenShop`/`onOpenDex` handlers HOME's own menu uses.
- **Fix:** `src/screens/GameScreen.tsx` — removed the Shop/Dex buttons from the header (🏠ホーム
  stays — it already has its own `isRoundInProgress()`-gated confirm dialog). Removed the now-
  unused `onOpenDex`/`onOpenShop` props from `GameScreenProps` and their App.tsx wiring into
  `GameScreen` (HOME's own `onOpenDex`/`onOpenShop` props, and the shared `isDexOpen`/
  `isShopOpen` overlay state, are untouched). Removed the now-orphaned
  `.app-header__shop-button`/`.app-header__dex-button` CSS rules.
- **Live verification:** new integration test asserts `.game-screen .app-header` contains no
  "Shop"/"レシピ図鑑" text and still contains the 🏠ホーム button, checked right after Pizza
  Select → PREPARE. HOME's own Dex/Shop navigation (pre-existing tests, unmodified) still pass.

---

## 2. Exact files changed

- `src/App.css` — Findings A, B, E (bubble z-index, CTA flex/padding, bake-button min-height);
  removed orphaned Shop/Dex header button rules (Finding K cleanup).
- `src/state/gameReducer.ts` — Findings C, D (`startPreparingRecipe` helper,
  `SELECT_RECIPE`/new `RETRY_SAME_RECIPE`).
- `src/screens/GameScreen.tsx` — Findings D, K (DISCOVERED two-button UI; header Shop/Dex
  removal; prop signature updates).
- `src/App.tsx` — Findings D, K (new handler wiring; `GameScreen` prop wiring);
  `isRoundInProgress()` refinement (Finding C side-effect, see above).
- Tests updated/added: `src/state/gameReducer.test.ts`, `src/App.test.tsx`,
  `src/App.humanFeelFix3.test.tsx`, `src/screens/GameScreen.physicalDragOverlay.test.tsx`,
  `src/screens/GameScreen.keyboardOverlay.test.tsx`,
  `src/screens/GameScreen.keyboardSpreadRepeat.test.tsx`.

No Reference/Recipe/Sauce/Cheese/Topping/Dough/Bake/Save/Scoring/Economy file was touched —
confirmed by the diff stat above (10 files, all navigation/UI/reducer-wiring).

---

## 3. Retry state lifecycle

```
DISCOVERED (recipe R, dex/pitz/owned unchanged)
  │
  ├─ 「もう一度つくる」 → RETRY_SAME_RECIPE
  │     → startPreparingRecipe(R.id, carry)
  │     → findOrderForRecipe(R.id) → buildOrderState(order, carry, false)
  │     → phase: "PREPARE", recipe: R (unchanged), pizza: createEmptyPizza(),
  │       makingStep: "SAUCE", score/bakeState/scoringV2Shadow: null,
  │       hint: buildHintLine(R, emptyPizza)
  │     → same screen (GAME), same recipe, fresh making state
  │
  └─ 「別のピザを作る」 → onBackToPizzaSelect (setScreen("PIZZA_SELECT"))
        → GameState itself untouched (still sitting at DISCOVERED underneath);
          Pizza Select's own SELECT_RECIPE (picking any recipe, R or otherwise)
          rebuilds a fresh round exactly the way it already did before this slice.
```

`startPreparingRecipe` is the single new code path both `SELECT_RECIPE` (Finding C) and
`RETRY_SAME_RECIPE` (Finding D) share — one place, not two divergent implementations, matching
the audit's own recommended fix shape (§5/§17).

---

## 4. Before → after navigation

| Flow | Before | After |
|---|---|---|
| `HOME → ピザを作る → Pizza Select → recipe` | lands on ORDER, shows 「🍕 フリープレイ」, one more tap into PREPARE | lands directly on PREPARE — no redundant FREE tap |
| `HOME → ランチラッシュ → スタート` | ORDER phase shows 「ピザを作る！」 | **unchanged** — still shows 「ピザを作る！」, never フリープレイ or a PREPARE skip |
| `DISCOVERED` | one button, 「もう一度作る」, always a **different** recipe | two buttons: 「もう一度つくる」 (same recipe, fresh pizza) and 「別のピザを作る」 (→ Pizza Select) |
| Making header (ORDER/PREPARE/BAKE/RESULT/DISCOVERED) | 🏠ホーム, 🛒Shop, 📖レシピ図鑑 all reachable | only 🏠ホーム; Shop/Dex removed |
| `HOME` menu | 🏠 hub with ピザ図鑑/ショップ cards | **unchanged** — still the sole entry point for Shop/Dex |
| Leaving GAME right after picking a recipe (nothing painted yet) | *(N/A — old flow required an extra フリープレイ tap first)* | no confirm dialog (nothing to lose yet) |
| Leaving GAME after advancing a making step or placing anything | confirm dialog | **unchanged** — still confirms |

---

## 5. Tests

New/updated coverage (all passing):

- `src/state/gameReducer.test.ts`:
  - `SELECT_RECIPE` tests updated to assert `phase: "PREPARE"` (was `"ORDER"`), plus a `hint`
    presence check.
  - New `RETRY_SAME_RECIPE` describe block: same-recipe retry from DISCOVERED lands on PREPARE
    with a fresh empty pizza/null score/bakeState; never drifts to a different recipe across
    repeated retries; preserves dex/pitzBalance/ownedIngredientIds unchanged.
- `src/App.test.tsx`:
  - Updated "selects an unlocked recipe..." to assert no フリープレイ button and a populated
    `.order-card` instead of the old intermediate-ORDER assertions.
  - New: no Shop/Dex navigation inside `.game-screen .app-header` (Finding K).
  - New: Lunch Rush's own ORDER screen unaffected by the Finding C change.
  - Rewrote the old single-button DISCOVERED test into three: two-button presence + old label
    absence, same-recipe retry (fresh PREPARE, same recipe, no フリープレイ/Pizza Select),
    「別のピザを作る」→ Pizza Select.
  - New: Pitz balance stable across a same-recipe retry.
  - Two pre-existing GAME↔HOME confirm-dialog tests updated for the new Pizza-Select-lands-on-
    PREPARE flow, exercising the `isRoundInProgress()` refinement from both directions (no
    false-positive confirm right after picking a recipe; still-required confirm once a step has
    advanced).
- `src/App.humanFeelFix3.test.tsx`: `enterFreePlayPrepare()` helper updated (no フリープレイ tap).
- `src/screens/GameScreen.{physicalDragOverlay,keyboardOverlay,keyboardSpreadRepeat}.test.tsx`:
  prop wiring updated (`onOpenDex`/`onOpenShop`/`onPlayAgain` → `onRetrySameRecipe`/
  `onBackToPizzaSelect`) to match the new `GameScreenProps` shape.

Findings A/B/E (pure CSS) are not testable via this repo's jsdom-based Vitest suite — confirmed
empirically this session (`getComputedStyle` on a CSS-file-styled element returns unstyled jsdom
defaults; no `css: true` in `vitest.config.ts`), matching the Fresh Audit's own §18 conclusion
("jsdom can't lay out text metrics reliably ... better covered by a Playwright/real-browser smoke
check"). These three are verified instead via a live Playwright/Chromium pass at 390×844 and
360×800 (see §1 above) and the Review Playthrough video (§7).

**Results:** `npm test` — 895/895 passing (49 files). `npx tsc -b` — clean. `npm run lint`
(oxlint) — clean. `npm run build` — succeeds (`dist/` produced, 310KB JS / 33KB CSS, gzip
99KB/7KB).

---

## 6. Scope guard

Confirmed untouched (grep + diff-stat review): Reference fixtures/scoring (`referencePizza.ts`,
`referenceScoring.ts`), Scoring 2.0 (`logic/scoringV2/*`), Recipe definitions (`data/recipes.ts`),
Sauce/Cheese/Topping mechanics (`PizzaStage.tsx`, `IngredientTray.tsx`, `pieceDrag.ts`), Dough
(no `doughShape` anywhere yet — Issue #33 territory), Bake scoring (`logic/bake.ts`,
`logic/scoring.ts`), Save schema (`state/persistence.ts` untouched, no `PersistentSaveV1` field
added/removed/renamed), Economy/Pitz rules (`logic/economy.ts` untouched — Findings preserve
`pitzBalance`/`ownedIngredientIds` via the same `ProgressionCarry` pass-through every other round
transition already used).

---

## 7. Review Playthrough / Preview / remaining work

See the final session summary for: PR link, CI status, `teto-pizza-game-preview` deployment URL
and badge verification, and the 390×844 Review Playthrough MP4 path.

**Remaining Slice B (Reference UX, Finding F/H)** — not started, per Issue #47's own slicing:
persistent mini Reference thumbnail during Making (Finding H), and expanding
`referencePizza.ts` beyond Margherita (Finding F) — sauce-target generation is mechanically
generatable for all 7 recipes; piece-placement layouts need hand authorship per recipe and should
be scoped as its own follow-up rather than compressed into Slice B.

**Remaining Slice C (Making controls)** — Finding I needs no code change (already correct,
documented in the Fresh Audit). Finding J (Cheese/Topping drag scope) is explicitly routed to
Issue #37 M2, which already owns that system — not decided or implemented here.
